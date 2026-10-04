import { eq, getTableColumns, inArray } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';

import type { Db } from './db';
import {
  BRIEF_CLIENT_STATUS_DEFAULT,
  BRIEF_INTERNAL_STATUS_DEFAULT,
  COPY_STATUS_DEFAULT,
  CREATOR_CLIENT_STATUS_DEFAULT,
  CREATOR_INTERNAL_STATUS_DEFAULT,
  PARTNERSHIP_ACTIVITY_DEFAULT,
} from './schema';
import {
  adMetrics,
  anglePersonas,
  angleProducts,
  angles,
  assets,
  campaignConcepts,
  campaignsOffers,
  clientAssetFolders,
  collections,
  competitiveResearch,
  competitorAds,
  conceptAngles,
  conceptCollections,
  conceptThemes,
  concepts,
  copyTypes,
  copywriting,
  copywritingCampaigns,
  copywritingCopyTypes,
  creativeBriefs,
  creativeDimensions,
  creativeModuleAngles,
  creativeModuleDesigns,
  creativeModules,
  creativeReporting,
  angleStatuses,
  creativeSheetInternalStatuses,
  creativeSheetItems,
  creativeSheetStatuses,
  creativeSheetWinning,
  creatorConcepts,
  creatorProducts,
  creatorRankings,
  creators,
  emailCampaignCampaigns,
  emailCampaignCollections,
  emailCampaignProducts,
  emailCampaigns,
  emailCampaignStatuses,
  emailCampaignTypes,
  emailChannels,
  emailFlowCampaigns,
  emailFlows,
  emailFlowStatuses,
  personas,
  products,
  smCampaignFeedTasks,
  smPlatforms,
  smTaskStatuses,
  themes,
  uploadLinks,
  youtubeCopy,
  youtubeCopyCampaigns,
  youtubeCopyCollections,
  youtubeCopyCopyTypes,
  youtubeCopyCtas,
  youtubeCopyFunnels,
  youtubeCopyProducts,
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
  /** Gratsi's "Meta Copywriting" → `copywriting`. */
  readonly Copywriting?: AirtableRecord[];
  /**
   * "Youtube Copywriting" → `youtube_copy`, ALWAYS (Prompt 3, 2026-10-01). It used to be a fallback
   * into `copywriting` when Meta was empty, which left rows from the two channels indistinguishable
   * (gap audit §2.12); the table now has its own home and its own junctions.
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
  /** Prompt 3 (2026-10-01): the remaining seven live Gratsi tables, each with a Drizzle home. */
  readonly 'Creative Sheet'?: AirtableRecord[];
  readonly '(Internal) Creative Modules'?: AirtableRecord[];
  readonly 'SM Campaign Management Feed'?: AirtableRecord[];
  readonly 'Email Campaigns Management'?: AirtableRecord[];
  readonly 'Email Flows Management'?: AirtableRecord[];
  readonly '(Internal) Copy Type'?: AirtableRecord[];
  readonly 'Creative Reporting'?: AirtableRecord[];
}

export interface TableResult {
  /** Records the export carried for this table — what "would write" is measured against. */
  records: number;
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
  /**
   * export key → (field name → records carrying it) for every field present in the export that NO
   * mapper or pass-2 step read. Lookups, formulas and system fields land here by design: the list
   * is the honest statement of what the import leaves behind (Prompt 3, 2026-10-01).
   */
  unmappedFields: Map<string, Map<string, number>>;
  attachmentsCaptured: number;
  general: string[];
}

export function emptyWarnings(): ImportWarnings {
  return {
    unmappedValues: new Map(),
    brokenRefs: new Map(),
    unmappedFields: new Map(),
    attachmentsCaptured: 0,
    general: [],
  };
}

/** Which field names a table's records carry (with counts) and which the engine actually read. */
interface FieldTracker {
  readonly present: Map<string, number>;
  readonly read: Set<string>;
}

/**
 * Wraps every record's `fields` in a Proxy that notes each key the engine reads — in a mapper or a
 * pass-2 step alike — so the end of the run can list, per table, the fields nobody read. Reads pass
 * straight through; nothing about the values changes.
 */
function trackExport(data: AirtableExport): {
  data: AirtableExport;
  trackers: Map<string, FieldTracker>;
} {
  const trackers = new Map<string, FieldTracker>();
  const tracked: Record<string, AirtableRecord[]> = {};
  // `Object.entries` on an interface is `[string, any][]`; every value of AirtableExport is an
  // optional record array, and the `Array.isArray` guard below still stands for a hand-made file.
  const entries = Object.entries(data) as [string, AirtableRecord[] | undefined][];
  for (const [table, records] of entries) {
    if (!Array.isArray(records)) continue;
    const tracker: FieldTracker = { present: new Map(), read: new Set() };
    trackers.set(table, tracker);
    tracked[table] = records.map((rec) => {
      for (const key of Object.keys(rec.fields)) {
        tracker.present.set(key, (tracker.present.get(key) ?? 0) + 1);
      }
      const fields = new Proxy(rec.fields, {
        get(target, prop) {
          if (typeof prop === 'string') tracker.read.add(prop);
          return Reflect.get(target, prop) as unknown;
        },
      });
      return { id: rec.id, fields };
    });
  }
  return { data: tracked, trackers };
}

