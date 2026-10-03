-- Virtual columns: a `column_definitions` row may name a COMPUTED column instead of a stored one.
--
-- Seven columns across five pages are displayed, are already computed correctly on read by an
-- exported function in `packages/db/src/formulas/`, and have NO Postgres column at all —
-- `creative_sheet_items.name` is the clearest: Airtable's primary field is a formula, and storing it
-- would let the month drift from `created_at`. Until now such a column could not be CONFIGURED,
-- because `column_key` admitted only a real column or a table carrying a foreign key back, so a
-- resolver-driven page would simply drop it.
--
-- `formula` is both the marker and the pointer, deliberately one column rather than a boolean beside
-- a name: NULL means the column is stored, and a non-null value names the function that computes it.
-- A boolean would permit the invalid state of "virtual, with nothing to compute it".
--
-- GUARDED, like every migration here: it states its own precondition rather than relying on the
-- runner's error tolerance.
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'column_definitions' AND column_name = 'formula'
	) THEN
		ALTER TABLE "column_definitions" ADD COLUMN "formula" text;
	END IF;
END $$;
