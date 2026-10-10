import { describe, expect, it } from 'vitest';

import { resolveColumns, type ResolvedColumn } from './column-definitions';
import { seedColumnDefinitions } from './column-seed';
import { seed } from './seed';
import { brands } from './schema';
import { eq } from 'drizzle-orm';
import { testDb } from './testing';

/**
 * GRATSI-MATCH (2026-10-04), the links cluster: six tables whose displayed Gratsi columns must read
 * as the Gratsi Airtable base does — `angles`, `creative_briefs`, `concepts`, `products`,
 * `creators`, `creative_reporting`.
 *
 * Each describe states the table's FULL Airtable field list verbatim, in the live base's own field
 * order (`docs/audits/overnight-gratsi-columns.md`, re-verified by the 2026-10-04 live diff), then
 * the named exclusions — rule-5 remnants and standing-ruling conflicts, each with its reason — and
 * asserts that Gratsi resolves to exactly the list minus the exclusions, in order. A field that
 * silently leaves the seed, or a remnant that quietly becomes a column, fails here by name.
 */

async function gratsiColumns(tableKey: string): Promise<readonly ResolvedColumn[]> {
  const db = await testDb();
  await seed(db);
  await seedColumnDefinitions(db);
  const [gratsi] = await db.select({ id: brands.id }).from(brands).where(eq(brands.slug, 'gratsi'));
  if (gratsi === undefined) throw new Error('the seed has no gratsi brand');
  return resolveColumns(db, gratsi.id, tableKey);
}

/** The Airtable list minus the named exclusions, order kept — what Gratsi must resolve to. */
function expectedLabels(
  airtableFields: readonly string[],
  excluded: ReadonlySet<string>,
): readonly string[] {
  return airtableFields.filter((field) => !excluded.has(field));
}

describe('GRATSI-MATCH · angles', () => {
  /** The Gratsi `Angles` table (`tblRlcp1ibmS7U7HG`), all 21 fields in live field order. */
  const AIRTABLE_ANGLES: readonly string[] = [
    'Name',
    'Status',
    'Potential',
    'Description',
    'Creators',
    'Concepts',
    'Product (from Angles)',
    'Personas (from Angles)',
    '(Internal) Creative Modules',
    'Formats to create',
    'Client Notes',
    '(Internal) Creative Design',
    'Brief',
    'Exact Script',
    'Ad Inspo',
    'Winning',
    'Internal Notes',
    'Creative Sheet',
    '(Internal) Creative Design 2',
    'UGC Management copy',
    'Concepts copy',
  ];

  /*
   * Deliberately excluded, each by name (none may be invented as a column):
   *  (FLIPPED 2026-10-04: `Creators` is now SHOWN fidelity-empty as the `creators_link` virtual —
   *  storage still does not exist; the operator chose exact-Airtable fidelity over omission.)
   *  - formerly `Creators` — a link to UGC Management with NO stored inverse anywhere in the schema
   *    (no junction, no FK; `import-mappings.ts` angles › Creators: handler 'skip', "empty on all
   *    43 live rows; excluded in docs/decisions.md"). Storage does not exist, so per the no-new-
   *    storage rule it stays a decision-doc flag, not a column.
   *  - `(Internal) Creative Design` — residual single-line text left by a converted link (rule 5;
   *    exclusion register, 1/43 and a stale snapshot of the live link).
   *  - `Creative Sheet` — residual single-line text, 0/43 (rule 5; exclusion register).
   *  - `UGC Management copy` — residual single-line text, 0/43 (rule 5; exclusion register).
   *  - `Concepts copy` — residual single-line text whose pairs the live `Concepts` link already
   *    carries (rule 5; exclusion register).
   */
  const EXCLUDED = new Set([
    '(Internal) Creative Design',
    'Creative Sheet',
    'UGC Management copy',
    'Concepts copy',
  ]);

  it('resolves exactly the Airtable list minus the named exclusions, in Airtable order', async () => {
    const resolved = await gratsiColumns('angles');
    expect(resolved.map((column) => column.displayLabel)).toEqual(
      expectedLabels(AIRTABLE_ANGLES, EXCLUDED),
    );
  });

  it('keys each reverse link by the table that points back at angles, display-only', async () => {
    const resolved = await gratsiColumns('angles');
    const byLabel = new Map(resolved.map((column) => [column.displayLabel, column]));

    // Reverse links (diff annotation 6): grid display of links the OTHER table stores.
    expect(byLabel.get('Concepts')?.columnKey).toBe('concept_angles');
    expect(byLabel.get('(Internal) Creative Modules')?.columnKey).toBe('creative_module_angles');
    expect(byLabel.get('(Internal) Creative Design 2')?.columnKey).toBe('creative_briefs');
    // The two Concepts-side lookups are the platform's own junctions, relabelled, not new storage.
    expect(byLabel.get('Product (from Angles)')?.columnKey).toBe('angle_products');
    expect(byLabel.get('Personas (from Angles)')?.columnKey).toBe('angle_personas');
    // Every reverse link is backed by a real junction/FK — except the fidelity-empty Creators
    // column (flip 2026-10-04), which is virtual by design: no storage exists for it.
    expect(byLabel.get('Creators')?.columnKey).toBe('creators_link');
    expect(byLabel.get('Creators')?.formula).toBe('lookupRollup');
    expect(
      resolved.every((column) => column.formula === null || column.columnKey === 'creators_link'),
    ).toBe(true);
  });
});

