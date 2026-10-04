import { and, eq, inArray, isNull } from 'drizzle-orm';

import { upsertColumnDefinition, type UpsertColumnDefinition } from './column-definitions';
import type { Db } from './db';
import { brands, columnDefinitions } from './schema';

/**
 * THE seed of `column_definitions` — the parent's master column set, and each child's departures
 * from it (`docs/audits/inheritance-plan-2026-10-02.md`).
 *
 * TWO NAMING WORLDS, DELIBERATELY KEPT APART. Parent rows carry the TEMPLATE base's own field names
 * (`appnaSGAgOUbJ0f9m`: "Demographic", "Core Desires (Cashvertising)"). Child rows carry that
 * child's names ("Description [Age Status Salary]", "Drivers for this persona"). They are NOT taken
 * from `TABLE_MAPPINGS`, which is Gratsi's naming throughout — seeding the parent from it would
 * leave 14 of the 15 parent Personas fields unmapped and produce an almost-empty parent.
 *
 * `columnKey` is the Postgres column, or a junction table for a link column, and never changes; a
 * label is a per-base display fact.
 */
/**
 * Which base a seed group applies to. A discriminated union rather than `'parent' | string`, which
 * collapses to plain `string` and loses the very distinction the seed turns on.
 */
export type SeedTarget =
  { readonly kind: 'parent' } | { readonly kind: 'slug'; readonly slug: string };

export interface BrandColumnSeed {
  /** `parent` resolves to whichever brand carries `is_template`; `slug` names a child directly. */
  readonly target: SeedTarget;
  readonly rows: readonly UpsertColumnDefinition[];
}

/**
 * Personas. The parent's fifteen fields in the order the Airtable metadata returns them, which is
 * what `display_order` seeds from.
 */
const PERSONAS_PARENT: readonly UpsertColumnDefinition[] = [
  {
    tableKey: 'personas',
    columnKey: 'name',
    displayLabel: 'Persona Name',
    displayOrder: 1,
    fieldType: 'multilineText',
  },
  {
    tableKey: 'personas',
    columnKey: 'day_in_the_life',
    displayLabel: 'A Day in the Life',
    displayOrder: 2,
    fieldType: 'multilineText',
  },
  {
    tableKey: 'personas',
    columnKey: 'demographic',
    displayLabel: 'Demographic',
    displayOrder: 3,
    fieldType: 'multilineText',
  },
  {
    tableKey: 'personas',
    columnKey: 'psychographic',
    displayLabel: 'Psychographic',
    displayOrder: 4,
    fieldType: 'multilineText',
  },
  {
    tableKey: 'personas',
    columnKey: 'core_desires',
    displayLabel: 'Core Desires (Cashvertising)',
    displayOrder: 5,
    fieldType: 'multilineText',
  },
  {
    tableKey: 'personas',
    columnKey: 'emotional_triggers',
    displayLabel: 'Emotional Triggers (Cashvertising)',
    displayOrder: 6,
    fieldType: 'multilineText',
  },
  {
    tableKey: 'personas',
    columnKey: 'pain_points',
    displayLabel: 'Pain Points (Cashvertising)',
    displayOrder: 7,
    fieldType: 'multilineText',
  },
  {
    tableKey: 'personas',
    columnKey: 'success_factors',
    displayLabel: 'Success Factors (Buyer Personas)',
    displayOrder: 8,
    fieldType: 'multilineText',
  },
  {
    tableKey: 'personas',
    columnKey: 'perceived_barriers',
    displayLabel: 'Perceived Barriers (Buyer Personas)',
    displayOrder: 9,
    fieldType: 'multilineText',
  },
  {
    tableKey: 'personas',
    columnKey: 'stage_of_awareness',
    displayLabel: 'Stage of Market Awareness (Breakthrough Advertising)',
    displayOrder: 10,
    fieldType: 'singleSelect',
  },
  {
    tableKey: 'personas',
    columnKey: 'buying_triggers',
    displayLabel: 'Buying Triggers (Breakthrough Advertising)',
    displayOrder: 11,
    fieldType: 'multilineText',
  },
  {
    tableKey: 'personas',
    columnKey: 'problem_challenge',
    displayLabel: 'Problem/Challenge (StoryBrand)',
    displayOrder: 12,
    fieldType: 'multilineText',
  },
  {
    tableKey: 'personas',
    columnKey: 'success_transformation',
    displayLabel: 'Success/Transformation (StoryBrand)',
    displayOrder: 13,
    fieldType: 'multilineText',
  },
  {
    tableKey: 'personas',
    columnKey: 'trigger_words',
    displayLabel: 'Trigger Words (Mindstates)',
    displayOrder: 14,
    fieldType: 'multilineText',
  },
  {
    tableKey: 'personas',
    columnKey: 'angle_personas',
    displayLabel: 'Angles',
    displayOrder: 15,
    fieldType: 'multipleRecordLinks',
  },
];

/**
 * Gratsi's Personas departures. Six detached relabels, one child-added column, and nine parent
 * columns hidden because the Gratsi base has no field for them.
 *
 * Hiding is per base and never a drop: Niagara populates all nine on all three of its personas, and
 * `personas.product_id` needs no row at all — the parent base has no Product field, so no parent row
 * exists and the resolver never emits it.
 */
const PERSONAS_GRATSI: readonly UpsertColumnDefinition[] = [
  {
    tableKey: 'personas',
    columnKey: 'name',
    displayLabel: 'Name',
    displayOrder: 1,
    isDetached: true,
  },
  {
    tableKey: 'personas',
    columnKey: 'demographic',
    displayLabel: 'Description [Age Status Salary]',
    displayOrder: 2,
    isDetached: true,
  },
  {
    tableKey: 'personas',
    columnKey: 'psychographic',
    displayLabel: 'Personality',
    displayOrder: 3,
    isDetached: true,
  },
  {
    tableKey: 'personas',
    columnKey: 'core_desires',
    displayLabel: 'Drivers for this persona',
    displayOrder: 4,
    isDetached: true,
  },
  {
    tableKey: 'personas',
    columnKey: 'passion',
    displayLabel: 'Passion',
    displayOrder: 5,
    isDetached: true,
    source: 'custom',
    fieldType: 'richText',
  },
  {
    tableKey: 'personas',
    columnKey: 'stage_of_awareness',
    displayLabel: 'Problem-Solution Awareness Level',
    displayOrder: 6,
    isDetached: true,
    fieldType: 'singleSelect',
  },
  {
    tableKey: 'personas',
    columnKey: 'angle_personas',
    displayLabel: 'Angles',
    displayOrder: 7,
    isDetached: true,
    fieldType: 'multipleRecordLinks',
  },
  ...(
    [
      'day_in_the_life',
      'emotional_triggers',
      'pain_points',
      'success_factors',
      'perceived_barriers',
      'buying_triggers',
      'problem_challenge',
      'success_transformation',
      'trigger_words',
    ] as const
  ).map((columnKey, index): UpsertColumnDefinition => ({
    tableKey: 'personas',
    columnKey,
    // The label is irrelevant to a hidden row; the parent's stays authoritative if it is ever shown.
    displayLabel: columnKey,
    displayOrder: 100 + index,
    isHidden: true,
    isDetached: true,
  })),
];

/**
 * THE REMAINING TWENTY TABLES, in a compact form.
 *
 * `PERSONAS_PARENT` / `PERSONAS_GRATSI` above stay in longhand: they are the worked example, and a
 * reader meeting `column_definitions` for the first time should see one row spelled out. The other
 * twenty tables carry 291 rows between them, which in that longhand is two thousand lines of object
 * literal — unreadable, and impossible to diff against the audit tables it is transcribed from. So
 * they are tuples in the audits' own column order, one line per column, built by the two functions
 * below into exactly the same `UpsertColumnDefinition` shape.
 *
 * Every row here is transcribed from `docs/audits/overnight-parent-columns.md` (the parent's field
 * order, which is what `display_order` is) and `docs/audits/overnight-gratsi-columns.md` (Gratsi's
 * INHERIT / DETACH-RELABEL / CHILD-ADDED / DERIVED / AMBIGUOUS verdicts). Nothing here was fetched
 * from Airtable and nothing came from `TABLE_MAPPINGS`.
 *
 * THREE RULES THE TRANSCRIPTION OBEYS, so a reviewer can check it against the audits:
 *
 *  1. A DERIVED field — Airtable lookup, rollup, formula, Airtable system field, or the inverse side
 *     of a link the other table owns — gets NO row. It is computed at read time
 *     (`packages/db/src/formulas/`). The twelve `isValid:false` parent lookups of
 *     `DONT USE Creative Sheet` seed nothing at all (`docs/decisions/overnight-dead-lookups.md`).
 *  2. A field with no Postgres column and no derivation is AMBIGUOUS: it gets a HIDDEN row under the
 *     sentinel key below plus a line in `docs/decisions/overnight-ambiguous-fields.md`, and is never
 *     guessed into a neighbouring column. That guess is what put Gratsi's `Passion` into
 *     `core_desires` and displaced `Drivers for this persona`. The same decision doc records every
 *     place the two audits name different columns for the same field, and which reading won.
 *  3. A LINK column is keyed by its junction table (`angle_personas`), a scalar by its Postgres
 *     column (`demographic`). Both are stable; the label is the per-base display fact.
 *
 * NOT HERE, AND DELIBERATELY: `themes`. The real themes table is Gratsi's `tbl1aFLMJXxhdVKiz`; the
 * parent id of that name is Creative Modules. Themes is a GLOBAL library (CLAUDE.md non-negotiable
 * 3) and is not in `PROPAGATION_TABLES`, so it has no legal `table_key` — the audit classifies its
 * six fields and declines to assign one. Seeding it needs that owner decision first, so Themes has
 * no parent rows and no child rows here, and its absence is not a gap.
 */

/**
 * One parent column: the stable key, the parent base's own label, the Airtable field index, the
 * Airtable field type. The index is the API's 1-based field order, kept verbatim — gaps are where a
 * DERIVED field was skipped, and keeping them means a later unskip lands in the right place.
 */
type ParentColumn = readonly [
  columnKey: string,
  displayLabel: string,
  displayOrder: number,
  fieldType: string,
];

function parentRows(
  tableKey: string,
  columns: readonly ParentColumn[],
): readonly UpsertColumnDefinition[] {
  return columns.map(([columnKey, displayLabel, displayOrder, fieldType]) => ({
    tableKey,
    columnKey,
    displayLabel,
    displayOrder,
    fieldType,
  }));
}

