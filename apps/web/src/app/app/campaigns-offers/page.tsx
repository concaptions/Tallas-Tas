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
  // Meta copy ("Campaign Code", copywriting_campaigns) and Concepts (the field named "Angles",
  // campaign_concepts) — both read from the far side's own id arrays.
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
      metaCopyLinks={metaCopyLinks}
      conceptLinks={conceptLinks}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
      initialView={initialView}
    />
  );
}
