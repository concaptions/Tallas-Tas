import { loadConcepts } from '@/lib/concepts-source';
import { isDemoMode } from '@/lib/demo-mode';
import { loadProducts } from '@/lib/products-source';
import { loadCollaborations, loadUgc } from '@/lib/ugc-source';

import {
  partnershipRow,
  tabFromParam,
  type CollabRow,
  type CreatorCardRow,
  type PartnershipRow,
} from './fields';
import { UgcWorkspace } from './ugc-workspace';

interface UgcPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function UgcPage({ searchParams }: UgcPageProps) {
  const [{ creators, partnerships, now }, conceptResult, productResult, params] = await Promise.all(
    [loadUgc(), loadConcepts(), loadProducts(), searchParams],
  );
  const demo = isDemoMode();

  const cards: CreatorCardRow[] = creators.map((row) => ({
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
    rawAssetsUrl: row.rawAssetsUrl,
    conceptIds: row.conceptIds,
    productIds: row.productIds,
    ethnicity: row.ethnicity,
    creatorLink: row.creatorLink,
    shippingLocation: row.shippingLocation,
    trackingNumber: row.trackingNumber,
    internalBrief: row.internalBrief,
    costUsd: row.costUsd,
    partnershipPricePer30Days: row.partnershipPricePer30Days,
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

  const collabResult =
    initialSelection !== null ? await loadCollaborations(initialSelection) : null;
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
    />
  );
}
