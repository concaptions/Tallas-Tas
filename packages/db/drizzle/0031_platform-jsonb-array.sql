ALTER TABLE "creative_briefs" ALTER COLUMN "platform" SET DATA TYPE jsonb USING CASE WHEN "platform" IS NULL THEN '[]'::jsonb ELSE jsonb_build_array("platform") END;
--> statement-breakpoint
ALTER TABLE "creative_briefs" ALTER COLUMN "platform" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "creative_briefs" ALTER COLUMN "platform" SET DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "creators" ALTER COLUMN "platform" SET DATA TYPE jsonb USING CASE WHEN "platform" IS NULL THEN '[]'::jsonb ELSE jsonb_build_array("platform") END;
--> statement-breakpoint
ALTER TABLE "creators" ALTER COLUMN "platform" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "creators" ALTER COLUMN "platform" SET DEFAULT '[]'::jsonb;
