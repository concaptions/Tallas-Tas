import { eq } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';

import type { Db } from './db';
import {
  adMetrics,
  anglePersonas,
  angleProducts,
  angles,
  assets,
  campaignsOffers,
  collections,
  competitorAds,
  conceptAngles,
  conceptCollections,
  conceptThemes,
  concepts,
  copywriting,
  creativeBriefs,
  creatorConcepts,
  creatorProducts,
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
  readonly Collections?: AirtableRecord[];
  readonly 'Creative Briefs'?: AirtableRecord[];
  readonly Copywriting?: AirtableRecord[];
  /**
   * Sprint 11: the Gratsi base keeps its copy in TWO tables — "Meta Copywriting" (mapped to
   * `Copywriting`) and "Youtube Copywriting". Meta was empty in the first import, so this is the
   * fallback source; the engine reads it only when `Copywriting` is empty/absent (see the copywriting
   * import). Its field names match Meta's except the primary copy, which is
   * `Descriptions (90 caractères max)`.
   */
  readonly 'Youtube Copywriting'?: AirtableRecord[];
  readonly Creators?: AirtableRecord[];
  readonly Assets?: AirtableRecord[];
  readonly 'Ad Metrics'?: AirtableRecord[];
  readonly 'Competitor Ads'?: AirtableRecord[];
  readonly 'Creator Rankings'?: AirtableRecord[];
  readonly 'Upload Links'?: AirtableRecord[];
  readonly 'Campaigns & Offers'?: AirtableRecord[];
}

interface TableResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
}

type IdMap = Map<string, string>;

// ── Field helpers ──

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length > 0 ? v : undefined;

const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

const bool = (v: unknown): boolean => v === true;

function strArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  return [];
}

function multiSelectArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (typeof v === 'string' && v.length > 0) return [v];
  return [];
}

function currencyInt(v: unknown): number | undefined {
  if (typeof v === 'number') return Math.round(v);
  return undefined;
}

function attachmentUrls(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const urls: string[] = [];
  for (const att of v) {
    if (typeof att === 'object' && att !== null && 'url' in att) {
      const url = (att as Record<string, unknown>).url;
      if (typeof url === 'string') urls.push(url);
    }
  }
  return urls.length > 0 ? urls : undefined;
}

function firstAttachmentUrl(v: unknown): string | undefined {
  const urls = attachmentUrls(v);
  return urls?.[0];
}

function collaboratorName(v: unknown): string | undefined {
  if (typeof v === 'object' && v !== null) {
    if ('name' in v && typeof v.name === 'string') return v.name;
    if ('email' in v && typeof v.email === 'string') return v.email;
  }
  if (typeof v === 'string') return v;
  return undefined;
}

function aiTextValue(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null && 'value' in v && typeof v.value === 'string')
    return v.value;
  return undefined;
}

