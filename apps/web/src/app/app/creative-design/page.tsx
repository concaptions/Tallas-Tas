import { permanentRedirect } from 'next/navigation';

import { removedWorkspaceRedirect, type SearchParams } from '@/lib/removed-workspaces';

/**
 * The Creative Design LIST was retired for every brand (Talal 2026-10-07, `REMOVED_WORKSPACES` in
 * `@tas/domain`; docs/decisions.md "2026-10-09 — Template cleanup"). Its job — every brief in one
 * grid or board — is the Creative Sheet's, so the old address lands there, query string and all.
 *
 * This segment has no `layout.tsx` guard ON PURPOSE: `./[briefId]/` is the brief detail page, which
 * stays live because the Internal and Client queues and the client portal open briefs by id. A
 * segment layout would redirect those too, so only the list page redirects. `briefs-workspace.tsx`,
 * `fields.ts`, `actions.ts` and the rest of this folder are kept, unmounted, for the day the key is
 * deleted from the list.
 */
export default async function RetiredCreativeDesignListRedirect({
  searchParams,
}: {
  readonly searchParams: Promise<SearchParams>;
}) {
  permanentRedirect(removedWorkspaceRedirect('briefs', await searchParams));
}
