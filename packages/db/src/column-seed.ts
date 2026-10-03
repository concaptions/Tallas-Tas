import { eq } from 'drizzle-orm';

import { upsertColumnDefinition, type UpsertColumnDefinition } from './column-definitions';
import type { Db } from './db';
import { brands } from './schema';

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
 */
type ChildKind = 'relabel' | 'custom' | 'hidden' | 'hidden-custom';

type ChildColumn = readonly [
  columnKey: string,
  displayLabel: string,
  displayOrder: number,
  kind: ChildKind,
  fieldType: string,
];

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
    // has a parent counterpart may claim `parent`.
    source:
      kind === 'custom' || kind === 'hidden-custom' ? ('custom' as const) : ('parent' as const),
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
const CREATIVE_BRIEFS_GRATSI = childRows('creative_briefs', [
  ['batch', 'Batch', 8, 'custom', 'singleSelect'],
  ['language', 'Language', 16, 'custom', 'singleSelect'],
  ['inspiration_image', 'Inspiration', 19, 'relabel', 'multipleAttachments'],
  ['brief_to_design', 'Brief to Design/Editing', 20, 'relabel', 'richText'],
  ['script_content', 'Script / Ad Content', 21, 'custom', 'richText'],
  ['offer', 'Offer', 27, 'custom', 'richText'],
  ['spelling_feedback_2', 'Spelling Feedback 2', 33, 'custom', 'multilineText'],
  ['collection_id', '(Internal) Collections 3', 36, 'relabel', 'multipleRecordLinks'],
  ['ad_content', 'Ad Content', 22, 'hidden', 'richText'],
  ['campaign_offer_id', 'Campaigns & Offers', 25, 'hidden', 'multipleRecordLinks'],
  ['asset_id', 'Assets', 28, 'hidden', 'multipleRecordLinks'],
]);

/**
 * `Concepts` `tblRlcp1ibmS7U7HG` — 22 fields, 8 of them lookups and 1 a formula.
 *
 * `Name` (field 1) is a FORMULA in the parent — `{Batch} & "-" & {Angles} & "-" & {Themes}`, the
 * concept name of CLAUDE.md non-negotiable 6 — so under rule 1 it gets no row even though
 * `concepts.name` is a stored, displayed column. That consequence is a decision-doc line.
 * `Themes` (field 3) gets no row either: the parent's link points at the table LABELLED `Themes`
 * which is Creative-Modules shaped, and the parent audit could not establish its junction.
 */
const CONCEPTS_PARENT = parentRows('concepts', [
  ['batch', 'Batch', 2, 'singleSelect'],
  ['concept_angles', 'Angles', 4, 'multipleRecordLinks'],
  ['category', 'Category', 6, 'singleSelect'],
  ['concept_style', 'Concept Style', 7, 'singleSelect'],
  ['approval_status', 'Approval Status', 8, 'singleSelect'],
  ['hook_examples', 'Hook examples', 12, 'multilineText'],
  ['script_idea', 'Script idea', 13, 'multilineText'],
  ['formats_to_create', 'Formats to create', 18, 'multipleSelects'],
  ['production_status', 'Production Status', 19, 'singleSelect'],
  ['ad_inspo_links', 'Ad Inspo', 20, 'multilineText'],
  ['creator_concepts', 'Creator', 21, 'multipleRecordLinks'],
]);

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
  ['concept_themes', 'Theme', 3, 'custom', 'multipleSelects'],
  ['concept_angles', 'Angle', 4, 'relabel', 'multipleRecordLinks'],
  ['concept_style', 'Style', 6, 'relabel', 'singleSelect'],
  ['formats', 'Type', 8, 'custom', 'multipleSelects'],
  ['angle_products', 'Product', 10, 'custom', 'multipleRecordLinks'],
  ['angle_personas', 'Personas', 11, 'custom', 'multipleRecordLinks'],
  ['approval_status', 'Status', 12, 'relabel', 'singleSelect'],
  ['description', 'Decription', 13, 'custom', 'multilineText'],
  ['script_idea', 'Script', 14, 'relabel', 'richText'],
  ['concept_collections', 'Collection', 15, 'custom', 'multipleRecordLinks'],
  ['pain_points', 'Pain Points', 16, 'custom', 'richText'],
  ['usp', 'USP', 17, 'custom', 'richText'],
  ['hook_examples', 'Hooks', 18, 'relabel', 'richText'],
  ['client_comments', "Client's Comments", 19, 'custom', 'multilineText'],
  ['formats_to_create', 'Formats to create', 18, 'hidden', 'multipleSelects'],
  ['ad_inspo_links', 'Ad Inspo', 20, 'hidden', 'multilineText'],
  ['creator_concepts', 'Creator', 21, 'hidden', 'multipleRecordLinks'],
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
 * Gratsi `Angles` — 21 fields, nine of them child-added. The five hidden rows are the level shift
 * seen from this side: Gratsi keeps `Type`, `Product`, `Personas`, `Pain Points` and `USP` on
 * Concepts, so its Angles table has no field for them. Hiding is per base and never a drop —
 * `angle_personas` holds 78 Gratsi rows and `angle_products` 57, inferred from the Concepts side,
 * and every other brand still shows the columns.
 */