describe('GRATSI-MATCH · creative_briefs', () => {
  /** Gratsi `Creative Design (Internal & Interface)` (`tblhU5yVNhVDwykUt`), all 42 live fields. */
  const AIRTABLE_CREATIVE_DESIGN: readonly string[] = [
    'Name',
    'Type',
    'Priority',
    'Internal Status',
    'Client Status',
    'Performance',
    'Assignee',
    'Batch',
    'QA Checklist Doc',
    'Video Editor QA',
    'Graphic Designer QA',
    'Creative Strategist QA',
    'Angle',
    'Concept',
    '(Internal) Product',
    'Language',
    'Design File',
    'Design Link URL',
    'Inspiration',
    'Brief to Design/Editing',
    'Script / Ad Content',
    'Platform',
    'Dimensions',
    'Source',
    'Funnel',
    'Elements we are Testing',
    'Offer',
    'Creative Module',
    'Last Modified',
    'Created',
    'Click for AI Spell Checker Again',
    'Spelling Feedback',
    'Spelling Feedback 2',
    'Created 2',
    '(Internal) Collections 2',
    '(Internal) Collections 3',
    'Creative Sheet',
    'Ads Copywriting copy',
    'Copywriting',
    'Script & brief breakdown ',
    'Angles',
    'Concepts (from Angles)',
  ];

  /*
   * Deliberately excluded, each by name:
   *  - `Created 2` — a second createdTime system field, a duplication remnant (rule 5; the first
   *    one, `Created`, displays `created_at`).
   *  - `(Internal) Collections 2` — residual single-line text left by a converted link (rule 5;
   *    the live link is `(Internal) Collections 3` → `collection_id`).
   *  (FLIPPED 2026-10-04: `Ads Copywriting copy` is now SHOWN fidelity-empty as the
   *  `ads_copywriting_copy` virtual — its stored side still does not exist (`copywriting` carries
   *  ONE brief FK, `creative_brief_id`, which `Copywriting` reverses); the operator chose
   *  exact-Airtable fidelity over omission.)
   *  - `Angles` — residual single-line text; the real link is the `Angle` field → `angle_id`
   *    (rule 5).
   * And one deliberate ADDITION the strict rule would call a leak: `Due Date`, kept visible by
   * the standing AI-49 ruling (Talal asked for it), recorded in the same decisions entry.
   */
  const EXCLUDED = new Set(['Created 2', '(Internal) Collections 2', 'Angles']);

  it('resolves the Airtable list minus the named exclusions, plus the AI-49 Due Date', async () => {
    const resolved = await gratsiColumns('creative_briefs');
    expect(resolved.map((column) => column.displayLabel)).toEqual([
      ...expectedLabels(AIRTABLE_CREATIVE_DESIGN, EXCLUDED),
      'Due Date',
    ]);
  });

  it('keys the reverse links, system fields and the lookup to what really backs them', async () => {
    const resolved = await gratsiColumns('creative_briefs');
    const byLabel = new Map(resolved.map((column) => [column.displayLabel, column]));

    // Reverse links: the table that carries the FK/junction back to creative_briefs.
    expect(byLabel.get('Creative Module')?.columnKey).toBe('creative_module_designs');
    expect(byLabel.get('Creative Sheet')?.columnKey).toBe('creative_sheet_items');
    expect(byLabel.get('Copywriting')?.columnKey).toBe('copywriting');
    // Airtable's system fields display the shared columns — no migration (diff annotation 3).
    expect(byLabel.get('Last Modified')?.columnKey).toBe('updated_at');
    expect(byLabel.get('Created')?.columnKey).toBe('created_at');
    // The lookup is virtual: formula-backed, never stored, never writable.
    const lookup = byLabel.get('Concepts (from Angles)');
    expect(lookup?.columnKey).toBe('concepts_from_angles');
    expect(lookup?.formula).toBe('briefConceptsFromAngles');
    // The fidelity-empty flip (2026-10-04): shown, virtual, storing nothing.
    const adsCopy = byLabel.get('Ads Copywriting copy');
    expect(adsCopy?.columnKey).toBe('ads_copywriting_copy');
    expect(adsCopy?.formula).toBe('lookupRollup');
  });
});

