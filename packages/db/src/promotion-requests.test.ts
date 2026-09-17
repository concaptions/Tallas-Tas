import { eq } from 'drizzle-orm';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  DEMO_ADMIN_ACTOR_ID,
  demoPromotionRequests,
  demoReviewedPromotionRequests,
} from './demo-data';
import {
  listPendingPromotionRequests,
  listPromotionRequests,
  setPromotionRequestStatus,
  type PromotionRequestRow,
} from './promotion-requests';
import { agencies, brands, promotionRequests, type PromotionRequest } from './schema';
import { seed } from './seed';
import { testDb, type PgliteDb } from './testing';

/** A fresh database with every migration applied and the demo content seeded into the agency. */
async function seeded(): Promise<{ db: PgliteDb; agencyId: string; brandId: string }> {
  const db = await testDb();
  const { agency, childBrand } = await seed(db);
  return { db, agencyId: agency.id, brandId: childBrand.id };
}

/** Narrows a returning-clause row past `noUncheckedIndexedAccess`, or fails naming what was missing. */
function only<T>(rows: T[], what: string): T {
  const row = rows[0];
  if (row === undefined) throw new Error(`expected one ${what}`);
  return row;
}

/**
 * A SECOND agency with its own brand and its own pending request: the tenancy neighbour every
 * assertion below is measured against. The request is deliberately the newest of them all, so a read
 * that forgot its agency filter would put it at the top of the admin's queue and fail loudly.
 */
async function rivalAgency(db: PgliteDb): Promise<{ agencyId: string; request: PromotionRequest }> {
  const agency = only(
    await db
      .insert(agencies)
      .values({ name: 'Rival Creative', slug: 'rival-creative' })
      .returning(),
    'agency',
  );
  const brand = only(
    await db
      .insert(brands)
      .values({ agencyId: agency.id, name: 'Rival Client', slug: 'rival-client' })
      .returning(),
    'brand',
  );
  const request = only(
    await db
      .insert(promotionRequests)
      .values({
        brandId: brand.id,
        tableName: 'personas',
        fieldName: 'core_desires',
        currentValue: 'Wants to feel rested.',
        proposedValue: 'Wants to stop negotiating with the alarm clock every morning.',
        requestedBy: 'Someone Else',
        requestedAt: new Date('2026-09-18T09:00:00.000Z'),
      })
      .returning(),
    'promotion request',
  );
  return { agencyId: agency.id, request };
}

describe('migration 0012 on PGlite', () => {
  it('seeds the five fixtures, ids included, three of them pending', async () => {
    const { db, agencyId } = await seeded();

    const all = await listPromotionRequests(db, agencyId);
    const pending = await listPromotionRequests(db, agencyId, 'pending');

    expect(all).toHaveLength(5);
    expect(pending).toEqual(demoPromotionRequests);
    expect(pending).toHaveLength(3);
    expect(await listPromotionRequests(db, agencyId, 'approved')).toEqual(
      demoReviewedPromotionRequests.filter((row) => row.status === 'approved'),
    );
    expect(await listPromotionRequests(db, agencyId, 'rejected')).toEqual(
      demoReviewedPromotionRequests.filter((row) => row.status === 'rejected'),
    );
  });

  it('raises the three pending requests from three different brands and three different tables', async () => {
    const { db, agencyId } = await seeded();

    const pending = await listPendingPromotionRequests(db, agencyId);

    expect(new Set(pending.map((row) => row.brandName))).toEqual(
      new Set(['Funky Painting', 'Gratsi', 'Mattress Central']),
    );
    expect(new Set(pending.map((row) => row.tableName))).toEqual(
      new Set(['angles', 'themes', 'personas']),
    );
    // Both halves of every diff are filled: the Change cell has two values to render.
    expect(pending.every((row) => row.currentValue.length > 0)).toBe(true);
    expect(pending.every((row) => row.proposedValue !== row.currentValue)).toBe(true);
    // `row_id` is nullable and one fixture exercises it: a request about a field's shape.
    expect(pending.filter((row) => row.rowId === null)).toHaveLength(1);
    expect(pending.every((row) => row.reviewedBy === null && row.reviewedAt === null)).toBe(true);
  });
});

