import { storage } from "./storage";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import { randomUUID } from "crypto";
import { captureStreamFrame } from "./stream-capture";
import type { DetectionSnapshot } from "@shared/schema";

let detectionInterval: NodeJS.Timeout | null = null;
let currentVideoId: string | null = null;
let currentSecond = 0;
let onUpdateCallback: ((snapshot: DetectionSnapshot) => void) | null = null;

function getDetectorBaseUrl(): string {
  return (process.env.DETECTOR_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
}

export function setYoloUpdateCallback(callback: (snapshot: DetectionSnapshot) => void): void {
  onUpdateCallback = callback;
}

import fs from "fs";
import path from "path";

async function extractFrameJpeg(filePath: string, timeSec: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Use accurate seek by placing -ss after -i to avoid empty output on some MP4/H264 inputs
    const seek = Math.max(0, Math.floor(timeSec));
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      filePath,
      "-ss",
      String(seek),
      "-vframes",
      "1",
      "-q:v",
      "2",
      "-f",
      "mjpeg",
      "pipe:1",
    ];
    const ff = spawn(ffmpegPath as string, args);
    const chunks: Buffer[] = [];
    let err = Buffer.alloc(0);
    ff.stdout.on("data", (d) => chunks.push(d));
    ff.stderr.on("data", (d) => (err = Buffer.concat([err, d])));
    ff.on("close", (code) => {
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`ffmpeg failed: ${err.toString()}`));
      }
    });
  });
}