/**
 * How a child row departs from the parent, in the audit's own vocabulary:
 *
 * - `relabel` — DETACH-RELABEL. The parent's column under this base's label. `source` stays
 *   `parent`, because the column is the parent's.
 * - `custom` — CHILD-ADDED. A column this base has and the parent's definition does not.
 * - `hidden` — a parent column this base's Airtable has no field for. Hidden, never dropped: the
 *   data stays in the table and another brand still shows it. `source` stays `parent`: there IS a
 *   parent row, and un-hiding the column puts the template's own column back.
 * - `hidden-custom` — hidden AND child-added, which is a different claim and the one the law makes
 *   about an AMBIGUOUS field: *"an AMBIGUOUS field becomes a HIDDEN child-added row"*
 *   (`docs/audits/overnight-gratsi-columns.md`, AMBIGUOUS section: *"seed it as `is_hidden = true`,
 *   `source = 'custom'`"*). `hidden` would be wrong for it, because `source: 'parent'` means
 *   "part of the master set" (`schema/column-definitions.ts`) and no parent row for the key exists —
 *   on `youtube_copy` the parent base has no rows at all — so an admin un-hiding it would be told it
 *   follows a template column that is not there.
 *
 * All four are detached. A relabel that still tracked the parent would lose its label on the next
 * parent edit; a child-added column has no parent row to track; a hidden row exists precisely to
 * stop following the parent. A hidden row keeps the PARENT's `display_order` so that un-hiding it
 * puts the column back where the template has it.
 *
 * - `relabel-platform` — a relabel of a column the PLATFORM owns. Same as `relabel` in every
 *   respect except that it keeps `source: 'platform'`, because who owns a column is not something
 *   relabelling it changes. Without this kind a child's relabel would write `parent` and that brand
 *   would stop being told the platform defines the column — the same hole `sourceForWrite` closes on
 *   the admin's write path (`apps/web/src/app/app/column-admin/fields.ts`), closed here too so the
 *   seed and the admin cannot disagree.
 */
type ChildKind = 'relabel' | 'relabel-platform' | 'custom' | 'hidden' | 'hidden-custom';

type ChildColumn = readonly [
  columnKey: string,
  displayLabel: string,
  displayOrder: number,
  kind: ChildKind,
  fieldType: string,
];

/**
 * Every column of a table the PARENT BASE DOES NOT HAVE AT ALL.
 *
 * Six tables are in this position — `copy_types`, `creative_reporting`, `email_campaigns`,
 * `email_flows`, `sm_campaign_feed_tasks`, `youtube_copy` — because the parent template base has
 * only 15 tables and none of these six is among them. There is no Airtable field on the parent to
 * inherit from, so the PLATFORM owns every column, and the parent row set is entirely `platform`.
 *
 * Without these rows a resolver-driven page renders an EMPTY grid for every brand except Gratsi,
 * which is the whole reason the six were blocked. Labels and order come from the Gratsi base's own
 * field names and field order, because for a table the parent base does not have that is the only
 * evidence there is; a brand that wants different wording detaches and relabels.
 *
 * `formula` names the function that computes a column with nothing stored behind it; omit it and the
 * column is stored.
 */
function platformRows(
  tableKey: string,
  columns: readonly (readonly [
    columnKey: string,
    displayLabel: string,
    displayOrder: number,
    fieldType: string,
    formula?: string,
  ])[],
): readonly UpsertColumnDefinition[] {
  return columns.map(([columnKey, displayLabel, displayOrder, fieldType, formula]) => ({
    tableKey,
    columnKey,
    displayLabel,
    displayOrder,
    fieldType,
    source: 'platform' as const,
    ...(formula === undefined ? {} : { formula }),
  }));
}

function childRows(
  tableKey: string,
  columns: readonly ChildColumn[],
): readonly UpsertColumnDefinition[] {
  return columns.map(([columnKey, displayLabel, displayOrder, kind, fieldType]) => ({
    tableKey,
    columnKey,
    displayLabel,
    displayOrder,
    isDetached: true,
    isHidden: kind === 'hidden' || kind === 'hidden-custom',
    // A child-added column carries `custom` whether it is shown or hidden; only a row that really
    // has a parent counterpart may claim `parent`; and a relabel of a platform column stays
    // `platform`, since relabelling does not transfer ownership.
    source:
      kind === 'custom' || kind === 'hidden-custom'
        ? ('custom' as const)
        : kind === 'relabel-platform'
          ? ('platform' as const)
          : ('parent' as const),
    fieldType,
  }));
}

/**
 * The one `column_key` in this seed that is NOT a Postgres column or a junction table.
 *
 * Both copy tables carry an Airtable field literally named `⚠️ Please Change the Status of the copy`
 * — a banner the Airtable interface draws, not data. It is the pair of AMBIGUOUS findings: a stored
 * Airtable type, no Postgres column, no link and no formula. The law says such a field becomes a
 * HIDDEN child-added row plus a decision line, never a guess into an existing column, so it is
 * keyed by this sentinel and seeded `hidden-custom`: hidden, and `source: 'custom'` because there is
 * no parent row for it anywhere. `column-seed.test.ts` asserts that every OTHER key in the seed
 * resolves to a real column or a junction OF ITS OWN TABLE, that this one never reaches a resolved
 * column list, and that the stored row on each copy table carries `source: 'custom'`.
 */
export const UNMAPPED_COLUMN_KEY = 'airtable_status_banner';

/** `Copywriting` `tblZpBYPTcZcmQ1Kf` — 11 fields; 1 formula and 2 reverse/counter fields skipped. */
const COPYWRITING_PARENT = parentRows('copywriting', [
  ['creative_brief_id', 'Creative', 2, 'multipleRecordLinks'],
  ['status', 'Status', 3, 'singleSelect'],
  ['product_id', 'Product', 5, 'multipleRecordLinks'],
  ['primary_copy', 'Primary Copy', 6, 'richText'],
  ['headline', 'Headline', 7, 'multilineText'],
  ['link_description', 'News Feed / Link Description', 8, 'multilineText'],
  ['cta', 'CTA', 9, 'singleSelect'],
  ['used', 'USED', 10, 'checkbox'],
]);

/** Gratsi `Meta Copywriting` — 30 fields: 7 inherit, 2 relabel, 6 added, 14 derived, 1 ambiguous. */
const COPYWRITING_GRATSI = childRows('copywriting', [
  ['primary_copy', 'Descriptions', 6, 'relabel', 'richText'],
  ['link_description', 'News Feed', 8, 'relabel', 'singleLineText'],
  ['copywriting_campaigns', 'Campaign Code', 10, 'custom', 'multipleRecordLinks'],
  ['funnel', 'Funnel', 14, 'custom', 'singleSelect'],
  ['copywriting_copy_types', 'Copy Type', 15, 'custom', 'multipleRecordLinks'],
  ['client_comment', "Client's Comment", 16, 'custom', 'multilineText'],
  ['winning', 'Winning', 21, 'custom', 'checkbox'],
  ['meta_rating', 'Meta Rating', 22, 'custom', 'rating'],
  [
    UNMAPPED_COLUMN_KEY,
    '⚠️ Please Change the Status of the copy',
    29,
    'hidden-custom',
    'singleLineText',
  ],
]);

/**
 * `Creative Sheet (Internal & Interface)` `tblhU5yVNhVDwykUt` — 35 fields. `Inspiration` (field 19,
 * richText) has NO row: the only column it could take, `inspiration_image`, belongs to field 20 on
 * the evidence both audits agree on, and nothing in the engine writes `creative_briefs.inspiration`
 * (anomaly A5). It is a decision-doc line, not a guess.
 */
const CREATIVE_BRIEFS_PARENT = parentRows('creative_briefs', [
  ['name', 'Name', 1, 'singleLineText'],
  ['concept_id', 'Concept', 2, 'multipleRecordLinks'],
  ['source', 'Source', 3, 'singleSelect'],
  ['funnel', 'Funnel', 4, 'singleSelect'],
  ['type', 'Type', 5, 'singleSelect'],
  ['angle_id', 'Angle', 7, 'multipleRecordLinks'],
  ['performance', 'Performance', 8, 'singleSelect'],
  ['priority', 'Priority', 9, 'singleSelect'],
  ['client_status', 'Client Status', 10, 'singleSelect'],
  ['internal_status', 'Internal Status', 11, 'singleSelect'],
  ['elements_tested', 'Elements we are Testing', 12, 'richText'],
  ['qa_checklist_doc', 'QA Checklist Doc', 13, 'multipleAttachments'],
  ['qa_video_editor', 'Video Editor QA', 14, 'checkbox'],
  ['qa_designer', 'Graphic Designer QA', 15, 'checkbox'],
  ['qa_strategist', 'Creative Strategist QA', 16, 'checkbox'],
  ['design_file', 'Design File', 17, 'multipleAttachments'],
  ['design_file_url', 'Design Link URL', 18, 'singleLineText'],
  ['inspiration_image', 'Inspiration Image', 20, 'multipleAttachments'],
  ['brief_to_design', 'Brief', 21, 'richText'],
  ['ad_content', 'Ad Content', 22, 'richText'],
  ['product_id', '(Internal) Product', 23, 'multipleRecordLinks'],
  ['collection_id', 'Collection', 24, 'multipleRecordLinks'],
  ['campaign_offer_id', 'Campaigns & Offers', 25, 'multipleRecordLinks'],
  ['platform', 'Platform', 26, 'multipleSelects'],
  ['dimensions', 'Dimensions', 27, 'multipleRecordLinks'],
  ['asset_id', 'Assets', 28, 'multipleRecordLinks'],
  ['click_for_ai_spell_checker', 'Click for AI Spell Checker Again', 30, 'checkbox'],
  ['spelling_feedback', 'Spelling Feedback', 31, 'multilineText'],
  ['assignee', 'Assignee', 32, 'singleCollaborator'],
  // The trailing space is the live field name; the engine reads it with the space intact.
  ['script_and_brief_breakdown', 'Script & brief breakdown ', 35, 'multipleAttachments'],
]);

/**
 * PLATFORM COLUMNS on `creative_briefs`, for the reason `CONCEPTS_PLATFORM` gives: a resolver-driven
 * page renders exactly what the resolver returns, so a column this platform owns and no Airtable
 * base defines DISAPPEARS unless it is seeded.
 *
 * `due_date` is the one such column the grid draws, and it is the platform's — neither base has a
 * Due Date field (both field lists are transcribed above and carry none); it arrived with migration
 * `0043_brief-due-date.sql`. Seeded on the PARENT so every brand inherits one definition, ordered 40
 * past the parent's Airtable range (1-35) and Gratsi's highest (36) the way the Concepts and Angles
 * platform blocks are, so no base's own field order shifts.
 */
const CREATIVE_BRIEFS_PLATFORM = platformRows('creative_briefs', [
  ['due_date', 'Due Date', 40, 'date'],
]);

/**
 * Gratsi `Creative Design (Internal & Interface)` — 42 fields, the strongest pairing in the base:
 * 25 inherit on an identical name.
 *
 * TWO DEPARTURES FROM THE GRATSI AUDIT'S TABLE, both because its `column_key` contradicts the
 * parent audit's column for the same parent field, and both written up in
 * `docs/decisions/overnight-ambiguous-fields.md`:
 *
 *  - `Script / Ad Content` is CUSTOM, not a relabel. The audit keys it `script_content` while
 *    calling it a relabel of the parent's `Ad Content`, which the parent audit pairs with
 *    `ad_content`. Two different columns cannot be one relabel, so Gratsi gets its own
 *    `script_content` row and `ad_content` is hidden for Gratsi.
 *  - `Inspiration` relabels `inspiration_image`, which is the column the engine writes for it.
 */
