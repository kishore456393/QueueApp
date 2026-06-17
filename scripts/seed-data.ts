import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { videos, queueZones, detectionSnapshots, users } from "@shared/schema";
import { randomUUID } from "crypto";

async function seedData() {
    try {
        if (!process.env.DATABASE_URL) {
            throw new Error("DATABASE_URL not found in .env");
        }

        const connection = postgres(process.env.DATABASE_URL);
        const db = drizzle(connection);

        console.log("🌱 Seeding dummy data...");

        // Create a dummy user
        const userResult = await db.insert(users).values({
            username: "admin",
            password: "password", // Dummy password
            role: "admin",
            firstName: "Admin",
            lastName: "User",
        }).returning();
        const userId = userResult[0].id;
        console.log("Created user:", userId);

        // Create a dummy video
        const videoId = randomUUID();
        await db.insert(videos).values({
            id: videoId,
            filename: "Demo Camera 1",
            filepath: "demo_stream_url",
            sourceType: "camera",
            streamUrl: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
            userId: userId,
        });
        console.log("Created video:", videoId);

        // Create queue zones
        await db.insert(queueZones).values([
            {
                id: randomUUID(),
                videoId: videoId,
                queueNumber: 1,
                polygonPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
            },
            {
                id: randomUUID(),
                videoId: videoId,
                queueNumber: 2,
                polygonPoints: [{ x: 200, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 100 }, { x: 200, y: 100 }],
            }
        ]);
        console.log("Created queue zones");

        // Create a detection snapshot
        await db.insert(detectionSnapshots).values({
            id: randomUUID(),
            videoId: videoId,
            totalQueues: 2,
            queueCounts: [5, 2],
            totalPeople: 7,
            bestQueue: 2,
            worstQueue: 1,
            recommendation: "Queue 2 is faster",
            detections: [{ x: 50, y: 50 }, { x: 250, y: 50 }],
        });
        console.log("Created detection snapshot");

        // Close connection
        await connection.end();

        console.log("✅ Seeding complete!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error seeding data:", error);
        process.exit(1);
    }
}

seedData();
