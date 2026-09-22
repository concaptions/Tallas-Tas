import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
  clientCalendarEvents,
  clientConcepts,
  clientCopywriting,
  clientCreatives,
  clientCreators,
  clientPartnershipAds,
  clientVisibleFields,
  listAnnotations,
  listComments,
} from './client-queries';
import {
  annotations,
  comments,
  concepts,
  creativeBriefs,
  creators,
  interfaceFields,
} from './schema';
import { seed } from './seed';
import { testDb, type PgliteDb } from './testing';
import { withBrand } from './tenancy';

async function seeded(): Promise<{ db: PgliteDb; brandId: string }> {
  const db = await testDb();
  const { childBrand } = await seed(db);
  return { db, brandId: childBrand.id };
}

function first<T>(rows: T[]): T {
  const [row] = rows;
  if (row === undefined) throw new Error('expected at least one row');
  return row;
}

function findOrThrow<T extends { name: string }>(rows: T[], name: string): T {
  const row = rows.find((r) => r.name === name);
  if (row === undefined) throw new Error(`row with name "${name}" not found`);
  return row;
}

// ─── Allowlist enforcement ──────────────────────────────────────────────────

const CONCEPT_ALLOWED_KEYS = [
  'id',
  'batch',
  'category',
  'name',
  'conceptStyle',
  'angleName',
  'themeName',
  'productName',
  'description',
  'painPoints',
  'usp',
  'personaName',
  'hookExamples',
  'approvalStatus',
  'clientStatus',
];

const CREATIVE_ALLOWED_KEYS = [
  'id',
  'name',
  'type',
  'funnel',
  'designFile',
  'inspirationImage',
  'clientStatus',
  'platform',
  'performance',
];

const COPY_ALLOWED_KEYS = [
  'id',
  'copyNumber',
  'primaryCopy',
  'headline',
  'linkDescription',
  'cta',
  'funnel',
  'status',
  'clientComment',
];

const UGC_ALLOWED_KEYS = [
  'id',
  'name',
  'ageBracket',
  'gender',
  'profilePicUrl',
  'videoIntroUrl',
  'shippingLocation',
  'trackingNumber',
  'deadline',
  'clientStatus',
  'clientNote',
  'rawAssetsUrl',
];

const PARTNERSHIP_ALLOWED_KEYS = [
  'id',
  'name',
  'instagramUsername',
  'partnershipActivity',
  'expiresOn',
];

const CALENDAR_ALLOWED_KEYS = [
  'id',
  'name',
  'holiday',
  'officialDate',
  'adsLaunchDate',
  'adsEndDate',
];

describe('client query allowlist enforcement', () => {
  it('clientConcepts returns ONLY allowlisted fields', async () => {
    const { db, brandId } = await seeded();
    const rows = await clientConcepts(db, brandId);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([...CONCEPT_ALLOWED_KEYS].sort());
    }
  });

  it('clientCreatives returns ONLY allowlisted fields (with approved brief)', async () => {
    const { db, brandId } = await seeded();
    const scope = withBrand(db, brandId);
    await scope
      .insert(creativeBriefs, {
        name: 'TEST-BRIEF',
        source: 'TAS',
        funnel: 'TOF',
        type: 'Video',
        internalStatus: 'approved',
        clientStatus: 'pending_for_approval',
      })
      .returning();

    const rows = await clientCreatives(db, brandId);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([...CREATIVE_ALLOWED_KEYS].sort());
    }
  });

  it('clientCopywriting returns ONLY allowlisted fields', async () => {
    const { db, brandId } = await seeded();
    const rows = await clientCopywriting(db, brandId);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([...COPY_ALLOWED_KEYS].sort());
    }
  });

  it('clientCreators returns ONLY allowlisted fields', async () => {
    const { db, brandId } = await seeded();
    const rows = await clientCreators(db, brandId);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([...UGC_ALLOWED_KEYS].sort());
    }
  });

  it('clientPartnershipAds returns ONLY allowlisted fields', async () => {
    const { db, brandId } = await seeded();
    const rows = await clientPartnershipAds(db, brandId);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([...PARTNERSHIP_ALLOWED_KEYS].sort());
    }
  });

  it('clientCalendarEvents returns ONLY allowlisted fields', async () => {
    const { db, brandId } = await seeded();
    const rows = await clientCalendarEvents(db, brandId);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([...CALENDAR_ALLOWED_KEYS].sort());
    }
  });
});

