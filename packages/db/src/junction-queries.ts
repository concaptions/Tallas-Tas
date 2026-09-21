import { and, eq } from 'drizzle-orm';

import type { Db } from './db';
import { creatorConcepts, creatorProducts } from './schema';

export async function listCreatorConceptIds(db: Db, creatorId: string): Promise<string[]> {
  const rows = await db
    .select({ conceptId: creatorConcepts.conceptId })
    .from(creatorConcepts)
    .where(eq(creatorConcepts.creatorId, creatorId));
  return rows.map((r) => r.conceptId);
}

export async function listCreatorProductIds(db: Db, creatorId: string): Promise<string[]> {
  const rows = await db
    .select({ productId: creatorProducts.productId })
    .from(creatorProducts)
    .where(eq(creatorProducts.creatorId, creatorId));
  return rows.map((r) => r.productId);
}

export async function syncCreatorConcepts(
  db: Db,
  creatorId: string,
  conceptIds: string[],
): Promise<void> {
  await db.delete(creatorConcepts).where(eq(creatorConcepts.creatorId, creatorId));
  if (conceptIds.length > 0) {
    await db
      .insert(creatorConcepts)
      .values(conceptIds.map((conceptId) => ({ creatorId, conceptId })));
  }
}

export async function syncCreatorProducts(
  db: Db,
  creatorId: string,
  productIds: string[],
): Promise<void> {
  await db.delete(creatorProducts).where(eq(creatorProducts.creatorId, creatorId));
  if (productIds.length > 0) {
    await db
      .insert(creatorProducts)
      .values(productIds.map((productId) => ({ creatorId, productId })));
  }
}

export async function removeCreatorConcept(
  db: Db,
  creatorId: string,
  conceptId: string,
): Promise<void> {
  await db
    .delete(creatorConcepts)
    .where(and(eq(creatorConcepts.creatorId, creatorId), eq(creatorConcepts.conceptId, conceptId)));
}

export async function removeCreatorProduct(
  db: Db,
  creatorId: string,
  productId: string,
): Promise<void> {
  await db
    .delete(creatorProducts)
    .where(and(eq(creatorProducts.creatorId, creatorId), eq(creatorProducts.productId, productId)));
}
