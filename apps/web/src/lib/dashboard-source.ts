import type { BriefListRow } from '@tas/db';
import { demoBriefs, demoConcepts, demoCopy } from '@tas/db';
import type { BrandRole } from '@tas/domain';
import { BRAND_ROLE_LABELS } from '@tas/domain';

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

function briefsIn(briefs: readonly BriefListRow[], statuses: readonly string[]): number {
  return briefs.filter((b) => statuses.includes(b.internalStatus)).length;
}

function strategistItems(briefs: readonly BriefListRow[]): DashboardItem[] {
  return [
    {
      label: 'Concepts needing briefs',
      count: demoConcepts.filter((c) => !briefs.some((b) => b.conceptId === c.id)).length,
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

function editorItems(briefs: readonly BriefListRow[]): DashboardItem[] {
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
      count: demoCopy.filter((c) => c.status === 'pending_for_client_review').length,
      href: copywritingPath,
    },
  ];
}

function designerItems(briefs: readonly BriefListRow[]): DashboardItem[] {
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

function csmItems(briefs: readonly BriefListRow[]): DashboardItem[] {
  const pending = briefs.filter(
    (b) => b.internalStatus !== 'approved' && b.internalStatus !== 'launched',
  );
  const clientReady = briefs.filter(
    (b) => b.internalStatus === 'approved' || b.internalStatus === 'launched',
  );
  return [
    { label: 'Briefs in progress', count: pending.length, href: internalQueuePath },
    { label: 'Ready for client', count: clientReady.length, href: internalQueuePath },
    { label: 'Angles in library', count: demoConcepts.length, href: anglesPath },
  ];
}

function mediaBuyerItems(briefs: readonly BriefListRow[]): DashboardItem[] {
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

const BUILDERS: Record<BrandRole, (briefs: readonly BriefListRow[]) => DashboardItem[]> = {
  strategist: strategistItems,
  video_editor: editorItems,
  designer: designerItems,
  csm: csmItems,
  media_buyer: mediaBuyerItems,
  client: csmItems,
};

export function roleDashboard(role: BrandRole | 'admin'): RoleDashboard {
  const effectiveRole: BrandRole = role === 'admin' ? 'csm' : role;
  const builder = BUILDERS[effectiveRole];
  return {
    roleLabel:
      role === 'admin'
        ? 'Admin'
        : role === 'video_editor'
          ? 'Creative Items'
          : BRAND_ROLE_LABELS[effectiveRole],
    items: builder(demoBriefs),
  };
}
