import { boolean, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';
import type { InterfacePageKey } from './enums';

/**
 * Which pages the client sees, and which fields those pages show (PRD §10: "the interface must be
 * configurable per client, at two levels"). Two branded tables, one row per page and one row per
 * field, so a brand's interface is data a CSM edits rather than a base someone hacks by hand.
 *
 * WHY A TABLE AND NOT A COLUMN. CLAUDE.md is explicit: never create per-brand Postgres columns, and
 * per-brand visibility lives in its own table. `interface_fields.visible` is exactly that — turning
 * the script off on Niagara's concept card must not be a migration, and it must not make Gratsi's
 * card a different shape at the schema level. Both tables are branded (`brand_id` NOT NULL), so
 * `withBrand` scopes every read and write and one brand can never read or re-order another's
 * interface.
 *
 * WHAT `client_editable` MEANS, and why it is a second flag rather than a mode of `visible`. PRD
 * §10's table has two independent axes: whether the client SEES a field and whether the client may
 * CHANGE it. The five pages' editable set is short and fixed by the PRD (Client Status and comments
 * on Creatives, Status and Client's Comment on Copywriting, Status, Note and Tracking Number on UGC,
 * nothing at all on Partnership Ads Tracking, which is view / group / filter only), while the
 * visible set is what a CSM tunes per brand. A field can be visible and read-only (every field on
 * the concept card), and a field that is not visible is not editable whatever this flag says — the
 * client interface asks `visible && clientEditable` and never `clientEditable` alone.
 *
 * ORDER IS A COLUMN, not insertion order: `position` is what `listInterfaceConfig` sorts by, so a
 * field toggled off and on again comes back exactly where PRD §10 lists it rather than at the end.
 * Positions are 0-based and dense within their parent; nothing reads them as an identifier.
 *
 * NOT A CASCADE. `interface_fields.page_id` references `interface_pages.id` with no `on delete`
 * clause, because these tables are soft-deleted like every other table in this schema (CLAUDE.md:
 * "soft delete only, never DELETE FROM a data table"). A page that is switched off keeps
 * `enabled = false` and keeps its field rows with their own flags intact, which is what makes
 * switching it back on restore the previous field set instead of the defaults.
 */
export const interfacePages = pgTable(
  'interface_pages',
  {
    ...baseColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    /** Which of PRD §10's five pages this row configures; the storage vocabulary is `interfacePageKeys`. */
    pageKey: text('page_key').$type<InterfacePageKey>().notNull(),
    /** What the client's tab strip reads, e.g. "UGC Management": the PRD's own page title. */
    label: text('label').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    position: integer('position').notNull(),
  },
  (table) => [
    index('interface_pages_brand_id_idx').on(table.brandId),
    // The config is always read as "this brand's pages in order", never as a global scan.
    index('interface_pages_brand_position_idx').on(table.brandId, table.position),
  ],
);

/**
 * One field of one configured page. `field_name` is the stable KEY the interface renders against
 * (`hook_examples`), `label` is what the client reads ("Hook examples"); the key never changes when
 * a brand renames a label. Branded on its own `brand_id` as well as through its page, so a scoped
 * read of the fields is a single index scan and cannot be widened by a bad join.
 */
export const interfaceFields = pgTable(
  'interface_fields',
  {
    ...baseColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    pageId: uuid('page_id')
      .notNull()
      .references(() => interfacePages.id),
    fieldName: text('field_name').notNull(),
    label: text('label').notNull(),
    visible: boolean('visible').notNull().default(true),
    clientEditable: boolean('client_editable').notNull().default(false),
    position: integer('position').notNull(),
  },
  (table) => [
    index('interface_fields_brand_id_idx').on(table.brandId),
    index('interface_fields_page_id_idx').on(table.pageId),
  ],
);

export type InterfacePage = typeof interfacePages.$inferSelect;
export type NewInterfacePage = typeof interfacePages.$inferInsert;
export type InterfaceField = typeof interfaceFields.$inferSelect;
export type NewInterfaceField = typeof interfaceFields.$inferInsert;
