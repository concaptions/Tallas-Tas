import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns, propagationColumns } from '../columns';
import { brands } from './brands';

/**
 * Client Assets Organisation (Airtable TABLE 14): the FOLDER-level organiser — a named pointer at an
 * external location (a Google Drive folder, a Dropbox share) with a line of description. This is
 * deliberately a SEPARATE table from `assets`, which stores individual uploaded FILES with a
 * content type and a byte size; conflating the two was the open question the 2026-09-29 sprint spec
 * resolved. A brief links to the folders its material lives in through `brief_asset_folders`
 * (Airtable's "(Internal) Creative Design" inverse of the briefs "Assets" field).
 *
 * Branded and propagation-enabled like every other per-brand content table: seeded from the parent
 * template, `withBrand` scopes every read and write.
 */
export const clientAssetFolders = pgTable(
  'client_asset_folders',
  {
    ...baseColumns(),
    ...propagationColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    name: text('name').notNull(),
    description: text('description'),
    locationUrl: text('location_url'),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('client_asset_folders_brand_id_idx').on(table.brandId),
    index('client_asset_folders_template_row_id_idx').on(table.templateRowId),
  ],
);

export type ClientAssetFolder = typeof clientAssetFolders.$inferSelect;
export type NewClientAssetFolder = typeof clientAssetFolders.$inferInsert;
