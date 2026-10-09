import { describe, expect, it } from 'vitest';

import { agencies, brands, creativeBriefs } from './schema';
import { testDb } from './testing';
import { isClientVisibleColumn } from './client-columns';
import {
  insertCustomPage,
  loadCustomPageRender,
  loadCustomPageRows,
} from './custom-interface-pages';

async function seedScenario() {
  const db = await testDb();
  const [agency] = await db.insert(agencies).values({ name: 'TAS', slug: 'tas' }).returning();
  if (!agency) throw new Error('seed agency');
  const [template] = await db
    .insert(brands)
    .values({ name: 'TAS', slug: 'tas', agencyId: agency.id, isTemplate: true })
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
  // Two creative_briefs rows for the child: one with status, one empty.
  await db.insert(creativeBriefs).values([
    {
      brandId: child.id,
      name: 'Spring Hero',
      funnel: 'TOF',
      type: 'Video',
      source: 'TAS',
      internalStatus: 'approved',
      clientStatus: 'pending_for_approval',
    },
    {
      brandId: child.id,
      name: 'Winter Teaser',
      funnel: 'TOF',
      type: 'Static',
      source: 'TAS',
      internalStatus: 'approved',
      clientStatus: 'approved',
    },
  ]);
  // No concepts seeded — the loadCustomPageRows test verifies cross-brand scope on creative_briefs.
  return { db, template, child };
}

describe('loadCustomPageRows', () => {
  it('returns rows of the source table scoped by brand', async () => {
    const { db, child } = await seedScenario();
    const rows = await loadCustomPageRows(db, child.id, 'creative_briefs');
    expect(rows).toHaveLength(2);
  });

  it('returns the empty set for a source table not in the allow-list', async () => {
    const { db, child } = await seedScenario();
    const rows = await loadCustomPageRows(db, child.id, 'themes');
    expect(rows).toHaveLength(0);
  });

  it('scopes by brand_id — another brand sees none of this brand rows', async () => {
    const { db, template } = await seedScenario();
    const rows = await loadCustomPageRows(db, template.id, 'creative_briefs');
    expect(rows).toHaveLength(0);
  });
});

describe('loadCustomPageRender', () => {
  it('returns the page + rows when the page exists and is visible', async () => {
    const { db, child } = await seedScenario();
    await insertCustomPage(db, {
      brandId: null,
      slug: 'client-queue',
      title: 'Client Queue',
      sourceTableKey: 'creative_briefs',
      filterConfig: { column: 'client_status', op: 'is', value: 'pending_for_approval' },
      columnConfig: [{ columnKey: 'name', displayLabel: 'Name', displayOrder: 0 }],
      sortOrder: 10,
      isVisible: true,
      isInherited: true,
      createdBy: 'test',
    });
    const result = await loadCustomPageRender(db, child.id, 'client-queue');
    expect(result).not.toBeNull();
    expect(result?.page.title).toBe('Client Queue');
    expect(result?.rows).toHaveLength(2); // filter is applied in-memory by the renderer, not by this read
  });

  it('returns null for a hidden page', async () => {
    const { db, child } = await seedScenario();
    await insertCustomPage(db, {
      brandId: null,
      slug: 'hidden',
      title: 'Hidden',
      sourceTableKey: 'creative_briefs',
      filterConfig: {},
      columnConfig: [{ columnKey: 'name', displayLabel: 'Name', displayOrder: 0 }],
      sortOrder: 1,
      isVisible: false,
      isInherited: true,
      createdBy: 'test',
    });
    const result = await loadCustomPageRender(db, child.id, 'hidden');
    expect(result).toBeNull();
  });

  it('returns null for a slug no page carries', async () => {
    const { db, child } = await seedScenario();
    const result = await loadCustomPageRender(db, child.id, 'ghost-page');
    expect(result).toBeNull();
  });
});

describe('the client column allow-list (B2, the structural F1 fix)', () => {
  it('a template page asking for internal_status gets rows WITHOUT it, and its pick dropped', async () => {
    const { db, child } = await seedScenario();
    await insertCustomPage(db, {
      brandId: null,
      slug: 'leaky',
      title: 'Leaky',
      sourceTableKey: 'creative_briefs',
      filterConfig: {},
      columnConfig: [
        { columnKey: 'name', displayLabel: 'Name', displayOrder: 0 },
        { columnKey: 'internal_status', displayLabel: 'Internal Status', displayOrder: 1 },
        { columnKey: 'client_status', displayLabel: 'Client Status', displayOrder: 2 },
      ],
      sortOrder: 10,
      isVisible: true,
      isInherited: true,
      createdBy: 'test',
    });

    const result = await loadCustomPageRender(db, child.id, 'leaky');

    expect(result).not.toBeNull();
    expect(result?.page.columnConfig.map((pick) => pick.columnKey)).toEqual([
      'name',
      'client_status',
    ]);
    for (const row of result?.rows ?? []) {
      expect(row).not.toHaveProperty('internal_status');
      expect(row).not.toHaveProperty('internalStatus');
      expect(row).toHaveProperty('client_status');
    }
  });

  it('keys the rows by Postgres column name, so a filter on client_status actually matches', async () => {
    const { db, child } = await seedScenario();
    const rows = await loadCustomPageRows(db, child.id, 'creative_briefs');
    expect(rows.map((row) => row['client_status']).sort()).toEqual([
      'approved',
      'pending_for_approval',
    ]);
    expect(Object.keys(rows[0] ?? {}).every((key) => !/[A-Z]/.test(key))).toBe(true);
  });

  it('never lets a cost, a price or an internal column through on creators', () => {
    for (const key of [
      'creator_cost',
      'cost_usd',
      'budget_per_60s',
      'partnership_price_per_30_days',
      'internal_creator_status',
      'internal_brief',
      'internal_assets_status',
    ]) {
      expect(isClientVisibleColumn('creators', key)).toBe(false);
    }
    expect(isClientVisibleColumn('creators', 'partnership_activity')).toBe(true);
    expect(isClientVisibleColumn('creative_briefs', 'qa_designer')).toBe(false);
    expect(isClientVisibleColumn('nope', 'name')).toBe(false);
  });
});
