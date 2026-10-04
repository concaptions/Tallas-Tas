import { describe, expect, it } from 'vitest';

import { resolveColumns } from './column-definitions';
import { COLUMN_SEED, seedColumnDefinitions, UNMAPPED_COLUMN_KEY } from './column-seed';
import { storedColumns, upsertColumnDefinition } from './column-definitions';
import { isVirtualFormulaName } from './formulas/registry';
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
  const INFERRED_JUNCTIONS = new Set([
    'concepts.angle_products',
    'concepts.angle_personas',
    // The Products page's concept count, which is two hops away and computed on read
    // (`products -> angle_products -> angles -> concepts`, packages/db/src/products.ts:89). It is
    // the mirror of the two chains above — the same inferred concept x angle relationship, read from
    // the other end — so `concepts` carries no foreign key back to `products` and cannot satisfy the
    // junction rule. Named here rather than admitted quietly, so the gate still catches a genuine
    // transcription slip; see docs/decisions/column-key-relations-2026-10-03.md, which also records
    // that whether a two-hop derived count belongs in a configurable column set is the owner's call.
    'products.concepts',
  ]);

  it('keys every column to a real Postgres column or a junction OF ITS OWN TABLE', async () => {
    const db = await testDb();
    const { columnsByTable, tables } = await publicNames(db);
    const targets = await junctionTargets(db);

    const unknown: string[] = [];
    const notAJunctionOfItsTable: string[] = [];
    const virtualButStored: string[] = [];
    const unknownFormula: string[] = [];
    /*
     * The formula each column is known to have, from the PARENT group — because the resolver reads
     * `formula` from the parent row when a child's is null, so whether a column is computed is a
     * property of the column and not of the row in front of you. Without this a child's RELABEL of a
     * virtual column looks like a stored column to the gate, and its key is rejected for naming
     * neither a Postgres column nor a table: Gratsi's `Name` over the parent's
     * `Name + Angle + Offer` is exactly that row.
     */
    const parentFormula = new Map(
      COLUMN_SEED.filter((group) => group.target.kind === 'parent')
        .flatMap((group) => group.rows)
        .filter((row) => row.formula !== undefined && row.formula !== null)
        .map((row) => [`${row.tableKey}.${row.columnKey}`, row.formula as string]),
    );
    for (const group of COLUMN_SEED) {
      for (const row of group.rows) {
        if (row.columnKey === UNMAPPED_COLUMN_KEY) continue;
        const ownColumns = columnsByTable.get(row.tableKey);
        expect(ownColumns, `${row.tableKey} is not a table`).toBeDefined();
        /*
         * A VIRTUAL column is exempt from the key rule and gets two rules of its own, because its
         * whole point is that no Postgres column backs it. It must name a formula this platform
         * actually exports — otherwise a typo in the seed is invisible until a page renders nothing —
         * and its key must NOT be a real column of the table, because a virtual column shadowing a
         * stored one would give two readings of one datum, which is the bug class the
         * one-vocabulary rules exist to prevent.
         */
        const formula =
          row.formula ?? parentFormula.get(`${row.tableKey}.${row.columnKey}`) ?? null;
        if (formula !== null) {
          if (!isVirtualFormulaName(formula)) {
            unknownFormula.push(`${row.tableKey}.${row.columnKey} -> ${formula}`);
          }
          if (ownColumns?.has(row.columnKey) === true) {
            virtualButStored.push(`${row.tableKey}.${row.columnKey}`);
          }
          continue;
        }
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
    expect(unknownFormula, 'a virtual column names a formula that is not exported').toEqual([]);
    expect(
      virtualButStored,
      'a virtual column shadows a real Postgres column, so one datum has two readings',
    ).toEqual([]);
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

    /*
     * The same eleven columns as before the Angles rollout — nothing dropped — in a new ORDER. The
     * nine app-owned columns used to be seeded as Gratsi-only `custom` rows carrying Gratsi's own
     * field positions (2, 3, 10, 11, 13-17), which is what put Status second. They are platform rows
     * on the parent now, because every brand has them and the parent base defines a field for none
     * of them, so they sort after the parent's Airtable fields (1-8) at 20-28. The parent's own
     * fields keep their Airtable positions; where a platform column sits is configuration, and any
     * brand can move it in Column Admin.
     */
    expect(resolved.map((column) => column.displayLabel)).toEqual([
      'Name',
      'Description',
      'Status',
      'Potential',
      'Formats to create',
      'Ad Inspo',
      'Brief',
      'Exact Script',
      'Winning',
      'Internal Notes',
      'Client Notes',
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

/**
 * Platform columns — the two approval tracks and the generated name. Every other seed row describes
 * an Airtable field, so a column the platform adds would simply be absent from the resolver, and a
 * page that reads its columns from the resolver renders only what it returns: migrating the Concepts
 * page would have dropped both approval tracks (non-negotiable 4) and the Batch-Angle-Theme name
 * (non-negotiable 6). These tests are what stops that happening quietly.
 */
/**
 * The six tables the parent template base does not have. `appnaSGAgOUbJ0f9m` carries 15 tables and
 * none of these is among them, so the platform owns every column of them and their parent sets are
 * entirely `platform` (see `platformRows` in column-seed.ts).
 */
const ALL_PLATFORM_TABLES = new Set([
  'copy_types',
  'creative_reporting',
  'email_campaigns',
  'email_flows',
  'sm_campaign_feed_tasks',
  'youtube_copy',
]);

describe('platform columns on concepts', () => {
  /**
   * Eleven, not three. The first three are the generated name and the two approval tracks; the other
   * eight were added by the Concepts rollout, because the page draws all eight for every brand and
   * they had been seeded as Gratsi-only `custom` rows — so migrating the page would have deleted
   * eight columns from the grid on every inheriting brand. The parent BASE defines a field for none
   * of them: it reads `Pain Points`, `USP`, `Decription`, `Product` and `Personas` back from its
   * Angles link as lookups, which is the level shift the audits describe.
   */
  const PLATFORM = [
    'name',
    'internal_status',
    'client_status',
    'concept_themes',
    'description',
    'pain_points',
    'usp',
    'angle_products',
    'angle_personas',
    'client_comments',
    'concept_collections',
  ];

  async function brandIdBySlug(
    db: Awaited<ReturnType<typeof testDb>>,
    slug: string,
  ): Promise<string> {
    const [row] = await db.select({ id: brands.id }).from(brands).where(eq(brands.slug, slug));
    if (row === undefined) throw new Error(`the seed has no ${slug} brand`);
    return row.id;
  }

  it("resolve on the template base, marked as the platform's own", async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);
    const templateId = await (async () => {
      const [row] = await db
        .select({ id: brands.id })
        .from(brands)
        .where(eq(brands.isTemplate, true));
      if (row === undefined) throw new Error('the seed has no template brand');
      return row.id;
    })();

    const resolved = await resolveColumns(db, templateId, 'concepts');
    const platform = resolved.filter((column) => column.source === 'platform');

    expect(platform.map((column) => column.columnKey).sort()).toEqual([...PLATFORM].sort());
    expect(resolved[0]?.columnKey).toBe('name');
  });

  /**
   * The case that matters: Gratsi has its own rows on `concepts` (seven level shifts), so it is the
   * base most likely to lose an inherited column — and it must still carry all three.
   */
  /**
   * Gratsi is the base most likely to lose an inherited column here, because it holds seventeen rows
   * of its own on Concepts. Every one of the eleven must still reach it, and must still be the
   * platform's — whether it arrives by inheritance or through Gratsi's own relabel.
   */
  it("all reach Gratsi and stay the platform's, whether inherited or relabelled locally", async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);

    const resolved = await resolveColumns(db, await brandIdBySlug(db, 'gratsi'), 'concepts');

    for (const key of PLATFORM) {
      const column = resolved.find((candidate) => candidate.columnKey === key);
      expect(column, `Gratsi lost the platform column ${key}`).toBeDefined();
      expect(column?.source, `${key} stopped being the platform's on Gratsi`).toBe('platform');
    }
    // The three Gratsi holds no row for arrive by inheritance, from the template.
    for (const inherited of ['name', 'internal_status', 'client_status']) {
      expect(
        resolved.find((column) => column.columnKey === inherited)?.inheritedFrom,
        `${inherited} should be read from the template, not from a Gratsi row`,
      ).not.toBeNull();
    }
    // The eight Gratsi DOES hold rows for keep Gratsi's own wording, from its own rows.
    const decription = resolved.find((column) => column.columnKey === 'description');
    expect(decription?.displayLabel).toBe('Decription');
    expect(decription?.inheritedFrom).toBeNull();
    // Both tracks, and in that order: Internal is the team's, Client is the client-facing one.
    const statuses = resolved
      .filter((column) => column.columnKey.endsWith('_status') && column.source === 'platform')
      .map((column) => column.displayLabel);
    expect(statuses).toEqual(['Internal Status', 'Client Status']);
  });

  /**
   * A child may relabel a platform column — Gratsi's base spells the YouTube link
   * `Youtube Copywriting` where the platform row calls it `YouTube Copy` — and doing so must NOT
   * transfer ownership. `childRows`' `relabel-platform` kind exists for exactly this, and the admin's
   * write path keeps the same property through `sourceForWrite`, so the seed and the admin cannot
   * disagree about who owns a column.
   */
  it('keeps platform ownership through a CHILD relabel, rather than writing it back to parent', async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);

    const resolved = await resolveColumns(db, await brandIdBySlug(db, 'gratsi'), 'products');
    const youtube = resolved.find((column) => column.columnKey === 'youtube_copy_products');

    expect(youtube?.displayLabel).toBe('Youtube Copywriting');
    expect(youtube?.source).toBe('platform');
    // Its own row, not the parent's: that is what makes the label Gratsi's.
    expect(youtube?.inheritedFrom).toBeNull();
  });

  /**
   * Which columns the platform claims, kept honest in the two different situations that exist.
   *
   * On a table the parent BASE has, `platform` is the exception — a handful of app-owned columns
   * among the Airtable fields — so the exact list is worth pinning: a column quietly joining it
   * would mean the platform had taken ownership of an Airtable field by accident.
   *
   * On a table the parent base does NOT have, every column is the platform's by definition, so the
   * list would just transcribe the seed. What matters there is the opposite: that the table has a
   * parent set AT ALL, and that none of it claims to be an Airtable field it cannot be.
   */
  it('claims exactly the right columns on the tables where platform is the EXCEPTION', () => {
    const claimed = [
      ...new Set(
        COLUMN_SEED.flatMap((group) =>
          group.rows
            .filter((row) => row.source === 'platform')
            .map((row) => `${row.tableKey}.${row.columnKey}`),
        ),
      ),
    ].filter((pair) => !ALL_PLATFORM_TABLES.has(pair.split('.')[0] ?? ''));

    expect(claimed.sort()).toEqual(
      [
        // Concepts: the two approval tracks, the generated name, and the eight the parent base reads
        // back from its Angles link as lookups.
        'concepts.angle_personas',
        'concepts.angle_products',
        'concepts.client_comments',
        'concepts.client_status',
        'concepts.concept_collections',
        'concepts.concept_themes',
        'concepts.description',
        'concepts.internal_status',
        'concepts.name',
        'concepts.pain_points',
        'concepts.usp',
        // Creative Design: the one scheduling column the app added (migration 0043) and neither
        // Airtable base has a field for. Nothing else on this table is the platform's — every other
        // column of `creative_briefs` is an Airtable field of the parent base or of Gratsi's.
        'creative_briefs.due_date',
        // Products: a stored column and three relations no Airtable field backs in either base.
        'products.collection_link',
        'products.concepts',
        'products.email_campaign_products',
        'products.youtube_copy_products',
        // Angles: nine stored columns the page draws for every brand.
        'angles.ad_inspo_links',
        'angles.brief_url',
        'angles.client_notes',
        'angles.exact_script_url',
        'angles.formats',
        'angles.internal_notes',
        'angles.potential',
        'angles.status',
        'angles.winning',
        // Creators: five internal money-and-process fields.
        'creators.cost_usd',
        'creators.creator_cost',
        'creators.creator_info_request',
        'creators.payment_date',
        'creators.slack_notified',
        // Creative Modules: two the page draws for every brand, for which the parent audit
        // explicitly declined to assert a field.
        'creative_modules.creative_module_designs',
        'creative_modules.foreplay_link',
        // Creative Sheet: the ten fields Gratsi's base defines on this table and the parent's does
        // not. `name` is NOT here — the parent base really does define field 1, so that column is
        // the parent's and merely happens to be computed.
        'creative_sheet_items.denied_revisions_needed',
        'creative_sheet_items.internal_status',
        'creative_sheet_items.qa_checklist_doc',
        'creative_sheet_items.qa_designer',
        'creative_sheet_items.qa_strategist',
        'creative_sheet_items.qa_video_editor',
        'creative_sheet_items.spell_check_requested',
        'creative_sheet_items.spelling_feedback',
        'creative_sheet_items.used',
        'creative_sheet_items.winning',
      ].sort(),
    );
  });

  /**
   * The six tables the parent template base does not have at all. Each must have a parent set, or a
   * resolver-driven page renders an empty grid for every brand except Gratsi — which is exactly what
   * blocked these six. And every row of those sets must be `platform`, because there is no Airtable
   * field on the parent for any of them to be `parent`.
   */
  it('gives every table the parent base lacks a parent set, entirely platform-owned', () => {
    const parentRowsOf = (tableKey: string) =>
      COLUMN_SEED.filter((group) => group.target.kind === 'parent')
        .flatMap((group) => group.rows)
        .filter((row) => row.tableKey === tableKey);

    for (const tableKey of ALL_PLATFORM_TABLES) {
      const rows = parentRowsOf(tableKey);
      expect(
        rows.length,
        `${tableKey} has no parent set, so it would resolve empty`,
      ).toBeGreaterThan(0);
      const notPlatform = rows
        .filter((row) => row.source !== 'platform')
        .map((row) => row.columnKey);
      expect(
        notPlatform,
        `${tableKey} claims Airtable fields the parent base does not have`,
      ).toEqual([]);
    }
  });
});

