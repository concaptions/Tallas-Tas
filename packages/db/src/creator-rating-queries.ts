import { and, asc, eq, isNull } from 'drizzle-orm';

import type { Db } from './db';
import { brands, creatorRegistry, creators, type Creator } from './schema';
import { withBrand } from './tenancy';

/**
 * The per-brand performance rating (Oct 8 Talal ask). The write is brand-scoped through
 * `withBrand`; the registry roll-up `creator_registry.avg_rating` is maintained by the
 * `creators_registry_avg_rating` trigger (migration 0056), so nothing here writes it.
 */
export async function updateCreatorPerformanceRating(
  db: Db,
  brandId: string,
  creatorId: string,
  rating: number,
  note: string | null,
  actorId: string,
  now: Date = new Date(),
): Promise<Creator | null> {
  const [row] = await withBrand(db, brandId)
    .update(
      creators,
      {
        performanceRating: rating,
        performanceNote: note,
        performanceRatedAt: now,
        performanceRatedBy: actorId,
        updatedBy: actorId,
        updatedAt: now,
      },
      eq(creators.id, creatorId),
    )
    .returning();
  return row ?? null;
}

export interface CreatorPerformanceHistoryRow {
  brandId: string;
  brandName: string;
  creatorId: string;
  rating: number | null;
  note: string | null;
  ratedAt: Date | null;
  ratedBy: string | null;
}

/** Every live brand row linked to a registry entry, rated or not, so the panel shows each brand once. */
export async function loadCreatorPerformanceHistory(
  db: Db,
  registryCreatorId: string,
): Promise<CreatorPerformanceHistoryRow[]> {
  return db
    .select({
      brandId: creators.brandId,
      brandName: brands.name,
      creatorId: creators.id,
      rating: creators.performanceRating,
      note: creators.performanceNote,
      ratedAt: creators.performanceRatedAt,
      ratedBy: creators.performanceRatedBy,
    })
    .from(creators)
    .innerJoin(brands, eq(creators.brandId, brands.id))
    .where(and(eq(creators.registryCreatorId, registryCreatorId), isNull(creators.deletedAt)))
    .orderBy(asc(brands.name));
}

export async function getRegistryAvgRating(
  db: Db,
  registryCreatorId: string,
): Promise<number | null> {
  const [row] = await db
    .select({ avgRating: creatorRegistry.avgRating })
    .from(creatorRegistry)
    .where(eq(creatorRegistry.id, registryCreatorId))
    .limit(1);
  return row?.avgRating ?? null;
}
