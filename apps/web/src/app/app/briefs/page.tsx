import type { BriefRow } from '@/lib/briefs-source';
import { loadBriefs } from '@/lib/briefs-source';
import { loadViewPreference } from '@/lib/view-preference-actions';
import { isDemoMode } from '@/lib/demo-mode';
import { briefPath } from '@/lib/routes';

import { BriefsWorkspace } from './briefs-workspace';
import {
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
    loadViewPreference('briefs'),
  ]);
  const demo = isDemoMode();

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

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  return (
    <BriefsWorkspace
      items={items}
      demo={demo}
      initialSearch={initialSearch}
      initialView={viewPref.viewType}
      initialKanbanField={viewPref.kanbanGroupByField}
    />
  );
}