/**
 * Products, the first table after Personas to read its columns from the resolver.
 *
 * The parent's `(Internal) Product` has 8 Airtable fields and SIX of them are record links whose
 * stored side is the other table's foreign key. An earlier pass seeded only the two scalars, which
 * is right for import parity and wrong for a display set — so these tests pin the full set, and in
 * particular pin that the page's own columns survive, because migrating a page to the resolver
 * renders exactly what the resolver returns and nothing else.
 */
/**
 * Angles, and the regression that made this table worth its own gate: nine of the seventeen columns
 * the page draws were seeded as GRATSI-ONLY rows, so switching the page to the resolver would have
 * deleted all nine on every inheriting brand while Gratsi kept them.
 */
describe('the Angles column set', () => {
  async function brandIdFor(db: Awaited<ReturnType<typeof testDb>>, slug: string): Promise<string> {
    const [row] = await db.select({ id: brands.id }).from(brands).where(eq(brands.slug, slug));
    if (row === undefined) throw new Error(`the seed has no ${slug} brand`);
    return row.id;
  }

  it('returns every column the Angles page draws, for a brand that configures nothing', async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);

    const resolved = await resolveColumns(
      db,
      await brandIdFor(db, 'niagara-sleep-solutions'),
      'angles',
    );
    const keys = new Set(resolved.map((column) => column.columnKey));

    // The seventeen the page drew before the migration, less `updated` (off every grid).
    for (const drawn of [
      'name',
      'angle_personas',
      'angle_products',
      'status',
      'potential',
      'winning',
      'formats',
      'type',
      'description',
      'pain_points',
      'usp',
      'ad_inspo_links',
      'brief_url',
      'exact_script_url',
      'internal_notes',
      'client_notes',
    ]) {
      expect(
        keys.has(drawn),
        `the Angles grid draws ${drawn} and the resolver must return it`,
      ).toBe(true);
    }
    expect(resolved).toHaveLength(16);
  });

  it("marks the nine app-owned columns as the platform's, on every brand", async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);

    for (const slug of ['niagara-sleep-solutions', 'gratsi']) {
      const resolved = await resolveColumns(db, await brandIdFor(db, slug), 'angles');
      const platform = resolved
        .filter((column) => column.source === 'platform')
        .map((column) => column.columnKey)
        .sort();

      expect(platform, `${slug} should carry all nine platform columns`).toEqual([
        'ad_inspo_links',
        'brief_url',
        'client_notes',
        'exact_script_url',
        'formats',
        'internal_notes',
        'potential',
        'status',
        'winning',
      ]);
    }
  });
});

