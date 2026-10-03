import { describe, expect, it } from 'vitest';

import { resolveColumns } from './column-definitions';
import { COLUMN_SEED, seedColumnDefinitions, UNMAPPED_COLUMN_KEY } from './column-seed';
import { PROPAGATION_TABLES } from './propagation';
import { seed } from './seed';
import { brands, columnDefinitions } from './schema';
import { and, eq, sql } from 'drizzle-orm';
import { testDb } from './testing';

/**
 * THE GATE the owner set before Wave 2 fans out: with the seed applied, Gratsi's Personas page must
 * resolve to exactly seven columns under Gratsi's own labels, in Gratsi's order, and a brand that
 * inherits must resolve to the parent's fuller set under the PARENT's labels.
 */
describe('the column seed, resolved per brand', () => {
  it('gives Gratsi exactly the seven Gratsi labels, in order', async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);
    const [gratsi] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.slug, 'gratsi'));
    if (gratsi === undefined) throw new Error('the seed has no gratsi brand');

    const resolved = await resolveColumns(db, gratsi.id, 'personas');

    expect(resolved.map((column) => column.displayLabel)).toEqual([
      'Name',
      'Description [Age Status Salary]',
      'Personality',
      'Drivers for this persona',
      'Passion',
      'Problem-Solution Awareness Level',
      'Angles',
    ]);
    // The keys behind those labels are the Postgres columns, unrenamed.
    expect(resolved.map((column) => column.columnKey)).toEqual([
      'name',
      'demographic',
      'psychographic',
      'core_desires',
      'passion',
      'stage_of_awareness',
      'angle_personas',
    ]);
    // Nine parent columns are hidden, not dropped, and never appear.
    for (const hidden of [
      'day_in_the_life',
      'emotional_triggers',
      'pain_points',
      'success_factors',
      'perceived_barriers',
      'buying_triggers',
      'problem_challenge',
      'success_transformation',
      'trigger_words',
    ]) {
      expect(resolved.map((column) => column.columnKey)).not.toContain(hidden);
    }
    // `product_id` needs no row at all: the parent base has no Product field, so nothing emits it.
    expect(resolved.map((column) => column.columnKey)).not.toContain('product_id');
    // Passion is Gratsi's own column; the others are the parent's, overridden.
    expect(resolved.find((column) => column.columnKey === 'passion')?.source).toBe('custom');
    expect(resolved.every((column) => column.isDetached)).toBe(true);
  });

  it('gives an inheriting brand the parent set, under the PARENT labels, not Gratsi relabels', async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);
    const [niagara] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.slug, 'niagara-sleep-solutions'));
    // The seed's demo child may be named differently; fall back to any non-template child.
    const child =
      niagara ??
      (
        await db.select({ id: brands.id }).from(brands).where(eq(brands.isTemplate, false)).limit(1)
      )[0];
    if (child === undefined) throw new Error('the seed has no child brand');

    const resolved = await resolveColumns(db, child.id, 'personas');

    // The fuller set: all fifteen parent columns, none hidden.
    expect(resolved).toHaveLength(15);
    expect(resolved.map((column) => column.displayLabel).slice(0, 5)).toEqual([
      'Persona Name',
      'A Day in the Life',
      'Demographic',
      'Psychographic',
      'Core Desires (Cashvertising)',
    ]);
    // The parent's names, NOT Gratsi's — the two naming worlds stay apart.
    expect(resolved.map((column) => column.displayLabel)).not.toContain(
      'Description [Age Status Salary]',
    );
    expect(resolved.map((column) => column.displayLabel)).not.toContain('Drivers for this persona');
    // It carries the columns Gratsi hides, which is the point: hiding is per base.
    expect(resolved.map((column) => column.columnKey)).toContain('day_in_the_life');
    expect(resolved.map((column) => column.columnKey)).toContain('pain_points');
    // And it has no row of its own, so every column is marked as inherited.
    expect(resolved.every((column) => column.inheritedFrom !== null)).toBe(true);
    expect(resolved.every((column) => !column.isDetached)).toBe(true);
  });

  it('is idempotent: seeding twice changes nothing', async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);
    const [gratsi] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.slug, 'gratsi'));
    if (gratsi === undefined) throw new Error('the seed has no gratsi brand');
    const once = await resolveColumns(db, gratsi.id, 'personas');
    await seedColumnDefinitions(db);
    expect(await resolveColumns(db, gratsi.id, 'personas')).toEqual(once);
  });
});

/**
 * THE SECOND GATE, for the nineteen tables that followed Personas: the seed is transcribed from two
 * audit documents by hand, so the thing most likely to be wrong is a `column_key` that names no real
 * column. These tests read `information_schema` from the migrated test database, so a typo, a
 * renamed column or a junction that does not exist fails here rather than resolving to an invisible
 * column in production.
 */
