ALTER TABLE "advisories" ADD COLUMN "generated_text" text;--> statement-breakpoint
ALTER TABLE "advisories" ADD COLUMN "generation_status" text DEFAULT 'not_requested' NOT NULL;--> statement-breakpoint
ALTER TABLE "advisories" ADD COLUMN "generated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "advisories" ADD CONSTRAINT "advisory_generation_status" CHECK ("advisories"."generation_status" IN ('not_requested','draft','unavailable'));