import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import { aiCharacters, type AiCharacter, type NewAiCharacter } from './schema';
import { withBrand } from './tenancy';

type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

export type AiCharacterInput = Omit<NewAiCharacter, ManagedColumn>;

export type AiCharacterListRow = AiCharacter;

export async function listAiCharacters(db: Db, brandId: string): Promise<AiCharacterListRow[]> {
  return withBrand(db, brandId).select(aiCharacters).orderBy(desc(aiCharacters.updatedAt));
}

export async function getAiCharacterById(
  db: Db,
  brandId: string,
  id: string,
): Promise<AiCharacterListRow | null> {
  const [row] = await withBrand(db, brandId).select(aiCharacters, eq(aiCharacters.id, id)).limit(1);
  return row ?? null;
}

export async function insertAiCharacter(
  db: Db,
  brandId: string,
  values: AiCharacterInput,
  actorId: string,
): Promise<AiCharacter> {
  const [row] = await withBrand(db, brandId)
    .insert(aiCharacters, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('ai_characters insert returned no row');
  }
  return row;
}

export async function updateAiCharacter(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<AiCharacterInput>,
  actorId: string,
): Promise<AiCharacter | null> {
  const [row] = await withBrand(db, brandId)
    .update(
      aiCharacters,
      { ...patch, updatedBy: actorId, updatedAt: new Date() },
      eq(aiCharacters.id, id),
    )
    .returning();
  return row ?? null;
}
