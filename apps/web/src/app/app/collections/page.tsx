import { loadBriefs } from '@/lib/briefs-source';
import { isDemoMode } from '@/lib/demo-mode';
import { loadCampaigns } from '@/lib/campaigns-source';
import { loadCollectionColumns, loadCollections } from '@/lib/collections-source';
import { CONCEPT_TRACK, loadConcepts } from '@/lib/concepts-source';
import { loadCopy } from '@/lib/copy-source';
import { loadEmailCampaigns } from '@/lib/email-campaigns-source';
import { loadYoutubeCopyWorkspace } from '@/lib/youtube-copywriting-source';

import {
  creativeDesign2Link,
  hostLabel,
  indexConceptsByCollection,
  indexCreativeDesignsByCollection,
  indexEmailCampaignsByCollection,
  indexYoutubeCopyByCollection,
  metaCopyLink,
} from './fields';
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
 * The two-way links are resolved here as well: the email campaigns, YouTube copy, concepts and
 * briefs that point at a collection come from their own sources (fixtures in demo mode,
 * brand-scoped queries otherwise), are inverted by their junction or FK ids once, and reach the
 * panel as plain `LinkedRecord` arrays; the one Meta copy a collection's own `copywritingId` points
 * at is resolved from the Meta Copywriting rows the same way. No component ever sees a junction or
 * an FK. The concepts' status chip needs the track concepts run on, which lives next to their data
 * source as `CONCEPT_TRACK` and is read here, once, the way the Concepts page reads it.
 */
interface CollectionsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CollectionsPage({ searchParams }: CollectionsPageProps) {
  const [
    { rows },
    { columns, unconfigured },
    campaignRows,
    emailCampaignRows,
    youtubeCopyRows,
    conceptRows,
    briefRows,
    copyRows,
    params,
  ] = await Promise.all([
    loadCollections(),
    loadCollectionColumns(),
    loadCampaigns(),
    loadEmailCampaigns(),
    loadYoutubeCopyWorkspace(),
    loadConcepts(),
    loadBriefs(),
    loadCopy(),
    searchParams,
  ]);
  // The campaign picker's options (TASK 5): names, so nobody hand-types a uuid again.
  const campaigns = campaignRows.rows.map(({ id, name }) => ({ id, name }));
  const emailCampaignsByCollection = indexEmailCampaignsByCollection(emailCampaignRows.rows);
  const youtubeCopyByCollection = indexYoutubeCopyByCollection(youtubeCopyRows.rows);
  const conceptsByCollection = indexConceptsByCollection(conceptRows.rows, CONCEPT_TRACK);
  const creativeDesignsByCollection = indexCreativeDesignsByCollection(briefRows.rows);
  const demo = isDemoMode();

  const items: CollectionItem[] = rows.map((collection) => ({
    collection,
    urlHost: hostLabel(collection.url),
    emailCampaigns: emailCampaignsByCollection.get(collection.id) ?? [],
    youtubeCopy: youtubeCopyByCollection.get(collection.id) ?? [],
    concepts: conceptsByCollection.get(collection.id) ?? [],
    creativeDesigns: creativeDesignsByCollection.get(collection.id) ?? [],
    metaCopy: metaCopyLink(collection.copywritingId, copyRows.rows),
    creativeDesign2: creativeDesign2Link(collection.creativeDesign2Id, briefRows.rows),
  }));

  const requested = params.collection;
  const selection = typeof requested === 'string' && requested !== '' ? requested : null;

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  return (
    <CollectionsWorkspace
      columns={columns}
      unconfiguredColumns={unconfigured}
      items={items}
      campaigns={campaigns}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
    />
  );
}
