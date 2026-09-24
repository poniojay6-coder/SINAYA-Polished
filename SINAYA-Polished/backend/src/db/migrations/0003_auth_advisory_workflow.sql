CREATE TABLE "action_equipment" (
	"action_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	CONSTRAINT "action_equipment_action_id_equipment_id_pk" PRIMARY KEY("action_id","equipment_id")
);
--> statement-breakpoint
ALTER TABLE "action_equipment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "action_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"risk_type" text NOT NULL,
	"instruction" text NOT NULL,
	"effectiveness" integer NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"automatic_eligible" boolean DEFAULT false NOT NULL,
	"approval_status" text DEFAULT 'draft' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "action_valid" CHECK (btrim("action_library"."instruction") <> '' AND "action_library"."effectiveness" BETWEEN 0 AND 100 AND "action_library"."risk_type" IN ('low_oxygen','ph','temperature','weather_watch')),
	CONSTRAINT "action_approval" CHECK ("action_library"."approval_status" IN ('draft','approved','retired') AND ("action_library"."approval_status" <> 'approved' OR ("action_library"."reviewed_by" IS NOT NULL AND btrim("action_library"."reviewed_by") <> '' AND "action_library"."reviewed_at" IS NOT NULL)))
);
--> statement-breakpoint
ALTER TABLE "action_library" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "action_translations" (
	"action_id" uuid NOT NULL,
	"language_code" text NOT NULL,
	"instruction" text NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "action_translations_action_id_language_code_pk" PRIMARY KEY("action_id","language_code"),
	CONSTRAINT "translation_nonempty" CHECK (btrim("action_translations"."instruction") <> '')
);
--> statement-breakpoint
ALTER TABLE "action_translations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "advisories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"language_code" text NOT NULL,
	"status" text NOT NULL,
	"action_ids" jsonb NOT NULL,
	"final_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advisory_language_unique" UNIQUE("assessment_id","language_code"),
	CONSTRAINT "advisory_status" CHECK ("advisories"."status" IN ('ready','review_required','no_alert')),
	CONSTRAINT "advisory_ready_text" CHECK ("advisories"."status" <> 'ready' OR ("advisories"."final_text" IS NOT NULL AND btrim("advisories"."final_text") <> ''))
);
--> statement-breakpoint
ALTER TABLE "advisories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pond_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"confidence" text NOT NULL,
	"reasons" jsonb NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_source" CHECK ("assessments"."source" IN ('device','simulated')),
	CONSTRAINT "assessment_status" CHECK ("assessments"."status" IN ('review_required','data_unavailable','within_reviewed_ranges','watch','warning')),
	CONSTRAINT "assessment_confidence" CHECK ("assessments"."confidence" IN ('unavailable','standard','high','limited'))
);
--> statement-breakpoint
ALTER TABLE "assessments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sms_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"advisory_id" uuid NOT NULL,
	"recipient_key" text NOT NULL,
	"masked_phone" text NOT NULL,
	"status" text DEFAULT 'delivered' NOT NULL,
	"simulated" boolean DEFAULT true NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sms_simulation_recipient_unique" UNIQUE("advisory_id","recipient_key"),
	CONSTRAINT "sms_simulation_only" CHECK ("sms_deliveries"."simulated" = true AND "sms_deliveries"."status" = 'delivered')
);
--> statement-breakpoint
ALTER TABLE "sms_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "threshold_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"species_id" uuid NOT NULL,
	"water_type" text NOT NULL,
	"version" integer NOT NULL,
	"density_min" double precision DEFAULT 0 NOT NULL,
	"density_max" double precision NOT NULL,
	"do_min" double precision NOT NULL,
	"ph_min" double precision NOT NULL,
	"ph_max" double precision NOT NULL,
	"temperature_min" double precision NOT NULL,
	"temperature_max" double precision NOT NULL,
	"weather_rain_watch_mm" double precision NOT NULL,
	"weather_heat_watch_c" double precision NOT NULL,
	"weather_wind_watch_kmh" double precision NOT NULL,
	"approval_status" text DEFAULT 'draft' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "threshold_rule_version_unique" UNIQUE("species_id","water_type","version"),
	CONSTRAINT "threshold_rule_valid" CHECK ("threshold_rules"."version" > 0 AND "threshold_rules"."density_min" >= 0 AND "threshold_rules"."density_max" >= "threshold_rules"."density_min" AND "threshold_rules"."density_max" < 'Infinity'::float8 AND "threshold_rules"."do_min" BETWEEN 0 AND 100 AND "threshold_rules"."ph_min" BETWEEN 0 AND 14 AND "threshold_rules"."ph_max" BETWEEN "threshold_rules"."ph_min" AND 14 AND "threshold_rules"."temperature_min" BETWEEN -5 AND 60 AND "threshold_rules"."temperature_max" BETWEEN "threshold_rules"."temperature_min" AND 60 AND "threshold_rules"."weather_rain_watch_mm" > 0 AND "threshold_rules"."weather_rain_watch_mm" < 'Infinity'::float8 AND "threshold_rules"."weather_heat_watch_c" BETWEEN -50 AND 60 AND "threshold_rules"."weather_wind_watch_kmh" > 0 AND "threshold_rules"."weather_wind_watch_kmh" < 'Infinity'::float8),
	CONSTRAINT "threshold_rule_water" CHECK ("threshold_rules"."water_type" IN ('freshwater','brackish','marine')),
	CONSTRAINT "threshold_rule_approval" CHECK ("threshold_rules"."approval_status" IN ('draft','approved','retired') AND ("threshold_rules"."approval_status" <> 'approved' OR ("threshold_rules"."reviewed_by" IS NOT NULL AND btrim("threshold_rules"."reviewed_by") <> '' AND "threshold_rules"."reviewed_at" IS NOT NULL)))
);
--> statement-breakpoint
ALTER TABLE "threshold_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "farmers" ADD COLUMN "auth_user_id" uuid;--> statement-breakpoint
ALTER TABLE "action_equipment" ADD CONSTRAINT "action_equipment_action_id_action_library_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."action_library"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_equipment" ADD CONSTRAINT "action_equipment_equipment_id_equipment_catalog_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_library" ADD CONSTRAINT "action_library_rule_id_threshold_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."threshold_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_translations" ADD CONSTRAINT "action_translations_action_id_action_library_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."action_library"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_translations" ADD CONSTRAINT "action_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "public"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisories" ADD CONSTRAINT "advisories_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisories" ADD CONSTRAINT "advisories_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "public"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_pond_id_ponds_id_fk" FOREIGN KEY ("pond_id") REFERENCES "public"."ponds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_cycle_id_stocking_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."stocking_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_deliveries" ADD CONSTRAINT "sms_deliveries_advisory_id_advisories_id_fk" FOREIGN KEY ("advisory_id") REFERENCES "public"."advisories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threshold_rules" ADD CONSTRAINT "threshold_rules_species_id_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assessments_pond_created_idx" ON "assessments" USING btree ("pond_id","created_at");--> statement-breakpoint
ALTER TABLE "farmers" ADD CONSTRAINT "farmers_auth_user_id_unique" UNIQUE("auth_user_id");