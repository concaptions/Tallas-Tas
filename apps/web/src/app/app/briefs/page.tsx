import { permanentRedirect } from 'next/navigation';

import { creativeDesignPath } from '@/lib/routes';

/** `/app/briefs` moved to `/app/creative-design` (module parity, 2026-10-01); the query survives. */
export default async function LegacyBriefsRedirect({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') params.set(key, value);
  }
  const query = params.toString();
  permanentRedirect(query === '' ? creativeDesignPath : `${creativeDesignPath}?${query}`);
}
