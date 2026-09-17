import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import { creators, type Creator, type NewCreator } from './schema';
import { withBrand } from './tenancy';

/**
 * The UGC Management page's data access (PRD §5.8, and §5.8.1's partnership fields, which live on
 * the same record — `schema/creators.ts` says why). Every function takes the database as its first
 * argument (no module-level singleton) and reads and writes through `withBrand(db, brandId)`, so
 * `brand_id = $brandId AND deleted_at IS NULL` is on every statement and an insert cannot choose its
 * own brand. Nothing here contains business logic; the domain functions call these.
 *
 * Two things this module never does. It never computes when a partnership lapses — that is
 * `partnershipExpiresOn` / `daysUntilPartnershipExpiry` in `packages/domain`, pure functions over
 * the three stored inputs, so the page, the 25-day reminder and the tests all read one
 * implementation. And it never names a status: the three status columns are opaque keys here, and
 * the set of keys, their labels and their tones live in `@tas/domain/state` (CLAUDE.md
 * non-negotiable 2).
 */

/** The columns the scope, the clock and the actor own; a caller never sets them. */
type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

/**
 * What the creator form submits for create (`name` required) and, partially, for update. The
 * partnership fields are in here like any other: turning `forPartnershipAds` on, setting an
 * activation date or granting an extension are ordinary edits of the creator record, not a separate
 * write path.
 */
export type CreatorInput = Omit<NewCreator, ManagedColumn>;

/**
 * A creator as the grid and the partnership list render it.
 *
 * It is the row and nothing else — there is no joined column today, because PRD §5.8's links
 * (Concepts to film, Products, Raw assets) are not in this ticket. The alias exists anyway, and is
 * what everything outside this package names, for the reason `PersonaListRow` does: `demoCreators`
 * satisfies `CreatorListRow[]`, so a page reads demo fixtures and database rows through ONE type,
 * and the day a link lands the joined column is added here rather than in every consumer.
 */
export type CreatorListRow = Creator;

/** The brand's live creators, newest edit first. */
export async function listCreators(db: Db, brandId: string): Promise<CreatorListRow[]> {
  return withBrand(db, brandId).select(creators).orderBy(desc(creators.updatedAt));
}

/**
 * The brand's live creators who are marked for partnership ads, newest edit first: the client-facing
 * list PRD §5.8.1 asks for ("its own client-facing list they can group and filter").
 *
 * `for_partnership_ads` — the PRD's up-front qualifier — is the filter, and it is applied in SQL
 * inside the scope rather than in TypeScript after a full read, so a brand with a hundred creators
 * and three partnerships reads three rows through the `creators_partnership_idx` index. A creator
 * whose partnership has ENDED is still returned: the list is the brand's partnership history, and
 * whether a row has lapsed is `daysUntilPartnershipExpiry` in `packages/domain`, not a filter here.
 */
export async function listPartnershipCreators(db: Db, brandId: string): Promise<CreatorListRow[]> {
  return withBrand(db, brandId)
    .select(creators, eq(creators.forPartnershipAds, true))
    .orderBy(desc(creators.updatedAt));
}

/** One live creator of the brand, or null: another brand's id never resolves. */
export async function getCreatorById(
  db: Db,
  brandId: string,
  id: string,
): Promise<CreatorListRow | null> {
  const [row] = await withBrand(db, brandId).select(creators, eq(creators.id, id)).limit(1);
  return row ?? null;
}

/** Creates a creator in the scope; `brand_id` is the scope's, whatever `values` says. */
export async function insertCreator(
  db: Db,
  brandId: string,
  values: CreatorInput,
  actorId: string,
): Promise<Creator> {
  const [row] = await withBrand(db, brandId)
    .insert(creators, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('creators insert returned no row');
  }
  return row;
}

/**
 * Patches one live creator of the brand and returns it, or null when the id belongs to another brand
 * or to a soft-deleted row — the scope makes those the same outcome: zero rows changed.
 */
export async function updateCreator(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<CreatorInput>,
  actorId: string,
): Promise<Creator | null> {
  const [row] = await withBrand(db, brandId)
    .update(creators, { ...patch, updatedBy: actorId, updatedAt: new Date() }, eq(creators.id, id))
    .returning();
  return row ?? null;
}
