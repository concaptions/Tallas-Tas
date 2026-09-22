import { isDemoMode } from '@/lib/demo-mode';
import { loadCollections } from '@/lib/collections-source';
import { absoluteTime, relativeTime } from '@/lib/relative-time';

import { hostLabel } from './fields';
import { CollectionsWorkspace, type CollectionItem } from './collections-workspace';

/**
 * Collections: groupings of creatives and campaigns around a campaign, angle and product (schema at
 * `packages/db/src/schema/collections.ts`).
 *
 * A server component, shaped exactly like the Products page. The rows come from `loadCollections()`,
 * which is the in-repo fixtures in demo mode and the brand-scoped query otherwise; the page does not
 * know which and does not branch on it. Both pieces of table state are query parameters —
 * `?collection=` for the open panel and `?q=` for the filter — so a refresh restores the view and
 * either one is shareable as a link. It renders into the shell's `<main>` and owns no frame, padding
 * or background of its own.
 *
 * The relative timestamp is computed here, once, with a single `now`: a client that formatted it
 * itself would disagree with the server and break hydration. The URL host is computed here too, so
 * the table never has to shorten a URL while it renders.
 */
interface CollectionsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CollectionsPage({ searchParams }: CollectionsPageProps) {
  const [{ rows }, params] = await Promise.all([loadCollections(), searchParams]);
  const demo = isDemoMode();
  const now = new Date();

  const items: CollectionItem[] = rows.map((collection) => ({
    collection,
    urlHost: hostLabel(collection.url),
    updatedLabel: relativeTime(collection.updatedAt, now),
    updatedTitle: absoluteTime(collection.updatedAt),
  }));

  const requested = params.collection;
  const selection = typeof requested === 'string' && requested !== '' ? requested : null;

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  return (
    <CollectionsWorkspace
      items={items}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
    />
  );
}
