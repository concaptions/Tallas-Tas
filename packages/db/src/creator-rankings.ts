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