describe('the Products column set', () => {
  async function brandId(db: Awaited<ReturnType<typeof testDb>>, slug: string): Promise<string> {
    const [row] = await db.select({ id: brands.id }).from(brands).where(eq(brands.slug, slug));
    if (row === undefined) throw new Error(`the seed has no ${slug} brand`);
    return row.id;
  }

  it("gives an INHERITING brand the parent's own Airtable field names, in the API's order", async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);

    const resolved = await resolveColumns(
      db,
      await brandId(db, 'niagara-sleep-solutions'),
      'products',
    );

    expect(resolved.map((column) => column.displayLabel)).toEqual([
      'Product Name / Landing Page Name',
      'Link',
      '(Internal) Collections',
      'Campaigns & Offers',
      'Angles',
      '(Internal) Creative Design',
      'Meta Copywriting',
      'UGC Management',
      'Collection Link',
      'Email Campaigns',
      'YouTube Copy',
      'Concepts',
    ]);
    // Every link column is keyed by the table that holds the foreign key back to `products`.
    expect(resolved.map((column) => column.columnKey)).toEqual([
      'name',
      'link',
      'collections',
      'campaigns_offers',
      'angle_products',
      'creative_briefs',
      'copywriting',
      'creator_products',
      'collection_link',
      'email_campaign_products',
      'youtube_copy_products',
      'concepts',
    ]);
  });

  it('gives GRATSI only what the Gratsi base defines, under the names Gratsi uses', async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);

    const resolved = await resolveColumns(db, await brandId(db, 'gratsi'), 'products');

    expect(resolved.map((column) => column.displayLabel)).toEqual([
      'Product Name / Landing Page Name',
      'Link',
      'Angles',
      '(Internal) Creative Design',
      'UGC Management',
      'Collection Link',
      'Email Campaigns',
      // Gratsi's base spells the YouTube link this way; the template calls it 'YouTube Copy'.
      'Youtube Copywriting',
      'Concepts',
    ]);
    // The three parent fields Gratsi's base does not have are hidden, not relabelled away.
    for (const key of ['collections', 'campaigns_offers', 'copywriting']) {
      expect(
        resolved.some((column) => column.columnKey === key),
        `Gratsi should hide ${key}, which its base has no field for`,
      ).toBe(false);
    }
  });

  /**
   * The regression this whole set exists to prevent. Every column the Products page draws must be in
   * the resolved set for a brand that configures nothing, or switching the page to the resolver would
   * have deleted it from the grid. `updated` is the one deliberate exception, removed from every grid
   * by docs/decisions/gratsi-display-spec-2026-10-02.md.
   */
  it('returns every column the Products page draws, so the page lost nothing by migrating', async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);

    const resolved = await resolveColumns(
      db,
      await brandId(db, 'niagara-sleep-solutions'),
      'products',
    );
    const keys = new Set(resolved.map((column) => column.columnKey));

    for (const drawn of [
      'name',
      'link',
      'collection_link',
      'angle_products',
      'concepts',
      'creative_briefs',
      'creator_products',
      'email_campaign_products',
      'youtube_copy_products',
    ]) {
      expect(
        keys.has(drawn),
        `the Products grid draws ${drawn} and the resolver must return it`,
      ).toBe(true);
    }
  });
});

