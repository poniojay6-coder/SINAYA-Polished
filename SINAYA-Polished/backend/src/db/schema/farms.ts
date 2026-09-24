import { sql } from "drizzle-orm";
import { boolean, check, index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { languages } from "./catalogs";
import { farmers } from "./farmers";

// Existing farmers are operator identities; a farm is a separate physical operation.
export const farms = pgTable("farms", {
  id: uuid("id").primaryKey().defaultRandom(),
  operatorId: uuid("operator_id").notNull().references(() => farmers.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  region: text("region").notNull(),
  province: text("province").notNull(),
  municipalityCity: text("municipality_city").notNull(),
  barangay: text("barangay").notNull(),
  latitude: numeric("latitude", { precision: 9, scale: 6 }),
  longitude: numeric("longitude", { precision: 9, scale: 6 }),
  notifyOperator: boolean("notify_operator").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("farms_operator_idx").on(t.operatorId),
  check("farms_name_nonempty", sql`btrim(${t.name}) <> ''`),
  check("farms_location_nonempty", sql`btrim(${t.region}) <> '' AND btrim(${t.province}) <> '' AND btrim(${t.municipalityCity}) <> '' AND btrim(${t.barangay}) <> ''`),
  check("farms_coordinates", sql`(${t.latitude} IS NULL AND ${t.longitude} IS NULL) OR (${t.latitude} IS NOT NULL AND ${t.longitude} IS NOT NULL AND ${t.latitude} BETWEEN -90 AND 90 AND ${t.longitude} BETWEEN -180 AND 180)`),
]).enableRLS();

// Contacts can receive alerts without being the owner or an authenticated app user.
export const farmContacts = pgTable("farm_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  farmId: uuid("farm_id").notNull().references(() => farms.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  mobileNumber: text("mobile_number").notNull(),
  role: text("role").notNull().default("farm_staff"),
  preferredLanguageCode: text("preferred_language_code").notNull().references(() => languages.code, { onDelete: "restrict" }),
  receivesAlerts: boolean("receives_alerts").notNull().default(false),
  smsConsent: boolean("sms_consent").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("farm_contacts_farm_idx").on(t.farmId),
  index("farm_contacts_language_idx").on(t.preferredLanguageCode),
  check("farm_contacts_nonempty", sql`btrim(${t.name}) <> '' AND btrim(${t.mobileNumber}) <> '' AND btrim(${t.role}) <> ''`),
]).enableRLS();
