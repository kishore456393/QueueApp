import base64
import io
import os
import threading
import time
from typing import List, Dict, Any

import numpy as np
import cv2
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ultralytics import YOLO
from PIL import Image
from tts_service import text_to_speech_base64

app = FastAPI()

default_origins = ["http://localhost:5000", "http://127.0.0.1:5000"]
cors_origins_raw = os.getenv("CORS_ORIGINS", "")
cors_origins = [origin.strip() for origin in cors_origins_raw.split(",") if origin.strip()]
allow_origins = cors_origins if cors_origins else default_origins

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load YOLO model (prefer local model if present)
# You can place a .pt model in attached_assets/yolov8m_1762262649284.pt
MODEL_PATHS = [
    'attached_assets/yolov8m_1762262649284.pt',  # local bundled model
    'yolov8n.pt',  # fallback to ultralytics default (may download)
]

_model = None
for path in MODEL_PATHS:
    try:
        _model = YOLO(path)
        break
    except Exception:
        _model = None

if _model is None:
    # Last attempt: load smallest model
    _model = YOLO('yolov8n.pt')


class Point(BaseModel):
    x: float
    y: float

class Polygon(BaseModel):
    points: List[Point]

class DetectRequest(BaseModel):
    image_b64: str  # base64-encoded JPEG/PNG
    polygons: List[Polygon]
    conf: float | None = 0.04  # detection confidence (lower = more detections)

class DetectResponse(BaseModel):
    counts: List[int]
    annotated_frame_b64: str | None = None  # Optional annotated frame
    detections: List[Point] = []  # Center points of detected people


def point_in_polygon(px: float, py: float, polygon: List[Point]) -> bool:
    # Ray casting algorithm
    inside = False
    n = len(polygon)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i].x, polygon[i].y
        xj, yj = polygon[j].x, polygon[j].y
        intersect = ((yi > py) != (yj > py)) and (
            px < (xj - xi) * (py - yi) / (yj - yi + 1e-9) + xi
        )
        if intersect:
            inside = not inside
        j = i
    return inside


@app.post('/detect', response_model=DetectResponse)
def detect(req: DetectRequest):
    # Decode image
    try:
        img_bytes = base64.b64decode(req.image_b64)
        img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
        frame = np.array(img)
    except Exception as e:
        return DetectResponse(counts=[0 for _ in req.polygons], annotated_frame_b64=None)

    # Create a copy for annotation
    annotated_frame = frame.copy()

    # Draw polygons on the frame
    colors = [(255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 0), (255, 0, 255), (0, 255, 255)]
    for idx, poly in enumerate(req.polygons):
        color = colors[idx % len(colors)]
        # Convert polygon points to numpy array
        pts = np.array([[int(p.x), int(p.y)] for p in poly.points], np.int32)
        pts = pts.reshape((-1, 1, 2))
        # Draw polygon outline
        cv2.polylines(annotated_frame, [pts], True, color, 3)
        # Draw semi-transparent fill
        overlay = annotated_frame.copy()
        cv2.fillPoly(overlay, [pts], color)
        cv2.addWeighted(overlay, 0.2, annotated_frame, 0.8, 0, annotated_frame)
        # Add queue label
        if len(poly.points) > 0:
            label_x = int(poly.points[0].x)
            label_y = int(poly.points[0].y) - 10
            cv2.putText(annotated_frame, f'Queue {idx + 1}', (label_x, label_y), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

    # Run YOLO detection for person class (0)
    results = _model.predict(frame, classes=[0], conf=req.conf or 0.07, verbose=False)

    # Aggregate counts per polygon using bbox center and draw boxes
    counts = [0 for _ in req.polygons]
    detections = []
    try:
        res = results[0]
        if res.boxes is not None and len(res.boxes) > 0:
            xyxy = res.boxes.xyxy.cpu().numpy().astype(float)  # (N, 4): x1,y1,x2,y2
            confs = res.boxes.conf.cpu().numpy() if res.boxes.conf is not None else [0.0] * len(xyxy)
            
            for box, conf in zip(xyxy, confs):
                x1, y1, x2, y2 = box
                cx = (x1 + x2) / 2.0
                cy = (y1 + y2) / 2.0
                
                # Assign to the first polygon that contains center
                assigned_queue = -1
                for idx, poly in enumerate(req.polygons):
                    if point_in_polygon(cx, cy, poly.points):
                        counts[idx] += 1
                        assigned_queue = idx
                        break
                
                # Draw bounding box (green if assigned to a queue, red otherwise)
                box_color = (0, 255, 0) if assigned_queue >= 0 else (0, 0, 255)
                cv2.rectangle(annotated_frame, (int(x1), int(y1)), (int(x2), int(y2)), box_color, 2)
                
                # Draw confidence and queue assignment
                label = f'{conf:.2f}'
                if assigned_queue >= 0:
                    label += f' Q{assigned_queue + 1}'
                cv2.putText(annotated_frame, label, (int(x1), int(y1) - 5),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, box_color, 2)
                
                # Draw center point
                cv2.circle(annotated_frame, (int(cx), int(cy)), 4, (255, 255, 0), -1)
                
                # Add to detections list
                detections.append(Point(x=cx, y=cy))
    except Exception as e:
        print(f"Detection error: {e}")
        pass

    # Encode annotated frame to base64
    # Resize for dashboard display (reduce bandwidth)
    h, w = annotated_frame.shape[:2]
    target_w = 640
    if w > target_w:
        target_h = int(h * (target_w / w))
        annotated_frame = cv2.resize(annotated_frame, (target_w, target_h))

    # Encode annotated frame to base64 with reduced quality
    try:
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 70]
        _, buffer = cv2.imencode('.jpg', cv2.cvtColor(annotated_frame, cv2.COLOR_RGB2BGR), encode_param)
        annotated_b64 = base64.b64encode(buffer).decode('utf-8')
    except Exception:
        annotated_b64 = None

    return DetectResponse(counts=counts, annotated_frame_b64=annotated_b64, detections=detections)