describe('GRATSI-MATCH · concepts', () => {
  /** The Gratsi `Concepts` table (`tbl4UFSFcynlS2Pkn`), all 23 fields in live field order. */
  const AIRTABLE_CONCEPTS: readonly string[] = [
    'Name',
    'Batch',
    'Theme',
    'Angle',
    'Category',
    'Style',
    'Production Status',
    'Type',
    'Performance',
    'Product',
    'Personas',
    'Status',
    'Decription',
    'Script',
    'Collection',
    'Pain Points',
    'USP',
    'Hooks',
    "Client's Comments",
    'UGC Management',
    'Campaigns & Offers',
    '(Internal) Creative Design',
    'UGC Management copy',
  ];

  /*
   * Deliberately excluded, each by name:
   *  - `Production Status` — RULING CONFLICT. Talal's 2026-09-28 "take it out" (AI-34) hid the
   *    column everywhere, 73 live values kept; the strict Gratsi-matches-Airtable rule would
   *    resurface it. The standing ruling wins pending a new one (docs/decisions.md, GRATSI-MATCH
   *    entry) — NOT resurfaced here.
   *  - `UGC Management copy` — residual single-line text left by a converted link (rule 5); the
   *    live `UGC Management` link resolves through `creator_concepts`.
   */
  // FLIPPED 2026-10-04: Production Status is shown again for Gratsi (the base has it; AI-34's
  // hide stands everywhere else).
  const EXCLUDED = new Set(['UGC Management copy']);

  it('resolves exactly the Airtable list minus the named exclusions, in Airtable order', async () => {
    const resolved = await gratsiColumns('concepts');
    // SMOKE-18 (Talal's Option B, 2026-10-11): the base's `Status` IS the client's approval —
    // 0064 moved the data to client_approval_status and the legacy approval_status is hidden, so
    // Gratsi's slot shows the platform column under the platform's own label, same position.
    expect(resolved.map((column) => column.displayLabel)).toEqual(
      expectedLabels(AIRTABLE_CONCEPTS, EXCLUDED).map((label) =>
        label === 'Status' ? 'Client Approval' : label,
      ),
    );
  });

  it('keys the links and the lookup to what really backs them, display-only', async () => {
    const resolved = await gratsiColumns('concepts');
    const byLabel = new Map(resolved.map((column) => [column.displayLabel, column]));

    // The base's `UGC Management` IS the creator_concepts junction, relabelled back to visible.
    expect(byLabel.get('UGC Management')?.columnKey).toBe('creator_concepts');
    // Reverse links (diff annotation 6): campaign_concepts and creative_briefs.concept_id.
    expect(byLabel.get('Campaigns & Offers')?.columnKey).toBe('campaign_concepts');
    expect(byLabel.get('(Internal) Creative Design')?.columnKey).toBe('creative_briefs');
    // Performance is the VIRTUAL lookup through the briefs — concepts stores no such column.
    const performance = byLabel.get('Performance');
    expect(performance?.columnKey).toBe('performance');
    expect(performance?.formula).toBe('conceptPerformance');
    // The primary field reads under the base's own word, still the platform's own column.
    const name = byLabel.get('Name');
    expect(name?.columnKey).toBe('name');
    expect(name?.source).toBe('platform');
  });
});

