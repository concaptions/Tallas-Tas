-- Interface-config: custom pages and standard-tab visibility (Oct 6/7 overnight run, Agent 4).
--
-- Two new tables that let an agency Admin / CSM configure the per-brand client interface beyond
-- PRD §10's five pages (which the shipped `interface_pages` / `interface_fields` pair already
-- carries, untouched):
--
--   - `custom_interface_pages` carries BRAND-LEVEL custom pages. A row with `brand_id IS NULL` is
--     a TEMPLATE page every child inherits unless the child has its own row (same slug) marked
--     `is_inherited = false`. The propagation engine writes `is_inherited = true` child rows on
--     Approve of a template-side promotion request; a child row that was explicitly customised in
--     the admin UI carries `is_inherited = false` and is left alone by propagation.
--
--   - `interface_tab_visibility` carries the per-brand visibility and ordering of the FOUR
--     shipped client tabs (concepts, creative_sheet, ugc_management, copywriting). The absence of
--     a row for a (brand_id, tab_key) means "inherit the template default" — the seed inserts the
--     four defaults for the template brand, and a child reads its own row when present and the
--     template's otherwise.
--
-- `filter_config` is `jsonb` carrying `{column, op, value?}` or `{}`. Allowed ops in V0 (enforced
-- in the domain, not the DB): is | is_not | contains | is_empty | is_not_empty. `column_config` is
-- a `jsonb` array of `{columnKey, displayLabel, displayOrder}` entries matching the resolver's
-- shape, so the client page's columns can be a narrowed subset of the resolver's output.
--
-- Nothing is dropped. Every statement is guarded (IF NOT EXISTS / information_schema) so a partial
-- apply never errors on re-run — the same pattern 0049 and 0050 use.
--
-- NOT APPLIED TO PROD HERE. The orchestrator applies this after human review (migrate-prod).

DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.tables
		WHERE table_schema = 'public' AND table_name = 'custom_interface_pages'
	) THEN
		CREATE TABLE "custom_interface_pages" (
			"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
			"brand_id" uuid,
			"created_at" timestamp with time zone DEFAULT now() NOT NULL,
			"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
			"created_by" text,
			"updated_by" text,
			"deleted_at" timestamp with time zone,
			"slug" text NOT NULL,
			"title" text NOT NULL,
			"source_table_key" text NOT NULL,
			"filter_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
			"column_config" jsonb DEFAULT '[]'::jsonb NOT NULL,
			"sort_order" integer DEFAULT 0 NOT NULL,
			"is_visible" boolean DEFAULT true NOT NULL,
			"is_inherited" boolean DEFAULT true NOT NULL,
			CONSTRAINT "custom_interface_pages_brand_slug_uq" UNIQUE("brand_id","slug")
		);
	END IF;
END $$;
--> statement-breakpoint

DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.table_constraints
		WHERE table_schema = 'public'
			AND table_name = 'custom_interface_pages'
			AND constraint_name = 'custom_interface_pages_brand_id_brands_id_fk'
	) THEN
		ALTER TABLE "custom_interface_pages"
			ADD CONSTRAINT "custom_interface_pages_brand_id_brands_id_fk"
			FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id");
	END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "custom_interface_pages_brand_id_idx"
	ON "custom_interface_pages" ("brand_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "custom_interface_pages_brand_sort_idx"
	ON "custom_interface_pages" ("brand_id", "sort_order");
--> statement-breakpoint

DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.tables
		WHERE table_schema = 'public' AND table_name = 'interface_tab_visibility'
	) THEN
		CREATE TABLE "interface_tab_visibility" (
			"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
			"brand_id" uuid NOT NULL,
			"created_at" timestamp with time zone DEFAULT now() NOT NULL,
			"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
			"created_by" text,
			"updated_by" text,
			"deleted_at" timestamp with time zone,
			"tab_key" text NOT NULL,
			"is_visible" boolean DEFAULT true NOT NULL,
			"sort_order" integer DEFAULT 0 NOT NULL,
			CONSTRAINT "interface_tab_visibility_brand_tab_uq" UNIQUE("brand_id","tab_key")
		);
	END IF;
END $$;
--> statement-breakpoint

DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.table_constraints
		WHERE table_schema = 'public'
			AND table_name = 'interface_tab_visibility'
			AND constraint_name = 'interface_tab_visibility_brand_id_brands_id_fk'
	) THEN
		ALTER TABLE "interface_tab_visibility"
			ADD CONSTRAINT "interface_tab_visibility_brand_id_brands_id_fk"
			FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id");
	END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "interface_tab_visibility_brand_id_idx"
	ON "interface_tab_visibility" ("brand_id");
