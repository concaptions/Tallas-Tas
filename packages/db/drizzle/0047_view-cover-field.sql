-- A saved view remembers WHICH image covers a gallery card (action item 16, "customise the card").
--
-- "Customise card" was half-built: the Fields popover already chose which labelled lines a card
-- shows, because those lines come from the same column set the grid renders. The cover did not — it
-- was whatever each page hard-coded in its `identity` callback (`imageUrl: creator.profilePicUrl`),
-- so a creator's Video Intro was declared a gallery field in the capability registry and could
-- never be selected. This is the column that records the choice.
--
-- NULLABLE, not defaulted to '': "no choice recorded, use the page's own cover" and "cover with
-- THIS column" are different states, and an empty string is not a column key. `parseUserViewConfig`
-- reads both NULL and '' as the page default, so a row written before this column existed, and a
-- row that somehow holds '', both render exactly as they did.
--
-- The value is a RESOLVER column key, chosen from the table's declared `galleryFields` and narrowed
-- to the columns the brand actually resolves. It is NOT a `column_definitions` row and must never
-- become one: a cover is one viewer's lens on a shared table, the same way `frozen_fields` and
-- `visible_fields` on this table are, so it belongs here and not in the column configuration every
-- brand shares.
--
-- GUARDED, like every migration here: it states its own precondition rather than relying on the
-- runner's error tolerance.
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'user_table_views' AND column_name = 'cover_field'
	) THEN
		ALTER TABLE "user_table_views" ADD COLUMN "cover_field" text;
	END IF;
END $$;
