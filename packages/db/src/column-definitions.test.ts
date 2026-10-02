import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
  reattachColumn,
  resolveColumns,
  upsertColumnDefinition,
  type UpsertColumnDefinition,
} from './column-definitions';
import { columnDefinitions, brands } from './schema';
import { testDb, type PgliteDb } from './testing';

const PARENT = 'a0000000-0000-4000-8000-00000000000a';
const CHILD = 'a0000000-0000-4000-8000-00000000000b';
const LONER = 'a0000000-0000-4000-8000-00000000000c';
const AGENCY = 'a0000000-0000-4000-8000-0000000000aa';

/** A parent base and two children: one inheriting, one with no parent at all. */
async function bases(db: PgliteDb): Promise<void> {
  await db.execute(
    // The agency row the brands point at; inserted raw so this test owns no seed ordering.
    (await import('drizzle-orm'))
      .sql`insert into agencies (id, name, slug) values (${AGENCY}, 'Test Agency', 'test-agency') on conflict do nothing`,
  );
  await db
    .insert(brands)
    .values([
      { id: PARENT, agencyId: AGENCY, name: 'Template', slug: 'tpl', isTemplate: true },
      { id: CHILD, agencyId: AGENCY, name: 'Child', slug: 'child', templateBrandId: PARENT },
      { id: LONER, agencyId: AGENCY, name: 'Loner', slug: 'loner' },
    ])
    .onConflictDoNothing();
}

const parentSet: readonly UpsertColumnDefinition[] = [
  { tableKey: 'personas', columnKey: 'name', displayLabel: 'Persona Name', displayOrder: 1 },
  { tableKey: 'personas', columnKey: 'demographic', displayLabel: 'Demographic', displayOrder: 2 },
  {
    tableKey: 'personas',
    columnKey: 'core_desires',
    displayLabel: 'Core Desires',
    displayOrder: 3,
  },
  {
    tableKey: 'personas',
    columnKey: 'day_in_the_life',
    displayLabel: 'A Day in the Life',
    displayOrder: 4,
  },
];

async function seedParent(db: PgliteDb): Promise<void> {
  for (const row of parentSet) await upsertColumnDefinition(db, PARENT, row, 'tester');
}

