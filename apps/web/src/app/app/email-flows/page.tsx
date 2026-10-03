import type { ViewType } from '@tas/domain';

import { loadCampaigns } from '@/lib/campaigns-source';
import { isDemoMode } from '@/lib/demo-mode';
import { loadEmailFlowColumns, loadEmailFlows } from '@/lib/email-flows-source';
import { loadTeam } from '@/lib/team-source';

import type { LinkOption } from './email-flows-panel';
import { EmailFlowsWorkspace } from './email-flows-workspace';
import { emailFlowItem, isKanbanGroupField, type KanbanGroupField } from './fields';

/**
 * Email Flows (Airtable "Email Flows Management", `tblubVflAQZgJSxcF`): one row per automated
 * Klaviyo flow — welcome series, abandoned cart, back in stock — as opposed to the one-off sends on
 * the Email Campaigns page.
 *
 * A server component, shaped exactly like the Products page. The rows come from `loadEmailFlows()`,
 * which is the in-repo fixtures in demo mode and the brand-scoped query otherwise; the page does
 * not know which and does not branch on it. The campaign options for the panel's chip picker come
 * from `loadCampaigns()` and the assignee options from `loadTeam()`, the same way. Every piece of
 * table state is a query parameter — `?email-flow=` for the open panel, `?q=` for the filter,
 * `?view=` for grid or kanban and `?group=` for the board's field — so a refresh restores the view
 * and any of them is shareable as a link.
 *
 * Every derived string is computed here, once, by `emailFlowItem`: the relative timestamp with a
 * single `now` (a client that formatted it itself would disagree with the server and break
 * hydration), the three formatted dates and the Klaviyo host.
 */
interface EmailFlowsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const VALID_VIEWS = new Set<ViewType>(['grid', 'kanban']);

export default async function EmailFlowsPage({ searchParams }: EmailFlowsPageProps) {
  const [
    { rows },
    { columns, unconfigured: unconfiguredColumns },
    campaignResult,
    teamResult,
    params,
  ] = await Promise.all([
    loadEmailFlows(),
    loadEmailFlowColumns(),
    loadCampaigns(),
    loadTeam(),
    searchParams,
  ]);
  const demo = isDemoMode();
  const now = new Date();

  const items = rows.map((flow) => emailFlowItem(flow, now));
  const campaigns: LinkOption[] = campaignResult.rows.map(({ id, name }) => ({ id, name }));
  const assignees: LinkOption[] = teamResult.rows.map(({ clerkUserId, fullName }) => ({
    id: clerkUserId,
    name: fullName,
  }));

  const requested = params['email-flow'];
  const selection = typeof requested === 'string' && requested !== '' ? requested : null;

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  const requestedView = params.view;
  const initialView: ViewType =
    typeof requestedView === 'string' && VALID_VIEWS.has(requestedView as ViewType)
      ? (requestedView as ViewType)
      : 'grid';

  const requestedGroup = params.group;
  const initialGroupField: KanbanGroupField =
    typeof requestedGroup === 'string' && isKanbanGroupField(requestedGroup)
      ? requestedGroup
      : 'status';

  return (
    <EmailFlowsWorkspace
      columns={columns}
      unconfiguredColumns={unconfiguredColumns}
      items={items}
      campaigns={campaigns}
      assignees={assignees}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
      initialView={initialView}
      initialGroupField={initialGroupField}
    />
  );
}