function splitLinksToArr(v: unknown): string[] {
  if (typeof v !== 'string' || v.length === 0) return [];
  return v
    .split(/[\n\r]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function normalizeStatusKey(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.length === 0) return undefined;
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function selectToBool(v: unknown): boolean | null {
  if (typeof v !== 'string') return null;
  const lower = v.toLowerCase();
  if (lower === 'yes' || lower === 'true') return true;
  if (lower === 'no' || lower === 'false') return false;
  return null;
}

function dateToTimestamp(v: unknown): Date | undefined {
  if (typeof v !== 'string' || v.length === 0) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

function copyNumberFromText(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return 1;
  const match = /\d+/.exec(v);
  return match ? parseInt(match[0], 10) : 1;
}

function extensionDaysFromSelect(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return 0;
  const match = /\d+/.exec(v);
  return match ? parseInt(match[0], 10) : 0;
}

function matchThemeCategory(v: unknown): 'Framework' | 'Production Style' | 'Seasonal' {
  if (typeof v !== 'string') return 'Framework';
  const lower = v.toLowerCase();
  if (lower.includes('production')) return 'Production Style';
  if (lower.includes('seasonal') || lower.includes('timely')) return 'Seasonal';
  return 'Framework';
}

// ── Core import helpers ──

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

function resolveRefs(idMap: IdMap, airtableIds: unknown): string[] {
  if (!Array.isArray(airtableIds)) return [];
  const resolved: string[] = [];
  for (const id of airtableIds) {
    const mapped = resolveRef(idMap, id);
    if (mapped) resolved.push(mapped);
  }
  return resolved;
}

function firstRef(idMap: IdMap, airtableIds: unknown): string | undefined {
  if (Array.isArray(airtableIds)) return resolveRef(idMap, airtableIds[0]);
  return resolveRef(idMap, airtableIds);
}

// ── Main import function ──

export async function importAirtableExport(
  db: Db,
  data: AirtableExport,
  brandId: string,
  actorId: string,
): Promise<Record<string, TableResult>> {
  const results: Record<string, TableResult> = {};

  // ━━ Pass 1: Insert records with data columns (no cross-table FKs) ━━

  const { result: prodResult, idMap: prodMap } = await importRows(
    db,
    products,
    data.Products ?? [],
    (f) => ({
      brandId,
      name: str(f['Product Name / Landing Page Name'] ?? f.Name) ?? 'Untitled',
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
    (f) => ({
      name: str(f.Name) ?? 'Untitled',
      category: matchThemeCategory(f.Category),
      notes: str(f.Notes),
      assigneeId: collaboratorName(f.Assignee),
      status: normalizeStatusKey(f.Status),
      attachments: attachmentUrls(f.Attachments),
      aiAttachmentSummary: aiTextValue(f['Attachment Summary']),
      isActive: f['Is Active'] !== false,
    }),
    actorId,
  );
  results.themes = themeResult;

  const { result: campaignResult, idMap: campaignMap } = await importRows(
    db,
    campaignsOffers,
    data['Campaigns & Offers'] ?? [],
    (f) => ({
      brandId,
      name: str(f.Name) ?? 'Untitled',
      holiday: str(f.Holiday),
      discountOffer: str(f['Discount Offer']),
      code: str(f.Code),
      officialDate: str(f['Official Date']),
      country: str(f.Country),
      description: str(f.Description),
      confirmedByClient: bool(f.Interested ?? f['Confirmed by Client']),
      launched: bool(f.Launched),
      adsLaunchDate: str(f['Ads Launch Date']),
      adsEndDate: str(f['Ads End Date']),
    }),
    actorId,
  );
  results.campaignsOffers = campaignResult;

  const { result: personaResult, idMap: personaMap } = await importRows(
    db,
    personas,
    data.Personas ?? [],
    (f) => ({
      brandId,
      name: str(f.Name) ?? 'Untitled',
      productId: firstRef(prodMap, f.Product),
      demographic: str(f.Demographic ?? f['Description  [Age Status Salary]']),
      psychographic: str(f.Psychographic ?? f.Personality),
      coreDesires: str(f['Core Desires'] ?? f.Passion),
      emotionalTriggers: str(f['Emotional Triggers'] ?? f['Drivers for this persona']),
      painPoints: str(f['Pain Points']),
      successFactors: str(f['Success Factors']),
      perceivedBarriers: str(f['Perceived Barriers']),
      stageOfAwareness: normalizeStatusKey(
        f['Problem-Solution Awareness Level'] ?? f['Stage of Awareness'],
      ),
      buyingTriggers: str(f['Buying Triggers']),
      problemChallenge: str(f['Problem Challenge']),
      successTransformation: str(f['Success Transformation']),
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
      painPoints: str(f['Pain Points']),
      usp: str(f.USP),
      type: multiSelectArr(f.Type),
      formats: multiSelectArr(f['Formats to create'] ?? f.Formats),
      adInspoLinks: splitLinksToArr(f['Ad Inspo'] ?? f['Ad Inspo Links']),
      potential: str(f.Potential),
      winning: bool(f.Winning),
      internalNotes: str(f['Internal Notes']),
      clientNotes: str(f['Client Notes']),
      briefUrl: str(f.Brief),
      exactScriptUrl: str(f['Exact Script']),
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
      category: str(f.Category),
      conceptStyle: str(f.Style ?? f['Concept Style']),
      formats: multiSelectArr(f.Type ?? f.Formats),
      adInspoLinks: splitLinksToArr(f['Ad Inspo Links']),
      hookExamples: str(f['Hook Examples'] ?? f.Hooks),
      scriptIdea: str(f['Script Idea'] ?? f.Script),
      approvalStatus: normalizeStatusKey(f.Status ?? f['Approval Status']),
      formatsToCreate: multiSelectArr(f['Formats to Create']),
      productionStatus: normalizeStatusKey(f['Production Status']),
    }),
    actorId,
  );
  results.concepts = conceptResult;

  const { result: collectionResult, idMap: collectionMap } = await importRows(
    db,
    collections,
    data.Collections ?? [],
    (f) => ({
      brandId,
      name: str(f['Main Collection'] ?? f.Name) ?? 'Untitled',
      url: str(f.URL ?? f.Url),
      creativeDesignNote: str(f['Creative Design']),
    }),
    actorId,
  );
  results.collections = collectionResult;

  const { result: briefResult, idMap: briefMap } = await importRows(
    db,
    creativeBriefs,
    data['Creative Briefs'] ?? [],
    (f) => ({
      brandId,
      name: str(f.Name) ?? 'Untitled',
      batch: str(f.Batch),
      source: str(f.Source),
      funnel: str(f.Funnel),
      type: str(f.Type),
      priority: str(f.Priority),
      assignee: str(f.Assignee) ?? collaboratorName(f.Assignee),
      briefToDesign: str(f['Brief to Design'] ?? f['Brief to Design/Editing']),
      scriptContent: str(f['Script Content'] ?? f['Script / Ad Content']),
      adContent: str(f['Ad Content']),
      elementsTested: str(f['Elements we are Testing']),
      inspoLinks: strArr(f['Inspo Links']),
      dimensions: strArr(f.Dimensions),
      platform: multiSelectArr(f.Platform),
      designFileUrl: str(f['Design Link URL']),
      qaVideoEditor: bool(f['Video Editor QA']),
      qaDesigner: bool(f['Graphic Designer QA'] ?? f['Designer QA']),
      qaStrategist: bool(f['Creative Strategist QA'] ?? f['Strategist QA']),
      spellingFeedback: str(f['Spelling Feedback']),
      spellingFeedback2: str(f['Spelling Feedback 2']),
      clickForAiSpellChecker: bool(f['Click for AI Spell Checker Again']),
      inspirationImage: attachmentUrls(f.Inspiration),
      qaChecklistDoc: attachmentUrls(f['QA Checklist Doc']),
      designFile: attachmentUrls(f['Design File']),
      scriptAndBriefBreakdown: attachmentUrls(f['Script & brief breakdown ']),
      language: str(f.Language),
      offer: str(f.Offer),
      internalStatus: normalizeStatusKey(f['Internal Status']),
      clientStatus: normalizeStatusKey(f['Client Status']),
      performance: str(f.Performance),
    }),
    actorId,
  );
  results.creativeBriefs = briefResult;

  // Meta Copywriting first (existing behavior); fall back to Youtube Copywriting when Meta is
  // empty or absent (Sprint 11). Both feed the same table through one mapper, whose field-name
  // fallbacks already cover the two tables — bar the primary copy, added below.
  const copyRecords =
    data.Copywriting && data.Copywriting.length > 0
      ? data.Copywriting
      : (data['Youtube Copywriting'] ?? []);

  const { result: copyResult, idMap: copyMap } = await importRows(
    db,
    copywriting,
    copyRecords,
    (f) => ({
      brandId,
      copyNumber: copyNumberFromText(f['Copy Number'] ?? f['Copy #']),
      primaryCopy: str(
        f['Primary Copy'] ?? f.Descriptions ?? f['Descriptions (90 caractères max)'],
      ),
      headline: str(f.Headline),
      linkDescription: str(f['Link Description'] ?? f['News Feed']),
      cta: str(f.CTA),
      funnel: str(f.Funnel),
      used: bool(f.USED ?? f.Used),
      winning: bool(f.Winning),
      metaRating: num(f['Meta Rating']),
      clickForAiSpellChecker: bool(f['Click for AI Spell Checker Again']),
      spellingFeedback: str(f['Spelling Feedback']),
      status: normalizeStatusKey(f.Status),
      clientComment: str(f["Client's Comment"] ?? f['Client Comment']),
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
      name:
        str(f['Creator name (Filled by UGC Manager)'] ?? f['Creator Name'] ?? f.Name) ?? 'Untitled',
      ageBracket: str(f.Age ?? f['Age Bracket']),
      gender: str(f.Gender),
      ethnicity: str(f.Ethnicity),
      profilePicUrl: firstAttachmentUrl(f["Creator's Profile Pic"]) ?? str(f['Profile Pic URL']),
      videoIntroUrl: firstAttachmentUrl(f["Creator's video Intro"]) ?? str(f['Video Intro URL']),
      creatorLink: str(f['Creator Link']),
      platform: multiSelectArr(f.Platform),
      internalBrief: str(f['Additional Note - TAS Team'] ?? f['Internal Brief']),
      shippingLocation: str(f['Shipping Location']),
      trackingNumber: str(f['Tracking Number '] ?? f['Tracking Number']),
      dateOfManagement: dateToTimestamp(f['Date of Management']),
      deadline: dateToTimestamp(f.Deadline),
      budgetPer60s: currencyInt(f['Budget per 60sec video'] ?? f['Budget per 60s']),
      creatorCost: currencyInt(f["Creator's cost (USD) - Internal"] ?? f['Creator Cost']),
      costUsd: currencyInt(f['Paid by TAS'] ?? f['Cost USD']),
      rawAssetsUrl: str(f['Raw assets'] ?? f['Raw Assets URL']),
      internalCreatorStatus: normalizeStatusKey(f.Status ?? f['Internal Creator Status']),
      clientStatus: normalizeStatusKey(f['Creator Status'] ?? f['Client Status']),
      internalAssetsStatus: normalizeStatusKey(f['Internal Assets Status']),
      clientNote: str(f["(Client's) Note or Comments"] ?? f['Client Note']),
      instagramUsername: str(f['Instagram Username']),
      forPartnershipAds: bool(f['For Partnership Ads']),
      partnershipActivity: normalizeStatusKey(f['Partnership Activity'] ?? f['Partnership Status']),
      partnershipActivatedAt: dateToTimestamp(
        f['Date of Partnership Activation'] ?? f['Partnership Activated At'],
      ),
      partnershipPeriodDays: num(
        f['Partnership Time Period (days)'] ?? f['Partnership Period Days'],
      ),
      continueWorkingWith: selectToBool(f['Continue Working With?']),
      extensionDays: extensionDaysFromSelect(f['Extension Time Period'] ?? f['Extension Days']),
      partnershipPricePer30Days: currencyInt(
        f['Partnership Price per 30 days'] ?? f['Partnership Price Per 30 Days'],
      ),
      partnershipNotes: str(f['Notes for Partnership ads'] ?? f['Partnership Notes']),
      facebookProfileUrl: str(f['Facebook Profile for Partnership'] ?? f['Facebook Profile URL']),
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

  // ━━ Pass 2: Resolve cross-table FKs and junction tables ━━

  // Angles → anglePersonas + angleProducts
  for (const rec of data.Angles ?? []) {
    const angleId = angleMap.get(rec.id);
    if (!angleId) continue;
    const personaIds = resolveRefs(personaMap, rec.fields.Persona);
    for (const personaId of personaIds) {
      await db.insert(anglePersonas).values({ angleId, personaId }).onConflictDoNothing();
    }
    if (personaIds.length === 0) {
      const personaId = resolveRef(personaMap, rec.fields.Persona);
      if (personaId) {
        await db.insert(anglePersonas).values({ angleId, personaId }).onConflictDoNothing();
      }
    }
    const productIds = resolveRefs(prodMap, rec.fields.Product);
    for (const productId of productIds) {
      await db.insert(angleProducts).values({ angleId, productId }).onConflictDoNothing();
    }
    if (productIds.length === 0) {
      const productId = resolveRef(prodMap, rec.fields.Product);
      if (productId) {
        await db.insert(angleProducts).values({ angleId, productId }).onConflictDoNothing();
      }
    }
  }

  // Concepts → conceptAngles + conceptThemes (name-match) + conceptCollections
  for (const rec of data.Concepts ?? []) {
    const conceptId = conceptMap.get(rec.id);
    if (!conceptId) continue;

    const angleIds = resolveRefs(angleMap, rec.fields.Angle);
    for (const angleId of angleIds) {
      await db.insert(conceptAngles).values({ conceptId, angleId }).onConflictDoNothing();
    }
    if (angleIds.length === 0) {
      const angleId = resolveRef(angleMap, rec.fields.Angle);
      if (angleId) {
        await db.insert(conceptAngles).values({ conceptId, angleId }).onConflictDoNothing();
      }
    }

    // Theme can be record links (standard Airtable) or multipleSelects (Gratsi) — try both
    const themeRefsResolved = resolveRefs(themeMap, rec.fields.Theme);
    if (themeRefsResolved.length > 0) {
      for (const themeId of themeRefsResolved) {
        await db.insert(conceptThemes).values({ conceptId, themeId }).onConflictDoNothing();
      }
    } else {
      const singleThemeId = resolveRef(themeMap, rec.fields.Theme);
      if (singleThemeId) {
        await db
          .insert(conceptThemes)
          .values({ conceptId, themeId: singleThemeId })
          .onConflictDoNothing();
      } else {
        const themeNames = multiSelectArr(rec.fields.Theme);
        for (const themeName of themeNames) {
          for (const [airtableId, pgId] of themeMap.entries()) {
            const themeRec = (data.Themes ?? []).find((t) => t.id === airtableId);
            if (themeRec && str(themeRec.fields.Name) === themeName) {
              await db
                .insert(conceptThemes)
                .values({ conceptId, themeId: pgId })
                .onConflictDoNothing();
            }
          }
        }
      }
    }

    const collectionIds = resolveRefs(collectionMap, rec.fields.Collection);
    for (const collectionId of collectionIds) {
      await db.insert(conceptCollections).values({ conceptId, collectionId }).onConflictDoNothing();
    }
  }

  // Collections → campaignId + angleId + productId FKs (was buggy: used conceptMap for campaignId)
  for (const rec of data.Collections ?? []) {
    const collectionId = collectionMap.get(rec.id);
    if (!collectionId) continue;
    const campaignId = firstRef(campaignMap, rec.fields['Campaigns & Offers']);
    const angleId = firstRef(angleMap, rec.fields.Angles ?? rec.fields.Angle);
    const productId = firstRef(prodMap, rec.fields.Product ?? rec.fields['(Internal) Product']);
    if (campaignId || angleId || productId) {
      await db
        .update(collections)
        .set({
          ...(campaignId ? { campaignId } : {}),
          ...(angleId ? { angleId } : {}),
          ...(productId ? { productId } : {}),
        })
        .where(eq(collections.id, collectionId));
    }
  }

  // Creative Briefs → conceptId + angleId + productId + collectionId + campaignOfferId FKs
  for (const rec of data['Creative Briefs'] ?? []) {
    const briefId = briefMap.get(rec.id);
    if (!briefId) continue;
    const f = rec.fields;
    const conceptId = firstRef(conceptMap, f.Concept);
    const angleId = firstRef(angleMap, f.Angle);
    const productId = firstRef(prodMap, f['(Internal) Product'] ?? f.Product);
    const collectionId = firstRef(collectionMap, f['(Internal) Collections 3'] ?? f.Collection);
    const campaignOfferId = firstRef(campaignMap, f['Campaigns & Offers']);
    if (conceptId || angleId || productId || collectionId || campaignOfferId) {
      await db
        .update(creativeBriefs)
        .set({
          ...(conceptId ? { conceptId } : {}),
          ...(angleId ? { angleId } : {}),
          ...(productId ? { productId } : {}),
          ...(collectionId ? { collectionId } : {}),
          ...(campaignOfferId ? { campaignOfferId } : {}),
        })
        .where(eq(creativeBriefs.id, briefId));
    }
  }

  // Copywriting → creativeBriefId + conceptId + productId FKs (same Meta-or-Youtube source)
  for (const rec of copyRecords) {
    const copyId = copyMap.get(rec.id);
    if (!copyId) continue;
    const f = rec.fields;
    const creativeBriefId = firstRef(briefMap, f['Creative Brief'] ?? f.Creative);
    const conceptId = firstRef(conceptMap, f.Concept);
    const productId = firstRef(prodMap, f.Product);
    if (creativeBriefId || conceptId || productId) {
      await db
        .update(copywriting)
        .set({
          ...(creativeBriefId ? { creativeBriefId } : {}),
          ...(conceptId ? { conceptId } : {}),
          ...(productId ? { productId } : {}),
        })
        .where(eq(copywriting.id, copyId));
    }
  }

  // Creators → creatorConcepts + creatorProducts junction tables
  for (const rec of data.Creators ?? []) {
    const creatorId = creatorMap.get(rec.id);
    if (!creatorId) continue;
    const conceptIds = resolveRefs(
      conceptMap,
      rec.fields['Concept to film'] ?? rec.fields.Concepts,
    );
    for (const conceptId of conceptIds) {
      await db.insert(creatorConcepts).values({ creatorId, conceptId }).onConflictDoNothing();
    }
    const productIds = resolveRefs(prodMap, rec.fields.Products ?? rec.fields.Product);
    for (const productId of productIds) {
      await db.insert(creatorProducts).values({ creatorId, productId }).onConflictDoNothing();
    }
  }

  return results;
}
