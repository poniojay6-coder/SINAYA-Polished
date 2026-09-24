import { sql } from "drizzle-orm";
import { boolean, check, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";

export const languages = pgTable("languages", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  nativeName: text("native_name").notNull(),
  // Policy metadata, not approval of individual translated advisory content.
  requiresNativeReview: boolean("requires_native_review").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
}, (t) => [
  check("languages_nonempty", sql`btrim(${t.code}) <> '' AND btrim(${t.name}) <> '' AND btrim(${t.nativeName}) <> ''`),
  check("languages_cebuano_review_required", sql`split_part(lower(${t.code}), '-', 1) <> 'ceb' OR ${t.requiresNativeReview}`),
]).enableRLS();

// Suggestions only; the farmer chooses their actual preferred language.
export const regionLanguages = pgTable("region_languages", {
  regionCode: text("region_code").notNull(),
  languageCode: text("language_code").notNull().references(() => languages.code, { onDelete: "restrict" }),
}, (t) => [
  primaryKey({ columns: [t.regionCode, t.languageCode] }),
  check("region_languages_region_nonempty", sql`btrim(${t.regionCode}) <> ''`),
]).enableRLS();

export const species = pgTable("species", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  scientificName: text("scientific_name"),
  isActive: boolean("is_active").notNull().default(true),
}, (t) => [check("species_name_nonempty", sql`btrim(${t.name}) <> ''`)]).enableRLS();

export const equipmentCatalog = pgTable("equipment_catalog", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
}, (t) => [check("equipment_catalog_name_nonempty", sql`btrim(${t.name}) <> ''`)]).enableRLS();