async function postToDetector(imageB64: string, polygons: Array<Array<{ x: number; y: number }>>): Promise<{ counts: number[]; annotatedFrame: string | null; detections: Array<{ x: number, y: number }> }> {
  const body = {
    image_b64: imageB64,
    polygons: polygons.map((pts) => ({ points: pts })),
    conf: 0.07,
  };
  const detectorBaseUrl = getDetectorBaseUrl();
  const res = await fetch(`${detectorBaseUrl}/detect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`detector error: ${res.status}`);
  const json = (await res.json()) as { counts: number[]; annotated_frame_b64?: string; detections?: Array<{ x: number, y: number }> };
  return {
    counts: json.counts || [],
    annotatedFrame: json.annotated_frame_b64 ? `data:image/jpeg;base64,${json.annotated_frame_b64}` : null,
    detections: json.detections || [],
  };
}

export function isYoloRunning(): boolean {
  return detectionInterval !== null;
}

export function getCurrentVideoId(): string | null {
  return currentVideoId;
}

export async function checkDetectorHealth(): Promise<boolean> {
  try {
    // Simple health check or just try to hit the root/docs
    const detectorBaseUrl = getDetectorBaseUrl();
    const res = await fetch(`${detectorBaseUrl}/docs`, { method: "HEAD" });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function startYoloDetection(params: { videoId: string; updateInterval?: number }) {
  if (detectionInterval) stopYoloDetection();

  // Fail fast if detector is not running
  const isHealthy = await checkDetectorHealth();
  if (!isHealthy) {
    throw new Error(`YOLO detector service is not reachable at ${getDetectorBaseUrl()}`);
  }

  const { videoId, updateInterval = 2000 } = params;
  const video = await storage.getVideo(videoId);
  if (!video) throw new Error("Video not found");
  const zones = await storage.getQueueZonesByVideo(videoId);
  if (zones.length === 0) throw new Error("No queue zones defined for this video");

  currentVideoId = videoId;
  currentSecond = 0;

  detectionInterval = setInterval(async () => {
    try {
      let b64: string;

      if (video.sourceType === 'file') {
        let filePath = video.filepath;
        
        // Fallback: Check if file exists at stored path, if not try local uploads dir
        if (!fs.existsSync(filePath)) {
          const localPath = path.join(process.cwd(), 'uploads', path.basename(filePath));
          if (fs.existsSync(localPath)) {
            console.log(`[YOLO] Stored path not found, using local fallback: ${localPath}`);
            filePath = localPath;
          } else {
             console.warn(`[YOLO] File not found at stored path or local fallback: ${filePath}`);
          }
        }

        const frame = await extractFrameJpeg(filePath, currentSecond);
        currentSecond += Math.max(1, Math.floor(updateInterval / 1000));
        b64 = frame.toString("base64");
      } else {
        // Live stream (camera, rtsp, http)
        // Use the streamUrl if available, otherwise fallback to filepath (which stores the URL/index)
        const source = video.streamUrl || video.filepath;
        const frameDataUrl = await captureStreamFrame(source);
        // Remove data:image/jpeg;base64, prefix if present
        b64 = frameDataUrl.replace(/^data:image\/[a-z]+;base64,/, "");
      }

      const polygons = zones
        .sort((a, b) => a.queueNumber - b.queueNumber)
        .map((z) => z.polygonPoints as Array<{ x: number; y: number }>);

      const detectionResult = await postToDetector(b64, polygons);
      const counts = detectionResult.counts;
      const totalPeople = counts.reduce((s, c) => s + c, 0);

      // Enhanced recommendation algorithm
      const recommendation = calculateSmartRecommendation(counts, zones);

      const snapshot = await storage.createDetectionSnapshot({
        videoId,
        totalQueues: counts.length,
        queueCounts: counts,
        totalPeople,
        bestQueue: recommendation.bestQueue,
        worstQueue: recommendation.worstQueue,
        recommendation: recommendation.message,
        frameData: detectionResult.annotatedFrame || `data:image/jpeg;base64,${b64}`,
        detections: detectionResult.detections,
      });

      if (onUpdateCallback) {
        onUpdateCallback(snapshot);
      }
    } catch (e: any) {
      // If extraction failed (e.g., sought past duration), rewind and try from zero next tick
      if (typeof e?.message === "string" && e.message.includes("ffmpeg failed")) {
        currentSecond = 0;
      }
      console.error("YOLO detection tick failed:", e);
    }
  }, updateInterval);
}

/**
 * Calculate smart queue recommendation considering multiple factors:
 * 1. Queue length difference
 * 2. Predicted wait time savings (2 min per person)
 * 3. Physical proximity between queues
 */
function calculateSmartRecommendation(
  counts: number[],
  zones: Array<{ queueNumber: number; polygonPoints: any }>
): {
  bestQueue: number;
  worstQueue: number;
  message: string;
} {
  const bestIdx = counts.indexOf(Math.min(...counts));
  const worstIdx = counts.indexOf(Math.max(...counts));
  const bestCount = counts[bestIdx];
  const worstCount = counts[worstIdx];

  // Calculate queue length difference
  const lengthDifference = worstCount - bestCount;

  // Calculate predicted wait time savings (assuming 2 minutes per person)
  const waitTimeSavings = lengthDifference * 2;

  // Calculate proximity (distance between queue centroids)
  const proximity = calculateQueueProximity(
    zones[worstIdx].polygonPoints,
    zones[bestIdx].polygonPoints
  );

  // Determine if recommendation is worthwhile
  // Only recommend if difference is significant enough (at least 2 people or 4+ min savings)
  const isWorthRecommending = lengthDifference >= 2 || waitTimeSavings >= 4;

  let message: string;
  if (isWorthRecommending) {
    const distanceDesc = proximity < 50 ? "nearby" : proximity < 150 ? "close" : "alternative";
    message = `Queue ${bestIdx + 1} is fastest with ${bestCount} ${bestCount === 1 ? 'person' : 'people'}. ` +
      `Moving from Queue ${worstIdx + 1} (${worstCount} ${worstCount === 1 ? 'person' : 'people'}) ` +
      `saves approximately ${waitTimeSavings} minutes. ${distanceDesc.charAt(0).toUpperCase() + distanceDesc.slice(1)} queue available.`;
  } else {
    message = `All queues are balanced. Queue ${bestIdx + 1} is fastest with ${bestCount} ${bestCount === 1 ? 'person' : 'people'} waiting.`;
  }

  return {
    bestQueue: bestIdx + 1,
    worstQueue: worstIdx + 1,
    message,
  };
}

/**
 * Calculate the approximate distance between two queue polygons
 * using their centroids
 */
function calculateQueueProximity(
  polygon1: Array<{ x: number; y: number }>,
  polygon2: Array<{ x: number; y: number }>
): number {
  // Calculate centroid of each polygon
  const centroid1 = calculateCentroid(polygon1);
  const centroid2 = calculateCentroid(polygon2);

  // Calculate Euclidean distance
  const dx = centroid2.x - centroid1.x;
  const dy = centroid2.y - centroid1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate the centroid (center point) of a polygon
 */
function calculateCentroid(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  return {
    x: sum.x / points.length,
    y: sum.y / points.length,
  };
}

export function stopYoloDetection() {
  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null;
    currentVideoId = null;
  }
}