/**
 * GRATSI-MATCH (2026-10-04): the live base's 42 fields at the live base's own positions. Inherited
 * rows carry the PARENT base's field order, which is why the audit recorded "ORDER DIVERGES" —
 * every column whose Gratsi position differs now holds a Gratsi row at that position (same label
 * where the bases agree). Three columns need no row at all, because name and position already
 * match: `name` (1), `design_file` (17), `design_file_url` (18).
 *
 * The additions, all display-only:
 * - `creative_module_designs` (28), `creative_sheet_items` (37) and `copywriting` (39) are the
 *   REVERSE sides of `creative_module_designs`, `creative_sheet_items.brief_id` and
 *   `copywriting.creative_brief_id` — Airtable's `Creative Module`, `Creative Sheet` and
 *   `Meta Copywriting` link fields, keyed by the table that points back at `creative_briefs`.
 * - `updated_at` (29) and `created_at` (30) display the shared columns under Airtable's
 *   `Last Modified` / `Created` system-field names (diff annotation 3 — no migration).
 * - `concepts_from_angles` (42) is VIRTUAL — the `Concepts (from Angles)` lookup, computed by
 *   `briefConceptsFromAngles` through the brief's angle into `concept_angles`; declared below the
 *   list because a virtual row carries a formula the five-tuple cannot.
 * - `due_date` (43) keeps the AI-49 platform column VISIBLE, placed after the Airtable range: the
 *   strict rule would call it a leak, but AI-49 is Talal's own ask, so the standing ruling wins
 *   pending a new one (docs/decisions.md, GRATSI-MATCH entry).
 *
 * NOT here, each a decision-doc flag (same entry): `Created 2` (34, second createdTime),
 * `(Internal) Collections 2` (35, residual text), `Ads Copywriting copy` (38 — the duplicate
 * copy-table link pair's unread half; its stored side does not exist and the copywriting side
 * belongs to the copy track), `Angles` (41, residual text).
 */
const CREATIVE_BRIEFS_GRATSI = childRows('creative_briefs', [
  ['type', 'Type', 2, 'relabel', 'singleSelect'],
  ['priority', 'Priority', 3, 'relabel', 'singleSelect'],
  ['internal_status', 'Internal Status', 4, 'relabel', 'singleSelect'],
  ['client_status', 'Client Status', 5, 'relabel', 'singleSelect'],
  ['performance', 'Performance', 6, 'relabel', 'singleSelect'],
  ['assignee', 'Assignee', 7, 'relabel', 'singleCollaborator'],
  ['batch', 'Batch', 8, 'custom', 'singleSelect'],
  ['qa_checklist_doc', 'QA Checklist Doc', 9, 'relabel', 'multipleAttachments'],
  ['qa_video_editor', 'Video Editor QA', 10, 'relabel', 'checkbox'],
  ['qa_designer', 'Graphic Designer QA', 11, 'relabel', 'checkbox'],
  ['qa_strategist', 'Creative Strategist QA', 12, 'relabel', 'checkbox'],
  ['angle_id', 'Angle', 13, 'relabel', 'multipleRecordLinks'],
  ['concept_id', 'Concept', 14, 'relabel', 'multipleRecordLinks'],
  ['product_id', '(Internal) Product', 15, 'relabel', 'multipleRecordLinks'],
  ['language', 'Language', 16, 'custom', 'singleSelect'],
  ['inspiration_image', 'Inspiration', 19, 'relabel', 'multipleAttachments'],
  ['brief_to_design', 'Brief to Design/Editing', 20, 'relabel', 'richText'],
  ['script_content', 'Script / Ad Content', 21, 'custom', 'richText'],
  ['platform', 'Platform', 22, 'relabel', 'multipleSelects'],
  ['dimensions', 'Dimensions', 23, 'relabel', 'multipleRecordLinks'],
  ['source', 'Source', 24, 'relabel', 'singleSelect'],
  ['funnel', 'Funnel', 25, 'relabel', 'singleSelect'],
  ['elements_tested', 'Elements we are Testing', 26, 'relabel', 'richText'],
  ['offer', 'Offer', 27, 'custom', 'richText'],
  ['creative_module_designs', 'Creative Module', 28, 'custom', 'multipleRecordLinks'],
  ['updated_at', 'Last Modified', 29, 'custom', 'lastModifiedTime'],
  ['created_at', 'Created', 30, 'custom', 'createdTime'],
  ['click_for_ai_spell_checker', 'Click for AI Spell Checker Again', 31, 'relabel', 'checkbox'],
  ['spelling_feedback', 'Spelling Feedback', 32, 'relabel', 'multilineText'],
  ['spelling_feedback_2', 'Spelling Feedback 2', 33, 'custom', 'multilineText'],
  ['collection_id', '(Internal) Collections 3', 36, 'relabel', 'multipleRecordLinks'],
  ['creative_sheet_items', 'Creative Sheet', 37, 'custom', 'multipleRecordLinks'],
  ['copywriting', 'Meta Copywriting', 39, 'custom', 'multipleRecordLinks'],
  // The trailing space is the live field name, exactly as the parent row carries it.
  ['script_and_brief_breakdown', 'Script & brief breakdown ', 40, 'relabel', 'multipleAttachments'],
  ['due_date', 'Due Date', 43, 'relabel-platform', 'date'],
  ['ad_content', 'Ad Content', 22, 'hidden', 'richText'],
  ['campaign_offer_id', 'Campaigns & Offers', 25, 'hidden', 'multipleRecordLinks'],
  ['asset_id', 'Assets', 28, 'hidden', 'multipleRecordLinks'],
]);

/**
 * The one VIRTUAL row of the Gratsi briefs set: Airtable's `Concepts (from Angles)` lookup
 * (field 42). `source: 'custom'` because the Gratsi base defines the field and the parent's
 * definition does not; `formula` names the registered reading, so the gate proves it exists and
 * `storedColumns` keeps every write path away from it.
 */
const CREATIVE_BRIEFS_GRATSI_VIRTUAL: readonly UpsertColumnDefinition[] = [
  {
    tableKey: 'creative_briefs',
    columnKey: 'concepts_from_angles',
    displayLabel: 'Concepts (from Angles)',
    displayOrder: 42,
    fieldType: 'multipleLookupValues',
    source: 'custom',
    isDetached: true,
    formula: 'briefConceptsFromAngles',
  },
];

/**
 * `Concepts` `tblRlcp1ibmS7U7HG` — 22 fields, 8 of them lookups and 1 a formula.
 *
 * `Name` (field 1) is a FORMULA in the parent — `{Batch} & "-" & {Angles} & "-" & {Themes}`, the
 * concept name of CLAUDE.md non-negotiable 6 — so under rule 1 it gets no row even though
 * `concepts.name` is a stored, displayed column. That consequence is a decision-doc line.
 * `Themes` (field 3) gets no row either: the parent's link points at the table LABELLED `Themes`
 * which is Creative-Modules shaped, and the parent audit could not establish its junction.
 */
/**
 * PLATFORM COLUMNS: the ones this platform owns and Airtable has no field for.
 *
 * Every other row in this seed describes an Airtable field, because the seed was read off the two
 * bases. That leaves a hole: the platform adds columns of its own, and a page that starts reading
 * its columns from `resolveColumns` renders exactly what the resolver returns — so a column the
 * seed never mentions DISAPPEARS the moment that page is migrated. For Concepts the hole is the
 * whole point of the product: the two approval tracks (CLAUDE.md non-negotiable 4 — Internal Status
 * is team-only, Client Status is what the client sees, and a creative reaches the client interface
 * only on Internal = Approved AND Client = Pending for Approval) and the generated Batch-Angle-Theme
 * name (non-negotiable 6 — names are never hand typed). Migrating the Concepts page without these
 * would have dropped both tracks and the name, which is why they are seeded before that happens.
 *
 * They carry `source: 'platform'`, a third kind beside `parent` and `custom`, so the admin screen
 * can say a column is the platform's rather than an Airtable field someone could reasonably detach
 * or hide by mistake. They are seeded on the PARENT, so every brand inherits them from one
 * definition — they are not per-brand configuration and no base should be without them.
 *
 * `name` sorts before every Airtable column (the generated name is the record's title); the two
 * tracks sort after them, which is where every panel already groups approval.
 */
const CONCEPTS_PLATFORM: readonly UpsertColumnDefinition[] = [
  // Eight more, added by the Concepts rollout for the same reason as the Angles nine: the page draws
  // all eight for EVERY brand, they were seeded as Gratsi-only `custom` rows, and switching the page
  // to the resolver with them in the child group would have deleted eight columns from the grid on
  // every inheriting brand. The parent base defines a field for none of them — it reads `Pain
  // Points`, `USP`, `Decription`, `Product` and `Personas` back from its Angles link as LOOKUPS,
  // which is the "level shift" the audits describe — so they are the platform's, not the parent
  // base's. Ordered from 24, after the Airtable range (2-21) and the two approval tracks (22-23);
  // Gratsi holds its own rows for all eight at its own Airtable positions, so its order is unchanged.
  ...[
    ['concept_themes', 'Theme', 24, 'multipleRecordLinks'],
    ['description', 'Description', 25, 'multilineText'],
    ['pain_points', 'Pain Points', 26, 'multilineText'],
    ['usp', 'USP', 27, 'multilineText'],
    ['angle_products', 'Product', 28, 'multipleRecordLinks'],
    ['angle_personas', 'Persona', 29, 'multipleRecordLinks'],
    ['client_comments', 'Client Comments', 30, 'multilineText'],
    ['concept_collections', 'Collection', 31, 'multipleRecordLinks'],
  ].map(([columnKey, displayLabel, displayOrder, fieldType]) => ({
    tableKey: 'concepts',
    columnKey: columnKey as string,
    displayLabel: displayLabel as string,
    displayOrder: displayOrder as number,
    fieldType: fieldType as string,
    source: 'platform' as const,
  })),
  {
    tableKey: 'concepts',
    columnKey: 'name',
    displayLabel: 'Concept Name',
    displayOrder: 0,
    fieldType: 'generated',
    source: 'platform',
  },
  {
    tableKey: 'concepts',
    columnKey: 'internal_status',
    displayLabel: 'Internal Status',
    displayOrder: 22,
    fieldType: 'singleSelect',
    source: 'platform',
  },
  {
    tableKey: 'concepts',
    columnKey: 'client_status',
    displayLabel: 'Client Status',
    displayOrder: 23,
    fieldType: 'singleSelect',
    source: 'platform',
  },
];

/**
 * `production_status` — the one PARENT row this seed writes hidden, and the only way to take the
 * column out of the product without taking it out of the database.
 *
 * Talal, 2026-09-28: "take it out" (docs/decisions.md, "hidden, not dropped"). The form control and
 * the grid renderer were removed then, but the `column_definitions` row stayed visible, and once the
 * Concepts page started resolving its columns that became WORSE than leaving the column in: with no
 * entry in `CONCEPT_RENDERERS`, the resolver hands the key back as `missing` and `ColumnNotices`
 * prints "Configured for this brand but not drawn here: production_status" on the page, for every
 * brand. Hiding it here is what actually removes it — the resolver drops a hidden row (rule 5 in
 * `column-definitions.ts`), so nothing resolves it, nothing reports it missing and the notice goes
 * away, on the signed-in path and in the `COLUMN_SEED`-derived demo fallback alike.
 *
 * NOT DROPPED. 73 of 106 live concepts carry a value, the importer still writes it
 * (`airtable-import.ts`) and `concepts.production_status` round-trips through a hidden input on the
 * detail page, so the data is intact and un-hiding this one row puts the column back at order 19
 * where the template base has it. A brand that wants it visible again gets its own un-hidden child
 * row; `parentRows` deliberately has no hidden path, because a hidden PARENT row is a statement
 * about the whole product and should not be a fifth tuple element in a list of eleven.
 */
