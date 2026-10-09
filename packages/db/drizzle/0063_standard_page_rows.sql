-- 0063: the standard tabs become page rows (Scope A, ticket B4; design note §2, Talal's answers 1–3).
--
-- One `custom_interface_pages` row with `page_kind = 'standard'` per standard tab of the client
-- portal — the four `CLIENT_TAB_KEYS` and `calendar` (answer 2: no exceptions) — at the TEMPLATE
-- level (`brand_id IS NULL`), carrying the tab's visibility and order from the template's
-- `interface_tab_visibility` rows where they exist and the shipped defaults otherwise. A child
-- brand's own `interface_tab_visibility` row becomes a child standard row pointing at the template
-- row (`template_row_id`), with `overridden_fields` naming what it keeps. The tab's ROUTE stays its
-- own; the row only answers "is this tab shown, and where". `source_table_key` names the tab's
-- table for the record; `column_config` is empty because a standard row is never rendered by the
-- custom route (the route refuses `page_kind = 'standard'`, B2).
--
-- `interface_tab_visibility` is NOT dropped: the code stops reading it with the B4 push; the drop is
-- a later migration. Guarded by "a template brand exists", so a fresh database (every PGlite test)
-- is untouched, and NOT EXISTS on (brand, slug, kind), so a re-run inserts nothing.
INSERT INTO "custom_interface_pages"
	("brand_id", "slug", "title", "source_table_key", "filter_config", "column_config", "sort_order",
	 "is_visible", "is_inherited", "page_kind", "created_by", "updated_by")
SELECT NULL, k.slug, k.title, k.source, '{}'::jsonb, '[]'::jsonb,
	COALESCE(tv.sort_order, k.sort_order), COALESCE(tv.is_visible, true), true, 'standard',
	'migration:0063', 'migration:0063'
FROM (VALUES
	('concepts', 'Concepts', 'concepts', 1),
	('creative_sheet', 'Creative Sheet', 'creative_briefs', 2),
	('ugc_management', 'UGC Management', 'creators', 3),
	('copywriting', 'Copywriting', 'copywriting', 4),
	('calendar', 'Calendar', 'campaigns_offers', 5)
) AS k(slug, title, source, sort_order)
CROSS JOIN (
	SELECT id FROM "brands" WHERE is_template = true AND deleted_at IS NULL ORDER BY created_at LIMIT 1
) AS t
LEFT JOIN "interface_tab_visibility" tv
	ON tv.brand_id = t.id AND tv.tab_key = k.slug AND tv.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM "custom_interface_pages" p
	WHERE p.brand_id IS NULL AND p.slug = k.slug AND p.page_kind = 'standard' AND p.deleted_at IS NULL
);--> statement-breakpoint
INSERT INTO "custom_interface_pages"
	("brand_id", "slug", "title", "source_table_key", "filter_config", "column_config", "sort_order",
	 "is_visible", "is_inherited", "page_kind", "template_row_id", "overridden_fields", "created_by", "updated_by")
SELECT tv.brand_id, tpl.slug, tpl.title, tpl.source_table_key, '{}'::jsonb, '[]'::jsonb,
	tv.sort_order, tv.is_visible, true, 'standard', tpl.id, '["is_visible","sort_order"]'::jsonb,
	'migration:0063', 'migration:0063'
FROM "interface_tab_visibility" tv
JOIN "brands" b ON b.id = tv.brand_id AND b.is_template = false AND b.deleted_at IS NULL
JOIN "custom_interface_pages" tpl
	ON tpl.brand_id IS NULL AND tpl.slug = tv.tab_key AND tpl.page_kind = 'standard' AND tpl.deleted_at IS NULL
WHERE tv.deleted_at IS NULL
  AND NOT EXISTS (
	SELECT 1 FROM "custom_interface_pages" p
	WHERE p.brand_id = tv.brand_id AND p.slug = tv.tab_key AND p.page_kind = 'standard' AND p.deleted_at IS NULL
);
