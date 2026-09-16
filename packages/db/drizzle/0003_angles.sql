CREATE TYPE "public"."angle_format" AS ENUM('Static', 'Video', 'Carousel', 'Motion Graphic');--> statement-breakpoint
CREATE TYPE "public"."angle_type" AS ENUM('Emotional', 'Functional', 'Identity', 'Critical');--> statement-breakpoint
--> Widening, not a replacement: `type` was one text value in 0002 and PRD §5.6 calls it a
--> multi-select, so an existing value becomes a one-element array and a null becomes the empty
--> array. Postgres has no implicit text -> jsonb cast, so the USING clause is required; without it
--> this statement is rejected whether or not the table holds rows.
ALTER TABLE "angles" ALTER COLUMN "type" SET DATA TYPE jsonb USING (case when "type" is null then '[]'::jsonb else jsonb_build_array("type") end);--> statement-breakpoint
ALTER TABLE "angles" ALTER COLUMN "type" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "angles" ALTER COLUMN "type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "angles" ADD COLUMN "formats" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "angles" ADD COLUMN "ad_inspo_links" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "angles" ADD COLUMN "potential" text;--> statement-breakpoint
ALTER TABLE "angles" ADD COLUMN "winning" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "angles" ADD COLUMN "internal_notes" text;--> statement-breakpoint
ALTER TABLE "angles" ADD COLUMN "client_notes" text;