// ─── Security: cost/price exclusion ─────────────────────────────────────────

describe('cost and price fields are never exposed to clients', () => {
  it('clientCreators never returns creator_cost, budget_per_60s, or cost_usd', async () => {
    const { db, brandId } = await seeded();
    const scope = withBrand(db, brandId);
    await scope.insert(creators, {
      name: 'Expensive Creator',
      creatorCost: 500,
      budgetPer60s: 200,
      costUsd: 1000,
      clientStatus: 'pending_for_approval',
    });

    const rows = await clientCreators(db, brandId);
    const expensive = findOrThrow(rows, 'Expensive Creator');
    const keys = Object.keys(expensive);
    expect(keys).not.toContain('creatorCost');
    expect(keys).not.toContain('budgetPer60s');
    expect(keys).not.toContain('costUsd');
    expect(keys).not.toContain('creator_cost');
    expect(keys).not.toContain('budget_per_60s');
    expect(keys).not.toContain('cost_usd');
  });

  it('clientPartnershipAds never returns partnership_price_per_30_days', async () => {
    const { db, brandId } = await seeded();
    const scope = withBrand(db, brandId);
    await scope.insert(creators, {
      name: 'Pricey Partner',
      forPartnershipAds: true,
      partnershipPricePer30Days: 1000,
      partnershipActivity: 'active',
      clientStatus: 'pending_for_approval',
    });

    const rows = await clientPartnershipAds(db, brandId);
    const partner = findOrThrow(rows, 'Pricey Partner');
    const keys = Object.keys(partner);
    expect(keys).not.toContain('partnershipPricePer30Days');
    expect(keys).not.toContain('partnership_price_per_30_days');
    expect(keys).not.toContain('creatorCost');
    expect(keys).not.toContain('budgetPer60s');
  });
});

// ─── Security: source exclusion ─────────────────────────────────────────────

describe('platform source is never exposed to clients', () => {
  it('clientCreatives never returns source', async () => {
    const { db, brandId } = await seeded();
    const scope = withBrand(db, brandId);
    await scope.insert(creativeBriefs, {
      name: 'SECRET-SOURCE',
      source: 'Client',
      internalStatus: 'approved',
      clientStatus: 'pending_for_approval',
      funnel: 'TOF',
      type: 'Video',
    });

    const rows = await clientCreatives(db, brandId);
    const row = findOrThrow(rows, 'SECRET-SOURCE');
    expect(Object.keys(row)).not.toContain('source');
  });
});

// ─── Security: internal status filtering ────────────────────────────────────

describe('internal status filtering', () => {
  it('clientCreatives returns only internally-approved briefs from the demo seed', async () => {
    const { db, brandId } = await seeded();
    const rows = await clientCreatives(db, brandId);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => Object.keys(r).includes('clientStatus'))).toBe(true);
    expect(rows.every((r) => !Object.keys(r).includes('internalStatus'))).toBe(true);
  });

  it('clientCreatives excludes briefs with internalStatus != approved', async () => {
    const { db, brandId } = await seeded();
    const scope = withBrand(db, brandId);
    await scope.insert(creativeBriefs, {
      name: 'NOT-APPROVED',
      source: 'TAS',
      internalStatus: 'video_editing_in_progress',
      clientStatus: 'pending_for_approval',
      funnel: 'TOF',
      type: 'Video',
    });
    await scope.insert(creativeBriefs, {
      name: 'IS-APPROVED',
      source: 'TAS',
      internalStatus: 'approved',
      clientStatus: 'pending_for_approval',
      funnel: 'TOF',
      type: 'Video',
    });

    const rows = await clientCreatives(db, brandId);
    const names = rows.map((r) => r.name);
    expect(names).toContain('IS-APPROVED');
    expect(names).not.toContain('NOT-APPROVED');
  });
});

