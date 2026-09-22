import type { ViewType } from '@tas/domain';

import { loadCampaigns } from '@/lib/campaigns-source';
import { isDemoMode } from '@/lib/demo-mode';
import { loadProducts } from '@/lib/products-source';
import { absoluteTime, relativeTime } from '@/lib/relative-time';

import type { LinkOption } from './campaigns-panel';
import { CampaignsWorkspace, type CampaignItem } from './campaigns-workspace';

const VALID_VIEWS = new Set<ViewType>(['grid', 'timeline']);

interface CampaignsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CampaignsPage({ searchParams }: CampaignsPageProps) {
  const [{ rows }, productRows, params] = await Promise.all([
    loadCampaigns(),
    loadProducts(),
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
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
      initialView={initialView}
    />
  );
}
