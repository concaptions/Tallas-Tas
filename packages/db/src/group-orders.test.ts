import { describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';

import {
  clearGroupOrder,
  getGroupOrder,
  saveGroupOrder,
  type GroupOrderEntry,
} from './group-orders';
import { createUserTableView } from './user-table-views';
import { brands, userGroupOrders, users } from './schema';
import { testDb, type PgliteDb } from './testing';

const AGENCY_ID = 'a0000000-0000-4000-8000-0000000000ab';

/**
 * PGlite tests for the per-user group-order DAO (Phase B5 commit 2). Each test seeds exactly the
 * `users` and `brands` rows the FKs on `user_group_orders` require (0072 cascades on delete; the
 * tests themselves don't need to), then exercises the view-first-then-global read, the two-flavour
 * upsert, and the idempotent clear.
 */
async function seeded(): Promise<{
  db: PgliteDb;
  userId: string;
  brandId: string;
  clerkUserId: string;
}> {
  const db = await testDb();
  await db.execute(
    sql`insert into agencies (id, name, slug) values (${AGENCY_ID}, 'Test Agency', 'test-agency') on conflict do nothing`,
  );
  const [user] = await db
    .insert(users)
    .values({
      clerkUserId: 'user_group_order_actor',
      email: 'actor@tas.example',
      fullName: 'Grace Order',
    })
    .returning();
  const [brand] = await db
    .insert(brands)
    .values({ agencyId: AGENCY_ID, name: 'Test Brand', slug: 'test-brand' })
    .returning();
  if (user === undefined || brand === undefined) {
    throw new Error('seed produced no row');
  }
  return { db, userId: user.id, brandId: brand.id, clerkUserId: user.clerkUserId };
}

const ORDER_A: readonly GroupOrderEntry[] = [
  { value: 'approved', position: 0, pinned: false },
  { value: 'draft', position: 1, pinned: false },
];

const ORDER_B: readonly GroupOrderEntry[] = [
  { value: 'draft', position: 0, pinned: true },
  { value: 'approved', position: 1, pinned: false },
];

describe('group-orders DAO', () => {
  it('round-trips a view-specific order', async () => {
    const { db, userId, brandId, clerkUserId } = await seeded();
    const view = await createUserTableView(db, clerkUserId, 'briefs', 'My view');

    await saveGroupOrder({
      db,
      userId,
      brandId,
      viewId: view.id,
      tableKey: 'briefs',
      fieldKey: 'internal_status',
      order: ORDER_A,
    });

    const read = await getGroupOrder({
      db,
      userId,
      brandId,
      viewId: view.id,
      tableKey: 'briefs',
      fieldKey: 'internal_status',
    });
    expect(read).toEqual(ORDER_A);
  });

  it('round-trips a global order (view_id null)', async () => {
    const { db, userId, brandId } = await seeded();

    await saveGroupOrder({
      db,
      userId,
      brandId,
      viewId: null,
      tableKey: 'briefs',
      fieldKey: 'internal_status',
      order: ORDER_A,
    });

    const read = await getGroupOrder({
      db,
      userId,
      brandId,
      viewId: null,
      tableKey: 'briefs',
      fieldKey: 'internal_status',
    });
    expect(read).toEqual(ORDER_A);
  });

  it('view-specific overrides global in the read fallback', async () => {
    const { db, userId, brandId, clerkUserId } = await seeded();
    const view = await createUserTableView(db, clerkUserId, 'briefs', 'Mine');

    await saveGroupOrder({
      db,
      userId,
      brandId,
      viewId: null,
      tableKey: 'briefs',
      fieldKey: 'internal_status',
      order: ORDER_A,
    });
    await saveGroupOrder({
      db,
      userId,
      brandId,
      viewId: view.id,
      tableKey: 'briefs',
      fieldKey: 'internal_status',
      order: ORDER_B,
    });

    // With a view id → view wins.
    const withView = await getGroupOrder({
      db,
      userId,
      brandId,
      viewId: view.id,
      tableKey: 'briefs',
      fieldKey: 'internal_status',
    });
    expect(withView).toEqual(ORDER_B);
    // Without a view id → the global row.
    const global = await getGroupOrder({
      db,
      userId,
      brandId,
      viewId: null,
      tableKey: 'briefs',
      fieldKey: 'internal_status',
    });
    expect(global).toEqual(ORDER_A);
  });

  it('falls back from a missing view-specific row to the global row', async () => {
    const { db, userId, brandId, clerkUserId } = await seeded();
    const view = await createUserTableView(db, clerkUserId, 'briefs', 'Mine');

    await saveGroupOrder({
      db,
      userId,
      brandId,
      viewId: null,
      tableKey: 'briefs',
      fieldKey: 'internal_status',
      order: ORDER_A,
    });

    const read = await getGroupOrder({
      db,
      userId,
      brandId,
      viewId: view.id,
      tableKey: 'briefs',
      fieldKey: 'internal_status',
    });
    expect(read).toEqual(ORDER_A);
  });

  it('returns null when no order has been saved', async () => {
    const { db, userId, brandId } = await seeded();
    const read = await getGroupOrder({
      db,
      userId,
      brandId,
      viewId: null,
      tableKey: 'briefs',
      fieldKey: 'internal_status',
    });
    expect(read).toBeNull();
  });

  it('clear removes the row; subsequent get returns null; clearing again is a no-op', async () => {
    const { db, userId, brandId } = await seeded();

    await saveGroupOrder({
      db,
      userId,
      brandId,
      viewId: null,
      tableKey: 'briefs',
      fieldKey: 'internal_status',
      order: ORDER_A,
    });
    await clearGroupOrder({
      db,
      userId,
      brandId,
      viewId: null,
      tableKey: 'briefs',
      fieldKey: 'internal_status',
    });
    expect(
      await getGroupOrder({
        db,
        userId,
        brandId,
        viewId: null,
        tableKey: 'briefs',
        fieldKey: 'internal_status',
      }),
    ).toBeNull();

    // Idempotent: clearing when nothing is there must not throw.
    await expect(
      clearGroupOrder({
        db,
        userId,
        brandId,
        viewId: null,
        tableKey: 'briefs',
        fieldKey: 'internal_status',
      }),
    ).resolves.toBeUndefined();
  });

  it('is idempotent: saving the same scope twice yields exactly one row', async () => {
    const { db, userId, brandId } = await seeded();

    await saveGroupOrder({
      db,
      userId,
      brandId,
      viewId: null,
      tableKey: 'briefs',
      fieldKey: 'internal_status',
      order: ORDER_A,
    });
    await saveGroupOrder({
      db,
      userId,
      brandId,
      viewId: null,
      tableKey: 'briefs',
      fieldKey: 'internal_status',
      order: ORDER_B,
    });

    const rows = await db
      .select()
      .from(userGroupOrders)
      .where(and(eq(userGroupOrders.userId, userId), eq(userGroupOrders.brandId, brandId)));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.orderJson).toEqual(ORDER_B);
  });
});
