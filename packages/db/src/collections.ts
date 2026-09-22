import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import {
  angles,
  campaignsOffers,
  collections,
  products,
  type Collection,
  type NewCollection,
} from './schema';
import { withBrand } from './tenancy';

type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

export type CollectionInput = Omit<NewCollection, ManagedColumn>;

export interface CollectionListRow extends Collection {
  readonly campaignName: string | null;
  readonly angleName: string | null;
  readonly productName: string | null;
}

export async function listCollections(db: Db, brandId: string): Promise<CollectionListRow[]> {
  const rows = await withBrand(db, brandId)
    .select(collections)
    .orderBy(desc(collections.updatedAt));

  const campaignIds = [
    ...new Set(rows.map((r) => r.campaignId).filter((id): id is string => id !== null)),
  ];
  const angleIds = [
    ...new Set(rows.map((r) => r.angleId).filter((id): id is string => id !== null)),
  ];
  const productIds = [
    ...new Set(rows.map((r) => r.productId).filter((id): id is string => id !== null)),
  ];

  const campaignMap = new Map<string, string>();
  for (const id of campaignIds) {
    const [row] = await db
      .select({ id: campaignsOffers.id, name: campaignsOffers.name })
      .from(campaignsOffers)
      .where(eq(campaignsOffers.id, id))
      .limit(1);
    if (row) campaignMap.set(row.id, row.name);
  }

  const angleMap = new Map<string, string>();
  for (const id of angleIds) {
    const [row] = await db
      .select({ id: angles.id, name: angles.name })
      .from(angles)
      .where(eq(angles.id, id))
      .limit(1);
    if (row) angleMap.set(row.id, row.name);
  }

  const productMap = new Map<string, string>();
  for (const id of productIds) {
    const [row] = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    if (row) productMap.set(row.id, row.name);
  }

  return rows.map((r) => ({
    ...r,
    campaignName: r.campaignId !== null ? (campaignMap.get(r.campaignId) ?? null) : null,
    angleName: r.angleId !== null ? (angleMap.get(r.angleId) ?? null) : null,
    productName: r.productId !== null ? (productMap.get(r.productId) ?? null) : null,
  }));
}

export async function getCollectionById(
  db: Db,
  brandId: string,
  id: string,
): Promise<CollectionListRow | null> {
  const [row] = await withBrand(db, brandId).select(collections, eq(collections.id, id)).limit(1);
  if (row === undefined) return null;

  let campaignName: string | null = null;
  if (row.campaignId !== null) {
    const [c] = await db
      .select({ name: campaignsOffers.name })
      .from(campaignsOffers)
      .where(eq(campaignsOffers.id, row.campaignId))
      .limit(1);
    campaignName = c?.name ?? null;
  }

  let angleName: string | null = null;
  if (row.angleId !== null) {
    const [a] = await db
      .select({ name: angles.name })
      .from(angles)
      .where(eq(angles.id, row.angleId))
      .limit(1);
    angleName = a?.name ?? null;
  }

  let productName: string | null = null;
  if (row.productId !== null) {
    const [p] = await db
      .select({ name: products.name })
      .from(products)
      .where(eq(products.id, row.productId))
      .limit(1);
    productName = p?.name ?? null;
  }

  return { ...row, campaignName, angleName, productName };
}

export async function insertCollection(
  db: Db,
  brandId: string,
  values: CollectionInput,
  actorId: string,
): Promise<Collection> {
  const [row] = await withBrand(db, brandId)
    .insert(collections, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('collections insert returned no row');
  }
  return row;
}

export async function updateCollection(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<CollectionInput>,
  actorId: string,
): Promise<Collection | null> {
  const [row] = await withBrand(db, brandId)
    .update(
      collections,
      { ...patch, updatedBy: actorId, updatedAt: new Date() },
      eq(collections.id, id),
    )
    .returning();
  return row ?? null;
}
