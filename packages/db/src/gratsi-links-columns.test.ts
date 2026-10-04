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
   *  - `Creators` — a link to UGC Management with NO stored inverse anywhere in the schema
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
    'Creators',
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
    // Nothing virtual here: every one of these is backed by a real junction or FK table.
    expect(resolved.every((column) => column.formula === null)).toBe(true);
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
    'Meta Copywriting',
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
   *  - `Ads Copywriting copy` — the unread half of the duplicate copy-table link pair; its stored
   *    side does not exist (`copywriting` carries ONE brief FK, `creative_brief_id`, which
   *    `Meta Copywriting` reverses) and the copywriting side belongs to the copy track — flagged
   *    waiting-on-the-copy-track in docs/decisions.md, never migrated from here.
   *  - `Angles` — residual single-line text; the real link is the `Angle` field → `angle_id`
   *    (rule 5).
   * And one deliberate ADDITION the strict rule would call a leak: `Due Date`, kept visible by
   * the standing AI-49 ruling (Talal asked for it), recorded in the same decisions entry.
   */
  const EXCLUDED = new Set([
    'Created 2',
    '(Internal) Collections 2',
    'Ads Copywriting copy',
    'Angles',
  ]);

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
    expect(byLabel.get('Meta Copywriting')?.columnKey).toBe('copywriting');
    // Airtable's system fields display the shared columns — no migration (diff annotation 3).
    expect(byLabel.get('Last Modified')?.columnKey).toBe('updated_at');
    expect(byLabel.get('Created')?.columnKey).toBe('created_at');
    // The lookup is virtual: formula-backed, never stored, never writable.
    const lookup = byLabel.get('Concepts (from Angles)');
    expect(lookup?.columnKey).toBe('concepts_from_angles');
    expect(lookup?.formula).toBe('briefConceptsFromAngles');
  });
});
