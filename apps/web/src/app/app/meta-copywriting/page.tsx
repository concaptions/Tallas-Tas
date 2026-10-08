import { permanentRedirect } from 'next/navigation';

import { copywritingPath } from '@/lib/routes';

/** `/app/meta-copywriting` moved to `/app/copywriting` (Oct 8 rename); the query survives. */
export default async function LegacyMetaCopywritingRedirect({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') params.set(key, value);
  }
  const query = params.toString();
  permanentRedirect(query === '' ? copywritingPath : `${copywritingPath}?${query}`);
}
