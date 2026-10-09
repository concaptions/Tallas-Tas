import type { BriefListRow, Db } from '@tas/db';
import { demoBriefs, demoConcepts, demoCopy, demoCreators, listBrandsForActor } from '@tas/db';
import type { BrandRole } from '@tas/domain';
import { BRAND_ROLE_LABELS, computePipelineSummary, type PipelineSummary } from '@tas/domain';
import {
  INTERNAL_STATIC_STATUS,
  INTERNAL_VIDEO_STATUS,
  type ClientStatusKey,
  type InternalStatusKey,
} from '@tas/domain/state';
import { serverEnv } from '@tas/env';

import { loadBriefs, type BriefSourceDeps, type DbConnection } from './briefs-source';
import { loadConcepts } from './concepts-source';
import { loadCopy } from './copy-source';
import { loadCreativeSheetItems } from './creative-sheet-source';
import { clerkActorScope, inDemoMode, loadBrandScope } from './data-source';
import {
  conceptsPath,
  copywritingPath,
  creativeSheetPath,
  internalQueuePath,
  ugcPath,
} from './routes';
import { loadUgc } from './ugc-source';
import { requestConnection } from '@/lib/request-db';

export interface DashboardItem {
  readonly label: string;
  readonly count: number;
  readonly href: string;
}

export interface RoleDashboard {
  readonly roleLabel: string;
  readonly items: readonly DashboardItem[];
}

/**
 * The three tables every role tile counts over. A structural shape, not the full row types, because
 * the tiles read only these fields — the brief's status and QA flags, a concept's id, a copy row's
 * status. The demo fixtures and the live query results both satisfy it, so `buildRoleDashboard`
 * below is one pure function over either, and `roleDashboard`/`loadRoleDashboard` differ only in
 * WHERE the data came from (CLAUDE.md: the demo/live split is a data-layer concern, not the page's).
 */
export interface DashboardData {
  readonly briefs: readonly BriefListRow[];
  readonly concepts: readonly { readonly id: string; readonly approvalStatus: string | null }[];
  readonly copy: readonly { readonly status: string }[];
  /** The creator's CLIENT-facing track (`client_status`), the one 'Creators Pending' counts. */
  readonly creators: readonly { readonly clientStatus: string | null }[];
}

function briefsIn(briefs: readonly BriefListRow[], statuses: readonly string[]): number {
  return briefs.filter((b) => statuses.includes(b.internalStatus)).length;
}

/**
 * The statuses the cards below count on, each one ANNOTATED with the state machine's own union
 * rather than left a bare string. A brief's two status columns arrive from the database as `string`,
 * so a comparison against a literal cannot be type-checked at the comparison itself; naming the key
 * here, typed, moves that check to one place — rename a key in `@tas/domain/state` and this module
 * fails to compile instead of quietly counting zero (UI governance rule 2).
 *
 * `INTERNAL_REVISION_KEYS` is the pair of track-specific revision steps, one per ladder.
 * `revisions_submitted` is deliberately NOT one of them: that step is the editor's re-upload, which
 * is waiting on a reviewer, not on revisions, and it is shared by both ladders.
 */
const INTERNAL_REVISION_KEYS: readonly InternalStatusKey[] = [
  'videos_revisions',
  'images_revisions',
];
const INTERNAL_APPROVED: InternalStatusKey = 'approved';
const CLIENT_PENDING: ClientStatusKey = 'pending_for_approval';
const CLIENT_APPROVED: ClientStatusKey = 'approved';
const CLIENT_REVISIONS_NEEDED: ClientStatusKey = 'revisions_needed';

function strategistItems(data: DashboardData): DashboardItem[] {
  const { briefs, concepts } = data;
  return [
    {
      label: 'Concepts needing creatives',
      count: concepts.filter((c) => !briefs.some((b) => b.conceptId === c.id)).length,
      href: conceptsPath,
    },
    {
      label: 'Creatives in early stages',
      count: briefsIn(briefs, ['sent_to_video_editor', 'static_design_in_progress']),
      href: creativeSheetPath,
    },
    {
      label: 'Creatives needing QA sign-off',
      count: briefs.filter((b) => !b.qaStrategist && b.internalStatus !== 'launched').length,
      href: internalQueuePath,
    },
  ];
}