describe('GRATSI-MATCH · products', () => {
  /*
   * The Gratsi `(Internal) Product` table (`tblfvfJMYNBz2OYYw`), all 11 fields in live order:
   *   1 Product Name / Landing Page Name · 2 Link · 3 (Internal) Creative Design 2 (text) ·
   *   4 Angles · 5 Table 17 · 6+7 Email Campaigns Management copy ×2 (text) ·
   *   8 Youtube Copywriting · 9 Creative Sheet (text) · 10 (Internal) Creative Design ·
   *   11 UGC Management
   *
   * Deliberately excluded, each by name (rule 5 — duplication remnants, never columns):
   *  - `(Internal) Creative Design 2` — residual text, 0/6; the structured link is
   *    `(Internal) Creative Design` → `creative_briefs.product_id`.
   *  - `Email Campaigns Management copy` (both copies) — residual text, 0/6 each.
   *  - `Creative Sheet` — residual text, 0/6.
   * And one KEPT-LABEL decision: Airtable's field at position 5 is literally named `Table 17`;
   * its data IS the `email_campaign_products` junction, which renders under the platform's
   * working label `Email Campaigns` — the junk auto-name is flagged in docs/decisions.md, not
   * adopted. The diff's near-name relabel candidate (`Email Campaigns Management copy` ↔
   * `Email Campaigns`) is likewise NOT taken: that name is itself a remnant.
   *
   * The two platform leaks the diff lists — `Collection Link`, `Concepts` — are hidden child
   * rows now (no Gratsi Product field backs either); the parent keeps both.
   */
  const EXPECTED_PRODUCTS: readonly string[] = [
    'Product Name / Landing Page Name',
    'Link',
    'Angles',
    'Email Campaigns',
    'Youtube Copywriting',
    '(Internal) Creative Design',
    'UGC Management',
  ];

  it('resolves the seven real fields in live order; remnants and leaks never resolve', async () => {
    const resolved = await gratsiColumns('products');
    expect(resolved.map((column) => column.displayLabel)).toEqual(EXPECTED_PRODUCTS);
    for (const leaked of ['collection_link', 'concepts']) {
      expect(resolved.map((column) => column.columnKey)).not.toContain(leaked);
    }
  });

  it('keys every link column by the table that carries the FK back to products', async () => {
    const resolved = await gratsiColumns('products');
    expect(resolved.map((column) => column.columnKey)).toEqual([
      'name',
      'link',
      'angle_products',
      'email_campaign_products',
      'youtube_copy_products',
      'creative_briefs',
      'creator_products',
    ]);
  });
});