const CONCEPTS_PRODUCTION_STATUS: UpsertColumnDefinition = {
  tableKey: 'concepts',
  columnKey: 'production_status',
  displayLabel: 'Production Status',
  displayOrder: 19,
  fieldType: 'singleSelect',
  isHidden: true,
};

const CONCEPTS_PARENT: readonly UpsertColumnDefinition[] = [
  ...parentRows('concepts', [
    ['batch', 'Batch', 2, 'singleSelect'],
    ['concept_angles', 'Angles', 4, 'multipleRecordLinks'],
    ['category', 'Category', 6, 'singleSelect'],
    ['concept_style', 'Concept Style', 7, 'singleSelect'],
    ['approval_status', 'Approval Status', 8, 'singleSelect'],
    ['hook_examples', 'Hook examples', 12, 'multilineText'],
    ['script_idea', 'Script idea', 13, 'multilineText'],
    ['formats_to_create', 'Formats to create', 18, 'multipleSelects'],
    ['ad_inspo_links', 'Ad Inspo', 20, 'multilineText'],
    ['creator_concepts', 'Creator', 21, 'multipleRecordLinks'],
  ]),
  CONCEPTS_PRODUCTION_STATUS,
];

/**
 * Gratsi `Concepts` — 23 fields, and SEVEN of the eight level shifts: `Type`, `Product`, `Personas`,
 * `Collection`, `Pain Points`, `USP` and the misspelt `Decription` are STORED here and DERIVED in
 * the parent (which reads them back as lookups through its `Angles` link), so they are child-added,
 * not relabels — there is no parent column to relabel.
 *
 * `Theme` is child-added for the same reason in reverse: the parent's `Themes` link has no
 * establishable junction, so there is no parent row for Gratsi's `Theme` to detach from. It also
 * resolves to zero rows today — 24 live labels reaching nothing — which is a themes-library
 * decision, not a column one.
 */
const CONCEPTS_GRATSI = childRows('concepts', [
  ['concept_themes', 'Theme', 3, 'relabel-platform', 'multipleSelects'],
  ['concept_angles', 'Angle', 4, 'relabel', 'multipleRecordLinks'],
  ['concept_style', 'Style', 6, 'relabel', 'singleSelect'],
  ['formats', 'Type', 8, 'custom', 'multipleSelects'],
  ['angle_products', 'Product', 10, 'relabel-platform', 'multipleRecordLinks'],
  ['angle_personas', 'Personas', 11, 'relabel-platform', 'multipleRecordLinks'],
  ['approval_status', 'Status', 12, 'relabel', 'singleSelect'],
  ['description', 'Decription', 13, 'relabel-platform', 'multilineText'],
  ['script_idea', 'Script', 14, 'relabel', 'richText'],
  ['concept_collections', 'Collection', 15, 'relabel-platform', 'multipleRecordLinks'],
  ['pain_points', 'Pain Points', 16, 'relabel-platform', 'richText'],
  ['usp', 'USP', 17, 'relabel-platform', 'richText'],
  ['hook_examples', 'Hooks', 18, 'relabel', 'richText'],
  ['client_comments', "Client's Comments", 19, 'relabel-platform', 'multilineText'],
  ['formats_to_create', 'Formats to create', 18, 'hidden', 'multipleSelects'],
  ['ad_inspo_links', 'Ad Inspo', 20, 'hidden', 'multilineText'],
  ['creator_concepts', 'Creator', 21, 'hidden', 'multipleRecordLinks'],
  // Talal ruling 2026-10-04 (AI-33): Gratsi's base has Status, never Internal Status — the
  // platform column stays on the parent and every inheriting brand; only Gratsi hides it.
  ['internal_status', 'Internal Status', 22, 'hidden', 'singleSelect'],
  // Follow-up ruling 2026-10-04: client_status has no Gratsi field either. Hidden the same way —
  // the client interface and every writer read the DB column, never the displayed set.
  ['client_status', 'Client Status', 23, 'hidden', 'singleSelect'],
]);

/** `Angles` `tbl4UFSFcynlS2Pkn` — 11 fields; 3 reverse links and 1 two-hop lookup skipped. */
const ANGLES_PARENT = parentRows('angles', [
  ['name', 'Name', 1, 'singleLineText'],
  ['type', 'Type', 2, 'multipleSelects'],
  ['angle_products', 'Product', 3, 'multipleRecordLinks'],
  ['angle_personas', 'Personas', 5, 'multipleRecordLinks'],
  ['description', 'Description', 6, 'multilineText'],
  ['pain_points', 'Pain Points', 7, 'multilineText'],
  ['usp', 'USP', 8, 'multilineText'],
]);

/**
 * Angles' PLATFORM columns: nine stored columns the page shows for EVERY brand, which the parent
 * Airtable base has no field for.
 *
 * These were seeded as Gratsi-only `custom` rows, and that is the bug this block fixes. They are
 * real columns of `angles` for every brand — `status` arrived in migration 0039 and its chip is a
 * UI-governance fixture on /design-system — and the page draws all nine today. Left as child-added
 * rows, switching the page to the resolver would have deleted NINE columns from the grid on
 * Niagara, Mattress Central, Funky Painting and demo mode, while Gratsi kept them. Drop nothing.
 *
 * They are the parent's because every brand has them, and `platform` rather than `parent` because
 * the parent BASE defines no field for any of them: its Angles table has 11 fields and none is
 * Status, Potential, Winning, Formats, Ad Inspo, Brief, Exact Script, Internal Notes or Client
 * Notes. The labels are the platform's own, which is what the page has always shown; Gratsi
 * relabels the two its base words differently.
 *
 * Ordered from 20 so they sort after the parent's Airtable fields (1-8) and collide with none of
 * them — the same shape as CONCEPTS_PLATFORM's tracks at 22-23.
 */
const ANGLES_PLATFORM: readonly UpsertColumnDefinition[] = [
  ['status', 'Status', 20, 'singleSelect'],
  ['potential', 'Potential', 21, 'singleSelect'],
  ['formats', 'Formats to create', 22, 'multipleSelects'],
  ['ad_inspo_links', 'Ad Inspo', 23, 'multilineText'],
  ['brief_url', 'Brief URL', 24, 'url'],
  ['exact_script_url', 'Exact Script URL', 25, 'url'],
  ['winning', 'Winning', 26, 'checkbox'],
  ['internal_notes', 'Internal Notes', 27, 'multilineText'],
  ['client_notes', 'Client Notes', 28, 'multilineText'],
].map(([columnKey, displayLabel, displayOrder, fieldType]) => ({
  tableKey: 'angles',
  columnKey: columnKey as string,
  displayLabel: displayLabel as string,
  displayOrder: displayOrder as number,
  fieldType: fieldType as string,
  source: 'platform' as const,
}));

/**
 * Gratsi `Angles` — 21 fields, now matched field for field against the live base (GRATSI-MATCH,
 * 2026-10-04; positions from `docs/audits/overnight-gratsi-columns.md` §3, verified against the
 * 2026-10-04 live diff). Three hidden rows remain the level shift seen from this side: Gratsi keeps
 * `Type`, `Pain Points` and `USP` on Concepts, so its Angles table has no field for them. Hiding is
 * per base and never a drop.
 *
 * THREE KINDS OF ROW, and why each exists:
 *
 * - RELABELS AT GRATSI'S OWN POSITIONS. The audit recorded "ORDER DIVERGES" because inherited rows
 *   carry the PARENT base's field order; these rows re-state the same column (same label where the
 *   bases agree) at the Gratsi base's own position, so the resolved sequence reads as the live base
 *   does. `Product (from Angles)` and `Personas (from Angles)` were previously HIDDEN here: the
 *   Gratsi base has no stored Product/Personas field on Angles, but it DOES display both as lookups
 *   through Concepts (fields 7–8), and the platform's `angle_products` / `angle_personas` junctions
 *   are exactly that data — so they resolve visibly under Airtable's own lookup names.
 *
 * - REVERSE LINKS AS READ-ONLY GRID COLUMNS (`concept_angles`, `creative_module_angles`,
 *   `creative_briefs`). Airtable shows `Concepts`, `(Internal) Creative Modules` and
 *   `(Internal) Creative Design 2` as link fields; their stored side lives on the other table
 *   (`concept_angles`, `creative_module_angles`, `creative_briefs.angle_id`), so each is keyed by
 *   the table that points back at `angles` — the same shape as the Products reverse links — and the
 *   page renders the linked names read-only. Display work, no storage (2026-10-04 diff,
 *   annotation 6; extends AI-43's record-page display to the grid, removing nothing).
 *
 * - NO ROW AT ALL for the five fields the decision register excludes: `Creators` (a dead link to
 *   UGC Management with no stored inverse anywhere — empty on all 43 live rows, importer `skip`),
 *   and the four residual text remnants `(Internal) Creative Design`, `Creative Sheet`,
 *   `UGC Management copy`, `Concepts copy` (rule 5: decision-doc lines, never invented columns).
 */
const ANGLES_GRATSI = childRows('angles', [
  ['status', 'Status', 2, 'relabel-platform', 'singleSelect'],
  ['potential', 'Potential', 3, 'relabel-platform', 'singleSelect'],
  ['description', 'Description', 4, 'relabel', 'multilineText'],
  ['concept_angles', 'Concepts', 6, 'custom', 'multipleRecordLinks'],
  ['angle_products', 'Product (from Angles)', 7, 'relabel', 'multipleRecordLinks'],
  ['angle_personas', 'Personas (from Angles)', 8, 'relabel', 'multipleRecordLinks'],
  ['creative_module_angles', '(Internal) Creative Modules', 9, 'custom', 'multipleRecordLinks'],
  ['formats', 'Formats to create', 10, 'relabel-platform', 'multipleSelects'],
  ['client_notes', 'Client Notes', 11, 'relabel-platform', 'multilineText'],
  ['brief_url', 'Brief', 13, 'relabel-platform', 'url'],
  ['exact_script_url', 'Exact Script', 14, 'relabel-platform', 'url'],
  ['ad_inspo_links', 'Ad Inspo', 15, 'relabel-platform', 'multilineText'],
  ['winning', 'Winning', 16, 'relabel-platform', 'checkbox'],
  ['internal_notes', 'Internal Notes', 17, 'relabel-platform', 'multilineText'],
  ['creative_briefs', '(Internal) Creative Design 2', 19, 'custom', 'multipleRecordLinks'],
  ['type', 'Type', 2, 'hidden', 'multipleSelects'],
  ['pain_points', 'Pain Points', 7, 'hidden', 'multilineText'],
  ['usp', 'USP', 8, 'hidden', 'multilineText'],
]);

/**
 * `Themes` `tblzS73a9JrJGiV2J` — the parent id of that name, which is CREATIVE MODULES by its field
 * set (primary field `Module Name`, a `Concepts` link). Three fields, two of which seed.
 * `Reference Link` gets no row: `creative_modules.foreplay_link` is the only candidate column and
 * the parent audit explicitly declined to assert it, so Gratsi's `Foreplay Link` is child-added
 * rather than a relabel of something unestablished.
 */
const CREATIVE_MODULES_PARENT = parentRows('creative_modules', [
  ['module_name', 'Module Name', 1, 'singleLineText'],
  ['creative_module_angles', 'Concepts', 3, 'multipleRecordLinks'],
]);