@app.get('/')
def root():
    return {"status": "ok", "model": str(_model.model if hasattr(_model, 'model') else 'yolo')}


class TTSRequest(BaseModel):
    text: str
    language: str = 'en'

class TTSResponse(BaseModel):
    audio_b64: str | None = None
    error: str | None = None


class CaptureRequest(BaseModel):
    source: str | int  # URL or device index
    
class CaptureResponse(BaseModel):
    frame_b64: str | None = None
    error: str | None = None


# Thread-safe persistent stream cache
class CameraStreamReader:
    def __init__(self, source):
        self.source = source
        self.cap = cv2.VideoCapture(source)
        self.latest_frame = None
        self.last_accessed = time.time()
        self.running = True
        self.lock = threading.Lock()
        self.thread = threading.Thread(target=self._update, daemon=True)
        self.thread.start()

    def _update(self):
        print(f"[StreamReader] Thread started for source: {self.source}")
        while self.running:
            # Shutdown after 15 seconds of inactivity
            if time.time() - self.last_accessed > 15.0:
                print(f"[StreamReader] Source {self.source} inactive for 15s, stopping thread.")
                break

            if not self.cap.isOpened():
                self.cap = cv2.VideoCapture(self.source)
                time.sleep(2.0)
                continue

            ret, frame = self.cap.read()
            if ret:
                with self.lock:
                    self.latest_frame = frame
            else:
                time.sleep(0.01)

        self.running = False
        self.cap.release()
        
        # Safely remove from active_streams
        global active_streams
        with active_streams_lock:
            if str(self.source) in active_streams:
                active_streams.pop(str(self.source), None)

    def get_frame(self):
        self.last_accessed = time.time()
        with self.lock:
            return self.latest_frame

    def stop(self):
        self.running = False


active_streams = {}
active_streams_lock = threading.Lock()


@app.post('/capture', response_model=CaptureResponse)
def capture_frame(req: CaptureRequest):
    """
    Capture a single frame from a video source (URL or device index) using cached StreamReader threads
    """
    try:
        source = req.source
        if isinstance(source, str) and source.isdigit():
            source = int(source)

        key = str(source)
        
        with active_streams_lock:
            reader = active_streams.get(key)
            if reader is None or not reader.running:
                reader = CameraStreamReader(source)
                active_streams[key] = reader

        # Wait a moment for the first frame if the stream is newly opened
        frame = None
        for _ in range(50):  # Wait up to 5 seconds
            frame = reader.get_frame()
            if frame is not None:
                break
            time.sleep(0.1)

        if frame is None:
            return CaptureResponse(error="Failed to read frame from stream (timeout waiting for first frame)")

        # Encode frame to base64
        _, buffer = cv2.imencode('.jpg', frame)
        frame_b64 = base64.b64encode(buffer).decode('utf-8')
        
        return CaptureResponse(frame_b64=f"data:image/jpeg;base64,{frame_b64}")
    except Exception as e:
        return CaptureResponse(error=str(e))


@app.post('/tts', response_model=TTSResponse)
async def text_to_speech(req: TTSRequest):
    """
    Convert text to speech using Edge TTS and return as base64 MP3.
    """
    try:
        audio_b64 = await text_to_speech_base64(req.text, req.language)
        if audio_b64:
            return TTSResponse(audio_b64=audio_b64)
        else:
            return TTSResponse(error="Failed to generate speech")
    except Exception as e:
        return TTSResponse(error=str(e))


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8000)
