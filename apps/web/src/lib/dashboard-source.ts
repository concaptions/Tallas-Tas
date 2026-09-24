import type { BriefListRow } from '@tas/db';
import { demoBriefs, demoConcepts, demoCopy } from '@tas/db';
import type { BrandRole } from '@tas/domain';
import { BRAND_ROLE_LABELS } from '@tas/domain';

import { loadBriefs, type BriefSourceDeps } from './briefs-source';
import { loadConcepts } from './concepts-source';
import { loadCopy } from './copy-source';
import { anglesPath, briefsPath, conceptsPath, copywritingPath, internalQueuePath } from './routes';

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
  readonly concepts: readonly { readonly id: string }[];
  readonly copy: readonly { readonly status: string }[];
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
};

/** The role's tiles over whichever data it is handed — the one pure builder, demo or live. */
export function buildRoleDashboard(role: BrandRole | 'admin', data: DashboardData): RoleDashboard {
  const effectiveRole: BrandRole = role === 'admin' ? 'csm' : role;
  const builder = BUILDERS[effectiveRole];
  return {
    roleLabel:
      role === 'admin'
        ? 'Admin'
        : role === 'video_editor'
          ? 'Creative Items'
          : BRAND_ROLE_LABELS[effectiveRole],
    items: builder(data),
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
export async function loadRoleDashboard(
  role: BrandRole | 'admin',
  deps: BriefSourceDeps = {},
): Promise<RoleDashboard> {
  const [briefs, concepts, copy] = await Promise.all([
    loadBriefs(deps),
    loadConcepts(deps),
    loadCopy(deps),
  ]);
  return buildRoleDashboard(role, {
    briefs: briefs.rows,
    concepts: concepts.rows,
    copy: copy.rows,
  });
}
