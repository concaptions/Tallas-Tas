import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import { campaignsOffers, type CampaignOffer, type NewCampaignOffer } from './schema';
import { withBrand } from './tenancy';

type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

export type CampaignInput = Omit<NewCampaignOffer, ManagedColumn>;

export async function listCampaigns(db: Db, brandId: string): Promise<CampaignOffer[]> {
  return withBrand(db, brandId).select(campaignsOffers).orderBy(desc(campaignsOffers.updatedAt));
}

export async function getCampaignById(
  db: Db,
  brandId: string,
  id: string,
): Promise<CampaignOffer | null> {
  const [row] = await withBrand(db, brandId)
    .select(campaignsOffers, eq(campaignsOffers.id, id))
    .limit(1);
  return row ?? null;
}

export async function insertCampaign(
  db: Db,
  brandId: string,
  values: CampaignInput,
  actorId: string,
): Promise<CampaignOffer> {
  const [row] = await withBrand(db, brandId)
    .insert(campaignsOffers, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('campaigns_offers insert returned no row');
  }
  return row;
}

export async function updateCampaign(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<CampaignInput>,
  actorId: string,
): Promise<CampaignOffer | null> {
  const [row] = await withBrand(db, brandId)
    .update(
      campaignsOffers,
      { ...patch, updatedBy: actorId, updatedAt: new Date() },
      eq(campaignsOffers.id, id),
    )
    .returning();
  return row ?? null;
}
