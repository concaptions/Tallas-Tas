import type { ViewType } from '@tas/domain';

import { loadBriefs, loadNextBriefNumber } from '@/lib/briefs-source';
import { loadConcepts } from '@/lib/concepts-source';
import { loadCreativeSheetColumns, loadCreativeSheetWorkspace } from '@/lib/creative-sheet-source';
import { isDemoMode } from '@/lib/demo-mode';
import { loadUserViews } from '@/lib/user-view-actions';
import { loadViewPreference } from '@/lib/view-preference-actions';

import { buildSheetItems } from './build-items';
import { CreativeSheetWorkspace } from './creative-sheet-workspace';
import type { EditorBoardBrief } from './editor-board';
import type { ConceptOption } from './new-creative-dialog';
import { GROUP_PARAM, isKanbanField, SEARCH_PARAM, SELECTION_PARAM } from './fields';

/**
 * Creative Sheet (Airtable `tblGC0TxnHI7lKaNQ`): the month's client-facing sheet, one row per
 * creative, each named by the month it was created and the creative it links to.
 *
 * A server component, shaped exactly like the Products page. The rows and every linked table the
 * `Creative Name` lookup columns read — briefs, angles, products, concepts,
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
 *
 * Ticket 7: the sheet joins the per-user views (`loadUserViews`, the Sprint 7 store every other
 * table reads), and the board's field is remembered per viewer and brand in the Sprint 5 preference
 * (`loadViewPreference`): a `?groupBy=` in the URL wins, the stored field is next, Internal Status
 * last. The preference's view type is the one the table OPENS on with no `?view=` and no active
 * saved view — never an override of a saved view's own type.
 */
interface CreativeSheetPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata = {
  title: 'Creative Sheet — TAS Creative Platform',
};

const VALID_VIEWS = new Set<ViewType>(['grid', 'kanban', 'focus']);

export default async function CreativeSheetPage({ searchParams }: CreativeSheetPageProps) {
  const [
    workspace,
    { columns, unconfigured: unconfiguredColumns },
    briefResult,
    conceptResult,
    nextNumber,
    params,
    userViews,
    viewPref,
  ] = await Promise.all([
    loadCreativeSheetWorkspace(),
    loadCreativeSheetColumns(),
    loadBriefs(),
    loadConcepts(),
    loadNextBriefNumber(),
    searchParams,
    loadUserViews('creative-sheet'),
    loadViewPreference('creative-sheet'),
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

  // A `?view=` is an override of the saved view's own type, applied once; none means no override.
  const requestedView = params.view;
  const initialView: ViewType | null =
    typeof requestedView === 'string' && VALID_VIEWS.has(requestedView as ViewType)
      ? (requestedView as ViewType)
      : null;

  const requestedGroupBy = params[GROUP_PARAM] ?? params.group;
  const storedKanbanField = viewPref.kanbanGroupByField;
  const initialKanbanField =
    typeof requestedGroupBy === 'string' && isKanbanField(requestedGroupBy)
      ? requestedGroupBy
      : storedKanbanField !== null && isKanbanField(storedKanbanField)
        ? storedKanbanField
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
      defaultView={viewPref.viewType}
      initialKanbanField={initialKanbanField}
      userViews={userViews}
    />
  );
}
