import { sql } from 'drizzle-orm';
import { boolean, check, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { equipmentCatalog, languages, species } from './catalogs';
import { ponds, stockingCycles } from './ponds';

export const thresholdRules = pgTable('threshold_rules', {
  id: uuid('id').primaryKey().defaultRandom(), speciesId: uuid('species_id').notNull().references(() => species.id),
  waterType: text('water_type').notNull(), version: integer('version').notNull(),
  densityMin: doublePrecision('density_min').notNull().default(0), densityMax: doublePrecision('density_max').notNull(),
  doMin: doublePrecision('do_min').notNull(), phMin: doublePrecision('ph_min').notNull(), phMax: doublePrecision('ph_max').notNull(),
  temperatureMin: doublePrecision('temperature_min').notNull(), temperatureMax: doublePrecision('temperature_max').notNull(),
  weatherRainWatchMm: doublePrecision('weather_rain_watch_mm').notNull(),
  weatherHeatWatchC: doublePrecision('weather_heat_watch_c').notNull(),
  weatherWindWatchKmh: doublePrecision('weather_wind_watch_kmh').notNull(),
  approvalStatus: text('approval_status').notNull().default('draft'), reviewedBy: text('reviewed_by'), reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
}, t => [
  unique('threshold_rule_version_unique').on(t.speciesId, t.waterType, t.version),
  check('threshold_rule_valid', sql`${t.version} > 0 AND ${t.densityMin} >= 0 AND ${t.densityMax} >= ${t.densityMin} AND ${t.densityMax} < 'Infinity'::float8 AND ${t.doMin} BETWEEN 0 AND 100 AND ${t.phMin} BETWEEN 0 AND 14 AND ${t.phMax} BETWEEN ${t.phMin} AND 14 AND ${t.temperatureMin} BETWEEN -5 AND 60 AND ${t.temperatureMax} BETWEEN ${t.temperatureMin} AND 60 AND ${t.weatherRainWatchMm} > 0 AND ${t.weatherRainWatchMm} < 'Infinity'::float8 AND ${t.weatherHeatWatchC} BETWEEN -50 AND 60 AND ${t.weatherWindWatchKmh} > 0 AND ${t.weatherWindWatchKmh} < 'Infinity'::float8`),
  check('threshold_rule_water', sql`${t.waterType} IN ('freshwater','brackish','marine')`),
  check('threshold_rule_approval', sql`${t.approvalStatus} IN ('draft','approved','retired') AND (${t.approvalStatus} <> 'approved' OR (${t.reviewedBy} IS NOT NULL AND btrim(${t.reviewedBy}) <> '' AND ${t.reviewedAt} IS NOT NULL))`),
]).enableRLS();

export const actionLibrary = pgTable('action_library', {
  id: uuid('id').primaryKey().defaultRandom(), ruleId: uuid('rule_id').notNull().references(() => thresholdRules.id),
  riskType: text('risk_type').notNull(), instruction: text('instruction').notNull(),
  effectiveness: integer('effectiveness').notNull(), priority: integer('priority').notNull().default(0),
  automaticEligible: boolean('automatic_eligible').notNull().default(false),
  approvalStatus: text('approval_status').notNull().default('draft'), reviewedBy: text('reviewed_by'), reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
}, t => [check('action_valid', sql`btrim(${t.instruction}) <> '' AND ${t.effectiveness} BETWEEN 0 AND 100 AND ${t.riskType} IN ('low_oxygen','ph','temperature','weather_watch')`),
  check('action_approval', sql`${t.approvalStatus} IN ('draft','approved','retired') AND (${t.approvalStatus} <> 'approved' OR (${t.reviewedBy} IS NOT NULL AND btrim(${t.reviewedBy}) <> '' AND ${t.reviewedAt} IS NOT NULL))`),
]).enableRLS();

// Alternative equipment options: owning any listed item makes this action feasible.
export const actionEquipment = pgTable('action_equipment', {
  actionId: uuid('action_id').notNull().references(() => actionLibrary.id), equipmentId: uuid('equipment_id').notNull().references(() => equipmentCatalog.id),
}, t => [primaryKey({ columns: [t.actionId, t.equipmentId] })]).enableRLS();

export const actionTranslations = pgTable('action_translations', {
  actionId: uuid('action_id').notNull().references(() => actionLibrary.id), languageCode: text('language_code').notNull().references(() => languages.code),
  instruction: text('instruction').notNull(), reviewedBy: text('reviewed_by'), reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
}, t => [primaryKey({ columns: [t.actionId, t.languageCode] }), check('translation_nonempty', sql`btrim(${t.instruction}) <> ''`)]).enableRLS();

export const assessments = pgTable('assessments', {
  id: uuid('id').primaryKey().defaultRandom(), pondId: uuid('pond_id').notNull().references(() => ponds.id),
  cycleId: uuid('cycle_id').notNull().references(() => stockingCycles.id), source: text('source').notNull(),
  status: text('status').notNull(), confidence: text('confidence').notNull(),
  reasons: jsonb('reasons').$type<string[]>().notNull(), snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('assessments_pond_created_idx').on(t.pondId, t.createdAt), check('assessment_source', sql`${t.source} IN ('device','simulated')`), check('assessment_status', sql`${t.status} IN ('review_required','data_unavailable','within_reviewed_ranges','watch','warning')`), check('assessment_confidence', sql`${t.confidence} IN ('unavailable','standard','high','limited')`)]).enableRLS();

export const advisories = pgTable('advisories', {
  id: uuid('id').primaryKey().defaultRandom(), assessmentId: uuid('assessment_id').notNull().references(() => assessments.id),
  languageCode: text('language_code').notNull().references(() => languages.code), status: text('status').notNull(),
  actionIds: jsonb('action_ids').$type<string[]>().notNull(), finalText: text('final_text'),
  generatedText: text('generated_text'), generationStatus: text('generation_status').notNull().default('not_requested'),
  generatedAt: timestamp('generated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [unique('advisory_language_unique').on(t.assessmentId, t.languageCode), check('advisory_generation_status', sql`${t.generationStatus} IN ('not_requested','draft','unavailable')`), check('advisory_status', sql`${t.status} IN ('ready','review_required','no_alert')`), check('advisory_ready_text', sql`${t.status} <> 'ready' OR (${t.finalText} IS NOT NULL AND btrim(${t.finalText}) <> '')`)]).enableRLS();

export const smsDeliveries = pgTable('sms_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(), advisoryId: uuid('advisory_id').notNull().references(() => advisories.id),
  recipientKey: text('recipient_key').notNull(), maskedPhone: text('masked_phone').notNull(),
  status: text('status').notNull().default('delivered'), simulated: boolean('simulated').notNull().default(true),
  message: text('message').notNull(), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [unique('sms_simulation_recipient_unique').on(t.advisoryId, t.recipientKey), check('sms_simulation_only', sql`${t.simulated} = true AND ${t.status} = 'delivered'`)]).enableRLS();
