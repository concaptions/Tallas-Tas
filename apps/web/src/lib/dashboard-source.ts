import type { BriefListRow } from '@tas/db';
import { demoBriefs, demoConcepts, demoCopy, demoCreators } from '@tas/db';
import type { BrandRole } from '@tas/domain';
import { BRAND_ROLE_LABELS } from '@tas/domain';
import { INTERNAL_STATIC_STATUS, INTERNAL_VIDEO_STATUS } from '@tas/domain/state';

import { loadBriefs, type BriefSourceDeps } from './briefs-source';
import { loadConcepts } from './concepts-source';
import { loadCopy } from './copy-source';
import {
  anglesPath,
  briefsPath,
  conceptsPath,
  copywritingPath,
  internalQueuePath,
  ugcPath,
} from './routes';
import { loadUgc } from './ugc-source';

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

function strategistItems(data: DashboardData): DashboardItem[] {
  const { briefs, concepts } = data;
  return [
    {
      label: 'Concepts needing briefs',
      count: concepts.filter((c) => !briefs.some((b) => b.conceptId === c.id)).length,
      href: conceptsPath,
    },
    {
      label: 'Briefs in early stages',
      count: briefsIn(briefs, ['sent_to_video_editor', 'static_design_in_progress']),
      href: briefsPath,
    },
    {
      label: 'Briefs needing QA sign-off',
      count: briefs.filter((b) => !b.qaStrategist && b.internalStatus !== 'launched').length,
      href: internalQueuePath,
    },
  ];
}

function editorItems(data: DashboardData): DashboardItem[] {
  const { briefs, copy } = data;
  return [
    {
      label: 'Briefs in production',
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
      label: 'Briefs without design file',
      count: briefs.filter((b) => b.designFileUrl === null && b.internalStatus !== 'launched')
        .length,
      href: briefsPath,
    },
  ];
}

function csmItems(data: DashboardData): DashboardItem[] {
  const { briefs, concepts } = data;
  const pending = briefs.filter(
    (b) => b.internalStatus !== 'approved' && b.internalStatus !== 'launched',
  );
  const clientReady = briefs.filter(
    (b) => b.internalStatus === 'approved' || b.internalStatus === 'launched',
  );
  return [
    { label: 'Briefs in progress', count: pending.length, href: internalQueuePath },
    { label: 'Ready for client', count: clientReady.length, href: internalQueuePath },
    { label: 'Angles in library', count: concepts.length, href: anglesPath },
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
      href: briefsPath,
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
      label: 'Briefs with spell-check flags',
      count: data.briefs.filter((brief) => hasSpellingIssues(brief.spellingFeedback)).length,
      href: briefsPath,
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
 * The eight pipeline cards, counted with the domain's own KEYS — never a label string — and each
 * linking to the table view already filtered to what it counted (`?status=` / `?client=` on the
 * Briefs table). The two non-brief cards land on their tables unfiltered: pending is those
 * tables' resting state.
 */
function allMetricCards(data: DashboardData): MetricCard[] {
  const { briefs, concepts, creators } = data;
  const briefHref = (param: 'status' | 'client', key: string) =>
    `${briefsPath}?${param}=${key}&view=grid`;
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
      href: briefHref('status', 'sent_to_video_editor'),
    },
    {
      key: 'sent_to_designer',
      emoji: '🎨',
      label: 'Sent to Designer',
      count: briefsIn(briefs, ['sent_to_designer']),
      href: briefHref('status', 'sent_to_designer'),
    },
    {
      key: 'video_editing_in_progress',
      emoji: '⚡',
      label: 'Videos in Progress',
      count: briefsIn(briefs, ['video_editing_in_progress']),
      href: briefHref('status', 'video_editing_in_progress'),
    },
    {
      key: 'static_design_in_progress',
      emoji: '🖌️',
      label: 'Designs in Progress',
      count: briefsIn(briefs, ['static_design_in_progress']),
      href: briefHref('status', 'static_design_in_progress'),
    },
    {
      key: 'ad_submitted',
      emoji: '👀',
      label: 'Awaiting Internal Review',
      count: briefsIn(briefs, ['ad_submitted']),
      href: briefHref('status', 'ad_submitted'),
    },
    {
      key: 'awaiting_client',
      emoji: '📨',
      label: 'Awaiting Client Review',
      count: briefs.filter((b) => b.clientStatus === 'pending_for_approval').length,
      href: briefHref('client', 'pending_for_approval'),
    },
  ];
}

/** Which of the eight cards each role scans for. Admin, CSM and strategist run the whole pipeline. */
const CARD_KEYS_BY_ROLE: Record<BrandRole | 'admin', readonly string[] | 'all'> = {
  admin: 'all',
  csm: 'all',
  strategist: 'all',
  video_editor: ['sent_to_video_editor', 'video_editing_in_progress', 'ad_submitted'],
  designer: ['sent_to_designer', 'static_design_in_progress', 'ad_submitted'],
  media_buyer: ['ad_submitted', 'awaiting_client'],
  client: ['awaiting_client'],
};

/** The role's cards over whichever data it is handed — pure, demo or live. */
export function buildOverviewMetrics(role: BrandRole | 'admin', data: DashboardData): MetricCard[] {
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
  const [briefs, concepts, copy, creators] = await Promise.all([
    loadBriefs(deps),
    loadConcepts(deps),
    loadCopy(deps),
    loadUgc(deps),
  ]);
  const data: DashboardData = {
    briefs: briefs.rows,
    concepts: concepts.rows,
    copy: copy.rows,
    creators: creators.creators,
  };
  return {
    dashboard: buildRoleDashboard(role, data),
    metrics: buildOverviewMetrics(role, data),
    pipeline: buildPipeline(data.briefs),
  };
}