/**
 * The seed removing its OWN stale rows, and nothing else.
 *
 * `seedColumnDefinitions` is an upsert, which is what makes it safe to re-run — but upsert-only
 * means a row dropped from `COLUMN_SEED` lives on and keeps winning, because a child row always
 * beats the parent's. The Angles rollout turned nine Gratsi child-added rows into two relabels, so
 * seven would have stayed behind and production would have resolved Gratsi's OLD labels and order
 * while these tests, on a fresh database, proved the new ones.
 */
describe("re-seeding retires the seed's own stale rows", () => {
  async function gratsiId(db: Awaited<ReturnType<typeof testDb>>): Promise<string> {
    const [row] = await db.select({ id: brands.id }).from(brands).where(eq(brands.slug, 'gratsi'));
    if (row === undefined) throw new Error('the seed has no gratsi brand');
    return row.id;
  }

  it('soft-deletes a row it wrote before and no longer lists', async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db, 'script:seed-columns');
    const brandId = await gratsiId(db);

    // A row the seed USED to write on a table it still covers — exactly the Angles case.
    await upsertColumnDefinition(
      db,
      brandId,
      {
        tableKey: 'angles',
        columnKey: 'potential',
        displayLabel: 'Stale Potential',
        displayOrder: 3,
      },
      'script:seed-columns',
    );
    expect(
      (await resolveColumns(db, brandId, 'angles')).find(
        (c) => c.displayLabel === 'Stale Potential',
      ),
    ).toBeDefined();

    const results = await seedColumnDefinitions(db, 'script:seed-columns');

    expect(results.flatMap((row) => row.retired)).toContain('angles.potential');
    const resolved = await resolveColumns(db, brandId, 'angles');
    expect(resolved.find((column) => column.displayLabel === 'Stale Potential')).toBeUndefined();
    // The column is still THERE — it falls back to the parent's platform row, which is the point.
    const potential = resolved.find((column) => column.columnKey === 'potential');
    expect(potential?.displayLabel).toBe('Potential');
    expect(potential?.source).toBe('platform');
  });

  /** The line that makes reconciliation safe: Column Admin's whole purpose is per-brand edits. */
  it('never touches a row an ADMIN made, even when the seed says nothing about that column', async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db, 'script:seed-columns');
    const brandId = await gratsiId(db);

    await upsertColumnDefinition(
      db,
      brandId,
      { tableKey: 'angles', columnKey: 'potential', displayLabel: 'Upside', displayOrder: 3 },
      'user_admin_123',
    );

    const results = await seedColumnDefinitions(db, 'script:seed-columns');

    expect(results.flatMap((row) => row.retired)).not.toContain('angles.potential');
    expect(
      (await resolveColumns(db, brandId, 'angles')).find((c) => c.columnKey === 'potential')
        ?.displayLabel,
    ).toBe('Upside');
  });

  /**
   * The gap a production dry run found, before anything was written. Reconciliation used to be
   * scoped to the tables the CURRENT GROUP lists — so the moment a group stopped listing a table at
   * all (emptying Gratsi's `email_campaigns` rows, because the platform set now carries those
   * labels), the reconciler skipped that table and its old rows survived. A child row always wins,
   * so Gratsi would have resolved STORED columns where the parent now has virtual ones, pointing
   * four pages at columns that do not exist. 42 rows were in that state in production.
   */
  it("retires a stale row on a table this brand's group no longer lists at all", async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db, 'script:seed-columns');
    const brandId = await gratsiId(db);

    // Gratsi's group lists NO rows for `email_campaigns` — the platform set carries those labels —
    // but a previous seed wrote one, exactly as production had.
    await upsertColumnDefinition(
      db,
      brandId,
      {
        tableKey: 'email_campaigns',
        columnKey: 'design_due_date',
        displayLabel: 'Design Due Date',
        displayOrder: 7,
        source: 'custom',
      },
      'script:seed-columns',
    );
    const before = (await resolveColumns(db, brandId, 'email_campaigns')).find(
      (column) => column.columnKey === 'design_due_date',
    );
    /*
     * Stale, and winning: the label, order and `source` are the old row's. The FORMULA survives,
     * because the resolver reads it from the parent when a child's is null — which is the point of
     * that fallback, and it is what keeps a stale row from turning a computed column into a stored
     * one. So the damage a stale row can do is now limited to presentation, and this is the
     * assertion that says so.
     */
    expect(before?.formula).toBe('emailCampaignDesignDueDate');
    expect(before?.source).toBe('custom');
    expect(before?.inheritedFrom).toBeNull();

    const results = await seedColumnDefinitions(db, 'script:seed-columns');

    expect(results.flatMap((row) => row.retired)).toContain('email_campaigns.design_due_date');
    const after = (await resolveColumns(db, brandId, 'email_campaigns')).find(
      (column) => column.columnKey === 'design_due_date',
    );
    // The parent's virtual row again: computed, and the column is back to being the platform's.
    expect(after?.formula).toBe('emailCampaignDesignDueDate');
    expect(after?.source).toBe('platform');
    expect(after?.inheritedFrom).not.toBeNull();
  });

  it('leaves a table the seed deliberately says nothing about completely alone', async () => {
    const db = await testDb();
    await seed(db);
    const brandId = await gratsiId(db);
    // `themes` is global and deliberately unseeded
    // (docs/decisions/themes-stays-outside-the-resolver-2026-10-03.md).
    await upsertColumnDefinition(
      db,
      brandId,
      { tableKey: 'themes', columnKey: 'name', displayLabel: 'Theme', displayOrder: 1 },
      'script:seed-columns',
    );

    const results = await seedColumnDefinitions(db, 'script:seed-columns');

    expect(results.flatMap((row) => row.retired)).toEqual([]);
    expect((await resolveColumns(db, brandId, 'themes')).map((c) => c.displayLabel)).toEqual([
      'Theme',
    ]);
  });
});

