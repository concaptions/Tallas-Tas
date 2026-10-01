import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import {
  campaignsOffers,
  collections,
  copyTypes,
  products,
  youtubeCopy,
  youtubeCopyCampaigns,
  youtubeCopyCollections,
  youtubeCopyCopyTypes,
  youtubeCopyProducts,
  type NewYoutubeCopy,
  type YoutubeCopy,
} from './schema';
import { withBrand, type BrandScope } from './tenancy';

/**
 * The YouTube Copywriting page's data access (Airtable `tblVR1UmkbDoDzJ7z`, gap audit 2026-10-01
 * §2.12). A copy of `products.ts`, function for function: every function takes the database as its
 * first argument (no module-level singleton) and reads and writes through `withBrand(db, brandId)`,
 * so `brand_id = $brandId AND deleted_at IS NULL` is on every statement and an insert cannot choose
 * its own brand. Nothing here contains business logic; the domain functions and the Server Actions
 * call these.
 *
 * Two things this module never does. It never builds the "Copy N" TITLE — `copy_number` is the
 * stored integer and the title is rendered from it (CLAUDE.md non-negotiable 6). And it never names
 * a status, a CTA or a funnel: those columns are opaque keys here, and their labels and tones live
 * in `@tas/domain/state` and `schema/enums.ts`.
 *
 * The Airtable LOOKUPS ("Offer", "Campaign (from Campaign)", "Code (from Campaign)", "Collection
 * URL", "Link (from Product)") are not columns: they are read off the linked rows below and handed
 * to the page as the `linked*` arrays, computed here and never inside a component.
 */

/** The columns the scope, the clock and the actor own; a caller never sets them. */
type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

/** What the panel submits for create (`copyNumber` computed by the caller) or patches. */
export type YoutubeCopyInput = Omit<NewYoutubeCopy, ManagedColumn>;

/** One linked collection, with the "Collection URL" lookup beside its name. */
export interface LinkedCollection {
  readonly id: string;
  readonly name: string;
  readonly url: string | null;
}

/** One linked product, with the "Link (from Product)" lookup beside its name. */
export interface LinkedProduct {
  readonly id: string;
  readonly name: string;
  readonly link: string;
}

/** One linked campaign: the "Campaign (from Campaign)", "Code (from Campaign)" and "Offer" lookups. */
export interface LinkedCampaign {
  readonly id: string;
  readonly name: string;
  readonly code: string | null;
  readonly offer: string | null;
}

/** One linked copy type, by name. */
export interface LinkedCopyType {
  readonly id: string;
  readonly name: string;
}

/**
 * A YouTube copy row as the grid and the panel render it: the row plus its four record links,
 * each resolved to the brand's LIVE rows only and sorted by name. `demoYoutubeCopy` satisfies
 * `YoutubeCopyListRow[]`, so the page reads demo fixtures and database rows through one type.
 */
export type YoutubeCopyListRow = YoutubeCopy & {
  readonly linkedCollections: readonly LinkedCollection[];
  readonly linkedProducts: readonly LinkedProduct[];
  readonly linkedCampaigns: readonly LinkedCampaign[];
  readonly linkedCopyTypes: readonly LinkedCopyType[];
};

/** The four id lists the panel's chip pickers submit, in one shape. */
export interface YoutubeCopyLinkIds {
  readonly collectionIds: readonly string[];
  readonly productIds: readonly string[];
  readonly campaignOfferIds: readonly string[];
  readonly copyTypeIds: readonly string[];
}

// ── Junction sync helpers (delete-then-insert, as `junction-queries.ts` does) ─────────────────

export async function syncYoutubeCopyCollections(
  db: Db,
  youtubeCopyId: string,
  collectionIds: readonly string[],
): Promise<void> {
  await db
    .delete(youtubeCopyCollections)
    .where(eq(youtubeCopyCollections.youtubeCopyId, youtubeCopyId));
  if (collectionIds.length > 0) {
    await db
      .insert(youtubeCopyCollections)
      .values(collectionIds.map((collectionId) => ({ youtubeCopyId, collectionId })));
  }
}

export async function syncYoutubeCopyProducts(
  db: Db,
  youtubeCopyId: string,
  productIds: readonly string[],
): Promise<void> {
  await db.delete(youtubeCopyProducts).where(eq(youtubeCopyProducts.youtubeCopyId, youtubeCopyId));
  if (productIds.length > 0) {
    await db
      .insert(youtubeCopyProducts)
      .values(productIds.map((productId) => ({ youtubeCopyId, productId })));
  }
}

