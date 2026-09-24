CREATE TABLE "equipment_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "equipment_catalog_name_unique" UNIQUE("name"),
	CONSTRAINT "equipment_catalog_name_nonempty" CHECK (btrim("equipment_catalog"."name") <> '')
);
--> statement-breakpoint
ALTER TABLE "equipment_catalog" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "languages" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"native_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "languages_nonempty" CHECK (btrim("languages"."code") <> '' AND btrim("languages"."name") <> '' AND btrim("languages"."native_name") <> '')
);
--> statement-breakpoint
ALTER TABLE "languages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "region_languages" (
	"region_code" text NOT NULL,
	"language_code" text NOT NULL,
	CONSTRAINT "region_languages_region_code_language_code_pk" PRIMARY KEY("region_code","language_code"),
	CONSTRAINT "region_languages_region_nonempty" CHECK (btrim("region_languages"."region_code") <> '')
);
--> statement-breakpoint
ALTER TABLE "region_languages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "species" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"scientific_name" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "species_name_unique" UNIQUE("name"),
	CONSTRAINT "species_name_nonempty" CHECK (btrim("species"."name") <> '')
);
--> statement-breakpoint
ALTER TABLE "species" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "farmer_equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" uuid NOT NULL,
	"equipment_id" uuid,
	"custom_name" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "farmer_equipment_quantity_positive" CHECK ("farmer_equipment"."quantity" > 0),
	CONSTRAINT "farmer_equipment_source" CHECK (("farmer_equipment"."equipment_id" IS NOT NULL AND "farmer_equipment"."custom_name" IS NULL) OR ("farmer_equipment"."equipment_id" IS NULL AND "farmer_equipment"."custom_name" IS NOT NULL AND btrim("farmer_equipment"."custom_name") <> ''))
);
--> statement-breakpoint
ALTER TABLE "farmer_equipment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "farmers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"mobile_number" text NOT NULL,
	"region" text NOT NULL,
	"province" text NOT NULL,
	"municipality_city" text NOT NULL,
	"barangay" text NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"preferred_language_code" text NOT NULL,
	"sms_consent" boolean DEFAULT false NOT NULL,
	"account_status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "farmers_names_nonempty" CHECK (btrim("farmers"."first_name") <> '' AND btrim("farmers"."last_name") <> ''),
	CONSTRAINT "farmers_mobile_nonempty" CHECK (btrim("farmers"."mobile_number") <> ''),
	CONSTRAINT "farmers_location_nonempty" CHECK (btrim("farmers"."region") <> '' AND btrim("farmers"."province") <> '' AND btrim("farmers"."municipality_city") <> '' AND btrim("farmers"."barangay") <> ''),
	CONSTRAINT "farmers_coordinates" CHECK (("farmers"."latitude" IS NULL AND "farmers"."longitude" IS NULL) OR ("farmers"."latitude" IS NOT NULL AND "farmers"."longitude" IS NOT NULL AND "farmers"."latitude" BETWEEN -90 AND 90 AND "farmers"."longitude" BETWEEN -180 AND 180)),
	CONSTRAINT "farmers_status" CHECK ("farmers"."account_status" IN ('active', 'inactive', 'suspended'))
);
--> statement-breakpoint
ALTER TABLE "farmers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ponds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"area_m2" numeric(14, 2) NOT NULL,
	"water_type" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ponds_name_nonempty" CHECK (btrim("ponds"."name") <> ''),
	CONSTRAINT "ponds_area_positive" CHECK ("ponds"."area_m2" > 0 AND "ponds"."area_m2" <> 'NaN'::numeric),
	CONSTRAINT "ponds_water_type" CHECK ("ponds"."water_type" IN ('freshwater', 'brackish', 'marine')),
	CONSTRAINT "ponds_coordinates" CHECK (("ponds"."latitude" IS NULL AND "ponds"."longitude" IS NULL) OR ("ponds"."latitude" IS NOT NULL AND "ponds"."longitude" IS NOT NULL AND "ponds"."latitude" BETWEEN -90 AND 90 AND "ponds"."longitude" BETWEEN -180 AND 180))
);
--> statement-breakpoint
ALTER TABLE "ponds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stocking_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pond_id" uuid NOT NULL,
	"species_id" uuid NOT NULL,
	"quantity_stocked" integer NOT NULL,
	"stocked_area_m2" numeric(14, 2) NOT NULL,
	"stocking_density_per_m2" numeric(20, 6) GENERATED ALWAYS AS (quantity_stocked::numeric / NULLIF(stocked_area_m2, 0)) STORED,
	"stocking_date" date NOT NULL,
	"expected_harvest_date" date,
	"actual_harvest_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stocking_cycles_quantity_positive" CHECK ("stocking_cycles"."quantity_stocked" > 0),
	CONSTRAINT "stocking_cycles_area_positive" CHECK ("stocking_cycles"."stocked_area_m2" > 0 AND "stocking_cycles"."stocked_area_m2" <> 'NaN'::numeric),
	CONSTRAINT "stocking_cycles_status" CHECK ("stocking_cycles"."status" IN ('active', 'harvested', 'cancelled')),
	CONSTRAINT "stocking_cycles_expected_date" CHECK ("stocking_cycles"."expected_harvest_date" IS NULL OR "stocking_cycles"."expected_harvest_date" >= "stocking_cycles"."stocking_date"),
	CONSTRAINT "stocking_cycles_actual_date" CHECK ("stocking_cycles"."actual_harvest_date" IS NULL OR "stocking_cycles"."actual_harvest_date" >= "stocking_cycles"."stocking_date"),
	CONSTRAINT "stocking_cycles_harvest_status" CHECK (("stocking_cycles"."status" = 'harvested' AND "stocking_cycles"."actual_harvest_date" IS NOT NULL) OR ("stocking_cycles"."status" <> 'harvested' AND "stocking_cycles"."actual_harvest_date" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "stocking_cycles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "region_languages" ADD CONSTRAINT "region_languages_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "public"."languages"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farmer_equipment" ADD CONSTRAINT "farmer_equipment_farmer_id_farmers_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farmer_equipment" ADD CONSTRAINT "farmer_equipment_equipment_id_equipment_catalog_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_catalog"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farmers" ADD CONSTRAINT "farmers_preferred_language_code_languages_code_fk" FOREIGN KEY ("preferred_language_code") REFERENCES "public"."languages"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ponds" ADD CONSTRAINT "ponds_farmer_id_farmers_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stocking_cycles" ADD CONSTRAINT "stocking_cycles_pond_id_ponds_id_fk" FOREIGN KEY ("pond_id") REFERENCES "public"."ponds"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stocking_cycles" ADD CONSTRAINT "stocking_cycles_species_id_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "farmer_equipment_farmer_idx" ON "farmer_equipment" USING btree ("farmer_id");--> statement-breakpoint
CREATE INDEX "farmer_equipment_equipment_idx" ON "farmer_equipment" USING btree ("equipment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "farmer_equipment_catalog_unique" ON "farmer_equipment" USING btree ("farmer_id","equipment_id") WHERE "farmer_equipment"."equipment_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "farmer_equipment_custom_unique" ON "farmer_equipment" USING btree ("farmer_id",lower(btrim("custom_name"))) WHERE "farmer_equipment"."custom_name" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "farmers_language_idx" ON "farmers" USING btree ("preferred_language_code");--> statement-breakpoint
CREATE INDEX "ponds_farmer_idx" ON "ponds" USING btree ("farmer_id");--> statement-breakpoint
CREATE INDEX "stocking_cycles_pond_idx" ON "stocking_cycles" USING btree ("pond_id");--> statement-breakpoint
CREATE INDEX "stocking_cycles_species_idx" ON "stocking_cycles" USING btree ("species_id");