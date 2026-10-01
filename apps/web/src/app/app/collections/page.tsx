import { isDemoMode } from '@/lib/demo-mode';
import { loadCampaigns } from '@/lib/campaigns-source';
import { loadCollections } from '@/lib/collections-source';
import { loadEmailCampaigns } from '@/lib/email-campaigns-source';
import { loadYoutubeCopyWorkspace } from '@/lib/youtube-copywriting-source';
import { absoluteTime, relativeTime } from '@/lib/relative-time';

import { hostLabel, indexEmailCampaignsByCollection, indexYoutubeCopyByCollection } from './fields';
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
 *
 * The two-way links are resolved here as well: the email campaigns and YouTube copy that point at
 * a collection come from their own sources (fixtures in demo mode, brand-scoped queries otherwise),
 * are inverted by their junction ids once, and reach the panel as plain `LinkedRecord` arrays. No
 * component ever sees a junction.
 */
interface CollectionsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CollectionsPage({ searchParams }: CollectionsPageProps) {
  const [{ rows }, campaignRows, emailCampaignRows, youtubeCopyRows, params] = await Promise.all([
    loadCollections(),
    loadCampaigns(),
    loadEmailCampaigns(),
    loadYoutubeCopyWorkspace(),
    searchParams,
  ]);
  // The campaign picker's options (TASK 5): names, so nobody hand-types a uuid again.
  const campaigns = campaignRows.rows.map(({ id, name }) => ({ id, name }));
  const emailCampaignsByCollection = indexEmailCampaignsByCollection(emailCampaignRows.rows);
  const youtubeCopyByCollection = indexYoutubeCopyByCollection(youtubeCopyRows.rows);
  const demo = isDemoMode();
  const now = new Date();

  const items: CollectionItem[] = rows.map((collection) => ({
    collection,
    urlHost: hostLabel(collection.url),
    updatedLabel: relativeTime(collection.updatedAt, now),
    updatedTitle: absoluteTime(collection.updatedAt),
    emailCampaigns: emailCampaignsByCollection.get(collection.id) ?? [],
    youtubeCopy: youtubeCopyByCollection.get(collection.id) ?? [],
  }));

  const requested = params.collection;
  const selection = typeof requested === 'string' && requested !== '' ? requested : null;

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  return (
    <CollectionsWorkspace
      items={items}
      campaigns={campaigns}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
    />
  );
}
