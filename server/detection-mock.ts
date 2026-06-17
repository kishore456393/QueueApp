/**
 * Mock Detection Generator
 * Simulates YOLO-based person detection for queue management
 */

import { storage } from "./storage";
import type { DetectionSnapshot } from "@shared/schema";

interface MockDetectionConfig {
  videoId: string;
  queueCount: number;
  updateInterval: number; // ms
}

let detectionInterval: NodeJS.Timeout | null = null;
let currentCounts: number[] = [];
let currentVideoId: string | null = null;
let onUpdateCallback: ((snapshot: DetectionSnapshot) => void) | null = null;

// Simulate realistic queue fluctuations
function generateQueueCounts(queueCount: number, previous?: number[]): number[] {
  if (!previous) {
    // Initial random counts (0-15 people per queue)
    return Array.from({ length: queueCount }, () => Math.floor(Math.random() * 16));
  }

  // Gradually change counts (more realistic movement)
  return previous.map((count) => {
    const change = Math.floor(Math.random() * 5) - 2; // -2 to +2 people
    const newCount = Math.max(0, Math.min(20, count + change));
    return newCount;
  });
}

function calculateRecommendation(counts: number[]): {
  bestQueue: number;
  worstQueue: number;
  recommendation: string;
} {
  const bestQueue = counts.indexOf(Math.min(...counts)) + 1;
  const worstQueue = counts.indexOf(Math.max(...counts)) + 1;
  const bestCount = counts[bestQueue - 1];

  const recommendation = `Queue ${bestQueue} is fastest with ${bestCount} ${bestCount === 1 ? 'person' : 'people'} waiting`;

  return { bestQueue, worstQueue, recommendation };
}

export function setUpdateCallback(callback: (snapshot: DetectionSnapshot) => void): void {
  onUpdateCallback = callback;
}

export function startMockDetection(config: MockDetectionConfig): void {
  // Stop existing detection if running
  if (detectionInterval) {
    console.log('Stopping previous detection');
    stopMockDetection();
  }

  console.log(`Starting mock detection for ${config.queueCount} queues on video ${config.videoId}`);
  currentVideoId = config.videoId;
  currentCounts = generateQueueCounts(config.queueCount);

  // Generate and save detection data at regular intervals
  detectionInterval = setInterval(async () => {
    try {
      currentCounts = generateQueueCounts(config.queueCount, currentCounts);
      const totalPeople = currentCounts.reduce((sum, count) => sum + count, 0);
      const { bestQueue, worstQueue, recommendation } = calculateRecommendation(currentCounts);

      const snapshot = await storage.createDetectionSnapshot({
        videoId: config.videoId,
        totalQueues: config.queueCount,
        queueCounts: currentCounts,
        totalPeople,
        bestQueue,
        worstQueue,
        recommendation,
        frameData: null,
      });

      // Notify WebSocket clients
      if (onUpdateCallback) {
        onUpdateCallback(snapshot);
      }

      console.log(`Detection update: ${totalPeople} people across ${config.queueCount} queues`);
    } catch (error) {
      console.error('Error generating mock detection:', error);
    }
  }, config.updateInterval);
}

export function stopMockDetection(): void {
  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null;
    currentVideoId = null;
    console.log('Mock detection stopped');
  }
}

export function isDetectionRunning(): boolean {
  return detectionInterval !== null;
}

export function getCurrentVideoId(): string | null {
  return currentVideoId;
}

// Auto-start demo detection (opt-in via env var DEMO_DETECTION=true)
export async function initializeDemoDetection() {
  const videos = await storage.getAllSystemVideos();
  if (videos.length > 0) {
    const video = videos[0];
    const zones = await storage.getQueueZonesByVideo(video.id);
    if (zones.length > 0) {
      startMockDetection({
        videoId: video.id,
        queueCount: zones.length,
        updateInterval: 3000,
      });
      return;
    }
  }

  const owner =
    (await storage.getUserByUsername("admin")) ??
    (await storage.getAllUsers())[0];
  if (!owner) {
    console.warn("initializeDemoDetection: no user found; cannot create demo video");
    return;
  }

  const demoVideo = await storage.createVideo(owner.id, {
    filename: "demo-video.mp4",
    filepath: "/demo/demo-video.mp4",
    sourceType: "file",
  });

  for (let i = 0; i < 5; i++) {
    await storage.createQueueZone({
      videoId: demoVideo.id,
      queueNumber: i + 1,
      polygonPoints: [
        { x: 100 + i * 200, y: 100 },
        { x: 250 + i * 200, y: 100 },
        { x: 250 + i * 200, y: 400 },
        { x: 100 + i * 200, y: 400 },
      ],
    });
  }

  startMockDetection({
    videoId: demoVideo.id,
    queueCount: 5,
    updateInterval: 3000,
  });

  console.log('Started demo detection with 5 queues');
}

// Initialize demo only if explicitly enabled
if (process.env.DEMO_DETECTION === 'true') {
  setTimeout(initializeDemoDetection, 2000);
}
