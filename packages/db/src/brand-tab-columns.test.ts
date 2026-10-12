import { describe, expect, it } from 'vitest';

import {
  brandTabColumns,
  loadStandardTabRender,
  reattachBrandTabColumns,
  setBrandTabColumns,
} from './brand-tab-columns';
import { resolveColumns } from './column-definitions';
import { seedColumnDefinitions } from './column-seed';
import { brands } from './schema';
import { seed } from './seed';
import { testDb } from './testing';

/**
 * A standard tab's columns, edited FOR ONE BRAND (Part A2, 2026-10-12): the client-visible,
 * template-defined columns of the tab's table, with the brand's own label / order / hidden rows
 * applied; written through the same `upsertColumnDefinition` Column Admin uses; reattached to the
 * template on Reset. Gratsi renames "Client Approval" to "Approval" — Gratsi resolves it, Niagara
 * and the template do not — and a reset brings "Client Approval" back.
 */
async function scenario() {
  const db = await testDb();
  await seed(db);
  await seedColumnDefinitions(db);
  const all = await db.select().from(brands);
  const id = (slug: string) => {
    const row = all.find((brand) => brand.slug === slug);
    if (row === undefined) throw new Error(`no ${slug}`);
    return row.id;
  };
  return { db, gratsi: id('gratsi'), niagara: id('niagara-sleep-solutions') };
}

const labelOf = async (
  db: Awaited<ReturnType<typeof testDb>>,
  brandId: string,
  key: string,
): Promise<string | undefined> =>
  (await resolveColumns(db, brandId, 'concepts')).find((c) => c.columnKey === key)?.displayLabel;

describe('brandTabColumns', () => {
  it('lists only client-visible, template-defined, stored columns, with the brand’s label applied', async () => {
    const { db, gratsi } = await scenario();
    const columns = await brandTabColumns(db, gratsi, 'concepts');
    const keys = columns.map((c) => c.columnKey);
    expect(keys).toContain('client_approval_status');
    expect(keys).toContain('name');
    expect(keys).not.toContain('internal_status');
    expect(keys).not.toContain('approval_status');
    const approval = columns.find((c) => c.columnKey === 'client_approval_status');
    expect(approval).toMatchObject({
      label: 'Client Approval',
      resolverLabel: 'Client Approval',
      hidden: false,
    });
  });
});

describe('setBrandTabColumns / reattachBrandTabColumns', () => {
  it('renames for Gratsi alone, hides an unpicked column, and a reattach restores the template', async () => {
    const { db, gratsi, niagara } = await scenario();
    await setBrandTabColumns(
      db,
      gratsi,
      'concepts',
      [
        { columnKey: 'name', label: 'Concept', displayOrder: 0, hidden: false },
        { columnKey: 'client_approval_status', label: 'Approval', displayOrder: 1, hidden: false },
        { columnKey: 'batch', label: 'Batch', displayOrder: 2, hidden: true },
      ],
      'admin',
    );
    expect(await labelOf(db, gratsi, 'client_approval_status')).toBe('Approval');
    expect(await labelOf(db, gratsi, 'name')).toBe('Concept');
    expect(await labelOf(db, gratsi, 'batch')).toBeUndefined();
    expect(await labelOf(db, niagara, 'client_approval_status')).toBe('Client Approval');
    const template = all(await db.select().from(brands)).find((b) => b.isTemplate);
    if (template === undefined) throw new Error('no template');
    expect(await labelOf(db, template.id, 'client_approval_status')).toBe('Client Approval');

    const reattached = await reattachBrandTabColumns(db, gratsi, 'concepts', 'admin');
    expect(reattached).toBeGreaterThanOrEqual(3);
    expect(await labelOf(db, gratsi, 'client_approval_status')).toBe('Client Approval');
    expect(await labelOf(db, gratsi, 'batch')).toBe('Batch');
  });

  it('refuses a column outside the client-visible template set', async () => {
    const { db, gratsi } = await scenario();
    await expect(
      setBrandTabColumns(
        db,
        gratsi,
        'concepts',
        [{ columnKey: 'internal_status', label: 'X', displayOrder: 0, hidden: false }],
        'admin',
      ),
    ).rejects.toThrow(/internal_status/);
  });
});

function all<T>(rows: T[]): T[] {
  return rows;
}

describe('loadStandardTabRender', () => {
  it('returns the brand’s resolved, client-visible, stored columns and the projected rows', async () => {
    const { db, niagara } = await scenario();
    const render = await loadStandardTabRender(db, niagara, 'concepts');
    expect(render.columns.map((c) => c.columnKey)).toContain('name');
    expect(render.columns.map((c) => c.columnKey)).not.toContain('internal_status');
    expect(render.rows.length).toBeGreaterThan(0);
    expect(Object.keys(render.rows[0] ?? {})).not.toContain('internal_status');
  });
});