function collectUnmappedFields(w: ImportWarnings, trackers: Map<string, FieldTracker>): void {
  for (const [table, tracker] of trackers) {
    const missing = new Map<string, number>();
    for (const [field, n] of tracker.present) {
      if (!tracker.read.has(field)) missing.set(field, n);
    }
    if (missing.size > 0) w.unmappedFields.set(table, missing);
  }
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

/** An Airtable rating (1–5) into an integer column. */
function ratingInt(v: unknown): number | undefined {
  if (typeof v === 'number') return Math.round(v);
  return undefined;
}

/** currency / percent / number into a `numeric` column: drizzle takes the decimal as a string. */
function numStr(v: unknown): string | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
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

type Vocabulary = readonly { readonly key: string; readonly label: string }[];

/**
 * A map for the 2026-10-01 vocabularies in `schema/enums.ts`, whose keys ARE the normalized labels
 * pulled from the live base: both the key and the normalized label hit, anything else misses and
 * surfaces in the dry run like every other map.
 */
function vocabularyMap(vocabulary: Vocabulary): StatusMap {
  const map: StatusMap = {};
  for (const { key, label } of vocabulary) {
    map[key] = key;
    const normalized = normalizeStatusKey(label);
    if (normalized !== undefined) map[normalized] = key;
  }
  return map;
}

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
  // Prompt 3 (2026-10-01): the seven new tables' selects, keyed by the enums.ts vocabularies.
  // Creative Design.'Performance' → creativePerformances. The live options carry a parenthetical
  // ("Winning (ROAS/CPA Goal)"); the column holds the bare grade the UI's Select offers.
  performance: {
    winning_roas_cpa_goal: 'Winning',
    high_potential_to_iterate_good_ctrs_thumbstops_etc: 'High Potential to Iterate',
    losing_bad_all_metrics: 'Losing',
    winning: 'Winning',
    high_potential_to_iterate: 'High Potential to Iterate',
    losing: 'Losing',
  },
  // Angles.'Status' → angleStatuses (the approval track; Potential/Winning are separate columns).
  angleStatus: vocabularyMap(angleStatuses),
  creativeSheetInternal: vocabularyMap(creativeSheetInternalStatuses),
  creativeSheetStatus: vocabularyMap(creativeSheetStatuses),
  creativeSheetWinning: vocabularyMap(creativeSheetWinning),
  smPlatform: vocabularyMap(smPlatforms),
  smTaskStatus: vocabularyMap(smTaskStatuses),
  emailCampaignStatus: vocabularyMap(emailCampaignStatuses),
  emailCampaignType: vocabularyMap(emailCampaignTypes),
  emailChannel: vocabularyMap(emailChannels),
  emailFlowStatus: vocabularyMap(emailFlowStatuses),
  youtubeFunnel: vocabularyMap(youtubeCopyFunnels),
  youtubeCta: vocabularyMap(youtubeCopyCtas),
} satisfies Record<string, StatusMap>;

/**
 * Applies one map: exact hit → key, miss → normalized key + warning, null hit → `fallback` +
 * warning, absent → `fallback`. The fallback is an EXPLICIT value (the column's default for a
 * NOT NULL column, NULL otherwise), never `undefined`: on the upsert's UPDATE path drizzle drops
 * undefined keys from SET, which is exactly how the first re-import left stale keys behind.
 */
function mapStatus(
  w: ImportWarnings,
  where: string,
  map: StatusMap,
  v: unknown,
  fallback: string | null = null,
): string | null {
  const normalized = normalizeStatusKey(v);
  if (normalized === undefined) return fallback;
  const mapped = map[normalized];
  if (mapped === null) {
    warnValue(w, `${where} (deliberately unmapped)`, String(v));
    return fallback;
  }
  if (mapped !== undefined) return mapped;
  warnValue(w, where, String(v));
  return normalized;
}

/** A grade outside the three-word vocabulary is reported and stored as NULL, never as free text. */
function mapPerformance(w: ImportWarnings, v: unknown): string | null {
  const normalized = normalizeStatusKey(v);
  if (normalized === undefined) return null;
  const mapped = (MAPS.performance as StatusMap)[normalized];
  if (typeof mapped === 'string') return mapped;
  warnValue(w, 'creativeBriefs.performance (stored as NULL)', String(v));
  return null;
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
  return 'Video'; // the column default, written explicitly so an UPDATE clears junk
}

