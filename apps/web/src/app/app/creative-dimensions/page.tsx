import { permanentRedirect } from 'next/navigation';

import { removedWorkspaceRedirect, type SearchParams } from '@/lib/removed-workspaces';

/**
 * Creative Dimensions was retired for every brand (Talal 2026-10-07, `REMOVED_WORKSPACES` in
 * `@tas/domain`; docs/decisions.md "2026-10-09 — Template cleanup"). The `creative_dimensions`
 * table and its rows stay — the Creative Sheet reads them for its Dimensions column — but the
 * lookup page has no successor, so the old address lands on the Overview. This segment never had a
 * `layout.tsx` guard, which is why the page itself redirects; `creative-dimensions-workspace.tsx`,
 * `fields.ts` and `actions.ts` are kept, unmounted, for the day the key is deleted from the list.
 */
export default async function RetiredCreativeDimensionsRedirect({
  searchParams,
}: {
  readonly searchParams: Promise<SearchParams>;
}) {
  permanentRedirect(removedWorkspaceRedirect('creative-dimensions', await searchParams));
}
