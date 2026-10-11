-- 0065: `concepts.name_mode` (SMOKE-31, 2026-10-11) — the brief fix (0060) on concepts.
--
-- A concept's name is generated at CREATE (`Batch-Angle-Theme`, non-negotiable 6) — but every
-- imported Gratsi concept carries its Airtable name verbatim ("Oct, 2025 - Casual date night…"),
-- and the detail page ran the formula over the row at render time while the grid showed the
-- stored name, so the same concept had two names on screen; a save then overwrote the stored one.
-- `name_mode` says which rule the row follows: 'manual' (imported or hand-named: `name` is read
-- verbatim, never recomputed) or 'auto' (created here: the formula may re-run on a rename of its
-- parts). Every existing row is 'manual' — exactly the brief ruling — so nothing on screen changes
-- until a row is created through the platform. Idempotent: ADD COLUMN IF NOT EXISTS.
ALTER TABLE "concepts" ADD COLUMN IF NOT EXISTS "name_mode" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'concepts_name_mode_check') THEN
    ALTER TABLE "concepts" ADD CONSTRAINT "concepts_name_mode_check" CHECK ("name_mode" IN ('auto', 'manual'));
  END IF;
END $$;