function editorItems(data: DashboardData): DashboardItem[] {
  const { briefs, copy } = data;
  return [
    {
      label: 'Creatives in production',
      count: briefsIn(briefs, ['sent_to_video_editor', 'in_review', 'ad_submitted']),
      href: internalQueuePath,
    },
    {
      label: 'Needing editor QA',
      count: briefs.filter((b) => !b.qaVideoEditor && b.internalStatus !== 'launched').length,
      href: internalQueuePath,
    },
    {
      label: 'Copy pending review',
      count: copy.filter((c) => c.status === 'pending_for_client_review').length,
      href: copywritingPath,
    },
  ];
}

function designerItems(data: DashboardData): DashboardItem[] {
  const { briefs } = data;
  return [
    {
      label: 'Design in progress',
      count: briefsIn(briefs, ['static_design_in_progress']),
      href: internalQueuePath,
    },
    {
      label: 'Needing designer QA',
      count: briefs.filter((b) => !b.qaDesigner && b.internalStatus !== 'launched').length,
      href: internalQueuePath,
    },
    {
      label: 'Creatives without design file',
      count: briefs.filter((b) => b.designFileUrl === null && b.internalStatus !== 'launched')
        .length,
      href: creativeSheetPath,
    },
  ];
}

/**
 * The CSM's own queue: what is still in production and what has cleared internal review. There is
 * deliberately no library tile here. One used to be: an "Angles in library" tile that counted
 * CONCEPTS and linked to Angles — wrong on both halves — and it duplicated a count the sidebar's
 * own Angles section already carries. Removed by action item 8 (Talal's review: angles do not
 * belong in a queue of work); the data itself is untouched and still reached from the nav.
 */
function csmItems(data: DashboardData): DashboardItem[] {
  const { briefs } = data;
  const pending = briefs.filter(
    (b) => b.internalStatus !== 'approved' && b.internalStatus !== 'launched',
  );
  const clientReady = briefs.filter(
    (b) => b.internalStatus === 'approved' || b.internalStatus === 'launched',
  );
  return [
    { label: 'Creatives in progress', count: pending.length, href: internalQueuePath },
    { label: 'Ready for client', count: clientReady.length, href: internalQueuePath },
  ];
}

function mediaBuyerItems(data: DashboardData): DashboardItem[] {
  const { briefs } = data;
  const launchReady = briefs.filter(
    (b) => b.internalStatus === 'approved' && b.clientStatus === 'approved',
  );
  const launched = briefs.filter((b) => b.internalStatus === 'launched');
  return [
    { label: 'Ads to launch', count: launchReady.length, href: internalQueuePath },
    { label: 'Currently live', count: launched.length, href: internalQueuePath },
    {
      label: 'Winning creatives',
      count: briefs.filter((b) => b.performance === 'Winning').length,
      href: creativeSheetPath,
    },
  ];
}

/**
 * Whether a brief's stored spell-check result is an actual flag, not a clean pass or nothing. The
 * checker writes "No issues found." on a clean run (see `spell-check.ts`); that and a blank value are
 * not errors.
 */
export function hasSpellingIssues(feedback: string | null): boolean {
  if (feedback === null) return false;
  const trimmed = feedback.trim();
  return trimmed !== '' && !/no issues found/i.test(trimmed);
}

/**
 * The Admin dashboard (Sprint 12): the CSM pipeline tiles plus a spell-check-flags tile — the count
 * of briefs whose auto/Re-run spell check left feedback. Admin previously aliased to the CSM tiles;
 * this gives it its own set. The all-brand aggregate and propagation cards the sprint sketches are
 * already elsewhere on the Overview (the section cards and the propagation page), so they are not
 * duplicated here.
 */
function adminItems(data: DashboardData): DashboardItem[] {
  return [
    ...csmItems(data),
    {
      label: 'Creatives with spell-check flags',
      count: data.briefs.filter((brief) => hasSpellingIssues(brief.spellingFeedback)).length,
      href: creativeSheetPath,
    },
  ];
}

const BUILDERS: Record<BrandRole, (data: DashboardData) => DashboardItem[]> = {
  strategist: strategistItems,
  video_editor: editorItems,
  designer: designerItems,
  csm: csmItems,
  media_buyer: mediaBuyerItems,
  client: csmItems,
};

/** The demo fixtures, in the shape the builders read. */
const DEMO_DASHBOARD_DATA: DashboardData = {
  briefs: demoBriefs,
  concepts: demoConcepts,
  copy: demoCopy,
  creators: demoCreators,
};

// ── Overview metric cards (TASK 6) ──────────────────────────────────────────

