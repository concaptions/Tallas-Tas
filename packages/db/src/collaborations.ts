import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import {
  collaborationInstances,
  type CollaborationInstance,
  type NewCollaborationInstance,
} from './schema';
import { withBrand } from './tenancy';

type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

export type CollaborationInput = Omit<NewCollaborationInstance, ManagedColumn>;
export type CollaborationListRow = CollaborationInstance;

export async function listCollaborations(
  db: Db,
  brandId: string,
  creatorId: string,
): Promise<CollaborationListRow[]> {
  return withBrand(db, brandId)
    .select(collaborationInstances, eq(collaborationInstances.creatorId, creatorId))
    .orderBy(desc(collaborationInstances.updatedAt));
}

export async function listAllCollaborations(
  db: Db,
  brandId: string,
): Promise<CollaborationListRow[]> {
  return withBrand(db, brandId)
    .select(collaborationInstances)
    .orderBy(desc(collaborationInstances.updatedAt));
}

export async function getCollaborationById(
  db: Db,
  brandId: string,
  id: string,
): Promise<CollaborationListRow | null> {
  const [row] = await withBrand(db, brandId)
    .select(collaborationInstances, eq(collaborationInstances.id, id))
    .limit(1);
  return row ?? null;
}

export async function insertCollaboration(
  db: Db,
  brandId: string,
  values: CollaborationInput,
  actorId: string,
): Promise<CollaborationInstance> {
  const [row] = await withBrand(db, brandId)
    .insert(collaborationInstances, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('collaboration_instances insert returned no row');
  }
  return row;
}

export async function updateCollaboration(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<CollaborationInput>,
  actorId: string,
): Promise<CollaborationInstance | null> {
  const [row] = await withBrand(db, brandId)
    .update(
      collaborationInstances,
      { ...patch, updatedBy: actorId, updatedAt: new Date() },
      eq(collaborationInstances.id, id),
    )
    .returning();
  return row ?? null;
}