const ANGLES_GRATSI = childRows('angles', [
  ['status', 'Status', 2, 'custom', 'singleSelect'],
  ['potential', 'Potential', 3, 'custom', 'singleSelect'],
  ['formats', 'Formats to create', 10, 'custom', 'multipleSelects'],
  ['client_notes', 'Client Notes', 11, 'custom', 'multilineText'],
  ['brief_url', 'Brief', 13, 'custom', 'url'],
  ['exact_script_url', 'Exact Script', 14, 'custom', 'url'],
  ['ad_inspo_links', 'Ad Inspo', 15, 'custom', 'multilineText'],
  ['winning', 'Winning', 16, 'custom', 'checkbox'],
  ['internal_notes', 'Internal Notes', 17, 'custom', 'multilineText'],
  ['type', 'Type', 2, 'hidden', 'multipleSelects'],
  ['angle_products', 'Product', 3, 'hidden', 'multipleRecordLinks'],
  ['angle_personas', 'Personas', 5, 'hidden', 'multipleRecordLinks'],
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

/** Gratsi `(Internal) Creative Modules` — 4 fields: 2 inherit, 2 of its own. */
const CREATIVE_MODULES_GRATSI = childRows('creative_modules', [
  ['foreplay_link', 'Foreplay Link', 3, 'custom', 'url'],
  ['creative_module_designs', '(Internal) Creative Design', 4, 'custom', 'multipleRecordLinks'],
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
 * Gratsi `Creative Sheet` — 29 fields, 16 derived: the table is almost entirely lookups through
 * `Creative Name`. `creative_sheet_items` holds ZERO rows in production for every brand against 377
 * live Airtable records, so this is the least-exercised column map in the seed; flagged, not
 * smoothed over.
 */
const CREATIVE_SHEET_ITEMS_GRATSI = childRows('creative_sheet_items', [
  ['internal_status', 'Internal Status', 10, 'custom', 'singleSelect'],
  ['qa_checklist_doc', 'QA Checklist Doc', 12, 'custom', 'multipleAttachments'],
  ['qa_video_editor', 'Video Editor QA', 13, 'custom', 'checkbox'],
  ['qa_designer', 'Graphic Designer QA', 14, 'custom', 'checkbox'],
  ['qa_strategist', 'Creative Strategist QA', 15, 'custom', 'checkbox'],
  ['used', 'Used', 23, 'custom', 'checkbox'],
  ['denied_revisions_needed', 'Denied/revisions needed', 24, 'custom', 'checkbox'],
  ['winning', 'Winning', 25, 'custom', 'singleSelect'],
  ['spell_check_requested', 'Click for AI Spell Checker Again', 28, 'custom', 'checkbox'],
  ['spelling_feedback', 'Spelling Feedback', 29, 'custom', 'multilineText'],
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
 * junction, so both get a row and neither is guessed into the other.
 */
const CREATORS_GRATSI = childRows('creators', [
  ['creator_concepts', 'Concept to film', 7, 'relabel', 'multipleRecordLinks'],
  ['video_intro_url', "Creator's video Intro", 11, 'relabel', 'multipleAttachments'],
  ['internal_brief', 'Additional Note - TAS Team', 16, 'relabel', 'richText'],
  ['creator_cost', "Creator's cost (USD) - Internal", 17, 'custom', 'currency'],
  ['internal_creator_status', 'Creator Status', 22, 'relabel', 'singleSelect'],
  ['cost_usd', 'Paid by TAS', 23, 'custom', 'currency'],
  ['payment_date', 'Payment Date', 24, 'custom', 'date'],
  ['concept_ids', 'Concepts', 25, 'custom', 'multipleRecordLinks'],
  ['creator_info_request', 'Creator Info Request', 26, 'custom', 'richText'],
  ['slack_notified', 'Slack Notified ', 30, 'custom', 'checkbox'],
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
 * `(Internal) Product` `tblfvfJMYNBz2OYYw` — 8 fields, SIX of them reverse links owned by the other
 * table. Only two seed. `products.collection_link` is a stored column neither base has a field for.
 */
const PRODUCTS_PARENT = parentRows('products', [
  ['name', 'Product Name / Landing Page Name', 1, 'multilineText'],
  ['link', 'Link', 2, 'url'],
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
]);

/**
 * GRATSI-ONLY TABLES. Six tables the parent base does not have at all, so every row is child-added
 * and there is nothing to inherit or hide. Five of the six hold zero live records, so their
 * classification rests on metadata and on the engine's row builders.
 */

/** Gratsi `Youtube Copywriting` `tblVR1UmkbDoDzJ7z` — 29 fields: 16 stored, 12 derived, 1 banner. */
const YOUTUBE_COPY_GRATSI = childRows('youtube_copy', [
  ['copy_number', 'Copy #', 1, 'custom', 'singleLineText'],
  ['status', 'Status', 2, 'custom', 'singleSelect'],
  ['youtube_copy_collections', 'Collections', 3, 'custom', 'multipleRecordLinks'],
  ['youtube_copy_products', 'Product', 4, 'custom', 'multipleRecordLinks'],
  ['angle', 'Angle', 5, 'custom', 'singleLineText'],
  ['descriptions', 'Descriptions (90 caractères max)', 6, 'custom', 'richText'],
  ['headline', 'Headline', 7, 'custom', 'singleLineText'],
  ['news_feed', 'News Feed', 8, 'custom', 'singleLineText'],
  ['cta', 'CTA', 9, 'custom', 'singleSelect'],
  ['youtube_copy_campaigns', 'Campaign Code', 10, 'custom', 'multipleRecordLinks'],
  ['funnel', 'Funnel', 14, 'custom', 'singleSelect'],
  ['youtube_copy_copy_types', 'Copy Type', 15, 'custom', 'multipleRecordLinks'],
  ['client_comment', "Client's Comment", 16, 'custom', 'multilineText'],
  ['used', 'USED', 20, 'custom', 'checkbox'],
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

/** Gratsi `Email Campaigns Management` `tblABjVpwRpYtY7de` — 17 fields; 2 formula due dates. */
const EMAIL_CAMPAIGNS_GRATSI = childRows('email_campaigns', [
  ['name', 'Name', 1, 'custom', 'singleLineText'],
  ['campaign_purpose', 'Campaign Purpose', 2, 'custom', 'multilineText'],
  ['status', 'Status', 3, 'custom', 'singleSelect'],
  ['send_date', 'Send Date', 4, 'custom', 'date'],
  ['copywriting', 'Copywriting', 6, 'custom', 'richText'],
  ['assignee_id', 'Assignee', 8, 'custom', 'singleCollaborator'],
  ['copy_link', 'Copy Link', 9, 'custom', 'url'],
  ['design', 'Design', 10, 'custom', 'multipleAttachments'],
  ['klaviyo_link', 'Klaviyo Link', 11, 'custom', 'url'],
  ['assets', 'Assets', 12, 'custom', 'multipleAttachments'],
  ['type', 'Type', 13, 'custom', 'singleSelect'],
  ['channel', 'Channel', 14, 'custom', 'singleSelect'],
  ['email_campaign_campaigns', 'Campaigns & Offers', 15, 'custom', 'multipleRecordLinks'],
  ['email_campaign_products', '(Internal) Product', 16, 'custom', 'multipleRecordLinks'],
  ['email_campaign_collections', '(Internal) Collections', 17, 'custom', 'multipleRecordLinks'],
]);

/** Gratsi `Email Flows Management` `tblubVflAQZgJSxcF` — 13 fields; the same due-date chain. */
const EMAIL_FLOWS_GRATSI = childRows('email_flows', [
  ['flow_name', 'Flow Name', 1, 'custom', 'singleLineText'],
  ['expected_setup_date', 'Expected Setup Date', 2, 'custom', 'date'],
  ['flow_purpose', 'Flow Purpose', 3, 'custom', 'multilineText'],
  ['status', 'Status', 4, 'custom', 'singleSelect'],
  ['copywriting', 'Copywriting', 7, 'custom', 'richText'],
  ['design', 'Design', 8, 'custom', 'multipleAttachments'],
  ['klaviyo_link', 'Klaviyo Link', 9, 'custom', 'url'],
  ['type', 'Type', 10, 'custom', 'singleSelect'],
  ['email_flow_campaigns', 'Campaigns & Offers', 11, 'custom', 'multipleRecordLinks'],
  ['inspo', 'Inspo', 12, 'custom', 'multipleAttachments'],
  ['assignee_id', 'Assignee', 13, 'custom', 'singleCollaborator'],
]);

/** Gratsi `SM Campaign Management Feed` `tblLRajTW55XEhVhk` — 6 fields; `Reminder Trigger` is a formula. */
const SM_CAMPAIGN_FEED_GRATSI = childRows('sm_campaign_feed_tasks', [
  ['task_name', 'Task Name', 1, 'custom', 'singleLineText'],
  ['platform', 'Platform', 2, 'custom', 'singleSelect'],
  ['due_date', 'Due Date', 3, 'custom', 'dateTime'],
  ['status', 'Status', 4, 'custom', 'singleSelect'],
  ['notes', 'Notes', 5, 'custom', 'multilineText'],
]);

/** Gratsi `(Internal) Copy Type` `tblQiBPj9ypCmYxev` — 4 fields; 2 are the copy tables' reverse links. */
const COPY_TYPES_GRATSI = childRows('copy_types', [
  ['name', 'Name', 1, 'custom', 'singleLineText'],
  ['description', 'Description', 2, 'custom', 'multilineText'],
]);

/** Gratsi `Creative Reporting` `tblgW4bwDSSeqihlr` — 14 fields; 3 derived, `Difference CPA` a formula. */
const CREATIVE_REPORTING_GRATSI = childRows('creative_reporting', [
  ['name_angle_offer', 'Name + Angle + Offer', 2, 'custom', 'singleLineText'],
  ['notes', 'Notes', 3, 'custom', 'multilineText'],
  ['ad_design', 'Ad Design', 4, 'custom', 'multipleAttachments'],
  ['ad_link', 'Ad Link', 5, 'custom', 'singleLineText'],
  ['ctr', 'CTR', 6, 'custom', 'percent'],
  ['thumb_stop_rate', 'Thumb-Stop Rate', 7, 'custom', 'number'],
  ['results', 'Results', 8, 'custom', 'number'],
  ['cpa', 'CPA', 9, 'custom', 'currency'],
  ['target_cpa', 'Target CPA', 10, 'custom', 'currency'],
  ['roas', 'ROAS', 12, 'custom', 'number'],
  ['target_roas', 'Target ROAS', 13, 'custom', 'number'],
]);

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
      ...CONCEPTS_PARENT,
      ...ANGLES_PARENT,
      ...CREATIVE_MODULES_PARENT,
      ...CREATIVE_SHEET_ITEMS_PARENT,
      ...CREATORS_PARENT,
      ...AI_CHARACTERS_PARENT,
      ...COLLECTIONS_PARENT,
      ...PRODUCTS_PARENT,
      ...CAMPAIGNS_OFFERS_PARENT,
      ...CREATIVE_DIMENSIONS_PARENT,
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
      ...CONCEPTS_GRATSI,
      ...ANGLES_GRATSI,
      ...CREATIVE_MODULES_GRATSI,
      ...CREATIVE_SHEET_ITEMS_GRATSI,
      ...CREATORS_GRATSI,
      ...AI_CHARACTERS_GRATSI,
      ...COLLECTIONS_GRATSI,
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
}

/**
 * Apply the seed. Idempotent: every row goes through `upsertColumnDefinition`, which is keyed on
 * (brand, table, column), so a re-run updates rather than duplicating. A brand the database does not
 * have is skipped and reported rather than failing the whole seed.
 */
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
      results.push({ brand: label, brandId: '(absent)', written: 0 });
      continue;
    }
    for (const row of group.rows) await upsertColumnDefinition(db, brand.id, row, actorId);
    results.push({ brand: label, brandId: brand.id, written: group.rows.length });
  }
  return results;
}
