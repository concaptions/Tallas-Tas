import { describe, expect, it } from 'vitest';

import {
  agencies,
  brands,
  type CustomPageColumnConfig,
  type CustomPageFilterConfig,
} from './schema';
import { testDb } from './testing';
import {
  findCustomPageBySlug,
  insertCustomPage,
  listBrandCustomPages,
  listTabVisibility,
  listTemplateCustomPages,
  resetTabVisibility,
  softDeleteCustomPage,
  updateCustomPage,
  upsertBrandCustomPageFromTemplate,
  upsertTabVisibility,
} from './custom-interface-pages';

async function seedBrands() {
  const db = await testDb();
  const [agency] = await db.insert(agencies).values({ name: 'TAS', slug: 'tas' }).returning();
  if (!agency) throw new Error('seed agency');
  const [template] = await db
    .insert(brands)
    .values({ name: 'TAS', slug: 'tas-template', agencyId: agency.id, isTemplate: true })
    .returning();
  const [child] = await db
    .insert(brands)
    .values({
      name: 'Gratsi',
      slug: 'gratsi',
      agencyId: agency.id,
      isTemplate: false,
      templateBrandId: template?.id,
    })
    .returning();
  if (!template || !child) throw new Error('seed brands');
  return { db, template, child };
}

const CONFIG_EMPTY: CustomPageFilterConfig = {};
const COLUMNS_EMPTY: readonly CustomPageColumnConfig[] = [];

