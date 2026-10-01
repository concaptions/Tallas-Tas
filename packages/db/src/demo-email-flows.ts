import { DEMO_ACTOR_ID, DEMO_BRAND_ID } from './demo-data';
import type { EmailFlowListRow } from './email-flows';

/**
 * The Email Flows fixtures for the demo brand (Niagara Sleep Solutions): what the app serves in DEMO
 * MODE and what `email-flows.test.ts` writes into a seeded database before asserting `listEmailFlows`
 * returns them row for row. Same conventions as `demo-data.ts`: every id is a hardcoded uuid, every
 * timestamp a fixed ISO string (never `new Date()` at module scope), and the rows are typed from the
 * query layer's `EmailFlowListRow`, so a fixture and a database row are the same shape.
 *
 * The derived columns are written out, not computed, so a fixture reads as the row the page shows:
 * `designDueDate` is the expected setup date − 5 days and `copywritingDueDate` − 10 days (the base's
 * two formulas), `campaignNames` is alphabetical, and `assigneeName` is the full name `demoUsers`
 * gives the Clerk id in `assigneeId`. The test proves each of those against the real query.
 */

const at = (iso: string): Date => new Date(iso);

/** The shared columns every demo row carries, mirroring `propagationBase` in `demo-data.ts`. */
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

const FLOW_WELCOME_ID = 'ef10ef10-ef10-4ef1-8ef1-000000000001';
const FLOW_ABANDONED_CART_ID = 'ef10ef10-ef10-4ef1-8ef1-000000000002';
const FLOW_BACK_IN_STOCK_ID = 'ef10ef10-ef10-4ef1-8ef1-000000000003';
const FLOW_BROWSE_PUSH_ID = 'ef10ef10-ef10-4ef1-8ef1-000000000004';

/**
 * The two demo campaigns the flows link to, by the ids `demoCampaigns` gives them (BFCM and
 * Valentine). Restated here because `demo-data.ts` keeps its id constants private; the test asserts
 * both resolve to a fixture campaign so a renamed id fails loudly instead of silently unlinking.
 */
export const DEMO_EMAIL_FLOW_CAMPAIGN_BFCM_ID = 'dddddddd-dddd-4ddd-8ddd-000000000001';
export const DEMO_EMAIL_FLOW_CAMPAIGN_VDAY_ID = 'dddddddd-dddd-4ddd-8ddd-000000000002';

/** The designer's seeded Clerk id, as `demoUsers` spells it (Rhiannon Okafor). */
const DESIGNER_ACTOR_ID = 'user_seed_designer';

export const demoEmailFlows: EmailFlowListRow[] = [
  {
    ...propagationBase(
      FLOW_ABANDONED_CART_ID,
      '2026-08-24T10:10:00.000Z',
      '2026-09-19T15:20:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    flowName: 'Abandoned Cart Recovery',
    expectedSetupDate: '2026-10-20',
    flowPurpose:
      'Three-touch recovery for carts left with the weighted blanket: a reminder at one hour, social proof at 24 hours and the BFCM code at 72 hours.',
    status: 'template_design',
    copywriting:
      'Email 1 — "Still thinking it over?" Your blanket is waiting; most people fall asleep 15 minutes faster the first night.\nEmail 2 — "What 2,400 sleepers said." Three reviews, one photo.\nEmail 3 — "Your BFCM code, early." 20% off with BFCM26, 48 hours only.',
    design: [
      'https://r2.example/email-flows/abandoned-cart/email-1.png',
      'https://r2.example/email-flows/abandoned-cart/email-2.png',
    ],
    klaviyoLink: 'https://www.klaviyo.com/flows/abandoned-cart-niagara',
    type: 'email',
    inspo: ['https://r2.example/email-flows/abandoned-cart/inspo-casper.png'],
    assigneeId: DESIGNER_ACTOR_ID,
    campaignIds: [DEMO_EMAIL_FLOW_CAMPAIGN_BFCM_ID],
    campaignNames: ['BFCM-20%OFF-BFCM26'],
    assigneeName: 'Rhiannon Okafor',
    designDueDate: '2026-10-15',
    copywritingDueDate: '2026-10-10',
  },
  {
    ...propagationBase(FLOW_WELCOME_ID, '2026-08-02T09:00:00.000Z', '2026-09-17T09:30:00.000Z'),
    brandId: DEMO_BRAND_ID,
    flowName: 'Welcome Series',
    expectedSetupDate: '2026-09-01',
    flowPurpose:
      'Four emails over ten days for new subscribers: the sleep-debt story, how the blanket works, the mask as the pairing, and a first-order code.',
    status: 'live',
    copywriting:
      'Email 1 — "Welcome to deeper sleep." Why 5 kg of pressure settles a racing mind.\nEmail 2 — "The 90-minute rule." One sleep cycle, explained in 200 words.\nEmail 3 — "Blanket meets mask." The reset bundle.\nEmail 4 — "Your first night, on us." WELCOME10.',
    design: ['https://r2.example/email-flows/welcome/series-overview.png'],
    klaviyoLink: 'https://www.klaviyo.com/flows/welcome-series-niagara',
    type: 'email',
    inspo: null,
    assigneeId: DEMO_ACTOR_ID,
    campaignIds: [],
    campaignNames: [],
    assigneeName: 'Dorian Vance',
    designDueDate: '2026-08-27',
    copywritingDueDate: '2026-08-22',
  },
  {
    ...propagationBase(
      FLOW_BACK_IN_STOCK_ID,
      '2026-09-03T13:00:00.000Z',
      '2026-09-14T11:45:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    flowName: 'Back-in-Stock SMS Alert',
    expectedSetupDate: '2026-11-05',
    flowPurpose:
      'One text the moment the cooling mask is restocked, with the live holiday code attached so the alert doubles as the offer.',
    status: 'client_idea_pending_for_approval',
    copywriting: null,
    design: null,
    klaviyoLink: null,
    type: 'sms',
    inspo: null,
    assigneeId: null,
    campaignIds: [DEMO_EMAIL_FLOW_CAMPAIGN_BFCM_ID, DEMO_EMAIL_FLOW_CAMPAIGN_VDAY_ID],
    campaignNames: ['BFCM-20%OFF-BFCM26', 'Valentine-15%OFF-VDAY27'],
    assigneeName: null,
    designDueDate: '2026-10-31',
    copywritingDueDate: '2026-10-26',
  },
  {
    ...propagationBase(FLOW_BROWSE_PUSH_ID, '2026-09-08T16:40:00.000Z', '2026-09-10T08:15:00.000Z'),
    brandId: DEMO_BRAND_ID,
    flowName: 'Browse Abandonment Push',
    expectedSetupDate: null,
    flowPurpose:
      'A single push notification for app users who viewed the blanket twice without adding it to cart. Parked until the app launch date is confirmed.',
    status: 'pending',
    copywriting: null,
    design: null,
    klaviyoLink: null,
    type: 'push_notification',
    inspo: ['https://r2.example/email-flows/browse-push/inspo-push-copy.png'],
    assigneeId: DEMO_ACTOR_ID,
    campaignIds: [],
    campaignNames: [],
    assigneeName: 'Dorian Vance',
    designDueDate: null,
    copywritingDueDate: null,
  },
];
