import { DEMO_ACTOR_ID, DEMO_BRAND_ID } from './demo-data';
import { emailCampaignDueDates, type EmailCampaignListRow } from './email-campaigns';

/**
 * The Email Campaigns fixtures the app serves in DEMO MODE (Airtable "Email Campaigns Management",
 * `tblABjVpwRpYtY7de`). Same conventions as `demo-data.ts`: every id is a hardcoded uuid, every
 * timestamp a fixed ISO string (never `new Date()` at module scope), and each row is typed as the
 * query layer's `EmailCampaignListRow`, so a fixture and a database row are one shape. The due dates
 * come from `emailCampaignDueDates`, the one place the base's two formulas live, so a fixture can
 * never disagree with a live row. The rows are ordered newest edit first, as `listEmailCampaigns`
 * returns them.
 *
 * The links point at the demo brand's own campaigns, products and collections (`demoCampaigns`,
 * `demoProducts`, `demoCollections` in `demo-data.ts`); the ids are repeated here rather than
 * imported because those modules do not export them, and the names are the names those fixtures
 * carry. `assignee_id` is a Clerk user id from `demoUsers`, with the matching full name beside it.
 */
const at = (iso: string): Date => new Date(iso);

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

const EMAIL_BFCM_EARLY_ACCESS_ID = 'ee11ee11-ee11-4e11-8e11-000000000001';
const EMAIL_CYBER_MONDAY_SMS_ID = 'ee11ee11-ee11-4e11-8e11-000000000002';
const EMAIL_VALENTINE_BUNDLE_ID = 'ee11ee11-ee11-4e11-8e11-000000000003';
const EMAIL_WINTER_SLEEP_GUIDE_ID = 'ee11ee11-ee11-4e11-8e11-000000000004';
const EMAIL_SUMMER_COOLING_PUSH_ID = 'ee11ee11-ee11-4e11-8e11-000000000005';

/** `demoCampaigns` ids and names. */
const CAMPAIGN_BFCM_ID = 'dddddddd-dddd-4ddd-8ddd-000000000001';
const CAMPAIGN_VDAY_ID = 'dddddddd-dddd-4ddd-8ddd-000000000002';
const CAMPAIGN_SUMMER_ID = 'dddddddd-dddd-4ddd-8ddd-000000000003';
const CAMPAIGN_BFCM_NAME = 'BFCM-20%OFF-BFCM26';
const CAMPAIGN_VDAY_NAME = 'Valentine-15%OFF-VDAY27';
const CAMPAIGN_SUMMER_NAME = 'Summer Sale-Buy 2 Get 1 Free-SUM26';

/** `demoProducts` ids and names. */
const PRODUCT_BLANKET_ID = '22222222-2222-4222-8222-000000000001';
const PRODUCT_MASK_ID = '22222222-2222-4222-8222-000000000002';
const PRODUCT_RESET_BUNDLE_ID = '22222222-2222-4222-8222-000000000003';
const PRODUCT_BLANKET_NAME = 'Niagara Deep Sleep Weighted Blanket';
const PRODUCT_MASK_NAME = 'Niagara Cooling Blackout Sleep Mask';
const PRODUCT_RESET_BUNDLE_NAME = 'Niagara Night Reset Bundle (Blanket + Mask)';

/** `demoCollections` ids and names. */
const COLLECTION_BFCM_ID = '11223344-1122-4334-8556-000000000001';
const COLLECTION_SUMMER_ID = '11223344-1122-4334-8556-000000000002';
const COLLECTION_BFCM_NAME = 'BFCM 2026 Collection';
const COLLECTION_SUMMER_NAME = 'Summer Cooling Collection';

/** `demoUsers` Clerk ids and names. */
const USER_DESIGNER = { id: 'user_seed_designer', name: 'Rhiannon Okafor' };
const USER_STRATEGIST = { id: DEMO_ACTOR_ID, name: 'Dorian Vance' };
const USER_VIDEO_EDITOR = { id: 'user_seed_video_editor', name: 'Imogen Bardsley' };
const USER_CSM = { id: 'user_seed_csm', name: 'Callum Ashworth' };

