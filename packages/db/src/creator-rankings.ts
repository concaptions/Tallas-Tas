import { asc, desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import { creatorRankings, type CreatorRanking, type NewCreatorRanking } from './schema';
import { withBrand } from './tenancy';

type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

export type CreatorRankingInput = Omit<NewCreatorRanking, ManagedColumn>;

export type CreatorRankingListRow = CreatorRanking;

export async function listCreatorRankings(
  db: Db,
  brandId: string,
): Promise<CreatorRankingListRow[]> {
  return withBrand(db, brandId).select(creatorRankings).orderBy(asc(creatorRankings.rank));
}

export async function insertCreatorRanking(
  db: Db,
  brandId: string,
  values: CreatorRankingInput,
  actorId: string,
): Promise<CreatorRanking> {
  const [row] = await withBrand(db, brandId)
    .insert(creatorRankings, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) throw new Error('creator_rankings insert returned no row');
  return row;
}

export async function listCreatorRankingsByCreator(
  db: Db,
  brandId: string,
  creatorId: string,
): Promise<CreatorRankingListRow[]> {
  return withBrand(db, brandId)
    .select(creatorRankings, eq(creatorRankings.creatorId, creatorId))
    .orderBy(desc(creatorRankings.createdAt));
}

export async function getCreatorRankingById(
  db: Db,
  brandId: string,
  id: string,
): Promise<CreatorRankingListRow | null> {
  const [row] = await withBrand(db, brandId)
    .select(creatorRankings, eq(creatorRankings.id, id))
    .limit(1);
  return row ?? null;
}

export async function updateCreatorRanking(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<CreatorRankingInput>,
  actorId: string,
): Promise<CreatorRanking | null> {
  const [row] = await withBrand(db, brandId)
    .update(
      creatorRankings,
      { ...patch, updatedBy: actorId, updatedAt: new Date() },
      eq(creatorRankings.id, id),
    )
    .returning();
  return row ?? null;
}
