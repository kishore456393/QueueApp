import {
    users, type User, type InsertUser,
    videos, type Video, type InsertVideo,
    queueZones, type QueueZone, type InsertQueueZone,
    detectionSnapshots, type DetectionSnapshot, type InsertDetectionSnapshot,
    settings, type Settings, type InsertSettings
} from "@shared/schema";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { db } from "./db";
import { eq, desc, lt } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { IStorage } from "./storage";
import pg from "pg";

const PgStore = connectPgSimple(session);

// Memory cache for the latest frame of each video to keep database size minimal
const latestFrames = new Map<string, string>();

export class PostgresStorage implements IStorage {
    sessionStore: session.Store;
    private database: NonNullable<typeof db>;

    constructor() {
        if (!db) {
            throw new Error("Database connection not initialized. Please check DATABASE_URL.");
        }
        this.database = db;

        // Create a pg Pool for the session store (connect-pg-simple requires pg.Pool)
        const pgPool = new pg.Pool({
            connectionString: process.env.DATABASE_URL,
        });

        this.sessionStore = new PgStore({
            pool: pgPool,
            tableName: 'sessions',
            createTableIfMissing: true,
        });
    }

    // User methods
    async getUser(id: number): Promise<User | undefined> {
        const result = await this.database.select().from(users).where(eq(users.id, id)).limit(1);
        return result[0];
    }

    async getUserByUsername(username: string): Promise<User | undefined> {
        const result = await this.database.select().from(users).where(eq(users.username, username)).limit(1);
        if (result[0]) return result[0];

        // Also check by email
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
            throw new Error("Failed to create user");
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
        }).returning();

        if (!result[0]) {
            throw new Error("Failed to create video");
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
        // Delete related queue zones and detection snapshots first
        await this.deleteQueueZonesByVideo(id);
        await this.database.delete(detectionSnapshots).where(eq(detectionSnapshots.videoId, id));

        const result = await this.database.delete(videos).where(eq(videos.id, id)).returning();
        return result.length > 0;
    }

    // Queue Zone methods
    async createQueueZone(insertZone: InsertQueueZone): Promise<QueueZone> {
        const id = randomUUID();
        const result = await this.database.insert(queueZones).values({
            id,
            videoId: insertZone.videoId,
            queueNumber: insertZone.queueNumber,
            polygonPoints: insertZone.polygonPoints as Array<{ x: number, y: number }>,
        }).returning();

        if (!result[0]) {
            throw new Error("Failed to create queue zone");
        }
        return result[0];
    }

    async getQueueZonesByVideo(videoId: string): Promise<QueueZone[]> {
        return await this.database.select().from(queueZones).where(eq(queueZones.videoId, videoId));
    }

    async deleteQueueZonesByVideo(videoId: string): Promise<boolean> {
        const result = await this.database.delete(queueZones).where(eq(queueZones.videoId, videoId)).returning();
        return result.length > 0;
    }

    // Detection Snapshot methods
    async createDetectionSnapshot(insertSnapshot: InsertDetectionSnapshot): Promise<DetectionSnapshot> {
        const id = randomUUID();
        
        // Cache the latest frame in memory
        if (insertSnapshot.frameData) {
            latestFrames.set(insertSnapshot.videoId, insertSnapshot.frameData);
        }

        // Save to database with frameData set to null to prevent table bloat
        const result = await this.database.insert(detectionSnapshots).values({
            id,
            videoId: insertSnapshot.videoId,
            totalQueues: insertSnapshot.totalQueues,
            queueCounts: insertSnapshot.queueCounts as number[],
            totalPeople: insertSnapshot.totalPeople,
            bestQueue: insertSnapshot.bestQueue,
            worstQueue: insertSnapshot.worstQueue,
            recommendation: insertSnapshot.recommendation,
            frameData: null,
            detections: (insertSnapshot.detections as Array<{ x: number, y: number }>) || [],
        }).returning();

        console.log(`[Privacy] Snapshot created - aggregate stats only, auto-expires in 1 hour`);

        if (!result[0]) {
            throw new Error("Failed to create detection snapshot");
        }

        // Inject cached frame data back into the returned snapshot for real-time WebSocket broadcast
        const snapshot = result[0];
        if (snapshot) {
            snapshot.frameData = insertSnapshot.frameData || null;
        }
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
        
        // Inject the latest frame into the most recent snapshot in the returned history list
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

    // Settings methods
    async getSettings(): Promise<Settings> {
        const result = await this.database.select().from(settings).limit(1);

        if (!result[0]) {
            // Create default settings if none exist
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
            // Update existing settings
            const result = await this.database.update(settings)
                .set({
                    language: insertSettings.language ?? 'en',
                    audioEnabled: insertSettings.audioEnabled ?? false,
                    audioInterval: insertSettings.audioInterval ?? 30,
                    refreshInterval: insertSettings.refreshInterval ?? 2,
                })
                .where(eq(settings.id, existing[0].id))
                .returning();

            return result[0];
        } else {
            // Create new settings
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