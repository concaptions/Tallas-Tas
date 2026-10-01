import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import {
  briefAssetFolders,
  clientAssetFolders,
  creativeBriefs,
  type ClientAssetFolder,
  type NewClientAssetFolder,
} from './schema';
import { withBrand, type BrandScope } from './tenancy';

/**
 * The Client Assets page's data access (Airtable "Client Assets Organisation", `tbldFmPU6AWg62Fll`,
 * audit §2.9): the FOLDER-level organiser — a named pointer at an external location (a Drive folder,
 * a Dropbox share) with a line of description — as opposed to `assets`, which stores individual
 * uploaded files. A copy of `products.ts`, function for function. Every function takes the database
 * as its first argument (no module-level singleton) and reads and writes the folder rows through
 * `withBrand(db, brandId)`, so `brand_id = $brandId AND deleted_at IS NULL` is on every statement and
 * an insert cannot choose its own brand. Nothing here contains business logic.
 *
 * The one Airtable record link, "(Internal) Creative Design", is the `brief_asset_folders` junction
 * (the inverse of the briefs' "Assets" field). It is synced delete-then-insert like every junction in
 * `junction-queries.ts`, and read back in bulk so a list of N folders costs a fixed number of queries.
 */

/** The columns the scope, the clock and the actor own; a caller never sets them. */
type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

/** What the panel form submits for create (`name` required), or patches. */
export type ClientAssetFolderInput = Omit<NewClientAssetFolder, ManagedColumn>;

/**
 * A folder as the list and the panel render it: the row plus its linked briefs, ids and names side
 * by side (`briefIds[i]` is `briefNames[i]`), restricted to the brand's LIVE briefs and ordered by
 * name. The count the grid shows is `briefIds.length`, computed by the page.
 * `demoClientAssetFolders` satisfies `ClientAssetFolderListRow[]`, so the page reads demo fixtures
 * and database rows through one type.
 */
export type ClientAssetFolderListRow = ClientAssetFolder & {
  briefIds: string[];
  briefNames: string[];
};

// ── Junction bulk loaders (every link of every folder in one read each) ─────────────────────────

/** `folderId -> briefIds`, every row of `brief_asset_folders`: the folder side of the link. */
export async function loadAllFolderBriefs(db: Db): Promise<Map<string, string[]>> {
  const rows = await db.select().from(briefAssetFolders);
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const existing = map.get(row.folderId);
    if (existing) existing.push(row.briefId);
    else map.set(row.folderId, [row.briefId]);
  }
  return map;
}

/** `briefId -> folderIds`, the same rows keyed the other way: the briefs' "Assets" field. */
export async function loadAllBriefFolders(db: Db): Promise<Map<string, string[]>> {
  const rows = await db.select().from(briefAssetFolders);
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const existing = map.get(row.briefId);
    if (existing) existing.push(row.folderId);
    else map.set(row.briefId, [row.folderId]);
  }
  return map;
}

// ── Junction sync helper (delete-then-insert, the `junction-queries.ts` contract) ────────────────

/** Replaces the folder's brief ("(Internal) Creative Design") links with exactly `briefIds`. */
export async function syncFolderBriefs(
  db: Db,
  folderId: string,
  briefIds: string[],
): Promise<void> {
  await db.delete(briefAssetFolders).where(eq(briefAssetFolders.folderId, folderId));
  if (briefIds.length > 0) {
    await db.insert(briefAssetFolders).values(briefIds.map((briefId) => ({ folderId, briefId })));
  }
}

// ── Reads ────────────────────────────────────────────────────────────────────────────────────────

interface Links {
  ids: string[];
  names: string[];
}

/**
 * Pairs each folder's junction ids with the names of the brand's live briefs, dropping a link whose
 * target is soft-deleted or belongs to another brand (the junction has no brand of its own; the
 * scoped read of `creative_briefs` is what keeps a foreign id from surfacing). Ordered by name,
 * because the scoped read carries no ORDER BY and heap order is not a contract.
 */
async function linkedBriefs(db: Db, scope: BrandScope): Promise<Map<string, Links>> {
  const [brandBriefs, junction] = await Promise.all([
    scope.select(creativeBriefs),
    loadAllFolderBriefs(db),
  ]);
  const live = new Map(brandBriefs.map((row) => [row.id, row.name]));
  const resolved = new Map<string, Links>();
  for (const [folderId, briefIds] of junction) {
    const pairs: { id: string; name: string }[] = [];
    for (const id of briefIds) {
      const name = live.get(id);
      if (name !== undefined) pairs.push({ id, name });
    }
    pairs.sort((a, b) => a.name.localeCompare(b.name));
    resolved.set(folderId, {
      ids: pairs.map((pair) => pair.id),
      names: pairs.map((pair) => pair.name),
    });
  }
  return resolved;
}

function withLinks(row: ClientAssetFolder, linked: Map<string, Links>): ClientAssetFolderListRow {
  // A fresh empty link set per row, never a shared array two rows could both push into.
  const links = linked.get(row.id) ?? { ids: [], names: [] };
  return { ...row, briefIds: links.ids, briefNames: links.names };
}

/** The brand's live folders, newest edit first, each with its linked briefs. */
export async function listClientAssetFolders(
  db: Db,
  brandId: string,
): Promise<ClientAssetFolderListRow[]> {
  const scope = withBrand(db, brandId);
  const [rows, linked] = await Promise.all([
    scope.select(clientAssetFolders).orderBy(desc(clientAssetFolders.updatedAt)),
    linkedBriefs(db, scope),
  ]);
  return rows.map((row) => withLinks(row, linked));
}

/** One live folder of the brand, with its links, or null: another brand's id never resolves. */
export async function getClientAssetFolderById(
  db: Db,
  brandId: string,
  id: string,
): Promise<ClientAssetFolderListRow | null> {
  const scope = withBrand(db, brandId);
  const [row] = await scope.select(clientAssetFolders, eq(clientAssetFolders.id, id)).limit(1);
  if (row === undefined) return null;
  return withLinks(row, await linkedBriefs(db, scope));
}

// ── Writes ───────────────────────────────────────────────────────────────────────────────────────

/** Creates a folder in the scope; `brand_id` is the scope's, whatever `values` says. */
export async function insertClientAssetFolder(
  db: Db,
  brandId: string,
  values: ClientAssetFolderInput,
  actorId: string,
): Promise<ClientAssetFolder> {
  const [row] = await withBrand(db, brandId)
    .insert(clientAssetFolders, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('client_asset_folders insert returned no row');
  }
  return row;
}

/**
 * Patches one live folder of the brand and returns it, or null when the id belongs to another
 * brand or to a soft-deleted row — the scope makes those the same outcome: zero rows changed.
 */
export async function updateClientAssetFolder(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<ClientAssetFolderInput>,
  actorId: string,
): Promise<ClientAssetFolder | null> {
  const [row] = await withBrand(db, brandId)
    .update(
      clientAssetFolders,
      { ...patch, updatedBy: actorId, updatedAt: new Date() },
      eq(clientAssetFolders.id, id),
    )
    .returning();
  return row ?? null;
}
