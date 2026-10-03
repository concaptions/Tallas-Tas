-- Gratsi's "Passion" field, which the importer had been misfiling into `core_desires`.
--
-- GUARDED, because this column is the one piece of PRODUCTION DRIFT in the schema: `passion`
-- already exists on the live `personas` table, added outside the journal, so an unguarded
-- ALTER would raise 42701 there and rely on the runner's error tolerance to carry on. The
-- guard makes the migration state its own precondition instead: apply it to a database that
-- has the column and it is a no-op; apply it to one that does not and it adds it. Migration
-- 0045 carries the same block for the same reason, and both are idempotent.
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'personas' AND column_name = 'passion'
	) THEN
		ALTER TABLE "personas" ADD COLUMN "passion" text;
	END IF;
END $$;
