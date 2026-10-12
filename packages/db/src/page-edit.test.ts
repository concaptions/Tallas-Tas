import { describe, expect, it } from 'vitest';

import { setBrandTabColumns } from './brand-tab-columns';
import { resolveColumns } from './column-definitions';
import { seedColumnDefinitions } from './column-seed';
import { listMergedPages, setBrandPageOverrides } from './custom-interface-pages';
import { applyPageEdit, pageEditTargets, previewPageEdit } from './page-edit';
import { brands, customInterfacePages, propagationRuns } from './schema';
import { seed } from './seed';
import { testDb } from './testing';

/**
 * Part B (2026-10-12): an approved page edit lands on the TARGET brands as their own overrides —
 * Gratsi and Niagara both read the new title; a brand that already keeps its own title is skipped
 * under `skip` and replaced under `overwrite`; a standard tab's column picks become the brand's
 * column definition rows; an id that is not a child of the template is dropped.
 */
async function scenario() {
  const db = await testDb();
  await seed(db);
  await seedColumnDefinitions(db);
  const all = await db.select().from(brands);
  const idOf = (slug: string): string => {
    const row = all.find((brand) => brand.slug === slug);
    if (row === undefined) throw new Error(`no ${slug}`);
    return row.id;
  };
  const template = all.find((brand) => brand.isTemplate);
  if (template === undefined) throw new Error('no template');
  const [page] = await db
    .insert(customInterfacePages)
    .values({
      brandId: null,
      slug: 'concepts',
      title: 'Concepts',
      sourceTableKey: 'concepts',
      filterConfig: {},
      columnConfig: [],
      sortOrder: 1,
      isVisible: true,
      isInherited: true,
      pageKind: 'standard',
      createdBy: 'migration:0063',
      updatedBy: 'migration:0063',
    })
    .returning();
  if (page === undefined) throw new Error('no page');
  return {
    db,
    template: template.id,
    page,
    gratsi: idOf('gratsi'),
    niagara: idOf('niagara-sleep-solutions'),
    funky: idOf('funky-painting'),
  };
}

const titleOf = async (
  db: Awaited<ReturnType<typeof testDb>>,
  brandId: string,
): Promise<string | undefined> =>
  (await listMergedPages(db, brandId)).find((p) => p.slug === 'concepts')?.title;

describe('pageEditTargets', () => {
  it('resolves "all" to the active children and drops an id outside them', async () => {
    const { db, template, gratsi } = await scenario();
    const all = await pageEditTargets(db, template, 'all');
    expect(all.map((b) => b.id)).toContain(gratsi);
    expect(all.every((b) => b.templateBrandId === template)).toBe(true);
    const some = await pageEditTargets(db, template, [gratsi, template, 'not-a-brand']);
    expect(some.map((b) => b.id)).toEqual([gratsi]);
  });
});

describe('applyPageEdit', () => {
  it('lands on Gratsi and Niagara as their own overrides; the template keeps its title', async () => {
    const { db, template, page, gratsi, niagara } = await scenario();
    const result = await applyPageEdit(
      db,
      template,
      page.id,
      {
        slug: 'concepts',
        targets: [gratsi, niagara],
        onConflict: 'skip',
        changes: { title: 'Ideas', isVisible: true },
      },
      'admin',
    );
    expect(result.childrenUpdated).toBe(2);
    expect(await titleOf(db, gratsi)).toBe('Ideas');
    expect(await titleOf(db, niagara)).toBe('Ideas');
    const templateRow = (await db.select().from(customInterfacePages)).find(
      (row) => row.id === page.id,
    );
    expect(templateRow?.title).toBe('Concepts');
    const runs = await db.select().from(propagationRuns);
    expect(runs.at(-1)).toMatchObject({ tableName: 'custom_interface_pages', childrenUpdated: 2 });
  });

  it("skip keeps a brand's own title and lists the conflict; overwrite replaces it", async () => {
    const { db, template, page, gratsi, niagara } = await scenario();
    const merged = (await listMergedPages(db, niagara)).find((p) => p.slug === 'concepts');
    if (merged === undefined) throw new Error('no merged page');
    await setBrandPageOverrides(db, niagara, merged, { title: 'Niagara ideas' }, 'csm');
    const payload = {
      slug: 'concepts',
      targets: [gratsi, niagara] as const,
      onConflict: 'skip' as const,
      changes: { title: 'Ideas', isVisible: false },
    };
    const preview = await previewPageEdit(db, template, payload);
    expect(preview.find((o) => o.brandId === niagara)?.conflicts).toEqual(['title']);
    expect(preview.find((o) => o.brandId === gratsi)?.conflicts).toEqual([]);

    await applyPageEdit(db, template, page.id, payload, 'admin');
    expect(await titleOf(db, niagara)).toBe('Niagara ideas');
    expect((await listMergedPages(db, niagara)).find((p) => p.slug === 'concepts')?.isVisible).toBe(
      false,
    );
    expect(await titleOf(db, gratsi)).toBe('Ideas');

    await applyPageEdit(db, template, page.id, { ...payload, onConflict: 'overwrite' }, 'admin');
    expect(await titleOf(db, niagara)).toBe('Ideas');
  });

  it("a standard tab's column picks become each target's column rows; own rows conflict", async () => {
    // Gratsi's seeded relabels (column-seed) ARE its own rows for the tab's columns, so Gratsi is a
    // conflict under `skip` by the same rule as Niagara's hand-made one; Funky Painting is clean.
    const { db, template, page, gratsi, niagara, funky } = await scenario();
    await setBrandTabColumns(
      db,
      niagara,
      'concepts',
      [{ columnKey: 'name', label: 'Niagara name', displayOrder: 1, hidden: false }],
      'csm',
    );
    const payload = {
      slug: 'concepts',
      targets: 'all' as const,
      onConflict: 'skip' as const,
      changes: {
        title: 'Concepts',
        isVisible: true,
        columnConfig: [
          { columnKey: 'name', displayLabel: 'Concept', displayOrder: 0 },
          { columnKey: 'client_approval_status', displayLabel: 'Approval', displayOrder: 1 },
        ],
      },
    };
    const preview = await previewPageEdit(db, template, payload);
    expect(preview.find((o) => o.brandId === niagara)?.conflicts).toEqual(['column_config']);
    expect(preview.find((o) => o.brandId === gratsi)?.conflicts).toEqual(['column_config']);
    expect(preview.find((o) => o.brandId === funky)?.conflicts).toEqual([]);
    await applyPageEdit(db, template, page.id, payload, 'admin');
    const label = async (brandId: string, key: string) =>
      (await resolveColumns(db, brandId, 'concepts')).find((c) => c.columnKey === key)
        ?.displayLabel;
    expect(await label(funky, 'client_approval_status')).toBe('Approval');
    expect(await label(funky, 'name')).toBe('Concept');
    expect(await label(funky, 'batch')).toBeUndefined();
    expect(await label(niagara, 'name')).toBe('Niagara name');
    expect(await label(gratsi, 'client_approval_status')).toBe('Client Approval');
    expect(await label(template, 'client_approval_status')).toBe('Client Approval');

    await applyPageEdit(db, template, page.id, { ...payload, onConflict: 'overwrite' }, 'admin');
    expect(await label(niagara, 'name')).toBe('Concept');
    expect(await label(gratsi, 'client_approval_status')).toBe('Approval');
    expect(await label(template, 'client_approval_status')).toBe('Client Approval');
  });
});