/**
 * Creative Modules' PLATFORM columns: two the page draws for every brand that the parent base has no
 * field for.
 *
 * `foreplay_link` and the designs junction were Gratsi-only `custom` rows, so migrating the page
 * would have left an inheriting brand with two of the four columns it draws today. The parent
 * audit explicitly declined to assert a column for its `Reference Link` field, so there is no parent
 * Airtable field to inherit from and these are the platform's. Ordered from 20, after the Airtable
 * range.
 */
const CREATIVE_MODULES_PLATFORM = platformRows('creative_modules', [
  ['foreplay_link', 'Foreplay Link', 20, 'url'],
  ['creative_module_designs', 'Creative Designs', 21, 'multipleRecordLinks'],
]);

/**
 * Gratsi `(Internal) Creative Modules` — 4 fields. Two inherit, `foreplay_link` now inherits the
 * platform row under the same label, and only the designs link is worded differently.
 */
const CREATIVE_MODULES_GRATSI = childRows('creative_modules', [
  [
    'creative_module_designs',
    '(Internal) Creative Design',
    21,
    'relabel-platform',
    'multipleRecordLinks',
  ],
]);

/**
 * `DONT USE Creative Sheet` `tblGC0TxnHI7lKaNQ` — 17 fields, TWELVE of them lookups that are
 * `isValid:false` in Airtable itself and seed nothing (`docs/decisions/overnight-dead-lookups.md`).
 * The parent has marked this table dead while Gratsi's copy holds 377 live records; which base owns
 * the master column set here is an owner question, recorded in the decision doc.
 */
const CREATIVE_SHEET_ITEMS_PARENT = parentRows('creative_sheet_items', [
  ['brief_id', 'Creative Name', 2, 'singleLineText'],
  ['status', 'Status', 9, 'singleSelect'],
  ['client_comments', "Client's Comments", 10, 'multilineText'],
]);

/**
 * The primary field, and the reason virtual columns exist.
 *
 * `creative_sheet_items` has NO `name` column: Airtable's field 1 is a formula, and the schema says
 * in its own voice that storing the result would let the month drift from `created_at`. So this is a
 * VIRTUAL row — computed on every read by `creativeSheetName`, written by nothing.
 *
 * `parent`, NOT `platform`, and the distinction is the point: the parent base really does define
 * this field (`Name + Angle + Offer`, field 1), so the column is the parent's and merely happens to
 * be computed. `source` says who owns a column; `formula` says whether there is anything to store.
 * They are different questions, and this is the row that shows it.
 */
const CREATIVE_SHEET_ITEMS_NAME: readonly UpsertColumnDefinition[] = [
  {
    tableKey: 'creative_sheet_items',
    columnKey: 'name',
    displayLabel: 'Name + Angle + Offer',
    displayOrder: 1,
    fieldType: 'formula',
    formula: 'creativeSheetName',
  },
];

/**
 * The ten fields GRATSI's base defines on this table and the PARENT's does not.
 *
 * The page draws every one of them for every brand, so leaving them as Gratsi-only rows would have
 * deleted ten columns from the grid on Niagara, Mattress Central, Funky Painting and demo mode —
 * the same failure found on Angles, Concepts, UGC and Creative Modules. They are the platform's,
 * because the parent base has no field for any of them, and they carry Gratsi's own labels since
 * Gratsi's base is the only one that names them.
 *
 * `Denied/revisions needed` keeps Airtable's spelling, unspaced, which is also what the importer
 * keys on. The panel writes it spaced; that panel is hand-built and not resolver-driven, so the two
 * now differ and the report says so rather than quietly picking one.
 *
 * Ordered from 18, after the parent's 17-field Airtable range, preserving Gratsi's relative order.
 */
const CREATIVE_SHEET_ITEMS_PLATFORM = platformRows('creative_sheet_items', [
  ['internal_status', 'Internal Status', 18, 'singleSelect'],
  ['qa_checklist_doc', 'QA Checklist Doc', 19, 'multipleAttachments'],
  ['qa_video_editor', 'Video Editor QA', 20, 'checkbox'],
  ['qa_designer', 'Graphic Designer QA', 21, 'checkbox'],
  ['qa_strategist', 'Creative Strategist QA', 22, 'checkbox'],
  ['used', 'Used', 23, 'checkbox'],
  ['denied_revisions_needed', 'Denied/revisions needed', 24, 'checkbox'],
  ['winning', 'Winning', 25, 'singleSelect'],
  ['spell_check_requested', 'Click for AI Spell Checker Again', 26, 'checkbox'],
  ['spelling_feedback', 'Spelling Feedback', 27, 'multilineText'],
]);

/**
 * Gratsi `Creative Sheet` — 29 fields, 16 derived: the table is almost entirely lookups through
 * `Creative Name`. `creative_sheet_items` holds ZERO rows in production for every brand against 377
 * live Airtable records, so this is the least-exercised column map in the seed; flagged, not
 * smoothed over.
 */
const CREATIVE_SHEET_ITEMS_GRATSI = childRows('creative_sheet_items', [
  // Gratsi words the primary field `Name` where the parent calls it `Name + Angle + Offer`. A
  // relabel only: the resolver reads `formula` from the parent row, so the column stays computed
  // however a child words it — a child cannot make a virtual column stored.
  ['name', 'Name', 1, 'relabel', 'formula'],
]);

/**
 * `UGC Management` `tblRsVqiqUaZRcQYd` — 32 fields, 31 of which seed.
 *
 * THE TWO APPROVAL TRACKS ARE AS THE ENGINE WRITES THEM, NOT AS `import-mappings.ts` DOCUMENTS
 * THEM. `Status` → `client_status`, `Internal Creator's Status` → `internal_creator_status`
 * (`airtable-import.ts:1145-1160`). The mapping doc has the pair swapped, which would label a
 * client-facing column as the internal one — the single mistake CLAUDE.md non-negotiable 10 is
 * about. Mapping both to `internal_creator_status`, as the parent audit's table does, would also
 * collide on `UNIQUE (brand_id, table_key, column_key)`.
 *
 * `Creator's cost (USD)` (field 19) gets no row: no audit asserts a column for the parent's copy of
 * it, and Gratsi's is a formula.
 */
const CREATORS_PARENT = parentRows('creators', [
  ['name', 'Creator name (Filled by UGC Manager)', 1, 'singleLineText'],
  ['deadline', '(Internal) Deadline for the request', 2, 'date'],
  ['date_of_management', 'Date of Management', 3, 'date'],
  ['age_bracket', 'Age', 4, 'singleSelect'],
  ['gender', 'Gender', 5, 'singleSelect'],
  ['ethnicity', 'Ethnicity', 6, 'singleLineText'],
  ['internal_brief', 'Internal Brief', 7, 'multilineText'],
  ['creator_concepts', 'Concepts to film', 8, 'multipleRecordLinks'],
  ['creator_products', 'Products', 9, 'multipleRecordLinks'],
  ['budget_per_60s', 'Budget per 60sec video', 10, 'currency'],
  ['for_partnership_ads', 'For Partnership Ads?', 11, 'singleSelect'],
  ['internal_creator_status', "Internal Creator's Status", 12, 'singleSelect'],
  ['client_status', 'Status', 13, 'singleSelect'],
  ['internal_assets_status', 'Internal Assets Status', 14, 'singleSelect'],
  ['video_intro_url', "Creator's Video Intro", 15, 'multipleAttachments'],
  ['profile_pic_url', "Creator's Profile Pic", 16, 'multipleAttachments'],
  ['platform', 'Platform', 17, 'singleSelect'],
  ['client_note', "(Client's) Note or Comments", 18, 'multilineText'],
  ['raw_assets_url', 'Raw assets', 20, 'url'],
  ['shipping_location', 'Shipping Location', 21, 'multilineText'],
  // The trailing space is the live field name, as with `Slack Notified ` on the Gratsi side.
  ['tracking_number', 'Tracking Number ', 22, 'singleLineText'],
  ['partnership_activity', 'Partnership Activity', 23, 'singleSelect'],
  ['creator_link', 'Creator Link', 24, 'url'],
  ['instagram_username', 'Instagram Username', 25, 'singleLineText'],
  ['partnership_activated_at', 'Date of Partnership Activation', 26, 'date'],
  ['partnership_period_days', 'Partnership Time Period (days)', 27, 'number'],
  ['continue_working_with', 'Continue Working With?', 28, 'singleSelect'],
  ['extension_days', 'Extension Time Period', 29, 'singleSelect'],
  ['partnership_price_per_30_days', 'Partnership Price per 30 days', 30, 'currency'],
  ['partnership_notes', 'Notes for Partnership ads', 31, 'multilineText'],
  ['facebook_profile_url', 'Facebook Profile for Partnership', 32, 'richText'],
]);

/**
 * Gratsi `UGC Management` — 36 fields: 24 inherit, 4 relabel, 6 added, 2 derived.
 *
 * `Creator Status` → `internal_creator_status` is the relabel the mapping doc gets backwards; the
 * engine's comment says why ("the tracks were SWAPPED in the first import"). Gratsi's own `Concepts`
 * field is a second, jsonb-backed link (`creators.concept_ids`) alongside the `creator_concepts`
 * junction, so both get a row and neither is guessed into the other — but the second one is
 * `hidden-custom`, not `custom`: the field is empty on all 70 live rows and the importer skips it
 * (`scripts/import-mappings.ts` `handler: 'skip'`, exclusion register `docs/decisions.md`
 * "UGC Management › Concepts"), so nothing writes `creators.concept_ids` and the UGC grid has no
 * renderer that could draw it. A visible row made the page report a column it cannot draw
 * ("not drawn here: concept_ids") instead of showing one. Hidden is the law's own answer for a field
 * like this — *"an AMBIGUOUS field becomes a HIDDEN child-added row"* — and it keeps the row, so the
 * Airtable field stays remembered and an admin can un-hide it the day it carries data.
 */
/**
 * Creators' PLATFORM columns: five internal money-and-process fields the UGC grid draws for every
 * brand, which the parent Airtable base has no field for.
 *
 * Seeded as Gratsi-only `custom` rows until the UGC rollout, so migrating the page would have
 * deleted five columns from the grid on every inheriting brand — the third table where the same bug
 * turned up. These are internal figures (CLAUDE.md non-negotiable 10): the team workspace shows
 * them, the client interface never does, and that boundary is enforced by the client pages being
 * separate, not by this configuration.
 *
 * `creator_cost` carries the platform fee the formulas module computes (1.055 Fiverr / 1.10
 * Insense); the column stores the creator's own figure and the fee is applied on read, never stored.
 * Orders follow the positions Gratsi already used, so its grid is unchanged.
 */
const CREATORS_PLATFORM: readonly UpsertColumnDefinition[] = [
  ['creator_cost', 'Creator Cost (USD)', 17, 'currency'],
  ['cost_usd', 'Paid by TAS (USD)', 23, 'currency'],
  ['payment_date', 'Payment Date', 24, 'date'],
  ['creator_info_request', 'Creator Info Request', 26, 'multilineText'],
  ['slack_notified', 'Slack Notified', 30, 'checkbox'],
].map(([columnKey, displayLabel, displayOrder, fieldType]) => ({
  tableKey: 'creators',
  columnKey: columnKey as string,
  displayLabel: displayLabel as string,
  displayOrder: displayOrder as number,
  fieldType: fieldType as string,
  source: 'platform' as const,
}));

