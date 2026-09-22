import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import { creativeDimensions, type CreativeDimension, type NewCreativeDimension } from './schema';
import { withBrand } from './tenancy';

type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

export type CreativeDimensionInput = Omit<NewCreativeDimension, ManagedColumn>;

export type CreativeDimensionListRow = CreativeDimension;

export async function listCreativeDimensions(
  db: Db,
  brandId: string,
): Promise<CreativeDimensionListRow[]> {
  return withBrand(db, brandId)
    .select(creativeDimensions)
    .orderBy(desc(creativeDimensions.updatedAt));
}

export async function getCreativeDimensionById(
  db: Db,
  brandId: string,
  id: string,
): Promise<CreativeDimensionListRow | null> {
  const [row] = await withBrand(db, brandId)
    .select(creativeDimensions, eq(creativeDimensions.id, id))
    .limit(1);
  return row ?? null;
}

export async function insertCreativeDimension(
  db: Db,
  brandId: string,
  values: CreativeDimensionInput,
  actorId: string,
): Promise<CreativeDimension> {
  const [row] = await withBrand(db, brandId)
    .insert(creativeDimensions, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('creative_dimensions insert returned no row');
  }
  return row;
}

export async function updateCreativeDimension(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<CreativeDimensionInput>,
  actorId: string,
): Promise<CreativeDimension | null> {
  const [row] = await withBrand(db, brandId)
    .update(
      creativeDimensions,
      { ...patch, updatedBy: actorId, updatedAt: new Date() },
      eq(creativeDimensions.id, id),
    )
    .returning();
  return row ?? null;
}