function mapPriority(
  w: ImportWarnings,
  v: unknown,
  type: string | undefined,
): string | null | undefined {
  const s = str(v);
  if (s === undefined) return undefined;
  const isStatic = type === 'Static' || type === 'Carousel';
  if (/high/i.test(s)) return isStatic ? 'Static High' : 'Video High';
  if (/average/i.test(s)) return isStatic ? 'Static Average' : 'Video Average';
  warnValue(w, 'creativeBriefs.priority', s);
  return null;
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

function mapLanguage(w: ImportWarnings, v: unknown): string | null | undefined {
  const s = str(v);
  if (s === undefined) return undefined;
  if (/^english/i.test(s)) return 'English';
  warnValue(w, 'creativeBriefs.language', s);
  return null;
}

function mapSource(w: ImportWarnings, v: unknown): string | undefined {
  const s = str(v);
  if (s === undefined) return undefined;
  if (s === 'TAS' || s === 'Client') return s;
  warnValue(w, 'creativeBriefs.source', s);
  return 'TAS'; // the column default, written explicitly so an UPDATE clears junk
}

function mapBriefFunnel(w: ImportWarnings, v: unknown): string | undefined {
  const s = str(v);
  if (s === undefined) return undefined;
  if (s === 'TOF' || s === 'RETARGETTING' || s === 'ALL FUNNELS') return s;
  warnValue(w, 'creativeBriefs.funnel', s);
  return 'TOF'; // the column default, written explicitly so an UPDATE clears junk
}

function mapCopyFunnel(w: ImportWarnings, v: unknown): string | null | undefined {
  const s = str(v);
  if (s === undefined) return undefined;
  if (s === 'TOF' || s === 'MOF' || s === 'BOF') return s;
  if (/^retarget/i.test(s)) return 'Retargeting';
  warnValue(w, 'copywriting.funnel', s);
  return null;
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
  const result: TableResult = {
    records: records.length,
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };
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
          // A field absent in Airtable is a cleared value: write NULL to nullable columns so the
          // row follows the base. NOT NULL columns keep their value (the mappers hand those their
          // column default explicitly instead of undefined).
          const columns = getTableColumns(table);
          const patch: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(mapped)) {
            const column = columns[key];
            if (value === undefined) {
              if (column !== undefined && !column.notNull) patch[key] = null;
            } else {
              patch[key] = value;
            }
          }
          await sp
            .update(table)
            .set({ ...patch, updatedBy: actorId, updatedAt: new Date() })
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

/**
 * PER-BASE FIELD NAMES, one entry per Drizzle column: the TEMPLATE base's field name first, then
 * each client base's alias for the same datum. `appnaSGAgOUbJ0f9m` is the source of truth (Talal,
 * 2026-10-02), so a template import needs no alias; a client base that renamed a field is read
 * through its alias into the same column, which is what makes one importer serve every brand.
 *
 * Verified field by field against both bases' live metadata on 2026-10-02 — the template's names
 * carry their framework in parentheses ("Core Desires (Cashvertising)") and Gratsi's do not, so a
 * short-name read like `f['Core Desires']` silently missed ELEVEN of the fifteen template fields.
 * The audit is docs/audits/base-field-mapping-2026-10-02.md.
 *
 * Gratsi's "Passion" is deliberately absent: it has no template equivalent, and the rule is a
 * decision doc rather than a forced mapping (docs/decisions/gratsi-unmapped-fields-2026-10-02.md).
 */
const PERSONA_FIELDS = {
  name: ['Persona Name', 'Name'],
  dayInTheLife: ['A Day in the Life'],
  demographic: ['Demographic', 'Description  [Age Status Salary]'],
  psychographic: ['Psychographic', 'Personality'],
  coreDesires: ['Core Desires (Cashvertising)', 'Core Desires', 'Drivers for this persona'],
  // Gratsi's own field, and its own column since migration 0044 — never folded into a neighbour.
  passion: ['Passion'],
  emotionalTriggers: ['Emotional Triggers (Cashvertising)', 'Emotional Triggers'],
  painPoints: ['Pain Points (Cashvertising)', 'Pain Points'],
  successFactors: ['Success Factors (Buyer Personas)', 'Success Factors'],
  perceivedBarriers: ['Perceived Barriers (Buyer Personas)', 'Perceived Barriers'],
  buyingTriggers: ['Buying Triggers (Breakthrough Advertising)', 'Buying Triggers'],
  problemChallenge: ['Problem/Challenge (StoryBrand)', 'Problem Challenge'],
  successTransformation: ['Success/Transformation (StoryBrand)', 'Success Transformation'],
  triggerWords: ['Trigger Words (Mindstates)', 'Trigger Words'],
  stageOfAwareness: [
    'Stage of Market Awareness (Breakthrough Advertising)',
    'Problem-Solution Awareness Level',
    'Stage of Awareness',
  ],
} as const satisfies Record<string, readonly string[]>;

/**
 * The concept's two LINK fields, per base, in the same shape as `PERSONA_FIELDS` above: the TEMPLATE
 * base's field name first, then each client base's alias for the same link.
 *
 * The template base (`appnaSGAgOUbJ0f9m`) names them `Angles` and `Themes`; Gratsi
 * (`appllDG4OmkK2Hdnn`) names them `Angle` and `Theme`. Both read live off the meta API on
 * 2026-10-04. Pass 2 read only the singular names, so a TEMPLATE import wrote zero `concept_angles`
 * and zero `concept_themes` — every concept's Angle and Theme cell an em dash, with nothing in the
 * log to say why, because the plural field was never asked for and a field nobody asks for cannot
 * fail to resolve. One alias list per link is what makes one importer serve either base, exactly as
 * it does for the fifteen persona fields.
 */
const CONCEPT_LINK_FIELDS = {
  angles: ['Angles', 'Angle'],
  themes: ['Themes', 'Theme'],
} as const satisfies Record<string, readonly string[]>;

/** The first of `names` the record actually carries, so one builder reads either base. */
export function normalizeFieldName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * The first of `names` the record carries: by exact name if any alias matches one, and otherwise
 * case-insensitively and with whitespace normalised.
 *
 * An exact match wins over a normalised one even when it is further down the alias list, which is
 * the stronger evidence of the two — and it lets the common case answer without enumerating the
 * record, which the comments in the body explain matters for the import's own reporting.
 */
export function firstField(
  fields: Readonly<Record<string, unknown>>,
  names: readonly string[],
): unknown {
  const present = (value: unknown): boolean =>
    value !== undefined && value !== null && value !== '';

  // EXACT NAMES FIRST, one property read each. Every alias in this file was taken from a live base's
  // metadata, so this is the branch that answers in practice — and it is the only branch that does
  // not ENUMERATE the record. Enumeration matters because `trackExport` wraps every record's fields
  // in a Proxy that counts each key read: a scan would mark every field of the table as read and the
  // "fields no mapper touched" report, which is the import's honest statement of what it leaves
  // behind, would come back empty for the table.
  for (const name of names) {
    if (present(fields[name])) return fields[name];
  }

  // Nothing under an exact name. Fall back to a case- and whitespace-insensitive match, because the
  // parent spells it `Creator's Video Intro` and Gratsi spells it `Creator's video Intro` — one
  // capital letter, the same field, verified against both live bases on 2026-10-03 — and the same
  // class of difference hides behind Gratsi's double space in `Description  [Age Status Salary]`.
  const byNormalized = new Map<string, unknown>();
  for (const [key, value] of Object.entries(fields)) {
    const normalized = normalizeFieldName(key);
    // First writer wins, so an exact match is never shadowed by a later near-duplicate.
    if (!byNormalized.has(normalized)) byNormalized.set(normalized, value);
  }
  for (const name of names) {
    const value = byNormalized.get(normalizeFieldName(name));
    if (present(value)) return value;
  }
  return undefined;
}

/** Junction rows for one owner, deduped by the junction's primary key; a broken target is skipped. */
async function linkMany<T extends PgTable>(
  db: Db,
  junction: T,
  rows: readonly T['$inferInsert'][],
): Promise<void> {
  if (rows.length === 0) return;
  await db
    .insert(junction)
    .values(rows as never[])
    .onConflictDoNothing();
}

// ── Main import function ──

export async function importAirtableExport(
  db: Db,
  rawData: AirtableExport,
  brandId: string,
  actorId: string,
  warnings: ImportWarnings = emptyWarnings(),
): Promise<Record<string, TableResult>> {
  const results: Record<string, TableResult> = {};
  const w = warnings;
  const { data, trackers } = trackExport(rawData);

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
      promotionalIdeas: str(f['Promotional Ideas']),
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
      name: str(firstField(f, PERSONA_FIELDS.name)) ?? 'Untitled',
      productId: firstRef(prodMap, f.Product),
      dayInTheLife: str(firstField(f, PERSONA_FIELDS.dayInTheLife)),
      demographic: str(firstField(f, PERSONA_FIELDS.demographic)),
      psychographic: str(firstField(f, PERSONA_FIELDS.psychographic)),
      coreDesires: str(firstField(f, PERSONA_FIELDS.coreDesires)),
      passion: str(firstField(f, PERSONA_FIELDS.passion)),
      emotionalTriggers: str(firstField(f, PERSONA_FIELDS.emotionalTriggers)),
      painPoints: str(firstField(f, PERSONA_FIELDS.painPoints)),
      successFactors: str(firstField(f, PERSONA_FIELDS.successFactors)),
      perceivedBarriers: str(firstField(f, PERSONA_FIELDS.perceivedBarriers)),
      stageOfAwareness: mapStatus(
        w,
        'personas.stageOfAwareness',
        MAPS.awareness,
        firstField(f, PERSONA_FIELDS.stageOfAwareness),
      ),
      buyingTriggers: str(firstField(f, PERSONA_FIELDS.buyingTriggers)),
      problemChallenge: str(firstField(f, PERSONA_FIELDS.problemChallenge)),
      successTransformation: str(firstField(f, PERSONA_FIELDS.successTransformation)),
      triggerWords: str(firstField(f, PERSONA_FIELDS.triggerWords)),
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
      status: mapStatus(w, 'angles.status', MAPS.angleStatus, f.Status),
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
      // 'Decription' is the live base's own spelling of the field.
      description: str(f.Decription ?? f.Description),
      painPoints: str(f['Pain Points']),
      usp: str(f.USP),
      clientComments: str(f["Client's Comments"]),
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
      creativeDesignNote: str(f['Creative Design'] ?? f['(Internal) Creative Design 2']),
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
          BRIEF_INTERNAL_STATUS_DEFAULT,
        ),
        clientStatus: mapStatus(
          w,
          'creativeBriefs.clientStatus',
          MAPS.briefClient,
          f['Client Status'],
          BRIEF_CLIENT_STATUS_DEFAULT,
        ),
        performance: mapPerformance(w, f.Performance),
      };
    },
    actorId,
  );
  results.creativeBriefs = briefResult;

  // Meta Copywriting → copywriting. Youtube Copywriting has its own table below (Prompt 3); it is
  // no longer a fallback source for this one.
  const copyRecords = data.Copywriting ?? [];

  const { result: copyResult, idMap: copyMap } = await importRows(
    db,
    copywriting,
    copyRecords,
    (f) => ({
      brandId,
      copyNumber: copyNumberFromText(f['Copy Number'] ?? f['Copy #']),
      primaryCopy: str(f['Primary Copy'] ?? f.Descriptions),
      headline: str(f.Headline),
      linkDescription: str(f['Link Description'] ?? f['News Feed']),
      cta: str(f.CTA),
      funnel: mapCopyFunnel(w, f.Funnel),
      used: bool(f.USED ?? f.Used),
      winning: bool(f.Winning),
      metaRating: num(f['Meta Rating']),
      clickForAiSpellChecker: bool(f['Click for AI Spell Checker Again']),
      spellingFeedback: str(f['Spelling Feedback']),
      status: mapStatus(w, 'copywriting.status', MAPS.copyStatus, f.Status, COPY_STATUS_DEFAULT),
      clientComment: str(f["Client's Comment"] ?? f['Client Comment']),
    }),
    actorId,
  );
  results.copywriting = copyResult;

  // (Internal) Copy Type → copy_types. Its two record links are the inverse sides of the copy
  // tables' "Copy Type" fields and are written from the copy side in pass 2.
  const { result: copyTypeResult, idMap: copyTypeMap } = await importRows(
    db,
    copyTypes,
    data['(Internal) Copy Type'] ?? [],
    (f) => ({
      brandId,
      name: str(f.Name) ?? 'Untitled',
      description: str(f.Description),
    }),
    actorId,
  );
  results.copyTypes = copyTypeResult;

  // Youtube Copywriting → youtube_copy, always. CTA and Funnel store the enums.ts KEYS (the
  // YouTube funnel vocabulary is wider than Meta's), the status the COPY_STATUS key.
  const { result: youtubeResult, idMap: youtubeMap } = await importRows(
    db,
    youtubeCopy,
    data['Youtube Copywriting'] ?? [],
    (f) => ({
      brandId,
      copyNumber: copyNumberFromText(f['Copy #']),
      status: mapStatus(w, 'youtubeCopy.status', MAPS.copyStatus, f.Status, COPY_STATUS_DEFAULT),
      angle: str(f.Angle),
      descriptions: str(f['Descriptions (90 caractères max)']),
      headline: str(f.Headline),
      newsFeed: str(f['News Feed']),
      cta: mapStatus(w, 'youtubeCopy.cta', MAPS.youtubeCta, f.CTA),
      funnel: mapStatus(w, 'youtubeCopy.funnel', MAPS.youtubeFunnel, f.Funnel),
      clientComment: str(f["Client's Comment"]),
      used: bool(f.USED),
      winning: bool(f.Winning),
      metaRating: ratingInt(f['Meta Rating']),
    }),
    actorId,
  );
  results.youtubeCopy = youtubeResult;

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
        CREATOR_CLIENT_STATUS_DEFAULT,
      ),
      internalCreatorStatus: mapStatus(
        w,
        'creators.internalCreatorStatus',
        MAPS.creatorInternal,
        f['Creator Status'] ?? f['Internal Creator Status'],
        CREATOR_INTERNAL_STATUS_DEFAULT,
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
        PARTNERSHIP_ACTIVITY_DEFAULT,
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
      paymentDate: dateToTimestamp(f['Payment Date']),
      creatorInfoRequest: str(f['Creator Info Request']),
      // The live field name carries a trailing space.
      slackNotified: bool(f['Slack Notified '] ?? f['Slack Notified']),
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

  // ── Prompt 3 (2026-10-01): the seven tables that had no Drizzle home ──

  // (Internal) Creative Modules → creative_modules; its two links are junctions in pass 2.
  const { result: moduleResult, idMap: moduleMap } = await importRows(
    db,
    creativeModules,
    data['(Internal) Creative Modules'] ?? [],
    (f) => ({
      brandId,
      moduleName: str(f['Module Name']) ?? 'Untitled',
      foreplayLink: str(f['Foreplay Link']),
    }),
    actorId,
  );
  results.creativeModules = moduleResult;

  // Creative Sheet → creative_sheet_items. The row's brief is the first "Creative Name" link,
  // nullable by design (schema/creative-sheet-items.ts); the 16 lookups through that link are
  // joins, never columns, so they surface in the unmapped-field report on purpose.
  const { result: sheetResult } = await importRows(
    db,
    creativeSheetItems,
    data['Creative Sheet'] ?? [],
    (f) => ({
      brandId,
      briefId: resolveRefs(
        briefMap,
        f['Creative Name'],
        w,
        "creativeSheetItems.'Creative Name'",
      )[0],
      internalStatus: mapStatus(
        w,
        'creativeSheetItems.internalStatus',
        MAPS.creativeSheetInternal,
        f['Internal Status'],
      ),
      status: mapStatus(w, 'creativeSheetItems.status', MAPS.creativeSheetStatus, f.Status),
      qaChecklistDoc: att(w, f['QA Checklist Doc']),
      qaVideoEditor: bool(f['Video Editor QA']),
      qaDesigner: bool(f['Graphic Designer QA']),
      qaStrategist: bool(f['Creative Strategist QA']),
      clientComments: str(f["Client's Comments"]),
      used: bool(f.Used),
      deniedRevisionsNeeded: bool(f['Denied/revisions needed']),
      winning: mapStatus(w, 'creativeSheetItems.winning', MAPS.creativeSheetWinning, f.Winning),
      spellCheckRequested: bool(f['Click for AI Spell Checker Again']),
      spellingFeedback: str(f['Spelling Feedback']),
    }),
    actorId,
  );
  results.creativeSheetItems = sheetResult;

  // SM Campaign Management Feed → sm_campaign_feed_tasks ("Reminder Trigger" is a clock formula).
  const { result: smResult } = await importRows(
    db,
    smCampaignFeedTasks,
    data['SM Campaign Management Feed'] ?? [],
    (f) => ({
      brandId,
      taskName: str(f['Task Name']) ?? 'Untitled',
      platform: mapStatus(w, 'smCampaignFeedTasks.platform', MAPS.smPlatform, f.Platform),
      dueDate: dateToTimestamp(f['Due Date']),
      status: mapStatus(w, 'smCampaignFeedTasks.status', MAPS.smTaskStatus, f.Status),
      notes: str(f.Notes),
    }),
    actorId,
  );
  results.smCampaignFeedTasks = smResult;

  // Email Campaigns Management → email_campaigns; the two due dates are formulas off Send Date.
  const { result: emailCampaignResult, idMap: emailCampaignMap } = await importRows(
    db,
    emailCampaigns,
    data['Email Campaigns Management'] ?? [],
    (f) => ({
      brandId,
      name: str(f.Name) ?? 'Untitled',
      campaignPurpose: str(f['Campaign Purpose']),
      status: mapStatus(w, 'emailCampaigns.status', MAPS.emailCampaignStatus, f.Status),
      sendDate: str(f['Send Date']),
      copywriting: str(f.Copywriting),
      assigneeId: collaboratorName(f.Assignee),
      copyLink: str(f['Copy Link']),
      design: att(w, f.Design),
      klaviyoLink: str(f['Klaviyo Link']),
      assets: att(w, f.Assets),
      type: mapStatus(w, 'emailCampaigns.type', MAPS.emailCampaignType, f.Type),
      channel: mapStatus(w, 'emailCampaigns.channel', MAPS.emailChannel, f.Channel),
    }),
    actorId,
  );
  results.emailCampaigns = emailCampaignResult;

  // Email Flows Management → email_flows; "Type" shares the campaigns' channel vocabulary.
  const { result: emailFlowResult, idMap: emailFlowMap } = await importRows(
    db,
    emailFlows,
    data['Email Flows Management'] ?? [],
    (f) => ({
      brandId,
      flowName: str(f['Flow Name']) ?? 'Untitled',
      expectedSetupDate: str(f['Expected Setup Date']),
      flowPurpose: str(f['Flow Purpose']),
      status: mapStatus(w, 'emailFlows.status', MAPS.emailFlowStatus, f.Status),
      copywriting: str(f.Copywriting),
      design: att(w, f.Design),
      klaviyoLink: str(f['Klaviyo Link']),
      type: mapStatus(w, 'emailFlows.type', MAPS.emailChannel, f.Type),
      inspo: att(w, f.Inspo),
      assigneeId: collaboratorName(f.Assignee),
    }),
    actorId,
  );
  results.emailFlows = emailFlowResult;

  // Creative Reporting → creative_reporting. `brief_id` has NO live Airtable link (the base's
  // "Creative Name (from Creative)" lookup is orphaned), so the mapper never touches it: a fresh
  // row lands with it NULL and a value the platform set later survives a re-import.
  const { result: reportingResult } = await importRows(
    db,
    creativeReporting,
    data['Creative Reporting'] ?? [],
    (f) => ({
      brandId,
      nameAngleOffer: str(f['Name + Angle + Offer']) ?? 'Untitled',
      notes: str(f.Notes),
      adDesign: att(w, f['Ad Design']),
      adLink: str(f['Ad Link']),
      ctr: numStr(f.CTR),
      thumbStopRate: numStr(f['Thumb-Stop Rate']),
      results: numStr(f.Results),
      cpa: numStr(f.CPA),
      targetCpa: numStr(f['Target CPA']),
      roas: numStr(f.ROAS),
      targetRoas: numStr(f['Target ROAS']),
    }),
    actorId,
  );
  results.creativeReporting = reportingResult;

  // ━━ Pass 2: Resolve cross-table FKs and junction tables ━━

  // Sprint 2026-09-29: junction sets for the records THIS import touches are rebuilt from scratch,
  // so wrong links from the first run (the mis-mapped creator↔concept pairings) do not survive a
  // re-import. Only rows whose owning record is in the import are cleared; hand-made links on
  // records outside the export are untouched. Junction rows carry no audit columns — the in-app
  // sync helpers hard-replace them the same way.
  const clear = async (junction: PgTable, column: AnyPgColumn, ids: IdMap) => {
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
  // Prompt 3 junctions, owned by the side that carries the link in Airtable.
  await clear(creativeModuleAngles, creativeModuleAngles.moduleId, moduleMap);
  await clear(creativeModuleDesigns, creativeModuleDesigns.moduleId, moduleMap);
  await clear(youtubeCopyCollections, youtubeCopyCollections.youtubeCopyId, youtubeMap);
  await clear(youtubeCopyProducts, youtubeCopyProducts.youtubeCopyId, youtubeMap);
  await clear(youtubeCopyCampaigns, youtubeCopyCampaigns.youtubeCopyId, youtubeMap);
  await clear(youtubeCopyCopyTypes, youtubeCopyCopyTypes.youtubeCopyId, youtubeMap);
  await clear(copywritingCopyTypes, copywritingCopyTypes.copyId, copyMap);
  await clear(copywritingCampaigns, copywritingCampaigns.copyId, copyMap);
  await clear(campaignConcepts, campaignConcepts.campaignOfferId, campaignMap);
  await clear(emailCampaignCampaigns, emailCampaignCampaigns.emailCampaignId, emailCampaignMap);
  await clear(emailCampaignProducts, emailCampaignProducts.emailCampaignId, emailCampaignMap);
  await clear(emailCampaignCollections, emailCampaignCollections.emailCampaignId, emailCampaignMap);
  await clear(emailFlowCampaigns, emailFlowCampaigns.emailFlowId, emailFlowMap);

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

    // Read ONCE, under either base's name for the link, and reused by every branch below: a
    // second read of a different property is how the plural name got missed in the first place.
    const angleRef = firstField(rec.fields, CONCEPT_LINK_FIELDS.angles);
    const angleIds = resolveRefs(angleMap, angleRef, w, 'concepts.Angles');
    for (const angleId of angleIds) {
      await db.insert(conceptAngles).values({ conceptId, angleId }).onConflictDoNothing();
    }
    if (angleIds.length === 0) {
      const angleId = resolveRef(angleMap, angleRef);
      if (angleId) {
        await db.insert(conceptAngles).values({ conceptId, angleId }).onConflictDoNothing();
      }
    }

    // Theme can be record links (standard Airtable) or multipleSelects (Gratsi) — try both
    const themeRef = firstField(rec.fields, CONCEPT_LINK_FIELDS.themes);
    const themeRefsResolved = resolveRefs(themeMap, themeRef, w, 'concepts.Themes');
    if (themeRefsResolved.length > 0) {
      for (const themeId of themeRefsResolved) {
        await db.insert(conceptThemes).values({ conceptId, themeId }).onConflictDoNothing();
      }
    } else {
      const singleThemeId = resolveRef(themeMap, themeRef);
      if (singleThemeId) {
        await db
          .insert(conceptThemes)
          .values({ conceptId, themeId: singleThemeId })
          .onConflictDoNothing();
      } else {
        const themeNames = multiSelectArr(themeRef);
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
    // Gratsi's 'Ads Copywriting copy' links Meta Copywriting (its 'Copywriting' links YouTube, a
    // junction written from that side); the template base named the Meta link 'Copywriting'.
    const copywritingId = firstRef(
      copyMap,
      rec.fields['Ads Copywriting copy'] ?? rec.fields.Copywriting,
    );
    if (campaignId || angleId || productId || copywritingId) {
      await db
        .update(collections)
        .set({
          ...(campaignId ? { campaignId } : {}),
          ...(angleId ? { angleId } : {}),
          ...(productId ? { productId } : {}),
          ...(copywritingId ? { copywritingId } : {}),
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

  // Meta Copywriting → creativeBriefId + conceptId + productId FKs, then its two junctions:
  // "Copy Type" → copywriting_copy_types and "Campaign Code" → copywriting_campaigns.
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
    await linkMany(
      db,
      copywritingCopyTypes,
      resolveRefs(copyTypeMap, f['Copy Type'], w, "copywriting.'Copy Type'").map((copyTypeId) => ({
        copyId,
        copyTypeId,
      })),
    );
    await linkMany(
      db,
      copywritingCampaigns,
      resolveRefs(campaignMap, f['Campaign Code'], w, "copywriting.'Campaign Code'").map(
        (campaignOfferId) => ({ copyId, campaignOfferId }),
      ),
    );
  }

  // Youtube Copywriting → its four junctions (Collections, Product, Campaign Code, Copy Type).
  for (const rec of data['Youtube Copywriting'] ?? []) {
    const youtubeCopyId = youtubeMap.get(rec.id);
    if (!youtubeCopyId) continue;
    const f = rec.fields;
    await linkMany(
      db,
      youtubeCopyCollections,
      resolveRefs(collectionMap, f.Collections, w, 'youtubeCopy.Collections').map(
        (collectionId) => ({ youtubeCopyId, collectionId }),
      ),
    );
    await linkMany(
      db,
      youtubeCopyProducts,
      resolveRefs(prodMap, f.Product, w, 'youtubeCopy.Product').map((productId) => ({
        youtubeCopyId,
        productId,
      })),
    );
    await linkMany(
      db,
      youtubeCopyCampaigns,
      resolveRefs(campaignMap, f['Campaign Code'], w, "youtubeCopy.'Campaign Code'").map(
        (campaignOfferId) => ({ youtubeCopyId, campaignOfferId }),
      ),
    );
    await linkMany(
      db,
      youtubeCopyCopyTypes,
      resolveRefs(copyTypeMap, f['Copy Type'], w, "youtubeCopy.'Copy Type'").map((copyTypeId) => ({
        youtubeCopyId,
        copyTypeId,
      })),
    );
  }

  // (Internal) Creative Modules → creative_module_angles ("Concepts" links the ANGLES table in the
  // Gratsi base despite its name — schema/creative-modules.ts) + creative_module_designs.
  for (const rec of data['(Internal) Creative Modules'] ?? []) {
    const moduleId = moduleMap.get(rec.id);
    if (!moduleId) continue;
    const f = rec.fields;
    await linkMany(
      db,
      creativeModuleAngles,
      resolveRefs(angleMap, f.Concepts, w, 'creativeModules.Concepts').map((angleId) => ({
        moduleId,
        angleId,
      })),
    );
    await linkMany(
      db,
      creativeModuleDesigns,
      resolveRefs(
        briefMap,
        f['(Internal) Creative Design'],
        w,
        "creativeModules.'(Internal) Creative Design'",
      ).map((briefId) => ({ moduleId, briefId })),
    );
  }

  // Campaigns & Offers → campaign_concepts ("Angles" links the CONCEPTS table despite its name —
  // schema/campaign-links.ts).
  for (const rec of data['Campaigns & Offers'] ?? []) {
    const campaignOfferId = campaignMap.get(rec.id);
    if (!campaignOfferId) continue;
    await linkMany(
      db,
      campaignConcepts,
      resolveRefs(conceptMap, rec.fields.Angles, w, 'campaignsOffers.Angles').map((conceptId) => ({
        campaignOfferId,
        conceptId,
      })),
    );
  }

  // Email Campaigns Management → its three junctions.
  for (const rec of data['Email Campaigns Management'] ?? []) {
    const emailCampaignId = emailCampaignMap.get(rec.id);
    if (!emailCampaignId) continue;
    const f = rec.fields;
    await linkMany(
      db,
      emailCampaignCampaigns,
      resolveRefs(
        campaignMap,
        f['Campaigns & Offers'],
        w,
        "emailCampaigns.'Campaigns & Offers'",
      ).map((campaignOfferId) => ({ emailCampaignId, campaignOfferId })),
    );
    await linkMany(
      db,
      emailCampaignProducts,
      resolveRefs(prodMap, f['(Internal) Product'], w, "emailCampaigns.'(Internal) Product'").map(
        (productId) => ({ emailCampaignId, productId }),
      ),
    );
    await linkMany(
      db,
      emailCampaignCollections,
      resolveRefs(
        collectionMap,
        f['(Internal) Collections'],
        w,
        "emailCampaigns.'(Internal) Collections'",
      ).map((collectionId) => ({ emailCampaignId, collectionId })),
    );
  }

  // Email Flows Management → email_flow_campaigns.
  for (const rec of data['Email Flows Management'] ?? []) {
    const emailFlowId = emailFlowMap.get(rec.id);
    if (!emailFlowId) continue;
    await linkMany(
      db,
      emailFlowCampaigns,
      resolveRefs(
        campaignMap,
        rec.fields['Campaigns & Offers'],
        w,
        "emailFlows.'Campaigns & Offers'",
      ).map((campaignOfferId) => ({ emailFlowId, campaignOfferId })),
    );
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

  collectUnmappedFields(w, trackers);
  return results;
}