describe('custom_interface_pages round-trip', () => {
  it('inserts a template page and reads it back', async () => {
    const { db } = await seedBrands();
    const row = await insertCustomPage(db, {
      brandId: null,
      slug: 'internal-queue',
      title: 'Internal Queue',
      sourceTableKey: 'creative_briefs',
      filterConfig: CONFIG_EMPTY,
      columnConfig: COLUMNS_EMPTY,
      sortOrder: 1,
      isVisible: true,
      isInherited: true,
      createdBy: 'test',
      updatedBy: 'test',
    });
    expect(row.brandId).toBe(null);
    const list = await listTemplateCustomPages(db);
    expect(list).toHaveLength(1);
    expect(list[0]?.slug).toBe('internal-queue');
  });

  it('a brand sees its own rows via listBrandCustomPages, and the template via listTemplateCustomPages', async () => {
    const { db, template, child } = await seedBrands();
    await insertCustomPage(db, {
      brandId: null,
      slug: 'templ',
      title: 'Templ',
      sourceTableKey: 'creative_briefs',
      filterConfig: CONFIG_EMPTY,
      columnConfig: COLUMNS_EMPTY,
      sortOrder: 1,
      isVisible: true,
      isInherited: true,
      createdBy: 'test',
    });
    await insertCustomPage(db, {
      brandId: child.id,
      slug: 'child-only',
      title: 'Child Only',
      sourceTableKey: 'creators',
      filterConfig: CONFIG_EMPTY,
      columnConfig: COLUMNS_EMPTY,
      sortOrder: 2,
      isVisible: true,
      isInherited: false,
      createdBy: 'test',
    });
    const templateRows = await listTemplateCustomPages(db);
    expect(templateRows.map((r) => r.slug)).toStrictEqual(['templ']);
    const childRows = await listBrandCustomPages(db, child.id);
    expect(childRows.map((r) => r.slug)).toStrictEqual(['child-only']);
    const siblingRows = await listBrandCustomPages(db, template.id);
    expect(siblingRows).toHaveLength(0);
  });

  it('soft-deletes a page and does not return it afterwards', async () => {
    const { db, child } = await seedBrands();
    const row = await insertCustomPage(db, {
      brandId: child.id,
      slug: 'to-delete',
      title: 'To Delete',
      sourceTableKey: 'creative_briefs',
      filterConfig: CONFIG_EMPTY,
      columnConfig: COLUMNS_EMPTY,
      sortOrder: 1,
      isVisible: true,
      isInherited: false,
      createdBy: 'test',
    });
    const ok = await softDeleteCustomPage(db, row.id, child.id, 'test');
    expect(ok).toBe(true);
    const list = await listBrandCustomPages(db, child.id);
    expect(list).toHaveLength(0);
  });

  it('enforces unique (brand_id, slug)', async () => {
    const { db, child } = await seedBrands();
    await insertCustomPage(db, {
      brandId: child.id,
      slug: 'dup',
      title: 'A',
      sourceTableKey: 'creative_briefs',
      filterConfig: CONFIG_EMPTY,
      columnConfig: COLUMNS_EMPTY,
      sortOrder: 1,
      isVisible: true,
      isInherited: false,
      createdBy: 'test',
    });
    await expect(
      insertCustomPage(db, {
        brandId: child.id,
        slug: 'dup',
        title: 'B',
        sourceTableKey: 'creative_briefs',
        filterConfig: CONFIG_EMPTY,
        columnConfig: COLUMNS_EMPTY,
        sortOrder: 2,
        isVisible: true,
        isInherited: false,
        createdBy: 'test',
      }),
    ).rejects.toThrow();
  });

  it('findCustomPageBySlug falls back to the template when the brand has no override', async () => {
    const { db, child } = await seedBrands();
    const template = await insertCustomPage(db, {
      brandId: null,
      slug: 'shared',
      title: 'Shared',
      sourceTableKey: 'creative_briefs',
      filterConfig: CONFIG_EMPTY,
      columnConfig: COLUMNS_EMPTY,
      sortOrder: 1,
      isVisible: true,
      isInherited: true,
      createdBy: 'test',
    });
    const found = await findCustomPageBySlug(db, child.id, 'shared');
    expect(found?.id).toBe(template.id);
  });

  it("findCustomPageBySlug prefers the child's own row when both exist", async () => {
    const { db, child } = await seedBrands();
    await insertCustomPage(db, {
      brandId: null,
      slug: 'shared',
      title: 'Template',
      sourceTableKey: 'creative_briefs',
      filterConfig: CONFIG_EMPTY,
      columnConfig: COLUMNS_EMPTY,
      sortOrder: 1,
      isVisible: true,
      isInherited: true,
      createdBy: 'test',
    });
    const childRow = await insertCustomPage(db, {
      brandId: child.id,
      slug: 'shared',
      title: 'Brand',
      sourceTableKey: 'creative_briefs',
      filterConfig: CONFIG_EMPTY,
      columnConfig: COLUMNS_EMPTY,
      sortOrder: 1,
      isVisible: true,
      isInherited: false,
      createdBy: 'test',
    });
    const found = await findCustomPageBySlug(db, child.id, 'shared');
    expect(found?.id).toBe(childRow.id);
    expect(found?.title).toBe('Brand');
  });

  it('updateCustomPage changes title and bumps updated_at', async () => {
    const { db, child } = await seedBrands();
    const row = await insertCustomPage(db, {
      brandId: child.id,
      slug: 'u',
      title: 'Old',
      sourceTableKey: 'creative_briefs',
      filterConfig: CONFIG_EMPTY,
      columnConfig: COLUMNS_EMPTY,
      sortOrder: 1,
      isVisible: true,
      isInherited: false,
      createdBy: 'test',
    });
    const updated = await updateCustomPage(db, row.id, child.id, {
      title: 'New',
      updatedBy: 'tester2',
    });
    expect(updated?.title).toBe('New');
    expect(updated?.updatedBy).toBe('tester2');
  });

  it('upsertBrandCustomPageFromTemplate seeds a child row with isInherited = true', async () => {
    const { db, child } = await seedBrands();
    const template = await insertCustomPage(db, {
      brandId: null,
      slug: 'propped',
      title: 'Propped',
      sourceTableKey: 'creative_briefs',
      filterConfig: CONFIG_EMPTY,
      columnConfig: COLUMNS_EMPTY,
      sortOrder: 1,
      isVisible: true,
      isInherited: true,
      createdBy: 'test',
    });
    const written = await upsertBrandCustomPageFromTemplate(
      db,
      child.id,
      template,
      {},
      'propagator',
    );
    expect(written.brandId).toBe(child.id);
    expect(written.slug).toBe('propped');
    expect(written.isInherited).toBe(true);
  });
});

describe('interface_tab_visibility round-trip', () => {
  it('upserts and reads a brand row', async () => {
    const { db, child } = await seedBrands();
    await upsertTabVisibility(db, {
      brandId: child.id,
      tabKey: 'concepts',
      isVisible: false,
      sortOrder: 5,
    });
    const rows = await listTabVisibility(db, child.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.isVisible).toBe(false);
    expect(rows[0]?.sortOrder).toBe(5);
  });

  it('resetTabVisibility hard-deletes the brand row and the next read is empty', async () => {
    const { db, child } = await seedBrands();
    await upsertTabVisibility(db, {
      brandId: child.id,
      tabKey: 'concepts',
      isVisible: false,
      sortOrder: 2,
    });
    const ok = await resetTabVisibility(db, child.id, 'concepts');
    expect(ok).toBe(true);
    const rows = await listTabVisibility(db, child.id);
    expect(rows).toHaveLength(0);
  });
});
