import { supportsView, type ViewType } from '@tas/domain';

import { isDemoMode } from '@/lib/demo-mode';
import { loadSmCampaignFeedTasks } from '@/lib/sm-campaign-feed-source';
import { loadViewPreference } from '@/lib/view-preference-actions';

import { buildSmTaskItem } from './fields';
import { SmCampaignFeedWorkspace } from './sm-campaign-feed-workspace';

/**
 * SM Campaign Feed (Airtable `tblLRajTW55XEhVhk`, module parity 2026-10-01): the social-media task
 * feed — one row per scheduled post or campaign chore.
 *
 * A server component, shaped exactly like the Products page. The rows come from
 * `loadSmCampaignFeedTasks()`, which is the in-repo fixtures in demo mode and the brand-scoped query
 * otherwise; the page does not know which and does not branch on it. The three pieces of table state
 * are query parameters — `?task=` for the open panel, `?q=` for the filter and `?view=` for grid or
 * kanban — so a refresh restores the view and any of them is shareable as a link. It renders into the
 * shell's `<main>` and owns no frame, padding or background of its own.
 *
 * Every derived string is computed here, once, with a single `now`: the due label, the Reminder
 * Trigger (Airtable's formula, true from twelve hours before the due moment while the task is not
 * done) and the relative timestamp. A component that read the clock itself would disagree with the
 * server and break hydration, so none does.
 */
const TABLE_KEY = 'sm-campaign-feed';

interface SmCampaignFeedPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SmCampaignFeedPage({ searchParams }: SmCampaignFeedPageProps) {
  const [{ rows }, params, viewPref] = await Promise.all([
    loadSmCampaignFeedTasks(),
    searchParams,
    loadViewPreference(TABLE_KEY, 'grid'),
  ]);
  const demo = isDemoMode();
  const now = new Date();

  const items = rows.map((task) => buildSmTaskItem(task, now));

  const requested = params.task;
  const selection = typeof requested === 'string' && requested !== '' ? requested : null;

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  // `?view=` overrides the saved view when it names one this table supports, so the board is
  // reachable and shareable by URL even though the grid is the default.
  const requestedView =
    typeof params.view === 'string' && supportsView(TABLE_KEY, params.view as ViewType)
      ? (params.view as ViewType)
      : null;

  return (
    <SmCampaignFeedWorkspace
      items={items}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
      initialView={requestedView ?? viewPref.viewType}
      initialKanbanField={viewPref.kanbanGroupByField}
    />
  );
}
