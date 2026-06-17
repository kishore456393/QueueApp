import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";

function getDetectorBaseUrl(): string {
  return (process.env.DETECTOR_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
}

/**
 * Capture a single frame from a live video stream (RTSP, HTTP, Webcam)
 * Returns the frame as a base64-encoded JPEG
 */
export async function captureStreamFrame(streamUrl: string): Promise<string> {
  console.log(`[StreamCapture] Requesting frame for source: ${streamUrl}`);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    const detectorBaseUrl = getDetectorBaseUrl();

    const response = await fetch(`${detectorBaseUrl}/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: streamUrl }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Detector service error: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }

    console.log(`[StreamCapture] Frame received successfully`);
    return data.frame_b64;
  } catch (error: any) {
    console.error("[StreamCapture] Capture failed:", error.message);
    throw error;
  }
}

/**
 * Validate that a stream URL is accessible
 */
export async function validateStreamUrl(streamUrl: string): Promise<boolean> {
  try {
    await captureStreamFrame(streamUrl);
    return true;
  } catch (error) {
    console.error("Stream validation failed:", error);
    return false;
  }
}
