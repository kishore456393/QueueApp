import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";

// Create PostgreSQL connection only if DATABASE_URL is set
let connection: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle> | null = null;

if (process.env.DATABASE_URL) {
    connection = postgres(process.env.DATABASE_URL);
    db = drizzle(connection, { schema });
}

// Export connection for session store
export { db, connection as pgConnection };
