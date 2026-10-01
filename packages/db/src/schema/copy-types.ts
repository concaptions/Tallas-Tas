import { index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns, propagationColumns } from '../columns';
import { brands } from './brands';
import { copywriting } from './copy';

/**
 * (Internal) Copy Type (Airtable `tblQiBPj9ypCmYxev`): the lookup list a copy row is tagged with —
 * "Name" (the primary field, always set) and "Description". Gratsi-parity work (gap audit
 * 2026-10-01 §2.13). PRD §5.11 says to DROP Copy Type, and `schema/copy.ts` with `copy.test.ts`
 * still hold that line for the `copywriting` table itself: this file adds NO `copy_type` column to
 * it. Types live here as rows and attach through junctions, so the lean copy table PRD §5.11 asks
 * for keeps its shape while a brand migrated from Airtable keeps its tags. The PRD deviation is
 * logged in `docs/decisions.md` by the orchestrator that assembles this migration.
 *
 * The two Airtable record links on this table are the INVERSE sides of links owned by the copy
 * tables and are not columns here: "Ads Copywriting copy" (→ Meta Copywriting) is
 * `copywriting_copy_types` below; "Copywriting" (→ Youtube Copywriting) is `youtube_copy_copy_types`
 * in `schema/youtube-copy.ts`. The table has no formula or lookup field.
 *
 * Branded and propagation-enabled like every other per-brand content table: seeded from the parent
 * template, `withBrand` scopes every read and write.
 */
export const copyTypes = pgTable(
  'copy_types',
  {
    ...baseColumns(),
    ...propagationColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    name: text('name').notNull(),
    description: text('description'),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('copy_types_brand_id_idx').on(table.brandId),
    index('copy_types_template_row_id_idx').on(table.templateRowId),
  ],
);

export type CopyType = typeof copyTypes.$inferSelect;
export type NewCopyType = typeof copyTypes.$inferInsert;

/**
 * Many-to-many: Meta Copywriting "Copy Type" (`tblZpBYPTcZcmQ1Kf`, multipleRecordLinks →
 * `tblQiBPj9ypCmYxev`). Owned by the copy side; the copy-type page reads the same rows back.
 */
export const copywritingCopyTypes = pgTable(
  'copywriting_copy_types',
  {
    copyId: uuid('copy_id')
      .notNull()
      .references(() => copywriting.id, { onDelete: 'cascade' }),
    copyTypeId: uuid('copy_type_id')
      .notNull()
      .references(() => copyTypes.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.copyId, table.copyTypeId] })],
);

export type CopywritingCopyType = typeof copywritingCopyTypes.$inferSelect;
