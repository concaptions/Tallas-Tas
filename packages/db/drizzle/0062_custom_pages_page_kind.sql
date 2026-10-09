-- 0062: the client-page entity, Scope A step 1 (docs/designs/client-interface-config-2026-10-10.md).
--
-- `custom_interface_pages` becomes THE page entity of the client interface: standard tabs, admin
-- custom views and module pages (Partnership Ads Tracking) are one kind of row. This migration adds
-- the four columns the design names and backfills what the existing rows already mean:
--
--   page_kind         'standard' | 'custom' | 'module' — every existing row is 'custom'.
--   module_key        the module a 'module' page renders ('partnership_ads'); NULL otherwise.
--   template_row_id   the template page a child row inherits from. Backfilled for every child row
--                     that today inherits BY SLUG from a live template row, so `is_inherited` keeps
--                     meaning what it meant and the engine can stop matching on slug.
--   overridden_fields the CLAUDE.md pattern: the fields a child keeps its own value for.
--
-- NOT HERE: the move of the four `interface_tab_visibility` template rows into 'standard' page rows
-- (and the fifth, `calendar`). The LIVE portal layout renders every visible template row of this
-- table as a custom tab and the admin section lists it as an editable custom page; inserting
-- standard rows before the code that reads `page_kind` is deployed would put five bogus tabs on
-- every client portal for the apply → deploy window. That backfill is 0063, shipped with ticket B4,
-- after the B2 code (which filters on `page_kind`) is live. Until then `interface_tab_visibility`
-- stays the source of tab visibility.
--
-- Idempotent: every statement is guarded, a partial apply never errors on re-run (0049–0051 pattern).
ALTER TABLE "custom_interface_pages" ADD COLUMN IF NOT EXISTS "page_kind" text DEFAULT 'custom' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'custom_interface_pages_page_kind_check') THEN
		ALTER TABLE "custom_interface_pages" ADD CONSTRAINT "custom_interface_pages_page_kind_check"
			CHECK ("page_kind" IN ('standard', 'custom', 'module'));
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "custom_interface_pages" ADD COLUMN IF NOT EXISTS "module_key" text;--> statement-breakpoint
ALTER TABLE "custom_interface_pages" ADD COLUMN IF NOT EXISTS "template_row_id" uuid;--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'custom_interface_pages_template_row_id_fk') THEN
		ALTER TABLE "custom_interface_pages" ADD CONSTRAINT "custom_interface_pages_template_row_id_fk"
			FOREIGN KEY ("template_row_id") REFERENCES "custom_interface_pages"("id") ON DELETE SET NULL;
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "custom_interface_pages" ADD COLUMN IF NOT EXISTS "overridden_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "custom_interface_pages_template_row_id_idx" ON "custom_interface_pages" ("template_row_id");--> statement-breakpoint
UPDATE "custom_interface_pages" c SET "template_row_id" = t."id"
	FROM "custom_interface_pages" t
	WHERE c."brand_id" IS NOT NULL AND c."template_row_id" IS NULL
	  AND t."brand_id" IS NULL AND t."deleted_at" IS NULL AND t."slug" = c."slug";
