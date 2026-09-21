import { eq } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';

import type { Db } from './db';
import {
  angles,
  concepts,
  copywriting,
  creativeBriefs,
  creators,
  personas,
  products,
  themes,
} from './schema';

export interface AirtableRecord {
  readonly id: string;
  readonly fields: Record<string, unknown>;
}

export interface AirtableExport {
  readonly Products?: AirtableRecord[];
  readonly Personas?: AirtableRecord[];
  readonly Themes?: AirtableRecord[];
  readonly Angles?: AirtableRecord[];
  readonly Concepts?: AirtableRecord[];
  readonly 'Creative Briefs'?: AirtableRecord[];
  readonly Copywriting?: AirtableRecord[];
  readonly Creators?: AirtableRecord[];
}

interface TableResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
}

type IdMap = Map<string, string>;

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length > 0 ? v : undefined;
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

async function importRows(
  db: Db,
  table: PgTable & { legacyAirtableId: AnyPgColumn; id: AnyPgColumn },
  records: readonly AirtableRecord[],
  mapFn: (fields: Record<string, unknown>) => Record<string, unknown>,
  actorId: string,
): Promise<{ result: TableResult; idMap: IdMap }> {
  const result: TableResult = { imported: 0, skipped: 0, failed: 0, errors: [] };
  const idMap: IdMap = new Map();

  for (const rec of records) {
    const existing = await db
      .select({ id: table.id })
      .from(table)
      .where(eq(table.legacyAirtableId, rec.id))
      .limit(1);
    if (existing.length > 0) {
      result.skipped++;
      idMap.set(rec.id, String(existing[0]?.id));
      continue;
    }
    try {
      const mapped = mapFn(rec.fields);
      const [row] = await db
        .insert(table)
        .values({
          ...mapped,
          legacyAirtableId: rec.id,
          createdBy: actorId,
          updatedBy: actorId,
        } as never)
        .returning({ id: table.id });
      if (row) idMap.set(rec.id, String(row.id));
      result.imported++;
    } catch (e) {
      result.failed++;
      result.errors.push(`${rec.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { result, idMap };
}

function resolveRef(idMap: IdMap, airtableId: unknown): string | undefined {
  if (typeof airtableId !== 'string') return undefined;
  return idMap.get(airtableId);
}

export async function importAirtableExport(
  db: Db,
  data: AirtableExport,
  brandId: string,
  actorId: string,
): Promise<Record<string, TableResult>> {
  const results: Record<string, TableResult> = {};

  const { result: prodResult, idMap: prodMap } = await importRows(
    db,
    products,
    data.Products ?? [],
    (f) => ({
      brandId,
      name: str(f.Name) ?? 'Untitled',
      link: str(f.Link) ?? '',
      collectionLink: str(f['Collection Link']),
    }),
    actorId,
  );
  results.products = prodResult;

  const { result: themeResult, idMap: themeMap } = await importRows(
    db,
    themes,
    data.Themes ?? [],
    (f) => ({ name: str(f.Name) ?? 'Untitled', category: str(f.Category) ?? 'Framework' }),
    actorId,
  );
  results.themes = themeResult;

  const { result: personaResult, idMap: personaMap } = await importRows(
    db,
    personas,
    data.Personas ?? [],
    (f) => ({
      brandId,
      name: str(f.Name) ?? 'Untitled',
      productId: resolveRef(prodMap, f.Product),
      demographic: str(f.Demographic),
      psychographic: str(f.Psychographic),
      painPoints: str(f['Pain Points']),
      coreDesires: str(f['Core Desires']),
      emotionalTriggers: str(f['Emotional Triggers']),
      perceivedBarriers: str(f['Perceived Barriers']),
      buyingTriggers: str(f['Buying Triggers']),
      triggerWords: str(f['Trigger Words']),
    }),
    actorId,
  );
  results.personas = personaResult;

  const { result: angleResult, idMap: angleMap } = await importRows(
    db,
    angles,
    data.Angles ?? [],
    (f) => ({
      brandId,
      name: str(f.Name) ?? 'Untitled',
      description: str(f.Description),
      personaId: resolveRef(personaMap, f.Persona),
      productId: resolveRef(prodMap, f.Product),
      painPoints: str(f['Pain Points']),
      usp: str(f.USP),
      potential: str(f.Potential),
    }),
    actorId,
  );
  results.angles = angleResult;

  const { result: conceptResult, idMap: conceptMap } = await importRows(
    db,
    concepts,
    data.Concepts ?? [],
    (f) => ({
      brandId,
      name: str(f.Name) ?? 'Untitled',
      batch: str(f.Batch),
      angleId: resolveRef(angleMap, f.Angle),
      themeId: resolveRef(themeMap, f.Theme),
      hookExamples: str(f['Hook Examples']),
      scriptIdea: str(f['Script Idea']),
    }),
    actorId,
  );
  results.concepts = conceptResult;

  const { result: briefResult, idMap: briefMap } = await importRows(
    db,
    creativeBriefs,
    data['Creative Briefs'] ?? [],
    (f) => ({
      brandId,
      name: str(f.Name) ?? 'Untitled',
      batch: str(f.Batch),
      conceptId: resolveRef(conceptMap, f.Concept),
      assignee: str(f.Assignee),
      briefToDesign: str(f['Brief to Design']),
      scriptContent: str(f['Script Content']),
    }),
    actorId,
  );
  results.creativeBriefs = briefResult;

  const { result: copyResult } = await importRows(
    db,
    copywriting,
    data.Copywriting ?? [],
    (f) => ({
      brandId,
      creativeBriefId: resolveRef(briefMap, f['Creative Brief']),
      copyNumber: num(f['Copy Number']) ?? 1,
      primaryCopy: str(f['Primary Copy']),
      headline: str(f.Headline),
      linkDescription: str(f['Link Description']),
    }),
    actorId,
  );
  results.copywriting = copyResult;

  const { result: creatorResult } = await importRows(
    db,
    creators,
    data.Creators ?? [],
    (f) => ({
      brandId,
      name: str(f.Name) ?? 'Untitled',
      gender: str(f.Gender),
      ethnicity: str(f.Ethnicity),
      creatorLink: str(f['Creator Link']),
      shippingLocation: str(f['Shipping Location']),
      budgetPer60s: num(f['Budget per 60s']),
      creatorCost: num(f['Creator Cost']),
    }),
    actorId,
  );
  results.creators = creatorResult;

  return results;
}
