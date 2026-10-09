import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { baseColumns, propagationColumns } from '../columns';
import { brands } from './brands';
import { creativeBriefs } from './briefs';
import type {
  ClientApprovalStatusKey,
  CreativeSheetInternalStatusesKey,
  CreativeSheetStatusesKey,
  CreativeSheetWinningKey,
} from './enums';

/**
 * FROZEN since the single-source cutover (2026-10-09, `docs/decisions.md`): the Creative Sheet is a
 * view over `creative_briefs`, migration 0061 moved this table's client work onto the briefs, and
 * NO code reads or writes it any more — `frozen-tables.test.ts` enforces that. The table and its
 * 378 production rows stay until Talal confirms the drop, which is a later migration; never a
 * `DROP TABLE` or a `DELETE` here. The description below is the history.
 *
 * "Creative Sheet" (Airtable `tblGC0TxnHI7lKaNQ` in the live Gratsi base): one row per creative on
 * the month's client-facing sheet. It is NOT a view over `creative_briefs` — 13 of its 29 fields are
 * stored on the sheet row itself (a second copy of the brief's internal status, client status, QA
 * flags and spell-check, plus Used / Denied / Winning / the client's comments), so a sheet row can
 * and does diverge from its brief (`docs/audits/airtable-module-gap-2026-10-01.md` §2.3). 339 of
 * 390 live briefs link to a sheet row.
 *
 * `brief_id` is the "Creative Name" link (`fldoKpIeYfbCvg3cg`, inverse of the briefs table's
 * "Creative Sheet" `fldPE3RGvdtkElz2F`). It is NULLABLE: Airtable lets a sheet row exist with the
 * link empty, and the importer must be able to land a row before its brief resolves. The same
 * rule as `creative_briefs.concept_id` (CLAUDE.md non-negotiable 5).
 *
 * NO stored name. Airtable's primary field "Name" (`fldkavcvPyLDyyG6R`) is the formula
 * `DATETIME_FORMAT({Created}, "MMMM") & "-" & {Creative Name}` — the month the row was created
 * and the linked brief's name, e.g. `September-TV50-Cooking and Wine-V2`. The query layer computes
 * it from `created_at` and the joined brief's `name`; storing it would make the month drift from
 * `created_at` and the suffix drift from the brief (CLAUDE.md non-negotiable 6: names are never
 * hand typed). "Created" and "Last Modified" are `created_at` / `updated_at` from `baseColumns()`.
 *
 * The 16 lookups through "Creative Name" are deliberately NOT stored; each is a join on
 * `creative_briefs` (and, where noted, one hop further):
 *   - "Performance (from Creative Name)" → `creative_briefs.performance`
 *   - "(Internal) Product (from Creative Name)" → `creative_briefs.product_id` → `products`
 *   - "Angle (from Creative Name)" → `creative_briefs.angle_id` → `angles`
 *   - "Concepts (from Angle) (from Creative Name)" → `creative_briefs.angle_id` → `concept_angles`
 *   - "Elements we are Testing" → `creative_briefs.elements_tested`
 *   - "Design File (from Creative Name)" → `creative_briefs.design_file`
 *   - "Design Link URL" → `creative_briefs.design_file_url`
 *   - "Collection" → `creative_briefs.collection_id` → `collections` (the Airtable lookup is
 *     `isValid: false`, its source field was deleted; the join is what it meant)
 *   - "Platform" → `creative_briefs.platform`
 *   - "Funnel" → `creative_briefs.funnel`
 *   - "Type" → `creative_briefs.type`
 *   - "Proposed Copy" → `copywriting.creative_brief_id` (also `isValid: false` in Airtable)
 *   - "Creative Module" → `creative_module_designs` → `creative_modules`
 *
 * `internal_status`, `status` and `winning` carry the KEYS of the vocabularies in `./enums`
 * (`creativeSheetInternalStatuses`, `creativeSheetStatuses`, `creativeSheetWinning`), nullable
 * because Airtable leaves the select empty on a fresh row. The sheet's "Status" has `denied` and
 * `revisions_submitted`, which the platform's `CLIENT_STATUS` does not; reconciling the two is a
 * domain decision for the importer, not a schema one. The six checkboxes are NOT NULL false, as on
 * `creative_briefs`: a checklist renders unticked boxes, never nulls. `spell_check_requested` is
 * Airtable's "Click for AI Spell Checker Again" trigger flag.
 */
export const creativeSheetItems = pgTable(
  'creative_sheet_items',
  {
    ...baseColumns(),
    ...propagationColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    briefId: uuid('brief_id').references(() => creativeBriefs.id),
    internalStatus: text('internal_status').$type<CreativeSheetInternalStatusesKey>(),
    status: text('status').$type<CreativeSheetStatusesKey>(),
    qaChecklistDoc: jsonb('qa_checklist_doc').$type<string[]>(),
    qaVideoEditor: boolean('qa_video_editor').notNull().default(false),
    qaDesigner: boolean('qa_designer').notNull().default(false),
    qaStrategist: boolean('qa_strategist').notNull().default(false),
    clientComments: text('client_comments'),
    used: boolean('used').notNull().default(false),
    deniedRevisionsNeeded: boolean('denied_revisions_needed').notNull().default(false),
    winning: text('winning').$type<CreativeSheetWinningKey>(),
    spellCheckRequested: boolean('spell_check_requested').notNull().default(false),
    spellingFeedback: text('spelling_feedback'),
    clientApprovalStatus: text('client_approval_status').$type<ClientApprovalStatusKey>(),
    clientApprovalNote: text('client_approval_note'),
    clientApprovalStatusUpdatedAt: timestamp('client_approval_status_updated_at', {
      withTimezone: true,
    }),
    /**
     * The ratios this creative ships in, mirroring `creative_briefs.dimensions` EXACTLY: a jsonb
     * `string[]` of §8 keys (`'4:5' | '1:1' | '9:16'`, `CREATIVE_DIMENSIONS` in `@tas/domain`) and,
     * on Airtable-imported rows, the NAMES of `(Internal) Creative Dimensions` records (migration
     * 0059). An array and not a single value because one creative ships in several ratios at once
     * (the §8 presets give a video 4:5 + 1:1 + 9:16); jsonb and not a junction because the
     * vocabulary is a closed set of keys plus a short tail of legacy names, which is exactly what
     * the brief column already holds — so the 0059 backfill is a plain copy, the two columns are
     * compared without a mapping layer, and the Creative Dimensions workspace it replaces is not
     * needed to read either. Stored on the sheet row, as the sheet's other brief-shaped fields are,
     * because a sheet row can diverge from its brief (`docs/audits/airtable-module-gap-2026-10-01.md`
     * §2.3). NOT NULL `[]`: a reader maps it without branching on null.
     */
    dimensions: jsonb('dimensions').$type<string[]>().notNull().default([]),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('creative_sheet_items_brand_id_idx').on(table.brandId),
    index('creative_sheet_items_template_row_id_idx').on(table.templateRowId),
    index('creative_sheet_items_brief_id_idx').on(table.briefId),
  ],
);

export type CreativeSheetItem = typeof creativeSheetItems.$inferSelect;
export type NewCreativeSheetItem = typeof creativeSheetItems.$inferInsert;
