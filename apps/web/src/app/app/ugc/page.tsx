import { isR2Available } from '@tas/db';

import { loadConcepts } from '@/lib/concepts-source';
import { isDemoMode } from '@/lib/demo-mode';
import { loadProducts } from '@/lib/products-source';
import { loadCollaborations, loadCreatorVideos, loadUgc } from '@/lib/ugc-source';
import { loadUserViews } from '@/lib/user-view-actions';

import {
  partnershipRow,
  tabFromParam,
  type CollabRow,
  type CreatorPanelRow,
  type PartnershipRow,
} from './fields';
import { UgcWorkspace } from './ugc-workspace';

interface UgcPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function UgcPage({ searchParams }: UgcPageProps) {
  const [{ creators, partnerships, now }, conceptResult, productResult, userViews, params] =
    await Promise.all([
      loadUgc(),
      loadConcepts(),
      loadProducts(),
      loadUserViews('creators'),
      searchParams,
    ]);
  const demo = isDemoMode();

  // `CreatorPanelRow`, not `CreatorCardRow`: the full shape, so a panel column this map forgets is
  // a type error here rather than an empty control.
  const cards: CreatorPanelRow[] = creators.map((row) => ({
    id: row.id,
    name: row.name,
    gender: row.gender,
    ageBracket: row.ageBracket,
    platform: row.platform,
    profilePicUrl: row.profilePicUrl,
    videoIntroUrl: row.videoIntroUrl,
    internalCreatorStatus: row.internalCreatorStatus,
    clientStatus: row.clientStatus,
    internalAssetsStatus: row.internalAssetsStatus,
    clientNote: row.clientNote,
    rawAssetsUrl: row.rawAssetsUrl,
    conceptIds: row.conceptIds,
    productIds: row.productIds,
    ethnicity: row.ethnicity,
    creatorLink: row.creatorLink,
    shippingLocation: row.shippingLocation,
    trackingNumber: row.trackingNumber,
    internalBrief: row.internalBrief,
    dateOfManagement: row.dateOfManagement,
    budgetPer60s: row.budgetPer60s,
    creatorCost: row.creatorCost,
    costUsd: row.costUsd,
    partnershipPricePer30Days: row.partnershipPricePer30Days,
    paymentDate: row.paymentDate,
    creatorInfoRequest: row.creatorInfoRequest,
    slackNotified: row.slackNotified,
    instagramUsername: row.instagramUsername,
    facebookProfileUrl: row.facebookProfileUrl,
    partnershipActivity: row.partnershipActivity,
    partnershipActivatedAt: row.partnershipActivatedAt,
    partnershipPeriodDays: row.partnershipPeriodDays,
    extensionDays: row.extensionDays,
    continueWorkingWith: row.continueWorkingWith,
    partnershipNotes: row.partnershipNotes,
  }));

  const rows: PartnershipRow[] = partnerships.map((row) => partnershipRow(row, now));

  const conceptOptions = conceptResult.rows.map(({ id, name }) => ({ id, name }));
  const productOptions = productResult.rows.map(({ id, name }) => ({ id, name }));

  const requestedTab = params.tab;
  const initialTab = tabFromParam(typeof requestedTab === 'string' ? requestedTab : null);

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  const requestedCreator = params.creator;
  const initialSelection =
    typeof requestedCreator === 'string' && requestedCreator !== '' ? requestedCreator : null;

  const [collabResult, videoResult] =
    initialSelection === null
      ? [null, null]
      : await Promise.all([
          loadCollaborations(initialSelection),
          loadCreatorVideos(initialSelection),
        ]);
  const videos = (videoResult?.rows ?? []).map((row) => ({
    id: row.id,
    url: row.url,
    filename: row.filename,
    caption: row.caption,
  }));
  const collabs: CollabRow[] = (collabResult?.rows ?? []).map((row) => ({
    id: row.id,
    conceptId: row.conceptId,
    briefId: row.briefId,
    costUsd: row.costUsd,
    startDate: row.startDate,
    endDate: row.endDate,
    internalStatus: row.internalStatus,
    clientStatus: row.clientStatus,
    assetsStatus: row.assetsStatus,
    notes: row.notes,
  }));

  return (
    <UgcWorkspace
      creators={cards}
      partnerships={rows}
      concepts={conceptOptions}
      products={productOptions}
      demo={demo}
      initialTab={initialTab}
      initialSearch={initialSearch}
      initialSelection={initialSelection}
      initialCollabs={collabs}
      initialVideos={videos}
      uploadsEnabled={!demo && isR2Available()}
      userViews={userViews}
    />
  );
}
