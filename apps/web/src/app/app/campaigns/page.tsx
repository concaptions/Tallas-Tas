import { permanentRedirect } from 'next/navigation';

import { campaignsOffersPath } from '@/lib/routes';

/** `/app/campaigns` moved to `/app/campaigns-offers` (module parity, 2026-10-01); the query survives. */
export default async function LegacyCampaignsRedirect({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') params.set(key, value);
  }
  const query = params.toString();
  permanentRedirect(query === '' ? campaignsOffersPath : `${campaignsOffersPath}?${query}`);
}
