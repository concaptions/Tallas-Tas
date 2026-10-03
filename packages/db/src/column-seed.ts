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

/** The seed, grouped by base. Further tables append here as they are rolled out. */
export const COLUMN_SEED: readonly BrandColumnSeed[] = [
  { target: { kind: 'parent' }, rows: PERSONAS_PARENT },
  { target: { kind: 'slug', slug: 'gratsi' }, rows: PERSONAS_GRATSI },
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
