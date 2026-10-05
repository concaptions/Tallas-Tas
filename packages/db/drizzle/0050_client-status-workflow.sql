-- Client-status workflow fields (Oct 5 Talal sync, Agent 5).
--
-- Adds timestamp + optional note metadata beside the client-facing status column on the four tables
-- the Oct 5 meeting named: Concepts, Creative Sheet (creative_briefs), UGC Management (creators),
-- Copywriting. The STATUS COLUMNS THEMSELVES already exist on every one of these tables under the
-- domain's own vocabulary (`CLIENT_STATUS` for concepts and creative_briefs, `CREATOR_STATUS` for
-- creators, `COPY_STATUS` for copywriting — see the Oct 5 decisions entry) — this migration only
-- carries the WHEN + the WHY line beside them.
--
-- Columns added:
--   - concepts.client_status_updated_at (timestamptz, nullable)
--   - concepts.client_status_note (text, nullable)
--   - creative_briefs.client_status_updated_at (timestamptz, nullable)
--   - creative_briefs.client_status_note (text, nullable)
--   - creators.client_status_updated_at (timestamptz, nullable) — reuses existing `client_note`
--   - copywriting.status_updated_at (timestamptz, nullable) — the column is `status`, not
--     `client_status`, because copy has ONE track that is already client-facing (COPY_STATUS); the
--     timestamp is named after the real column, not after a hypothetical parallel column
--
-- All six are NULLABLE with no default: a row that was created before this migration carries no
-- recorded update-moment, and the `client_status_updated_at` column answering NULL means "the
-- stored status is the one it started at". The note columns are plain `text` nullable because a
-- status change does not always carry a reason — `pending_for_approval` → `approved` typically
-- does not.
--
-- Nothing is dropped. The migration is guarded so a partial apply never fails on the second run.
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'concepts' AND column_name = 'client_status_updated_at'
	) THEN
		ALTER TABLE "concepts" ADD COLUMN "client_status_updated_at" timestamp with time zone;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'concepts' AND column_name = 'client_status_note'
	) THEN
		ALTER TABLE "concepts" ADD COLUMN "client_status_note" text;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'creative_briefs' AND column_name = 'client_status_updated_at'
	) THEN
		ALTER TABLE "creative_briefs" ADD COLUMN "client_status_updated_at" timestamp with time zone;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'creative_briefs' AND column_name = 'client_status_note'
	) THEN
		ALTER TABLE "creative_briefs" ADD COLUMN "client_status_note" text;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'creators' AND column_name = 'client_status_updated_at'
	) THEN
		ALTER TABLE "creators" ADD COLUMN "client_status_updated_at" timestamp with time zone;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'copywriting' AND column_name = 'status_updated_at'
	) THEN
		ALTER TABLE "copywriting" ADD COLUMN "status_updated_at" timestamp with time zone;
	END IF;
END $$;
