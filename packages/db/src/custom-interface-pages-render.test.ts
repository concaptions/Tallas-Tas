import { describe, expect, it } from 'vitest';

import { agencies, brands, creativeBriefs } from './schema';
import { testDb } from './testing';
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
      columnConfig: [],
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
      columnConfig: [],
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