/**
 * The six tables the parent template base does not have, resolved per brand.
 *
 * Data-driven on purpose: six near-identical describes would be a transcription of the seed, and
 * what matters is the same two facts for each — an INHERITING brand gets the whole platform set (if
 * it got nothing, a resolver-driven page would render an empty grid, which is what blocked these
 * six), and GRATSI gets the same columns under its own wording wherever its base words them
 * differently.
 */
/**
 * Creative Sheet, the last page migrated and the one virtual columns were built for.
 */
describe('the Creative Sheet column set', () => {
  async function brandFor(db: Awaited<ReturnType<typeof testDb>>, slug: string): Promise<string> {
    const [row] = await db.select({ id: brands.id }).from(brands).where(eq(brands.slug, slug));
    if (row === undefined) throw new Error(`the seed has no ${slug} brand`);
    return row.id;
  }

  it('names the primary field as the PARENT base does, computed, and Gratsi as Gratsi does', async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);

    const onNiagara = await resolveColumns(
      db,
      await brandFor(db, 'niagara-sleep-solutions'),
      'creative_sheet_items',
    );
    const onGratsi = await resolveColumns(db, await brandFor(db, 'gratsi'), 'creative_sheet_items');

    expect(onNiagara).toHaveLength(14);
    expect(onGratsi).toHaveLength(14);
    expect(onNiagara[0]?.displayLabel).toBe('Name + Angle + Offer');
    // Gratsi words it `Name`, and the formula survives the relabel because the resolver reads it
    // from the parent row — the column has no Postgres column to fall back to.
    expect(onGratsi[0]?.displayLabel).toBe('Name');
    for (const set of [onNiagara, onGratsi]) {
      const name = set.find((column) => column.columnKey === 'name');
      expect(name?.formula).toBe('creativeSheetName');
      expect(storedColumns(set).some((column) => column.columnKey === 'name')).toBe(false);
      // It is the PARENT's column, not the platform's: the parent base really defines field 1.
      expect(name?.source).toBe('parent');
    }
  });

  it('returns every column the page draws, the three QA checks among them', async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);

    const resolved = await resolveColumns(
      db,
      await brandFor(db, 'niagara-sleep-solutions'),
      'creative_sheet_items',
    );
    const keys = new Set(resolved.map((column) => column.columnKey));

    for (const drawn of [
      'name',
      'brief_id',
      'status',
      'client_comments',
      'internal_status',
      'qa_checklist_doc',
      'qa_video_editor',
      'qa_designer',
      'qa_strategist',
      'used',
      'denied_revisions_needed',
      'winning',
      'spell_check_requested',
      'spelling_feedback',
    ]) {
      expect(keys.has(drawn), `the Creative Sheet grid draws ${drawn}`).toBe(true);
    }
    // Three separate columns, because Airtable has three separate fields — not one `QA` header.
    expect(
      resolved.filter(
        (column) => column.columnKey.startsWith('qa_') && column.fieldType === 'checkbox',
      ),
    ).toHaveLength(3);
  });
});

