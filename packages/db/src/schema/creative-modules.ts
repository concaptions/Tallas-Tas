import { index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns, propagationColumns } from '../columns';
import { angles } from './angles';
import { brands } from './brands';
import { creativeBriefs } from './briefs';

/**
 * "(Internal) Creative Modules" (Airtable `tblzS73a9JrJGiV2J` in the live Gratsi base): a per-brand
 * grouping of briefs around one creative pattern, with a Foreplay board as its reference. Not the
 * global `themes` library (CLAUDE.md non-negotiable 3) — a module belongs to one brand, links to that
 * brand's angles and briefs, and is seeded from the parent template like every other content table.
 * The audit (`docs/audits/airtable-module-gap-2026-10-01.md` §2.4) found 225 of 390 live briefs
 * linked to a module, so this is live data the importer was dropping.
 *
 * Airtable's four fields map one to one: "Module Name" (`fld2r3Lk543QCAO9v`, the primary field, the
 * only value Airtable guarantees) → `module_name`; "Foreplay Link" (url) → `foreplay_link`; the two
 * record links become the junctions below. The table has no formula or lookup fields, so nothing is
 * deliberately left unstored.
 */
export const creativeModules = pgTable(
  'creative_modules',
  {
    ...baseColumns(),
    ...propagationColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    moduleName: text('module_name').notNull(),
    foreplayLink: text('foreplay_link'),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('creative_modules_brand_id_idx').on(table.brandId),
    index('creative_modules_template_row_id_idx').on(table.templateRowId),
  ],
);

/**
 * Many-to-many: module↔angle. The Airtable field is NAMED "Concepts" (`fldunlpoQGY11lZSM`) but its
 * `linkedTableId` is `tblRlcp1ibmS7U7HG`, which is the Gratsi ANGLES table (the audit's §4 table-ID
 * swap: the template base calls that table "Concepts"). The link therefore lands on `angles`, not on
 * `concepts`, and an importer that resolves it by field name would point at the wrong table.
 */
export const creativeModuleAngles = pgTable(
  'creative_module_angles',
  {
    moduleId: uuid('module_id')
      .notNull()
      .references(() => creativeModules.id, { onDelete: 'cascade' }),
    angleId: uuid('angle_id')
      .notNull()
      .references(() => angles.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.moduleId, table.angleId] })],
);

/**
 * Many-to-many: module↔brief, Airtable "(Internal) Creative Design" (`fldQLfh7IVuO9C4Wi`, the inverse
 * of the briefs table's "Creative Module" link `fldHVK7SA06iJiOoM`). A brief can sit in several
 * modules and a module holds many briefs; the brief page reads the same rows back the other way.
 */
export const creativeModuleDesigns = pgTable(
  'creative_module_designs',
  {
    moduleId: uuid('module_id')
      .notNull()
      .references(() => creativeModules.id, { onDelete: 'cascade' }),
    briefId: uuid('brief_id')
      .notNull()
      .references(() => creativeBriefs.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.moduleId, table.briefId] })],
);

export type CreativeModule = typeof creativeModules.$inferSelect;
export type NewCreativeModule = typeof creativeModules.$inferInsert;
export type CreativeModuleAngle = typeof creativeModuleAngles.$inferSelect;
export type CreativeModuleDesign = typeof creativeModuleDesigns.$inferSelect;
