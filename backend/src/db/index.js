import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set before starting the API");
}

// Supabase's session pooler is recommended for persistent IPv4 backends.
export const client = postgres(connectionString, { max: 10, ssl: "require" });
export const db = drizzle(client, { schema });