export async function syncYoutubeCopyCampaigns(
  db: Db,
  youtubeCopyId: string,
  campaignOfferIds: readonly string[],
): Promise<void> {
  await db
    .delete(youtubeCopyCampaigns)
    .where(eq(youtubeCopyCampaigns.youtubeCopyId, youtubeCopyId));
  if (campaignOfferIds.length > 0) {
    await db
      .insert(youtubeCopyCampaigns)
      .values(campaignOfferIds.map((campaignOfferId) => ({ youtubeCopyId, campaignOfferId })));
  }
}

export async function syncYoutubeCopyCopyTypes(
  db: Db,
  youtubeCopyId: string,
  copyTypeIds: readonly string[],
): Promise<void> {
  await db
    .delete(youtubeCopyCopyTypes)
    .where(eq(youtubeCopyCopyTypes.youtubeCopyId, youtubeCopyId));
  if (copyTypeIds.length > 0) {
    await db
      .insert(youtubeCopyCopyTypes)
      .values(copyTypeIds.map((copyTypeId) => ({ youtubeCopyId, copyTypeId })));
  }
}

/**
 * The write path the Server Actions use for links: every submitted id is first checked against the
 * brand's LIVE rows of its target table, so a junction can never point a copy at another brand's
 * collection, product, campaign or copy type — the tenancy guarantee sits here, at the query layer,
 * not in the form. An id that does not resolve is dropped, never stored.
 */
export async function syncYoutubeCopyLinks(
  db: Db,
  brandId: string,
  youtubeCopyId: string,
  links: YoutubeCopyLinkIds,
): Promise<void> {
  const scope = withBrand(db, brandId);
  const [brandCollections, brandProducts, brandCampaigns, brandCopyTypes] = await Promise.all([
    scope.select(collections),
    scope.select(products),
    scope.select(campaignsOffers),
    scope.select(copyTypes),
  ]);
  const inScope = (rows: readonly { id: string }[], ids: readonly string[]): string[] => {
    const live = new Set(rows.map((row) => row.id));
    return [...new Set(ids)].filter((id) => live.has(id));
  };
  await syncYoutubeCopyCollections(
    db,
    youtubeCopyId,
    inScope(brandCollections, links.collectionIds),
  );
  await syncYoutubeCopyProducts(db, youtubeCopyId, inScope(brandProducts, links.productIds));
  await syncYoutubeCopyCampaigns(
    db,
    youtubeCopyId,
    inScope(brandCampaigns, links.campaignOfferIds),
  );
  await syncYoutubeCopyCopyTypes(db, youtubeCopyId, inScope(brandCopyTypes, links.copyTypeIds));
}

// ── Reads ────────────────────────────────────────────────────────────────────────────────────

/** `youtubeCopyId -> targetId[]` from one junction's rows, whatever the junction's column names. */
function groupByCopy(
  pairs: readonly { copyId: string; targetId: string }[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const pair of pairs) {
    const existing = map.get(pair.copyId);
    if (existing) existing.push(pair.targetId);
    else map.set(pair.copyId, [pair.targetId]);
  }
  return map;
}

/** Every link of every copy, resolved against the brand's live target rows. */
interface LinkedWork {
  collections: Map<string, LinkedCollection[]>;
  products: Map<string, LinkedProduct[]>;
  campaigns: Map<string, LinkedCampaign[]>;
  copyTypes: Map<string, LinkedCopyType[]>;
}

/** The named rows a copy's junction points at, in name order; an id outside the scope resolves to nothing. */
function resolve<Row extends { id: string }, Out extends { name: string }>(
  junction: Map<string, string[]>,
  rows: readonly Row[],
  toLinked: (row: Row) => Out,
): Map<string, Out[]> {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const out = new Map<string, Out[]>();
  for (const [copyId, targetIds] of junction) {
    const linked = targetIds
      .map((id) => byId.get(id))
      .filter((row): row is Row => row !== undefined)
      .map(toLinked)
      // Alphabetical, because the junction read carries no ORDER BY and heap order is not a contract.
      .sort((a, b) => a.name.localeCompare(b.name));
    out.set(copyId, linked);
  }
  return out;
}

/**
 * Joined in TypeScript rather than with SQL, for the reason `listProducts` gives: `withBrand` hands
 * back a sealed query surface with no join, and that seal is the guarantee a scoped read cannot be
 * widened. The target tables are read through the scope, so another brand's rows — and soft-deleted
 * ones — are gone before a single name is attached.
 */
