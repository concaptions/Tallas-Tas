import {
  DEMO_ACTOR_ID,
  DEMO_BRAND_ID,
  demoCampaigns,
  demoCollections,
  demoProducts,
} from './demo-data';
import type {
  LinkedCampaign,
  LinkedCollection,
  LinkedProduct,
  YoutubeCopyListRow,
} from './youtube-copy';

/**
 * Four YouTube copy rows for Niagara Sleep Solutions (Airtable `tblVR1UmkbDoDzJ7z`): the words that
 * run on the pre-roll, one per demo angle. Same conventions as `demo-data.ts`: every id is a
 * hardcoded uuid and every timestamp a fixed ISO string, never `randomUUID()` or `new Date()` at
 * module scope, so the fixtures are comparable, linkable and renderable by id across processes.
 *
 * The record links point at the SEEDED collections, products and campaigns by their fixture ids,
 * and the `linked*` objects are built from those fixtures' own rows — the name, URL, code and offer
 * a lookup would read — so a renamed demo campaign cannot leave a stale name here. Copy types are
 * a sibling module's fixtures whose ids this file does not know, so every row starts with none
 * linked; the panel's picker still lists the brand's copy types.
 *
 * Every `descriptions` is at or under the 90 characters the panel and the action enforce, the four
 * rows sit in four different `COPY_STATUS` keys, exactly one is `edited_by_client` and it is the
 * only one carrying a client comment. The array is in `updated_at` descending order, the order
 * `listYoutubeCopy` returns, so a test can compare the two directly.
 */

const YOUTUBE_COPY_BODY_CLOCK_ID = 'a1b2c3d4-0012-4012-8012-000000000001';
const YOUTUBE_COPY_DAYLIGHT_ID = 'a1b2c3d4-0012-4012-8012-000000000002';
const YOUTUBE_COPY_THERMOSTAT_ID = 'a1b2c3d4-0012-4012-8012-000000000003';
const YOUTUBE_COPY_NINETY_MINUTES_ID = 'a1b2c3d4-0012-4012-8012-000000000004';

const PRODUCT_BLANKET_ID = '22222222-2222-4222-8222-000000000001';
const PRODUCT_MASK_ID = '22222222-2222-4222-8222-000000000002';
const PRODUCT_RESET_BUNDLE_ID = '22222222-2222-4222-8222-000000000003';
const CAMPAIGN_BFCM_ID = 'dddddddd-dddd-4ddd-8ddd-000000000001';
const CAMPAIGN_VDAY_ID = 'dddddddd-dddd-4ddd-8ddd-000000000002';
const CAMPAIGN_SUMMER_ID = 'dddddddd-dddd-4ddd-8ddd-000000000003';
const COLLECTION_BFCM_ID = '11223344-1122-4334-8556-000000000001';
const COLLECTION_SUMMER_ID = '11223344-1122-4334-8556-000000000002';

const at = (iso: string): Date => new Date(iso);

/** The shared columns every demo row carries, as `demo-data.ts` builds them for a propagated table. */
function propagationBase(id: string, created: string, updated: string) {
  return {
    id,
    createdAt: at(created),
    updatedAt: at(updated),
    createdBy: DEMO_ACTOR_ID,
    updatedBy: DEMO_ACTOR_ID,
    deletedAt: null,
    legacyAirtableId: null as string | null,
    templateRowId: null as string | null,
    overriddenFields: [] as string[],
    customFields: {} as Record<string, unknown>,
  };
}

/** One seeded fixture by id; a missing id is a broken fixture, not a runtime case. */
function demoRow<Row extends { id: string }>(rows: readonly Row[], id: string, what: string): Row {
  const row = rows.find((candidate) => candidate.id === id);
  if (row === undefined) throw new Error(`demo ${what} ${id} is missing`);
  return row;
}

function linkedCollection(id: string): LinkedCollection {
  const row = demoRow(demoCollections, id, 'collection');
  return { id: row.id, name: row.name, url: row.url };
}

function linkedProduct(id: string): LinkedProduct {
  const row = demoRow(demoProducts, id, 'product');
  return { id: row.id, name: row.name, link: row.link };
}

function linkedCampaign(id: string): LinkedCampaign {
  const row = demoRow(demoCampaigns, id, 'campaign');
  return { id: row.id, name: row.name, code: row.code, offer: row.discountOffer };
}

