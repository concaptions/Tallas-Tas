import type { ViewType } from '@tas/domain';

import { loadBriefs } from '@/lib/briefs-source';
import { loadCreativeSheetColumns, loadCreativeSheetWorkspace } from '@/lib/creative-sheet-source';
import { isDemoMode } from '@/lib/demo-mode';

import { buildSheetItems } from './build-items';
import type { LinkOption } from './creative-sheet-panel';
import { CreativeSheetWorkspace } from './creative-sheet-workspace';
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
 * inside a component. The brief picker's options come from `loadBriefs()`, the same source the
 * Creative Design page reads. Table state is query parameters — `?creative-sheet=` for the open
 * panel, `?q=` for the filter, `?view=` and `?groupBy=` for the board — so a refresh restores the
 * view.
 */
interface CreativeSheetPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const VALID_VIEWS = new Set<ViewType>(['grid', 'kanban']);

export default async function CreativeSheetPage({ searchParams }: CreativeSheetPageProps) {
  const [workspace, { columns, unconfigured: unconfiguredColumns }, briefResult, params] =
    await Promise.all([
      loadCreativeSheetWorkspace(),
      loadCreativeSheetColumns(),
      loadBriefs(),
      searchParams,
    ]);
  const demo = isDemoMode();

  const items = buildSheetItems(workspace, new Date());

  const briefs: LinkOption[] = briefResult.rows.map(({ id, name }) => ({ id, name }));

  const requested = params[SELECTION_PARAM];
  const selection = typeof requested === 'string' && requested !== '' ? requested : null;

  const requestedSearch = params[SEARCH_PARAM];
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  const requestedView = params.view;
  const initialView: ViewType =
    typeof requestedView === 'string' && VALID_VIEWS.has(requestedView as ViewType)
      ? (requestedView as ViewType)
      : 'grid';

  const requestedGroupBy = params.groupBy;
  const initialKanbanField =
    typeof requestedGroupBy === 'string' && isKanbanField(requestedGroupBy)
      ? requestedGroupBy
      : 'internalStatus';

  return (
    <CreativeSheetWorkspace
      columns={columns}
      unconfiguredColumns={unconfiguredColumns}
      items={items}
      briefs={briefs}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
      initialView={initialView}
      initialKanbanField={initialKanbanField}
    />
  );
}
