import { redirect } from 'next/navigation';

/**
 * Client Assets was merged into the Asset Library (Task C, 2026-10-07). This page redirects to the
 * unified Asset Library with the "Client Folders" tab active, so existing links and bookmarks keep
 * working. The `client-assets` workspace components and their actions are retained in case a future
 * ticket restores a standalone page; the redirect is the only change.
 */
export default function ClientAssetsPage() {
  redirect('/app/assets?tab=client-folders');
}
