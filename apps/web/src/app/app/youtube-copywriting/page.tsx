import { permanentRedirect } from 'next/navigation';

import { removedWorkspaceRedirect, type SearchParams } from '@/lib/removed-workspaces';

/**
 * Oct 14 follow-up #4 (`docs/sprint-oct12.md`): YouTube Copywriting is a retired workspace
 * (`REMOVED_WORKSPACES` in `@tas/domain`) that redirects to `/app/copywriting`. The previous
 * sectionGuard-based layout redirect dropped the visitor's query string because a layout in Next
 * 15 does not receive `searchParams`. Moving the redirect to the page level keeps the Oct 7
 * retirement in place and lets a bookmarked `?utm_source=…` ride through to the live route.
 *
 * The page runs no data load of its own; the sectionGuard layout is gone from this folder (the
 * parent /app layout still wraps the response) so the redirect can take the searchParams.
 */
interface YoutubeCopywritingPageProps {
  readonly searchParams: Promise<SearchParams>;
}

export default async function YoutubeCopywritingPage({
  searchParams,
}: YoutubeCopywritingPageProps) {
  const params = await searchParams;
  permanentRedirect(removedWorkspaceRedirect('youtube-copywriting', params));
}