export const demoEmailCampaigns: EmailCampaignListRow[] = [
  {
    ...propagationBase(
      EMAIL_BFCM_EARLY_ACCESS_ID,
      '2026-09-01T09:00:00.000Z',
      '2026-09-18T16:20:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    name: 'BFCM Early Access — VIP list',
    campaignPurpose:
      'Open the BFCM window two days early for the VIP segment: the bundle at 20% off before the public sale, with the discount code in the hero.',
    status: 'template_design',
    sendDate: '2026-11-20',
    ...emailCampaignDueDates('2026-11-20'),
    copywriting:
      'Subject: Your early access starts now\n\nYou asked for first dibs. The Night Reset Bundle is 20% off for VIPs only until Friday — code BFCM26 at checkout.',
    assigneeId: USER_DESIGNER.id,
    assigneeName: USER_DESIGNER.name,
    copyLink: 'https://docs.example/d/bfcm-early-access-copy',
    design: ['https://r2.example/email/bfcm-early-access-hero.png'],
    klaviyoLink: 'https://klaviyo.example/campaigns/bfcm-early-access',
    assets: [
      'https://r2.example/email/bfcm-bundle-flatlay.jpg',
      'https://r2.example/email/bfcm-badge-20off.png',
    ],
    type: 'sale_campaign',
    channel: 'email',
    campaignOfferIds: [CAMPAIGN_BFCM_ID],
    campaignOfferNames: [CAMPAIGN_BFCM_NAME],
    productIds: [PRODUCT_BLANKET_ID, PRODUCT_RESET_BUNDLE_ID],
    productNames: [PRODUCT_BLANKET_NAME, PRODUCT_RESET_BUNDLE_NAME],
    collectionIds: [COLLECTION_BFCM_ID],
    collectionNames: [COLLECTION_BFCM_NAME],
  },
  {
    ...propagationBase(
      EMAIL_CYBER_MONDAY_SMS_ID,
      '2026-09-05T11:30:00.000Z',
      '2026-09-17T10:05:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    name: 'Cyber Monday last call — SMS',
    campaignPurpose: 'Final-hours SMS to everyone who opened the BFCM email but has not ordered.',
    status: 'copywriting',
    sendDate: '2026-11-30',
    ...emailCampaignDueDates('2026-11-30'),
    copywriting: null,
    assigneeId: USER_STRATEGIST.id,
    assigneeName: USER_STRATEGIST.name,
    copyLink: 'https://docs.example/d/cyber-monday-sms',
    design: null,
    klaviyoLink: null,
    assets: null,
    type: 'flash_sale',
    channel: 'sms',
    campaignOfferIds: [CAMPAIGN_BFCM_ID],
    campaignOfferNames: [CAMPAIGN_BFCM_NAME],
    productIds: [PRODUCT_MASK_ID],
    productNames: [PRODUCT_MASK_NAME],
    collectionIds: [],
    collectionNames: [],
  },
  {
    ...propagationBase(
      EMAIL_VALENTINE_BUNDLE_ID,
      '2026-09-08T14:00:00.000Z',
      '2026-09-16T09:45:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    name: 'Valentine couples bundle',
    campaignPurpose:
      'Position the weighted blanket as a gift for two; the client asked for a softer headline and a second product shot.',
    status: 'client_edits_required',
    sendDate: '2027-02-07',
    ...emailCampaignDueDates('2027-02-07'),
    copywriting:
      'Subject: The gift you will both fight over\n\nOne blanket, two better nights. 15% off until the 14th with VDAY27.',
    assigneeId: USER_CSM.id,
    assigneeName: USER_CSM.name,
    copyLink: 'https://docs.example/d/valentine-bundle-copy',
    design: [
      'https://r2.example/email/valentine-bundle-v1.png',
      'https://r2.example/email/valentine-bundle-v2.png',
    ],
    klaviyoLink: 'https://klaviyo.example/campaigns/valentine-bundle',
    assets: ['https://r2.example/email/valentine-couple-shot.jpg'],
    type: 'product_promotion_campaign',
    channel: 'email',
    campaignOfferIds: [CAMPAIGN_VDAY_ID],
    campaignOfferNames: [CAMPAIGN_VDAY_NAME],
    productIds: [PRODUCT_BLANKET_ID],
    productNames: [PRODUCT_BLANKET_NAME],
    collectionIds: [],
    collectionNames: [],
  },
  {
    ...propagationBase(
      EMAIL_WINTER_SLEEP_GUIDE_ID,
      '2026-09-10T08:15:00.000Z',
      '2026-09-14T13:30:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    name: 'Winter sleep guide',
    campaignPurpose:
      'Educational newsletter on sleeping through the dark months — no offer, builds the list for Q1.',
    status: 'client_idea_pending_for_approval',
    sendDate: null,
    ...emailCampaignDueDates(null),
    copywriting: null,
    assigneeId: null,
    assigneeName: null,
    copyLink: null,
    design: null,
    klaviyoLink: null,
    assets: null,
    type: 'blog_post_educational',
    channel: 'email',
    campaignOfferIds: [],
    campaignOfferNames: [],
    productIds: [],
    productNames: [],
    collectionIds: [],
    collectionNames: [],
  },
  {
    ...propagationBase(
      EMAIL_SUMMER_COOLING_PUSH_ID,
      '2026-06-02T10:00:00.000Z',
      '2026-06-20T17:10:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    name: 'Summer cooling push',
    campaignPurpose: 'Push notification for the Summer Sale collection on launch morning.',
    status: 'scheduled',
    sendDate: '2026-06-25',
    ...emailCampaignDueDates('2026-06-25'),
    copywriting: 'Cooler nights start today: buy 2 sleep masks, get 1 free. Tap to shop.',
    assigneeId: USER_VIDEO_EDITOR.id,
    assigneeName: USER_VIDEO_EDITOR.name,
    copyLink: null,
    design: ['https://r2.example/email/summer-push-icon.png'],
    klaviyoLink: 'https://klaviyo.example/campaigns/summer-cooling-push',
    assets: null,
    type: 'collection_promotion_campaign',
    channel: 'push_notification',
    campaignOfferIds: [CAMPAIGN_SUMMER_ID],
    campaignOfferNames: [CAMPAIGN_SUMMER_NAME],
    productIds: [PRODUCT_MASK_ID],
    productNames: [PRODUCT_MASK_NAME],
    collectionIds: [COLLECTION_SUMMER_ID],
    collectionNames: [COLLECTION_SUMMER_NAME],
  },
];
