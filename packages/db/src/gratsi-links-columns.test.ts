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
