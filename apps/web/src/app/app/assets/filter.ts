import { assetCategories, type AssetCategory } from '@tas/db/schema';

import { assetsPath } from '@/lib/routes';

/**
 * The Asset Library's type filter as URL state (2026-10-09, audit item 4): `?type=<category>` is
 * the chip the viewer picked, so a refresh, a shared link or the browser's back button restores it.
 * `?tab=client-folders` is kept as the Client Folders chip because the retired `/app/client-assets`
 * route permanently redirects to exactly that address (`lib/removed-workspaces.ts`).
 *
 * Pure: the page parses the request's params with `assetLibraryFilterFrom` and the grid writes the
 * address back with `assetLibraryHref`, so the two cannot disagree about what a chip is called.
 * Imported by a client component, so the vocabulary comes from `@tas/db/schema`, never from the
 * package root (which reaches the Postgres driver).
 */
export const ASSET_TYPE_PARAM = 'type';
export const ASSET_TAB_PARAM = 'tab';
export const CLIENT_FOLDERS_FILTER = 'client-folders';

export type AssetLibraryFilter = AssetCategory | 'all' | typeof CLIENT_FOLDERS_FILTER;

function isAssetCategory(value: string): value is AssetCategory {
  return (assetCategories as readonly string[]).includes(value);
}

/** The filter a request asks for; anything unknown is "all", never an error page. */
export function assetLibraryFilterFrom(
  params: Readonly<Record<string, string | string[] | undefined>>,
): AssetLibraryFilter {
  const tab = params[ASSET_TAB_PARAM];
  if (tab === CLIENT_FOLDERS_FILTER) {
    return CLIENT_FOLDERS_FILTER;
  }
  const type = params[ASSET_TYPE_PARAM];
  return typeof type === 'string' && isAssetCategory(type) ? type : 'all';
}

/** The address of a filter: the bare library for "all", `?type=` for a category, `?tab=` for folders. */
export function assetLibraryHref(filter: AssetLibraryFilter): string {
  if (filter === 'all') {
    return assetsPath;
  }
  if (filter === CLIENT_FOLDERS_FILTER) {
    return `${assetsPath}?${ASSET_TAB_PARAM}=${CLIENT_FOLDERS_FILTER}`;
  }
  return `${assetsPath}?${ASSET_TYPE_PARAM}=${encodeURIComponent(filter)}`;
}
