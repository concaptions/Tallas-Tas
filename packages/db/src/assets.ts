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
