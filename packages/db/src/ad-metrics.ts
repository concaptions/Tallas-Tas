import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import { adMetrics, type AdMetric, type NewAdMetric } from './schema';
import { withBrand } from './tenancy';

type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

export type AdMetricInput = Omit<NewAdMetric, ManagedColumn>;

export type AdMetricListRow = AdMetric;

export async function listAdMetrics(db: Db, brandId: string): Promise<AdMetricListRow[]> {
  return withBrand(db, brandId).select(adMetrics).orderBy(desc(adMetrics.createdAt));
}

export async function listConceptMetrics(
  db: Db,
  brandId: string,
  conceptId: string,
): Promise<AdMetricListRow[]> {
  return withBrand(db, brandId)
    .select(adMetrics, eq(adMetrics.conceptId, conceptId))
    .orderBy(desc(adMetrics.createdAt));
}

export async function insertAdMetric(
  db: Db,
  brandId: string,
  values: AdMetricInput,
  actorId: string,
): Promise<AdMetric> {
  const [row] = await withBrand(db, brandId)
    .insert(adMetrics, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) throw new Error('ad_metrics insert returned no row');
  return row;
}
