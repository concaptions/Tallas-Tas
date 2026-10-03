import { getTableCapability, type ViewType } from '@tas/domain';

import { loadCampaigns } from '@/lib/campaigns-source';
import { loadCollections } from '@/lib/collections-source';
import { isDemoMode } from '@/lib/demo-mode';
import { loadEmailCampaignColumns, loadEmailCampaigns } from '@/lib/email-campaigns-source';
import { loadProducts } from '@/lib/products-source';
import { loadTeam } from '@/lib/team-source';

import type { EmailCampaignLinkOption } from './email-campaign-panel';
import { EmailCampaignsWorkspace } from './email-campaigns-workspace';
import { isGroupField, toEmailCampaignItem, type EmailCampaignGroupField } from './fields';

/**
 * Email Campaigns (Airtable "Email Campaigns Management", `tblABjVpwRpYtY7de`; audit §2.10): one
 * row per planned email, SMS or push send, internal only.
 *
 * A server component shaped exactly like the Products page. The rows come from
 * `loadEmailCampaigns()` — fixtures in demo mode, the brand-scoped query otherwise — already
 * carrying the two formula due dates, the assignee name and the linked names, so nothing is derived
 * in a component. The linked tables' options for the panel's pickers come from their own sources
 * (`loadCampaigns`, `loadProducts`, `loadCollections`) and the Assignee options from `loadTeam`.
 * Every piece of table state is a query parameter: `?emailCampaign=` for the open panel, `?q=` for
 * the filter, `?view=` for grid/kanban/timeline and `?group=` for the board's grouping.
 *
 * The relative timestamps are computed here, once, with a single `now`, so server and client agree.
 */
interface EmailCampaignsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const CAP = getTableCapability('email-campaigns');

export default async function EmailCampaignsPage({ searchParams }: EmailCampaignsPageProps) {
  const [
    { rows },
    { columns, unconfigured: unconfiguredColumns },
    campaignRows,
    productRows,
    collectionRows,
    teamRows,
    params,
  ] = await Promise.all([
    loadEmailCampaigns(),
    loadEmailCampaignColumns(),
    loadCampaigns(),
    loadProducts(),
    loadCollections(),
    loadTeam(),
    searchParams,
  ]);
  const demo = isDemoMode();
  const now = new Date();

  const items = rows.map((row) => toEmailCampaignItem(row, now));
  const option = ({ id, name }: { id: string; name: string }): EmailCampaignLinkOption => ({
    id,
    name,
  });
  const campaignOptions = campaignRows.rows.map(option);
  const productOptions = productRows.rows.map(option);
  const collectionOptions = collectionRows.rows.map(option);
  const assigneeOptions = teamRows.rows.map((member) => ({
    id: member.clerkUserId,
    name: member.fullName,
  }));

  const requested = params.emailCampaign;
  const selection = typeof requested === 'string' && requested !== '' ? requested : null;

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  const requestedView = params.view;
  const supported = CAP?.supportedViews ?? ['grid'];
  const initialView: ViewType =
    typeof requestedView === 'string' && (supported as readonly string[]).includes(requestedView)
      ? (requestedView as ViewType)
      : 'grid';

  const requestedGroup = params.group;
  const initialGroupField: EmailCampaignGroupField =
    typeof requestedGroup === 'string' && isGroupField(requestedGroup) ? requestedGroup : 'status';

  return (
    <EmailCampaignsWorkspace
      columns={columns}
      unconfiguredColumns={unconfiguredColumns}
      items={items}
      campaignOptions={campaignOptions}
      productOptions={productOptions}
      collectionOptions={collectionOptions}
      assigneeOptions={assigneeOptions}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
      initialView={initialView}
      initialGroupField={initialGroupField}
    />
  );
}
