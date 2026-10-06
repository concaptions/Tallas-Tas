import { and, eq, isNull } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { agencies, brands, interfaceTabVisibility } from '../schema';
import { testDb } from '../testing';

import { seedInterfaceConfig } from './seed-interface-config';

async function seedTemplateBrand() {
  const db = await testDb();
  const [agency] = await db.insert(agencies).values({ name: 'TAS', slug: 'tas' }).returning();
  if (!agency) throw new Error('could not seed agency');
  const [template] = await db
    .insert(brands)
    .values({
      name: 'TAS Template',
      slug: 'tas-template',
      agencyId: agency.id,
      isTemplate: true,
    })
    .returning();
  if (!template) throw new Error('could not seed template brand');
  return { db, agency, template };
}

describe('seedInterfaceConfig', () => {
  it('writes four tab-visibility rows for the template brand', async () => {
    const { db, template } = await seedTemplateBrand();
    const result = await seedInterfaceConfig(db);
    expect(result.templateBrandId).toBe(template.id);
    expect(result.inserted).toBe(4);
    expect(result.skipped).toBe(0);
    const rows = await db
      .select()
      .from(interfaceTabVisibility)
      .where(
        and(
          eq(interfaceTabVisibility.brandId, template.id),
          isNull(interfaceTabVisibility.deletedAt),
        ),
      );
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.tabKey).sort()).toStrictEqual([
      'concepts',
      'copywriting',
      'creative_sheet',
      'ugc_management',
    ]);
    for (const row of rows) {
      expect(row.isVisible).toBe(true);
    }
  });

  it('is idempotent: a second run skips every row and never duplicates', async () => {
    const { db } = await seedTemplateBrand();
    await seedInterfaceConfig(db);
    const second = await seedInterfaceConfig(db);
    expect(second.inserted).toBe(0);
    expect(second.skipped).toBe(4);
    const [row] = await db
      .select({ count: interfaceTabVisibility.id })
      .from(interfaceTabVisibility);
    expect(row).toBeDefined();
  });

  it('reports no template when the brand set does not include one yet', async () => {
    const db = await testDb();
    const result = await seedInterfaceConfig(db);
    expect(result.templateBrandId).toBe(null);
    expect(result.inserted).toBe(0);
  });
});
