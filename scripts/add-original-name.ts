import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

async function main() {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL not found in .env");
    }

    const connection = postgres(process.env.DATABASE_URL);
    const db = drizzle(connection);

    console.log("Adding original_name column to videos table...");
    try {
        await db.execute(sql`ALTER TABLE videos ADD COLUMN IF NOT EXISTS original_name TEXT`);
        console.log("Migration successful");
    } catch (error) {
        console.error("Migration failed:", error);
    }

    await connection.end();
    process.exit(0);
}

main();
