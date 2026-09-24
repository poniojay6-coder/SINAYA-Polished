import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "../db/schema";

// Common PostgreSQL API, injectable for isolated integration tests.
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
