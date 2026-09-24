import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { species } from "./catalogs";
import { farms } from "./farms";

export const ponds = pgTable("ponds", {
  id: uuid("id").primaryKey().defaultRandom(),
  farmId: uuid("farm_id").notNull().references(() => farms.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  latitude: numeric("latitude", { precision: 9, scale: 6 }),
  longitude: numeric("longitude", { precision: 9, scale: 6 }),
  // Self-reported during registration, never inferred from satellite imagery.
  areaM2: numeric("area_m2", { precision: 14, scale: 2 }).notNull(),
  waterType: text("water_type").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("ponds_farm_idx").on(t.farmId),
  check("ponds_name_nonempty", sql`btrim(${t.name}) <> ''`),
  check("ponds_area_positive", sql`${t.areaM2} > 0 AND ${t.areaM2} <> 'NaN'::numeric`),
  check("ponds_water_type", sql`${t.waterType} IN ('freshwater', 'brackish', 'marine')`),
  check("ponds_coordinates", sql`(${t.latitude} IS NULL AND ${t.longitude} IS NULL) OR (${t.latitude} IS NOT NULL AND ${t.longitude} IS NOT NULL AND ${t.latitude} BETWEEN -90 AND 90 AND ${t.longitude} BETWEEN -180 AND 180)`),
]).enableRLS();

export const stockingCycles = pgTable("stocking_cycles", {
  id: uuid("id").primaryKey().defaultRandom(),
  pondId: uuid("pond_id").notNull().references(() => ponds.id, { onDelete: "restrict" }),
  speciesId: uuid("species_id").notNull().references(() => species.id, { onDelete: "restrict" }),
  quantityStocked: integer("quantity_stocked").notNull(),
  // Snapshot preserves historical density when the pond area changes later.
  stockedAreaM2: numeric("stocked_area_m2", { precision: 14, scale: 2 }).notNull(),
  stockingDensityPerM2: numeric("stocking_density_per_m2", { precision: 20, scale: 6 }).generatedAlwaysAs(sql`quantity_stocked::numeric / NULLIF(stocked_area_m2, 0)`),
  stockingDate: date("stocking_date").notNull(),
  expectedHarvestDate: date("expected_harvest_date"),
  actualHarvestDate: date("actual_harvest_date"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("stocking_cycles_pond_idx").on(t.pondId),
  index("stocking_cycles_species_idx").on(t.speciesId),
  check("stocking_cycles_quantity_positive", sql`${t.quantityStocked} > 0`),
  check("stocking_cycles_area_positive", sql`${t.stockedAreaM2} > 0 AND ${t.stockedAreaM2} <> 'NaN'::numeric`),
  check("stocking_cycles_status", sql`${t.status} IN ('active', 'harvested', 'cancelled')`),
  check("stocking_cycles_expected_date", sql`${t.expectedHarvestDate} IS NULL OR ${t.expectedHarvestDate} >= ${t.stockingDate}`),
  check("stocking_cycles_actual_date", sql`${t.actualHarvestDate} IS NULL OR ${t.actualHarvestDate} >= ${t.stockingDate}`),
  check("stocking_cycles_harvest_status", sql`(${t.status} = 'harvested' AND ${t.actualHarvestDate} IS NOT NULL) OR (${t.status} <> 'harvested' AND ${t.actualHarvestDate} IS NULL)`),
]).enableRLS();
