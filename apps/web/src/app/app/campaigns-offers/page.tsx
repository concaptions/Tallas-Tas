import type { ViewType } from '@tas/domain';

import { loadCampaignColumns, loadCampaigns } from '@/lib/campaigns-source';
import { loadCollections } from '@/lib/collections-source';
import { isDemoMode } from '@/lib/demo-mode';
import { loadEmailCampaigns } from '@/lib/email-campaigns-source';
import { loadEmailFlows } from '@/lib/email-flows-source';
import { loadProducts } from '@/lib/products-source';
import { loadYoutubeCopyWorkspace } from '@/lib/youtube-copywriting-source';

import type { LinkOption } from './campaigns-panel';
import { CampaignsWorkspace, type CampaignItem } from './campaigns-workspace';
import { copyStatusLabel, copyStatusTone } from '@tas/domain/state';

import { loadConcepts } from '@/lib/concepts-source';
import { loadCopyWorkspace } from '@/lib/copy-source';
import { conceptPath, metaCopywritingPath } from '@/lib/routes';

import {
  emailCampaignLink,
  emailFlowLink,
  indexByCampaign,
  youtubeCopyLink,
  youtubeCopyLinkLabel,
} from './fields';

const VALID_VIEWS = new Set<ViewType>(['grid', 'timeline']);

interface CampaignsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CampaignsPage({ searchParams }: CampaignsPageProps) {
  const [
    { rows },
    { columns, unconfigured },
    productRows,
    collectionRows,
    emailCampaignRows,
    emailFlowRows,
    { rows: youtubeCopyRows },
    copyWorkspace,
    conceptRows,
    params,
  ] = await Promise.all([
    loadCampaigns(),
    loadCampaignColumns(),
    loadProducts(),
    loadCollections(),
    loadEmailCampaigns(),
    loadEmailFlows(),
    loadYoutubeCopyWorkspace(),
    loadCopyWorkspace(),
    loadConcepts(),
    searchParams,
  ]);
  const demo = isDemoMode();

  const products: LinkOption[] = productRows.rows.map(({ id, name }) => ({ id, name }));
  const productNames = new Map(productRows.rows.map(({ id, name }) => [id, name]));

  // The campaigns side of Collections ↔ Campaigns (TASK 5): `collections.campaign_id` read the
  // other way round, so the GRID's `Collections` column and the panel can NAME the collections
  // running on a campaign. One pass over rows already loaded — never a per-campaign query.
  const collectionNames: Record<string, string[]> = {};
  for (const collection of collectionRows.rows) {
    if (collection.campaignId === null) continue;
    (collectionNames[collection.campaignId] ??= []).push(collection.name);
  }

  // The campaign side of the junction links (module parity, phase 2; GRATSI-MATCH campaigns_offers
  // makes them grid columns too): `email_campaign_campaigns`, `email_flow_campaigns`,
  // `youtube_copy_campaigns`, `copywriting_campaigns` and `campaign_concepts`, each read from the
  // far side's own id arrays. The sources are demo-aware, so the fixtures invert exactly as the
  // database rows do.
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
  const metaCopyLinks = indexByCampaign(
    copyWorkspace.rows,
    (row) => row.campaignIds,
    (row) => ({
      id: row.id,
      label: youtubeCopyLinkLabel(row.copyNumber, row.headline),
      href: `${metaCopywritingPath}?copy=${encodeURIComponent(row.id)}`,
      chip: { label: copyStatusLabel(row.status), tone: copyStatusTone(row.status) },
    }),
  );
  const conceptLinks = indexByCampaign(
    conceptRows.rows,
    (row) => row.campaignIds,
    (row) => ({ id: row.id, label: row.name, href: conceptPath(row.id) }),
  );

  const items: CampaignItem[] = rows.map((campaign) => ({
    campaign,
    productName:
      campaign.productId === null ? null : (productNames.get(campaign.productId) ?? null),
    collections: collectionNames[campaign.id] ?? [],
    emailCampaigns: emailCampaignLinks[campaign.id] ?? [],
    emailFlows: emailFlowLinks[campaign.id] ?? [],
    youtubeCopy: youtubeCopyLinks[campaign.id] ?? [],
    metaCopy: metaCopyLinks[campaign.id] ?? [],
    concepts: conceptLinks[campaign.id] ?? [],
  }));

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
      columns={columns}
      unconfiguredColumns={unconfigured}
      items={items}
      products={products}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
      initialView={initialView}
    />
  );
}
