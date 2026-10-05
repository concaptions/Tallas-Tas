ALTER TABLE "creative_briefs" ADD COLUMN "brief_number" integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "creative_briefs_brand_brief_number_idx" ON "creative_briefs" ("brand_id", "brief_number");
