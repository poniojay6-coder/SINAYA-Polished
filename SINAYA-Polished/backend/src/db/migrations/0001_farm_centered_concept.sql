CREATE TABLE "farm_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"mobile_number" text NOT NULL,
	"role" text DEFAULT 'farm_staff' NOT NULL,
	"preferred_language_code" text NOT NULL,
	"receives_alerts" boolean DEFAULT false NOT NULL,
	"sms_consent" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "farm_contacts_nonempty" CHECK (btrim("farm_contacts"."name") <> '' AND btrim("farm_contacts"."mobile_number") <> '' AND btrim("farm_contacts"."role") <> '')
);
--> statement-breakpoint
ALTER TABLE "farm_contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "farms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_id" uuid NOT NULL,
	"name" text NOT NULL,
	"region" text NOT NULL,
	"province" text NOT NULL,
	"municipality_city" text NOT NULL,
	"barangay" text NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"notify_operator" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "farms_name_nonempty" CHECK (btrim("farms"."name") <> ''),
	CONSTRAINT "farms_location_nonempty" CHECK (btrim("farms"."region") <> '' AND btrim("farms"."province") <> '' AND btrim("farms"."municipality_city") <> '' AND btrim("farms"."barangay") <> ''),
	CONSTRAINT "farms_coordinates" CHECK (("farms"."latitude" IS NULL AND "farms"."longitude" IS NULL) OR ("farms"."latitude" IS NOT NULL AND "farms"."longitude" IS NOT NULL AND "farms"."latitude" BETWEEN -90 AND 90 AND "farms"."longitude" BETWEEN -180 AND 180))
);
--> statement-breakpoint
ALTER TABLE "farms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ponds" DROP CONSTRAINT "ponds_farmer_id_farmers_id_fk";
--> statement-breakpoint
DROP INDEX "ponds_farmer_idx";--> statement-breakpoint
ALTER TABLE "languages" ADD COLUMN "requires_native_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ponds" ADD COLUMN "farm_id" uuid;--> statement-breakpoint
-- Preserve pre-revision ponds. The old model cannot tell which physical farm
-- each pond belongs to, so create one provisional farm per operator with ponds.
-- Review these imported farm names/locations and regroup ponds before pilot use.
INSERT INTO "farms" ("operator_id", "name", "region", "province", "municipality_city", "barangay", "latitude", "longitude")
SELECT f."id", 'Imported farm - ' || f."first_name" || ' ' || f."last_name",
       f."region", f."province", f."municipality_city", f."barangay", f."latitude", f."longitude"
FROM "farmers" f
WHERE EXISTS (SELECT 1 FROM "ponds" p WHERE p."farmer_id" = f."id");
--> statement-breakpoint
UPDATE "ponds" p SET "farm_id" = f."id" FROM "farms" f WHERE f."operator_id" = p."farmer_id";
--> statement-breakpoint
ALTER TABLE "ponds" ALTER COLUMN "farm_id" SET NOT NULL;--> statement-breakpoint
-- Existing Cebuano catalogue entries need review before any localized content deploys.
UPDATE "languages" SET "requires_native_review" = true WHERE split_part(lower("code"), '-', 1) = 'ceb';
--> statement-breakpoint
ALTER TABLE "farm_contacts" ADD CONSTRAINT "farm_contacts_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_contacts" ADD CONSTRAINT "farm_contacts_preferred_language_code_languages_code_fk" FOREIGN KEY ("preferred_language_code") REFERENCES "public"."languages"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farms" ADD CONSTRAINT "farms_operator_id_farmers_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."farmers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "farm_contacts_farm_idx" ON "farm_contacts" USING btree ("farm_id");--> statement-breakpoint
CREATE INDEX "farm_contacts_language_idx" ON "farm_contacts" USING btree ("preferred_language_code");--> statement-breakpoint
CREATE INDEX "farms_operator_idx" ON "farms" USING btree ("operator_id");--> statement-breakpoint
ALTER TABLE "ponds" ADD CONSTRAINT "ponds_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ponds_farm_idx" ON "ponds" USING btree ("farm_id");--> statement-breakpoint
ALTER TABLE "ponds" DROP COLUMN "farmer_id";--> statement-breakpoint
ALTER TABLE "languages" ADD CONSTRAINT "languages_cebuano_review_required" CHECK (split_part(lower("languages"."code"), '-', 1) <> 'ceb' OR "languages"."requires_native_review");
