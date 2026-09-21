import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import { competitorAds, type CompetitorAd, type NewCompetitorAd } from './schema';
import { withBrand } from './tenancy';

type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

export type CompetitorAdInput = Omit<NewCompetitorAd, ManagedColumn>;

export type CompetitorAdListRow = CompetitorAd;

export async function listCompetitorAds(db: Db, brandId: string): Promise<CompetitorAdListRow[]> {
  return withBrand(db, brandId).select(competitorAds).orderBy(desc(competitorAds.createdAt));
}

export async function insertCompetitorAd(
  db: Db,
  brandId: string,
  values: CompetitorAdInput,
  actorId: string,
): Promise<CompetitorAd> {
  const [row] = await withBrand(db, brandId)
    .insert(competitorAds, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) throw new Error('competitor_ads insert returned no row');
  return row;
}

export async function getCompetitorAdById(
  db: Db,
  brandId: string,
  id: string,
): Promise<CompetitorAdListRow | null> {
  const [row] = await withBrand(db, brandId)
    .select(competitorAds, eq(competitorAds.id, id))
    .limit(1);
  return row ?? null;
}

export async function updateCompetitorAd(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<CompetitorAdInput>,
  actorId: string,
): Promise<CompetitorAd | null> {
  const [row] = await withBrand(db, brandId)
    .update(
      competitorAds,
      { ...patch, updatedBy: actorId, updatedAt: new Date() },
      eq(competitorAds.id, id),
    )
    .returning();
  return row ?? null;
}
