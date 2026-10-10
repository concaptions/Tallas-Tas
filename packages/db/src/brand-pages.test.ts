import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
  insertCustomPage,
  listBrandCustomPages,
  listMergedPages,
  listTemplateCustomPages,
  setBrandPageOrder,
  setBrandPageVisibility,
  softDeleteCustomPage,
} from './custom-interface-pages';
import { customInterfacePages } from './schema';
import { seed } from './seed';
import { testDb } from './testing';

/** The brand's page list writers (B4): a template page hidden or re-ordered FOR ONE BRAND. */
async function scenario() {
  const db = await testDb();
  const { childBrand } = await seed(db);
  const ONE = [{ columnKey: 'name', displayLabel: 'Name', displayOrder: 0 }];
  const base = {
    brandId: null,
    sourceTableKey: 'creative_briefs',
    filterConfig: {},
    columnConfig: ONE,
    isVisible: true,
    isInherited: true,
    createdBy: 'seed',
    updatedBy: 'seed',
  };
  const concepts = await insertCustomPage(db, {
    ...base,
    slug: 'concepts',
    title: 'Concepts',
    sortOrder: 1,
    pageKind: 'standard',
  });
  const briefs = await insertCustomPage(db, {
    ...base,
    slug: 'creative_sheet',
    title: 'Creative Sheet',
    sortOrder: 2,
    pageKind: 'standard',
  });
  const own = await insertCustomPage(db, {
    ...base,
    brandId: childBrand.id,
    slug: 'winners',
    title: 'Winners',
    sortOrder: 3,
  });
  return { db, brandId: childBrand.id, concepts, briefs, own };
}

describe('setBrandPageVisibility', () => {
  it('hides a TEMPLATE page for one brand through a brand row that tracks the template', async () => {
    const { db, brandId, concepts } = await scenario();

    const row = await setBrandPageVisibility(db, brandId, concepts, false, 'csm');

    expect(row).toMatchObject({
      brandId,
      slug: 'concepts',
      pageKind: 'standard',
      templateRowId: concepts.id,
      isVisible: false,
      isInherited: true,
      overriddenFields: ['is_visible'],
    });
    // The template row itself is untouched; the merge prefers the brand row.
    expect((await listTemplateCustomPages(db)).find((p) => p.slug === 'concepts')?.isVisible).toBe(
      true,
    );
    const merged = await listMergedPages(db, brandId);
    expect(merged.find((p) => p.slug === 'concepts')?.isVisible).toBe(false);
  });

  /**
   * SMOKE-23 (2026-10-11): "Reset to template" soft-deletes the brand row, and `(brand_id, slug)`
   * is unique across deleted rows too — so the next toggle's INSERT collided and the page could
   * not be saved (Gratsi's calendar row, live). The soft-deleted row is REVIVED instead: one row
   * per (brand, slug) ever, back on the template's values plus the new override.
   */
  it('revives the soft-deleted brand row on a toggle after a reset, never a duplicate', async () => {
    const { db, brandId, concepts } = await scenario();
    const first = await setBrandPageVisibility(db, brandId, concepts, false, 'csm');
    expect(await softDeleteCustomPage(db, first.id, brandId, 'csm')).toBe(true);

    const revived = await setBrandPageVisibility(db, brandId, concepts, false, 'csm');

    expect(revived).toMatchObject({
      id: first.id,
      brandId,
      slug: 'concepts',
      isVisible: false,
      deletedAt: null,
      templateRowId: concepts.id,
      overriddenFields: ['is_visible'],
    });
    const allRows = await db
      .select()
      .from(customInterfacePages)
      .where(
        and(eq(customInterfacePages.brandId, brandId), eq(customInterfacePages.slug, 'concepts')),
      );
    expect(allRows).toHaveLength(1);
    expect((await listMergedPages(db, brandId)).find((p) => p.slug === 'concepts')?.isVisible).toBe(
      false,
    );
  });

  it('updates the brand row in place on a second toggle, and a brand-own page directly', async () => {
    const { db, brandId, concepts, own } = await scenario();
    await setBrandPageVisibility(db, brandId, concepts, false, 'csm');
    const again = await setBrandPageVisibility(db, brandId, concepts, true, 'csm');
    expect(again.isVisible).toBe(true);
    expect(
      (await listBrandCustomPages(db, brandId)).filter((p) => p.slug === 'concepts'),
    ).toHaveLength(1);

    const ownRow = await setBrandPageVisibility(db, brandId, own, false, 'csm');
    expect(ownRow).toMatchObject({ id: own.id, isVisible: false });
  });
});

describe('setBrandPageOrder', () => {
  it('writes every page its sort order on the brand side, creating rows from the template', async () => {
    const { db, brandId, concepts, briefs, own } = await scenario();
    const pages = await listMergedPages(db, brandId);

    await setBrandPageOrder(
      db,
      brandId,
      [concepts, briefs, own],
      [
        { slug: 'winners', sortOrder: 0 },
        { slug: 'concepts', sortOrder: 1 },
        { slug: 'creative_sheet', sortOrder: 2 },
      ],
      'csm',
    );

    const brandRows = await listBrandCustomPages(db, brandId);
    expect(brandRows.map((p) => [p.slug, p.sortOrder, p.overriddenFields])).toEqual([
      ['winners', 0, []],
      ['concepts', 1, ['sort_order']],
      ['creative_sheet', 2, ['sort_order']],
    ]);
    expect(pages.map((p) => p.slug)).toEqual(['concepts', 'creative_sheet', 'winners']);
  });
});