describe('the all-platform tables resolve for every brand', () => {
  const EXPECTED = [
    { tableKey: 'copy_types', inheriting: 4, gratsi: 4, gratsiOwnRows: 2, virtual: 0 },
    { tableKey: 'creative_reporting', inheriting: 13, gratsi: 13, gratsiOwnRows: 0, virtual: 1 },
    { tableKey: 'email_campaigns', inheriting: 17, gratsi: 17, gratsiOwnRows: 0, virtual: 2 },
    { tableKey: 'email_flows', inheriting: 13, gratsi: 13, gratsiOwnRows: 0, virtual: 2 },
    { tableKey: 'sm_campaign_feed_tasks', inheriting: 6, gratsi: 6, gratsiOwnRows: 0, virtual: 1 },
    // Gratsi hides its status banner, which has no column at all, so it shows one fewer.
    { tableKey: 'youtube_copy', inheriting: 16, gratsi: 16, gratsiOwnRows: 2, virtual: 0 },
  ] as const;

  it.each(EXPECTED)(
    '$tableKey: an inheriting brand gets $inheriting columns and Gratsi gets $gratsi',
    async ({ tableKey, inheriting, gratsi, gratsiOwnRows, virtual }) => {
      const db = await testDb();
      await seed(db);
      await seedColumnDefinitions(db);
      const brandId = async (slug: string): Promise<string> => {
        const [row] = await db.select({ id: brands.id }).from(brands).where(eq(brands.slug, slug));
        if (row === undefined) throw new Error(`the seed has no ${slug} brand`);
        return row.id;
      };

      const onNiagara = await resolveColumns(
        db,
        await brandId('niagara-sleep-solutions'),
        tableKey,
      );
      const onGratsi = await resolveColumns(db, await brandId('gratsi'), tableKey);

      expect(
        onNiagara,
        `${tableKey} resolved nothing for an inheriting brand, so its page would be an empty grid`,
      ).toHaveLength(inheriting);
      expect(onGratsi).toHaveLength(gratsi);

      // Every column of these tables is the platform's: the parent base has no such table.
      expect(onNiagara.filter((column) => column.source !== 'platform')).toEqual([]);
      expect(onGratsi.filter((column) => column.source !== 'platform')).toEqual([]);

      // Virtual columns carry their formula and no stored column backs them.
      expect(onNiagara.filter((column) => column.formula !== null)).toHaveLength(virtual);
      expect(storedColumns(onNiagara)).toHaveLength(inheriting - virtual);

      // Gratsi reads its own labels only where its base words a column differently.
      expect(onGratsi.filter((column) => column.inheritedFrom === null)).toHaveLength(
        gratsiOwnRows,
      );
    },
  );

  it('words the two Gratsi departures on youtube_copy and copy_types as Gratsi does', async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);
    const [gratsi] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.slug, 'gratsi'));
    if (gratsi === undefined) throw new Error('the seed has no gratsi brand');

    const youtube = await resolveColumns(db, gratsi.id, 'youtube_copy');
    expect(youtube.find((c) => c.columnKey === 'descriptions')?.displayLabel).toBe(
      'Descriptions (90 caractères max)',
    );
    expect(youtube.find((c) => c.columnKey === 'used')?.displayLabel).toBe('USED');

    const copyTypes = await resolveColumns(db, gratsi.id, 'copy_types');
    expect(copyTypes.find((c) => c.columnKey === 'copywriting_copy_types')?.displayLabel).toBe(
      'Ads Copywriting copy',
    );
    expect(copyTypes.find((c) => c.columnKey === 'youtube_copy_copy_types')?.displayLabel).toBe(
      'Copywriting',
    );
  });
});

