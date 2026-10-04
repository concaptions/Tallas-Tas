import { lookupRollup, type YoutubeCopyListRow } from '@tas/db';
import { copyStatusLabel, copyStatusTone } from '@tas/domain/state';

import { absoluteTime, relativeTime } from '@/lib/relative-time';
import type { CollectionProductName } from '@/lib/youtube-copywriting-source';

import { copyNumberLabel, ctaLabel, funnelLabel, type YoutubeCopyItem } from './fields';

/**
 * The ONE place a `YoutubeCopyListRow` becomes the `YoutubeCopyItem` the grid and the panel
 * render — used by `page.tsx` over the loaders and by the `/design-system` story over the
 * fixtures, so the two cannot drift. A SERVER module on purpose: it calls `lookupRollup` from
 * `@tas/db`, which must never reach a client bundle (the reason it moved out of `fields.ts`).
 *
 * The lookup cells (GRATSI-MATCH, 2026-10-04) each roll up the linked rows the list row already
 * carries: `Offer` / `Campaign (from Campaign)` / `Code (from Campaign)` off `linkedCampaigns`
 * (`youtube_copy_campaigns` → `campaigns_offers.discount_offer/name/code`), `Collection URL` off
 * `linkedCollections`, `Link (from Product)` and `(Internal) Product` off `linkedProducts`, and
 * `Products (from Collections)` off each linked collection's own product — the one hop the row
 * does not carry, handed in as `collectionProducts` from the workspace loader's single read.
 */
export function buildYoutubeCopyItems(
  rows: readonly YoutubeCopyListRow[],
  collectionProducts: readonly CollectionProductName[],
  now: Date,
): YoutubeCopyItem[] {
  const productNameByCollection = new Map(
    collectionProducts.map((collection) => [collection.id, collection.productName]),
  );
  return rows.map((row) => ({
    id: row.id,
    copyNumber: row.copyNumber,
    title: copyNumberLabel(row.copyNumber),
    status: row.status,
    statusLabel: copyStatusLabel(row.status),
    statusTone: copyStatusTone(row.status),
    angle: row.angle,
    descriptions: row.descriptions,
    headline: row.headline,
    newsFeed: row.newsFeed,
    cta: row.cta,
    ctaLabel: ctaLabel(row.cta),
    funnel: row.funnel,
    funnelLabel: funnelLabel(row.funnel),
    clientComment: row.clientComment,
    used: row.used,
    winning: row.winning,
    metaRating: row.metaRating,
    linkedCollections: row.linkedCollections,
    linkedProducts: row.linkedProducts,
    linkedCampaigns: row.linkedCampaigns,
    linkedCopyTypes: row.linkedCopyTypes,
    offer: lookupRollup(row.linkedCampaigns.map((campaign) => campaign.offer)),
    campaignNames: lookupRollup(row.linkedCampaigns.map((campaign) => campaign.name)),
    campaignCodes: lookupRollup(row.linkedCampaigns.map((campaign) => campaign.code)),
    collectionUrls: lookupRollup(row.linkedCollections.map((collection) => collection.url)),
    productLinks: lookupRollup(row.linkedProducts.map((product) => product.link)),
    productsFromCollections: lookupRollup(
      row.linkedCollections.map((collection) => productNameByCollection.get(collection.id)),
    ),
    internalProduct: lookupRollup(row.linkedProducts.map((product) => product.name)),
    createdBy: row.createdBy,
    updatedLabel: relativeTime(row.updatedAt, now),
    updatedTitle: absoluteTime(row.updatedAt),
  }));
}