// ─── Interface config filtering ─────────────────────────────────────────────

describe('interface config field visibility', () => {
  it('clientVisibleFields returns only visible=true fields for a page', async () => {
    const { db, brandId } = await seeded();
    const visible = await clientVisibleFields(db, brandId, 'concepts');
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((f) => typeof f.fieldName === 'string')).toBe(true);
    expect(visible.every((f) => typeof f.label === 'string')).toBe(true);
    expect(visible.every((f) => typeof f.clientEditable === 'boolean')).toBe(true);
  });

  it('hiding a field removes it from clientVisibleFields', async () => {
    const { db, brandId } = await seeded();
    const before = await clientVisibleFields(db, brandId, 'concepts');
    const hookField = before.find((f) => f.fieldName === 'hook_examples');
    expect(hookField).toBeDefined();

    await db
      .update(interfaceFields)
      .set({ visible: false })
      .where(eq(interfaceFields.fieldName, 'hook_examples'));

    const after = await clientVisibleFields(db, brandId, 'concepts');
    expect(after.find((f) => f.fieldName === 'hook_examples')).toBeUndefined();
    expect(after.length).toBe(before.length - 1);
  });
});

// ─── Brand isolation ────────────────────────────────────────────────────────

describe('brand isolation', () => {
  it('client queries return nothing for a different brand', async () => {
    const { db } = await seeded();
    const otherBrand = '99999999-9999-4999-8999-999999999999';

    expect(await clientConcepts(db, otherBrand)).toEqual([]);
    expect(await clientCreatives(db, otherBrand)).toEqual([]);
    expect(await clientCopywriting(db, otherBrand)).toEqual([]);
    expect(await clientCreators(db, otherBrand)).toEqual([]);
    expect(await clientPartnershipAds(db, otherBrand)).toEqual([]);
    expect(await clientCalendarEvents(db, otherBrand)).toEqual([]);
  });
});

// ─── Annotations & Comments ─────────────────────────────────────────────────