describe('GRATSI-MATCH · creators (UGC Management)', () => {
  /** The Gratsi `UGC Management` table (`tblRsVqiqUaZRcQYd`), all 36 fields in live order. */
  const AIRTABLE_UGC: readonly string[] = [
    'Creator name (Filled by UGC Manager)',
    'Status',
    'Date of Management',
    'Age',
    'Gender',
    'Ethnicity',
    'Concept to film',
    'Products',
    'Budget per 60sec video',
    'Partnership Activity',
    "Creator's video Intro",
    "Creator's Profile Pic",
    'Facebook Profile for Partnership',
    'Platform',
    "(Client's) Note or Comments",
    'Additional Note - TAS Team',
    "Creator's cost (USD) - Internal",
    'Raw assets',
    'Shipping Location',
    'Tracking Number ',
    'Creator Link',
    'Creator Status',
    'Paid by TAS',
    'Payment Date',
    'Concepts',
    'Creator Info Request',
    "Creator's cost (USD)",
    'Date of Partnership Activation',
    'Notify Flag',
    'Slack Notified ',
    'Partnership Time Period (days)',
    'Continue Working With?',
    'Extension Time Period',
    'Partnership Price per 30 days',
    'Notes for Partnership ads',
    'Instagram Username',
  ];

  /*
   * Deliberately excluded, by name:
   *  - `Concepts` — RULING CONFLICT. AI-41 (2026-10-04) kept the dead second link to Concepts as
   *    a HIDDEN row (`concept_ids`, 0/70 live rows, importer `skip`); the strict rule would
   *    re-add it beside the real `Concept to film` junction. The standing ruling WINS pending a
   *    ruling that names the winner — not re-added (docs/decisions.md, GRATSI-MATCH entry).
   */
  // FLIPPED 2026-10-04: the base's second Concepts link is shown again — rendering the row's
  // OWN stored concept_ids (0/70 today), never the creator_concepts junction (AI-41 stands).
  const EXCLUDED = new Set<string>([]);

  it('resolves exactly the Airtable list minus the AI-41 exclusion, in Airtable order', async () => {
    const resolved = await gratsiColumns('creators');
    const expected = [...expectedLabels(AIRTABLE_UGC, EXCLUDED)];
    const slackIdx = expected.indexOf('Slack Notified ');
    expected.splice(slackIdx + 1, 0, 'Client Approval');
    expect(resolved.map((column) => column.displayLabel)).toEqual(expected);
  });

  it('computes the two formula fields at read time — virtual, never stored, never writable', async () => {
    const resolved = await gratsiColumns('creators');
    const byLabel = new Map(resolved.map((column) => [column.displayLabel, column]));

    const costWithFee = byLabel.get("Creator's cost (USD)");
    expect(costWithFee?.columnKey).toBe('creator_cost_with_fee');
    expect(costWithFee?.formula).toBe('creatorCostWithFee');
    const notify = byLabel.get('Notify Flag');
    expect(notify?.columnKey).toBe('notify_flag');
    expect(notify?.formula).toBe('creatorNotifyFlag');
    // Neither shadows a stored column; the stored internal figure keeps its own column.
    expect(byLabel.get("Creator's cost (USD) - Internal")?.columnKey).toBe('creator_cost');
    expect(byLabel.get("Creator's cost (USD) - Internal")?.formula).toBeNull();
  });
});

describe('GRATSI-MATCH · creative_reporting', () => {
  /**
   * The Gratsi `Creative Reporting` table (`tblgW4bwDSSeqihlr`), all 14 fields in live order.
   * Nothing is excluded on this table: every field resolves.
   */
  const AIRTABLE_REPORTING: readonly string[] = [
    'Creative Name',
    'Name + Angle + Offer',
    'Notes',
    'Ad Design',
    'Ad Link',
    'CTR',
    'Thumb-Stop Rate',
    'Results',
    'CPA',
    'Target CPA',
    'Difference CPA',
    'ROAS',
    'Target ROAS',
    'Creative Name (from Creative)',
  ];

  it('resolves all fourteen fields, in Airtable order, nothing excluded', async () => {
    const resolved = await gratsiColumns('creative_reporting');
    expect(resolved.map((column) => column.displayLabel)).toEqual(AIRTABLE_REPORTING);
  });

  it('reads Creative Name off the brief link and the lookup off the formula, never storage', async () => {
    const resolved = await gratsiColumns('creative_reporting');
    const byLabel = new Map(resolved.map((column) => [column.displayLabel, column]));

    // The base's `Creative Name` formula is a passthrough of the `Creative` link, so the link
    // column itself carries the base's wording — a relabel, still the platform's column.
    const creativeName = byLabel.get('Creative Name');
    expect(creativeName?.columnKey).toBe('brief_id');
    expect(creativeName?.source).toBe('platform');
    // The lookup it passes through is the VIRTUAL row, formula-backed, never writable.
    const lookup = byLabel.get('Creative Name (from Creative)');
    expect(lookup?.columnKey).toBe('creative_name_from_creative');
    expect(lookup?.formula).toBe('creativeNameFromCreative');
    // Difference CPA stays the inherited virtual column it already was.
    expect(byLabel.get('Difference CPA')?.formula).toBe('differenceCpa');
  });
});
