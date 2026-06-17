import "dotenv/config";
import pg from 'pg';
import fs from 'fs';
import path from 'path';

async function runMigration() {
    try {
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) {
            throw new Error("DATABASE_URL not found in .env");
        }

        const client = new pg.Client({ connectionString: dbUrl });
        await client.connect();

        const migrationPath = path.join(process.cwd(), 'migrations', '0000_initial.sql');

        if (!fs.existsSync(migrationPath)) {
            console.log("No migration file found. Use 'npm run db:push' to push schema to database.");
            await client.end();
            return;
        }

        const fileContent = fs.readFileSync(migrationPath, 'utf8');

        // Split by Drizzle's separator
        const statements = fileContent.split('--> statement-breakpoint');

        console.log(`Found ${statements.length} statements to execute.`);

        for (const statement of statements) {
            const sql = statement.trim();
            if (sql) {
                console.log('Executing statement...');
                await client.query(sql);
            }
        }

        console.log('✅ Migration executed successfully!');

        await client.end();
    } catch (error) {
        console.error('❌ Error running migration:', error);
    }
}

runMigration();