describe('promotion request queries', () => {
  it('never returns a request belonging to another agency, in any status', async () => {
    const { db, agencyId } = await seeded();
    const rival = await rivalAgency(db);

    const mine = await listPromotionRequests(db, agencyId);
    const pending = await listPendingPromotionRequests(db, agencyId);
    const theirs = await listPromotionRequests(db, rival.agencyId);

    expect(mine.map((row) => row.id)).not.toContain(rival.request.id);
    expect(pending.map((row) => row.id)).not.toContain(rival.request.id);
    expect(mine).toHaveLength(5);
    // The scope cuts both ways: the rival admin sees exactly their own one request.
    expect(theirs.map((row) => row.id)).toEqual([rival.request.id]);
    expect(theirs[0]?.brandName).toBe('Rival Client');
  });

  it('setPromotionRequestStatus refuses a request that belongs to another agency', async () => {
    const { db, agencyId } = await seeded();
    const rival = await rivalAgency(db);

    expect(
      await setPromotionRequestStatus(
        db,
        agencyId,
        rival.request.id,
        'approved',
        DEMO_ADMIN_ACTOR_ID,
      ),
    ).toBeNull();

    const theirs = await listPendingPromotionRequests(db, rival.agencyId);
    expect(theirs.map((row) => row.status)).toEqual(['pending']);
    expect(theirs[0]?.reviewedBy).toBeNull();
  });

  it('orders by requested_at, newest first, whatever the clock did to the row since', async () => {
    const { db, agencyId } = await seeded();

    const before = await listPendingPromotionRequests(db, agencyId);
    // The oldest pending request is touched last; `updated_at` moves, `requested_at` does not, so
    // the queue an admin is reading does not reshuffle under their cursor.
    const oldest = only([...before].reverse(), 'pending request');
    await db
      .update(promotionRequests)
      .set({ updatedAt: new Date('2026-09-20T10:00:00.000Z') })
      .where(eq(promotionRequests.id, oldest.id));

    const after = await listPendingPromotionRequests(db, agencyId);

    expect(before.map((row) => row.requestedAt.toISOString())).toEqual([
      '2026-09-17T08:10:00.000Z',
      '2026-09-16T09:05:00.000Z',
      '2026-09-15T14:20:00.000Z',
    ]);
    expect(after.map((row) => row.id)).toEqual(before.map((row) => row.id));
    // All five read the same way, reviewed requests included.
    const all = await listPromotionRequests(db, agencyId);
    const requestedAt = all.map((row) => row.requestedAt.getTime());
    expect([...requestedAt].sort((a, b) => b - a)).toEqual(requestedAt);
  });

  it('returns a request whose brand has been soft-deleted with a null brand name, not a missing row', async () => {
    const { db, agencyId } = await seeded();
    const orphaned = only(
      (await listPendingPromotionRequests(db, agencyId)).filter(
        (row) => row.brandName === 'Gratsi',
      ),
      'Gratsi request',
    );

    await db
      .update(brands)
      .set({ deletedAt: new Date('2026-09-18T08:00:00.000Z') })
      .where(eq(brands.id, orphaned.brandId));

    const pending = await listPendingPromotionRequests(db, agencyId);
    const row = only(
      pending.filter((candidate) => candidate.id === orphaned.id),
      'the offboarded brand’s request',
    );

    expect(pending).toHaveLength(3);
    expect(row.brandName).toBeNull();
    expect(row.brandId).toBe(orphaned.brandId);
    // Every other request keeps its name: one offboarded brand does not degrade the rest.
    expect(pending.filter((candidate) => candidate.brandName === null)).toHaveLength(1);
  });

  it('drops a soft-deleted request from every read', async () => {
    const { db, agencyId } = await seeded();
    const [first] = demoPromotionRequests;

    await db
      .update(promotionRequests)
      .set({ deletedAt: new Date('2026-09-18T08:00:00.000Z') })
      .where(eq(promotionRequests.id, first?.id ?? ''));

    expect(await listPendingPromotionRequests(db, agencyId)).toHaveLength(2);
    expect(await listPromotionRequests(db, agencyId)).toHaveLength(4);
    expect(
      await setPromotionRequestStatus(
        db,
        agencyId,
        first?.id ?? '',
        'approved',
        DEMO_ADMIN_ACTOR_ID,
      ),
    ).toBeNull();
  });

  it('setPromotionRequestStatus settles one request, leaves its siblings and the queue alone', async () => {
    const { db, agencyId } = await seeded();
    const target = only(demoPromotionRequests, 'pending fixture');

    const approved = await setPromotionRequestStatus(
      db,
      agencyId,
      target.id,
      'approved',
      DEMO_ADMIN_ACTOR_ID,
      'Motion Graphic is already in three brands’ angle lists. Promoted.',
    );
    const pending = await listPendingPromotionRequests(db, agencyId);

    expect(approved).toMatchObject({
      id: target.id,
      status: 'approved',
      reviewedBy: DEMO_ADMIN_ACTOR_ID,
      brandName: 'Funky Painting',
      reviewNote: 'Motion Graphic is already in three brands’ angle lists. Promoted.',
    });
    expect(approved?.reviewedAt).toBeInstanceOf(Date);
    // The decision does not touch the clock the queue is ordered by.
    expect(approved?.requestedAt).toEqual(target.requestedAt);
    expect(pending).toHaveLength(2);
    expect(pending.map((row) => row.id)).not.toContain(target.id);
    expect(await listPromotionRequests(db, agencyId, 'approved')).toHaveLength(2);
    expect(await listPromotionRequests(db, agencyId)).toHaveLength(5);
  });

  it('setPromotionRequestStatus returns null for an id no agency has', async () => {
    const { db, agencyId } = await seeded();

    expect(
      await setPromotionRequestStatus(
        db,
        agencyId,
        '00000000-0000-4000-8000-000000000000',
        'rejected',
        DEMO_ADMIN_ACTOR_ID,
      ),
    ).toBeNull();
    expect(await listPendingPromotionRequests(db, agencyId)).toEqual(demoPromotionRequests);
  });

  it('exposes one row type for fixtures and database rows, and one statement for the pending read', async () => {
    const { db, agencyId } = await seeded();

    expect(await listPendingPromotionRequests(db, agencyId)).toEqual(
      await listPromotionRequests(db, agencyId, 'pending'),
    );
    expectTypeOf(demoPromotionRequests).toEqualTypeOf<PromotionRequestRow[]>();
    expectTypeOf(demoReviewedPromotionRequests).toEqualTypeOf<PromotionRequestRow[]>();
    expectTypeOf(await listPromotionRequests(db, agencyId)).toEqualTypeOf<PromotionRequestRow[]>();
    expectTypeOf<PromotionRequestRow>().toExtend<PromotionRequest>();
    expectTypeOf<PromotionRequestRow['status']>().toEqualTypeOf<
      'pending' | 'approved' | 'rejected'
    >();
  });
});