const CREATORS_GRATSI = childRows('creators', [
  ['creator_concepts', 'Concept to film', 7, 'relabel', 'multipleRecordLinks'],
  ['video_intro_url', "Creator's video Intro", 11, 'relabel', 'multipleAttachments'],
  ['internal_brief', 'Additional Note - TAS Team', 16, 'relabel', 'richText'],
  ['creator_cost', "Creator's cost (USD) - Internal", 17, 'relabel-platform', 'currency'],
  ['internal_creator_status', 'Creator Status', 22, 'relabel', 'singleSelect'],
  ['cost_usd', 'Paid by TAS', 23, 'relabel-platform', 'currency'],
  ['payment_date', 'Payment Date', 24, 'relabel-platform', 'date'],
  ['concept_ids', 'Concepts', 25, 'hidden-custom', 'multipleRecordLinks'],
  ['creator_info_request', 'Creator Info Request', 26, 'relabel-platform', 'richText'],
  ['slack_notified', 'Slack Notified ', 30, 'relabel-platform', 'checkbox'],
  ['deadline', '(Internal) Deadline for the request', 2, 'hidden', 'date'],
  ['for_partnership_ads', 'For Partnership Ads?', 11, 'hidden', 'singleSelect'],
  ['internal_assets_status', 'Internal Assets Status', 14, 'hidden', 'singleSelect'],
]);

/**
 * `AI Characters / Personas` `tblgfe8A7nmce6lzn` — 12 fields, all stored, all paired by content with
 * `ai_characters`. A PARENT-ONLY table: the Gratsi base has no counterpart, so every column is
 * hidden for Gratsi below. That is the audit's verdict and it hides rather than drops — but it does
 * mean a resolver-driven AI Characters page would show Gratsi no columns at all, which is recorded
 * in the decision doc as the one place where hiding a whole table has a visible product consequence.
 */
const AI_CHARACTERS_COLUMNS: readonly ParentColumn[] = [
  ['name', 'Name', 1, 'singleLineText'],
  ['attachments', 'Attachments', 2, 'multipleAttachments'],
  ['status', 'Status', 3, 'singleSelect'],
  ['basic_info', 'Basic Info', 4, 'multilineText'],
  ['tone_of_voice', 'Tone of Voice', 5, 'multilineText'],
  ['voice_link', 'Voice Link (Eleven Labs)', 6, 'url'],
  ['personality_traits', 'Personality Traits', 7, 'multilineText'],
  ['appearance', 'Appearance', 8, 'multilineText'],
  ['traits_and_habits', 'Traits & Habits', 9, 'multilineText'],
  ['hobbies_and_lifestyle', 'Hobbies & Lifestyle', 10, 'multilineText'],
  ['work_and_background', 'Work & Background', 11, 'multilineText'],
  ['why_promotes_brand', 'Why He Promotes this brand?', 12, 'multilineText'],
];

const AI_CHARACTERS_PARENT = parentRows('ai_characters', AI_CHARACTERS_COLUMNS);

const AI_CHARACTERS_GRATSI = childRows(
  'ai_characters',
  AI_CHARACTERS_COLUMNS.map(([columnKey, label, order, fieldType]): ChildColumn => [
    columnKey,
    label,
    order,
    'hidden',
    fieldType,
  ]),
);

/**
 * `(Internal) Collections` `tbl6LBNrRqa6Hh4I2` — 8 fields, 7 of which seed. The three link columns
 * are keyed by the FK that `collections` actually carries (`angle_id`, `product_id`,
 * `copywriting_id`), which is what the engine writes in pass 2; the parent audit's junction guesses
 * for fields 4 and 5 are not columns this schema has.
 */
const COLLECTIONS_PARENT = parentRows('collections', [
  ['name', 'Collection Name', 1, 'singleLineText'],
  ['url', 'URL', 2, 'url'],
  ['campaign_id', 'Campaigns & Offers', 3, 'multipleRecordLinks'],
  ['angle_id', 'Angles', 4, 'multipleRecordLinks'],
  ['product_id', '(Internal) Product', 5, 'multipleRecordLinks'],
  ['copywriting_id', 'Ads Copywriting copy', 7, 'multipleRecordLinks'],
  ['creative_design_note', '(Internal) Creative Design 2', 8, 'multipleRecordLinks'],
]);

/**
 * Gratsi `(Internal) Collections` — 13 fields, one relabel and nothing else. Its `Copywriting` field
 * (order 3) gets no row: the engine writes it to `collections.copywriting_id`, which field 13
 * `Ads Copywriting copy` already owns, and one column can carry one row per base. Recorded in the
 * decision doc rather than duplicated.
 */
const COLLECTIONS_GRATSI = childRows('collections', [
  ['name', 'Main Collection', 1, 'relabel', 'singleLineText'],
]);

/**
 * `(Internal) Product` `tblfvfJMYNBz2OYYw` — all 8 fields, in the Airtable Meta API's own order
 * (read live from both bases on 2026-10-03).
 *
 * SIX of the eight are record links whose stored side is the other table's foreign key, and an
 * earlier pass seeded only the two scalars because that is the right answer for IMPORT parity: there
 * is no column on `products` to write them to. It is the wrong answer for a DISPLAY set, which is
 * what `column_definitions` is — the Products page shows all six today, as counts and name lists, so
 * leaving them unseeded would have deleted six columns from the page the moment it started reading
 * the resolver. Drop nothing.
 *
 * Their keys name the table that holds the foreign key BACK to products, which is the rule
 * `column-seed.test.ts` already enforces against `information_schema` ("a real Postgres column or a
 * junction OF ITS OWN TABLE") — wider than a pure junction, and deliberately so, because the reverse
 * side of a one-to-many is the same shape. All six were checked against production's foreign keys
 * before being written here; see `docs/decisions/column-key-relations-2026-10-03.md`.
 */
const PRODUCTS_PARENT = parentRows('products', [
  ['name', 'Product Name / Landing Page Name', 1, 'multilineText'],
  ['link', 'Link', 2, 'url'],
  ['collections', '(Internal) Collections', 3, 'multipleRecordLinks'],
  ['campaigns_offers', 'Campaigns & Offers', 4, 'multipleRecordLinks'],
  ['angle_products', 'Angles', 5, 'multipleRecordLinks'],
  ['creative_briefs', '(Internal) Creative Design', 6, 'multipleRecordLinks'],
  ['copywriting', 'Meta Copywriting', 7, 'multipleRecordLinks'],
  ['creator_products', 'UGC Management', 8, 'multipleRecordLinks'],
]);

/**
 * Products' PLATFORM columns: displayed by the page, backed by real data, and with no Airtable field
 * on `(Internal) Product` in EITHER base. Verified field by field against the live Meta API, not
 * inferred from a document — the parent has 8 fields and Gratsi 11, and none of them is any of
 * these.
 *
 * - `collection_link` is a stored `text` column with 2 of 9 live products populated in production.
 *   `airtable-import.ts:837` reads `f['Collection Link']` for it, a field neither base defines, so
 *   the column can never be written by an import; that is filed as its own defect. The column and
 *   its data exist regardless, and the page renders them as "Collection link".
 * - `email_campaign_products` and `youtube_copy_products` are junctions the app maintains and
 *   indexes for the page's counts. Neither base has an Email Campaigns link on this table (Gratsi's
 *   two `Email Campaigns Management copy` fields are `singleLineText`, not links), and only Gratsi
 *   has a `Youtube Copywriting` link. Seeding them on the PARENT is what keeps an inheriting brand
 *   from losing two columns it shows today; Gratsi relabels the YouTube one to its own wording below.
 * - `concepts` is the page's concept count, two hops away
 *   (`products → angle_products → angles → concepts`) and computed on read at
 *   `packages/db/src/products.ts:89`. `concepts` carries no foreign key back to `products`, so it is
 *   named in the gate's documented exemption list beside the two existing inferred chains rather
 *   than being quietly admitted. Whether a two-hop derived count belongs in a configurable column
 *   set at all is a question for the owner; until it is answered the column is kept, because the
 *   page shows it.
 */
const PRODUCTS_PLATFORM: readonly UpsertColumnDefinition[] = [
  {
    tableKey: 'products',
    columnKey: 'collection_link',
    displayLabel: 'Collection Link',
    displayOrder: 9,
    fieldType: 'url',
    source: 'platform',
  },
  {
    tableKey: 'products',
    columnKey: 'email_campaign_products',
    displayLabel: 'Email Campaigns',
    displayOrder: 10,
    fieldType: 'multipleRecordLinks',
    source: 'platform',
  },
  {
    tableKey: 'products',
    columnKey: 'youtube_copy_products',
    displayLabel: 'YouTube Copy',
    displayOrder: 11,
    fieldType: 'multipleRecordLinks',
    source: 'platform',
  },
  {
    tableKey: 'products',
    columnKey: 'concepts',
    displayLabel: 'Concepts',
    displayOrder: 12,
    fieldType: 'count',
    source: 'platform',
  },
];

/**
 * Gratsi's `(Internal) Product` — 11 fields, and it renames NOTHING (audit §10). Its `Angles`,
 * `(Internal) Creative Design` and `UGC Management` carry the parent's own names, so Gratsi inherits
 * those three and holds no row for them.
 *
 * What it does hold: the three parent fields Gratsi's base does NOT have, hidden so the page shows
 * Gratsi only what Gratsi defines; and one relabel, because Gratsi's base spells the YouTube link
 * `Youtube Copywriting` where the platform row above calls it `YouTube Copy`.
 */
const PRODUCTS_GRATSI = childRows('products', [
  ['youtube_copy_products', 'Youtube Copywriting', 11, 'relabel-platform', 'multipleRecordLinks'],
  ['collections', '(Internal) Collections', 100, 'hidden', 'multipleRecordLinks'],
  ['campaigns_offers', 'Campaigns & Offers', 101, 'hidden', 'multipleRecordLinks'],
  ['copywriting', 'Meta Copywriting', 102, 'hidden', 'multipleRecordLinks'],
]);

/** `Campaigns & Offers` `tblRNaWCVa1cCIwLL` — 14 fields; the `Name` formula and 2 links skipped. */
const CAMPAIGNS_OFFERS_PARENT = parentRows('campaigns_offers', [
  ['holiday', 'Holiday', 2, 'singleLineText'],
  ['official_date', 'Official Date', 3, 'date'],
  ['country', 'Country', 4, 'singleLineText'],
  ['description', 'Description', 5, 'multilineText'],
  ['confirmed_by_client', 'Confirmed by Client', 6, 'checkbox'],
  ['launched', 'Launched', 7, 'checkbox'],
  ['ads_launch_date', 'Ads Launch Date', 8, 'date'],
  ['ads_end_date', 'Ads End Date', 9, 'date'],
  ['discount_offer', 'Discount Offer', 10, 'singleLineText'],
  ['code', 'Code', 11, 'singleLineText'],
  ['product_id', '(Internal) Product', 13, 'multipleRecordLinks'],
]);

/**
 * Gratsi `Campaigns & Offers` — 20 fields, 0 live records. Its field LABELLED `Angles` links the
 * CONCEPTS table, which is why its key is the `campaign_concepts` junction and not an angle one.
 */