/**
 * Creative Design, the fifteenth and last grid to read its columns from the resolver (AI-64a).
 *
 * The page used to carry a six-string tuple, so the gate it needs is the opposite of exhaustive: the
 * set must be the WHOLE table, the one column the platform owns must be in it, and Gratsi must get
 * its own wording and its own departures. The counts here are the ones
 * `pnpm --filter @tas/db verify-rollout` asserts against production.
 */
describe('the Creative Design column set', () => {
  async function brandFor(db: Awaited<ReturnType<typeof testDb>>, slug: string): Promise<string> {
    const [row] = await db.select({ id: brands.id }).from(brands).where(eq(brands.slug, slug));
    if (row === undefined) throw new Error(`the seed has no ${slug} brand`);
    return row.id;
  }

  it('resolves the whole table for an inheriting brand, and Gratsi’s own set for Gratsi', async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);

    const onNiagara = await resolveColumns(
      db,
      await brandFor(db, 'niagara-sleep-solutions'),
      'creative_briefs',
    );
    const onGratsi = await resolveColumns(db, await brandFor(db, 'gratsi'), 'creative_briefs');

    // Thirty parent fields plus the platform's `due_date`.
    expect(onNiagara).toHaveLength(31);
    // Gratsi hides three (Ad Content, Campaigns & Offers, Assets) and adds five of its own.
    expect(onGratsi).toHaveLength(33);
    for (const hidden of ['ad_content', 'campaign_offer_id', 'asset_id']) {
      expect(onGratsi.map((column) => column.columnKey)).not.toContain(hidden);
      expect(onNiagara.map((column) => column.columnKey)).toContain(hidden);
    }
    for (const own of ['batch', 'language', 'script_content', 'offer', 'spelling_feedback_2']) {
      expect(onGratsi.map((column) => column.columnKey)).toContain(own);
      expect(onNiagara.map((column) => column.columnKey)).not.toContain(own);
    }
    // Gratsi's relabels, under Gratsi's words; the parent keeps its own.
    expect(onGratsi.find((column) => column.columnKey === 'brief_to_design')?.displayLabel).toBe(
      'Brief to Design/Editing',
    );
    expect(onNiagara.find((column) => column.columnKey === 'brief_to_design')?.displayLabel).toBe(
      'Brief',
    );
  });

  it('carries due_date as the PLATFORM’s column, on both bases, stored and never virtual', async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);

    for (const slug of ['niagara-sleep-solutions', 'gratsi']) {
      const resolved = await resolveColumns(db, await brandFor(db, slug), 'creative_briefs');
      const dueDate = resolved.find((column) => column.columnKey === 'due_date');

      // Neither Airtable base has a Due Date field, so the column cannot claim `parent`.
      expect(dueDate?.source, `${slug} must inherit due_date from the platform`).toBe('platform');
      expect(dueDate?.displayLabel).toBe('Due Date');
      expect(dueDate?.formula).toBeNull();
      expect(storedColumns(resolved).some((column) => column.columnKey === 'due_date')).toBe(true);
    }
  });

  it('returns every column the Creative Design grid draws', async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);

    const keys = new Set(
      (
        await resolveColumns(db, await brandFor(db, 'niagara-sleep-solutions'), 'creative_briefs')
      ).map((column) => column.columnKey),
    );

    // The six the hardcoded tuple used to name, plus the one this item adds.
    for (const drawn of [
      'name',
      'concept_id',
      'type',
      'priority',
      'assignee',
      'internal_status',
      'due_date',
    ]) {
      expect(keys.has(drawn), `the Creative Design grid draws ${drawn}`).toBe(true);
    }
  });
});