export interface MetricCard {
  readonly key: string;
  readonly emoji: string;
  readonly label: string;
  readonly count: number;
  readonly href: string;
}

/**
 * The ELEVEN pipeline cards of Talal's reference dashboard, counted with the domain's own KEYS —
 * never a label string — and each linking to the table view already filtered to what it counted
 * (`?status=` / `?client=` on the Briefs table, which filters on both when both are given).
 *
 * Three of the eleven were missing until action item 6: Internal Revisions, Client Revisions and
 * Ads to Launch. All three count data that was already stored; none introduces a new column.
 *
 * Three cards land on a table UNFILTERED, and each for a stated reason rather than by omission:
 * Concepts Pending and Creators Pending because pending IS those tables' resting state, and
 * Internal Revisions because it counts two internal statuses at once (one per track) — so it opens
 * the Internal Queue board, which groups by internal status and therefore shows both revision
 * columns side by side.
 *
 * The brief cards open the Creative Sheet (2026-10-09): the Creative Design LIST page is removed
 * from the app, and the sheet is where the brand's creatives are listed now. The sheet takes no
 * `?status=` / `?client=` filter, so the cards land on the unfiltered sheet rather than carry dead
 * parameters.
 */
function allMetricCards(data: MetricsData): MetricCard[] {
  const { briefs, concepts, creators } = data;
  return [
    {
      key: 'concepts_pending',
      emoji: '💡',
      label: 'Concepts Pending',
      count: concepts.filter(
        (c) => c.approvalStatus === null || c.approvalStatus === 'pending_client',
      ).length,
      href: conceptsPath,
    },
    {
      key: 'creators_pending',
      emoji: '🎬',
      label: 'Creators Pending',
      count: creators.filter(
        (c) =>
          c.clientStatus === null ||
          c.clientStatus === 'pending_for_approval' ||
          c.clientStatus === 'draft',
      ).length,
      href: ugcPath,
    },
    {
      key: 'sent_to_video_editor',
      emoji: '📹',
      label: 'Sent to Video Editor',
      count: briefsIn(briefs, ['sent_to_video_editor']),
      href: creativeSheetPath,
    },
    {
      key: 'sent_to_designer',
      emoji: '🎨',
      label: 'Sent to Designer',
      count: briefsIn(briefs, ['sent_to_designer']),
      href: creativeSheetPath,
    },
    {
      key: 'video_editing_in_progress',
      emoji: '⚡',
      label: 'Videos in Progress',
      count: briefsIn(briefs, ['video_editing_in_progress']),
      href: creativeSheetPath,
    },
    {
      key: 'static_design_in_progress',
      emoji: '🖌️',
      label: 'Designs in Progress',
      count: briefsIn(briefs, ['static_design_in_progress']),
      href: creativeSheetPath,
    },
    {
      key: 'ad_submitted',
      emoji: '👀',
      label: 'Awaiting Internal Review',
      count: briefsIn(briefs, ['ad_submitted']),
      href: creativeSheetPath,
    },
    {
      key: 'awaiting_client',
      emoji: '📨',
      label: 'Awaiting Client Review',
      count: briefs.filter((b) => b.clientStatus === CLIENT_PENDING).length,
      href: creativeSheetPath,
    },
    {
      key: 'internal_revisions',
      emoji: '🔁',
      label: 'Internal Revisions',
      count: briefsIn(briefs, INTERNAL_REVISION_KEYS),
      href: internalQueuePath,
    },
    {
      key: 'client_revisions',
      emoji: '📝',
      label: 'Client Revisions',
      count: briefs.filter((b) => b.clientStatus === CLIENT_REVISIONS_NEEDED).length,
      href: creativeSheetPath,
    },
    {
      key: 'ads_to_launch',
      emoji: '🚀',
      label: 'Ads to Launch',
      count: briefs.filter(
        (b) => b.internalStatus === INTERNAL_APPROVED && b.clientStatus === CLIENT_APPROVED,
      ).length,
      href: creativeSheetPath,
    },
  ];
}

/**
 * Which of the eleven cards each role scans for. Admin, CSM and strategist run the whole pipeline.
 *
 * The three cards action item 6 added are routed by WHOSE DESK the work lands on, not by which
 * table they read. Both revision cards reach the editor and the designer, because a brief sent back
 * — by a reviewer or by the client — comes back to whoever made it. `ads_to_launch` is the media
 * buyer's own queue; it was already their role tile, and this is the same count as a card.
 *
 * `client_revisions` is the only one of the three a CLIENT may see, and it is safe BY DEFINITION:
 * `revisions_needed` is a member of `CLIENT_STATUS`, so it is the client's own status rather than
 * internal data (non-negotiable 10). `internal_revisions` counts two statuses whose descriptions
 * say "Client never sees this state", so it reaches no client-facing set.
 */
