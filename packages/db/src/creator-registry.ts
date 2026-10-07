import { and, desc, eq, ilike, isNull, or } from 'drizzle-orm';

import type { Db } from './db';
import { creatorRegistry, creators, type NewRegistryCreator, type RegistryCreator } from './schema';
import { withBrand } from './tenancy';

/**
 * The Creator Registry's data access — the cross-brand pool of every creator TAS has ever
 * worked with (§5.8 + Talal sync). Like Themes, this is a GLOBAL table: no `brand_id`, no
 * `withBrand` scoping. Every read carries `deleted_at IS NULL` for the soft-delete filter.
 *
 * The per-brand `creators` table links here via `registry_creator_id`, so "Add to Brand" is an
 * insert into `creators` with the registry row's id and demographics pre-filled.
 */

type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

export type RegistryCreatorInput = Omit<NewRegistryCreator, ManagedColumn>;

export type RegistryCreatorListRow = RegistryCreator;

export async function listRegistryCreators(db: Db): Promise<RegistryCreatorListRow[]> {
  return db
    .select()
    .from(creatorRegistry)
    .where(isNull(creatorRegistry.deletedAt))
    .orderBy(desc(creatorRegistry.updatedAt));
}

export async function searchRegistryCreators(
  db: Db,
  query: string,
): Promise<RegistryCreatorListRow[]> {
  const pattern = `%${query}%`;
  return db
    .select()
    .from(creatorRegistry)
    .where(
      and(
        isNull(creatorRegistry.deletedAt),
        or(ilike(creatorRegistry.name, pattern), ilike(creatorRegistry.instagramUsername, pattern)),
      ),
    )
    .orderBy(desc(creatorRegistry.updatedAt));
}

export async function getRegistryCreatorById(
  db: Db,
  id: string,
): Promise<RegistryCreatorListRow | null> {
  const [row] = await db
    .select()
    .from(creatorRegistry)
    .where(and(eq(creatorRegistry.id, id), isNull(creatorRegistry.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function insertRegistryCreator(
  db: Db,
  values: RegistryCreatorInput,
  actorId: string,
): Promise<RegistryCreator> {
  const [row] = await db
    .insert(creatorRegistry)
    .values({ ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('creator_registry insert returned no row');
  }
  return row;
}

export async function updateRegistryCreator(
  db: Db,
  id: string,
  patch: Partial<RegistryCreatorInput>,
  actorId: string,
): Promise<RegistryCreator | null> {
  const [row] = await db
    .update(creatorRegistry)
    .set({ ...patch, updatedBy: actorId, updatedAt: new Date() })
    .where(and(eq(creatorRegistry.id, id), isNull(creatorRegistry.deletedAt)))
    .returning();
  return row ?? null;
}

/**
 * "Add to Brand": creates a per-brand creator row linked to a registry entry, pre-filling
 * the demographics from the registry row. Returns the new brand-scoped creator, or null if
 * the registry row does not exist.
 */
export async function addRegistryCreatorToBrand(
  db: Db,
  brandId: string,
  registryCreatorId: string,
  actorId: string,
): Promise<{ id: string } | null> {
  const registry = await getRegistryCreatorById(db, registryCreatorId);
  if (registry === null) return null;

  const [row] = await withBrand(db, brandId)
    .insert(creators, {
      registryCreatorId: registry.id,
      name: registry.name,
      instagramUsername: registry.instagramUsername,
      profilePicUrl: registry.profilePicUrl,
      creatorLink: registry.creatorLink,
      platform: registry.platform,
      ageBracket: registry.ageBracket,
      gender: registry.gender,
      ethnicity: registry.ethnicity,
      shippingLocation: registry.shippingLocation,
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning();
  if (row === undefined) {
    throw new Error('creators insert returned no row');
  }
  return { id: row.id };
}

/**
 * Count how many brands have a live creator row linked to a given registry entry.
 */
export async function countBrandsForRegistryCreator(
  db: Db,
  registryCreatorId: string,
): Promise<number> {
  const rows = await db
    .selectDistinct({ brandId: creators.brandId })
    .from(creators)
    .where(and(eq(creators.registryCreatorId, registryCreatorId), isNull(creators.deletedAt)));
  return rows.length;
}
