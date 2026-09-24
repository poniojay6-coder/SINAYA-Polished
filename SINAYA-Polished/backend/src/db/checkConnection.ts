import { sql } from "drizzle-orm";
import { createDatabase } from "./index";

async function main() {
  const connection = createDatabase();
  try {
    const rows = await connection.db.execute(sql`select 1 as connected`);
    if (rows[0]?.connected !== 1) {
      throw new Error("Unexpected database response.");
    }
    console.log("PostgreSQL connection verified through Drizzle. No tables were changed.");
  } finally {
    await connection.close();
  }
}

main().catch(() => {
  // Driver errors can contain credentials or connection details; do not print them.
  console.error("Database check failed. Check DATABASE_URL in backend/.env, database availability, SSL settings, and network access.");
  process.exitCode = 1;
});
