import { permanentRedirect } from 'next/navigation';

import { briefPath } from '@/lib/routes';

/** `/app/briefs/<id>` moved under `/app/creative-design` (module parity, 2026-10-01). */
export default async function LegacyBriefRedirect({
  params,
}: {
  readonly params: Promise<{ briefId: string }>;
}) {
  const { briefId } = await params;
  permanentRedirect(briefPath(briefId));
}
