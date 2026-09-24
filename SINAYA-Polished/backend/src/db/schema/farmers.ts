import { sql } from "drizzle-orm";
import { boolean, check, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { equipmentCatalog, languages } from "./catalogs";

export const farmers = pgTable("farmers", {
  id: uuid("id").primaryKey().defaultRandom(),
  authUserId: uuid("auth_user_id").unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  mobileNumber: text("mobile_number").notNull(),
  region: text("region").notNull(),
  province: text("province").notNull(),
  municipalityCity: text("municipality_city").notNull(),
  barangay: text("barangay").notNull(),
  latitude: numeric("latitude", { precision: 9, scale: 6 }),
  longitude: numeric("longitude", { precision: 9, scale: 6 }),
  preferredLanguageCode: text("preferred_language_code").notNull().references(() => languages.code, { onDelete: "restrict" }),
  smsConsent: boolean("sms_consent").notNull().default(false),
  accountStatus: text("account_status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("farmers_language_idx").on(t.preferredLanguageCode),
  check("farmers_names_nonempty", sql`btrim(${t.firstName}) <> '' AND btrim(${t.lastName}) <> ''`),
  check("farmers_mobile_nonempty", sql`btrim(${t.mobileNumber}) <> ''`),
  check("farmers_location_nonempty", sql`btrim(${t.region}) <> '' AND btrim(${t.province}) <> '' AND btrim(${t.municipalityCity}) <> '' AND btrim(${t.barangay}) <> ''`),
  check("farmers_coordinates", sql`(${t.latitude} IS NULL AND ${t.longitude} IS NULL) OR (${t.latitude} IS NOT NULL AND ${t.longitude} IS NOT NULL AND ${t.latitude} BETWEEN -90 AND 90 AND ${t.longitude} BETWEEN -180 AND 180)`),
  check("farmers_status", sql`${t.accountStatus} IN ('active', 'inactive', 'suspended')`),
]).enableRLS();

export const farmerEquipment = pgTable("farmer_equipment", {
  id: uuid("id").primaryKey().defaultRandom(),
  farmerId: uuid("farmer_id").notNull().references(() => farmers.id, { onDelete: "restrict" }),
  equipmentId: uuid("equipment_id").references(() => equipmentCatalog.id, { onDelete: "restrict" }),
  customName: text("custom_name"),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("farmer_equipment_farmer_idx").on(t.farmerId),
  index("farmer_equipment_equipment_idx").on(t.equipmentId),
  uniqueIndex("farmer_equipment_catalog_unique").on(t.farmerId, t.equipmentId).where(sql`${t.equipmentId} IS NOT NULL`),
  uniqueIndex("farmer_equipment_custom_unique").on(t.farmerId, sql`lower(btrim(${t.customName}))`).where(sql`${t.customName} IS NOT NULL`),
  check("farmer_equipment_quantity_positive", sql`${t.quantity} > 0`),
  // Other creates a custom entry, never an automatic catalogue addition.
  check("farmer_equipment_source", sql`(${t.equipmentId} IS NOT NULL AND ${t.customName} IS NULL) OR (${t.equipmentId} IS NULL AND ${t.customName} IS NOT NULL AND btrim(${t.customName}) <> '')`),
]).enableRLS();
