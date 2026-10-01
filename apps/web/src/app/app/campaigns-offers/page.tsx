import type { ViewType } from '@tas/domain';

import { loadCampaigns } from '@/lib/campaigns-source';
import { loadCollections } from '@/lib/collections-source';
import { isDemoMode } from '@/lib/demo-mode';
import { loadEmailCampaigns } from '@/lib/email-campaigns-source';
import { loadEmailFlows } from '@/lib/email-flows-source';
import { loadProducts } from '@/lib/products-source';
import { absoluteTime, relativeTime } from '@/lib/relative-time';
import { loadYoutubeCopyWorkspace } from '@/lib/youtube-copywriting-source';

import type { LinkOption } from './campaigns-panel';
import { CampaignsWorkspace, type CampaignItem } from './campaigns-workspace';
import { emailCampaignLink, emailFlowLink, indexByCampaign, youtubeCopyLink } from './fields';

const VALID_VIEWS = new Set<ViewType>(['grid', 'timeline']);

interface CampaignsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CampaignsPage({ searchParams }: CampaignsPageProps) {
  const [
    { rows },
    productRows,
    collectionRows,
    emailCampaignRows,
    emailFlowRows,
    { rows: youtubeCopyRows },
    params,
  ] = await Promise.all([
    loadCampaigns(),
    loadProducts(),
    loadCollections(),
    loadEmailCampaigns(),
    loadEmailFlows(),
    loadYoutubeCopyWorkspace(),
    searchParams,
  ]);
  const demo = isDemoMode();
  const now = new Date();

  const items: CampaignItem[] = rows.map((campaign) => ({
    campaign,
    updatedLabel: relativeTime(campaign.updatedAt, now),
    updatedTitle: absoluteTime(campaign.updatedAt),
  }));

  const products: LinkOption[] = productRows.rows.map(({ id, name }) => ({ id, name }));

  // The campaigns side of Collections ↔ Campaigns (TASK 5): `collections.campaign_id` read the
  // other way round, so the panel can NAME the collections running on a campaign.
  const collectionNames: Record<string, string[]> = {};
  for (const collection of collectionRows.rows) {
    if (collection.campaignId === null) continue;
    (collectionNames[collection.campaignId] ??= []).push(collection.name);
  }

  // The campaign side of three more links (module parity, phase 2), each owned by the other
  // module's panel and read back here through its junction: `email_campaign_campaigns`,
  // `email_flow_campaigns` and `youtube_copy_campaigns`. The sources are demo-aware, so the
  // fixtures' id arrays invert exactly as the database rows do.
  const emailCampaignLinks = indexByCampaign(
    emailCampaignRows.rows,
    (row) => row.campaignOfferIds,
    emailCampaignLink,
  );
  const emailFlowLinks = indexByCampaign(
    emailFlowRows.rows,
    (row) => row.campaignIds,
    emailFlowLink,
  );
  const youtubeCopyLinks = indexByCampaign(
    youtubeCopyRows,
    (row) => row.linkedCampaigns.map((campaign) => campaign.id),
    youtubeCopyLink,
  );

  const requested = params.campaign;
  const selection = typeof requested === 'string' && requested !== '' ? requested : null;

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  const requestedView = params.view;
  const initialView: ViewType =
    typeof requestedView === 'string' && VALID_VIEWS.has(requestedView as ViewType)
      ? (requestedView as ViewType)
      : 'grid';

  return (
    <CampaignsWorkspace
      items={items}
      products={products}
      collectionNames={collectionNames}
      emailCampaignLinks={emailCampaignLinks}
      emailFlowLinks={emailFlowLinks}
      youtubeCopyLinks={youtubeCopyLinks}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
      initialView={initialView}
    />
  );
}