export const demoYoutubeCopy: YoutubeCopyListRow[] = [
  {
    ...propagationBase(
      YOUTUBE_COPY_BODY_CLOCK_ID,
      '2026-09-02T09:10:00.000Z',
      '2026-09-17T10:20:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    copyNumber: 1,
    status: 'approved',
    angle: 'Your Body Clock Is Not Broken',
    descriptions: 'Weighted, breathable, 90-night trial. Fall asleep faster without overheating.',
    headline: 'Sleep Like Your Shift Never Happened',
    newsFeed: 'Niagara Deep Sleep Weighted Blanket',
    cta: 'shop_now',
    funnel: 'tof',
    clientComment: null,
    used: true,
    winning: true,
    metaRating: 5,
    linkedCollections: [linkedCollection(COLLECTION_BFCM_ID)],
    linkedProducts: [linkedProduct(PRODUCT_BLANKET_ID)],
    linkedCampaigns: [linkedCampaign(CAMPAIGN_BFCM_ID)],
    linkedCopyTypes: [],
  },
  {
    ...propagationBase(
      YOUTUBE_COPY_DAYLIGHT_ID,
      '2026-09-04T11:30:00.000Z',
      '2026-09-15T16:45:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    copyNumber: 2,
    status: 'pending_for_client_review',
    angle: 'Make 9am Look Like 3am',
    descriptions: 'Blocks 186 lux of morning light. Cooling gel stays cold until noon. Ships free.',
    headline: 'Blackout For People Who Sleep In Daylight',
    newsFeed: 'Niagara Cooling Blackout Sleep Mask',
    cta: 'learn_more',
    funnel: 'mof_bof',
    clientComment: null,
    used: false,
    winning: false,
    metaRating: null,
    linkedCollections: [linkedCollection(COLLECTION_SUMMER_ID)],
    linkedProducts: [linkedProduct(PRODUCT_MASK_ID)],
    linkedCampaigns: [linkedCampaign(CAMPAIGN_SUMMER_ID)],
    linkedCopyTypes: [],
  },
  {
    ...propagationBase(
      YOUTUBE_COPY_THERMOSTAT_ID,
      '2026-09-06T14:00:00.000Z',
      '2026-09-13T09:05:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    copyNumber: 3,
    status: 'edited_by_client',
    angle: 'Nobody Wins The Thermostat Argument',
    descriptions: 'One side weighted, one side cooling. The bundle that ends the thermostat war.',
    headline: 'Two Sleepers. One Bed. Zero Arguments.',
    newsFeed: 'Night Reset Bundle — Blanket + Mask',
    cta: 'get_offer',
    funnel: 'bof',
    clientComment:
      'We softened "war" to "argument" in the description ourselves — our audience skews older and the support team flagged the word. The headline is great, keep it. Please also drop the em dash in the News Feed line; YouTube renders it as a hyphen on mobile.',
    used: false,
    winning: false,
    metaRating: 3,
    linkedCollections: [linkedCollection(COLLECTION_BFCM_ID)],
    linkedProducts: [linkedProduct(PRODUCT_RESET_BUNDLE_ID)],
    linkedCampaigns: [linkedCampaign(CAMPAIGN_BFCM_ID)],
    linkedCopyTypes: [],
  },
  {
    ...propagationBase(
      YOUTUBE_COPY_NINETY_MINUTES_ID,
      '2026-09-08T08:20:00.000Z',
      '2026-09-10T15:40:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    copyNumber: 4,
    status: 'revisions_needed',
    angle: 'Sleep In The Ninety Minutes You Actually Get',
    descriptions:
      'Ninety minutes is enough when nothing wakes you. Mask and blanket, gift-wrapped.',
    headline: 'The Gift For The One Who Never Sleeps',
    newsFeed: null,
    cta: null,
    funnel: 'all_funnels',
    clientComment: null,
    used: false,
    winning: false,
    metaRating: 1,
    linkedCollections: [],
    // Name order, the order `listYoutubeCopy` returns: the mask sorts before the blanket.
    linkedProducts: [linkedProduct(PRODUCT_MASK_ID), linkedProduct(PRODUCT_BLANKET_ID)],
    linkedCampaigns: [linkedCampaign(CAMPAIGN_VDAY_ID)],
    linkedCopyTypes: [],
  },
];
