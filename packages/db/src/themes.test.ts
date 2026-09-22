import { eq, sql } from 'drizzle-orm';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { DEMO_BRAND_ID, demoConcepts, demoThemes } from './demo-data';
import {
  conceptAngles,
  conceptThemes,
  concepts,
  themeCategories,
  themes,
  type Theme,
} from './schema';
import { seed } from './seed';
import { testDb, type PgliteDb } from './testing';
import {
  getThemeById,
  insertTheme,
  listThemes,
  updateTheme,
  type ThemeInput,
  type ThemeListRow,
} from './themes';
import { withBrand } from './tenancy';

/** One of the four themes a seeded concept references — past `noUncheckedIndexedAccess`. */
function usedTheme(): ThemeListRow {
  const row = demoThemes.find((theme) => theme.name === 'Problem/Solution');
  if (row === undefined) throw new Error('demoThemes has no Problem/Solution');
  return row;
}

/** The newest seeded concept; four of them link this brand to four different themes. */
function demoConcept() {
  const [row] = demoConcepts;
  if (row === undefined) throw new Error('demoConcepts is empty');
  return row;
}

/** A fresh database with every migration applied and the demo content seeded. */
async function seeded(): Promise<{ db: PgliteDb; brandId: string; otherBrandId: string }> {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

/** Drizzle wraps a driver error as `Failed query: ...` and keeps the Postgres error in `cause`. */
async function rejection(run: Promise<unknown>): Promise<string> {
  try {
    await run;
  } catch (error: unknown) {
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
    return cause instanceof Error ? cause.message : String(cause);
  }
  throw new Error('expected the query to be rejected');
}

describe('migration 0004 on PGlite', () => {
  it('adds a not-null category column on the theme_category enum', async () => {
    const db = await testDb();

    const { rows } = await db.execute<{
      data_type: string;
      udt_name: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      sql`select data_type, udt_name, is_nullable, column_default from information_schema.columns
          where table_name = 'themes' and column_name = 'category'`,
    );

    expect(rows).toEqual([
      {
        data_type: 'USER-DEFINED',
        udt_name: 'theme_category',
        is_nullable: 'NO',
        // No default: a category is chosen, never inherited.
        column_default: null,
      },
    ]);
  });

  it('creates the theme_category enum in the PRD §5.5 order', async () => {
    const db = await testDb();

    const { rows } = await db.execute<{ enumlabel: string }>(
      sql`select e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
          where t.typname = 'theme_category' order by e.enumsortorder`,
    );

    expect(rows.map((row) => row.enumlabel)).toEqual([...themeCategories]);
    expect(themeCategories).toEqual(['Framework', 'Production Style', 'Seasonal']);
  });

  it('keeps reference_links as a jsonb string array and notes as text', async () => {
    const db = await testDb();

    const { rows } = await db.execute<{ column_name: string; data_type: string }>(
      sql`select column_name, data_type from information_schema.columns
          where table_name = 'themes' and column_name in ('reference_links', 'notes')
          order by column_name`,
    );

    expect(rows).toEqual([
      { column_name: 'notes', data_type: 'text' },
      { column_name: 'reference_links', data_type: 'jsonb' },
    ]);
  });
});

describe('the global library', () => {
  it('seeds the six fixtures row for row, brand count included', async () => {
    const { db, brandId } = await seeded();

    expect(brandId).toBe(DEMO_BRAND_ID);
    expect(demoThemes).toHaveLength(6);
    expect(await listThemes(db)).toEqual(demoThemes);
  });

  it('spreads the fixtures across the three categories, two each, every brand_id null', async () => {
    const { db } = await seeded();

    const rows = await listThemes(db);

    expect(rows.map((row) => row.category).sort()).toEqual([
      'Framework',
      'Framework',
      'Production Style',
      'Production Style',
      'Seasonal',
      'Seasonal',
    ]);
    expect(rows.every((row) => row.brandId === null)).toBe(true);
    // Real content: every theme carries one or two reference links and a written note.
    expect(rows.every((row) => (row.referenceLinks ?? []).length >= 1)).toBe(true);
    expect(rows.every((row) => (row.notes ?? '').length > 80)).toBe(true);
  });

  it('rejects a theme that carries a brand: the global library is a check constraint', async () => {
    const { db, brandId } = await seeded();

    expect(
      await rejection(
        db.execute(
          sql`insert into themes (brand_id, name, category)
              values (${brandId}, 'Branded theme', 'Framework')`,
        ),
      ),
    ).toMatch(/themes_global/);
    expect(await listThemes(db)).toHaveLength(demoThemes.length);
  });

  it('is not a branded table: withBrand cannot reach it', () => {
    const scope = withBrand({} as never, DEMO_BRAND_ID);

    // `themes.brandId` stays nullable, so `themes` never satisfies `BrandedTable` — the global
    // library cannot be read or written through a brand scope, and this is the compile-time proof.
    // @ts-expect-error themes is global: it is not a BrandedTable.
    expect(() => scope.select(themes)).toBeTypeOf('function');
  });

  it('takes no brandId: listThemes reads the library with the database alone', async () => {
    const { db } = await seeded();

    // One declared parameter, `db`. A brand argument here would be the bug this asserts against.
    expect(listThemes.length).toBe(1);
    expect(await listThemes(db)).toHaveLength(6);
  });
});

describe('theme queries', () => {
  it('lists every live theme newest edit first', async () => {
    const { db } = await seeded();

    const rows = await listThemes(db);

    expect(rows.map((row) => row.name)).toEqual([
      'Yapper Style',
      'Holiday Gifting',
      'POV: X vs Y',
      'Green Screen',
      'Problem/Solution',
      'Spring x Soccer',
    ]);
    const updated = rows.map((row) => row.updatedAt.getTime());
    expect(updated).toEqual([...updated].sort((a, b) => b - a));
  });

  it('drops a soft-deleted theme from the list and from getThemeById', async () => {
    const { db } = await seeded();
    const target = usedTheme();

    await db.update(themes).set({ deletedAt: new Date() }).where(eq(themes.id, target.id));

    expect((await listThemes(db)).map((row) => row.id)).not.toContain(target.id);
    expect(await getThemeById(db, target.id)).toBeNull();
  });

  it('counts distinct brands, not concepts: a second concept in the same brand adds nothing', async () => {
    const { db, brandId } = await seeded();
    const target = usedTheme();
    const seededConcept = demoConcept();

    expect((await getThemeById(db, target.id))?.usedByBrandCount).toBe(1);

    const [newConcept] = await withBrand(db, brandId)
      .insert(concepts, {
        name: 'B2-Your Body Clock Is Not Broken-Problem/Solution',
      })
      .returning();
    if (newConcept) {
      if (seededConcept.angleIds[0]) {
        await db
          .insert(conceptAngles)
          .values({ conceptId: newConcept.id, angleId: seededConcept.angleIds[0] });
      }
      await db.insert(conceptThemes).values({ conceptId: newConcept.id, themeId: target.id });
    }

    expect((await getThemeById(db, target.id))?.usedByBrandCount).toBe(1);
  });

  it('counts a second brand using the same theme, because the library is shared', async () => {
    const { db, otherBrandId } = await seeded();
    const target = usedTheme();

    const [otherConcept] = await withBrand(db, otherBrandId)
      .insert(concepts, {
        name: 'B1-Template Angle-Problem/Solution',
      })
      .returning();
    if (otherConcept) {
      await db.insert(conceptThemes).values({ conceptId: otherConcept.id, themeId: target.id });
    }

    expect((await getThemeById(db, target.id))?.usedByBrandCount).toBe(2);
    const listed = (await listThemes(db)).find((row) => row.id === target.id);
    expect(listed?.usedByBrandCount).toBe(2);
  });

  it('stops counting a brand whose only concept on the theme is soft-deleted', async () => {
    const { db, brandId } = await seeded();
    const target = usedTheme();

    // Find concept ids linked to this theme via the junction table, then soft-delete them.
    const linkedRows = await db
      .select({ conceptId: conceptThemes.conceptId })
      .from(conceptThemes)
      .where(eq(conceptThemes.themeId, target.id));
    for (const { conceptId } of linkedRows) {
      await withBrand(db, brandId).softDelete(concepts, eq(concepts.id, conceptId));
    }

    expect((await getThemeById(db, target.id))?.usedByBrandCount).toBe(0);
  });

  it('carries a theme with no concept at all as a clean zero, null link and all', async () => {
    const { db, brandId } = await seeded();

    // A concept with no theme junction row must not become a count on any theme, and must not throw.
    await withBrand(db, brandId).insert(concepts, { name: 'B2-Unthemed' });

    const rows = await listThemes(db);

    // Four themes carry a demo concept; Holiday Gifting and Spring x Soccer carry none, and the
    // unthemed concept just inserted must not become a count on either of them.
    expect(rows.filter((row) => row.usedByBrandCount === 0)).toHaveLength(2);
    expect(rows.every((row) => Number.isInteger(row.usedByBrandCount))).toBe(true);
    expect(await db.select().from(concepts).where(eq(concepts.name, 'B2-Unthemed'))).toHaveLength(
      1,
    );
  });

  it('returns null for an unknown id rather than throwing', async () => {
    const { db } = await seeded();

    expect(await getThemeById(db, '99999999-9999-4999-8999-999999999999')).toBeNull();
  });
});

describe('theme writes', () => {
  it('inserts a theme into the library with brand_id null and the actor on both audit columns', async () => {
    const { db } = await seeded();

    const row = await insertTheme(
      db,
      {
        name: 'Narrator’s Style',
        category: 'Production Style',
        referenceLinks: ['https://foreplay.example/boards/narrator-style'],
        notes: 'Voice-over over B-roll, no talking head, so one script can be recut per brand.',
      },
      'user_test',
    );

    expect(row).toMatchObject({
      brandId: null,
      name: 'Narrator’s Style',
      category: 'Production Style',
      createdBy: 'user_test',
      updatedBy: 'user_test',
      deletedAt: null,
    });
    expect((await listThemes(db)).map((theme) => theme.id)).toContain(row.id);
    expect((await getThemeById(db, row.id))?.usedByBrandCount).toBe(0);
  });

  it('refuses a theme with no category: the column is not null and has no default', async () => {
    const { db } = await seeded();

    expect(
      await rejection(db.execute(sql`insert into themes (name) values ('Categoryless')`)),
    ).toMatch(/category/);
  });

  it('patches a theme, stamps the actor and leaves the untouched columns alone', async () => {
    const { db } = await seeded();
    const target = usedTheme();

    const row = await updateTheme(
      db,
      target.id,
      { notes: 'Rewritten after the September teardown.' },
      'user_editor',
    );

    expect(row).toMatchObject({
      id: target.id,
      name: target.name,
      category: target.category,
      notes: 'Rewritten after the September teardown.',
      createdBy: target.createdBy,
      updatedBy: 'user_editor',
      brandId: null,
    });
    expect(row?.updatedAt.getTime()).toBeGreaterThan(target.updatedAt.getTime());
  });

  it('returns null when the id is unknown or already soft-deleted', async () => {
    const { db } = await seeded();
    const target = usedTheme();

    expect(
      await updateTheme(db, '99999999-9999-4999-8999-999999999999', {}, 'user_test'),
    ).toBeNull();

    await db.update(themes).set({ deletedAt: new Date() }).where(eq(themes.id, target.id));

    expect(await updateTheme(db, target.id, { notes: 'too late' }, 'user_test')).toBeNull();
  });
});

describe('theme types', () => {
  it('has no brandId on its input and carries the count on its row', () => {
    expectTypeOf<ThemeInput>().toHaveProperty('name');
    expectTypeOf<ThemeInput>().toHaveProperty('category');
    expectTypeOf<ThemeInput>().not.toHaveProperty('brandId');
    expectTypeOf<ThemeInput>().not.toHaveProperty('createdBy');
    expectTypeOf<ThemeListRow>().toExtend<Theme>();
    expectTypeOf<ThemeListRow['usedByBrandCount']>().toEqualTypeOf<number>();
    expectTypeOf(demoThemes).toEqualTypeOf<ThemeListRow[]>();
  });
});
