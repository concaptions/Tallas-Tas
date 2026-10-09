ALTER TABLE "creative_briefs" ADD COLUMN "name_mode" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "creative_briefs" ADD CONSTRAINT "creative_briefs_name_mode_check" CHECK ("name_mode" IN ('auto', 'manual'));
