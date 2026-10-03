import { loadBriefs } from '@/lib/briefs-source';
import { loadClientAssetColumns, loadClientAssetFolders } from '@/lib/client-assets-source';
import { isDemoMode } from '@/lib/demo-mode';
import { absoluteTime, relativeTime } from '@/lib/relative-time';

import { ClientAssetsWorkspace, type ClientAssetFolderItem } from './client-assets-workspace';
import { hostLabel } from './fields';

/**
 * Client Assets (Airtable "Client Assets Organisation", audit §2.9): the folder-level organiser of
 * the material a client shares — a named pointer at a Drive folder or a Dropbox share, with a line
 * of description and the designs that start from it.
 *
 * A server component, shaped exactly like the Products page. The rows come from
 * `loadClientAssetFolders()`, which is the in-repo fixtures in demo mode and the brand-scoped query
 * otherwise; the page does not know which and does not branch on it. The chip picker in the panel
 * needs the brand's briefs, loaded through the same demo/live seam the Creative Design page uses,
 * so the picker never offers a record of another brand. Both pieces of table state are query
 * parameters — `?folder=` for the open panel and `?q=` for the filter.
 *
 * Every derived value is computed here, once: the link count (Airtable's record-link count, never a
 * stored column), the relative timestamp with a single `now` (a client that formatted it itself
 * would disagree with the server and break hydration) and the host of each location, so the grid
 * never has to shorten a URL while it renders.
 */
interface ClientAssetsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ClientAssetsPage({ searchParams }: ClientAssetsPageProps) {
  const [{ rows }, { columns, unconfigured: unconfiguredColumns }, briefResult, params] =
    await Promise.all([
      loadClientAssetFolders(),
      loadClientAssetColumns(),
      loadBriefs(),
      searchParams,
    ]);
  const demo = isDemoMode();
  const now = new Date();

  const items: ClientAssetFolderItem[] = rows.map((folder) => ({
    folder,
    locationHost: hostLabel(folder.locationUrl),
    designCount: folder.briefIds.length,
    updatedLabel: relativeTime(folder.updatedAt, now),
    updatedTitle: absoluteTime(folder.updatedAt),
  }));

  const briefOptions = briefResult.rows.map(({ id, name }) => ({ id, name }));

  const requested = params.folder;
  const selection = typeof requested === 'string' && requested !== '' ? requested : null;

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  return (
    <ClientAssetsWorkspace
      columns={columns}
      unconfiguredColumns={unconfiguredColumns}
      items={items}
      briefs={briefOptions}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
    />
  );
}
