import {
  users, type User, type InsertUser,
  videos, type Video, type InsertVideo,
  queueZones, type QueueZone, type InsertQueueZone,
  detectionSnapshots, type DetectionSnapshot, type InsertDetectionSnapshot,
  settings, type Settings, type InsertSettings
} from "./sqlite-schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, desc, lt } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { IStorage } from "./storage";
import path from "path";

const MemoryStore = createMemoryStore(session);
const latestFrames = new Map<string, string>();

export class SqliteStorage implements IStorage {
  sessionStore: session.Store;
  private database: ReturnType<typeof drizzle>;

  constructor() {
    // Writable path resolved by Electron in production, falling back to cwd in dev
    const dbPath = process.env.SQLITE_DB_PATH || path.join(process.cwd(), "queue_guidance.db");
    console.log(`[SQLite] Initializing database file at: ${dbPath}`);
    const sqlite = new Database(dbPath);
    
    // Enable WAL mode for performance
    sqlite.pragma("journal_mode = WAL");
    
    this.database = drizzle(sqlite);

    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });

    this.initDatabase(sqlite);
  }

  private initDatabase(sqlite: Database.Database) {
    // Create tables if they do not exist
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        email TEXT UNIQUE,
        role TEXT NOT NULL DEFAULT 'viewer'
      );

      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        source_type TEXT NOT NULL DEFAULT 'file',
        stream_url TEXT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        original_name TEXT,
        uploaded_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS queue_zones (
        id TEXT PRIMARY KEY,
        video_id TEXT NOT NULL REFERENCES videos(id),
        queue_number INTEGER NOT NULL,
        polygon_points TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS detection_snapshots (
        id TEXT PRIMARY KEY,
        video_id TEXT NOT NULL REFERENCES videos(id),
        timestamp INTEGER NOT NULL,
        total_queues INTEGER NOT NULL,
        queue_counts TEXT NOT NULL,
        total_people INTEGER NOT NULL,
        best_queue INTEGER NOT NULL,
        worst_queue INTEGER NOT NULL,
        recommendation TEXT NOT NULL,
        frame_data TEXT,
        detections TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        language TEXT NOT NULL DEFAULT 'en',
        audio_enabled INTEGER NOT NULL DEFAULT 0,
        audio_interval INTEGER NOT NULL DEFAULT 30,
        refresh_interval INTEGER NOT NULL DEFAULT 2,
        updated_at INTEGER NOT NULL
      );
    `);
    console.log("[SQLite] Database schemas checked/initialized");
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await this.database.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.database.select().from(users).where(eq(users.username, username)).limit(1);
    if (result[0]) return result[0];

    // Fallback: Check email column
    const emailResult = await this.database.select().from(users).where(eq(users.email, username)).limit(1);
    return emailResult[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await this.database.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await this.database.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await this.database.insert(users).values({
      ...insertUser,
      firstName: insertUser.firstName ?? null,
      lastName: insertUser.lastName ?? null,
      email: insertUser.email ?? null,
      role: insertUser.role || "viewer"
    }).returning();

    if (!result[0]) {
      throw new Error("Failed to create user in SQLite");
    }
    return result[0];
  }

  async clearUsers(): Promise<void> {
    await this.database.delete(users);
  }

  // Video methods
  async createVideo(userId: number, insertVideo: InsertVideo): Promise<Video> {
    const id = randomUUID();
    const result = await this.database.insert(videos).values({
      id,
      ...insertVideo,
      userId,
      sourceType: insertVideo.sourceType || "file",
      streamUrl: insertVideo.streamUrl || null,
      originalName: insertVideo.originalName || null,
    }).returning();

    if (!result[0]) {
      throw new Error("Failed to store video in SQLite");
    }
    return result[0];
  }

  async getVideo(id: string): Promise<Video | undefined> {
    const result = await this.database.select().from(videos).where(eq(videos.id, id)).limit(1);
    return result[0];
  }

  async getAllVideos(userId: number): Promise<Video[]> {
    return await this.database.select().from(videos)
      .where(eq(videos.userId, userId))
      .orderBy(desc(videos.uploadedAt));
  }

  async getAllSystemVideos(): Promise<Video[]> {
    return await this.database.select().from(videos)
      .orderBy(desc(videos.uploadedAt));
  }

  async deleteVideo(id: string): Promise<boolean> {
    await this.deleteQueueZonesByVideo(id);
    await this.database.delete(detectionSnapshots).where(eq(detectionSnapshots.videoId, id));
    const result = await this.database.delete(videos).where(eq(videos.id, id)).returning();
    return result.length > 0;
  }

  // Queue Zone operations
  async createQueueZone(insertZone: InsertQueueZone): Promise<QueueZone> {
    const id = randomUUID();
    const result = await this.database.insert(queueZones).values({
      id,
      videoId: insertZone.videoId,
      queueNumber: insertZone.queueNumber,
      polygonPoints: insertZone.polygonPoints as Array<{ x: number, y: number }>,
    }).returning();

    if (!result[0]) {
      throw new Error("Failed to save queue zone in SQLite");
    }
    return result[0];
  }

  async getQueueZonesByVideo(videoId: string): Promise<QueueZone[]> {
    return await this.database.select().from(queueZones)
      .where(eq(queueZones.videoId, videoId))
      .orderBy(queueZones.queueNumber);
  }

  async deleteQueueZonesByVideo(videoId: string): Promise<boolean> {
    const result = await this.database.delete(queueZones).where(eq(queueZones.videoId, videoId)).returning();
    return result.length > 0;
  }

  // Detection Snapshot operations
  async createDetectionSnapshot(insertSnapshot: InsertDetectionSnapshot): Promise<DetectionSnapshot> {
    const id = randomUUID();

    if (insertSnapshot.frameData) {
      latestFrames.set(insertSnapshot.videoId, insertSnapshot.frameData);
    }

    const result = await this.database.insert(detectionSnapshots).values({
      id,
      videoId: insertSnapshot.videoId,
      totalQueues: insertSnapshot.totalQueues,
      queueCounts: insertSnapshot.queueCounts as number[],
      totalPeople: insertSnapshot.totalPeople,
      bestQueue: insertSnapshot.bestQueue,
      worstQueue: insertSnapshot.worstQueue,
      recommendation: insertSnapshot.recommendation,
      frameData: null, // Keep db size minimal
      detections: (insertSnapshot.detections as Array<{ x: number, y: number }>) || [],
    }).returning();

    if (!result[0]) {
      throw new Error("Failed to create snapshot in SQLite");
    }

    const snapshot = result[0];
    snapshot.frameData = insertSnapshot.frameData || null;
    return snapshot;
  }

  async getLatestDetectionSnapshot(videoId: string): Promise<DetectionSnapshot | undefined> {
    const result = await this.database.select()
      .from(detectionSnapshots)
      .where(eq(detectionSnapshots.videoId, videoId))
      .orderBy(desc(detectionSnapshots.timestamp))
      .limit(1);

    const snapshot = result[0];
    if (snapshot) {
      snapshot.frameData = latestFrames.get(videoId) || null;
    }
    return snapshot;
  }

  async getDetectionSnapshotsByVideo(videoId: string, limit?: number): Promise<DetectionSnapshot[]> {
    const query = this.database.select()
      .from(detectionSnapshots)
      .where(eq(detectionSnapshots.videoId, videoId))
      .orderBy(desc(detectionSnapshots.timestamp));

    const snapshots = limit ? await query.limit(limit) : await query;

    if (snapshots.length > 0) {
      snapshots[0].frameData = latestFrames.get(videoId) || null;
    }
    return snapshots;
  }

  async getHeatmapData(videoId: string): Promise<Array<{ x: number, y: number, value: number }>> {
    const snapshots = await this.getDetectionSnapshotsByVideo(videoId);
    const heatmapPoints: Map<string, number> = new Map();

    snapshots.forEach(snapshot => {
      if (snapshot.detections) {
        (snapshot.detections as Array<{ x: number, y: number }>).forEach(point => {
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
    const result = await this.database.select().from(settings).limit(1);

    if (!result[0]) {
      const defaultSettings: InsertSettings = {
        language: 'en',
        audioEnabled: false,
        audioInterval: 30,
        refreshInterval: 2,
      };
      return await this.createOrUpdateSettings(defaultSettings);
    }
    return result[0];
  }

  async createOrUpdateSettings(insertSettings: InsertSettings): Promise<Settings> {
    const existing = await this.database.select().from(settings).limit(1);

    if (existing[0]) {
      const result = await this.database.update(settings)
        .set({
          language: insertSettings.language ?? 'en',
          audioEnabled: insertSettings.audioEnabled ?? false,
          audioInterval: insertSettings.audioInterval ?? 30,
          refreshInterval: insertSettings.refreshInterval ?? 2,
          updatedAt: new Date(),
        })
        .where(eq(settings.id, existing[0].id))
        .returning();

      return result[0];
    } else {
      const id = randomUUID();
      const result = await this.database.insert(settings).values({
        id,
        language: insertSettings.language ?? 'en',
        audioEnabled: insertSettings.audioEnabled ?? false,
        audioInterval: insertSettings.audioInterval ?? 30,
        refreshInterval: insertSettings.refreshInterval ?? 2,
      }).returning();

      return result[0];
    }
  }

  async cleanupOldSnapshots(ageInSeconds: number): Promise<number> {
    const cutoff = new Date(Date.now() - ageInSeconds * 1000);
    const result = await this.database.delete(detectionSnapshots).where(lt(detectionSnapshots.timestamp, cutoff)).returning();
    return result.length;
  }
}
