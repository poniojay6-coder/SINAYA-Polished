CREATE TABLE "sensor_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sensor_id" uuid NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text NOT NULL,
	"dissolved_oxygen_mg_l" double precision NOT NULL,
	"ph" double precision NOT NULL,
	"water_temperature_c" double precision NOT NULL,
	CONSTRAINT "sensor_readings_source" CHECK ("sensor_readings"."source" IN ('device', 'simulated')),
	CONSTRAINT "sensor_readings_bounds" CHECK ("sensor_readings"."dissolved_oxygen_mg_l" BETWEEN 0 AND 100 AND "sensor_readings"."ph" BETWEEN 0 AND 14 AND "sensor_readings"."water_temperature_c" BETWEEN -5 AND 60)
);
--> statement-breakpoint
ALTER TABLE "sensor_readings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sensor_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pond_id" uuid NOT NULL,
	"serial_number" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sensor_units_serial_number_unique" UNIQUE("serial_number"),
	CONSTRAINT "sensor_serial_nonempty" CHECK (btrim("sensor_units"."serial_number") <> '')
);
--> statement-breakpoint
ALTER TABLE "sensor_units" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_sensor_id_sensor_units_id_fk" FOREIGN KEY ("sensor_id") REFERENCES "public"."sensor_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensor_units" ADD CONSTRAINT "sensor_units_pond_id_ponds_id_fk" FOREIGN KEY ("pond_id") REFERENCES "public"."ponds"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sensor_readings_sample_unique" ON "sensor_readings" USING btree ("sensor_id","observed_at","source");--> statement-breakpoint
CREATE INDEX "sensor_readings_latest_idx" ON "sensor_readings" USING btree ("sensor_id","source","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sensor_units_active_pond" ON "sensor_units" USING btree ("pond_id") WHERE "sensor_units"."is_active" = true;--> statement-breakpoint
CREATE INDEX "sensor_units_pond_idx" ON "sensor_units" USING btree ("pond_id");