-- A saved view remembers its FIELD CONDITIONS and its GROUPING column (AI-32), beside the search
-- string, the sort and the cover it already keeps.
--
-- `filters` is jsonb: a LIST of {field, op, value} conditions, ANDed, where op is one of
-- 'is' | 'is_not' | 'contains' | 'empty' | 'not_empty'. It defaults to '[]' NOT NULL because "no
-- conditions" is a real, total answer for every row that exists today — unlike `cover_field`,
-- where NULL and a value mean different kinds of absence. The shape is narrowed on every read by
-- `parseUserViewConfig` in @tas/domain, so a malformed entry degrades to "no condition", never to
-- a blank grid.
--
-- `group_by` is text, not jsonb, deliberately: it is one nullable column key, the same scalar
-- shape `cover_field` and `filter` already use on this table. NULL means the flat reading. Wrapping
-- a bare string in jsonb would buy nothing but quoting.
--
-- Both are PER-VIEWER lens state, never column configuration: they belong on user_table_views
-- exactly as visible_fields and frozen_fields do, and must never become column_definitions rows.
--
-- GUARDED, like every migration here: it states its own precondition rather than relying on the
-- runner's error tolerance.
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'user_table_views' AND column_name = 'filters'
	) THEN
		ALTER TABLE "user_table_views" ADD COLUMN "filters" jsonb DEFAULT '[]'::jsonb NOT NULL;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'user_table_views' AND column_name = 'group_by'
	) THEN
		ALTER TABLE "user_table_views" ADD COLUMN "group_by" text;
	END IF;
END $$;
