import {
  users, type User, type InsertUser,
  videos, type Video, type InsertVideo,
  queueZones, type QueueZone, type InsertQueueZone,
  detectionSnapshots, type DetectionSnapshot, type InsertDetectionSnapshot,
  settings, type Settings, type InsertSettings
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { randomUUID } from "crypto";
import { PostgresStorage } from "./postgres-storage";
import { SqliteStorage } from "./sqlite-storage";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  sessionStore: session.Store;

  // Video methods
  createVideo(userId: number, video: InsertVideo): Promise<Video>;
  getVideo(id: string): Promise<Video | undefined>;
  getAllVideos(userId: number): Promise<Video[]>;
  getAllSystemVideos(): Promise<Video[]>;
  deleteVideo(id: string): Promise<boolean>;

  // Queue Zone operations
  createQueueZone(zone: InsertQueueZone): Promise<QueueZone>;
  getQueueZonesByVideo(videoId: string): Promise<QueueZone[]>;
  deleteQueueZonesByVideo(videoId: string): Promise<boolean>;

  // Detection Snapshot operations
  createDetectionSnapshot(snapshot: InsertDetectionSnapshot): Promise<DetectionSnapshot>;
  getLatestDetectionSnapshot(videoId: string): Promise<DetectionSnapshot | undefined>;
  getDetectionSnapshotsByVideo(videoId: string, limit?: number): Promise<DetectionSnapshot[]>;
  getHeatmapData(videoId: string): Promise<Array<{ x: number, y: number, value: number }>>;

  // Settings operations
  getSettings(): Promise<Settings>;
  createOrUpdateSettings(settings: InsertSettings): Promise<Settings>;
  clearUsers(): Promise<void>;
  cleanupOldSnapshots(ageInSeconds: number): Promise<number>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private videos: Map<string, Video>;
  private queueZones: Map<string, QueueZone>;
  private detectionSnapshots: Map<string, DetectionSnapshot>;
  private latestFrames: Map<string, string>;
  private settings: Settings | undefined;
  private currentId: number;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.videos = new Map();
    this.queueZones = new Map();
    this.detectionSnapshots = new Map();
    this.latestFrames = new Map();
    this.currentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username || user.email === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = {
      ...insertUser,
      id,
      firstName: insertUser.firstName ?? null,
      lastName: insertUser.lastName ?? null,
      email: insertUser.email ?? null,
      role: insertUser.role || "viewer"
    };
    this.users.set(id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  // Video operations
  async createVideo(userId: number, insertVideo: InsertVideo): Promise<Video> {
    const id = randomUUID();
    const video: Video = {
      ...insertVideo,
      id,
      userId,
      uploadedAt: new Date(),
      sourceType: insertVideo.sourceType || "file",
      streamUrl: insertVideo.streamUrl || null,
      originalName: insertVideo.originalName || null,
    };
    this.videos.set(id, video);
    return video;
  }

  async getVideo(id: string): Promise<Video | undefined> {
    return this.videos.get(id);
  }

  async getAllVideos(userId: number): Promise<Video[]> {
    return Array.from(this.videos.values())
      .filter(video => video.userId === userId)
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }

  async getAllSystemVideos(): Promise<Video[]> {
    return Array.from(this.videos.values())
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }

  async deleteVideo(id: string): Promise<boolean> {
    const deleted = this.videos.delete(id);
    if (deleted) {
      await this.deleteQueueZonesByVideo(id);
      Array.from(this.detectionSnapshots.entries())
        .filter(([_, snapshot]) => snapshot.videoId === id)
        .forEach(([snapshotId]) => this.detectionSnapshots.delete(snapshotId));
    }
    return deleted;
  }

  // Queue Zone operations
  async createQueueZone(insertZone: InsertQueueZone): Promise<QueueZone> {
    const id = randomUUID();
    const zone: QueueZone = {
      id,
      videoId: insertZone.videoId,
      queueNumber: insertZone.queueNumber,
      polygonPoints: insertZone.polygonPoints as Array<{ x: number, y: number }>,
      createdAt: new Date(),
    };
    this.queueZones.set(id, zone);
    return zone;
  }

  async getQueueZonesByVideo(videoId: string): Promise<QueueZone[]> {
    return Array.from(this.queueZones.values())
      .filter((zone) => zone.videoId === videoId)
      .sort((a, b) => a.queueNumber - b.queueNumber);
  }

  async deleteQueueZonesByVideo(videoId: string): Promise<boolean> {
    const zones = await this.getQueueZonesByVideo(videoId);
    zones.forEach((zone) => this.queueZones.delete(zone.id));
    return zones.length > 0;
  }

  // Detection Snapshot operations
  async createDetectionSnapshot(insertSnapshot: InsertDetectionSnapshot): Promise<DetectionSnapshot> {
    const id = randomUUID();

    // Cache the latest frame in memory
    if (insertSnapshot.frameData) {
      this.latestFrames.set(insertSnapshot.videoId, insertSnapshot.frameData);
    }

    // Edge computing privacy: Store only aggregate statistics, not full frame data
    const snapshot: DetectionSnapshot = {
      id,
      videoId: insertSnapshot.videoId,
      timestamp: new Date(),
      totalQueues: insertSnapshot.totalQueues,
      queueCounts: insertSnapshot.queueCounts as number[],
      totalPeople: insertSnapshot.totalPeople,
      bestQueue: insertSnapshot.bestQueue,
      worstQueue: insertSnapshot.worstQueue,
      recommendation: insertSnapshot.recommendation,
      // Privacy: Only store frame data temporarily in memory cache
      frameData: null,
      detections: (insertSnapshot.detections as Array<{ x: number, y: number }>) || [],
    };

    this.detectionSnapshots.set(id, snapshot);
    console.log(`[Privacy] Snapshot created - aggregate stats only, auto - expires in 1 hour`);
    
    // Inject cached frame data back into the returned snapshot for real-time WebSocket broadcast
    const returnedSnapshot = { ...snapshot };
    returnedSnapshot.frameData = insertSnapshot.frameData || null;
    return returnedSnapshot;
  }

  async getLatestDetectionSnapshot(videoId: string): Promise<DetectionSnapshot | undefined> {
    const snapshots = await this.getDetectionSnapshotsByVideo(videoId, 1);
    return snapshots[0];
  }

  async getDetectionSnapshotsByVideo(videoId: string, limit?: number): Promise<DetectionSnapshot[]> {
    const snapshots = Array.from(this.detectionSnapshots.values())
      .filter((snapshot) => snapshot.videoId === videoId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const result = limit ? snapshots.slice(0, limit) : snapshots;
    
    // Inject the latest frame into the most recent snapshot in the returned history list
    if (result.length > 0) {
      result[0].frameData = this.latestFrames.get(videoId) || null;
    }
    return result;
  }

  async getHeatmapData(videoId: string): Promise<Array<{ x: number, y: number, value: number }>> {
    const snapshots = await this.getDetectionSnapshotsByVideo(videoId);
    const heatmapPoints: Map<string, number> = new Map();

    snapshots.forEach(snapshot => {
      if (snapshot.detections) {
        snapshot.detections.forEach(point => {
          // Round coordinates to group nearby points (grid size 20x20)
          const x = Math.round(point.x / 20) * 20;
          const y = Math.round(point.y / 20) * 20;
          const key = `${x},${y}`;
          heatmapPoints.set(key, (heatmapPoints.get(key) || 0) + 1);
        });
      }
    });

    return Array.from(heatmapPoints.entries()).map(([key, value]) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y, value };
    });
  }

  // Settings operations
  async getSettings(): Promise<Settings> {
    if (!this.settings) {
      this.settings = {
        id: randomUUID(),
        language: 'en',
        audioEnabled: false,
        audioInterval: 30,
        refreshInterval: 2,
        updatedAt: new Date(),
      };
    }
    return this.settings;
  }

  async createOrUpdateSettings(insertSettings: InsertSettings): Promise<Settings> {
    const id = this.settings?.id || randomUUID();
    this.settings = {
      id,
      language: insertSettings.language ?? 'en',
      audioEnabled: insertSettings.audioEnabled ?? false,
      audioInterval: insertSettings.audioInterval ?? 30,
      refreshInterval: insertSettings.refreshInterval ?? 2,
      updatedAt: new Date(),
    };
    return this.settings;
  }

  async clearUsers(): Promise<void> {
    this.users.clear();
  }

  async cleanupOldSnapshots(ageInSeconds: number): Promise<number> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - ageInSeconds * 1000);
    let count = 0;

    this.detectionSnapshots.forEach((snapshot, id) => {
      if (snapshot.timestamp < cutoff) {
        this.detectionSnapshots.delete(id);
        count++;
      }
    });
    return count;
  }
}

// Use PostgreSQL storage if DATABASE_URL is configured, otherwise SQLite for local persistence
let storage: IStorage;

if (process.env.DATABASE_URL) {
  console.log("✅ Using PostgreSQL database storage (Supabase)");
  storage = new PostgresStorage();
} else if (process.env.USE_MEM_STORAGE === "true") {
  console.warn("⚠️  Using in-memory storage (data will be lost on restart)");
  storage = new MemStorage();
} else {
  console.log("✅ Using local SQLite database storage");
  storage = new SqliteStorage();
}

export { storage };
