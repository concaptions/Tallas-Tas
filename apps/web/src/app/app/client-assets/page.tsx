import { permanentRedirect } from 'next/navigation';

import { removedWorkspaceRedirect, type SearchParams } from '@/lib/removed-workspaces';

/**
 * Client Assets was merged into the Asset Library (Task C, 2026-10-07) and then retired for every
 * brand with the Oct 7 template cleanup (`REMOVED_WORKSPACES` in `@tas/domain`; docs/decisions.md
 * "2026-10-09 — Template cleanup"). The old address lands on the Asset Library's "Client Folders"
 * tab — the target is read from the domain's redirect map, not spelled here — permanently, so a
 * bookmark or a Slack link updates itself. The `client-assets` workspace components and their
 * actions are retained, unmounted, in case a future ticket restores a standalone page.
 */
export default async function RetiredClientAssetsRedirect({
  searchParams,
}: {
  readonly searchParams: Promise<SearchParams>;
}) {
  permanentRedirect(removedWorkspaceRedirect('client-assets', await searchParams));
}
