import "dotenv/config";
import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';

async function clearData() {
    try {
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) {
            throw new Error("DATABASE_URL not found in .env");
        }

        const client = new pg.Client({ connectionString: dbUrl });
        await client.connect();

        console.log("Connected to database. Clearing data...");

        const tables = [
            'detection_snapshots',
            'queue_zones',
            'videos',
            'users',
            'settings',
            'sessions'
        ];

        for (const table of tables) {
            try {
                await client.query(`TRUNCATE TABLE "${table}" CASCADE`);
                console.log(`Cleared table: ${table}`);
            } catch (e: any) {
                // If table doesn't exist, ignore
                if (e.code !== '42P01') { // PostgreSQL error code for undefined_table
                    console.error(`Error clearing ${table}:`, e.message);
                }
            }
        }

        await client.end();

        // Clear uploads folder
        const uploadsDir = path.join(process.cwd(), 'uploads');
        try {
            const files = await fs.readdir(uploadsDir);
            for (const file of files) {
                if (file === '.gitkeep') continue;
                await fs.unlink(path.join(uploadsDir, file));
            }
            console.log(`Cleared ${files.length} files from uploads directory.`);
        } catch (e: any) {
            if (e.code !== 'ENOENT') {
                console.error("Error clearing uploads:", e.message);
            }
        }

        console.log("✅ All data cleared successfully.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
}

clearData();
