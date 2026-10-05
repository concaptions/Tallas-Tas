import { briefConceptsFromAngles } from '@tas/db';
import { getTableCapability, supportsView, type ViewType } from '@tas/domain';
import { copyTitle } from '@tas/domain/copy';
import { editorStageOf } from '@tas/domain/state';
import { creativeFunnelLabel } from '@tas/domain/creatives';

import { loadAngles } from '@/lib/angles-source';
import { loadAssets } from '@/lib/assets-source';
import type { BriefRow } from '@/lib/briefs-source';
import { loadBriefColumns, loadBriefs } from '@/lib/briefs-source';
import { loadCampaigns } from '@/lib/campaigns-source';
import { loadClientAssetFolders } from '@/lib/client-assets-source';
import { loadCollections } from '@/lib/collections-source';
import { loadConcepts } from '@/lib/concepts-source';
import { loadCopy } from '@/lib/copy-source';
import { loadCreativeModules } from '@/lib/creative-modules-source';
import { loadCreativeReports } from '@/lib/creative-reporting-source';
import { loadCreativeSheetItems } from '@/lib/creative-sheet-source';
import { loadProducts } from '@/lib/products-source';
import { loadViewPreference } from '@/lib/view-preference-actions';
import { isDemoMode } from '@/lib/demo-mode';
import { briefPath, metaCopywritingPath } from '@/lib/routes';

import { BriefsWorkspace } from './briefs-workspace';
import {
  NO_BRIEF_LINKS,
  briefStageView,
  clientStatusView,
  creativeTypeLabel,
  indexBriefLinkCounts,
  internalStatusView,
  linkedName,
  performanceView,
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
  const [
    { rows },
    { columns, unconfigured: unconfiguredColumns },
    params,
    viewPref,
    sheetItems,
    modules,
    folders,
    reports,
    angleRows,
    productRows,
    collectionRows,
    campaignRows,
    assetRows,
    copyRows,
    conceptRows,
  ] = await Promise.all([
    loadBriefs(),
    // The brand's own column configuration (AI-64a): the grid draws what this returns, so the page
    // no longer decides which fields exist, what they are called or in which order they sit.
    loadBriefColumns(),
    searchParams,
    // Briefs open on Kanban by default (P2B) — the media-buyer/strategist board is the primary view.
    loadViewPreference('briefs', 'kanban'),
    // The four tables that point at a brief, for the panel's count line. Each `load…` is demo-aware,
    // so the fixtures' link arrays show here exactly as a seeded database's junctions would.
    loadCreativeSheetItems(),
    loadCreativeModules(),
    loadClientAssetFolders(),
    loadCreativeReports(),
    // The five tables a brief points AT, so a resolved link column renders the linked row's NAME
    // rather than a uuid or a blank. Resolved here, on the server, exactly as the detail page does.
    loadAngles(),
    loadProducts(),
    loadCollections(),
    loadCampaigns(),
    loadAssets(),
    // GRATSI-MATCH 2026-10-04: the copy rows whose `creative_brief_id` points here (the read-only
    // `Meta Copywriting` grid column) and the concepts behind the `Concepts (from Angles)` lookup.
    loadCopy(),
    loadConcepts(),
  ]);
  const demo = isDemoMode();

  // One map per linked table, built once, rather than a `find` per row per column.
  const angleNames = new Map(angleRows.rows.map((row) => [row.id, row.name]));
  const productNames = new Map(productRows.rows.map((row) => [row.id, row.name]));
  const collectionNames = new Map(collectionRows.rows.map((row) => [row.id, row.name]));
  const campaignNames = new Map(campaignRows.rows.map((row) => [row.id, row.name]));
  const assetNames = new Map(assetRows.rows.map((row) => [row.id, row.filename]));

  // Indexed once, by brief id, rather than four scans per row.
  const linkCounts = indexBriefLinkCounts({
    sheetItems: sheetItems.rows,
    modules: modules.rows,
    folders: folders.rows,
    reports: reports.rows,
  });

  // GRATSI-MATCH 2026-10-04 — two more single-pass inversions for the new read-only columns.
  // `copywriting.creative_brief_id` read backwards: briefId -> the copy rows' generated titles.
  const metaCopyByBrief = new Map<
    string,
    { readonly id: string; readonly label: string; readonly href?: string }[]
  >();
  for (const copy of copyRows.rows) {
    if (copy.creativeBriefId === null) continue;
    (
      metaCopyByBrief.get(copy.creativeBriefId) ??
      (() => {
        const list: { readonly id: string; readonly label: string; readonly href?: string }[] = [];
        metaCopyByBrief.set(copy.creativeBriefId, list);
        return list;
      })()
    ).push({
      id: copy.id,
      label: copyTitle(copy.copyNumber),
      href: `${metaCopywritingPath}?copy=${encodeURIComponent(copy.id)}`,
    });
  }
  // `concept_angles` through the brief's angle: angleId -> the paired concepts' generated names.
  const conceptNamesByAngle = new Map<string, string[]>();
  for (const concept of conceptRows.rows) {
    for (const angleId of concept.angleIds) {
      const names = conceptNamesByAngle.get(angleId) ?? [];
      names.push(concept.name);
      conceptNamesByAngle.set(angleId, names);
    }
  }

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
      performance: performanceView(row.performance),
      stage: briefStageView(row.internalStatus),
      row,
      // The brief's OWN angle and product first, then the pair inherited through the concept — the
      // order `brief-detail.tsx` documents, because `withInherited` follows the concept's FIRST
      // angle and that angle's FIRST product, which need not be the one this brief was briefed on.
      angleName: linkedName(row.angleId, angleNames) ?? row.angleName,
      productName: linkedName(row.productId, productNames) ?? row.productName,
      collectionName: linkedName(row.collectionId, collectionNames),
      campaignOfferName: linkedName(row.campaignOfferId, campaignNames),
      assetName: linkedName(row.assetId, assetNames),
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
      metaCopy: metaCopyByBrief.get(row.id) ?? [],
      conceptsFromAngles: briefConceptsFromAngles(
        row.angleId === null ? [] : (conceptNamesByAngle.get(row.angleId) ?? []),
      ),
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

  // The New brief dialog's Concept select (Oct 5 Agent 3). Server-resolved from the same
  // `loadConcepts` call that reads the grid's inherited pairs, so the dropdown and the inherited
  // block never show different concepts.
  const conceptOptions = conceptRows.rows.map((row) => ({ id: row.id, name: row.name }));

  return (
    <BriefsWorkspace
      columns={columns}
      unconfiguredColumns={unconfiguredColumns}
      items={visibleItems}
      conceptOptions={conceptOptions}
      demo={demo}
      initialSearch={initialSearch}
      initialView={initialView}
      initialKanbanField={requestedGroup ?? viewPref.kanbanGroupByField}
    />
  );
}