const CARD_KEYS_BY_ROLE: Record<BrandRole | 'admin', readonly string[] | 'all'> = {
  admin: 'all',
  csm: 'all',
  strategist: 'all',
  video_editor: [
    'sent_to_video_editor',
    'video_editing_in_progress',
    'ad_submitted',
    'internal_revisions',
    'client_revisions',
  ],
  designer: [
    'sent_to_designer',
    'static_design_in_progress',
    'ad_submitted',
    'internal_revisions',
    'client_revisions',
  ],
  media_buyer: ['ad_submitted', 'awaiting_client', 'ads_to_launch'],
  client: ['awaiting_client', 'client_revisions'],
};

/**
 * What the eleven cards actually read: everything but `copy`, which only the editor's role TILE
 * counts. Named so the per-brand panel loader (below) can skip the one table the cards never touch
 * instead of feeding them an empty array that would lie if a copy card ever appeared.
 * `DashboardData` satisfies it, so every existing caller passes unchanged.
 */
export type MetricsData = Omit<DashboardData, 'copy'>;

/** The role's cards over whichever data it is handed — pure, demo or live. */
export function buildOverviewMetrics(role: BrandRole | 'admin', data: MetricsData): MetricCard[] {
  const cards = allMetricCards(data);
  const keys = CARD_KEYS_BY_ROLE[role];
  return keys === 'all' ? cards : cards.filter((card) => keys.includes(card.key));
}

// ── Pipeline chart (TASK 6) ─────────────────────────────────────────────────

export interface PipelineStep {
  readonly key: string;
  readonly label: string;
  readonly count: number;
}

/**
 * Briefs per internal status, in ladder order: the video track's seven steps, with the static
 * track's track-specific steps merged in after their video analogues (the rest are shared).
 * Every brief rests at exactly one step, so the counts sum to the brief count.
 */
export function buildPipeline(briefs: readonly BriefListRow[]): PipelineStep[] {
  const seen = new Set<string>();
  const ladder: { key: string; label: string }[] = [];
  for (const track of [INTERNAL_VIDEO_STATUS, INTERNAL_STATIC_STATUS]) {
    for (const step of track) {
      if (seen.has(step.key)) continue;
      seen.add(step.key);
      ladder.push({ key: step.key, label: step.label });
    }
  }
  return ladder.map((step) => ({
    ...step,
    count: briefs.filter((b) => b.internalStatus === step.key).length,
  }));
}

/** The demo metrics, synchronously — for the design-system story and the unit tests. */
export function overviewMetrics(role: BrandRole | 'admin'): MetricCard[] {
  return buildOverviewMetrics(role, DEMO_DASHBOARD_DATA);
}

/** The role's tiles over whichever data it is handed — the one pure builder, demo or live. */
export function buildRoleDashboard(role: BrandRole | 'admin', data: DashboardData): RoleDashboard {
  if (role === 'admin') {
    return { roleLabel: 'Admin', items: adminItems(data) };
  }
  return {
    roleLabel: role === 'video_editor' ? 'Creative Items' : BRAND_ROLE_LABELS[role],
    items: BUILDERS[role](data),
  };
}

/**
 * The demo dashboard: the fixtures, synchronously. Kept for the design-system story and the tests
 * that assert the tile shapes without a database; the page uses `loadRoleDashboard`.
 */
export function roleDashboard(role: BrandRole | 'admin'): RoleDashboard {
  return buildRoleDashboard(role, DEMO_DASHBOARD_DATA);
}

/**
 * The dashboard a real request sees. In demo/fixture mode it is `roleDashboard` — the fixtures, no
 * connection. In live mode it counts over REAL data: the briefs, concepts and copy of the brand in
 * scope, read through the same `loadBriefs`/`loadConcepts`/`loadCopy` every other page uses (so the
 * tenancy scoping and the demo/live split are not re-implemented here), in parallel on one tick.
 *
 * Each loader opens and closes its own connection; three reads for the Overview is the cost of not
 * duplicating three brand-scoped queries into this module. `loadBriefs` returns `BriefRow`, a
 * `BriefListRow` plus a derived `track`, which satisfies `DashboardData.briefs` structurally.
 */
