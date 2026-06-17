import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email").unique(),
  role: text("role").notNull().default("viewer"), // 'admin' or 'viewer'
});

export const videos = sqliteTable("videos", {
  id: text("id").primaryKey(),
  filename: text("filename").notNull(),
  filepath: text("filepath").notNull(),
  sourceType: text("source_type").notNull().default("file"), // "file", "rtsp", "http", or "webcam"
  streamUrl: text("stream_url"), // URL for live streams
  userId: integer("user_id").notNull().references(() => users.id),
  originalName: text("original_name"),
  uploadedAt: integer("uploaded_at", { mode: "timestamp" }).notNull().defaultNow(),
});

export const queueZones = sqliteTable("queue_zones", {
  id: text("id").primaryKey(),
  videoId: text("video_id").notNull().references(() => videos.id),
  queueNumber: integer("queue_number").notNull(),
  polygonPoints: text("polygon_points", { mode: "json" }).$type<Array<{ x: number, y: number }>>().notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().defaultNow(),
});

export const detectionSnapshots = sqliteTable("detection_snapshots", {
  id: text("id").primaryKey(),
  videoId: text("video_id").notNull().references(() => videos.id),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull().defaultNow(),
  totalQueues: integer("total_queues").notNull(),
  queueCounts: text("queue_counts", { mode: "json" }).$type<number[]>().notNull(),
  totalPeople: integer("total_people").notNull(),
  bestQueue: integer("best_queue").notNull(),
  worstQueue: integer("worst_queue").notNull(),
  recommendation: text("recommendation").notNull(),
  frameData: text("frame_data"), // Base64 encoded frame image (usually null for database, cached in memory)
  detections: text("detections", { mode: "json" }).$type<Array<{ x: number, y: number }>>(), // Center points of detected people
});

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey(),
  language: text("language").notNull().default("en"),
  audioEnabled: integer("audio_enabled", { mode: "boolean" }).notNull().default(false),
  audioInterval: integer("audio_interval").notNull().default(30), // seconds
  refreshInterval: integer("refresh_interval").notNull().default(2), // seconds
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().defaultNow(),
});
