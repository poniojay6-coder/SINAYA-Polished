import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getDatabaseUrl } from "../config/database";
import * as schema from "./schema";

// Lazy initialization keeps unrelated providers independent of database setup.
export function createDatabase() {
  const client = postgres(getDatabaseUrl(), {
    prepare: false,
    max: 5,
    connect_timeout: 10,
    idle_timeout: 20,
    connection: { statement_timeout: 10000 },
  });
  const db = drizzle(client, { schema });
  return { db, close: () => client.end({ timeout: 5 }) };
}
