import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import {
  competitiveResearch,
  type CompetitiveResearchEntry,
  type NewCompetitiveResearchEntry,
} from './schema';
import { withBrand } from './tenancy';

type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

export type CompetitiveResearchInput = Omit<NewCompetitiveResearchEntry, ManagedColumn>;

export type CompetitiveResearchListRow = CompetitiveResearchEntry;

export async function listCompetitiveResearch(
  db: Db,
  brandId: string,
): Promise<CompetitiveResearchListRow[]> {
  return withBrand(db, brandId)
    .select(competitiveResearch)
    .orderBy(desc(competitiveResearch.updatedAt));
}

export async function getCompetitiveResearchById(
  db: Db,
  brandId: string,
  id: string,
): Promise<CompetitiveResearchListRow | null> {
  const [row] = await withBrand(db, brandId)
    .select(competitiveResearch, eq(competitiveResearch.id, id))
    .limit(1);
  return row ?? null;
}

export async function insertCompetitiveResearch(
  db: Db,
  brandId: string,
  values: CompetitiveResearchInput,
  actorId: string,
): Promise<CompetitiveResearchEntry> {
  const [row] = await withBrand(db, brandId)
    .insert(competitiveResearch, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('competitive_research insert returned no row');
  }
  return row;
}

export async function updateCompetitiveResearch(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<CompetitiveResearchInput>,
  actorId: string,
): Promise<CompetitiveResearchEntry | null> {
  const [row] = await withBrand(db, brandId)
    .update(
      competitiveResearch,
      { ...patch, updatedBy: actorId, updatedAt: new Date() },
      eq(competitiveResearch.id, id),
    )
    .returning();
  return row ?? null;
}
