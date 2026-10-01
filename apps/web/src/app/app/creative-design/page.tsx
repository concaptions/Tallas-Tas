import { getTableCapability, supportsView, type ViewType } from '@tas/domain';
import { editorStageOf } from '@tas/domain/state';
import { creativeFunnelLabel } from '@tas/domain/creatives';

import type { BriefRow } from '@/lib/briefs-source';
import { loadBriefs } from '@/lib/briefs-source';
import { loadClientAssetFolders } from '@/lib/client-assets-source';
import { loadCreativeModules } from '@/lib/creative-modules-source';
import { loadCreativeReports } from '@/lib/creative-reporting-source';
import { loadCreativeSheetItems } from '@/lib/creative-sheet-source';
import { loadViewPreference } from '@/lib/view-preference-actions';
import { isDemoMode } from '@/lib/demo-mode';
import { briefPath } from '@/lib/routes';

import { BriefsWorkspace } from './briefs-workspace';
import {
  NO_BRIEF_LINKS,
  clientStatusView,
  creativeTypeLabel,
  indexBriefLinkCounts,
  internalStatusView,
  priorityView,
  type BriefFormSnapshot,
  type BriefItem,
  dueDateInputValue,
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
    dueDate: dueDateInputValue(row.dueDate),
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

/** Whether a `?group=` value names one of the table's Kanban groupings. */
function supportsKanbanField(tableKey: string, field: string): boolean {
  return getTableCapability(tableKey)?.kanbanFields.some((entry) => entry.field === field) ?? false;
}

export default async function BriefsPage({ searchParams }: BriefsPageProps) {
  const [{ rows }, params, viewPref, sheetItems, modules, folders, reports] = await Promise.all([
    loadBriefs(),
    searchParams,
    // Briefs open on Kanban by default (P2B) — the media-buyer/strategist board is the primary view.
    loadViewPreference('briefs', 'kanban'),
    // The four tables that point at a brief, for the panel's count line. Each `load…` is demo-aware,
    // so the fixtures' link arrays show here exactly as a seeded database's junctions would.
    loadCreativeSheetItems(),
    loadCreativeModules(),
    loadClientAssetFolders(),
    loadCreativeReports(),
  ]);
  const demo = isDemoMode();

  // Indexed once, by brief id, rather than four scans per row.
  const linkCounts = indexBriefLinkCounts({
    sheetItems: sheetItems.rows,
    modules: modules.rows,
    folders: folders.rows,
    reports: reports.rows,
  });

  // `?view=` overrides the default/saved view when it names a view Briefs supports, so a table (or
  // gallery) is reachable and shareable by URL even though Kanban is the default.
  const requestedView =
    typeof params.view === 'string' && supportsView('briefs', params.view as ViewType)
      ? (params.view as ViewType)
      : null;
  const initialView = requestedView ?? viewPref.viewType;
  // `?group=` names a Kanban grouping (`editorStage` for the editor board), over the saved one.
  const requestedGroup =
    typeof params.group === 'string' && supportsKanbanField('briefs', params.group)
      ? params.group
      : null;

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
        // The editor board's stage, a VIEW of the internal status (Sprint 10); '' once off the board.
        editorStage: editorStageOf(row.internalStatus) ?? '',
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
      linkCounts: linkCounts.get(row.id) ?? NO_BRIEF_LINKS,
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
      initialKanbanField={requestedGroup ?? viewPref.kanbanGroupByField}
    />
  );
}
