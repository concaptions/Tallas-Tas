import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import {
  copyTypes,
  copywriting,
  copywritingCopyTypes,
  youtubeCopy,
  youtubeCopyCopyTypes,
  type CopyType,
  type NewCopyType,
} from './schema';
import { withBrand, type BrandScope } from './tenancy';

/**
 * The Copy Types page's data access (Airtable "(Internal) Copy Type", `tblQiBPj9ypCmYxev`, gap audit
 * 2026-10-01 §2.13): the lookup list a copy row is tagged with. A copy of `products.ts`, function for
 * function. Every function takes the database as its first argument (no module-level singleton) and
 * reads and writes the copy-type rows through `withBrand(db, brandId)`, so `brand_id = $brandId AND
 * deleted_at IS NULL` is on every statement and an insert cannot choose its own brand. Nothing here
 * contains business logic.
 *
 * The two Airtable record links on this table are the INVERSE sides of links the copy tables own:
 * "Ads Copywriting copy" is `copywriting_copy_types` (Meta Copywriting → Copy Type) and "Copywriting"
 * is `youtube_copy_copy_types` (Youtube Copywriting → Copy Type). This module reads both back, in
 * bulk, so a list of N copy types costs a fixed number of queries, and it offers the Meta side's sync
 * helper because that junction lives in this module's schema file; the YouTube side's sync is
 * `syncYoutubeCopyCopyTypes` in `youtube-copy.ts`.
 */

/** The columns the scope, the clock and the actor own; a caller never sets them. */
type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

/** What the panel form submits for create (`name` required), or patches. */
export type CopyTypeInput = Omit<NewCopyType, ManagedColumn>;

/**
 * One copy row a copy type is linked from, Meta or YouTube: the id, the stored Copy # and the
 * headline. The TITLE ("Copy #N") is not built here — `copyTitle` in `@tas/domain/copy` is the one
 * place that string lives — so the page reads the number and the headline and decides which to show.
 */
export interface LinkedCopy {
  readonly id: string;
  readonly copyNumber: number;
  readonly headline: string | null;
}

/**
 * A copy type as the list and the panel render it: the row plus the brand's LIVE Meta and YouTube
 * copies linked to it, each list in Copy # order. The counts the grid shows are the lists' lengths,
 * computed by the page. `demoCopyTypes` satisfies `CopyTypeListRow[]`, so the page reads demo
 * fixtures and database rows through one type.
 */
export type CopyTypeListRow = CopyType & {
  readonly metaCopies: readonly LinkedCopy[];
  readonly youtubeCopies: readonly LinkedCopy[];
};

// ── Junction bulk loaders (list view: every link of every copy type in one read each) ───────────

/** `copyTypeId -> copyIds`, every row of `copywriting_copy_types`. */
export async function loadAllCopywritingCopyTypes(db: Db): Promise<Map<string, string[]>> {
  const rows = await db.select().from(copywritingCopyTypes);
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const existing = map.get(row.copyTypeId);
    if (existing) existing.push(row.copyId);
    else map.set(row.copyTypeId, [row.copyId]);
  }
  return map;
}

/** `copyTypeId -> youtubeCopyIds`, every row of `youtube_copy_copy_types`. */
export async function loadAllYoutubeCopyCopyTypes(db: Db): Promise<Map<string, string[]>> {
  const rows = await db.select().from(youtubeCopyCopyTypes);
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const existing = map.get(row.copyTypeId);
    if (existing) existing.push(row.youtubeCopyId);
    else map.set(row.copyTypeId, [row.youtubeCopyId]);
  }
  return map;
}

// ── Junction sync helpers for the Meta side (delete-then-insert, the `junction-queries.ts` contract) ─

/** The copy types one Meta copy row is tagged with. */
export async function listCopywritingCopyTypeIds(db: Db, copyId: string): Promise<string[]> {
  const rows = await db
    .select({ copyTypeId: copywritingCopyTypes.copyTypeId })
    .from(copywritingCopyTypes)
    .where(eq(copywritingCopyTypes.copyId, copyId));
  return rows.map((row) => row.copyTypeId);
}

/** Replaces one Meta copy row's copy-type links with exactly `copyTypeIds`. */
export async function syncCopywritingCopyTypes(
  db: Db,
  copyId: string,
  copyTypeIds: readonly string[],
): Promise<void> {
  await db.delete(copywritingCopyTypes).where(eq(copywritingCopyTypes.copyId, copyId));
  if (copyTypeIds.length > 0) {
    await db
      .insert(copywritingCopyTypes)
      .values(copyTypeIds.map((copyTypeId) => ({ copyId, copyTypeId })));
  }
}

/**
 * The write path a Server Action uses: every submitted id is first checked against the brand's LIVE
 * copy types, so a junction can never tag a copy with another brand's type — the tenancy guarantee
 * sits here, at the query layer, not in the form. An id that does not resolve is dropped, never
 * stored, and a repeated id is stored once.
 */