export interface OverviewPanels {
  readonly dashboard: RoleDashboard;
  readonly metrics: MetricCard[];
  readonly pipeline: PipelineStep[];
  readonly pipelineSummary: PipelineSummary;
}

export async function loadRoleDashboard(
  role: BrandRole | 'admin',
  deps: BriefSourceDeps = {},
): Promise<RoleDashboard> {
  return (await loadOverviewPanels(role, deps)).dashboard;
}

/**
 * Everything the Overview's role-aware sections render — the role tiles, the eight metric cards
 * and the pipeline chart — over ONE load of the four tables, so the page never reads briefs twice.
 */
export async function loadOverviewPanels(
  role: BrandRole | 'admin',
  deps: BriefSourceDeps = {},
): Promise<OverviewPanels> {
  const [briefs, concepts, copy, creators, creativeSheet] = await Promise.all([
    loadBriefs(deps),
    loadConcepts(deps),
    loadCopy(deps),
    loadUgc(deps),
    loadCreativeSheetItems(deps),
  ]);
  const data: DashboardData = {
    briefs: briefs.rows,
    concepts: concepts.rows,
    copy: copy.rows,
    creators: creators.creators,
  };
  const pipelineSummary = computePipelineSummary({
    briefs: data.briefs.map((b) => ({
      internalStatus: b.internalStatus,
      clientStatus: b.clientStatus,
    })),
    concepts: concepts.rows.map((c) => ({
      internalStatus: c.internalStatus,
      clientStatus: c.clientStatus,
    })),
    creativeSheet: creativeSheet.rows.map((item) => ({
      internalStatus: item.internalStatus,
      status: item.status,
    })),
    copywriting: copy.rows.map((c) => ({ status: c.status })),
    creators: creators.creators.map((c) => ({
      internalCreatorStatus: c.internalCreatorStatus,
      clientStatus: c.clientStatus,
    })),
  });
  return {
    dashboard: buildRoleDashboard(role, data),
    metrics: buildOverviewMetrics(role, data),
    pipeline: buildPipeline(data.briefs),
    pipelineSummary,
  };
}

// ── Cross-client overview (AI-09) ───────────────────────────────────────────

/** A brand of the actor's book, as `listBrandsForActor` returns it. */
export interface ActorBrand {
  readonly id: string;
  readonly name: string;
}

/** One brand's slice of the cross-client Overview: its name and its role-scoped metric cards. */
export interface BrandPanel {
  readonly brandId: string;
  readonly brandName: string;
  readonly metrics: MetricCard[];
}

function neonConnection(databaseUrl: string): DbConnection {
  return requestConnection(databaseUrl);
}

/** Opens a connection, runs `query`, and always closes it — the request's shared pool in production. */
async function withDb<T>(deps: BriefSourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
  const connect = deps.connect ?? neonConnection;
  const databaseUrl = serverEnv().DATABASE_URL;
  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is not configured.');
  }
  const connection = connect(databaseUrl);
  try {
    return await query(connection.db);
  } finally {
    await connection.close();
  }
}

/**
 * The signed-in actor's book: the live, non-template brands their `brand_assignments` rows name,
 * INTERSECTED with the brands the session's agency scope may select. The intersection is the
 * tenancy guard: an assignment row pointing at another agency's brand (the moonlighting shape
 * `team.test.ts` constructs) must not put that brand on this Overview — and it is also what makes
 * the per-brand reads below exact, because `pickActiveBrand` honours a requested brand id only when
 * it names one of the scope's options and silently falls back to the first brand otherwise. Every
 * id this returns is therefore an id the resolver will honour as-is.
 *
 * Demo mode is the one demo brand and no connection, so there is no book to read: empty, which the
 * caller reads as "single-brand behaviour". A request with no signed-in user is the same. The
 * agency resolution inside `loadBrandScope` is untouched, so an actor in two agencies with neither
 * selected still fails with `AmbiguousBrandError` exactly as every other loader on the page does.
 */
export async function loadActorBrands(deps: BriefSourceDeps = {}): Promise<ActorBrand[]> {
  if (inDemoMode(deps)) {
    return [];
  }
  const scope = await (deps.actorScope ?? clerkActorScope)();
  const clerkUserId = scope.clerkUserId;
  if (clerkUserId === null) {
    return [];
  }
  const [brandScope, assigned] = await Promise.all([
    loadBrandScope(deps),
    withDb(deps, (db) => listBrandsForActor(db, clerkUserId)),
  ]);
  const selectable = new Set(brandScope.options.map((brand) => brand.id));
  return assigned.filter((brand) => selectable.has(brand.id));
}

