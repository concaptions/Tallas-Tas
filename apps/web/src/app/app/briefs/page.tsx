import { supportsView, type ViewType } from '@tas/domain';
import { creativeFunnelLabel } from '@tas/domain/creatives';

import type { BriefRow } from '@/lib/briefs-source';
import { loadBriefs } from '@/lib/briefs-source';
import { loadViewPreference } from '@/lib/view-preference-actions';
import { isDemoMode } from '@/lib/demo-mode';
import { briefPath } from '@/lib/routes';

import { BriefsWorkspace } from './briefs-workspace';
import {
  clientStatusView,
  creativeTypeLabel,
  internalStatusView,
  priorityView,
  type BriefFormSnapshot,
  type BriefItem,
} from './fields';

interface BriefsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function formSnapshotOf(row: BriefRow): BriefFormSnapshot {
  return {
    conceptId: row.conceptId ?? '',
    funnel: row.funnel,
    type: row.type,
    version: String(row.version),
    batch: row.batch ?? '',
    product: '',
    priority: row.priority ?? '',
    assignee: row.assignee ?? '',
    briefToDesign: row.briefToDesign ?? '',
    scriptContent: row.scriptContent ?? '',
    elementsTested: row.elementsTested ?? '',
    adContent: row.adContent ?? '',
    inspiration: row.inspiration ?? '',
    offer: row.offer ?? '',
    language: row.language ?? '',
    spellingFeedback2: row.spellingFeedback2 ?? '',
    angleId: row.angleId ?? '',
    productId: row.productId ?? '',
    inspoLinks: row.inspoLinks,
    dimensions: row.dimensions,
    internalStatus: row.internalStatus,
    clientStatus: row.clientStatus,
  };
}

export default async function BriefsPage({ searchParams }: BriefsPageProps) {
  const [{ rows }, params, viewPref] = await Promise.all([
    loadBriefs(),
    searchParams,
    // Briefs open on Kanban by default (P2B) — the media-buyer/strategist board is the primary view.
    loadViewPreference('briefs', 'kanban'),
  ]);
  const demo = isDemoMode();

  // `?view=` overrides the default/saved view when it names a view Briefs supports, so a table (or
  // gallery) is reachable and shareable by URL even though Kanban is the default.
  const requestedView =
    typeof params.view === 'string' && supportsView('briefs', params.view as ViewType)
      ? (params.view as ViewType)
      : null;
  const initialView = requestedView ?? viewPref.viewType;

  const items: BriefItem[] = rows.map((row) => {
    const firstDesign =
      Array.isArray(row.designFile) && row.designFile.length > 0
        ? (row.designFile[0] ?? null)
        : null;
    const firstInspo =
      Array.isArray(row.inspirationImage) && row.inspirationImage.length > 0
        ? (row.inspirationImage[0] ?? null)
        : null;

    return {
      id: row.id,
      name: row.name,
      conceptName: row.conceptName,
      type: row.type,
      typeLabel: creativeTypeLabel(row.type),
      priority: priorityView(row.priority),
      assignee: row.assignee,
      status: internalStatusView(row.track, row.internalStatus),
      clientStatus: clientStatusView(row.clientStatus),
      funnelLabel: creativeFunnelLabel(row.funnel),
      sourceLabel: row.source,
      href: briefPath(row.id),
      kanbanFields: {
        clientStatus: row.clientStatus,
        internalStatus: row.internalStatus,
        priority: row.priority ?? '',
        performance: row.performance ?? '',
        funnel: row.funnel,
        type: row.type,
        source: row.source,
        platform: row.platform.join(', '),
        language: row.language ?? '',
      },
      galleryImageUrl: firstDesign ?? firstInspo,
      formSnapshot: formSnapshotOf(row),
    };
  });

  // The Overview's metric cards land here with `?status=` (internal key) or `?client=` (client
  // key) — a filtered table view (TASK 6). Keys, never labels, so the filter cannot drift.
  const statusParam =
    typeof params.status === 'string' && params.status !== '' ? params.status : null;
  const clientParam =
    typeof params.client === 'string' && params.client !== '' ? params.client : null;
  const visibleItems = items.filter(
    (item) =>
      (statusParam === null || item.kanbanFields.internalStatus === statusParam) &&
      (clientParam === null || item.kanbanFields.clientStatus === clientParam),
  );

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  return (
    <BriefsWorkspace
      items={visibleItems}
      demo={demo}
      initialSearch={initialSearch}
      initialView={initialView}
      initialKanbanField={viewPref.kanbanGroupByField}
    />
  );
}
