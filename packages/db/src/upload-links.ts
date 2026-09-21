import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import { uploadLinks, type NewUploadLink, type UploadLink } from './schema';
import { withBrand } from './tenancy';

type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

export type UploadLinkInput = Omit<NewUploadLink, ManagedColumn>;

export type UploadLinkListRow = UploadLink;

export async function listUploadLinks(db: Db, brandId: string): Promise<UploadLinkListRow[]> {
  return withBrand(db, brandId).select(uploadLinks).orderBy(desc(uploadLinks.createdAt));
}

export async function getUploadLinkByToken(
  db: Db,
  token: string,
): Promise<UploadLinkListRow | null> {
  const [row] = await db.select().from(uploadLinks).where(eq(uploadLinks.token, token)).limit(1);
  return row ?? null;
}

export async function insertUploadLink(
  db: Db,
  brandId: string,
  values: UploadLinkInput,
  actorId: string,
): Promise<UploadLink> {
  const [row] = await withBrand(db, brandId)
    .insert(uploadLinks, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) throw new Error('upload_links insert returned no row');
  return row;
}
