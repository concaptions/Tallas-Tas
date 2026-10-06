import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import { assets, type Asset, type NewAsset } from './schema';
import { withBrand } from './tenancy';

type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

export type AssetInput = Omit<NewAsset, ManagedColumn>;

export type AssetListRow = Asset;

export async function listAssets(db: Db, brandId: string): Promise<AssetListRow[]> {
  return withBrand(db, brandId).select(assets).orderBy(desc(assets.createdAt));
}

export async function listConceptAssets(
  db: Db,
  brandId: string,
  conceptId: string,
): Promise<AssetListRow[]> {
  return withBrand(db, brandId)
    .select(assets, eq(assets.conceptId, conceptId))
    .orderBy(desc(assets.createdAt));
}

/** A creator's showcase videos (Sprint 7, UGC media), newest first: the same rows, linked by creator. */
export async function listCreatorAssets(
  db: Db,
  brandId: string,
  creatorId: string,
): Promise<AssetListRow[]> {
  return withBrand(db, brandId)
    .select(assets, eq(assets.creatorId, creatorId))
    .orderBy(desc(assets.createdAt));
}

export async function getAssetById(
  db: Db,
  brandId: string,
  id: string,
): Promise<AssetListRow | null> {
  const [row] = await withBrand(db, brandId).select(assets, eq(assets.id, id)).limit(1);
  return row ?? null;
}

export async function insertAsset(
  db: Db,
  brandId: string,
  values: AssetInput,
  actorId: string,
): Promise<Asset> {
  const [row] = await withBrand(db, brandId)
    .insert(assets, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) throw new Error('assets insert returned no row');
  return row;
}

export async function updateAsset(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<AssetInput>,
  actorId: string,
): Promise<Asset | null> {
  const [row] = await withBrand(db, brandId)
    .update(assets, { ...patch, updatedBy: actorId, updatedAt: new Date() }, eq(assets.id, id))
    .returning();
  return row ?? null;
}

/**
 * Soft-delete one asset (CLAUDE.md: "Soft delete only. Never `DELETE FROM` a data table."). Writes
 * `deleted_at = now()` via `withBrand(brandId).softDelete`, so the row stays in Postgres and the
 * audit trail is intact; `listAssets` filters deleted rows out by convention. Returns the deleted
 * row or `null` when the id does not belong to this brand — the caller translates that to 404.
 */
export async function softDeleteAsset(db: Db, brandId: string, id: string): Promise<Asset | null> {
  const [row] = await withBrand(db, brandId).softDelete(assets, eq(assets.id, id)).returning();
  return row ?? null;
}
