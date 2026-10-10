import type { ViewType } from '@tas/domain';

import { loadBriefs, loadNextBriefNumber } from '@/lib/briefs-source';
import { loadConcepts } from '@/lib/concepts-source';
import { loadCreativeSheetColumns, loadCreativeSheetWorkspace } from '@/lib/creative-sheet-source';
import { isDemoMode } from '@/lib/demo-mode';

import { buildSheetItems } from './build-items';
import { CreativeSheetWorkspace } from './creative-sheet-workspace';
import type { EditorBoardBrief } from './editor-board';
import type { ConceptOption } from './new-creative-dialog';
import { isKanbanField, SEARCH_PARAM, SELECTION_PARAM } from './fields';

/**
 * Creative Sheet (Airtable `tblGC0TxnHI7lKaNQ`): the month's client-facing sheet, one row per
 * creative, each named by the month it was created and the creative it links to.
 *
 * A server component, shaped exactly like the Products page. The rows and every linked table the
 * thirteen `Creative Name` lookup columns read — briefs, angles, products, collections, concepts,
 * modules and the Meta copy rows — come from `loadCreativeSheetWorkspace()` on one connection
 * (GRATSI-MATCH, 2026-10-04): fixtures in demo mode, the brand-scoped queries otherwise; the page
 * does not know which and does not branch on it. The computed name arrives on the row from the
 * query layer, and the lookup cells are computed once in `buildSheetItems` — nothing is computed
 * inside a component. The "Editing stage" board's cards come from `loadBriefs()`, every brief of
 * the brand, the same source the Creative Design page read; the
 * "New creative" dialog's Concept select comes from `loadConcepts()`. Table
 * state is query parameters — `?creative-sheet=` for the open panel, `?q=` for the filter, `?view=`
 * and `?groupBy=` for the board — so a refresh restores the view. `?group=` is accepted as an alias
 * of `?groupBy=`: the retired Creative Design list's `?group=editorStage` redirects here with its
 * query string, so an old bookmark of the editor board still lands on it.
 */
interface CreativeSheetPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata = {
  title: 'Creative Sheet — TAS Creative Platform',
};

const VALID_VIEWS = new Set<ViewType>(['grid', 'kanban']);

export default async function CreativeSheetPage({ searchParams }: CreativeSheetPageProps) {
  const [
    workspace,
    { columns, unconfigured: unconfiguredColumns },
    briefResult,
    conceptResult,
    nextNumber,
    params,
  ] = await Promise.all([
    loadCreativeSheetWorkspace(),
    loadCreativeSheetColumns(),
    loadBriefs(),
    loadConcepts(),
    loadNextBriefNumber(),
    searchParams,
  ]);
  const demo = isDemoMode();

  const items = buildSheetItems(workspace, new Date());

  const boardBriefs: EditorBoardBrief[] = briefResult.rows.map(
    ({ id, name, internalStatus, type, priority, assignee }) => ({
      id,
      name,
      internalStatus,
      type,
      priority,
      assignee,
    }),
  );

  // "New creative": the Concept select, and the preview's number read by the allocator's own rule
  // (`loadNextBriefNumber`, SMOKE-15) so the dialog and the save never disagree.
  const conceptOptions: ConceptOption[] = conceptResult.rows.map(({ id, name, batch }) => ({
    id,
    name,
    batch,
  }));

  const requested = params[SELECTION_PARAM];
  const selection = typeof requested === 'string' && requested !== '' ? requested : null;

  const requestedSearch = params[SEARCH_PARAM];
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  const requestedView = params.view;
  const initialView: ViewType =
    typeof requestedView === 'string' && VALID_VIEWS.has(requestedView as ViewType)
      ? (requestedView as ViewType)
      : 'grid';

  const requestedGroupBy = params.groupBy ?? params.group;
  const initialKanbanField =
    typeof requestedGroupBy === 'string' && isKanbanField(requestedGroupBy)
      ? requestedGroupBy
      : 'internalStatus';

  return (
    <CreativeSheetWorkspace
      columns={columns}
      unconfiguredColumns={unconfiguredColumns}
      items={items}
      boardBriefs={boardBriefs}
      conceptOptions={conceptOptions}
      nextNumber={nextNumber}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
      initialView={initialView}
      initialKanbanField={initialKanbanField}
    />
  );
}
