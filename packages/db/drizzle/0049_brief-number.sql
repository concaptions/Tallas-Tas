-- creative_briefs.brief_number — the per-brand sequence the Oct 5 auto-naming formula zero-pads
-- into the generated name (Agent 3, "TAS-TOF-V001-..."). Nullable: every row created before this
-- migration has no printed sequence number, and the generator allocates one atomically for every
-- NEW brief under a per-brand advisory lock. Soft-deleted rows are NOT excluded from the MAX
-- read, so a printed number is never reused once it has existed (honest gaps, same rule as the
-- shipped per-funnel-and-format sequence).
--
-- Guarded so a partial apply never errors on re-run.
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'creative_briefs' AND column_name = 'brief_number'
	) THEN
		ALTER TABLE "creative_briefs" ADD COLUMN "brief_number" integer;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "creative_briefs_brand_brief_number_idx"
	ON "creative_briefs" ("brand_id", "brief_number");