describe('resolveColumns — per-column inheritance', () => {
  it('a child with no rows of its own inherits the parent set, in the parent order', async () => {
    const db = await testDb();
    await bases(db);
    await seedParent(db);

    const resolved = await resolveColumns(db, CHILD, 'personas');
    expect(resolved.map((column) => column.columnKey)).toEqual([
      'name',
      'demographic',
      'core_desires',
      'day_in_the_life',
    ]);
    expect(resolved.map((column) => column.displayLabel)).toEqual([
      'Persona Name',
      'Demographic',
      'Core Desires',
      'A Day in the Life',
    ]);
    // Every one is marked as coming from the parent, so the admin UI can say "following template".
    expect(resolved.every((column) => column.inheritedFrom === PARENT)).toBe(true);
    expect(resolved.every((column) => !column.isDetached)).toBe(true);
  });

  it('a detached child row replaces the parent label and the rest still inherits', async () => {
    const db = await testDb();
    await bases(db);
    await seedParent(db);

    await upsertColumnDefinition(
      db,
      CHILD,
      {
        tableKey: 'personas',
        columnKey: 'demographic',
        displayLabel: 'Description [Age Status Salary]',
        displayOrder: 2,
        isDetached: true,
      },
      'admin',
    );

    const resolved = await resolveColumns(db, CHILD, 'personas');
    const demographic = resolved.find((column) => column.columnKey === 'demographic');
    expect(demographic?.displayLabel).toBe('Description [Age Status Salary]');
    expect(demographic?.isDetached).toBe(true);
    expect(demographic?.inheritedFrom).toBeNull();
    // The siblings are untouched and still the parent's.
    expect(resolved.find((column) => column.columnKey === 'core_desires')?.displayLabel).toBe(
      'Core Desires',
    );
    expect(resolved).toHaveLength(4);
  });

  it('a hidden child row removes a parent column from the list but not from the table', async () => {
    const db = await testDb();
    await bases(db);
    await seedParent(db);

    await upsertColumnDefinition(
      db,
      CHILD,
      {
        tableKey: 'personas',
        columnKey: 'day_in_the_life',
        displayLabel: 'A Day in the Life',
        displayOrder: 4,
        isHidden: true,
        isDetached: true,
      },
      'admin',
    );

    const resolved = await resolveColumns(db, CHILD, 'personas');
    expect(resolved.map((column) => column.columnKey)).not.toContain('day_in_the_life');
    expect(resolved).toHaveLength(3);
    // The parent still shows it: hiding is per base, and the row is still there.
    expect((await resolveColumns(db, PARENT, 'personas')).map((c) => c.columnKey)).toContain(
      'day_in_the_life',
    );
    const [stillThere] = await db
      .select()
      .from(columnDefinitions)
      .where(
        and(
          eq(columnDefinitions.brandId, CHILD),
          eq(columnDefinitions.columnKey, 'day_in_the_life'),
        ),
      );
    expect(stillThere?.isHidden).toBe(true);
  });

  it('a child-added column appears for that child and never for the parent or a sibling', async () => {
    const db = await testDb();
    await bases(db);
    await seedParent(db);

    await upsertColumnDefinition(
      db,
      CHILD,
      {
        tableKey: 'personas',
        columnKey: 'passion',
        displayLabel: 'Passion',
        displayOrder: 5,
        source: 'custom',
        isDetached: true,
      },
      'admin',
    );

    const child = await resolveColumns(db, CHILD, 'personas');
    expect(child.at(-1)).toMatchObject({ columnKey: 'passion', source: 'custom' });
    expect((await resolveColumns(db, PARENT, 'personas')).map((c) => c.columnKey)).not.toContain(
      'passion',
    );
  });

  it('a parent edit reaches an ATTACHED child and not a DETACHED one', async () => {
    const db = await testDb();
    await bases(db);
    await seedParent(db);

    // The child detaches `demographic` only.
    await upsertColumnDefinition(
      db,
      CHILD,
      {
        tableKey: 'personas',
        columnKey: 'demographic',
        displayLabel: 'Description [Age Status Salary]',
        displayOrder: 2,
        isDetached: true,
      },
      'admin',
    );
    // The parent then relabels BOTH columns.
    await upsertColumnDefinition(
      db,
      PARENT,
      {
        tableKey: 'personas',
        columnKey: 'demographic',
        displayLabel: 'Demographics v2',
        displayOrder: 2,
      },
      'admin',
    );
    await upsertColumnDefinition(
      db,
      PARENT,
      {
        tableKey: 'personas',
        columnKey: 'core_desires',
        displayLabel: 'Core Desires v2',
        displayOrder: 3,
      },
      'admin',
    );

    const resolved = await resolveColumns(db, CHILD, 'personas');
    // Detached: the parent's edit does NOT reach it.
    expect(resolved.find((c) => c.columnKey === 'demographic')?.displayLabel).toBe(
      'Description [Age Status Salary]',
    );
    // Attached: it does, with no propagation job having run.
    expect(resolved.find((c) => c.columnKey === 'core_desires')?.displayLabel).toBe(
      'Core Desires v2',
    );
  });

  it('reattaching snaps the column back to the parent definition', async () => {
    const db = await testDb();
    await bases(db);
    await seedParent(db);
    await upsertColumnDefinition(
      db,
      CHILD,
      {
        tableKey: 'personas',
        columnKey: 'demographic',
        displayLabel: 'Description [Age Status Salary]',
        displayOrder: 2,
        isDetached: true,
      },
      'admin',
    );
    expect(
      (await resolveColumns(db, CHILD, 'personas')).find((c) => c.columnKey === 'demographic')
        ?.displayLabel,
    ).toBe('Description [Age Status Salary]');

    await reattachColumn(db, CHILD, 'personas', 'demographic', 'admin');

    const resolved = await resolveColumns(db, CHILD, 'personas');
    const demographic = resolved.find((c) => c.columnKey === 'demographic');
    expect(demographic?.displayLabel).toBe('Demographic');
    expect(demographic?.inheritedFrom).toBe(PARENT);
    expect(resolved).toHaveLength(4);
  });

  it('orders by integer, so column 10 comes after column 2 rather than before it', async () => {
    const db = await testDb();
    await bases(db);
    for (const order of [2, 10]) {
      await upsertColumnDefinition(
        db,
        PARENT,
        {
          tableKey: 'angles',
          columnKey: `col_${String(order)}`,
          displayLabel: `Col ${String(order)}`,
          displayOrder: order,
        },
        'tester',
      );
    }
    expect((await resolveColumns(db, PARENT, 'angles')).map((c) => c.columnKey)).toEqual([
      'col_2',
      'col_10',
    ]);
  });

  it('a base with no parent resolves to its own rows and inherits nothing', async () => {
    const db = await testDb();
    await bases(db);
    await seedParent(db);
    expect(await resolveColumns(db, LONER, 'personas')).toEqual([]);
    await upsertColumnDefinition(
      db,
      LONER,
      { tableKey: 'personas', columnKey: 'name', displayLabel: 'Name', displayOrder: 1 },
      'tester',
    );
    const resolved = await resolveColumns(db, LONER, 'personas');
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.inheritedFrom).toBeNull();
  });
});