const CAMPAIGNS_OFFERS_GRATSI = childRows('campaigns_offers', [
  ['promotional_ideas', 'Promotional Ideas', 6, 'custom', 'richText'],
  ['confirmed_by_client', 'Interested', 7, 'relabel', 'checkbox'],
  ['campaign_concepts', 'Angles', 16, 'custom', 'multipleRecordLinks'],
  ['product_id', '(Internal) Product', 13, 'hidden', 'multipleRecordLinks'],
]);

/** `(Internal) Creative Dimensions` `tblli0Y76yJvG56zK` — identical in both bases; 1 reverse link. */
const CREATIVE_DIMENSIONS_PARENT = parentRows('creative_dimensions', [
  ['name', 'Name', 1, 'singleLineText'],
  ['dimensions', 'Dimensions', 2, 'singleLineText'],
  ['link_description', 'Link Description', 3, 'singleSelect'],
]);

/**
 * `Competitive research` `tbl9W6v78tKWznN9S` — 7 fields, identical in both bases, every one stored.
 * Gratsi departs nowhere, so it has no rows and inherits all seven. Three of them
 * (`facebook_page`, `meta_ads_library`, `analysis`) are stored and not displayed today, which is
 * exactly the kind of column the resolver is meant to make configurable.
 */
const COMPETITIVE_RESEARCH_PARENT = parentRows('competitive_research', [
  ['name', 'Name', 1, 'singleLineText'],
  ['type', 'Type', 2, 'singleSelect'],
  ['website', 'Website', 3, 'singleLineText'],
  ['instagram', 'Insta', 4, 'singleLineText'],
  ['facebook_page', 'FB Page', 5, 'singleLineText'],
  ['meta_ads_library', 'Meta Ads Library', 6, 'multilineText'],
  ['analysis', 'Analysis', 7, 'multilineText'],
]);

/** `Client Assets Organisation` `tbldFmPU6AWg62Fll` — 4 fields; the 4th is a reverse link. */
const CLIENT_ASSET_FOLDERS_PARENT = parentRows('client_asset_folders', [
  ['name', 'Name [Folder]', 1, 'singleLineText'],
  ['description', 'Description', 2, 'multilineText'],
  ['location_url', 'Location', 3, 'url'],
  // Field 4, the reverse link the page counts. It had no row because the importer skips this side —
  // right for import parity, wrong for a display set, exactly as on Products.
  ['brief_asset_folders', '(Internal) Creative Design', 4, 'multipleRecordLinks'],
]);

/**
 * GRATSI-ONLY TABLES. Six tables the parent base does not have at all, so every row is child-added
 * and there is nothing to inherit or hide. Five of the six hold zero live records, so their
 * classification rests on metadata and on the engine's row builders.
 */

/**
 * Gratsi `Youtube Copywriting` `tblVR1UmkbDoDzJ7z` — 29 fields: 16 stored, 12 derived, 1 banner. Two labels differ from the platform set and the banner has no column at all, so three rows stay.
 *
 * Its rows are now the PARENT's, since the parent base has no such table and the platform set above
 * was derived from this base's own field names and order. What is left here is only what Gratsi
 * genuinely words differently; the rest are retired by the reconciling seed, which soft-deletes rows
 * the seed itself wrote and no longer lists, so Gratsi inherits identical labels instead of carrying
 * duplicates that would win over the parent for no reason.
 */
const YOUTUBE_COPY_GRATSI = childRows('youtube_copy', [
  ['descriptions', 'Descriptions (90 caractères max)', 6, 'relabel-platform', 'richText'],
  ['used', 'USED', 20, 'relabel-platform', 'checkbox'],
  [
    UNMAPPED_COLUMN_KEY,
    '⚠️ Please Change the Status of the copy',
    29,
    'hidden-custom',
    'singleSelect',
  ],
]);

/**
 * Gratsi `Email Campaigns Management` `tblABjVpwRpYtY7de` — 17 fields; the two formula due dates are virtual columns now. Every label matches the platform set, so Gratsi holds NO rows and inherits all seventeen.
 *
 * Its rows are now the PARENT's, since the parent base has no such table and the platform set above
 * was derived from this base's own field names and order. What is left here is only what Gratsi
 * genuinely words differently; the rest are retired by the reconciling seed, which soft-deletes rows
 * the seed itself wrote and no longer lists, so Gratsi inherits identical labels instead of carrying
 * duplicates that would win over the parent for no reason.
 */
const EMAIL_CAMPAIGNS_GRATSI = childRows('email_campaigns', []);

/**
 * Gratsi `Email Flows Management` `tblubVflAQZgJSxcF` — ked 13 fields; the same due-date chain, both virtual now. Every label matches, so Gratsi holds NO rows.
 *
 * Its rows are now the PARENT's, since the parent base has no such table and the platform set above
 * was derived from this base's own field names and order. What is left here is only what Gratsi
 * genuinely words differently; the rest are retired by the reconciling seed, which soft-deletes rows
 * the seed itself wrote and no longer lists, so Gratsi inherits identical labels instead of carrying
 * duplicates that would win over the parent for no reason.
 */
const EMAIL_FLOWS_GRATSI = childRows('email_flows', []);

/**
 * Gratsi `SM Campaign Management Feed` `tblLRajTW55XEhVhk` — 6 fields; `Reminder Trigger` is a formula and now a virtual column. Every label matches, so Gratsi holds NO rows.
 *
 * Its rows are now the PARENT's, since the parent base has no such table and the platform set above
 * was derived from this base's own field names and order. What is left here is only what Gratsi
 * genuinely words differently; the rest are retired by the reconciling seed, which soft-deletes rows
 * the seed itself wrote and no longer lists, so Gratsi inherits identical labels instead of carrying
 * duplicates that would win over the parent for no reason.
 */
const SM_CAMPAIGN_FEED_GRATSI = childRows('sm_campaign_feed_tasks', []);

/**
 * `sm_campaign_feed_tasks` — no parent table, so all platform. `reminder_trigger` is VIRTUAL: an
 * Airtable formula over the due date and the current time, computed by `smReminderTrigger`, which
 * takes `now` as an explicit parameter so the page can pass ONE `now` per request.
 */
const SM_CAMPAIGN_FEED_PLATFORM = platformRows('sm_campaign_feed_tasks', [
  ['task_name', 'Task Name', 1, 'singleLineText'],
  ['platform', 'Platform', 2, 'singleSelect'],
  ['due_date', 'Due Date', 3, 'dateTime'],
  ['status', 'Status', 4, 'singleSelect'],
  ['notes', 'Notes', 5, 'multilineText'],
  ['reminder_trigger', 'Reminder Trigger', 6, 'formula', 'smReminderTrigger'],
]);

/**
 * `email_flows` — no parent table, so all platform. The two due dates are VIRTUAL, chained off the
 * expected setup date; the copywriting one calls the design one, so the chain cannot drift.
 */
const EMAIL_FLOWS_PLATFORM = platformRows('email_flows', [
  ['flow_name', 'Flow Name', 1, 'singleLineText'],
  ['expected_setup_date', 'Expected Setup Date', 2, 'date'],
  ['flow_purpose', 'Flow Purpose', 3, 'multilineText'],
  ['status', 'Status', 4, 'singleSelect'],
  ['copywriting_due_date', 'Copywriting Due Date', 5, 'formula', 'emailFlowCopywritingDueDate'],
  ['design_due_date', 'Design Due Date', 6, 'formula', 'emailFlowDesignDueDate'],
  ['copywriting', 'Copywriting', 7, 'richText'],
  ['design', 'Design', 8, 'multipleAttachments'],
  ['klaviyo_link', 'Klaviyo Link', 9, 'url'],
  ['type', 'Type', 10, 'singleSelect'],
  ['email_flow_campaigns', 'Campaigns & Offers', 11, 'multipleRecordLinks'],
  ['inspo', 'Inspo', 12, 'multipleAttachments'],
  ['assignee_id', 'Assignee', 13, 'singleCollaborator'],
]);

/**
 * `creative_reporting` — no parent table, so all platform. `difference_cpa` is VIRTUAL (CPA minus
 * target CPA, `differenceCpa`). `brief_id` is the opposite case and worth naming: a REAL stored uuid
 * foreign key that no Airtable field maps to, because Gratsi's `Creative Name` is a formula and
 * `Creative Name (from Creative)` is a lookup — the same shape as `products.collection_link`.
 */
const CREATIVE_REPORTING_PLATFORM = platformRows('creative_reporting', [
  ['name_angle_offer', 'Name + Angle + Offer', 1, 'singleLineText'],
  ['brief_id', 'Creative', 2, 'multipleRecordLinks'],
  ['notes', 'Notes', 3, 'multilineText'],
  ['ad_design', 'Ad Design', 4, 'multipleAttachments'],
  ['ad_link', 'Ad Link', 5, 'singleLineText'],
  ['ctr', 'CTR', 6, 'percent'],
  ['thumb_stop_rate', 'Thumb-Stop Rate', 7, 'number'],
  ['results', 'Results', 8, 'number'],
  ['cpa', 'CPA', 9, 'currency'],
  ['target_cpa', 'Target CPA', 10, 'currency'],
  ['difference_cpa', 'Difference CPA', 11, 'formula', 'differenceCpa'],
  ['roas', 'ROAS', 12, 'number'],
  ['target_roas', 'Target ROAS', 13, 'number'],
]);

/**
 * `email_campaigns` — no parent table, so all platform. Two VIRTUAL due dates off the send date
 * (minus 5 and minus 10 days), the copywriting one calling the design one.
 */
const EMAIL_CAMPAIGNS_PLATFORM = platformRows('email_campaigns', [
  ['name', 'Name', 1, 'singleLineText'],
  ['campaign_purpose', 'Campaign Purpose', 2, 'multilineText'],
  ['status', 'Status', 3, 'singleSelect'],
  ['send_date', 'Send Date', 4, 'date'],
  ['copywriting_due_date', 'Copywriting Due Date', 5, 'formula', 'emailCampaignCopywritingDueDate'],
  ['copywriting', 'Copywriting', 6, 'richText'],
  ['design_due_date', 'Design Due Date', 7, 'formula', 'emailCampaignDesignDueDate'],
  ['assignee_id', 'Assignee', 8, 'singleCollaborator'],
  ['copy_link', 'Copy Link', 9, 'url'],
  ['design', 'Design', 10, 'multipleAttachments'],
  ['klaviyo_link', 'Klaviyo Link', 11, 'url'],
  ['assets', 'Assets', 12, 'multipleAttachments'],
  ['type', 'Type', 13, 'singleSelect'],
  ['channel', 'Channel', 14, 'singleSelect'],
  ['email_campaign_campaigns', 'Campaigns & Offers', 15, 'multipleRecordLinks'],
  ['email_campaign_products', '(Internal) Product', 16, 'multipleRecordLinks'],
  ['email_campaign_collections', '(Internal) Collections', 17, 'multipleRecordLinks'],
]);

/**
 * `youtube_copy` — no parent table, so all platform. `copy_number` is the generated Copy # title,
 * which always renders in `font-mono` (CLAUDE.md non-negotiable 6). The gaps in the order follow the
 * Gratsi base's own field positions, which is the only evidence of order a table the parent base
 * does not have can have.
 */