export async function syncCopywritingCopyTypesInBrand(
  db: Db,
  brandId: string,
  copyId: string,
  copyTypeIds: readonly string[],
): Promise<void> {
  const live = new Set((await withBrand(db, brandId).select(copyTypes)).map((row) => row.id));
  await syncCopywritingCopyTypes(
    db,
    copyId,
    [...new Set(copyTypeIds)].filter((id) => live.has(id)),
  );
}

// ── Reads ────────────────────────────────────────────────────────────────────────────────────────

interface LinkedWork {
  meta: Map<string, LinkedCopy[]>;
  youtube: Map<string, LinkedCopy[]>;
}

/**
 * Pairs each copy type's junction ids with the brand's live copy rows, dropping a link whose copy is
 * soft-deleted or belongs to another brand (the junction has no brand of its own; the scoped read of
 * the copy table is what keeps a foreign id from surfacing). Ordered by Copy #, then id, because the
 * junction read carries no ORDER BY and heap order is not a contract.
 */
function resolveLinks(
  junction: Map<string, string[]>,
  live: Map<string, LinkedCopy>,
): Map<string, LinkedCopy[]> {
  const resolved = new Map<string, LinkedCopy[]>();
  for (const [copyTypeId, copyIds] of junction) {
    const linked: LinkedCopy[] = [];
    for (const id of copyIds) {
      const copy = live.get(id);
      if (copy !== undefined) linked.push(copy);
    }
    linked.sort((a, b) => a.copyNumber - b.copyNumber || a.id.localeCompare(b.id));
    resolved.set(copyTypeId, linked);
  }
  return resolved;
}

/**
 * Joined in TypeScript rather than with SQL, for the reason `listProducts` gives: `withBrand` hands
 * back a sealed query surface with no join, and that seal is the guarantee a scoped read cannot be
 * widened. Both copy tables are read through the scope, so another brand's rows — and soft-deleted
 * ones — are gone before a single headline is attached.
 */
async function linkedWork(db: Db, scope: BrandScope): Promise<LinkedWork> {
  const [brandMetaCopies, brandYoutubeCopies, metaMap, youtubeMap] = await Promise.all([
    scope.select(copywriting),
    scope.select(youtubeCopy),
    loadAllCopywritingCopyTypes(db),
    loadAllYoutubeCopyCopyTypes(db),
  ]);
  const asLinked = (row: {
    id: string;
    copyNumber: number;
    headline: string | null;
  }): LinkedCopy => ({
    id: row.id,
    copyNumber: row.copyNumber,
    headline: row.headline,
  });
  return {
    meta: resolveLinks(metaMap, new Map(brandMetaCopies.map((row) => [row.id, asLinked(row)]))),
    youtube: resolveLinks(
      youtubeMap,
      new Map(brandYoutubeCopies.map((row) => [row.id, asLinked(row)])),
    ),
  };
}

function withLinks(row: CopyType, linked: LinkedWork): CopyTypeListRow {
  return {
    ...row,
    metaCopies: linked.meta.get(row.id) ?? [],
    youtubeCopies: linked.youtube.get(row.id) ?? [],
  };
}

/** The brand's live copy types, newest edit first, each with its linked Meta and YouTube copies. */
export async function listCopyTypes(db: Db, brandId: string): Promise<CopyTypeListRow[]> {
  const scope = withBrand(db, brandId);
  const [rows, linked] = await Promise.all([
    scope.select(copyTypes).orderBy(desc(copyTypes.updatedAt)),
    linkedWork(db, scope),
  ]);
  return rows.map((row) => withLinks(row, linked));
}

/** One live copy type of the brand, with its links, or null: another brand's id never resolves. */
export async function getCopyTypeById(
  db: Db,
  brandId: string,
  id: string,
): Promise<CopyTypeListRow | null> {
  const scope = withBrand(db, brandId);
  const [row] = await scope.select(copyTypes, eq(copyTypes.id, id)).limit(1);
  if (row === undefined) return null;
  return withLinks(row, await linkedWork(db, scope));
}

// ── Writes ───────────────────────────────────────────────────────────────────────────────────────

/** Creates a copy type in the scope; `brand_id` is the scope's, whatever `values` says. */
export async function insertCopyType(
  db: Db,
  brandId: string,
  values: CopyTypeInput,
  actorId: string,
): Promise<CopyType> {
  const [row] = await withBrand(db, brandId)
    .insert(copyTypes, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('copy_types insert returned no row');
  }
  return row;
}

/**
 * Patches one live copy type of the brand and returns it, or null when the id belongs to another
 * brand or to a soft-deleted row — the scope makes those the same outcome: zero rows changed.
 */
export async function updateCopyType(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<CopyTypeInput>,
  actorId: string,
): Promise<CopyType | null> {
  const [row] = await withBrand(db, brandId)
    .update(
      copyTypes,
      { ...patch, updatedBy: actorId, updatedAt: new Date() },
      eq(copyTypes.id, id),
    )
    .returning();
  return row ?? null;
}
