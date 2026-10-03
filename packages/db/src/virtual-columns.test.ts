import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
  isVirtualColumn,
  resolveColumns,
  storedColumns,
  upsertColumnDefinition,
  virtualColumns,
} from './column-definitions';
import { creativeSheetName, differenceCpa, smReminderTrigger } from './formulas';
import { isVirtualFormulaName, VIRTUAL_FORMULAS, virtualFormulaNames } from './formulas/registry';
import { brands } from './schema';
import { seed } from './seed';
import { testDb } from './testing';

/**
 * VIRTUAL COLUMNS: a configured column with no Postgres column behind it, computed on every read.
 *
 * Seven displayed columns across five pages are computed by an exported function in
 * `packages/db/src/formulas/` and have no stored column at all —
 * `creative_sheet_items.name` is the clearest, because Airtable's primary field there is a formula
 * and storing it would let the month drift from `created_at`. Before this they could not be
 * CONFIGURED: `column_key` admitted only a real column or a table carrying a foreign key back, so a
 * resolver-driven page dropped them.
 *
 * The design is one column, `formula`, which is both the marker and the pointer. NULL means stored;
 * a non-null value names the function. A boolean beside a name would have allowed the invalid state
 * "virtual, with nothing to compute it".
 */
describe('virtual columns', () => {
  async function templateId(db: Awaited<ReturnType<typeof testDb>>): Promise<string> {
    const [row] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.isTemplate, true));
    if (row === undefined) throw new Error('the seed has no template brand');
    return row.id;
  }

  async function brandIdFor(db: Awaited<ReturnType<typeof testDb>>, slug: string): Promise<string> {
    const [row] = await db.select({ id: brands.id }).from(brands).where(eq(brands.slug, slug));
    if (row === undefined) throw new Error(`the seed has no ${slug} brand`);
    return row.id;
  }

  it('RESOLVES, carrying the formula that computes it', async () => {
    const db = await testDb();
    await seed(db);
    const parent = await templateId(db);

    await upsertColumnDefinition(
      db,
      parent,
      {
        tableKey: 'creative_sheet_items',
        columnKey: 'name',
        displayLabel: 'Creative Name',
        displayOrder: 1,
        fieldType: 'formula',
        source: 'platform',
        formula: 'creativeSheetName',
      },
      'test',
    );

    const resolved = await resolveColumns(db, parent, 'creative_sheet_items');
    const name = resolved.find((column) => column.columnKey === 'name');

    expect(name?.displayLabel).toBe('Creative Name');
    expect(name?.formula).toBe('creativeSheetName');
    if (name === undefined) throw new Error('the virtual column did not resolve');
    expect(isVirtualColumn(name)).toBe(true);
  });

  it('RENDERS through its formula, which is the function the registry names', async () => {
    const db = await testDb();
    await seed(db);
    const parent = await templateId(db);
    await upsertColumnDefinition(
      db,
      parent,
      {
        tableKey: 'creative_sheet_items',
        columnKey: 'name',
        displayLabel: 'Creative Name',
        displayOrder: 1,
        formula: 'creativeSheetName',
        source: 'platform',
      },
      'test',
    );

    const [column] = virtualColumns(await resolveColumns(db, parent, 'creative_sheet_items'));
    if (column === undefined || column.formula === null) {
      throw new Error('the virtual column did not resolve with a formula');
    }
    // The row carries a NAME, so something has to turn it back into the function. This is the join
    // the renderer makes, and the assertion that it reaches the real formula rather than a lookalike.
    expect(isVirtualFormulaName(column.formula)).toBe(true);
    const fn = VIRTUAL_FORMULAS[column.formula as keyof typeof VIRTUAL_FORMULAS];
    expect(fn).toBe(creativeSheetName);
    expect(fn).toBeTypeOf('function');
  });

  it('is NEVER a stored column: `storedColumns` removes it and keeps the rest', async () => {
    const db = await testDb();
    await seed(db);
    const parent = await templateId(db);
    for (const row of [
      { columnKey: 'status', displayLabel: 'Status', displayOrder: 2, formula: null },
      {
        columnKey: 'name',
        displayLabel: 'Creative Name',
        displayOrder: 1,
        formula: 'creativeSheetName',
      },
    ]) {
      await upsertColumnDefinition(
        db,
        parent,
        { tableKey: 'creative_sheet_items', source: 'platform', ...row },
        'test',
      );
    }

    const resolved = await resolveColumns(db, parent, 'creative_sheet_items');

    expect(resolved).toHaveLength(2);
    expect(storedColumns(resolved).map((column) => column.columnKey)).toEqual(['status']);
    expect(virtualColumns(resolved).map((column) => column.columnKey)).toEqual(['name']);
  });

  /**
   * The failure this guard exists to prevent, demonstrated rather than asserted abstractly: a write
   * built from the resolved set would reach a key that is not a column, and Postgres rejects it. The
   * displayed set is per-brand DATA, so any page that turns resolved columns into a patch would hit
   * this the moment an admin configured a virtual column.
   */
  it('is EXCLUDED FROM AN INSERT, and including it would genuinely fail', async () => {
    const db = await testDb();
    await seed(db);
    const parent = await templateId(db);
    await upsertColumnDefinition(
      db,
      parent,
      {
        tableKey: 'creative_sheet_items',
        columnKey: 'name',
        displayLabel: 'Creative Name',
        displayOrder: 1,
        formula: 'creativeSheetName',
        source: 'platform',
      },
      'test',
    );
    const resolved = await resolveColumns(db, parent, 'creative_sheet_items');

    // What a naive page would do: write every resolved key.
    await expect(
      db.execute(
        sql`insert into creative_sheet_items (brand_id, name) values (${parent}, 'anything')`,
      ),
    ).rejects.toThrow();

    // What `storedColumns` makes it do instead: the virtual key never reaches the statement.
    const writable = storedColumns(resolved).map((column) => column.columnKey);
    expect(writable).not.toContain('name');
    expect(resolved.some((column) => column.columnKey === 'name')).toBe(true);
  });

  it('keeps DETACH and REATTACH working: a child relabels it and it stays computed', async () => {
    const db = await testDb();
    await seed(db);
    const parent = await templateId(db);
    const gratsi = await brandIdFor(db, 'gratsi');
    await upsertColumnDefinition(
      db,
      parent,
      {
        tableKey: 'creative_sheet_items',
        columnKey: 'name',
        displayLabel: 'Creative Name',
        displayOrder: 1,
        formula: 'creativeSheetName',
        source: 'platform',
      },
      'test',
    );

    // Gratsi detaches to call it something else — display only, and ownership is unchanged.
    await upsertColumnDefinition(
      db,
      gratsi,
      {
        tableKey: 'creative_sheet_items',
        columnKey: 'name',
        displayLabel: 'Sheet Name',
        displayOrder: 1,
        isDetached: true,
        formula: 'creativeSheetName',
        source: 'platform',
      },
      'test',
    );

    const onGratsi = (await resolveColumns(db, gratsi, 'creative_sheet_items')).find(
      (column) => column.columnKey === 'name',
    );
    expect(onGratsi?.displayLabel).toBe('Sheet Name');
    expect(onGratsi?.inheritedFrom).toBeNull();
    // Still computed, still by the same formula: a relabel cannot make a virtual column stored.
    expect(onGratsi?.formula).toBe('creativeSheetName');
    if (onGratsi === undefined) throw new Error('Gratsi lost the column');
    expect(isVirtualColumn(onGratsi)).toBe(true);

    // The parent's own reading is untouched by the child's label.
    const onParent = (await resolveColumns(db, parent, 'creative_sheet_items')).find(
      (column) => column.columnKey === 'name',
    );
    expect(onParent?.displayLabel).toBe('Creative Name');
  });

  it('hides like any other column, so a brand can drop a computed column from its view', async () => {
    const db = await testDb();
    await seed(db);
    const parent = await templateId(db);
    const gratsi = await brandIdFor(db, 'gratsi');
    await upsertColumnDefinition(
      db,
      parent,
      {
        tableKey: 'creative_sheet_items',
        columnKey: 'name',
        displayLabel: 'Creative Name',
        displayOrder: 1,
        formula: 'creativeSheetName',
        source: 'platform',
      },
      'test',
    );
    await upsertColumnDefinition(
      db,
      gratsi,
      {
        tableKey: 'creative_sheet_items',
        columnKey: 'name',
        displayLabel: 'Creative Name',
        displayOrder: 1,
        isHidden: true,
        isDetached: true,
        formula: 'creativeSheetName',
        source: 'platform',
      },
      'test',
    );

    expect(await resolveColumns(db, gratsi, 'creative_sheet_items')).toEqual([]);
    expect(await resolveColumns(db, parent, 'creative_sheet_items')).toHaveLength(1);
  });

  it('stores the formula NAME, not a function, and the name is validated against the registry', () => {
    expect(isVirtualFormulaName('creativeSheetName')).toBe(true);
    expect(isVirtualFormulaName('differenceCpa')).toBe(true);
    expect(isVirtualFormulaName('smReminderTrigger')).toBe(true);
    // A typo is caught by the seed's gate rather than discovered when a page renders nothing.
    expect(isVirtualFormulaName('creativeSheetNames')).toBe(false);
    expect(isVirtualFormulaName('')).toBe(false);

    // Every name resolves to the function it claims.
    expect(VIRTUAL_FORMULAS.differenceCpa).toBe(differenceCpa);
    expect(VIRTUAL_FORMULAS.smReminderTrigger).toBe(smReminderTrigger);
    for (const name of virtualFormulaNames()) {
      expect(VIRTUAL_FORMULAS[name], `${name} is listed but not a function`).toBeTypeOf('function');
    }
  });

  it('defaults to STORED, so nothing becomes computed by omission', async () => {
    const db = await testDb();
    await seed(db);
    const parent = await templateId(db);
    await upsertColumnDefinition(
      db,
      parent,
      {
        tableKey: 'creative_sheet_items',
        columnKey: 'status',
        displayLabel: 'Status',
        displayOrder: 1,
      },
      'test',
    );

    const [column] = await resolveColumns(db, parent, 'creative_sheet_items');
    if (column === undefined) throw new Error('the column did not resolve');
    expect(column.formula).toBeNull();
    expect(isVirtualColumn(column)).toBe(false);
    expect(storedColumns([column])).toHaveLength(1);
  });

  it('is on the table in Postgres, so a fresh database can hold one', async () => {
    const db = await testDb();
    const { rows } = await db.execute<{ column_name: string; data_type: string }>(
      sql`select column_name, data_type from information_schema.columns
           where table_schema = 'public' and table_name = 'column_definitions'
             and column_name = 'formula'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.data_type).toBe('text');
    // And the column is nullable, because NULL is what "stored" means.
    const { rows: nullable } = await db.execute<{ is_nullable: string }>(
      sql`select is_nullable from information_schema.columns
           where table_schema = 'public' and table_name = 'column_definitions'
             and column_name = 'formula'`,
    );
    expect(nullable[0]?.is_nullable).toBe('YES');
  });
});
