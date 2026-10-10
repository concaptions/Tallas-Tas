import { conceptPerformance } from '@tas/db';

import { loadBriefs } from '@/lib/briefs-source';
import { loadCampaigns } from '@/lib/campaigns-source';
import { CONCEPT_TRACK, loadConceptColumns, loadConcepts } from '@/lib/concepts-source';
import { isDemoMode } from '@/lib/demo-mode';
import { loadUgc } from '@/lib/ugc-source';
import { loadUserViews } from '@/lib/user-view-actions';
import { briefPath, conceptPath, ugcPath } from '@/lib/routes';

import {
  conceptProductionStatusLabel,
  conceptCategoryLabel,
  conceptStyleLabel,
} from '@tas/domain/concepts';

import {
  clientApprovalView,
  clientStatusView,
  conceptViewFromParam,
  internalStatusView,
  type ConceptItem,
  type ConceptLinkedRecord,
} from './fields';
import { ConceptsWorkspace } from './concepts-workspace';

/**
 * Concepts (PRD §5.7): one Angle paired with one Theme, named `Batch-Angle-Theme` and never typed
 * by hand.
 *
 * A server component, shaped exactly like the Personas, Products, Angles and Themes pages. The rows
 * come from `loadConcepts()`, which is the in-repo fixtures in demo mode and the brand-scoped query
 * otherwise; the page does not know which and does not branch on it. It renders into the shell's
 * `<main>` and therefore owns no frame, padding or background of its own.
 *
 * THE STATUS IS RESOLVED HERE, ONCE. `CONCEPT_TRACK` lives next to the data source because that is
 * where the stored strings are narrowed, and `@/lib/concepts-source` imports `@tas/db` — so it can
 * only ever be read on the server. Each row is therefore handed down as a `ConceptItem` carrying
 * its label and chip tone already looked up through `@tas/domain/state`, which is what keeps the
 * database driver out of the browser bundle AND keeps every status decision in one module. The
 * track is read ONLY here now: the Kanban board that also needed it left the data tables with
 * action item 18, so the client component no longer takes a `track` prop.
 *
 * Both pieces of list state are query parameters — `?view=table` or `?view=gallery` for the toggle
 * and `?q=` for the search, the same key the Products, Angles and Themes pages use — so a refresh
 * restores the view and the narrowed list someone is looking at is a link they can send. `board` is
 * still narrowed rather than rejected, so an old board link opens on the grid (action item 18). `conceptViewFromParam` narrows the raw view here, on the server, so the client component is
 * handed a value it can only render; the search is free text and is passed through as typed.
 *
 * The rows arrive newest edit first from `loadConcepts()`, so this page never sorts.
 */
interface ConceptsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ConceptsPage({ searchParams }: ConceptsPageProps) {
  const [
    { rows },
    { columns, unconfigured: unconfiguredColumns },
    params,
    ugc,
    campaignRows,
    briefRows,
  ] = await Promise.all([
    loadConcepts(),
    loadConceptColumns(),
    searchParams,
    // GRATSI-MATCH 2026-10-04: the three tables behind the base's linked-record columns and its
    // Performance lookup — each read through its own demo-aware loader, indexed once below.
    loadUgc(),
    loadCampaigns(),
    loadBriefs(),
  ]);
  const demo = isDemoMode();
  const userViews = await loadUserViews('concepts');

  // One map per linked table, built once, rather than a `find` per row per column.
  const creatorNames = new Map(ugc.creators.map((creator) => [creator.id, creator.name]));
  const campaignNames = new Map(campaignRows.rows.map((campaign) => [campaign.id, campaign.name]));
  // `creative_briefs.concept_id` read backwards: conceptId -> §7 names, and the briefs'
  // performances the `conceptPerformance` lookup reads.
  const briefsByConcept = new Map<string, ConceptLinkedRecord[]>();
  const briefPerformancesByConcept = new Map<string, (string | null)[]>();
  for (const brief of briefRows.rows) {
    if (brief.conceptId === null) continue;
    const linked = briefsByConcept.get(brief.conceptId) ?? [];
    linked.push({ id: brief.id, label: brief.name, href: briefPath(brief.id) });
    briefsByConcept.set(brief.conceptId, linked);
    const performances = briefPerformancesByConcept.get(brief.conceptId) ?? [];
    performances.push(brief.performance);
    briefPerformancesByConcept.set(brief.conceptId, performances);
  }

  const items: ConceptItem[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    batch: row.batch,
    angleName: row.angleName,
    personaName: row.personaName,
    productName: row.productName,
    themeName: row.themeName,
    status: internalStatusView(CONCEPT_TRACK, row.internalStatus),
    href: conceptPath(row.id),
    clientStatus: clientStatusView(row.clientStatus),
    clientApproval: clientApprovalView(row.clientApprovalStatus),
    productionStatusLabel:
      row.productionStatus === null ? null : conceptProductionStatusLabel(row.productionStatus),
    categoryLabel: row.category === null ? null : conceptCategoryLabel(row.category),
    styleLabel: row.conceptStyle === null ? null : conceptStyleLabel(row.conceptStyle),
    formatsToCreate: row.formatsToCreate,
    formats: row.formats,
    hookExamples: row.hookExamples,
    scriptIdea: row.scriptIdea,
    description: row.description,
    painPoints: row.painPoints,
    usp: row.usp,
    clientComments: row.clientComments,
    collectionName: row.collectionName,
    creatorCount: row.creatorIds.length,
    adInspoCount: row.adInspoLinks.length,
    creators: row.creatorIds.flatMap((id) => {
      const label = creatorNames.get(id);
      return label === undefined
        ? []
        : [{ id, label, href: `${ugcPath}?creator=${encodeURIComponent(id)}` }];
    }),
    campaigns: row.campaignIds.flatMap((id) => {
      const label = campaignNames.get(id);
      return label === undefined ? [] : [{ id, label }];
    }),
    creativeDesigns: briefsByConcept.get(row.id) ?? [],
    performance: conceptPerformance(briefPerformancesByConcept.get(row.id) ?? []),
  }));

  const requested = params.view;
  const view = conceptViewFromParam(typeof requested === 'string' ? requested : null);

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  return (
    <ConceptsWorkspace
      columns={columns}
      unconfiguredColumns={unconfiguredColumns}
      items={items}
      demo={demo}
      initialView={view}
      initialSearch={initialSearch}
      userViews={userViews}
    />
  );
}
