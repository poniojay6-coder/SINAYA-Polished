import { sql } from "drizzle-orm";
import { boolean, check, index, doublePrecision, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { ponds } from "./ponds";

// A unit stays assigned to its original pond, including after retirement.
export const sensorUnits = pgTable("sensor_units", {
  id: uuid("id").primaryKey().defaultRandom(),
  pondId: uuid("pond_id").notNull().references(() => ponds.id, { onDelete: "restrict" }),
  serialNumber: text("serial_number").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("sensor_serial_nonempty", sql`btrim(${t.serialNumber}) <> ''`),
  uniqueIndex("sensor_units_active_pond").on(t.pondId).where(sql`${t.isActive} = true`),
  index("sensor_units_pond_idx").on(t.pondId),
]).enableRLS();

export const sensorReadings = pgTable("sensor_readings", {
  id: uuid("id").primaryKey().defaultRandom(),
  sensorId: uuid("sensor_id").notNull().references(() => sensorUnits.id, { onDelete: "restrict" }),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  source: text("source").notNull(),
  dissolvedOxygenMgL: doublePrecision("dissolved_oxygen_mg_l").notNull(),
  ph: doublePrecision("ph").notNull(),
  waterTemperatureC: doublePrecision("water_temperature_c").notNull(),
}, (t) => [
  check("sensor_readings_source", sql`${t.source} IN ('device', 'simulated')`),
  // Broad ingestion bounds, NOT species safety thresholds.
  check("sensor_readings_bounds", sql`${t.dissolvedOxygenMgL} BETWEEN 0 AND 100 AND ${t.ph} BETWEEN 0 AND 14 AND ${t.waterTemperatureC} BETWEEN -5 AND 60`),
  uniqueIndex("sensor_readings_sample_unique").on(t.sensorId, t.observedAt, t.source),
  index("sensor_readings_latest_idx").on(t.sensorId, t.source, t.observedAt),
]).enableRLS();
