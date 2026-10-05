import { lookupRollup, type CopyListRow } from '@tas/db';
import { copyTitle } from '@tas/domain/copy';
import { copyStatusLabel, copyStatusTone } from '@tas/domain/state';

import type {
  CopyBriefLookup,
  CopyLookupCampaign,
  CopyLookupCollection,
  CopyLookupProduct,
} from '@/lib/copy-source';
import { absoluteTime, relativeTime } from '@/lib/relative-time';
import { briefPath } from '@/lib/routes';

import { campaignLinks, collectionsByCopy, copyTypeIdsByCopy, type CopyItem } from './fields';

/**
 * The ONE place a `CopyListRow` becomes the `CopyItem` the grid and the panel render — used by
 * `page.tsx` over the loaders and by the `/design-system` story over the fixtures, so the story
 * mounts exactly what the product mounts and the two cannot drift.
 *
 * A SERVER module on purpose: it calls `lookupRollup` from `@tas/db`, which must never reach a
 * client bundle. Every lookup cell is computed here, once per row, from the linked tables the
 * workspace loader read on the page's one connection: a map per table, then a lookup per row —
 * never a query per row.
 */
export interface CopyItemSources {
  readonly rows: readonly CopyListRow[];
  readonly campaigns: readonly CopyLookupCampaign[];
  readonly collections: readonly CopyLookupCollection[];
  readonly products: readonly CopyLookupProduct[];
  readonly briefLookups: readonly CopyBriefLookup[];
  /** The brand's copy types as `loadCopyTypes` hands them over, Meta copies included. */
  readonly copyTypes: readonly {
    readonly id: string;
    readonly name: string;
    readonly metaCopies: readonly { readonly id: string }[];
  }[];
}

export function buildCopyItems(sources: CopyItemSources, now: Date): CopyItem[] {
  const typeIdsByCopy = copyTypeIdsByCopy(sources.copyTypes);
  const linkedCollectionsByCopy = collectionsByCopy(sources.collections);
  const campaignsById = new Map(sources.campaigns.map((campaign) => [campaign.id, campaign]));
  const campaignNamesById = new Map(
    sources.campaigns.map((campaign) => [campaign.id, campaign.name]),
  );
  const productsById = new Map(sources.products.map((product) => [product.id, product]));
  const briefAngleById = new Map(sources.briefLookups.map((brief) => [brief.id, brief.angleName]));
  const copyTypeNamesById = new Map(sources.copyTypes.map((type) => [type.id, type.name]));

  return sources.rows.map((row) => {
    const linkedCampaigns = row.campaignIds
      .map((id) => campaignsById.get(id))
      .filter((campaign) => campaign !== undefined);
    const linkedCollections = sources.collections.filter(
      (collection) => collection.copywritingId === row.id,
    );
    const product = row.productId === null ? undefined : productsById.get(row.productId);
    const copyTypeIds = typeIdsByCopy.get(row.id) ?? [];
    return {
      id: row.id,
      copyNumber: row.copyNumber,
      title: copyTitle(row.copyNumber),
      headline: row.headline,
      primaryCopy: row.primaryCopy,
      linkDescription: row.linkDescription,
      cta: row.cta,
      status: row.status,
      statusLabel: copyStatusLabel(row.status),
      statusTone: copyStatusTone(row.status),
      creativeBriefId: row.creativeBriefId,
      creativeName: row.creativeName,
      creativeHref: row.creativeBriefId === null ? null : briefPath(row.creativeBriefId),
      conceptId: row.conceptId,
      conceptName: row.conceptName,
      funnel: row.funnel,
      used: row.used,
      winning: row.winning,
      metaRating: row.metaRating,
      spellingFeedback: row.spellingFeedback,
      clientComment: row.clientComment,
      copyTypeIds,
      campaigns: campaignLinks(row.campaignIds, campaignNamesById),
      collections: linkedCollectionsByCopy.get(row.id) ?? [],
      // Oct 5 Linked Collection control: the first collection that still points at this copy, so
      // the control pre-fills with whatever the owner-side FK currently holds, or null when none.
      linkedCollectionId: linkedCollections[0]?.id ?? null,
      // The lookup cells, each `lookupRollup` over the linked rows' values — the same computation
      // the column's seeded formula names, and null (the em dash) when the link points at nothing.
      angleName:
        row.creativeBriefId === null
          ? null
          : lookupRollup([briefAngleById.get(row.creativeBriefId)]),
      productId: row.productId,
      productName: lookupRollup([product?.name]),
      productLink: lookupRollup([product?.link]),
      offer: lookupRollup(linkedCampaigns.map((campaign) => campaign.discountOffer)),
      campaignNames: lookupRollup(linkedCampaigns.map((campaign) => campaign.name)),
      campaignCodes: lookupRollup(linkedCampaigns.map((campaign) => campaign.code)),
      collectionUrls: lookupRollup(linkedCollections.map((collection) => collection.url)),
      collectionProducts: lookupRollup(
        linkedCollections.map((collection) => collection.productName),
      ),
      copyTypeNames: copyTypeIds
        .map((id) => copyTypeNamesById.get(id))
        .filter((name): name is string => name !== undefined),
      createdBy: row.createdBy,
      updatedLabel: relativeTime(row.updatedAt, now),
      updatedTitle: absoluteTime(row.updatedAt),
    };
  });
}
