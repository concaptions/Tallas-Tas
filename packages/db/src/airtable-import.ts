import { eq } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';

import type { Db } from './db';
import {
  adMetrics,
  anglePersonas,
  angleProducts,
  angles,
  assets,
  competitorAds,
  conceptAngles,
  conceptThemes,
  concepts,
  copywriting,
  creativeBriefs,
  creatorRankings,
  creators,
  personas,
  products,
  themes,
  uploadLinks,
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
  readonly Assets?: AirtableRecord[];
  readonly 'Ad Metrics'?: AirtableRecord[];
  readonly 'Competitor Ads'?: AirtableRecord[];
  readonly 'Creator Rankings'?: AirtableRecord[];
  readonly 'Upload Links'?: AirtableRecord[];
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
    (f) => {
      const mapped: Record<string, unknown> = {
        brandId,
        name: str(f.Name) ?? 'Untitled',
        description: str(f.Description),
        painPoints: str(f['Pain Points']),
        usp: str(f.USP),
        potential: str(f.Potential),
      };
      return mapped;
    },
    actorId,
  );
  results.angles = angleResult;

  for (const rec of data.Angles ?? []) {
    const angleId = angleMap.get(rec.id);
    if (!angleId) continue;
    const personaId = resolveRef(personaMap, rec.fields.Persona);
    if (personaId) {
      await db.insert(anglePersonas).values({ angleId, personaId }).onConflictDoNothing();
    }
    const productId = resolveRef(prodMap, rec.fields.Product);
    if (productId) {
      await db.insert(angleProducts).values({ angleId, productId }).onConflictDoNothing();
    }
  }

  const { result: conceptResult, idMap: conceptMap } = await importRows(
    db,
    concepts,
    data.Concepts ?? [],
    (f) => ({
      brandId,
      name: str(f.Name) ?? 'Untitled',
      batch: str(f.Batch),
      hookExamples: str(f['Hook Examples']),
      scriptIdea: str(f['Script Idea']),
    }),
    actorId,
  );
  results.concepts = conceptResult;

  for (const rec of data.Concepts ?? []) {
    const conceptId = conceptMap.get(rec.id);
    if (!conceptId) continue;
    const angleId = resolveRef(angleMap, rec.fields.Angle);
    if (angleId) {
      await db.insert(conceptAngles).values({ conceptId, angleId }).onConflictDoNothing();
    }
    const themeId = resolveRef(themeMap, rec.fields.Theme);
    if (themeId) {
      await db.insert(conceptThemes).values({ conceptId, themeId }).onConflictDoNothing();
    }
  }

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

  const { result: creatorResult, idMap: creatorMap } = await importRows(
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

  const { result: assetResult } = await importRows(
    db,
    assets,
    data.Assets ?? [],
    (f) => ({
      brandId,
      filename: str(f.Filename) ?? 'untitled',
      contentType: str(f['Content Type']) ?? 'application/octet-stream',
      sizeBytes: num(f['Size Bytes']) ?? 0,
      r2Key: str(f['R2 Key']) ?? '',
      url: str(f.URL) ?? '',
      category: str(f.Category) ?? 'reference',
      conceptId: resolveRef(conceptMap, f.Concept),
      caption: str(f.Caption),
    }),
    actorId,
  );
  results.assets = assetResult;

  const { result: adMetricResult } = await importRows(
    db,
    adMetrics,
    data['Ad Metrics'] ?? [],
    (f) => ({
      brandId,
      adName: str(f['Ad Name']) ?? 'Untitled',
      metaAdId: str(f['Meta Ad ID']),
      briefId: resolveRef(briefMap, f['Creative Brief']),
      conceptId: resolveRef(conceptMap, f.Concept),
      spend: str(f.Spend) ?? '0',
      impressions: num(f.Impressions) ?? 0,
      clicks: num(f.Clicks) ?? 0,
      conversions: num(f.Conversions) ?? 0,
      ctr: str(f.CTR),
      cpc: str(f.CPC),
      cpa: str(f.CPA),
      roas: str(f.ROAS),
      dateRange: str(f['Date Range']) ?? '',
    }),
    actorId,
  );
  results.adMetrics = adMetricResult;

  const { result: competitorAdResult } = await importRows(
    db,
    competitorAds,
    data['Competitor Ads'] ?? [],
    (f) => ({
      brandId,
      platform: str(f.Platform) ?? 'meta',
      advertiserName: str(f['Advertiser Name']) ?? 'Unknown',
      adUrl: str(f['Ad URL']) ?? '',
      headline: str(f.Headline),
      bodyText: str(f['Body Text']),
      format: str(f.Format) ?? 'video',
      estimatedSpend: str(f['Estimated Spend']),
      daysActive: num(f['Days Active']),
      firstSeen: str(f['First Seen']) ?? '',
      lastSeen: str(f['Last Seen']),
      notes: str(f.Notes),
    }),
    actorId,
  );
  results.competitorAds = competitorAdResult;

  const { result: rankingResult } = await importRows(
    db,
    creatorRankings,
    data['Creator Rankings'] ?? [],
    (f) => ({
      brandId,
      creatorId: resolveRef(creatorMap, f.Creator) ?? '',
      creatorName: str(f['Creator Name']) ?? 'Unknown',
      totalAds: num(f['Total Ads']) ?? 0,
      totalSpend: str(f['Total Spend']) ?? '0',
      totalConversions: num(f['Total Conversions']) ?? 0,
      avgRoas: str(f['Avg ROAS']),
      avgCpa: str(f['Avg CPA']),
      rank: num(f.Rank) ?? 0,
      periodLabel: str(f['Period Label']) ?? '',
    }),
    actorId,
  );
  results.creatorRankings = rankingResult;

  const { result: uploadLinkResult } = await importRows(
    db,
    uploadLinks,
    data['Upload Links'] ?? [],
    (f) => ({
      brandId,
      token: str(f.Token) ?? crypto.randomUUID().slice(0, 8),
      label: str(f.Label) ?? 'Imported link',
      recipientName: str(f['Recipient Name']),
      recipientEmail: str(f['Recipient Email']),
      maxUploads: str(f['Max Uploads']),
      isActive: f['Is Active'] !== false,
      notes: str(f.Notes),
    }),
    actorId,
  );
  results.uploadLinks = uploadLinkResult;

  return results;
}