const YOUTUBE_COPY_PLATFORM = platformRows('youtube_copy', [
  ['copy_number', 'Copy #', 1, 'singleLineText'],
  ['status', 'Status', 2, 'singleSelect'],
  ['youtube_copy_collections', 'Collections', 3, 'multipleRecordLinks'],
  ['youtube_copy_products', 'Product', 4, 'multipleRecordLinks'],
  ['angle', 'Angle', 5, 'singleLineText'],
  ['descriptions', 'Descriptions', 6, 'richText'],
  ['headline', 'Headline', 7, 'singleLineText'],
  ['news_feed', 'News Feed', 8, 'singleLineText'],
  ['cta', 'CTA', 9, 'singleSelect'],
  ['youtube_copy_campaigns', 'Campaign Code', 10, 'multipleRecordLinks'],
  ['funnel', 'Funnel', 14, 'singleSelect'],
  ['youtube_copy_copy_types', 'Copy Type', 15, 'multipleRecordLinks'],
  ['client_comment', "Client's Comment", 16, 'multilineText'],
  ['used', 'Used', 20, 'checkbox'],
  ['winning', 'Winning', 21, 'checkbox'],
  ['meta_rating', 'Meta Rating', 22, 'rating'],
]);

/**
 * `copy_types` — the parent base has no Copy Type table, so every column is the platform's.
 *
 * The two link columns are keyed by the junction that carries a foreign key back to `copy_types`.
 * Gratsi's base classifies both as derived because the engine writes nothing from this side, but the
 * junctions exist and the page counts them, so they are columns here and the count is read.
 */
const COPY_TYPES_PLATFORM = platformRows('copy_types', [
  ['name', 'Name', 1, 'singleLineText'],
  ['description', 'Description', 2, 'multilineText'],
  ['youtube_copy_copy_types', 'YouTube copies', 3, 'multipleRecordLinks'],
  ['copywriting_copy_types', 'Meta copies', 4, 'multipleRecordLinks'],
]);

/**
 * Gratsi `(Internal) Copy Type` `tblQiBPj9ypCmYxev` — 4 fields. `Name` and `Description` carry the
 * platform's own labels, so Gratsi inherits those two and holds rows only for the two link columns,
 * which its base words differently.
 */
const COPY_TYPES_GRATSI = childRows('copy_types', [
  ['youtube_copy_copy_types', 'Copywriting', 3, 'relabel-platform', 'multipleRecordLinks'],
  ['copywriting_copy_types', 'Ads Copywriting copy', 4, 'relabel-platform', 'multipleRecordLinks'],
]);

/**
 * Gratsi `Creative Reporting` `tblgW4bwDSSeqihlr` — 14 fields; 3 derived, `Difference CPA` a formula, now a virtual column. Gratsi words every column exactly as the platform set does, so it holds NO rows at all and inherits all thirteen.
 *
 * Its rows are now the PARENT's, since the parent base has no such table and the platform set above
 * was derived from this base's own field names and order. What is left here is only what Gratsi
 * genuinely words differently; the rest are retired by the reconciling seed, which soft-deletes rows
 * the seed itself wrote and no longer lists, so Gratsi inherits identical labels instead of carrying
 * duplicates that would win over the parent for no reason.
 */
const CREATIVE_REPORTING_GRATSI = childRows('creative_reporting', []);

/**
 * The seed, grouped by base: one group per base, so the two naming worlds stay visibly apart.
 *
 * Twenty-one of the twenty-one `PROPAGATION_TABLES` keys appear here. `themes` does not, and cannot
 * until the owner rules on its `table_key`; it is global by constraint, not per-brand.
 */
export const COLUMN_SEED: readonly BrandColumnSeed[] = [
  {
    target: { kind: 'parent' },
    rows: [
      ...PERSONAS_PARENT,
      ...COPYWRITING_PARENT,
      ...CREATIVE_BRIEFS_PARENT,
      ...CREATIVE_BRIEFS_PLATFORM,
      ...CONCEPTS_PARENT,
      ...CONCEPTS_PLATFORM,
      ...ANGLES_PARENT,
      ...ANGLES_PLATFORM,
      ...CREATIVE_MODULES_PARENT,
      ...CREATIVE_MODULES_PLATFORM,
      ...CREATIVE_SHEET_ITEMS_PARENT,
      ...CREATIVE_SHEET_ITEMS_NAME,
      ...CREATIVE_SHEET_ITEMS_PLATFORM,
      ...CREATORS_PARENT,
      ...CREATORS_PLATFORM,
      ...AI_CHARACTERS_PARENT,
      ...COLLECTIONS_PARENT,
      ...PRODUCTS_PARENT,
      ...PRODUCTS_PLATFORM,
      ...CAMPAIGNS_OFFERS_PARENT,
      ...CREATIVE_DIMENSIONS_PARENT,
      ...COPY_TYPES_PLATFORM,
      ...SM_CAMPAIGN_FEED_PLATFORM,
      ...EMAIL_FLOWS_PLATFORM,
      ...CREATIVE_REPORTING_PLATFORM,
      ...EMAIL_CAMPAIGNS_PLATFORM,
      ...YOUTUBE_COPY_PLATFORM,
      ...COMPETITIVE_RESEARCH_PARENT,
      ...CLIENT_ASSET_FOLDERS_PARENT,
    ],
  },
  {
    target: { kind: 'slug', slug: 'gratsi' },
    rows: [
      ...PERSONAS_GRATSI,
      ...COPYWRITING_GRATSI,
      ...CREATIVE_BRIEFS_GRATSI,
      ...CREATIVE_BRIEFS_GRATSI_VIRTUAL,
      ...CONCEPTS_GRATSI,
      ...ANGLES_GRATSI,
      ...CREATIVE_MODULES_GRATSI,
      ...CREATIVE_SHEET_ITEMS_GRATSI,
      ...CREATORS_GRATSI,
      ...AI_CHARACTERS_GRATSI,
      ...COLLECTIONS_GRATSI,
      ...PRODUCTS_GRATSI,
      ...CAMPAIGNS_OFFERS_GRATSI,
      ...YOUTUBE_COPY_GRATSI,
      ...EMAIL_CAMPAIGNS_GRATSI,
      ...EMAIL_FLOWS_GRATSI,
      ...SM_CAMPAIGN_FEED_GRATSI,
      ...COPY_TYPES_GRATSI,
      ...CREATIVE_REPORTING_GRATSI,
    ],
  },
];

export interface ColumnSeedResult {
  readonly brand: string;
  readonly brandId: string;
  readonly written: number;
  /**
   * Rows the seed wrote on a previous run and no longer lists, soft-deleted. The Angles rollout
   * created seven of these on Gratsi in one go (nine child-added rows became two relabels), and
   * without reconciliation they would have stayed in the database and WON over the parent's new
   * platform rows — so production would have resolved a different column set from the tests.
   */
  readonly retired: readonly string[];
}

/**
 * Apply the seed. Idempotent: every row goes through `upsertColumnDefinition`, which is keyed on
 * (brand, table, column), so a re-run updates rather than duplicating. A brand the database does not
 * have is skipped and reported rather than failing the whole seed.
 */
/**
 * Every table the seed has an opinion about, across ALL groups. The reconciler's scope: a table in
 * here may have the seed's own stale rows cleaned up on any brand, and a table absent from it
 * (`themes`) is never touched.
 *
 * Computed on call rather than at module load, because `COLUMN_SEED` is declared further down this
 * file and a module-level const reading it here would sit in its temporal dead zone.
 */
function seededTableKeys(): readonly string[] {
  return [...new Set(COLUMN_SEED.flatMap((group) => group.rows.map((row) => row.tableKey)))];
}

/**
 * Soft-delete the rows this seed wrote before and no longer lists, for the tables it DOES list.
 *
 * The seed is an upsert, which is what makes it safe to re-run — but upsert-only means a row removed
 * from `COLUMN_SEED` lives on in the database and keeps winning, because a child row always beats
 * the parent's. The Angles rollout turned nine Gratsi child-added rows into two relabels, so seven
 * rows would have stayed behind and Gratsi would have resolved its OLD labels and order in
 * production while the tests, running on a fresh database, proved the new ones. A seed that cannot
 * remove its own mistakes is a seed that drifts.
 *
 * IT ONLY EVER TOUCHES ITS OWN ROWS. The filter is `created_by = actorId`, so a row an admin made in
 * Column Admin — the whole point of the feature — is never removed by a re-seed, even when the seed
 * has nothing to say about that column.
 *
 * THE SCOPE IS EVERY TABLE THE SEED COVERS, not the tables this GROUP lists, and the difference is
 * load-bearing. Scoping per group left 42 stale Gratsi rows behind the moment a group stopped
 * listing a table at all: emptying `EMAIL_CAMPAIGNS_GRATSI` and the three like it meant the Gratsi
 * group no longer named those tables, so the reconciler skipped them and their old `custom` rows
 * survived — and a child row always wins, so Gratsi would have resolved stored columns where the
 * parent now has VIRTUAL ones, pointing four pages at columns that do not exist. Found by a dry run
 * against production before anything was written. The union across groups is the honest
 * precondition: "the seed has an opinion about this table". `themes` is in no group at all, so it is
 * still left completely alone.
 *
 * Soft delete, never `DELETE FROM` (CLAUDE.md): the row is recoverable and the audit trail stays.
 */
async function retireUnseededRows(
  db: Db,
  brandId: string,
  rows: readonly UpsertColumnDefinition[],
  actorId: string,
): Promise<readonly string[]> {
  const tableKeys = seededTableKeys();
  if (tableKeys.length === 0) return [];
  const seeded = new Set(rows.map((row) => `${row.tableKey}.${row.columnKey}`));
  const existing = await db
    .select({
      id: columnDefinitions.id,
      tableKey: columnDefinitions.tableKey,
      columnKey: columnDefinitions.columnKey,
    })
    .from(columnDefinitions)
    .where(
      and(
        eq(columnDefinitions.brandId, brandId),
        isNull(columnDefinitions.deletedAt),
        eq(columnDefinitions.createdBy, actorId),
        inArray(columnDefinitions.tableKey, tableKeys),
      ),
    );

  const retired: string[] = [];
  for (const row of existing) {
    const pair = `${row.tableKey}.${row.columnKey}`;
    if (seeded.has(pair)) continue;
    await db
      .update(columnDefinitions)
      .set({ deletedAt: new Date(), updatedBy: actorId, updatedAt: new Date() })
      .where(eq(columnDefinitions.id, row.id));
    retired.push(pair);
  }
  return retired;
}

export async function seedColumnDefinitions(
  db: Db,
  actorId = 'column-seed',
): Promise<ColumnSeedResult[]> {
  const results: ColumnSeedResult[] = [];
  for (const group of COLUMN_SEED) {
    const label = group.target.kind === 'parent' ? 'parent' : group.target.slug;
    const [brand] =
      group.target.kind === 'parent'
        ? await db
            .select({ id: brands.id })
            .from(brands)
            .where(eq(brands.isTemplate, true))
            .limit(1)
        : await db
            .select({ id: brands.id })
            .from(brands)
            .where(eq(brands.slug, group.target.slug))
            .limit(1);
    if (brand === undefined) {
      results.push({ brand: label, brandId: '(absent)', written: 0, retired: [] });
      continue;
    }
    for (const row of group.rows) await upsertColumnDefinition(db, brand.id, row, actorId);
    const retired = await retireUnseededRows(db, brand.id, group.rows, actorId);
    results.push({ brand: label, brandId: brand.id, written: group.rows.length, retired });
  }
  return results;
}