describe('the column seed, checked against the real schema', () => {
  async function publicNames(db: Awaited<ReturnType<typeof testDb>>): Promise<{
    columnsByTable: Map<string, Set<string>>;
    tables: Set<string>;
  }> {
    const { rows } = await db.execute<{ table_name: string; column_name: string }>(
      sql`select table_name, column_name from information_schema.columns where table_schema = 'public'`,
    );
    const columnsByTable = new Map<string, Set<string>>();
    for (const row of rows) {
      const existing = columnsByTable.get(row.table_name) ?? new Set<string>();
      existing.add(row.column_name);
      columnsByTable.set(row.table_name, existing);
    }
    return { columnsByTable, tables: new Set(columnsByTable.keys()) };
  }

  /**
   * Every foreign key in the schema as `child table → referenced table`, so a key that resolves to
   * a TABLE can be checked for being a junction of the table it is seeded on. Without that check a
   * plausible transcription slip is invisible: `['assets', …]` on `creative_briefs` (the correct key
   * is `asset_id`, and `assets` is a real table) would pass merely because some table has the name.
   */
  async function junctionTargets(
    db: Awaited<ReturnType<typeof testDb>>,
  ): Promise<Map<string, Set<string>>> {
    const { rows } = await db.execute<{ table_name: string; references_table: string }>(
      sql`select tc.table_name, ccu.table_name as references_table
            from information_schema.table_constraints tc
            join information_schema.constraint_column_usage ccu
              on ccu.constraint_name = tc.constraint_name
             and ccu.constraint_schema = tc.constraint_schema
           where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'`,
    );
    const targets = new Map<string, Set<string>>();
    for (const row of rows) {
      const existing = targets.get(row.table_name) ?? new Set<string>();
      existing.add(row.references_table);
      targets.set(row.table_name, existing);
    }
    return targets;
  }

  /**
   * The two keys that are junctions of a DIFFERENT table on purpose, and the audit line that says
   * so. Gratsi stores `Product` and `Personas` on Concepts where the parent holds them on Angles,
   * and the engine resolves them through the inferred concept×angle chain, so the rows land in the
   * ANGLE junctions: *"junction `angle_products`, inferred concept×angle (pass 2, :1612-1625)"* and
   * the same for `angle_personas` (`docs/audits/overnight-gratsi-columns.md:510-511`). Every other
   * table-shaped key must carry a foreign key back to its own table.
   */
  const INFERRED_JUNCTIONS = new Set(['concepts.angle_products', 'concepts.angle_personas']);

  it('keys every column to a real Postgres column or a junction OF ITS OWN TABLE', async () => {
    const db = await testDb();
    const { columnsByTable, tables } = await publicNames(db);
    const targets = await junctionTargets(db);

    const unknown: string[] = [];
    const notAJunctionOfItsTable: string[] = [];
    for (const group of COLUMN_SEED) {
      for (const row of group.rows) {
        if (row.columnKey === UNMAPPED_COLUMN_KEY) continue;
        const ownColumns = columnsByTable.get(row.tableKey);
        expect(ownColumns, `${row.tableKey} is not a table`).toBeDefined();
        // A scalar is a column of its own table; a link column is keyed by its junction TABLE.
        if (ownColumns?.has(row.columnKey) === true) continue;
        const pair = `${row.tableKey}.${row.columnKey}`;
        if (!tables.has(row.columnKey)) {
          unknown.push(pair);
          continue;
        }
        if (INFERRED_JUNCTIONS.has(pair)) continue;
        // A junction is only this table's link column if it points back at this table.
        if (targets.get(row.columnKey)?.has(row.tableKey) !== true)
          notAJunctionOfItsTable.push(pair);
      }
    }

    expect(unknown).toEqual([]);
    expect(notAJunctionOfItsTable).toEqual([]);
  });

  it('would catch a table-named key that is no junction of the table it sits on', async () => {
    const db = await testDb();
    const targets = await junctionTargets(db);
    // The slip the assertion above exists for: `assets` is a real table, but nothing links it to
    // `creative_briefs` as a junction — the real key is the `asset_id` column.
    expect(targets.get('assets')?.has('creative_briefs') ?? false).toBe(false);
    // And the shape it does accept: a genuine junction names its own side.
    expect(targets.get('copywriting_campaigns')?.has('copywriting')).toBe(true);
  });

  it('seeds only tables the resolver has a key for, and all of them', () => {
    const seeded = new Set(COLUMN_SEED.flatMap((group) => group.rows.map((row) => row.tableKey)));
    // Nothing seeded that propagation does not know; nothing propagated left without columns.
    expect([...seeded].sort()).toEqual(Object.keys(PROPAGATION_TABLES).sort());
    // Themes is global by constraint (CLAUDE.md non-negotiable 3) and has no legal table_key.
    expect(seeded.has('themes')).toBe(false);
  });

  it('never writes the same column twice for one base', () => {
    for (const group of COLUMN_SEED) {
      const keys = group.rows.map((row) => `${row.tableKey}.${row.columnKey}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('hides Gratsi five angle columns the level shift moved to Concepts, and shows eleven', async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);
    const [gratsi] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.slug, 'gratsi'));
    if (gratsi === undefined) throw new Error('the seed has no gratsi brand');

    const resolved = await resolveColumns(db, gratsi.id, 'angles');

    expect(resolved.map((column) => column.displayLabel)).toEqual([
      'Name',
      'Status',
      'Potential',
      'Description',
      'Formats to create',
      'Client Notes',
      'Brief',
      'Exact Script',
      'Ad Inspo',
      'Winning',
      'Internal Notes',
    ]);
    // Gratsi keeps these on Concepts, so its Angles table has no field for them. Hidden, not gone.
    for (const hidden of ['type', 'angle_products', 'angle_personas', 'pain_points', 'usp']) {
      expect(resolved.map((column) => column.columnKey)).not.toContain(hidden);
    }
    // `Name` and `Description` are the parent's rows, read through, under the parent's labels.
    expect(resolved.find((column) => column.columnKey === 'name')?.inheritedFrom).not.toBeNull();
  });

  it('gives a brand that departs nowhere the parent set verbatim', async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);
    const [gratsi] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.slug, 'gratsi'));
    if (gratsi === undefined) throw new Error('the seed has no gratsi brand');

    // Competitive research is identical in both bases: seven INHERIT, no child row at all.
    const resolved = await resolveColumns(db, gratsi.id, 'competitive_research');

    expect(resolved.map((column) => column.displayLabel)).toEqual([
      'Name',
      'Type',
      'Website',
      'Insta',
      'FB Page',
      'Meta Ads Library',
      'Analysis',
    ]);
    expect(resolved.every((column) => column.inheritedFrom !== null)).toBe(true);
    expect(resolved.every((column) => !column.isDetached)).toBe(true);
  });

  it('never resolves the Airtable status banner, on either copy table', async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);
    const [gratsi] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.slug, 'gratsi'));
    if (gratsi === undefined) throw new Error('the seed has no gratsi brand');

    for (const tableKey of ['copywriting', 'youtube_copy']) {
      const resolved = await resolveColumns(db, gratsi.id, tableKey);
      expect(resolved.map((column) => column.columnKey)).not.toContain(UNMAPPED_COLUMN_KEY);
      expect(resolved.length).toBeGreaterThan(0);
      // Hidden AND child-added, which is what the law asks for. `source: 'parent'` would be a false
      // claim — `schema/column-definitions.ts` defines it as "part of the master set", and no parent
      // row for this key exists on either table (`youtube_copy` has no parent rows at all), so an
      // admin un-hiding it would be told it follows a template column that is not there.
      const stored = await db
        .select({ source: columnDefinitions.source, isHidden: columnDefinitions.isHidden })
        .from(columnDefinitions)
        .where(
          and(
            eq(columnDefinitions.brandId, gratsi.id),
            eq(columnDefinitions.tableKey, tableKey),
            eq(columnDefinitions.columnKey, UNMAPPED_COLUMN_KEY),
          ),
        );
      expect(stored).toEqual([{ source: 'custom', isHidden: true }]);
    }
  });

  /**
   * The `kind → (is_hidden, source)` mapping of the child-row builder, pinned on one row of each
   * kind. Nothing else asserted `source`, which is how a hidden child-added row could silently be
   * written as `source: 'parent'`.
   */
  it('maps each child-row kind to the right visibility and source', () => {
    const gratsi = COLUMN_SEED.find((group) => group.target.kind === 'slug');
    if (gratsi === undefined) throw new Error('the seed has no child group');
    const row = (tableKey: string, columnKey: string) => {
      const found = gratsi.rows.find(
        (candidate) => candidate.tableKey === tableKey && candidate.columnKey === columnKey,
      );
      if (found === undefined) throw new Error(`no seeded row for ${tableKey}.${columnKey}`);
      return { isHidden: found.isHidden ?? false, source: found.source ?? 'parent' };
    };

    // DETACH-RELABEL: the parent's column under Gratsi's label, so the column is still the parent's.
    expect(row('copywriting', 'primary_copy')).toEqual({ isHidden: false, source: 'parent' });
    // CHILD-ADDED: a column Gratsi has and the parent's definition does not.
    expect(row('copywriting', 'funnel')).toEqual({ isHidden: false, source: 'custom' });
    // PARENT-ONLY: hidden for this base, but a parent row exists, so it keeps `parent`.
    expect(row('creative_briefs', 'ad_content')).toEqual({ isHidden: true, source: 'parent' });
    // AMBIGUOUS: hidden AND child-added — the one case that needs both.
    expect(row('youtube_copy', UNMAPPED_COLUMN_KEY)).toEqual({ isHidden: true, source: 'custom' });
  });

  it('gives Gratsi no AI Characters columns, because the parent owns that table alone', async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);
    const [gratsi] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.slug, 'gratsi'));
    if (gratsi === undefined) throw new Error('the seed has no gratsi brand');

    // Twelve hidden rows, one per parent column: the Gratsi base has no such table at all.
    expect(await resolveColumns(db, gratsi.id, 'ai_characters')).toEqual([]);
    // The columns themselves are untouched, and a brand that inherits still sees all twelve.
    const [other] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.slug, 'niagara-sleep-solutions'));
    if (other !== undefined) {
      expect(await resolveColumns(db, other.id, 'ai_characters')).toHaveLength(12);
    }
  });
});
