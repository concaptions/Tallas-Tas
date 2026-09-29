import { eq, inArray } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';

import type { Db } from './db';
import {
  adMetrics,
  anglePersonas,
  angleProducts,
  angles,
  assets,
  campaignsOffers,
  clientAssetFolders,
  collections,
  competitiveResearch,
  competitorAds,
  conceptAngles,
  conceptCollections,
  conceptThemes,
  concepts,
  copywriting,
  creativeBriefs,
  creativeDimensions,
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
  /** Sprint 2026-09-29: three Gratsi tables that previously had no Drizzle home. */
  readonly 'Competitive research'?: AirtableRecord[];
  readonly 'Client Assets Organisation'?: AirtableRecord[];
  readonly '(Internal) Creative Dimensions'?: AirtableRecord[];
}

interface TableResult {
  imported: number;
  /** Rows whose `legacy_airtable_id` already existed and were UPDATED with the current mapping. */
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/**
 * Everything the dry run must surface (Sprint 2026-09-29): select values no map recognised,
 * link references that resolved to nothing, and attachment traffic. Collected per run, printed
 * by the script, identical between a dry run and a live one.
 */
export interface ImportWarnings {
  /** `table.field: "raw value" xN` — a select label no explicit map covers. */
  unmappedValues: Map<string, number>;
  /** `table.field` — Airtable record ids that resolved to no imported row. */
  brokenRefs: Map<string, number>;
  attachmentsCaptured: number;
  general: string[];
}

export function emptyWarnings(): ImportWarnings {
  return { unmappedValues: new Map(), brokenRefs: new Map(), attachmentsCaptured: 0, general: [] };
}

function warnValue(w: ImportWarnings, where: string, raw: string): void {
  const key = `${where}: "${raw}"`;
  w.unmappedValues.set(key, (w.unmappedValues.get(key) ?? 0) + 1);
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

/** `attachmentUrls`, counted: the dry run reports how many attachment URLs were captured. */
function att(w: ImportWarnings, v: unknown): string[] | undefined {
  const urls = attachmentUrls(v);
  if (urls) w.attachmentsCaptured += urls.length;
  return urls;
}

function attFirst(w: ImportWarnings, v: unknown): string | undefined {
  const url = firstAttachmentUrl(v);
  if (url !== undefined) w.attachmentsCaptured += 1;
  return url;
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

/**
 * Sprint 2026-09-29: the first import normalized Gratsi's select labels blindly, which wrote keys
 * the state machines do not know ("video_editing_in_progress_feriel", "sent_to_nadish",
 * "filming_concept", "todo", …). Every status-bearing field now goes through an EXPLICIT map from
 * the base's live options (fetched 2026-09-29 from appllDG4OmkK2Hdnn) to `@tas/domain/state` /
 * enum keys. A label outside the map falls back to the normalized key and is logged, so new
 * Airtable options surface in the dry run instead of silently minting keys.
 *
 * `null` in a map means "deliberately no destination" (logged, stored as NULL).
 */
type StatusMap = Record<string, string | null>;

const MAPS = {
  // Concepts.'Production Status' → conceptProductionStatuses (to_do…launched, TASK 2b).
  conceptProduction: {
    done: 'done',
    filming_in_progress: 'filming_in_progress',
    sent_to_design: 'sent_to_design',
    editing_concept: 'in_progress',
    filming_concept: 'filming_in_progress',
    // An approval outcome, not a production stage; `conceptApproval` has no denied-after-approval
    // state either, so the production column stays NULL and the dry run counts it.
    declined_by_client: null,
  },
  // Concepts.'Status' → conceptApprovalStatuses. "Pending For Approval" is pending_client here —
  // the blind normalize wrote pending_for_approval, a key the concept vocabulary never had.
  conceptApproval: {
    pending_for_approval: 'pending_client',
    approved: 'approved',
    denied: 'rejected',
  },
  // Creative Design.'Internal Status' → INTERNAL_VIDEO/STATIC_STATUS keys. Feriel and Nadish are
  // Gratsi's video editors; their per-person stages collapse onto the domain ladder.
  briefInternal: {
    sent_to_designer: 'sent_to_designer',
    sent_to_feriel: 'sent_to_video_editor',
    sent_to_nadish: 'sent_to_video_editor',
    video_editing_in_progress_feriel: 'video_editing_in_progress',
    video_editing_in_progress_nadish: 'video_editing_in_progress',
    video_editing_on_hold: 'on_hold',
    video_revision_feriel: 'videos_revisions',
    video_revision_nadish: 'videos_revisions',
    ad_submitted: 'ad_submitted',
    approved: 'approved',
    images_revisions: 'images_revisions',
    revisions_submitted: 'revisions_submitted',
    design_submitted: 'ad_submitted',
  },
  // Creative Design.'Client Status' → CLIENT_STATUS: the four labels normalize onto the keys 1:1.
  briefClient: {
    pending_for_approval: 'pending_for_approval',
    approved: 'approved',
    revisions_needed: 'revisions_needed',
    launched: 'launched',
  },
  // UGC.'Status' options ARE the creator CLIENT track's keys (CREATOR_STATUS), 1:1. The first
  // import routed this field to internal_creator_status — the tracks were swapped.
  creatorClient: {
    pending_for_approval: 'pending_for_approval',
    approved: 'approved',
    disapproved: 'disapproved',
    video_delivered: 'video_delivered',
    due_shipment: 'due_shipment',
    filming_in_progress: 'filming_in_progress',
    draft: 'draft',
    internal_revisions: 'internal_revisions',
    revisions_needed: 'revisions_needed',
  },
  // UGC.'Creator Status' (operational waiting states) → INTERNAL_CREATOR_STATUS, best effort:
  // request → waiting on the creator, approved → creator locked in, revisions_needed → waiting on
  // a re-delivery. "Declined the brief" has no internal home and stays NULL (logged).
  creatorInternal: {
    waiting_for_creator_s_response_on_the_brief: 'request',
    declined_the_brief: null,
    waiting_for_assets: 'approved',
    waiting_for_revision: 'revisions_needed',
    assets_delivered: 'approved',
  },
  // 'Partnership Activity': the stray "Yes" means an active partnership (decided Sprint 1).
  partnershipActivity: {
    yes: 'active',
    active: 'active',
    not_active: 'not_active',
    ended: 'ended',
  },
  // Themes.'Status' → the theme_status ENUM. The blind "todo" made the whole insert fail, which
  // is why only 3 of Gratsi's themes survived the first import.
  themeStatus: { todo: 'not_started', in_progress: 'in_progress', done: 'done' },
  // Personas.'Problem-Solution Awareness Level' → awareness_stage ENUM.
  awareness: {
    completely_unaware: 'unaware',
    unaware: 'unaware',
    problem_aware: 'problem_aware',
    solution_aware: 'solution_aware',
    product_aware: 'product_aware',
    most_aware: 'most_aware',
  },
  // Meta Copywriting.'Status' → COPY_STATUS keys (1:1 through normalize).
  copyStatus: {
    pending_for_client_review: 'pending_for_client_review',
    edited_by_client: 'edited_by_client',
    approved: 'approved',
    disapproved: 'disapproved',
    revisions_needed: 'revisions_needed',
  },
  // Competitive research.'Type' is presented as a select over ['Competitor', 'Inspiration'].
  competitiveType: {
    competitor: 'Competitor',
    inspiration: 'Inspiration',
    inspirations: 'Inspiration',
  },
} satisfies Record<string, StatusMap>;

/** Applies one map: exact hit → key, miss → normalized fallback + warning, null hit → NULL + warning. */
function mapStatus(
  w: ImportWarnings,
  where: string,
  map: StatusMap,
  v: unknown,
): string | undefined {
  const normalized = normalizeStatusKey(v);
  if (normalized === undefined) return undefined;
  if (normalized in map) {
    const mapped = map[normalized];
    if (mapped === null) {
      warnValue(w, `${where} (deliberately unmapped)`, String(v));
      return undefined;
    }
    return mapped;
  }
  warnValue(w, where, String(v));
  return normalized;
}

/** Label-typed columns (type, priority, language, platform, source, funnel) keep LABELS, sanitised. */
function mapCreativeType(w: ImportWarnings, v: unknown): string | undefined {
  const s = str(v);
  if (s === undefined) return undefined;
  const known: Record<string, string> = {
    Video: 'Video',
    Static: 'Static',
    Image: 'Static',
    Carousel: 'Carousel',
    'Motion Image': 'Motion Image',
  };
  if (s in known) return known[s];
  warnValue(w, 'creativeBriefs.type', s);
  return undefined; // column default: Video
}

function mapPriority(w: ImportWarnings, v: unknown, type: string | undefined): string | undefined {
  const s = str(v);
  if (s === undefined) return undefined;
  const isStatic = type === 'Static' || type === 'Carousel';
  if (/high/i.test(s)) return isStatic ? 'Static High' : 'Video High';
  if (/average/i.test(s)) return isStatic ? 'Static Average' : 'Video Average';
  warnValue(w, 'creativeBriefs.priority', s);
  return undefined;
}

function mapPlatforms(w: ImportWarnings, v: unknown): string[] {
  const known: Record<string, string> = {
    Meta: 'Meta',
    Google: 'Google',
    Tiktok: 'TikTok',
    TikTok: 'TikTok',
    Pushowl: 'Pushowl',
    Website: 'Website',
    YouTube: 'YouTube',
  };
  const out: string[] = [];
  for (const entry of multiSelectArr(v)) {
    const mapped = known[entry];
    if (mapped === undefined) warnValue(w, 'creativeBriefs.platform', entry);
    else out.push(mapped);
  }
  return out;
}

function mapLanguage(w: ImportWarnings, v: unknown): string | undefined {
  const s = str(v);
  if (s === undefined) return undefined;
  if (/^english/i.test(s)) return 'English';
  warnValue(w, 'creativeBriefs.language', s);
  return undefined;
}

function mapSource(w: ImportWarnings, v: unknown): string | undefined {
  const s = str(v);
  if (s === undefined) return undefined;
  if (s === 'TAS' || s === 'Client') return s;
  warnValue(w, 'creativeBriefs.source', s);
  return undefined; // column default: TAS
}

function mapBriefFunnel(w: ImportWarnings, v: unknown): string | undefined {
  const s = str(v);
  if (s === undefined) return undefined;
  if (s === 'TOF' || s === 'RETARGETTING' || s === 'ALL FUNNELS') return s;
  warnValue(w, 'creativeBriefs.funnel', s);
  return undefined; // column default: TOF
}

function mapCopyFunnel(w: ImportWarnings, v: unknown): string | undefined {
  const s = str(v);
  if (s === undefined) return undefined;
  if (s === 'TOF' || s === 'MOF' || s === 'BOF') return s;
  if (/^retarget/i.test(s)) return 'Retargeting';
  warnValue(w, 'copywriting.funnel', s);
  return undefined;
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
  const result: TableResult = { imported: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
  const idMap: IdMap = new Map();

  for (const rec of records) {
    const existing = await db
      .select({ id: table.id })
      .from(table)
      .where(eq(table.legacyAirtableId, rec.id))
      .limit(1);
    if (existing.length > 0) {
      // Sprint 2026-09-29: a row from an earlier import is UPDATED with the current mapping, not
      // skipped — this is what heals the dropped fields and the blindly-normalized status keys the
      // first Gratsi run left behind. `created_*` and the id stay; the mapped columns are rewritten.
      const existingId = String(existing[0]?.id);
      idMap.set(rec.id, existingId);
      try {
        // A nested transaction is a SAVEPOINT: a bad row rolls back alone instead of aborting
        // the import's surrounding transaction (Postgres poisons an aborted tx otherwise).
        await db.transaction(async (sp) => {
          const mapped = mapFn(rec.fields);
          await sp
            .update(table)
            .set({ ...mapped, updatedBy: actorId, updatedAt: new Date() })
            .where(eq(table.id, existingId));
        });
        result.updated++;
      } catch (e) {
        result.failed++;
        result.errors.push(`${rec.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
      continue;
    }
    try {
      await db.transaction(async (sp) => {
        const mapped = mapFn(rec.fields);
        const [row] = await sp
          .insert(table)
          .values({
            ...mapped,
            legacyAirtableId: rec.id,
            createdBy: actorId,
            updatedBy: actorId,
          } as never)
          .returning({ id: table.id });
        if (row) idMap.set(rec.id, String(row.id));
      });
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

function resolveRefs(
  idMap: IdMap,
  airtableIds: unknown,
  w?: ImportWarnings,
  where?: string,
): string[] {
  if (!Array.isArray(airtableIds)) return [];
  const resolved: string[] = [];
  for (const id of airtableIds) {
    const mapped = resolveRef(idMap, id);
    if (mapped) resolved.push(mapped);
    else if (w && where && typeof id === 'string' && id.startsWith('rec')) {
      w.brokenRefs.set(where, (w.brokenRefs.get(where) ?? 0) + 1);
    }
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
  warnings: ImportWarnings = emptyWarnings(),
): Promise<Record<string, TableResult>> {
  const results: Record<string, TableResult> = {};
  const w = warnings;

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
      status: mapStatus(w, 'themes.status', MAPS.themeStatus, f.Status),
      attachments: att(w, f.Attachments),
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
      stageOfAwareness: mapStatus(
        w,
        'personas.stageOfAwareness',
        MAPS.awareness,
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
      approvalStatus: mapStatus(
        w,
        'concepts.approvalStatus',
        MAPS.conceptApproval,
        f.Status ?? f['Approval Status'],
      ),
      formatsToCreate: multiSelectArr(f['Formats to Create']),
      productionStatus: mapStatus(
        w,
        'concepts.productionStatus',
        MAPS.conceptProduction,
        f['Production Status'],
      ),
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

  // Gratsi's Dimensions field is record links into "(Internal) Creative Dimensions"; the brief
  // column stores the dimension NAMES ('1:1', '9:16', …), so the links resolve through the export
  // itself — never store a recXXX id in a jsonb of ratios (the first import did exactly that).
  const dimensionNameByRecId = new Map<string, string>();
  for (const rec of data['(Internal) Creative Dimensions'] ?? []) {
    const name = str(rec.fields.Name) ?? str(rec.fields.Dimensions);
    if (name !== undefined) dimensionNameByRecId.set(rec.id, name);
  }
  const resolveDimensions = (v: unknown): string[] => {
    if (!Array.isArray(v)) return [];
    const out: string[] = [];
    for (const entry of v) {
      if (typeof entry !== 'string') continue;
      const name = dimensionNameByRecId.get(entry);
      if (name !== undefined) out.push(name);
      else if (entry.startsWith('rec'))
        w.brokenRefs.set(
          'creativeBriefs.dimensions',
          (w.brokenRefs.get('creativeBriefs.dimensions') ?? 0) + 1,
        );
      else out.push(entry);
    }
    return out;
  };

  const { result: briefResult, idMap: briefMap } = await importRows(
    db,
    creativeBriefs,
    data['Creative Briefs'] ?? [],
    (f) => {
      const type = mapCreativeType(w, f.Type);
      return {
        brandId,
        name: str(f.Name) ?? 'Untitled',
        batch: str(f.Batch),
        source: mapSource(w, f.Source),
        funnel: mapBriefFunnel(w, f.Funnel),
        type,
        priority: mapPriority(w, f.Priority, type),
        assignee: str(f.Assignee) ?? collaboratorName(f.Assignee),
        briefToDesign: str(f['Brief to Design'] ?? f['Brief to Design/Editing']),
        scriptContent: str(f['Script Content'] ?? f['Script / Ad Content']),
        adContent: str(f['Ad Content']),
        elementsTested: str(f['Elements we are Testing']),
        inspoLinks: strArr(f['Inspo Links']),
        dimensions: resolveDimensions(f.Dimensions),
        platform: mapPlatforms(w, f.Platform),
        designFileUrl: str(f['Design Link URL']),
        qaVideoEditor: bool(f['Video Editor QA']),
        qaDesigner: bool(f['Graphic Designer QA'] ?? f['Designer QA']),
        qaStrategist: bool(f['Creative Strategist QA'] ?? f['Strategist QA']),
        spellingFeedback: str(f['Spelling Feedback']),
        spellingFeedback2: str(f['Spelling Feedback 2']),
        clickForAiSpellChecker: bool(f['Click for AI Spell Checker Again']),
        inspirationImage: att(w, f.Inspiration),
        qaChecklistDoc: att(w, f['QA Checklist Doc']),
        designFile: att(w, f['Design File']),
        scriptAndBriefBreakdown: att(w, f['Script & brief breakdown ']),
        language: mapLanguage(w, f.Language),
        offer: str(f.Offer),
        internalStatus: mapStatus(
          w,
          'creativeBriefs.internalStatus',
          MAPS.briefInternal,
          f['Internal Status'],
        ),
        clientStatus: mapStatus(
          w,
          'creativeBriefs.clientStatus',
          MAPS.briefClient,
          f['Client Status'],
        ),
        performance: str(f.Performance),
      };
    },
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
      funnel: mapCopyFunnel(w, f.Funnel),
      used: bool(f.USED ?? f.Used),
      winning: bool(f.Winning),
      metaRating: num(f['Meta Rating']),
      clickForAiSpellChecker: bool(f['Click for AI Spell Checker Again']),
      spellingFeedback: str(f['Spelling Feedback']),
      status: mapStatus(w, 'copywriting.status', MAPS.copyStatus, f.Status),
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
      profilePicUrl: attFirst(w, f["Creator's Profile Pic"]) ?? str(f['Profile Pic URL']),
      videoIntroUrl: attFirst(w, f["Creator's video Intro"]) ?? str(f['Video Intro URL']),
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
      // Sprint 2026-09-29: the tracks were SWAPPED in the first import. UGC's 'Status' options are
      // exactly the creator CLIENT track's keys; 'Creator Status' is the operational internal one.
      clientStatus: mapStatus(
        w,
        'creators.clientStatus',
        MAPS.creatorClient,
        f.Status ?? f['Client Status'],
      ),
      internalCreatorStatus: mapStatus(
        w,
        'creators.internalCreatorStatus',
        MAPS.creatorInternal,
        f['Creator Status'] ?? f['Internal Creator Status'],
      ),
      internalAssetsStatus: normalizeStatusKey(f['Internal Assets Status']),
      clientNote: str(f["(Client's) Note or Comments"] ?? f['Client Note']),
      instagramUsername: str(f['Instagram Username']),
      forPartnershipAds: bool(f['For Partnership Ads']),
      partnershipActivity: mapStatus(
        w,
        'creators.partnershipActivity',
        MAPS.partnershipActivity,
        f['Partnership Activity'] ?? f['Partnership Status'],
      ),
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

  // Competitive research (Sprint 2026-09-29: previously "import manually")
  const { result: competitiveResult } = await importRows(
    db,
    competitiveResearch,
    data['Competitive research'] ?? [],
    (f) => ({
      brandId,
      name: str(f.Name) ?? 'Untitled',
      type: mapStatus(w, 'competitiveResearch.type', MAPS.competitiveType, f.Type),
      website: str(f.Website),
      instagram: str(f.Insta ?? f.Instagram),
      facebookPage: str(f['FB Page'] ?? f['Facebook Page']),
      metaAdsLibrary: str(f['Meta Ads Library']),
      analysis: str(f.Analysis),
    }),
    actorId,
  );
  results.competitiveResearch = competitiveResult;

  // Client Assets Organisation → client_asset_folders (TASK 1's table). The base's own link back
  // to Creative Design is a TEXT column, so no brief_asset_folders junction can be resolved from
  // record ids — folders import standalone and the dry run says so.
  const { result: folderResult } = await importRows(
    db,
    clientAssetFolders,
    data['Client Assets Organisation'] ?? [],
    (f) => ({
      brandId,
      name: str(f['Name [Folder]'] ?? f.Name) ?? 'Untitled',
      description: str(f.Description),
      locationUrl: str(f.Location ?? f['Location URL']),
    }),
    actorId,
  );
  results.clientAssetFolders = folderResult;
  if ((data['Client Assets Organisation'] ?? []).length > 0) {
    w.general.push(
      'Client Assets Organisation: the base links folders to Creative Design through a TEXT field, so no brief_asset_folders junction rows can be derived from this import.',
    );
  }

  // (Internal) Creative Dimensions → creative_dimensions (the names also resolve brief dimensions)
  const { result: dimensionResult } = await importRows(
    db,
    creativeDimensions,
    data['(Internal) Creative Dimensions'] ?? [],
    (f) => ({
      brandId,
      name: str(f.Name) ?? 'Untitled',
      dimensions: str(f.Dimensions),
      linkDescription: str(f['Link Description']),
    }),
    actorId,
  );
  results.creativeDimensions = dimensionResult;

  // ━━ Pass 2: Resolve cross-table FKs and junction tables ━━

  // Sprint 2026-09-29: junction sets for the records THIS import touches are rebuilt from scratch,
  // so wrong links from the first run (the mis-mapped creator↔concept pairings) do not survive a
  // re-import. Only rows whose owning record is in the import are cleared; hand-made links on
  // records outside the export are untouched. Junction rows carry no audit columns — the in-app
  // sync helpers hard-replace them the same way.
  const clear = async (
    junction:
      | typeof anglePersonas
      | typeof angleProducts
      | typeof conceptAngles
      | typeof conceptThemes
      | typeof conceptCollections
      | typeof creatorConcepts
      | typeof creatorProducts,
    column: AnyPgColumn,
    ids: IdMap,
  ) => {
    const values = [...ids.values()];
    if (values.length > 0) await db.delete(junction).where(inArray(column, values));
  };
  await clear(anglePersonas, anglePersonas.angleId, angleMap);
  await clear(angleProducts, angleProducts.angleId, angleMap);
  await clear(conceptAngles, conceptAngles.conceptId, conceptMap);
  await clear(conceptThemes, conceptThemes.conceptId, conceptMap);
  await clear(conceptCollections, conceptCollections.conceptId, conceptMap);
  await clear(creatorConcepts, creatorConcepts.creatorId, creatorMap);
  await clear(creatorProducts, creatorProducts.creatorId, creatorMap);

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

    const collectionIds = resolveRefs(
      collectionMap,
      rec.fields.Collection,
      w,
      'concepts.Collection',
    );
    for (const collectionId of collectionIds) {
      await db.insert(conceptCollections).values({ conceptId, collectionId }).onConflictDoNothing();
    }

    // Gratsi models the persona/product pairing ON THE CONCEPT ('Personas' and 'Product' record
    // links), while this schema inherits both through the angle. The angle-level links are
    // inferred here — concept's angles × concept's personas/products — so the app's inheritance
    // chain (concept → angle → persona/product) lights up. Deduped by the junction PK.
    const inferredPersonaIds = resolveRefs(
      personaMap,
      rec.fields.Personas ?? rec.fields.Persona,
      w,
      'concepts.Personas',
    );
    const inferredProductIds = resolveRefs(prodMap, rec.fields.Product, w, 'concepts.Product');
    for (const angleId of angleIds.length > 0 ? angleIds : []) {
      for (const personaId of inferredPersonaIds) {
        await db.insert(anglePersonas).values({ angleId, personaId }).onConflictDoNothing();
      }
      for (const productId of inferredProductIds) {
        await db.insert(angleProducts).values({ angleId, productId }).onConflictDoNothing();
      }
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
      w,
      "creators.'Concept to film'",
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
