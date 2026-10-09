import { readFileSync } from 'node:fs';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { customInterfacePages, interfaceTabVisibility } from './schema';
import { seedInterfaceConfig } from './scripts/seed-interface-config';
import { seed } from './seed';
import { testDb } from './testing';

/**
 * Migration 0063 on PGlite (B4): the standard tabs become `page_kind = 'standard'` rows. The
 * migration guards on "a template brand exists", so the fresh database every test starts from is
 * untouched; here the idempotent SQL is run AGAIN after seeding, which is exactly what Railway did.
 */
const STATEMENTS = readFileSync(
  new URL('../drizzle/0063_standard_page_rows.sql', import.meta.url),
  'utf8',
).split('--> statement-breakpoint');

/** Runs the migration's statements one by one, as the migrator does (one command per prepared statement). */
async function runMigration(db: Awaited<ReturnType<typeof testDb>>): Promise<void> {
  for (const statement of STATEMENTS) {
    await db.execute(sql.raw(statement));
  }
}

describe('migration 0063 on PGlite', () => {
  it('writes the five template standard rows from the template tab rows, idempotently', async () => {
    const db = await testDb();
    const { templateBrand } = await seed(db);
    await seedInterfaceConfig(db);
    // The template hides copywriting and moves it first, the way an admin would have.
    await db
      .update(interfaceTabVisibility)
      .set({ isVisible: false, sortOrder: 0 })
      .where(
        and(
          eq(interfaceTabVisibility.brandId, templateBrand.id),
          eq(interfaceTabVisibility.tabKey, 'copywriting'),
        ),
      );

    await runMigration(db);
    await runMigration(db);

    const rows = await db
      .select()
      .from(customInterfacePages)
      .where(
        and(isNull(customInterfacePages.brandId), eq(customInterfacePages.pageKind, 'standard')),
      );
    expect(rows.map((row) => [row.slug, row.isVisible, row.sortOrder]).sort()).toEqual([
      ['calendar', true, 5],
      ['concepts', true, 1],
      ['copywriting', false, 0],
      ['creative_sheet', true, 2],
      ['ugc_management', true, 3],
    ]);
  });

  it('turns a child brand tab override into a child standard row pointing at the template row', async () => {
    const db = await testDb();
    const { childBrand } = await seed(db);
    await seedInterfaceConfig(db);
    await db.insert(interfaceTabVisibility).values({
      brandId: childBrand.id,
      tabKey: 'ugc_management',
      isVisible: false,
      sortOrder: 9,
    });

    await runMigration(db);

    const [child] = await db
      .select()
      .from(customInterfacePages)
      .where(
        and(
          eq(customInterfacePages.brandId, childBrand.id),
          eq(customInterfacePages.slug, 'ugc_management'),
        ),
      );
    const [template] = await db
      .select()
      .from(customInterfacePages)
      .where(
        and(isNull(customInterfacePages.brandId), eq(customInterfacePages.slug, 'ugc_management')),
      );
    expect(child).toMatchObject({
      pageKind: 'standard',
      isVisible: false,
      sortOrder: 9,
      templateRowId: template?.id,
      overriddenFields: ['is_visible', 'sort_order'],
    });
  });

  it('does nothing on a database with no template brand', async () => {
    const db = await testDb();
    await runMigration(db);
    expect(await db.select().from(customInterfacePages)).toEqual([]);
  });
});