/**
 * One panel per brand of `brands`, each counted over THAT brand's rows: the `brandIds` seam of
 * AI-09. The per-brand read is the same three loaders the single-brand Overview uses — never a
 * parallel query path — handed `activeBrandId` pinned to the brand, so the scoping still runs
 * through `resolveLiveBrandId`/`pickActiveBrand` and the scoped `@tas/db` queries. `loadCopy` is
 * deliberately not among them: the cards read `MetricsData`, which has no copy (see the type).
 *
 * ONE CONNECTION for the whole fan-out, not one per brand: every loader reaches the database
 * through `requestConnection` (`request-db.ts`), which keys one pool on the request, so N brands
 * are N queries down a shared pool — the pattern `loadOverviewPanels` already follows. Demo mode
 * returns no panels and opens nothing: the demo workspace has one brand, so a cross-client fan-out
 * over fixtures could only fabricate N identical books.
 */
export async function loadBrandPanels(
  role: BrandRole | 'admin',
  brands: readonly ActorBrand[],
  deps: BriefSourceDeps = {},
): Promise<BrandPanel[]> {
  if (inDemoMode(deps)) {
    return [];
  }
  return Promise.all(
    brands.map(async (brand) => {
      const scoped: BriefSourceDeps = {
        ...deps,
        activeBrandId: () => Promise.resolve(brand.id),
      };
      const [briefs, concepts, creators] = await Promise.all([
        loadBriefs(scoped),
        loadConcepts(scoped),
        loadUgc(scoped),
      ]);
      return {
        brandId: brand.id,
        brandName: brand.name,
        metrics: buildOverviewMetrics(role, {
          briefs: briefs.rows,
          concepts: concepts.rows,
          creators: creators.creators,
        }),
      };
    }),
  );
}

/**
 * The cross-client panels the Overview page renders, or none. WHOSE brands is decided here, once:
 * the signed-in actor's assignments (`loadActorBrands`). An actor with fewer than two — no
 * assignments, like an agency admin, or a single brand — falls back to the current single-brand
 * behaviour: no panels, nothing else on the page moves, and no per-brand read is spent repeating
 * what `loadOverviewPanels` already counted for the active brand.
 */
export async function loadActorBrandPanels(
  role: BrandRole | 'admin',
  deps: BriefSourceDeps = {},
): Promise<BrandPanel[]> {
  const brands = await loadActorBrands(deps);
  if (brands.length < 2) {
    return [];
  }
  return loadBrandPanels(role, brands, deps);
}

/**
 * TOTAL ASSETS, as the reference dashboard derives it: the sum of the metric-card counts. Both
 * reference cards check out exactly — Victoria's 48+9+16+1+5+0+57+117+5+24+2 = 284 and Tammy's
 * same eleven sum to 206 — so the number is defined by the cards on display, never a fourth query
 * with a vocabulary of its own (AI-06).
 */
export function totalAssetCount(metrics: readonly MetricCard[]): number {
  return metrics.reduce((sum, card) => sum + card.count, 0);
}

/** `284 total assets`, singular-safe; the card renders it uppercase with CSS, never a new string. */
export function totalAssetsLabel(count: number): string {
  return `${String(count)} total ${count === 1 ? 'asset' : 'assets'}`;
}

/**
 * The card shell's header line, after the reference's "ADVERTISING CSM · 15 CLIENTS · 284 TOTAL
 * ASSETS": the viewer's role label (`BRAND_ROLE_LABELS`, never a magic string), the size of their
 * book and its combined asset total — every number derived from the panels, which is what makes
 * the shell's one hardcodable line impossible to hardcode. Title case here; the heading uppercases
 * with CSS, the same split the Overview's own eyebrow uses.
 */
export function brandPanelsHeader(
  role: BrandRole | 'admin',
  panels: readonly BrandPanel[],
): string {
  const label = role === 'admin' ? 'Admin' : BRAND_ROLE_LABELS[role];
  const clients = `${String(panels.length)} ${panels.length === 1 ? 'client' : 'clients'}`;
  const total = panels.reduce((sum, panel) => sum + totalAssetCount(panel.metrics), 0);
  return `${label} · ${clients} · ${totalAssetsLabel(total)}`;
}