describe('annotation and comment queries', () => {
  it('listAnnotations returns annotations for a specific record, brand-scoped', async () => {
    const { db, brandId } = await seeded();
    const scope = withBrand(db, brandId);
    const [ann] = await scope
      .insert(annotations, {
        recordType: 'creative_brief',
        recordId: '00000000-0000-4000-8000-000000000001',
        authorId: 'user_test',
        authorName: 'Test User',
        kind: 'video_timestamp',
        timestampSeconds: 12.5,
        body: 'Nice frame',
      })
      .returning();

    const rows = await listAnnotations(
      db,
      brandId,
      'creative_brief',
      '00000000-0000-4000-8000-000000000001',
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.find((r) => r.id === ann?.id)).toBeDefined();
    const row0 = first(rows);
    expect(row0.kind).toBe('video_timestamp');
    expect(Object.keys(row0)).not.toContain('brandId');
    expect(Object.keys(row0)).not.toContain('deletedAt');
  });

  it('listAnnotations excludes soft-deleted annotations', async () => {
    const { db, brandId } = await seeded();
    const scope = withBrand(db, brandId);
    const inserted = await scope
      .insert(annotations, {
        recordType: 'creative_brief',
        recordId: '00000000-0000-4000-8000-000000000099',
        authorId: 'user_test',
        authorName: 'Test User',
        kind: 'image_xy',
        x: 0.5,
        y: 0.3,
        body: 'Deleted annotation',
      })
      .returning();
    const ann = first(inserted);
    await db.update(annotations).set({ deletedAt: new Date() }).where(eq(annotations.id, ann.id));

    const rows = await listAnnotations(
      db,
      brandId,
      'creative_brief',
      '00000000-0000-4000-8000-000000000099',
    );
    expect(rows).toHaveLength(0);
  });

  it('listComments returns comments with parentCommentId for threading', async () => {
    const { db, brandId } = await seeded();
    const scope = withBrand(db, brandId);
    const parentInserted = await scope
      .insert(comments, {
        recordType: 'concept',
        recordId: '00000000-0000-4000-8000-000000000002',
        authorId: 'user_test',
        authorName: 'Test User',
        body: 'Great concept',
      })
      .returning();
    const parent = first(parentInserted);
    const replyInserted = await scope
      .insert(comments, {
        recordType: 'concept',
        recordId: '00000000-0000-4000-8000-000000000002',
        parentCommentId: parent.id,
        authorId: 'user_test_2',
        authorName: 'Other User',
        body: 'I agree',
      })
      .returning();
    const reply = first(replyInserted);

    const rows = await listComments(db, brandId, 'concept', '00000000-0000-4000-8000-000000000002');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.parentCommentId).toBeNull();
    expect(rows[1]?.parentCommentId).toBe(parent.id);
    expect(rows[1]?.id).toBe(reply.id);
    const row0 = first(rows);
    expect(Object.keys(row0)).not.toContain('brandId');
    expect(Object.keys(row0)).not.toContain('deletedAt');
  });

  it('listAnnotations is brand-isolated', async () => {
    const { db, brandId } = await seeded();
    const scope = withBrand(db, brandId);
    await scope.insert(annotations, {
      recordType: 'creative_brief',
      recordId: '00000000-0000-4000-8000-000000000050',
      authorId: 'user_test',
      authorName: 'Test User',
      kind: 'video_timestamp',
      timestampSeconds: 5.0,
      body: 'Brand-specific',
    });

    const otherBrand = '99999999-9999-4999-8999-999999999999';
    const rows = await listAnnotations(
      db,
      otherBrand,
      'creative_brief',
      '00000000-0000-4000-8000-000000000050',
    );
    expect(rows).toHaveLength(0);
  });
});

// ─── Partnership expiresOn computation ──────────────────────────────────────

describe('partnership expiresOn computation', () => {
  it('computes expiresOn from partnershipActivatedAt + periodDays', async () => {
    const { db, brandId } = await seeded();
    const scope = withBrand(db, brandId);
    await scope.insert(creators, {
      name: 'Expiry Test',
      forPartnershipAds: true,
      partnershipActivity: 'active',
      partnershipActivatedAt: new Date('2026-01-01T00:00:00Z'),
      partnershipPeriodDays: 30,
      clientStatus: 'pending_for_approval',
    });

    const rows = await clientPartnershipAds(db, brandId);
    const row = findOrThrow(rows, 'Expiry Test');
    expect(row.expiresOn).toContain('2026-01-31');
  });

  it('expiresOn is null when partnershipActivatedAt or periodDays is missing', async () => {
    const { db, brandId } = await seeded();
    const scope = withBrand(db, brandId);
    await scope.insert(creators, {
      name: 'No Expiry',
      forPartnershipAds: true,
      partnershipActivity: 'active',
      clientStatus: 'pending_for_approval',
    });

    const rows = await clientPartnershipAds(db, brandId);
    const row = findOrThrow(rows, 'No Expiry');
    expect(row.expiresOn).toBeNull();
  });
});

// ─── Soft-delete exclusion ──────────────────────────────────────────────────

describe('soft-deleted rows are excluded', () => {
  it('clientConcepts excludes soft-deleted concepts', async () => {
    const { db, brandId } = await seeded();
    const before = await clientConcepts(db, brandId);

    await db.update(concepts).set({ deletedAt: new Date() }).where(eq(concepts.brandId, brandId));

    const after = await clientConcepts(db, brandId);
    expect(before.length).toBeGreaterThan(0);
    expect(after).toHaveLength(0);
  });
});
