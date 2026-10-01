import type { ViewType } from '@tas/domain';

import { loadBriefs } from '@/lib/briefs-source';
import { loadCreativeSheetItems } from '@/lib/creative-sheet-source';
import { isDemoMode } from '@/lib/demo-mode';
import { absoluteTime, relativeTime } from '@/lib/relative-time';

import type { LinkOption } from './creative-sheet-panel';
import { CreativeSheetWorkspace, type SheetItemView } from './creative-sheet-workspace';
import { isKanbanField, SEARCH_PARAM, SELECTION_PARAM } from './fields';

/**
 * Creative Sheet (Airtable `tblGC0TxnHI7lKaNQ`): the month's client-facing sheet, one row per
 * creative, each named by the month it was created and the creative it links to.
 *
 * A server component, shaped exactly like the Products page. The rows come from
 * `loadCreativeSheetItems()`, which is the in-repo fixtures in demo mode and the brand-scoped query
 * otherwise; the page does not know which and does not branch on it. The computed name and the
 * brief's lookups arrive on the row from the query layer — nothing is computed inside a component.
 * The brief picker's options come from `loadBriefs()`, the same source the Creative Design page
 * reads. Table state is query parameters — `?creative-sheet=` for the open panel, `?q=` for the
 * filter, `?view=` and `?groupBy=` for the board — so a refresh restores the view.
 */
interface CreativeSheetPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const VALID_VIEWS = new Set<ViewType>(['grid', 'kanban']);

export default async function CreativeSheetPage({ searchParams }: CreativeSheetPageProps) {
  const [{ rows }, briefResult, params] = await Promise.all([
    loadCreativeSheetItems(),
    loadBriefs(),
    searchParams,
  ]);
  const demo = isDemoMode();
  const now = new Date();

  const items: SheetItemView[] = rows.map((item) => ({
    item,
    updatedLabel: relativeTime(item.updatedAt, now),
    updatedTitle: absoluteTime(item.updatedAt),
  }));

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