async function linkedWork(db: Db, scope: BrandScope): Promise<LinkedWork> {
  const [
    brandCollections,
    brandProducts,
    brandCampaigns,
    brandCopyTypes,
    collectionRows,
    productRows,
    campaignRows,
    copyTypeRows,
  ] = await Promise.all([
    scope.select(collections),
    scope.select(products),
    scope.select(campaignsOffers),
    scope.select(copyTypes),
    db.select().from(youtubeCopyCollections),
    db.select().from(youtubeCopyProducts),
    db.select().from(youtubeCopyCampaigns),
    db.select().from(youtubeCopyCopyTypes),
  ]);
  return {
    collections: resolve(
      groupByCopy(
        collectionRows.map((r) => ({ copyId: r.youtubeCopyId, targetId: r.collectionId })),
      ),
      brandCollections,
      (row) => ({ id: row.id, name: row.name, url: row.url }),
    ),
    products: resolve(
      groupByCopy(productRows.map((r) => ({ copyId: r.youtubeCopyId, targetId: r.productId }))),
      brandProducts,
      (row) => ({ id: row.id, name: row.name, link: row.link }),
    ),
    campaigns: resolve(
      groupByCopy(
        campaignRows.map((r) => ({ copyId: r.youtubeCopyId, targetId: r.campaignOfferId })),
      ),
      brandCampaigns,
      (row) => ({ id: row.id, name: row.name, code: row.code, offer: row.discountOffer }),
    ),
    copyTypes: resolve(
      groupByCopy(copyTypeRows.map((r) => ({ copyId: r.youtubeCopyId, targetId: r.copyTypeId }))),
      brandCopyTypes,
      (row) => ({ id: row.id, name: row.name }),
    ),
  };
}

function withLinks(row: YoutubeCopy, linked: LinkedWork): YoutubeCopyListRow {
  return {
    ...row,
    linkedCollections: linked.collections.get(row.id) ?? [],
    linkedProducts: linked.products.get(row.id) ?? [],
    linkedCampaigns: linked.campaigns.get(row.id) ?? [],
    linkedCopyTypes: linked.copyTypes.get(row.id) ?? [],
  };
}

/** The brand's live YouTube copy rows, newest edit first, each with its four record links resolved. */
export async function listYoutubeCopy(db: Db, brandId: string): Promise<YoutubeCopyListRow[]> {
  const scope = withBrand(db, brandId);
  const [rows, linked] = await Promise.all([
    scope.select(youtubeCopy).orderBy(desc(youtubeCopy.updatedAt)),
    linkedWork(db, scope),
  ]);
  return rows.map((row) => withLinks(row, linked));
}

/**
 * The stored Copy # of every live row of the brand, for `nextCopyNumber` in `@tas/domain/copy`:
 * the caller computes the next number, this module only reads the ones taken.
 */
export async function listYoutubeCopyNumbers(db: Db, brandId: string): Promise<number[]> {
  const rows = await withBrand(db, brandId).select(youtubeCopy);
  return rows.map((row) => row.copyNumber);
}

/** One live row of the brand with its links, or null: another brand's id never resolves. */
export async function getYoutubeCopyById(
  db: Db,
  brandId: string,
  id: string,
): Promise<YoutubeCopyListRow | null> {
  const scope = withBrand(db, brandId);
  const [row] = await scope.select(youtubeCopy, eq(youtubeCopy.id, id)).limit(1);
  if (row === undefined) return null;
  return withLinks(row, await linkedWork(db, scope));
}

// ── Writes ───────────────────────────────────────────────────────────────────────────────────

/** Creates a row in the scope; `brand_id` is the scope's, whatever `values` says. */
export async function insertYoutubeCopy(
  db: Db,
  brandId: string,
  values: YoutubeCopyInput,
  actorId: string,
): Promise<YoutubeCopy> {
  const [row] = await withBrand(db, brandId)
    .insert(youtubeCopy, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('youtube_copy insert returned no row');
  }
  return row;
}

/**
 * Patches one live row of the brand and returns it, or null when the id belongs to another brand
 * or to a soft-deleted row — the scope makes those the same outcome: zero rows changed.
 */
export async function updateYoutubeCopy(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<YoutubeCopyInput>,
  actorId: string,
): Promise<YoutubeCopy | null> {
  const [row] = await withBrand(db, brandId)
    .update(
      youtubeCopy,
      { ...patch, updatedBy: actorId, updatedAt: new Date() },
      eq(youtubeCopy.id, id),
    )
    .returning();
  return row ?? null;
}
