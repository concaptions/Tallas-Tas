import { and, count, desc, eq, isNull } from 'drizzle-orm';

import type { Db } from './db';
import { brands, creatorRegistry, creators, type NewRegistryCreator } from './schema';

export interface RegistryCreatorListRow {
  id: string;
  name: string;
  instagramUsername: string | null;
  profilePicUrl: string | null;
  creatorLink: string | null;
  platform: string[];
  ageBracket: string | null;
  gender: string | null;
  ethnicity: string | null;
  shippingLocation: string | null;
  totalBrands: number;
  totalProjects: number;
  avgRating: number | null;
  tags: string[];
  notes: string | null;
  normalizedInstagram: string | null;
}

export async function listRegistryCreators(db: Db): Promise<RegistryCreatorListRow[]> {
  const rows = await db
    .select()
    .from(creatorRegistry)
    .where(isNull(creatorRegistry.deletedAt))
    .orderBy(desc(creatorRegistry.updatedAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    instagramUsername: r.instagramUsername,
    profilePicUrl: r.profilePicUrl,
    creatorLink: r.creatorLink,
    platform: r.platform,
    ageBracket: r.ageBracket,
    gender: r.gender,
    ethnicity: r.ethnicity,
    shippingLocation: r.shippingLocation,
    totalBrands: r.totalBrands,
    totalProjects: r.totalProjects,
    avgRating: r.avgRating,
    tags: r.tags,
    notes: r.notes,
    normalizedInstagram: r.normalizedInstagram,
  }));
}

export async function findRegistryCreatorByNormalizedIg(
  db: Db,
  normalizedIg: string,
): Promise<RegistryCreatorListRow | null> {
  const [row] = await db
    .select()
    .from(creatorRegistry)
    .where(
      and(eq(creatorRegistry.normalizedInstagram, normalizedIg), isNull(creatorRegistry.deletedAt)),
    )
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    instagramUsername: row.instagramUsername,
    profilePicUrl: row.profilePicUrl,
    creatorLink: row.creatorLink,
    platform: row.platform,
    ageBracket: row.ageBracket,
    gender: row.gender,
    ethnicity: row.ethnicity,
    shippingLocation: row.shippingLocation,
    totalBrands: row.totalBrands,
    totalProjects: row.totalProjects,
    avgRating: row.avgRating,
    tags: row.tags,
    notes: row.notes,
    normalizedInstagram: row.normalizedInstagram,
  };
}

type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';
export type RegistryCreatorInput = Omit<NewRegistryCreator, ManagedColumn>;

export async function insertRegistryCreator(
  db: Db,
  data: RegistryCreatorInput,
): Promise<{ id: string }> {
  const rows = await db
    .insert(creatorRegistry)
    .values({ ...data, brandId: null })
    .returning({ id: creatorRegistry.id });
  if (!rows[0]) throw new Error('Insert into creator_registry returned no rows');
  return rows[0];
}

export async function updateRegistryCreatorStats(db: Db, registryCreatorId: string): Promise<void> {
  const [stats] = await db
    .select({ brandCount: count(creators.brandId) })
    .from(creators)
    .where(and(eq(creators.registryCreatorId, registryCreatorId), isNull(creators.deletedAt)));
  await db
    .update(creatorRegistry)
    .set({
      totalBrands: stats?.brandCount ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(creatorRegistry.id, registryCreatorId));
}

export interface RegistryBrandHistoryRow {
  brandName: string;
  brandId: string;
  clientStatus: string;
  continueWorkingWith: boolean | null;
  creatorCost: number | null;
  createdAt: Date;
}

export async function listRegistryCreatorBrandHistory(
  db: Db,
  registryCreatorId: string,
): Promise<RegistryBrandHistoryRow[]> {
  const rows = await db
    .select({
      brandName: brands.name,
      brandId: creators.brandId,
      clientStatus: creators.clientStatus,
      continueWorkingWith: creators.continueWorkingWith,
      creatorCost: creators.creatorCost,
      createdAt: creators.createdAt,
    })
    .from(creators)
    .innerJoin(brands, eq(creators.brandId, brands.id))
    .where(and(eq(creators.registryCreatorId, registryCreatorId), isNull(creators.deletedAt)))
    .orderBy(desc(creators.createdAt));
  return rows;
}

export async function findBrandCreatorByRegistryId(
  db: Db,
  brandId: string,
  registryCreatorId: string,
): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: creators.id })
    .from(creators)
    .where(
      and(
        eq(creators.brandId, brandId),
        eq(creators.registryCreatorId, registryCreatorId),
        isNull(creators.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function addRegistryCreatorToBrand(
  db: Db,
  registryCreatorId: string,
  brandId: string,
): Promise<{ id: string; alreadyExisted: boolean }> {
  const existing = await findBrandCreatorByRegistryId(db, brandId, registryCreatorId);
  if (existing) return { id: existing.id, alreadyExisted: true };

  const [regRow] = await db
    .select()
    .from(creatorRegistry)
    .where(eq(creatorRegistry.id, registryCreatorId))
    .limit(1);
  if (!regRow) throw new Error(`Registry creator ${registryCreatorId} not found`);

  const createdRows = await db
    .insert(creators)
    .values({
      brandId,
      name: regRow.name,
      instagramUsername: regRow.instagramUsername,
      profilePicUrl: regRow.profilePicUrl,
      creatorLink: regRow.creatorLink,
      platform: regRow.platform,
      ageBracket: regRow.ageBracket,
      gender: regRow.gender,
      ethnicity: regRow.ethnicity,
      shippingLocation: regRow.shippingLocation,
      registryCreatorId,
    })
    .returning({ id: creators.id });
  if (!createdRows[0]) throw new Error('Insert into creators returned no rows');

  await updateRegistryCreatorStats(db, registryCreatorId);
  return { id: createdRows[0].id, alreadyExisted: false };
}
