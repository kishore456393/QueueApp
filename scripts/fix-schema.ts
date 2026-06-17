import "dotenv/config";
import pg from "pg";

async function fixSchema() {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not set");
    }

    console.log("🔧 Connecting to database...");
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    try {
        console.log("🔍 Checking 'videos' table schema...");

        // Check if column exists
        const result = await client.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'videos' AND column_name = 'user_id'
        `);

        if (result.rows.length > 0) {
            console.log("✅ 'user_id' column already exists.");
        } else {
            console.log("⚠️ 'user_id' column missing. Adding it...");

            // We truncate first to avoid issues with NOT NULL constraint on existing rows
            await client.query("TRUNCATE TABLE videos CASCADE");
            console.log("🗑️ Truncated 'videos' table to ensure clean state.");

            // Add column
            await client.query(
                "ALTER TABLE videos ADD COLUMN user_id INTEGER NOT NULL"
            );
            console.log("✅ Added 'user_id' column.");

            // Add Foreign Key
            await client.query(
                "ALTER TABLE videos ADD CONSTRAINT fk_videos_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"
            );
            console.log("✅ Added Foreign Key constraint.");
        }

        console.log("🎉 Schema fix complete!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error fixing schema:", error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

fixSchema();
