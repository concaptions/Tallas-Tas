import { CONCEPT_TRACK, loadConceptColumns, loadConcepts } from '@/lib/concepts-source';
import { isDemoMode } from '@/lib/demo-mode';
import { loadUserViews } from '@/lib/user-view-actions';
import { conceptPath } from '@/lib/routes';

import {
  conceptApprovalStatusLabel,
  conceptCategoryLabel,
  conceptStyleLabel,
} from '@tas/domain/concepts';

import {
  clientStatusView,
  conceptViewFromParam,
  internalStatusView,
  type ConceptItem,
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
  const [{ rows }, { columns, unconfigured: unconfiguredColumns }, params] = await Promise.all([
    loadConcepts(),
    loadConceptColumns(),
    searchParams,
  ]);
  const demo = isDemoMode();
  const userViews = await loadUserViews('concepts');

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
    approvalStatusLabel:
      row.approvalStatus === null ? null : conceptApprovalStatusLabel(row.approvalStatus),
    categoryLabel: row.category === null ? null : conceptCategoryLabel(row.category),
    styleLabel: row.conceptStyle === null ? null : conceptStyleLabel(row.conceptStyle),
    formatsToCreate: row.formatsToCreate,
    hookExamples: row.hookExamples,
    scriptIdea: row.scriptIdea,
    description: row.description,
    painPoints: row.painPoints,
    usp: row.usp,
    clientComments: row.clientComments,
    collectionName: row.collectionName,
    creatorCount: row.creatorIds.length,
    adInspoCount: row.adInspoLinks.length,
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
