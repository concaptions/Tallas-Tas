import type { AdMetricListRow } from './ad-metrics';
import type { AssetListRow } from './assets';
import type { AngleListRow } from './angles';
import type { CompetitorAdListRow } from './competitor-ads';
import type { CreatorRankingListRow } from './creator-rankings';
import type { OnboardingFormListRow } from './onboarding-forms';
import type { UploadLinkListRow } from './upload-links';
import type { BriefListRow } from './briefs';
import type { ConceptListRow } from './concepts';
import type { CopyListRow } from './copy';
import type { CreatorListRow } from './creators';
import type { InterfacePageRow } from './interface-config';
import type { NotificationSettingRow } from './notifications';
import type { PersonaListRow } from './personas';
import type { ProductListRow } from './products';
import type { PromotionRequestRow } from './promotion-requests';
import { brandRoles, notificationTriggers } from './schema';
import type {
  AgencyRole,
  BrandRole,
  CreativeFunnel,
  CreativeType,
  InterfacePageKey,
  NotificationTriggerKey,
  User,
} from './schema';
import type { TeamListRow, TeamRole } from './team';
import type { ThemeListRow } from './themes';

/**
 * The single source of the demo content: the fixtures the app serves in DEMO MODE (no Clerk key, so
 * no identity provider, so no database read) and the rows `seed(db)` writes into the seeded child
 * brand. One module, so a visitor on Vercel with no environment variables and a developer on a
 * seeded database see exactly the same content.
 *
 * Every id is a hardcoded uuid, never `randomUUID()` at module scope: the fixtures are compared,
 * linked and rendered by id, and a value that changed per process would break the seed's foreign
 * keys and every snapshot. Timestamps are fixed for the same reason.
 *
 * The rows are typed from the Drizzle tables' `$inferSelect`, so a fixture and a database row are
 * the same shape and a page can render either without a branch.
 */

/** The brand every demo row belongs to; `seed(db)` gives the seeded child brand this exact id. */
export const DEMO_BRAND_ID = '11111111-1111-4111-8111-111111111111';

/** The `created_by` / `updated_by` actor on every demo row: the seed's strategist, not a real user. */
export const DEMO_ACTOR_ID = 'user_seed_strategist';

/**
 * The agency admin's placeholder Clerk id: the actor who provisioned the team accounts, and the
 * person the demo-mode stub actor stands in for (PRD §11, "Admin (me) — Everything, all brands").
 * Kept beside `DEMO_ACTOR_ID` so both seeded identities are named in one place.
 */
export const DEMO_ADMIN_ACTOR_ID = 'user_seed_admin';

const at = (iso: string): Date => new Date(iso);

const PRODUCT_BLANKET_ID = '22222222-2222-4222-8222-000000000001';
const PRODUCT_MASK_ID = '22222222-2222-4222-8222-000000000002';
const PRODUCT_RESET_BUNDLE_ID = '22222222-2222-4222-8222-000000000003';
const PERSONA_SHIFT_ID = '33333333-3333-4333-8333-000000000001';
const PERSONA_PARENT_ID = '33333333-3333-4333-8333-000000000002';
const PERSONA_PERI_ID = '33333333-3333-4333-8333-000000000003';
const THEME_PROBLEM_SOLUTION_ID = '44444444-4444-4444-8444-000000000001';
const THEME_GREEN_SCREEN_ID = '44444444-4444-4444-8444-000000000002';
const THEME_POV_ID = '44444444-4444-4444-8444-000000000003';
const THEME_YAPPER_ID = '44444444-4444-4444-8444-000000000004';
const THEME_HOLIDAY_GIFTING_ID = '44444444-4444-4444-8444-000000000005';
const THEME_SPRING_SOCCER_ID = '44444444-4444-4444-8444-000000000006';
const ANGLE_BODY_CLOCK_ID = '55555555-5555-4555-8555-000000000001';
const ANGLE_NINETY_MINUTES_ID = '55555555-5555-4555-8555-000000000002';
const ANGLE_NOT_YOUR_AGE_ID = '55555555-5555-4555-8555-000000000003';
const ANGLE_DAYLIGHT_ID = '55555555-5555-4555-8555-000000000004';
const ANGLE_THERMOSTAT_ID = '55555555-5555-4555-8555-000000000005';
const CONCEPT_BODY_CLOCK_ID = '66666666-6666-4666-8666-000000000001';
const CONCEPT_NOT_YOUR_AGE_ID = '66666666-6666-4666-8666-000000000002';
const CONCEPT_DAYLIGHT_ID = '66666666-6666-4666-8666-000000000003';
const CONCEPT_NINETY_MINUTES_ID = '66666666-6666-4666-8666-000000000004';
const BRIEF_BODY_CLOCK_VIDEO_ID = '77777777-7777-4777-8777-000000000001';
const BRIEF_NOT_YOUR_AGE_STATIC_ID = '77777777-7777-4777-8777-000000000002';
const BRIEF_DAYLIGHT_MOTION_ID = '77777777-7777-4777-8777-000000000003';
const BRIEF_NINETY_MINUTES_VIDEO_ID = '77777777-7777-4777-8777-000000000004';
const BRIEF_BUNDLE_STANDALONE_ID = '77777777-7777-4777-8777-000000000005';
const BRIEF_NINETY_MINUTES_CAROUSEL_ID = '77777777-7777-4777-8777-000000000006';
const BRIEF_BODY_CLOCK_LAUNCHED_ID = '77777777-7777-4777-8777-000000000007';
const COPY_BODY_CLOCK_ID = '88888888-8888-4888-8888-000000000001';
const COPY_NOT_YOUR_AGE_ID = '88888888-8888-4888-8888-000000000002';
const COPY_DAYLIGHT_ID = '88888888-8888-4888-8888-000000000003';
const COPY_BUNDLE_UNATTACHED_ID = '88888888-8888-4888-8888-000000000004';
const BRAND_MATTRESS_CENTRAL_ID = '11111111-1111-4111-8111-111111111112';
const BRAND_GRATSI_ID = '11111111-1111-4111-8111-111111111113';
const BRAND_FUNKY_PAINTING_ID = '11111111-1111-4111-8111-111111111114';
const USER_MARGUERITE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
const USER_DORIAN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002';
const USER_IMOGEN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003';
const USER_RHIANNON_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004';
const USER_CALLUM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000005';
const CREATOR_DANIELLE_ID = '99999999-9999-4999-8999-000000000001';
const CREATOR_MARCUS_ID = '99999999-9999-4999-8999-000000000002';
const CREATOR_PRIYA_ID = '99999999-9999-4999-8999-000000000003';
const CREATOR_TOMAS_ID = '99999999-9999-4999-8999-000000000004';
const CREATOR_HANNAH_ID = '99999999-9999-4999-8999-000000000005';
const ASSET_REF_VIDEO_ID = 'cccccccc-cccc-4ccc-8ccc-000000000001';
const ASSET_BROLL_ID = 'cccccccc-cccc-4ccc-8ccc-000000000002';
const ASSET_RAW_ID = 'cccccccc-cccc-4ccc-8ccc-000000000003';
const ASSET_MOOD_ID = 'cccccccc-cccc-4ccc-8ccc-000000000004';
const METRIC_BODY_CLOCK_ID = 'dddddddd-dddd-4ddd-8ddd-000000000001';
const METRIC_NOT_YOUR_AGE_ID = 'dddddddd-dddd-4ddd-8ddd-000000000002';
const METRIC_DAYLIGHT_ID = 'dddddddd-dddd-4ddd-8ddd-000000000003';
const METRIC_NINETY_MINUTES_ID = 'dddddddd-dddd-4ddd-8ddd-000000000004';
const COMP_AD_CASPER_ID = 'eeeeeeee-eeee-4eee-8eee-000000000001';
const COMP_AD_PURPLE_ID = 'eeeeeeee-eeee-4eee-8eee-000000000002';
const COMP_AD_HELIX_ID = 'eeeeeeee-eeee-4eee-8eee-000000000003';
const RANKING_DANIELLE_ID = 'ffffffff-ffff-4fff-8fff-000000000001';
const RANKING_MARCUS_ID = 'ffffffff-ffff-4fff-8fff-000000000002';
const RANKING_PRIYA_ID = 'ffffffff-ffff-4fff-8fff-000000000003';
const UPLOAD_LINK_AGENCY_ID = 'aabbccdd-aabb-4ccd-8dde-000000000001';
const UPLOAD_LINK_CREATOR_ID = 'aabbccdd-aabb-4ccd-8dde-000000000002';
const ONBOARD_FORM_INTAKE_ID = 'bbccddee-bbcc-4dde-8eef-000000000001';
const ONBOARD_FORM_BRIEF_ID = 'bbccddee-bbcc-4dde-8eef-000000000002';

/** The shared columns every demo row carries, so each fixture below states only its own fields. */
function base(id: string, created: string, updated: string) {
  return {
    id,
    createdAt: at(created),
    updatedAt: at(updated),
    createdBy: DEMO_ACTOR_ID,
    updatedBy: DEMO_ACTOR_ID,
    deletedAt: null,
  };
}

function contentBase(id: string, created: string, updated: string) {
  return { ...base(id, created, updated), legacyAirtableId: null as string | null };
}

function propagationBase(id: string, created: string, updated: string) {
  return {
    ...contentBase(id, created, updated),
    templateRowId: null as string | null,
    overriddenFields: [] as string[],
    customFields: {} as Record<string, unknown>,
  };
}

/**
 * The CSV template a user downloads before a bulk upload (PRD §5.1, CLAUDE.md non-negotiable 9: a
 * downloadable template per table). Data, not schema: it is the writable columns of `products` in
 * the order the template presents them, snake_case because that is what a spreadsheet exported from
 * Airtable carries. `id`, `brand_id` and the audit columns are absent — the scope, the clock and the
 * actor own those, and an uploaded row may not choose them. It lives beside the fixtures so the demo
 * download and a live download are the same string.
 */
export const PRODUCT_CSV_COLUMNS = ['name', 'link', 'collection_link'] as const;

/**
 * Three products for Niagara Sleep Solutions (PRD §5.1: the landing page link is the required part,
 * the collection link optional — the sleep mask has none, so the column is visibly optional in the
 * table). `conceptCount` is the linked-concept count `listProducts` computes: the live concepts of
 * the brand whose angle points at the product (`concepts.angleId` → `angles.productId`). The four
 * demo concepts sit two on the blanket and two on the mask, and nothing has been built on the bundle
 * yet, so the fixtures show real counts and a real zero.
 */
export const demoProducts: ProductListRow[] = [
  {
    ...propagationBase(PRODUCT_BLANKET_ID, '2026-08-02T09:00:00.000Z', '2026-09-11T14:10:00.000Z'),
    brandId: DEMO_BRAND_ID,
    name: 'Niagara Deep Sleep Weighted Blanket',
    link: 'https://niagarasleep.example/products/deep-sleep-weighted-blanket',
    collectionLink: 'https://niagarasleep.example/collections/sleep-essentials',
    conceptCount: 2,
  },
  {
    ...propagationBase(PRODUCT_MASK_ID, '2026-08-02T09:05:00.000Z', '2026-09-09T11:30:00.000Z'),
    brandId: DEMO_BRAND_ID,
    name: 'Niagara Cooling Blackout Sleep Mask',
    link: 'https://niagarasleep.example/products/cooling-blackout-sleep-mask',
    collectionLink: null,
    conceptCount: 2,
  },
  {
    ...propagationBase(
      PRODUCT_RESET_BUNDLE_ID,
      '2026-08-12T15:45:00.000Z',
      '2026-09-05T13:20:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    name: 'Niagara Night Reset Bundle (Blanket + Mask)',
    link: 'https://niagarasleep.example/products/night-reset-bundle',
    collectionLink: 'https://niagarasleep.example/collections/shift-worker-sleep-kit',
    conceptCount: 0,
  },
];

/**
 * The framework the seeded concept is built on, named here because that concept's auto-generated
 * `Batch-Angle-Theme` name is built from it (CLAUDE.md non-negotiable 6).
 */
const problemSolutionTheme: ThemeListRow = {
  ...contentBase(THEME_PROBLEM_SOLUTION_ID, '2026-07-20T10:00:00.000Z', '2026-08-28T10:00:00.000Z'),
  brandId: null,
  name: 'Problem/Solution',
  category: 'Framework',
  referenceLinks: [
    'https://foreplay.example/boards/problem-solution-sleep',
    'https://atria.example/collections/sleep-aids-2026',
  ],
  notes:
    'Open on the problem in the first two seconds, name it in the viewer’s own words, then land the product as the mechanism that removes it. Works coldest at problem-aware and solution-aware.',
  usedByBrandCount: 1,
  status: null,
  assigneeId: null,
  attachments: null,
  aiAttachmentSummary: null,
  isActive: true,
};

/**
 * Six themes from the GLOBAL library (PRD §5.5), two of each kind: Frameworks (the *how* of the
 * argument), Production styles (the *how* of the shoot) and Seasonal hooks. Every `brandId` is
 * null, which the `themes_global` check constraint requires — this library belongs to the platform,
 * not to a brand, so the notes are written for whoever picks the theme up next and name the other
 * brands on the roster (Mattress Central, Gratsi, Funky Painting) where the lesson came from them.
 *
 * `usedByBrandCount` is the number of distinct brands whose live concepts reference the theme, the
 * aggregate `listThemes` computes, so the fixtures satisfy `ThemeListRow[]` and the Themes page
 * reads demo rows and database rows through one type. The seeded database holds one brand, whose
 * four concepts sit on four different themes: the counts below are exactly what `listThemes` returns
 * there — four real ones and two real zeros, never an invented number. They are ones and not fours
 * because the aggregate counts distinct BRANDS, not concepts.
 *
 * The array is in `updated_at` descending order, the order `listThemes` returns, so a test can
 * compare the two directly.
 */
export const demoThemes: ThemeListRow[] = [
  {
    ...contentBase(THEME_YAPPER_ID, '2026-08-04T09:30:00.000Z', '2026-09-12T13:25:00.000Z'),
    brandId: null,
    name: 'Yapper Style',
    category: 'Production Style',
    referenceLinks: [
      'https://foreplay.example/boards/yapper-style-dtc',
      'https://www.tiktok.com/@thepostpartumplan/video/7385012994771635745',
    ],
    notes:
      'One creator, one take, talking straight down the barrel at conversational speed with no B-roll to hide behind — the whole thing lives or dies on the first sentence. Cheapest format we shoot and the only one that survives being cut to six different hooks in the edit. Needs a creator who can actually talk; on Gratsi the second-choice creator read the script and the retention graph fell off a cliff at four seconds.',
    usedByBrandCount: 1,
    status: null,
    assigneeId: null,
    attachments: null,
    aiAttachmentSummary: null,
    isActive: true,
  },
  {
    ...contentBase(
      THEME_HOLIDAY_GIFTING_ID,
      '2026-08-09T11:15:00.000Z',
      '2026-09-07T10:50:00.000Z',
    ),
    brandId: null,
    name: 'Holiday Gifting',
    category: 'Seasonal',
    referenceLinks: [
      'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=CA&id=1120774398215530',
      'https://atria.example/collections/q4-gifting-teardowns',
    ],
    notes:
      'Reframe the product as the gift for a named person — the shift-working sister, the dad who is always cold — so the buyer is not the user and price stops being measured against personal need. Ship the first cut by the first week of November: Mattress Central left it to the third week last year and paid double CPM for the same creative. Gift-receipt and delivery-cutoff lines belong on screen, not in the caption.',
    usedByBrandCount: 0,
    status: null,
    assigneeId: null,
    attachments: null,
    aiAttachmentSummary: null,
    isActive: true,
  },
  {
    ...contentBase(THEME_POV_ID, '2026-07-28T14:20:00.000Z', '2026-09-02T09:05:00.000Z'),
    brandId: null,
    name: 'POV: X vs Y',
    category: 'Framework',
    referenceLinks: ['https://foreplay.example/boards/pov-x-vs-y-comparison'],
    notes:
      'Split the frame and let the viewer pick a side: the night before versus the night after, the thing they own versus the thing we sell. It earns the comparison the ad would otherwise have to claim, and it gives the editor a structure that reads with the sound off. Keep the losing side a situation and never a competitor by name — legal made Funky Painting re-cut a whole batch over a visible rival can.',
    usedByBrandCount: 1,
    status: null,
    assigneeId: null,
    attachments: null,
    aiAttachmentSummary: null,
    isActive: true,
  },
  {
    ...contentBase(THEME_GREEN_SCREEN_ID, '2026-07-20T10:05:00.000Z', '2026-08-30T16:40:00.000Z'),
    brandId: null,
    name: 'Green Screen',
    category: 'Production Style',
    referenceLinks: ['https://foreplay.example/boards/green-screen-reaction'],
    notes:
      'Creator reacts over a screenshot of a review, a Reddit thread or a sleep-tracker graph. Cheap to produce, high hook rate, and the on-screen artefact carries the proof so the script can stay short.',
    usedByBrandCount: 1,
    status: null,
    assigneeId: null,
    attachments: null,
    aiAttachmentSummary: null,
    isActive: true,
  },
  problemSolutionTheme,
  {
    ...contentBase(THEME_SPRING_SOCCER_ID, '2026-08-11T16:00:00.000Z', '2026-08-19T15:35:00.000Z'),
    brandId: null,
    name: 'Spring x Soccer',
    category: 'Seasonal',
    referenceLinks: [
      'https://www.instagram.com/reel/C8kTm1QsV7bN/',
      'https://atria.example/collections/spring-sport-hooks',
    ],
    notes:
      'Hang the product on the spring sports calendar — 5am training runs, tournament weekends, a parent driving home from a match — so a cold audience meets it inside a routine they are already living in March and April. Broad enough to carry any brand on the roster and dead by June, so treat every build as disposable and never as evergreen. No club crests, no player likenesses, no tournament name: the rights holders send the letters.',
    usedByBrandCount: 0,
    status: null,
    assigneeId: null,
    attachments: null,
    aiAttachmentSummary: null,
    isActive: true,
  },
];

/**
 * Three researched personas (PRD §5.4, all fourteen fields). `productName` is the joined product
 * name `listPersonas` returns, so the fixtures satisfy `PersonaListRow[]` and the Personas page
 * reads demo rows and database rows through one type.
 */
export const demoPersonas: PersonaListRow[] = [
  {
    ...propagationBase(PERSONA_SHIFT_ID, '2026-08-05T08:30:00.000Z', '2026-09-12T10:20:00.000Z'),
    brandId: DEMO_BRAND_ID,
    productId: PRODUCT_BLANKET_ID,
    productName: 'Niagara Deep Sleep Weighted Blanket',
    name: 'Marcus — the rotating-shift nurse who cannot switch off',
    dayInTheLife:
      'Clocks out of a twelve-hour night shift at 07:30, drives home in full daylight, eats a meal his body thinks is dinner and gets into bed at 09:00 with the bins being collected outside. He lies there wired for ninety minutes, sleeps in broken ninety-minute blocks until mid-afternoon, wakes with his heart going, and is back on the ward at 19:00. On his two days off he tries to flip back to a normal schedule for his family and sleeps worse than on shift.',
    demographic:
      '34, male, registered nurse on a four-on four-off rotating rota, Hamilton Ontario, household income 95k CAD, partner works days, one child at primary school, rents a semi-detached house on a bus route.',
    psychographic:
      'Clinically literate and deeply sceptical of wellness marketing — he can read a study abstract and will. Identifies as the reliable one at work and at home, so he treats his own exhaustion as a personal failing rather than an occupational hazard. Buys practical gear, researches on Reddit and r/nursing before purchase, and hates anything that looks like it belongs in a spa.',
    coreDesires:
      'To be free from the fear of falling asleep on the drive home. To keep the energy to be present with his daughter on his days off rather than sleeping through them. To feel in control of his own body again instead of negotiating with it.',
    emotionalTriggers:
      'The guilt of missing his daughter’s Saturday football because he was still asleep at noon. The flash of fear when he loses a few seconds on the motorway. Being told by colleagues that "you get used to nights" when after six years he clearly has not.',
    painPoints:
      'Cannot fall asleep in daylight even after a brutal shift. Wakes every ninety minutes to traffic, deliveries and the neighbour’s dog. Feels hungover all day off. Melatonin left him groggy for the first four hours of a shift, which on a ward is not acceptable to him.',
    successFactors:
      'Falls asleep within twenty minutes of getting into bed post-shift. Sleeps a five-hour unbroken block instead of three broken ones. Wakes without the drugged feeling and can drive safely. Sees the change on his sleep tracker within the first week, because he will check.',
    perceivedBarriers:
      'Believes nothing can beat daylight and noise, so any product is money wasted. Assumes a weighted blanket will be far too hot for a man who already overheats. Worries it is a placebo sold to anxious people, and worries a little that buying one admits he is not coping.',
    stageOfAwareness: 'solution_aware',
    buyingTriggers:
      'A near-miss on the drive home. A colleague on the same rota showing him her tracker graph before and after. A cooling claim backed by a fabric spec rather than an adjective. A trial window long enough to cover one full four-on rotation.',
    problemChallenge:
      'His job requires him to sleep when the world is awake, and his body has never agreed to it. Every attempt so far has traded one problem for another: sedation for sleeplessness, heat for weight.',
    successTransformation:
      'He stops treating sleep as something he loses to the rota and starts arriving home knowing he will be unconscious within twenty minutes — safe on the drive, awake for his daughter on Saturday, and no longer the tired one in his own house.',
    triggerWords:
      'Off-shift. Daylight-proof. Ninety-minute blocks. Weighted, not hot. Drive home safe. Not a sedative. Back on the rota.',
  },
  {
    ...propagationBase(PERSONA_PARENT_ID, '2026-08-06T09:15:00.000Z', '2026-09-10T16:05:00.000Z'),
    brandId: DEMO_BRAND_ID,
    productId: PRODUCT_MASK_ID,
    productName: 'Niagara Cooling Blackout Sleep Mask',
    name: 'Priya — the new parent running on broken sleep',
    dayInTheLife:
      'Up at 02:10, 04:00 and 05:40 with a seven-month-old. Hands the baby to her partner at 06:30 and gets a two-hour window she mostly spends staring at the ceiling because the room is already bright and she is listening for the monitor. Works from home through a fog, naps badly at 13:00 while the baby naps well, and dreads the evening because she knows exactly how the night goes.',
    demographic:
      '31, female, on parental leave from a marketing role she returns to in eleven weeks, Toronto, joint household income 130k CAD, first child, lives in a second-floor flat with thin curtains facing east.',
    psychographic:
      'Was organised and high-performing and is grieving that version of herself. Lives in parenting subreddits and Instagram carousels at 03:00, which has left her both over-informed and unable to decide. Will spend on anything that helps the baby without hesitation and feels selfish spending forty dollars on herself.',
    coreDesires:
      'To actually sleep during the window she does get instead of lying awake in it. To stop snapping at her partner. To feel like herself again before she has to walk back into a meeting room.',
    emotionalTriggers:
      'Crying in the kitchen over something small and not knowing why. The comment "sleep when the baby sleeps" from someone who has clearly never tried. The photo of herself from last summer looking rested. The fear that she will go back to work like this and be found out.',
    painPoints:
      'The two-hour morning window is bright as noon. She is too hot and too alert to drop off, and by the time she does the window is gone. Cannot wear anything that muffles the monitor. Every product she has tried either slid off, pressed on her eyes or made her overheat.',
    successFactors:
      'Asleep inside ten minutes of the handover. The room dark enough at 07:00 to feel like 02:00. Wakes for the monitor but not for the light. One good morning block, three days out of five, is enough for her to feel human.',
    perceivedBarriers:
      'Thinks a mask will slip off or leave her with raccoon marks for a video call. Worries she will not hear the baby. Quietly believes nothing works and she just has to survive the next year. Feels the money should go on the nursery.',
    stageOfAwareness: 'problem_aware',
    buyingTriggers:
      'A parent in the same position showing the exact morning-window use case rather than a bedtime one. A contoured shape that does not press on the eyes. An explicit line that it blocks light, not sound. A price low enough to feel allowed, and free returns so the decision is reversible at 03:00.',
    problemChallenge:
      'She is given two hours of sleep a day and cannot use them, because the room is bright and her body is still on alert. The one resource she cannot make more of is being wasted.',
    successTransformation:
      'The handover at 06:30 becomes real sleep instead of lying down. She goes back to work in eleven weeks as someone who is tired but functioning, not someone who is disappearing — and she stops feeling selfish for having spent forty dollars on herself.',
    triggerWords:
      'The morning window. Blackout, not earplugs. Ten minutes to asleep. You will still hear them. Not selfish. Back to yourself.',
  },
  {
    ...propagationBase(PERSONA_PERI_ID, '2026-08-07T11:00:00.000Z', '2026-09-08T08:45:00.000Z'),
    brandId: DEMO_BRAND_ID,
    productId: PRODUCT_BLANKET_ID,
    productName: 'Niagara Deep Sleep Weighted Blanket',
    name: 'Denise — peri-menopausal, awake at 3am with night sweats',
    dayInTheLife:
      'Falls asleep easily at 22:30 and is wide awake at 03:10, soaked through, throwing the duvet off and pulling it back on for the next two hours. Gets up at 06:30 having slept four hours, runs a team of nine on caffeine, loses a word mid-sentence in the 10:00 stand-up and hears herself blame her age. By 21:00 she is exhausted, and by 03:10 she is awake again.',
    demographic:
      '49, female, operations manager, St Catharines Ontario, income 110k CAD, married, two teenagers, owns her home, has had the thermostat argument with her husband every night for two years.',
    psychographic:
      'Pragmatic and used to fixing other people’s problems, which makes being unable to fix her own infuriating. Was dismissed by a GP with "it is just your age" and has not fully forgiven it, so she now researches thoroughly and trusts other women in her position far more than brands. Will pay well for something that works and resents paying anything for something pink and vague.',
    coreDesires:
      'To sleep through until the alarm. To stop dreading the middle of the night. To stop losing words in meetings and to feel like her competence is her own again rather than something age is taking back.',
    emotionalTriggers:
      'Waking soaked and having to change the sheets at 03:30 while her husband sleeps. The word "hormonal" used about her at work. The fear that this is simply who she is now. Her daughter asking why she is so snappy.',
    painPoints:
      'Wakes at the same time every night drenched. Cannot regulate temperature: too hot with the duvet, too cold without it. Two hours awake at 03:00 with her mind racing over work. Every bedding product she has tried traps heat, and everything marketed to her assumes she wants lavender and a candle.',
    successFactors:
      'Sleeps through to 06:30 four nights out of seven. Does not wake soaked. Gets back to sleep within fifteen minutes when she does wake. Stops needing the third coffee. Can say out loud that it is manageable.',
    perceivedBarriers:
      'Certain a weighted blanket means heat, which is the exact thing that wakes her. Assumes this is hormonal and therefore only a prescription could touch it. Has already wasted money on cooling sheets that were not cooling. Suspicious of anything aimed at "women over forty".',
    stageOfAwareness: 'product_aware',
    buyingTriggers:
      'A breathable weighted construction explained by its materials, not by adjectives. A woman her age in the ad saying "3am" out loud. A ninety-night trial covering a full cycle. A review from someone who also tried the cooling sheets that failed.',
    problemChallenge:
      'Her own thermostat has stopped working and it takes two hours out of the middle of every night. She is told it is just her age, which is another way of saying she should put up with it.',
    successTransformation:
      'She sleeps from 22:30 to the alarm, wakes dry, and walks into the 10:00 stand-up with the words in her mouth. The middle of the night stops being something she dreads, and nobody in her house has to have the thermostat argument again.',
    triggerWords:
      '3am. Drenched. Weighted but breathable. It is not just your age. Through to the alarm. Ninety nights.',
  },
];

/** The shift-worker angle, named here because the concept's auto-generated name is built from it. */
const bodyClockAngle: AngleListRow = {
  ...propagationBase(ANGLE_BODY_CLOCK_ID, '2026-08-14T13:00:00.000Z', '2026-09-11T09:40:00.000Z'),
  brandId: DEMO_BRAND_ID,
  personaId: PERSONA_SHIFT_ID,
  personaName: 'Marcus — the rotating-shift nurse who cannot switch off',
  productId: PRODUCT_BLANKET_ID,
  productName: 'Niagara Deep Sleep Weighted Blanket',
  name: 'Your Body Clock Is Not Broken',
  description:
    'Hypothesis: shift workers reject sleep products because every one of them implies they are doing something wrong. Reframe the problem as occupational, not personal — the rota is the abnormal thing, not him — and the weighted blanket becomes equipment for the job rather than a wellness purchase. We expect this to lift cold-traffic hook rate among the healthcare audience and cut the "this is not for me" objection in comments.',
  painPoints:
    'Cannot fall asleep in daylight. Wakes every ninety minutes. Melatonin leaves him groggy for the first hours of a shift. Treats his exhaustion as a personal failing.',
  usp: 'Breathable weighted construction that signals sleep by pressure instead of sedation, so it works at 09:00 in a bright room and leaves nothing in his system when he clocks in at 19:00.',
  type: ['Identity', 'Emotional'],
  formats: ['Static', 'Video'],
  adInspoLinks: [
    'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=CA&id=1204339857741622',
    'https://www.tiktok.com/@nightshiftnurselife/video/7412906633401285934',
  ],
  potential:
    'High — the only angle we have that speaks to the occupational audience in their own terms.',
  winning: true,
  internalNotes:
    'Built off the r/nursing thread the strategist pulled in the August research round. Keep the word "wellness" out of every script; two of the three nurses we interviewed used it as an insult. Media buyer wants this tested against the generic bedtime framing at equal spend before we scale.',
  clientNotes:
    'This is the one we would like to lead the batch with: it speaks to nurses and shift workers as professionals, not as people who are failing at sleep.',
  briefUrl: null,
  exactScriptUrl: null,
};

/**
 * Five angles for Niagara Sleep Solutions (PRD §5.6), spread across the three seeded personas —
 * Marcus and Denise carry two each, Priya one — so the page shows a persona appearing more than
 * once and every product link resolving to a different row. Each is a real hypothesis sentence, its
 * pain points and its USP, with the formats it should be built in and the ads it was inspired by.
 * `personaName` and `productName` are the names `listAngles` joins in, so the fixtures satisfy
 * `AngleListRow[]` and the Angles page reads demo rows and database rows through one type.
 *
 * The array is in `updated_at` descending order, the order `listAngles` returns, so a test can
 * compare the two directly.
 */
export const demoAngles: AngleListRow[] = [
  {
    ...propagationBase(
      ANGLE_NOT_YOUR_AGE_ID,
      '2026-08-18T09:20:00.000Z',
      '2026-09-13T11:15:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    personaId: PERSONA_PERI_ID,
    personaName: 'Denise — peri-menopausal, awake at 3am with night sweats',
    productId: PRODUCT_BLANKET_ID,
    productName: 'Niagara Deep Sleep Weighted Blanket',
    name: 'It Is Not Just Your Age',
    description:
      'Hypothesis: peri-menopausal women have been told their 3am waking is something to accept, so "sleep better" reads as another brand agreeing with the doctor who dismissed them. Lead with the dismissal itself — say the sentence back to her — and the product stops being a comfort item and becomes the first thing that took her seriously. We expect the higher thumb-stop in the 45-55 segment to come from the opening line alone, and the ninety-night trial to carry the conversion.',
    painPoints:
      'Wakes at the same time every night drenched and spends two hours awake with her mind on work. Too hot with the duvet, too cold without it. Every cooling product she has bought trapped heat. Was told by a GP that it is just her age.',
    usp: 'A weighted blanket whose fill is quilted into breathable channels, so the pressure that keeps her asleep does not become the heat that wakes her — the one combination the cooling sheets she already wasted money on could not manage.',
    type: ['Emotional', 'Critical'],
    formats: ['Static', 'Video', 'Carousel'],
    adInspoLinks: [
      'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=CA&id=982254173318827',
      'https://www.instagram.com/reel/C9xRt2LsK4pM/',
    ],
    potential:
      'High — the largest untapped segment in the account and the only angle that names the dismissal out loud.',
    winning: true,
    internalNotes:
      'Copy has to be checked by someone who has lived it; the first draft read as a brand explaining menopause to women who have it. No lavender, no candles, no soft-focus bathroom. The claim about breathable channels needs the fabric spec on screen or the media buyer will not run it.',
    clientNotes:
      'A direct, unsentimental angle for the 45-55 audience. It opens on the line women in this group hear from their doctors and answers it with the product spec rather than with reassurance.',
    briefUrl: null,
    exactScriptUrl: null,
  },
  bodyClockAngle,
  {
    ...propagationBase(ANGLE_DAYLIGHT_ID, '2026-08-21T14:45:00.000Z', '2026-09-10T08:25:00.000Z'),
    brandId: DEMO_BRAND_ID,
    personaId: PERSONA_SHIFT_ID,
    personaName: 'Marcus — the rotating-shift nurse who cannot switch off',
    productId: PRODUCT_MASK_ID,
    productName: 'Niagara Cooling Blackout Sleep Mask',
    name: 'Make 9am Look Like 3am',
    description:
      'Hypothesis: the shift worker’s blocker is not willpower, it is photons — his bedroom at 09:00 is roughly a hundred times brighter than his bedroom at 03:00, and no amount of trying harder changes that. Make the ad a measurement rather than a promise: put the lux reading on screen before and after. We expect a concrete, checkable number to outperform every comfort claim with an audience that reads study abstracts for fun.',
    painPoints:
      'Sleeps in full daylight behind thin rented curtains. Wakes to every delivery and to the sun moving across the room. Has tried blackout blinds he is not allowed to fit in a rental. Anything over the eyes so far has either slid off or cooked his face.',
    usp: 'A contoured blackout mask with a cooling insert that seals at the nose bridge, so the light goes whatever the curtains do — and it travels with him to the on-call room, which a blind never will.',
    type: ['Functional'],
    formats: ['Static', 'Video', 'Motion Graphic'],
    adInspoLinks: ['https://www.youtube.com/watch?v=nm1TxQj9IsQ'],
    potential:
      'Medium — narrow audience, but the cheapest angle in the batch to produce and the easiest to prove on camera.',
    winning: false,
    internalNotes:
      'The motion graphic is the whole angle: lux meter reading in the corner, curtains open, mask on, number drops. Needs a real meter on the shoot day, not a post-production overlay — if a nurse works out we faked the number the comments will end the angle.',
    clientNotes: null,
    briefUrl: null,
    exactScriptUrl: null,
  },
  {
    ...propagationBase(
      ANGLE_NINETY_MINUTES_ID,
      '2026-08-15T10:30:00.000Z',
      '2026-09-09T15:20:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    personaId: PERSONA_PARENT_ID,
    personaName: 'Priya — the new parent running on broken sleep',
    productId: PRODUCT_MASK_ID,
    productName: 'Niagara Cooling Blackout Sleep Mask',
    name: 'Sleep In The Ninety Minutes You Actually Get',
    description:
      'Hypothesis: new parents have stopped responding to "sleep better" because more sleep is not on offer. Sell the use of the window they already have — the morning handover — instead of the length of the night. Narrow, concrete and immediately testable, which we expect to beat the generic bedtime framing on both hook rate and add-to-cart.',
    painPoints:
      'The only sleep window is in full daylight. Too hot and too alert to drop off. Cannot block sound because of the monitor. Feels selfish spending anything on herself.',
    usp: 'Contoured blackout that clears the eyes with a cooling insert, blocking light only — so the two-hour handover becomes real sleep and she still hears the baby.',
    type: ['Functional', 'Emotional'],
    formats: ['Video', 'Carousel'],
    adInspoLinks: [
      'https://www.tiktok.com/@thepostpartumplan/video/7385012994771635745',
      'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=CA&id=760118443925514',
    ],
    potential:
      'High — the cheapest product in the range at the price point this audience will approve for themselves.',
    winning: false,
    internalNotes:
      'Every script must say "blocks light, not sound" in the first ten seconds; the objection about not hearing the baby killed the first round of comments before anyone reached the offer. Shoot in a real flat with east-facing windows, not the studio.',
    clientNotes:
      'Written for the parental-leave audience. It sells the morning handover window rather than a full night, which is the only promise this group still believes.',
    briefUrl: null,
    exactScriptUrl: null,
  },
  {
    ...propagationBase(ANGLE_THERMOSTAT_ID, '2026-08-25T16:10:00.000Z', '2026-09-06T14:05:00.000Z'),
    brandId: DEMO_BRAND_ID,
    personaId: PERSONA_PERI_ID,
    personaName: 'Denise — peri-menopausal, awake at 3am with night sweats',
    productId: PRODUCT_RESET_BUNDLE_ID,
    productName: 'Niagara Night Reset Bundle (Blanket + Mask)',
    name: 'Nobody Wins The Thermostat Argument',
    description:
      'Hypothesis: the nightly fight over the bedroom temperature is a shared problem sold as a personal one, so the bundle can be pitched to the couple rather than to her alone. Put both people in the ad and let the product end the argument instead of winning it. We expect a second decision-maker in the room to lift average order value, because the bundle stops looking like her purchase and starts looking like theirs.',
    painPoints:
      'Two years of the same argument about the thermostat every night. Changing soaked sheets at 03:30 while her husband sleeps through it. Resents being the only one whose sleep is treated as a problem to manage.',
    usp: 'A blanket and mask pairing that lets each side of the bed run at its own temperature, so the room does not have to be set to whoever is suffering more that night.',
    type: ['Emotional'],
    formats: ['Video'],
    adInspoLinks: ['https://www.instagram.com/reel/C7pLd4vNqR2/'],
    potential: 'Medium — untested with couples, but the bundle is the highest-margin line we sell.',
    winning: false,
    internalNotes:
      'Do not let this become a comedy sketch about a nagging wife; the reference ad gets close to it. The husband has to be an ally by the second beat or the angle reads as mocking the audience we are selling to.',
    clientNotes: null,
    briefUrl: null,
    exactScriptUrl: null,
  },
];

/** One seeded angle by id, past `noUncheckedIndexedAccess`; the concepts below pair with these. */
function demoAngle(id: string): AngleListRow {
  const row = demoAngles.find((angle) => angle.id === id);
  if (row === undefined) throw new Error(`demoAngles has no ${id}`);
  return row;
}

/** One seeded theme by id, past `noUncheckedIndexedAccess`. */
function demoTheme(id: string): ThemeListRow {
  const row = demoThemes.find((theme) => theme.id === id);
  if (row === undefined) throw new Error(`demoThemes has no ${id}`);
  return row;
}

/**
 * PRD §5.7's auto-generated concept name: `Batch-Angle-Theme`, never typed by a user (CLAUDE.md
 * non-negotiable 4). The canonical formula is the pure `conceptName` function in
 * `packages/domain/src/concepts/`, which the detail page and every write call; this two-line copy
 * exists only because `@tas/db` does not depend on `@tas/domain` — the edge runs the other way
 * everywhere in this repo (`packages/domain/src/angles/vocabulary.ts` copies this package's storage
 * vocabulary for exactly the same reason). Nothing here is hand-written: every fixture name below is
 * this function applied to a real batch, a real seeded angle and a real seeded theme, so a drifting
 * formula shows up as four changed fixtures rather than as one stale string. `apps/web` depends on
 * both packages and is where the two are asserted equal.
 */
function conceptName(batch: string, angle: AngleListRow, theme: ThemeListRow): string {
  return `${batch}-${angle.name}-${theme.name}`;
}

/**
 * The pairing itself, plus everything the concept INHERITS from its angle (PRD §5.7: "everything
 * derivable from the Angle must auto-fill"). Derived from the angle and theme rows rather than
 * retyped, so a fixture can never disagree with what `listConcepts` joins in.
 */
function pairing(batch: string, angle: AngleListRow, theme: ThemeListRow) {
  return {
    batch,
    angleId: angle.id,
    themeId: theme.id,
    name: conceptName(batch, angle, theme),
    angleName: angle.name,
    themeName: theme.name,
    personaName: angle.personaName,
    productName: angle.productName,
    description: angle.description,
    painPoints: angle.painPoints,
    usp: angle.usp,
  };
}

const bodyClock = demoAngle(ANGLE_BODY_CLOCK_ID);
const notYourAge = demoAngle(ANGLE_NOT_YOUR_AGE_ID);
const daylight = demoAngle(ANGLE_DAYLIGHT_ID);
const ninetyMinutes = demoAngle(ANGLE_NINETY_MINUTES_ID);

/**
 * Four concepts for Niagara Sleep Solutions (PRD §5.7): each one angle paired with one theme, each
 * pairing distinct, spread across three batches and across all four of the pre-Approved internal
 * states of the video track — `videos_revisions`, `video_editing_in_progress`, `ad_submitted` and
 * `sent_to_video_editor`, in `@tas/domain/state` terms. None of them is `approved` or `launched`, so
 * `isClientTrackOpen` is false on all four and the client bar stays shut on every demo row; each
 * therefore also sits at the first client status, `pending_for_approval`.
 *
 * `angleName`, `themeName`, `personaName`, `productName`, `description`, `painPoints` and `usp` are
 * what `listConcepts` inherits from the angle, so the fixtures satisfy `ConceptListRow[]` and the
 * Concepts page reads demo rows and database rows through one type.
 *
 * The array is in `updated_at` descending order, the order `listConcepts` returns, so a test can
 * compare the two directly. The oldest batch has travelled furthest down the internal track.
 */
export const demoConcepts: ConceptListRow[] = [
  {
    ...propagationBase(
      CONCEPT_NOT_YOUR_AGE_ID,
      '2026-08-29T09:45:00.000Z',
      '2026-09-14T11:20:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    ...pairing('B2', notYourAge, demoTheme(THEME_GREEN_SCREEN_ID)),
    category: 'New',
    conceptStyle: 'Editing',
    formats: ['Video', 'Static'],
    adInspoLinks: [
      'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=CA&id=982254173318827',
      'https://foreplay.example/boards/green-screen-reaction',
    ],
    hookExamples:
      '"My doctor wrote \'peri-menopausal\' on the notes and sent me home. Here is what she did not write." / "Three forty-seven. Every night. Ask me how I know what the ceiling looks like." / "Reading the thread where four hundred women describe the exact same night."',
    scriptIdea:
      'Creator stands beside a full-screen grab of the r/Menopause thread about 3am waking and reads two comments aloud, tapping the screen as she goes — the green screen carries the proof so the script never has to claim it. She lands on the line about being told it is just her age, then cuts to the blanket: one shot of the quilted channels, one sentence on pressure without heat. Closes on her own bed at 3am with the lamp off and the ninety-night trial on screen.',
    internalStatus: 'video_editing_in_progress',
    clientStatus: 'pending_for_approval',
    approvalStatus: null,
    formatsToCreate: [],
    productionStatus: null,
    creatorId: null,
  },
  {
    ...propagationBase(
      CONCEPT_BODY_CLOCK_ID,
      '2026-08-20T12:00:00.000Z',
      '2026-09-11T17:05:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    ...pairing('B1', bodyClock, demoTheme(THEME_PROBLEM_SOLUTION_ID)),
    category: 'New',
    conceptStyle: 'Filming',
    formats: ['Video', 'Static'],
    adInspoLinks: [
      'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=CA&id=1204339857741622',
      'https://www.tiktok.com/@nightshiftnurselife/video/7412906633401285934',
    ],
    hookExamples:
      '"Six years of nights. It is not you that is broken, it is the rota." / "If you can sleep at 9am in a bright room, you are not tired — you are equipped." / "Nurses: stop calling this a sleep problem."',
    scriptIdea:
      'Open on a nurse pulling into the driveway in full morning sun, still in scrubs. Two seconds of the problem: bins, dog, daylight through thin curtains. He says the line about the rota being the abnormal thing. Cut to the blanket going on, one line on breathable weight versus sedation, then the same man asleep with the room still bright. End on him leaving for the 19:00 shift clear-eyed, with the trial window on screen.',
    internalStatus: 'videos_revisions',
    clientStatus: 'pending_for_approval',
    approvalStatus: null,
    formatsToCreate: [],
    productionStatus: null,
    creatorId: null,
  },
  {
    ...propagationBase(CONCEPT_DAYLIGHT_ID, '2026-08-27T15:30:00.000Z', '2026-09-09T08:50:00.000Z'),
    brandId: DEMO_BRAND_ID,
    ...pairing('B2', daylight, demoTheme(THEME_POV_ID)),
    category: 'Iteration',
    conceptStyle: 'AI Concept',
    formats: ['Motion Graphic', 'Video'],
    adInspoLinks: ['https://www.youtube.com/watch?v=nm1TxQj9IsQ'],
    hookExamples:
      '"POV: your bedroom at 3am versus your bedroom at 9am. Same room. Ninety times the light." / "The curtains are not the problem. The number in the corner is." / "Your body cannot tell the time. It can only count photons."',
    scriptIdea:
      'Split frame, held for the whole ad: left side is the room at 03:00, right side the same room at 09:00, a real lux meter burned into each corner. The voiceover says the shift worker is not failing at sleep, he is being out-lit a hundred to one. The mask goes on over the right-hand frame and that side drops to the left-hand reading, meter and all. One line that it travels to the on-call room, then the offer. The meter must be filmed live on the day, never added in post.',
    internalStatus: 'ad_submitted',
    clientStatus: 'pending_for_approval',
    approvalStatus: null,
    formatsToCreate: [],
    productionStatus: null,
    creatorId: null,
  },
  {
    ...propagationBase(
      CONCEPT_NINETY_MINUTES_ID,
      '2026-09-01T10:15:00.000Z',
      '2026-09-04T16:35:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    ...pairing('B3', ninetyMinutes, demoTheme(THEME_YAPPER_ID)),
    category: 'Iteration',
    conceptStyle: 'Filming',
    formats: ['Video', 'Carousel'],
    adInspoLinks: [
      'https://www.tiktok.com/@thepostpartumplan/video/7385012994771635745',
      'https://foreplay.example/boards/yapper-style-dtc',
    ],
    hookExamples:
      '"Nobody is giving you eight hours. I am talking about the ninety minutes you already have." / "It blocks light, not sound. You will still hear him. That is the entire point." / "The handover is at seven. This is what I do with it."',
    scriptIdea:
      'One creator, one take, straight down the barrel, no B-roll: a parent on the sofa in a bright east-facing flat during the morning handover. She says out loud that more sleep is not on offer and she has stopped listening to anyone who promises it, then sells the window she actually gets. The objection goes in the first ten seconds — blocks light, not sound — and she holds the mask up to camera while she says it. Ends on her lying down with the room still bright and the monitor audibly on.',
    internalStatus: 'sent_to_video_editor',
    clientStatus: 'pending_for_approval',
    approvalStatus: null,
    formatsToCreate: [],
    productionStatus: null,
    creatorId: null,
  },
];

/** One seeded concept by id, past `noUncheckedIndexedAccess`; the briefs below are built on these. */
function demoConcept(id: string): ConceptListRow {
  const row = demoConcepts.find((concept) => concept.id === id);
  if (row === undefined) throw new Error(`demoConcepts has no ${id}`);
  return row;
}

/** PRD §7's funnel letters: the first character of every creative name. */
const FUNNEL_LETTER: Record<CreativeFunnel, string> = {
  TOF: 'T',
  Retargeting: 'R',
  'All Funnels': 'A',
};

/** PRD §7's format letters: the second character. "Motion Image" is M. */
const FORMAT_LETTER: Record<CreativeType, string> = {
  Video: 'V',
  Static: 'S',
  Carousel: 'C',
  'Motion Image': 'M',
};

/**
 * What stands in the CONCEPT NAME segment when a brief has no parent concept (PRD §8). A standalone
 * static still needs a name, and the name still has to have that segment, so the slug fills it.
 */
export const STANDALONE_CONCEPT_SLUG = 'Standalone';

/**
 * PRD §7's creative name, `{FUNNEL}{FORMAT}{NUMBER}-BATCH#-CONCEPT NAME-VARIATION#-(PRODUCT)`, never
 * typed by a user (CLAUDE.md non-negotiable 6). The canonical formula is the pure `creativeName`
 * function in `packages/domain/src/creatives/`, which the brief page and every write call; this copy
 * exists only because `@tas/db` does not depend on `@tas/domain` — the edge runs the other way
 * everywhere in this repo, exactly as the `conceptName` copy above explains. Nothing below is
 * hand-written: every fixture name is this function applied to a real funnel, type, sequence, batch
 * and seeded concept, so a drifting formula shows up as six changed fixtures rather than as one
 * stale string. `apps/web` depends on both packages and is where the two are asserted equal.
 *
 * The product suffix is optional ("if needed"): it disambiguates a creative whose concept does not
 * already name the product, which in practice is the standalone static.
 */
function creativeName(spec: {
  funnel: CreativeFunnel;
  format: CreativeType;
  number: number;
  batch: string;
  conceptName: string;
  version: number;
  product?: string;
}): string {
  const head = `${FUNNEL_LETTER[spec.funnel]}${FORMAT_LETTER[spec.format]}${String(spec.number)}`;
  const suffix = spec.product === undefined ? '' : `-${spec.product}`;
  return `${head}-${spec.batch}-${spec.conceptName}-V${String(spec.version)}${suffix}`;
}

/**
 * The CONCEPT NAME segment of a creative name: the concept's own generated `Batch-Angle-Theme` name
 * with its batch prefix removed, because the batch is already the segment before it. PRD §7's second
 * example — `AV1-B1-Less Pressure Means Less Pain-Educational Content-V1` — is exactly this: batch
 * once, then the Angle-Theme pairing.
 */
function conceptSegment(concept: ConceptListRow): string {
  const prefix = `${concept.batch ?? ''}-`;
  return concept.name.startsWith(prefix) ? concept.name.slice(prefix.length) : concept.name;
}

/**
 * PRD §8's default dimension set for a type: "4:5 or 1:1 (1080x1080) … plus 9:16" for video,
 * "1:1 and 9:16" for statics. A carousel is a set of stills, so it takes the static set; a motion
 * image is cut like a video and takes the video set. Editable per row — these are the defaults a
 * fresh brief starts from, and the ratio vocabulary itself lives in `packages/domain/src/creatives`.
 */
function dimensionsFor(type: CreativeType): string[] {
  return type === 'Static' || type === 'Carousel' ? ['1:1', '9:16'] : ['4:5', '1:1', '9:16'];
}

/** The generated name, the inherited names and the §8 dimensions of a brief built on a concept. */
function fromConcept(
  concept: ConceptListRow,
  spec: { funnel: CreativeFunnel; type: CreativeType; sequence: number; version: number },
) {
  const batch = concept.batch ?? '';
  return {
    conceptId: concept.id,
    batch,
    funnel: spec.funnel,
    type: spec.type,
    sequence: spec.sequence,
    version: spec.version,
    dimensions: dimensionsFor(spec.type),
    name: creativeName({
      funnel: spec.funnel,
      format: spec.type,
      number: spec.sequence,
      batch,
      conceptName: conceptSegment(concept),
      version: spec.version,
    }),
    conceptName: concept.name,
    angleName: concept.angleName,
    productName: concept.productName,
  };
}

/**
 * The same for a STANDALONE brief (PRD §8, CLAUDE.md non-negotiable 5): no concept, so the slug
 * fills the concept segment and all three inherited names are null — there is no concept to reach an
 * angle through, and no angle to reach a product through. The product still appears in the NAME,
 * because a standalone static is written for a specific product; it is the optional §7 suffix, not a
 * join, which is precisely why the row can carry it while `productName` stays null.
 */
function standalone(spec: {
  funnel: CreativeFunnel;
  type: CreativeType;
  sequence: number;
  version: number;
  batch: string;
  product: string;
}) {
  return {
    conceptId: null,
    batch: spec.batch,
    funnel: spec.funnel,
    type: spec.type,
    sequence: spec.sequence,
    version: spec.version,
    dimensions: dimensionsFor(spec.type),
    name: creativeName({
      funnel: spec.funnel,
      format: spec.type,
      number: spec.sequence,
      batch: spec.batch,
      conceptName: STANDALONE_CONCEPT_SLUG,
      version: spec.version,
      product: spec.product,
    }),
    conceptName: null,
    angleName: null,
    productName: null,
  };
}

const bodyClockConcept = demoConcept(CONCEPT_BODY_CLOCK_ID);
const notYourAgeConcept = demoConcept(CONCEPT_NOT_YOUR_AGE_ID);
const daylightConcept = demoConcept(CONCEPT_DAYLIGHT_ID);
const ninetyMinutesConcept = demoConcept(CONCEPT_NINETY_MINUTES_ID);

/**
 * Seven creative briefs for Niagara Sleep Solutions (PRD §5.10), one record per creative asset.
 *
 * TWO BOARDS READ THESE SAME ROWS, so the status spread is deliberate and is pinned in
 * `briefs.test.ts`. The Internal Queue (PRD §9/§13) groups every row by `internalStatus`; the Client
 * Queue groups by `clientStatus` and shows a row only when `isClientTrackOpen(internalStatus)` is
 * true AND `clientStatus !== 'launched'`. Which fixture sits where, and why:
 *
 * | # | fixture                        | internal                    | client               | boards |
 * |---|--------------------------------|-----------------------------|----------------------|--------|
 * | 1 | TV1 night-shift nurse video    | `approved`                  | `pending_for_approval` | both |
 * | 2 | TS1 r/Menopause thread static  | `static_design_in_progress` | `pending_for_approval` | internal |
 * | 3 | AM1 lux-meter motion image     | `ad_submitted`              | `pending_for_approval` | internal |
 * | 4 | TV2 ninety-minutes video       | `approved`                  | `pending_for_approval` | both |
 * | 5 | RS1 Night Reset bundle static  | `approved`                  | `approved`           | both |
 * | 6 | TC1 ninety-minutes carousel    | `sent_to_video_editor`      | `pending_for_approval` | internal |
 * | 7 | TV3 driveway control video     | `launched`                  | `launched`           | NEITHER (client), internal only |
 *
 * Reading the table down the columns:
 *
 *   - THREE rows are internally `approved`, so the client board has something to show and both of
 *     its columns are populated: two in Pending for Approval (1 and 4) and one the client has
 *     already signed off (5). Row 5 is the honest one to carry `clientStatus: 'approved'` — its
 *     brief exists because the client marked up V2, so V3 coming back approved is the real
 *     sequence, and it is also the STANDALONE row, so the client board renders a card whose
 *     concept, angle and product all join null (PRD §8).
 *   - THREE rows stay in pre-Approved internal states — 2, 3 and 6 — so the Internal Queue board
 *     keeps cards in Static Design in Progress, Ad Submitted and Sent to Video Editor, one early,
 *     one mid, one per track. Neither board is empty and neither is a copy of the other.
 *   - Row 7 is the exclusion rule made visible: `launched` / `launched` passes `isClientTrackOpen`
 *     and is still kept OFF the client board by the `launched` client status (PRD §9 — the media
 *     buyer has it live, there is nothing left to approve). It is the only row in the Internal
 *     Queue's Launched column, and the only one carrying `performance: 'Winning'`.
 *
 * `isClientTrackOpen` is therefore true on four rows (three `approved` plus the `launched` one) and
 * false on the other three, so the client bar on a brief page is visibly open on some and shut on
 * others (CLAUDE.md non-negotiable 4).
 *
 * All four types are covered (three Video, one Static, one Carousel, one Motion Image, plus the
 * standalone Static), and one row — the retargeting bundle static — has `conceptId: null`: the PRD §8
 * case that the whole nullable link exists for. Four different inspiration providers appear across
 * the set (Meta Ad Library, YouTube, TikTok, Instagram), and one row carries the AI spelling feedback
 * already written.
 *
 * `conceptName`, `angleName` and `productName` are what `listBriefs` inherits through the concept, so
 * the fixtures satisfy `BriefListRow[]` and the page reads demo rows and database rows through one
 * type. The array is in `updated_at` descending order, the order `listBriefs` returns, so a test can
 * compare the two directly.
 */
export const demoBriefs: BriefListRow[] = [
  {
    ...propagationBase(
      BRIEF_BODY_CLOCK_VIDEO_ID,
      '2026-08-30T09:20:00.000Z',
      '2026-09-15T16:40:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    ...fromConcept(bodyClockConcept, { funnel: 'TOF', type: 'Video', sequence: 1, version: 2 }),
    source: 'TAS',
    priority: 'Video High',
    assignee: 'Dorian Vance',
    briefToDesign:
      'Cut the V2 from the 14 September rushes, not from the V1 timeline — the new driveway take is two seconds tighter and the sun is still behind him. Open on the car pulling in, no logo, no music for the first three seconds; the only sound is the engine and the birds, because every competitor in this feed opens on a bed. Burn the on-screen line "your rota is the abnormal thing, not you" at 0:04 and hold it for a full beat. Keep the blanket reveal to one continuous shot of the quilted channels being laid over him — no cutaway to packaging, the packaging test lost twice. Captions in the brand sans, bottom third, never over his face. Hard out at 0:28 on the 90-night trial card; do not let this run past 30 seconds, the retention drop at 31 is a cliff.',
    scriptContent:
      'NURSE (to camera, still in scrubs, morning sun behind him): Six years of nights. I used to think I was broken.\nNURSE: I am not. The rota is. My body wants to sleep at 4am and I am asking it to sleep at 9.\n(BEAT — he pushes the front door open, bright hallway)\nNURSE: So I stopped trying to fix me and I fixed the room.\n(BLANKET GOES ON — one continuous shot)\nNURSE: Weight, not heat. It is breathable, so I do not wake up at noon soaked through.\n(CUT TO: same man asleep, room still bright)\nVO: Ninety nights to try it. Sleep through the daylight or send it back.',
    elementsTested:
      'Hypothesis: naming the ROTA as the broken thing, rather than the sleeper, beats every comfort-led open with shift workers. V1 opened on the bed and held 31% to three seconds; this cut opens on the driveway and delays the product by nine seconds. If the three-second hold clears 40% with no drop in add-to-cart we move the whole batch to problem-first opens. Second variable, deliberately isolated: "weight, not heat" as the single product claim, with no mention of the fill or the tog rating.',
    inspoLinks: [
      'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=CA&id=1204339857741622',
      'https://www.youtube.com/watch?v=nm1TxQj9IsQ',
    ],
    platform: 'Meta',
    designFileUrl: 'https://frame.example/niagara/tv1-b1-v2-master',
    qaVideoEditor: true,
    qaDesigner: true,
    qaStrategist: true,
    spellingFeedback: null,
    spellingFeedback2: null,
    clickForAiSpellChecker: false,
    angleId: null,
    productId: null,
    adContent: null,
    inspiration: null,
    inspirationImage: null,
    qaChecklistDoc: null,
    designFile: null,
    scriptAndBriefBreakdown: null,
    language: null,
    offer: null,
    internalStatus: 'approved',
    clientStatus: 'pending_for_approval',
    performance: null,
  },
  {
    ...propagationBase(
      BRIEF_NOT_YOUR_AGE_STATIC_ID,
      '2026-09-02T11:05:00.000Z',
      '2026-09-14T09:10:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    ...fromConcept(notYourAgeConcept, { funnel: 'TOF', type: 'Static', sequence: 1, version: 1 }),
    source: 'TAS',
    priority: 'Static Average',
    assignee: 'Rhiannon Okafor',
    briefToDesign:
      'One static, two ratios, same layout. Top two thirds: the screenshot of the r/Menopause thread, real, unretouched, with the usernames blurred at 40% not blacked out — a black bar reads as a legal notice and kills the credibility we are borrowing. Highlight one comment in the brand accent, the one about the ceiling at 3:47. Bottom third: the blanket on a real unmade bed shot from above, warm but not orange, and the line "Your doctor called it your age. Four hundred women called it 3am." set left, two lines maximum. No price, no badge, no starburst. The 9:16 keeps the same crop of the thread — do not re-flow it into a column, the eye needs to read it as a screenshot, not as a designed block.',
    scriptContent:
      'HEADLINE (on image, over the thread): Your doctor called it your age. Four hundred women called it 3am.\nHIGHLIGHTED COMMENT (pulled from the thread, verbatim): "3:47. Every single night. I could draw that ceiling from memory."\nSUBLINE: Quilted channels spread the weight across you instead of piling it on you, so it never traps the heat you are already fighting.\nPRODUCT LINE: Niagara Deep Sleep Weighted Blanket — breathable cotton shell, 7kg and 9kg.\nCTA: 90 nights. Sleep through it or send it back.\nALT HEADLINE (for the 9:16, if the first runs long): They told her it was her age. The thread told her otherwise.',
    elementsTested:
      'Hypothesis: borrowed proof outperforms claimed proof with this persona. The last three statics in the batch led with the product and a benefit line; this one leads with a real thread and holds the product to the bottom third. Testing whether social proof in the top two thirds lifts click-through enough to survive the lower add-to-cart we expect from a static that never shows a price. Blur level is the second variable — 40% versus fully redacted ran as a hypothesis in the July batch and was never settled.',
    inspoLinks: [
      'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=CA&id=982254173318827',
    ],
    platform: 'Meta',
    designFileUrl: null,
    qaVideoEditor: false,
    qaDesigner: false,
    qaStrategist: false,
    spellingFeedback: null,
    spellingFeedback2: null,
    clickForAiSpellChecker: false,
    angleId: null,
    productId: null,
    adContent: null,
    inspiration: null,
    inspirationImage: null,
    qaChecklistDoc: null,
    designFile: null,
    scriptAndBriefBreakdown: null,
    language: null,
    offer: null,
    internalStatus: 'static_design_in_progress',
    clientStatus: 'pending_for_approval',
    performance: null,
  },
  {
    ...propagationBase(
      BRIEF_DAYLIGHT_MOTION_ID,
      '2026-08-28T13:40:00.000Z',
      '2026-09-12T18:25:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    ...fromConcept(daylightConcept, {
      funnel: 'All Funnels',
      type: 'Motion Image',
      sequence: 1,
      version: 1,
    }),
    source: 'TAS',
    priority: 'Video Average',
    assignee: 'Dorian Vance',
    briefToDesign:
      'Split frame held for the entire runtime: left is the bedroom at 03:00, right is the same bedroom at 09:00, locked off on the same tripod mark so the two halves line up to the pixel. A real lux meter sits in shot in each half with its reading legible — this is filmed live on the day, never an after-effects overlay, and if the meter is not readable in the grade we reshoot rather than fake it. At 0:09 the mask animates on over the right half only and that side crushes down to the left half’s reading, meter and all, in one continuous ramp. Numbers count down on screen with the ramp. End card: the mask on a hotel nightstand with "travels to the on-call room" set small underneath. Motion only, no dialogue, captions carry everything.',
    scriptContent:
      'CARD 1: Same room. Six hours apart.\nCARD 2 (over the meter readings): 3am — 2 lux. 9am — 186 lux.\nCARD 3: You are not failing at sleep. You are being out-lit ninety to one.\n(MASK ANIMATES ON, RIGHT HALF RAMPS DOWN TO 2 LUX)\nCARD 4: Contoured blackout. Cooling insert. Seals at the nose bridge.\nCARD 5: It goes where the blinds cannot. Including the on-call room.',
    elementsTested:
      'Hypothesis: a measured number beats a comfort promise with an audience that reads study abstracts for fun. Every other asset in this batch makes a claim; this one shows an instrument. Testing whether the live lux reading lifts three-second retention and, more importantly, whether it lowers the "does this actually block light" comment rate that ate the first round. Second variable: no voiceover at all, on the theory that this audience scrolls muted at 6am on a ward break.',
    inspoLinks: ['https://www.youtube.com/watch?v=nm1TxQj9IsQ'],
    platform: 'Meta',
    designFileUrl: 'https://frame.example/niagara/am1-b2-v1-review',
    qaVideoEditor: true,
    qaDesigner: true,
    qaStrategist: false,
    spellingFeedback:
      'Two issues and one judgement call. Card 2 reads "3am — 2 lux. 9am — 186 lux." but card 3 says "ninety to one"; 186 over 2 is ninety-three to one, so either round the claim to "ninety to one" honestly or say "ninety-three". Card 5 has "on-call room" hyphenated and the end card has "on call room" without the hyphen — make both hyphenated. "out-lit" is not in the dictionary but it is deliberate and it scans; leaving it.',
    spellingFeedback2: null,
    clickForAiSpellChecker: false,
    angleId: null,
    productId: null,
    adContent: null,
    inspiration: null,
    inspirationImage: null,
    qaChecklistDoc: null,
    designFile: null,
    scriptAndBriefBreakdown: null,
    language: null,
    offer: null,
    internalStatus: 'ad_submitted',
    clientStatus: 'pending_for_approval',
    performance: null,
  },
  {
    ...propagationBase(
      BRIEF_NINETY_MINUTES_VIDEO_ID,
      '2026-09-03T08:55:00.000Z',
      '2026-09-11T10:05:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    ...fromConcept(ninetyMinutesConcept, {
      funnel: 'TOF',
      type: 'Video',
      sequence: 2,
      version: 1,
    }),
    source: 'TAS',
    priority: 'Video High',
    assignee: 'Imogen Bardsley',
    briefToDesign:
      'One creator, one take, straight down the barrel, no B-roll and no music bed. Shoot in a real east-facing flat during the actual morning handover, not the studio — the blown-out window behind her is the whole point and we cannot light it back in. The objection goes in the first ten seconds and she holds the mask up to camera while she says it: blocks light, not sound. Do not cut away while she says that line; a cutaway there reads as a dodge and the comments found it last time. Keep her hair and the unmade sofa exactly as they are. Captions burned in, sentence case, never all-caps. Out at 0:32 on her lying down with the room still bright and the monitor audibly on.',
    scriptContent:
      'CREATOR (sofa, bright window behind her, baby monitor beside her): Nobody is giving you eight hours. I have stopped listening to anyone who says they are.\nCREATOR: I get ninety minutes. Seven in the morning, when he takes over.\nCREATOR (holds mask to camera): This blocks light. Not sound. I still hear him. That is the entire point.\nCREATOR: It is cooling, so I am not lying there too hot to drop off with the sun coming straight in.\n(SHE LIES DOWN. ROOM STILL BRIGHT. MONITOR AUDIBLE.)\nCREATOR (VO): Ninety minutes of actual sleep is not nothing. It is the difference.',
    elementsTested:
      'Hypothesis: new parents have stopped responding to "sleep better" because more sleep is not on offer, so selling the USE of the window they already have beats selling the length of the night. Testing the objection-first structure — "blocks light, not sound" inside ten seconds — against the July cut that held it to 0:22 and lost the thread in the comments before anyone reached the offer. Also testing a single unbroken take against the cut-heavy house style: if hook rate holds, the whole parental-leave audience moves to one-take.',
    inspoLinks: [
      'https://www.tiktok.com/@thepostpartumplan/video/7385012994771635745',
      'https://www.instagram.com/reel/C7pLd4vNqR2/',
    ],
    platform: 'TikTok',
    designFileUrl: 'https://frame.example/niagara/tv2-b3-v1-locked',
    // Internally signed off, so all three QA gates are ticked and the client track is open on this
    // row: it is the second card in the Client Queue's Pending for Approval column.
    qaVideoEditor: true,
    qaDesigner: true,
    qaStrategist: true,
    spellingFeedback: null,
    spellingFeedback2: null,
    clickForAiSpellChecker: false,
    angleId: null,
    productId: null,
    adContent: null,
    inspiration: null,
    inspirationImage: null,
    qaChecklistDoc: null,
    designFile: null,
    scriptAndBriefBreakdown: null,
    language: null,
    offer: null,
    internalStatus: 'approved',
    clientStatus: 'pending_for_approval',
    performance: null,
  },
  {
    ...propagationBase(
      BRIEF_BUNDLE_STANDALONE_ID,
      '2026-08-19T15:15:00.000Z',
      '2026-09-08T15:30:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    ...standalone({
      funnel: 'Retargeting',
      type: 'Static',
      sequence: 1,
      version: 3,
      batch: 'B4',
      product: 'NIGHT RESET BUNDLE',
    }),
    source: 'Client',
    priority: 'Static High',
    assignee: 'Rhiannon Okafor',
    briefToDesign:
      'Standalone retargeting static for the bundle — no concept behind it, it exists to catch the people who viewed the blanket and the mask separately and bought neither. V3 fixes what the client flagged on V2: the bundle saving has to be the largest element on the canvas, and the two products have to be photographed together on one bed, not composited from the two product shots. Blanket laid back on the left side of the bed, mask on the right pillow, one lamp, shot at dusk. Saving set in the accent, "save $64 when they ship together", with the strikethrough on the combined single price directly beneath at half the size. Nothing else on the canvas. 1:1 for feed, 9:16 for stories with the saving moved to the upper third so the sticker tray does not cover it.',
    scriptContent:
      'HEADLINE (largest element on the canvas): Save $64 when they ship together.\nPRICE LINE (half size, directly beneath): $238 bought separately. $174 as the Night Reset Bundle.\nSUBLINE: The blanket for the weight. The mask for the light. One box, one delivery, one decision.\nPRODUCT LINE: Niagara Deep Sleep Weighted Blanket + Niagara Cooling Blackout Sleep Mask.\nCTA: Complete the set.\nALT CTA (test against the above on the 9:16): Get both, save $64.',
    elementsTested:
      'Hypothesis: the retargeting pool is not undecided about the products, it is undecided about spending twice, so the saving is the message and the product story is not. V2 led with "one box, two problems" and the client was right that the saving was buried. V3 makes the number the largest element and drops the benefit copy to a single line. Testing saving-as-hero against benefit-as-hero at the same spend and the same audience; if it wins, every retargeting static in the account gets rebuilt this way.',
    inspoLinks: [
      'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=CA&id=760118443925514',
    ],
    platform: 'Meta',
    designFileUrl: 'https://frame.example/niagara/rs1-b4-v3-client-markup',
    // A static, so there is no video editor gate to tick; the designer and the strategist both
    // signed V3 off. This is the one row the CLIENT has already approved — V3 exists because the
    // client marked up V2, so it came back approved rather than pending — which is why it sits in
    // the Client Queue's Approved column while everything else waits in Pending for Approval.
    qaVideoEditor: false,
    qaDesigner: true,
    qaStrategist: true,
    spellingFeedback: null,
    spellingFeedback2: null,
    clickForAiSpellChecker: false,
    angleId: null,
    productId: null,
    adContent: null,
    inspiration: null,
    inspirationImage: null,
    qaChecklistDoc: null,
    designFile: null,
    scriptAndBriefBreakdown: null,
    language: null,
    offer: null,
    internalStatus: 'approved',
    clientStatus: 'approved',
    performance: 'High Potential to Iterate',
  },
  {
    ...propagationBase(
      BRIEF_NINETY_MINUTES_CAROUSEL_ID,
      '2026-09-05T10:30:00.000Z',
      '2026-09-05T11:45:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    ...fromConcept(ninetyMinutesConcept, {
      funnel: 'TOF',
      type: 'Carousel',
      sequence: 1,
      version: 1,
    }),
    source: 'TAS',
    priority: 'Video Average',
    assignee: 'Imogen Bardsley',
    briefToDesign:
      'Five cards, built from the same shoot as the one-take video so the creator is recognisable across both — the carousel is the second exposure, not a separate campaign. Card one is the hook in type over the blown-out window, no product. Cards two to four each take one objection and answer it in a single line with one photograph: the sound objection, the heat objection, the "it will slide off" objection. Card five is the bundle shot with the trial. Type set large enough to read at feed size on a phone held at arm’s length; if it needs a second look it is too small. Keep the creator in at least two of the five cards, face visible.',
    scriptContent:
      'CARD 1: You get ninety minutes. Here is how to actually sleep them.\nCARD 2: It blocks light, not sound. You will still hear the monitor.\nCARD 3: Cooling insert at the nose bridge, so you are not lying there too hot to drop off.\nCARD 4: Contoured, so it clears your eyes and stays where you put it.\nCARD 5: Ninety nights to try it. Sleep the handover or send it back.',
    elementsTested:
      'Hypothesis: the three objections that eat the comments — sound, heat, slippage — convert better answered one per card than compressed into a thirty-second script. Testing the carousel as a second exposure against the same audience that saw the one-take video, so we can read incremental lift rather than standalone performance. Card one carries no product at all, which is the second variable: whether a type-only hook card earns the swipe.',
    inspoLinks: [],
    platform: 'Meta',
    designFileUrl: null,
    qaVideoEditor: false,
    qaDesigner: false,
    qaStrategist: false,
    spellingFeedback: null,
    spellingFeedback2: null,
    clickForAiSpellChecker: false,
    angleId: null,
    productId: null,
    adContent: null,
    inspiration: null,
    inspirationImage: null,
    qaChecklistDoc: null,
    designFile: null,
    scriptAndBriefBreakdown: null,
    language: null,
    offer: null,
    internalStatus: 'sent_to_video_editor',
    clientStatus: 'pending_for_approval',
    performance: null,
  },
  {
    // PRD §9's exclusion rule, made visible. `isClientTrackOpen('launched')` is true, so this row
    // is past internal sign-off — and it is still kept OFF the Client Queue board because its
    // CLIENT status is `launched`: the media buyer has it live and there is nothing left for the
    // client to approve. It is the only row in the Internal Queue's Launched column, and the only
    // fixture carrying `performance: 'Winning'`.
    ...propagationBase(
      BRIEF_BODY_CLOCK_LAUNCHED_ID,
      '2026-08-12T10:05:00.000Z',
      '2026-09-04T08:15:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    ...fromConcept(bodyClockConcept, { funnel: 'TOF', type: 'Video', sequence: 3, version: 1 }),
    source: 'TAS',
    priority: 'Video High',
    assignee: 'Dorian Vance',
    briefToDesign:
      'The fifteen-second cutdown that is actually running in the account — do not re-edit this one. The row exists so anyone can find what is live and what the rest of B1 is being measured against. Same driveway location as TV1 but the 9 August shoot, not the September rushes, and the whole 3am/9am comparison is stripped out: it opens on the handover at 07:12 with his lanyard still on and never leaves the hallway. The first line lands at 0:02, not 0:04, because the Reels placement loses them before the fourth second. One cut only, on the blanket going on. No end card and no trial claim — the offer is carried by the copy, which is the only reason this fits the fifteen-second slot the 28-second cut never did. If anyone opens this to iterate, branch a new version and leave the live asset alone.',
    scriptContent:
      'NURSE (hospital corridor, 07:12, lanyard still on): Twelve hours. The sun is coming up and I have to go to bed.\nNURSE: Everyone keeps telling me to fix my sleep. Nobody tells me how to sleep at eight in the morning.\n(ONE CUT — BLANKET GOES ON, BEDROOM, CURTAINS OPEN)\nNURSE: Weight, not heat. That is the whole thing.\n(HE IS ALREADY ASLEEP. THE ROOM IS BRIGHT.)\nSUPER: Built for the people who sleep while the sun is up.',
    elementsTested:
      'Settled, not open: this is the control every TOF video in B1 is now measured against. It took the fifteen-second slot on hook rate — 48% held to three seconds against 31% for the 28-second cut — and it still holds the account’s lowest cost per add-to-cart, which is why it is marked Winning and why the brief is frozen rather than iterated. The variable it settled was LENGTH at a fixed opening: same corridor, same first line, fifteen seconds against twenty-eight. What it did not settle, and what TV1 V2 is in the queue to test, is whether a problem-first open that delays the product by nine seconds beats it outright.',
    inspoLinks: [
      'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=CA&id=1188402955347119',
    ],
    platform: 'Meta',
    designFileUrl: 'https://frame.example/niagara/tv3-b1-v1-live',
    qaVideoEditor: true,
    qaDesigner: true,
    qaStrategist: true,
    spellingFeedback: null,
    spellingFeedback2: null,
    clickForAiSpellChecker: false,
    angleId: null,
    productId: null,
    adContent: null,
    inspiration: null,
    inspirationImage: null,
    qaChecklistDoc: null,
    designFile: null,
    scriptAndBriefBreakdown: null,
    language: null,
    offer: null,
    internalStatus: 'launched',
    clientStatus: 'launched',
    performance: 'Winning',
  },
];

/** One seeded brief by id, past `noUncheckedIndexedAccess`; the copy rows below are tied to these. */
function demoBrief(id: string): BriefListRow {
  const row = demoBriefs.find((brief) => brief.id === id);
  if (row === undefined) throw new Error(`demoBriefs has no ${id}`);
  return row;
}

/**
 * Four copy rows for Niagara Sleep Solutions (PRD §5.11), the words that run above and beneath the
 * creative.
 *
 * Three are tied to a seeded brief and reuse its id constant, so the link is a real one: the
 * night-shift video, the r/Menopause static and the lux-meter motion image. The fourth has
 * `creativeBriefId: null` — copy drafted for the Night Reset Bundle before anyone decided which
 * static it would sit on — which is the PRD §5.11 case the nullable link exists for, and what
 * `listCopy` returns `creativeName: null` for and the table renders as an em dash.
 *
 * They sit in four DIFFERENT `COPY_STATUS` keys (`@tas/domain/state`): `approved`,
 * `pending_for_client_review`, `edited_by_client` and `revisions_needed`. Exactly one is
 * `edited_by_client`, and it is the only row carrying a `clientComment` — the client rewrote the
 * headline in place, which is precisely what that status means. Three different CTAs appear across
 * the set (Shop Now, Learn More, Get Offer).
 *
 * Every string respects the PRD §5.11 guidance the panel shows as helper text: primary copy at or
 * under ~125 characters, headline ~40, link description ~27. They are written to the limit rather
 * than truncated to it, because the fixtures are the demo product and a strategist reading them
 * should see what a real Meta ad looks like at that length.
 *
 * `creativeName` is what `listCopy` joins in through the brief, so the fixtures satisfy
 * `CopyListRow[]` and the page reads demo rows and database rows through one type. The array is in
 * `updated_at` descending order, the order `listCopy` returns, so a test can compare the two
 * directly.
 */
export const demoCopy: CopyListRow[] = [
  {
    ...propagationBase(COPY_BODY_CLOCK_ID, '2026-09-01T10:15:00.000Z', '2026-09-16T11:20:00.000Z'),
    brandId: DEMO_BRAND_ID,
    creativeBriefId: BRIEF_BODY_CLOCK_VIDEO_ID,
    conceptId: null,
    productId: null,
    copyNumber: 1,
    primaryCopy:
      'Six years of night shifts and he still could not sleep at noon. It is the rota, not you. Weight, not heat. Ninety nights.',
    headline: 'Your Rota Is Broken. You Are Not.',
    linkDescription: '90 nights. Sleep or return.',
    cta: 'Shop Now',
    status: 'approved',
    clientComment: null,
    creativeName: demoBrief(BRIEF_BODY_CLOCK_VIDEO_ID).name,
    conceptName: null,
    used: false,
    winning: false,
    metaRating: null,
    funnel: null,
    clickForAiSpellChecker: false,
    spellingFeedback: null,
  },
  {
    ...propagationBase(
      COPY_NOT_YOUR_AGE_ID,
      '2026-09-04T09:40:00.000Z',
      '2026-09-15T14:05:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    creativeBriefId: BRIEF_NOT_YOUR_AGE_STATIC_ID,
    conceptId: null,
    productId: null,
    copyNumber: 2,
    primaryCopy:
      'Her doctor called it her age. Four hundred women in one thread called it 3:47am. Quilted weight that spreads, never traps.',
    headline: 'They Called It Your Age. It Is 3am.',
    linkDescription: 'Read the 3am thread first.',
    cta: 'Learn More',
    status: 'pending_for_client_review',
    clientComment: null,
    creativeName: demoBrief(BRIEF_NOT_YOUR_AGE_STATIC_ID).name,
    conceptName: null,
    used: false,
    winning: false,
    metaRating: null,
    funnel: null,
    clickForAiSpellChecker: false,
    spellingFeedback: null,
  },
  {
    ...propagationBase(COPY_DAYLIGHT_ID, '2026-09-02T12:25:00.000Z', '2026-09-13T17:30:00.000Z'),
    brandId: DEMO_BRAND_ID,
    creativeBriefId: BRIEF_DAYLIGHT_MOTION_ID,
    conceptId: null,
    productId: null,
    copyNumber: 3,
    primaryCopy:
      'Same bedroom, six hours apart: 2 lux at 3am, 186 lux at 9am. You are not failing at sleep, you are being out-lit 90 to 1.',
    headline: 'Not Bad Sleep. Ninety Times The Light.',
    linkDescription: 'Blocks 186 lux, not sound.',
    cta: 'Get Offer',
    status: 'edited_by_client',
    clientComment:
      'Swapped the headline ourselves — "Not Bad Sleep" reads as us calling their sleep bad, and our support inbox is full of people who already feel judged about it. The lux numbers stay, they are the best thing in here, but please keep 186 and 2 as digits everywhere; spelling them out in the link description made it look like a pharmacy leaflet. One more: legal will not sign off on "90 to 1" unless the meter reading is in the asset itself, which I think it is, so send the frame and we will clear it.',
    creativeName: demoBrief(BRIEF_DAYLIGHT_MOTION_ID).name,
    conceptName: null,
    used: false,
    winning: false,
    metaRating: null,
    funnel: null,
    clickForAiSpellChecker: false,
    spellingFeedback: null,
  },
  {
    ...propagationBase(
      COPY_BUNDLE_UNATTACHED_ID,
      '2026-08-27T16:05:00.000Z',
      '2026-09-10T08:50:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    // Drafted before anyone chose which bundle static it runs on: the PRD §5.11 unattached case.
    creativeBriefId: null,
    conceptId: null,
    productId: null,
    copyNumber: 4,
    primaryCopy:
      'You bought the blanket and left the mask behind. The weight handles 3am, the light handles 6am, and the box handles both.',
    headline: 'Save $64 When They Ship Together.',
    linkDescription: 'Both for $174 tonight.',
    cta: 'Shop Now',
    status: 'revisions_needed',
    clientComment: null,
    creativeName: null,
    conceptName: null,
    used: false,
    winning: false,
    metaRating: null,
    funnel: null,
    clickForAiSpellChecker: false,
    spellingFeedback: null,
  },
];

/**
 * The instant every partnership countdown in the demo is measured from.
 *
 * Fixed, exported, and NOT `Date.now()`. A fixture that derived its activation date from the clock
 * would make "expires in 3 days" true at build time and false the next morning, and a test that
 * asserted 3 would be a test that fails on a Tuesday. So the activation dates below are literal
 * timestamps chosen against THIS instant, and the app passes it as `now` in demo mode (the live
 * path passes the real clock, because live rows carry real activation dates). One reference date
 * shared by the fixtures, the page and the tests is what makes the countdown agree everywhere.
 */
export const PARTNERSHIP_REFERENCE_DATE = at('2026-09-17T09:00:00.000Z');

/**
 * A creator's profile picture as an inline SVG data URI: a rounded tile with their initials.
 *
 * Deterministic and OFFLINE on purpose. The demo deployment runs with no environment variables at
 * all — no Clerk, no database, and no object storage — and a fixture pointing at a remote avatar
 * (an R2 key, a Fiverr CDN URL, a placeholder service) would render as a broken image on the one
 * deployment anybody actually looks at, and would make the tests depend on a network. A data URI is
 * bytes in the row: it renders in an `<img src>` with the machine unplugged, it is identical in
 * every process, and it is exactly the shape a real `profile_pic_url` has, so the page needs no
 * branch between demo and live.
 *
 * Colours are `hsl()` rather than hex, matching the `--surface3` / `--text3` tokens by value: this
 * is DATA (a stand-in for an uploaded photo), not a component, so it cannot import the token layer —
 * and a real deployment replaces the whole string with the creator's own picture.
 */
function initialsAvatar(initials: string): string {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">' +
    '<rect width="96" height="96" rx="14" fill="hsl(26 15% 13%)"/>' +
    '<text x="48" y="49" text-anchor="middle" dominant-baseline="central" ' +
    'font-family="system-ui, sans-serif" font-size="34" font-weight="600" ' +
    `fill="hsl(30 9% 54%)">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Five creators for Niagara Sleep Solutions (PRD §5.8), with §5.8.1's partnership fields on the same
 * rows — the people who actually film the ads the concepts and briefs above describe.
 *
 * Read them as one roster, not five independent records: Danielle and Marcus are the two the brand
 * keeps re-booking (Direct Management and Insense), Priya was a marketplace booking that turned into
 * a partnership and then ended, Tomás is mid-shipment on his first brief and Hannah has just
 * delivered. They sit in FIVE different `CREATOR_STATUS` keys (the client-facing track): approved,
 * revisions_needed, due_shipment, video_delivered and pending_for_approval, across three genders and
 * five age brackets, one per PRD platform.
 *
 * Tomás carries `profilePicUrl: null` deliberately: a creator sourced off a Fiverr gig often has no
 * usable headshot on day one, and the grid must fall back to initials rather than a broken image.
 *
 * THE THREE PARTNERSHIPS are the whole point of §5.8.1, and their activation dates are chosen
 * against `PARTNERSHIP_REFERENCE_DATE` so the countdown is the same on any day the demo is opened:
 *
 *   - Danielle: activated 2026-07-22 for 60 days, no extension → lapses 2026-09-20, THREE days out.
 *     Inside the 25-day window PRD §5.8.1 wants the Slack reminder for, so this is the highlighted
 *     row and the one the reminder would fire on.
 *   - Marcus: activated 2026-07-09 for 60 days PLUS a 30-day extension → lapses 2026-10-07, twenty
 *     days out. The extension is what makes his expiry later than Danielle's although he was
 *     whitelisted first, which is exactly the arithmetic a stored expiry column would get wrong.
 *   - Priya: activated 2026-04-15 for 30 days, never extended → lapsed 2026-05-15, months ago, and
 *     her activity is `ended`. The row stays in the list: it is the brand's partnership history.
 *
 * The other two have `forPartnershipAds: false` and no partnership data at all, which is the
 * ordinary case — most creators are hired for a video and never whitelisted.
 *
 * Money is whole US dollars (`schema/creators.ts`). The array is in `updated_at` descending order,
 * the order `listCreators` returns, so a test can compare the two directly.
 */
export const demoCreators: CreatorListRow[] = [
  {
    ...propagationBase(CREATOR_DANIELLE_ID, '2026-06-18T13:20:00.000Z', '2026-09-16T11:40:00.000Z'),
    brandId: DEMO_BRAND_ID,
    name: 'Danielle Okonkwo',
    ageBracket: '25-34',
    gender: 'Female',
    ethnicity: 'Black Canadian',
    profilePicUrl: initialsAvatar('DO'),
    videoIntroUrl: 'https://vimeo.com/niagarasleep/danielle-okonkwo-intro',
    creatorLink: 'https://www.instagram.com/danielle.sleeps.late',
    platform: 'Direct Management',
    internalBrief:
      'Danielle is the night-shift voice for the whole Body Clock batch — she worked four years of 12-hour ER nights in Hamilton before moving to comms, so she can say "I drove home in daylight" without us scripting it. Film the one-take hook in her actual bedroom at 08:30 with the blinds open, not a set: the blown-out window IS the proof. Two takes maximum, no ring light, phone on a stack of books. She talks fast, so ask for one slow read of the ninety-nights line at the end that we can cut back in.',
    shippingLocation: 'Hamilton, ON L8P 4W7, Canada',
    trackingNumber: 'CP 4192 8830 1147 CA',
    dateOfManagement: at('2026-06-18T13:20:00.000Z'),
    deadline: at('2026-09-26T21:00:00.000Z'),
    budgetPer60s: 420,
    creatorCost: 630,
    costUsd: null,
    internalCreatorStatus: 'approved',
    clientStatus: 'approved',
    internalAssetsStatus: 'approved',
    clientNote:
      'She is the one. Keep her on the night-shift angles and do not put her in anything menopause-adjacent — different audience, and she is thirty.',
    rawAssetsUrl: null,
    conceptIds: [],
    productIds: [],
    instagramUsername: '@danielle.sleeps.late',
    forPartnershipAds: true,
    partnershipActivity: 'active',
    // 60 days from 2026-07-22 lapses 2026-09-20: three days after PARTNERSHIP_REFERENCE_DATE.
    partnershipActivatedAt: at('2026-07-22T09:00:00.000Z'),
    partnershipPeriodDays: 60,
    continueWorkingWith: true,
    extensionDays: 0,
    partnershipPricePer30Days: 750,
    partnershipNotes:
      'Whitelisted from her own handle for the Body Clock video and the r/nursing static. Expires in three days and the top ad is still spending — get the extension signed before Sunday or Meta drops the placement mid-flight. She has already said yes verbally, it is the paperwork that is late.',
    facebookProfileUrl: 'https://www.facebook.com/danielle.okonkwo.creator',
  },
  {
    ...propagationBase(CREATOR_MARCUS_ID, '2026-06-02T10:05:00.000Z', '2026-09-15T09:25:00.000Z'),
    brandId: DEMO_BRAND_ID,
    name: 'Marcus Delacroix',
    ageBracket: '35-44',
    gender: 'Male',
    ethnicity: 'Mixed — Haitian and French Canadian',
    profilePicUrl: initialsAvatar('MD'),
    videoIntroUrl: 'https://vimeo.com/niagarasleep/marcus-delacroix-intro',
    creatorLink: 'https://insense.pro/creators/marcus-delacroix',
    platform: 'Insense',
    internalBrief:
      'Marcus is the sceptic. He opens every video by saying he did not believe it, which is why the comments do not read as an ad. Brief him on the thermostat angle: he overheats, he has thrown two weighted blankets out for exactly that reason, and we want him to say so on camera before the product appears. Shoot in his own bedroom in Montreal, ambient light only. He needs the fabric spec in writing beforehand or he will refuse to make the cooling claim, which is the correct instinct and the reason we book him.',
    shippingLocation: 'Montréal, QC H2T 1S4, Canada',
    trackingNumber: 'CP 7731 0064 9982 CA',
    dateOfManagement: at('2026-06-02T10:05:00.000Z'),
    deadline: at('2026-10-02T21:00:00.000Z'),
    budgetPer60s: 380,
    creatorCost: 540,
    costUsd: null,
    internalCreatorStatus: 'approved',
    clientStatus: 'filming_in_progress',
    internalAssetsStatus: 'pending_for_cs_approval',
    clientNote: null,
    rawAssetsUrl: null,
    conceptIds: [],
    productIds: [],
    instagramUsername: '@marcus.after.midnight',
    forPartnershipAds: true,
    partnershipActivity: 'active',
    // 60 + 30 days from 2026-07-09 lapses 2026-10-07: twenty days after the reference date. He was
    // whitelisted before Danielle and still expires later — the extension is why.
    partnershipActivatedAt: at('2026-07-09T09:00:00.000Z'),
    partnershipPeriodDays: 60,
    continueWorkingWith: true,
    extensionDays: 30,
    partnershipPricePer30Days: 600,
    partnershipNotes:
      'Extended by 30 days in August when the thermostat creative went from testing into the always-on set. Runs from his handle on Meta only — he has no TikTok and has asked us not to repurpose the footage there. Invoice is per 30 days and does not include the content fee above.',
    facebookProfileUrl: 'https://www.facebook.com/marcus.delacroix.mtl',
  },
  {
    ...propagationBase(CREATOR_PRIYA_ID, '2026-03-30T15:45:00.000Z', '2026-09-14T15:10:00.000Z'),
    brandId: DEMO_BRAND_ID,
    name: 'Priya Raghunathan',
    ageBracket: '45-54',
    gender: 'Female',
    ethnicity: 'South Asian — Tamil Canadian',
    profilePicUrl: initialsAvatar('PR'),
    videoIntroUrl: 'https://vimeo.com/niagarasleep/priya-raghunathan-intro',
    creatorLink: 'https://billo.app/creators/priya-raghunathan',
    platform: 'Billo',
    internalBrief:
      'Priya filmed the first perimenopause cut in March and it is still the best-performing static we have. She reads the 3:47am line as a fact about her own week, because it is. Brief for the follow-up: no soft focus, no candles, no spa language — she has said plainly that the category patronises women her age and she will not read a script that does. Kitchen table at night, overhead light on, exactly like the first one.',
    shippingLocation: 'Mississauga, ON L5B 3C2, Canada',
    trackingNumber: 'CP 2205 4417 6690 CA',
    dateOfManagement: at('2026-03-30T15:45:00.000Z'),
    deadline: at('2026-09-19T21:00:00.000Z'),
    budgetPer60s: 260,
    creatorCost: 390,
    costUsd: null,
    internalCreatorStatus: 'revisions_needed',
    clientStatus: 'revisions_needed',
    internalAssetsStatus: 'revisions_needed',
    clientNote:
      'Love her, but the second cut has the brand name in the first two seconds and the first one did not. That is the whole difference. Send it back and ask for the cold open.',
    rawAssetsUrl: null,
    conceptIds: [],
    productIds: [],
    instagramUsername: '@priya.at.3am',
    forPartnershipAds: true,
    partnershipActivity: 'ended',
    // 30 days from 2026-04-15 lapsed 2026-05-15, months before the reference date.
    partnershipActivatedAt: at('2026-04-15T09:00:00.000Z'),
    partnershipPeriodDays: 30,
    continueWorkingWith: false,
    extensionDays: 0,
    partnershipPricePer30Days: 450,
    partnershipNotes:
      'One 30-day whitelisting window in April that we did not renew — her handle skews too far outside the buying audience for paid, although her organic reach on the thread posts is the reason we found her. We still book her for content; the partnership itself is closed and should not be reactivated without asking her first.',
    facebookProfileUrl: null,
  },
  {
    ...propagationBase(CREATOR_TOMAS_ID, '2026-08-28T09:10:00.000Z', '2026-09-11T08:05:00.000Z'),
    brandId: DEMO_BRAND_ID,
    name: 'Tomás Ferreira',
    ageBracket: '18-24',
    gender: 'Male',
    ethnicity: 'Brazilian',
    // No headshot yet: a Fiverr booking arrives with a gig thumbnail and nothing usable, so the
    // grid falls back to initials rather than rendering a broken image.
    profilePicUrl: null,
    videoIntroUrl: null,
    creatorLink: 'https://www.fiverr.com/tomasferreira_ugc',
    platform: 'Fiverr',
    internalBrief:
      'First booking, cheapest of the roster, and the only one under 25 — he is here to test whether the ninety-minute-window angle reads to students as well as it does to new parents. Two variants of the same thirty-second script, one filmed at a desk at 02:00 and one in bed at 09:00, both vertical, both on his own phone. Do not send him the full brief document; he has asked for a one-page shot list and he is right that it works better.',
    shippingLocation: 'Toronto, ON M5V 2K4, Canada',
    trackingNumber: 'CP 9043 1178 2265 CA',
    dateOfManagement: at('2026-08-28T09:10:00.000Z'),
    deadline: at('2026-10-10T21:00:00.000Z'),
    budgetPer60s: 150,
    creatorCost: 150,
    costUsd: null,
    internalCreatorStatus: 'pending_for_cs_approval',
    clientStatus: 'due_shipment',
    internalAssetsStatus: 'pending_for_cs_approval',
    clientNote: null,
    rawAssetsUrl: null,
    conceptIds: [],
    productIds: [],
    instagramUsername: null,
    forPartnershipAds: false,
    partnershipActivity: 'not_active',
    partnershipActivatedAt: null,
    partnershipPeriodDays: null,
    continueWorkingWith: null,
    extensionDays: 0,
    partnershipPricePer30Days: null,
    partnershipNotes: null,
    facebookProfileUrl: null,
  },
  {
    ...propagationBase(CREATOR_HANNAH_ID, '2026-07-14T11:30:00.000Z', '2026-09-08T17:45:00.000Z'),
    brandId: DEMO_BRAND_ID,
    name: 'Hannah Whitcombe',
    ageBracket: '55-64',
    gender: 'Non-binary',
    ethnicity: 'White — British Canadian',
    profilePicUrl: initialsAvatar('HW'),
    videoIntroUrl: 'https://vimeo.com/niagarasleep/hannah-whitcombe-intro',
    creatorLink: 'https://www.backstage.com/u/hannah-whitcombe',
    platform: 'Backstage',
    internalBrief:
      'Trained actor, booked through Backstage rather than a UGC marketplace, and the only person on the roster who can carry a scripted read without it sounding scripted. Use them for the lux-meter motion image voiceover and the retargeting cutdowns where we need the words hit exactly. They live in a top-floor flat in Ottawa with east-facing windows, which is the actual set for the 186-lux shot — no lighting rig, we want the real reading on camera.',
    shippingLocation: 'Ottawa, ON K1N 7B7, Canada',
    trackingNumber: 'CP 6618 9924 0053 CA',
    dateOfManagement: at('2026-07-14T11:30:00.000Z'),
    deadline: at('2026-09-12T21:00:00.000Z'),
    budgetPer60s: 500,
    creatorCost: 500,
    costUsd: null,
    internalCreatorStatus: 'approved',
    clientStatus: 'video_delivered',
    internalAssetsStatus: 'approved',
    clientNote:
      'Delivered a day early and the lux reading is legible on a phone, which is all we asked for. Book them again for the Q4 gifting set.',
    rawAssetsUrl: null,
    conceptIds: [],
    productIds: [],
    instagramUsername: '@hannahwhitcombe',
    forPartnershipAds: false,
    partnershipActivity: 'not_active',
    partnershipActivatedAt: null,
    partnershipPeriodDays: null,
    continueWorkingWith: null,
    extensionDays: 0,
    partnershipPricePer30Days: null,
    partnershipNotes: null,
    facebookProfileUrl: null,
  },
];

/**
 * The §5.8.1 list: the three creators marked for partnership ads, in the same `updated_at`
 * descending order `listPartnershipCreators` returns them. Derived from `demoCreators` by the one
 * qualifier the query filters on, rather than written out a second time, so the two can never drift.
 */
export const demoPartnershipCreators: CreatorListRow[] = demoCreators.filter(
  (creator) => creator.forPartnershipAds,
);

/**
 * The four client brands on the agency's roster (PRD §3: the brands TAS Digital runs). Niagara Sleep
 * Solutions is the one with content — every product, angle, concept, brief, copy row and creator
 * above belongs to it, which is why it keeps `DEMO_BRAND_ID` — and the other three carry no rows
 * yet. They exist because the Team table has to show a person spread across real brands rather than
 * one: an agency where every name reads "Niagara Sleep Solutions" tells a visitor nothing about how
 * assignment works. `seed(db)` inserts all four as children of the parent template (CLAUDE.md
 * non-negotiable 1), so a seeded database and the fixtures name the same brands.
 */
export type DemoBrand = { id: string; name: string; slug: string; website: string };

export const demoBrands: DemoBrand[] = [
  {
    id: DEMO_BRAND_ID,
    name: 'Niagara Sleep Solutions',
    slug: 'niagara-sleep-solutions',
    website: 'https://niagarasleep.example',
  },
  {
    id: BRAND_MATTRESS_CENTRAL_ID,
    name: 'Mattress Central',
    slug: 'mattress-central',
    website: 'https://mattresscentral.example',
  },
  { id: BRAND_GRATSI_ID, name: 'Gratsi', slug: 'gratsi', website: 'https://gratsi.example' },
  {
    id: BRAND_FUNKY_PAINTING_ID,
    name: 'Funky Painting',
    slug: 'funky-painting',
    website: 'https://funkypainting.example',
  },
];

/** The shared columns a team fixture carries: the admin provisioned every account, including his own. */
function teamBase(id: string, created: string, updated: string) {
  return {
    id,
    brandId: null,
    createdAt: at(created),
    updatedAt: at(updated),
    createdBy: DEMO_ADMIN_ACTOR_ID,
    updatedBy: DEMO_ADMIN_ACTOR_ID,
    deletedAt: null,
  };
}

/**
 * The five people of TAS Digital (PRD §11, §3: "TAS Digital should be added in a team dashboard,
 * with their role and names").
 *
 * Five people covering six roles, because that is what a five-person agency actually looks like:
 * Callum runs the client relationships AND the ad accounts, so he holds `csm` and `media_buyer` and
 * the table shows him two chips. The other four are one role each — admin, strategist, video editor,
 * designer.
 *
 * Three of the five are the names already on the demo briefs (Dorian Vance, Imogen Bardsley and
 * Rhiannon Okafor), so the Team page and the Internal Queue name the same people; `DEMO_ACTOR_ID`
 * is Dorian's Clerk id and `DEMO_ADMIN_ACTOR_ID` is Marguerite's, the two identities `seed(db)` has
 * always written. Placeholder Clerk ids and `.example` addresses never collide with real accounts.
 *
 * `lastActiveAt` is a fixed timestamp, never `Date.now()`: the fixtures render the same relative
 * string on every run and in every screenshot. They are spread across the days before
 * `PARTNERSHIP_REFERENCE_DATE` (17 September 2026) so the Last active column shows a range — this
 * morning, yesterday, last week — rather than five identical values.
 */
export const demoUsers: User[] = [
  {
    ...teamBase(USER_CALLUM_ID, '2025-11-04T09:15:00.000Z', '2026-08-28T15:10:00.000Z'),
    clerkUserId: 'user_seed_csm',
    email: 'callum@tasdigital.example',
    fullName: 'Callum Ashworth',
    slackUserId: 'U04CASHWORTH',
    lastActiveAt: at('2026-09-10T14:30:00.000Z'),
  },
  {
    ...teamBase(USER_DORIAN_ID, '2025-03-18T11:40:00.000Z', '2026-09-02T08:05:00.000Z'),
    clerkUserId: DEMO_ACTOR_ID,
    email: 'dorian@tasdigital.example',
    fullName: 'Dorian Vance',
    slackUserId: 'U02DVANCE',
    lastActiveAt: at('2026-09-17T07:55:00.000Z'),
  },
  {
    ...teamBase(USER_IMOGEN_ID, '2025-06-09T13:25:00.000Z', '2026-07-21T10:35:00.000Z'),
    clerkUserId: 'user_seed_video_editor',
    email: 'imogen@tasdigital.example',
    fullName: 'Imogen Bardsley',
    slackUserId: 'U03IBARDSLEY',
    lastActiveAt: at('2026-09-16T17:20:00.000Z'),
  },
  {
    ...teamBase(USER_MARGUERITE_ID, '2024-09-02T08:00:00.000Z', '2026-09-01T09:45:00.000Z'),
    clerkUserId: DEMO_ADMIN_ACTOR_ID,
    email: 'marguerite@tasdigital.example',
    fullName: 'Marguerite Alaoui',
    slackUserId: 'U01MALAOUI',
    lastActiveAt: at('2026-09-17T08:41:00.000Z'),
  },
  {
    ...teamBase(USER_RHIANNON_ID, '2026-01-13T10:50:00.000Z', '2026-09-08T12:15:00.000Z'),
    clerkUserId: 'user_seed_designer',
    email: 'rhiannon@tasdigital.example',
    fullName: 'Rhiannon Okafor',
    slackUserId: 'U05ROKAFOR',
    lastActiveAt: at('2026-09-15T11:05:00.000Z'),
  },
];

/**
 * Who is an admin and who is a member, one row per person (PRD §11: Admin sees everything, everyone
 * else sees the brands they are assigned). Marguerite is the only admin, which is why she is the
 * only person with no `brand_assignments` row below — an admin is agency-wide, so the Team page
 * reads her empty brand list as "All brands" rather than as "none".
 */
export const demoMemberships: { userId: string; role: AgencyRole }[] = [
  { userId: USER_MARGUERITE_ID, role: 'admin' },
  { userId: USER_DORIAN_ID, role: 'member' },
  { userId: USER_IMOGEN_ID, role: 'member' },
  { userId: USER_RHIANNON_ID, role: 'member' },
  { userId: USER_CALLUM_ID, role: 'member' },
];

/**
 * The tenancy edge the Team page reads: who holds which role on which brand.
 *
 * Callum is the client-facing half of the agency and is CSM on all four brands; he also buys media
 * on the two accounts big enough to need it, which is the second hat that puts two chips in his row.
 * Dorian, Imogen and Rhiannon each carry one role across the three brands they work on, and every
 * one of them is on Niagara Sleep Solutions — the brand the rest of the demo content belongs to —
 * so the names on the briefs are names the Team page can explain.
 */
export const demoBrandAssignments: { userId: string; brandId: string; role: BrandRole }[] = [
  { userId: USER_CALLUM_ID, brandId: DEMO_BRAND_ID, role: 'csm' },
  { userId: USER_CALLUM_ID, brandId: BRAND_MATTRESS_CENTRAL_ID, role: 'csm' },
  { userId: USER_CALLUM_ID, brandId: BRAND_GRATSI_ID, role: 'csm' },
  { userId: USER_CALLUM_ID, brandId: BRAND_FUNKY_PAINTING_ID, role: 'csm' },
  { userId: USER_CALLUM_ID, brandId: BRAND_MATTRESS_CENTRAL_ID, role: 'media_buyer' },
  { userId: USER_CALLUM_ID, brandId: BRAND_GRATSI_ID, role: 'media_buyer' },
  { userId: USER_DORIAN_ID, brandId: DEMO_BRAND_ID, role: 'strategist' },
  { userId: USER_DORIAN_ID, brandId: BRAND_MATTRESS_CENTRAL_ID, role: 'strategist' },
  { userId: USER_DORIAN_ID, brandId: BRAND_GRATSI_ID, role: 'strategist' },
  { userId: USER_IMOGEN_ID, brandId: DEMO_BRAND_ID, role: 'video_editor' },
  { userId: USER_IMOGEN_ID, brandId: BRAND_GRATSI_ID, role: 'video_editor' },
  { userId: USER_IMOGEN_ID, brandId: BRAND_FUNKY_PAINTING_ID, role: 'video_editor' },
  { userId: USER_RHIANNON_ID, brandId: DEMO_BRAND_ID, role: 'designer' },
  { userId: USER_RHIANNON_ID, brandId: BRAND_MATTRESS_CENTRAL_ID, role: 'designer' },
];

/** `brandId -> brand name`, so the derivation below reads names without repeating them. */
const brandNameById = new Map(demoBrands.map((brand) => [brand.id, brand.name]));

/**
 * The Team page's five rows, DERIVED from the three fixture tables above rather than written out a
 * fourth time (the arrangement `demoPartnershipCreators` uses). The derivation applies the same
 * three rules `listTeam` applies in SQL and TypeScript — an admin shows the agency role and nothing
 * else, brand roles come out in `brandRoles` vocabulary order, brand names come out alphabetical and
 * de-duplicated — and the PGlite test asserts `listTeam` on a seeded database returns exactly this
 * array, so the two can never drift apart unnoticed.
 *
 * Ordered by full name, the order `listTeam` returns: Callum, Dorian, Imogen, Marguerite, Rhiannon.
 */
export const demoTeam: TeamListRow[] = [...demoUsers]
  .sort((a, b) => (a.fullName < b.fullName ? -1 : a.fullName > b.fullName ? 1 : 0))
  .map((user) => {
    const agencyRole =
      demoMemberships.find((membership) => membership.userId === user.id)?.role ?? 'member';
    const held = demoBrandAssignments.filter((assignment) => assignment.userId === user.id);
    const brandRolesHeld = brandRoles.filter((role) =>
      held.some((assignment) => assignment.role === role),
    );
    const roles: TeamRole[] =
      agencyRole === 'admin'
        ? ['admin']
        : brandRolesHeld.length > 0
          ? [...brandRolesHeld]
          : [agencyRole];
    const brandNames = [
      ...new Set(held.map((assignment) => brandNameById.get(assignment.brandId) ?? '')),
    ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return { ...user, role: roles[0] ?? agencyRole, roles, brandNames };
  });

/** The one row that carries two roles: the assertion a test makes without re-typing his name. */
export const DEMO_TEAM_DUAL_ROLE_NAME = 'Callum Ashworth';

/**
 * The interface configuration the demo brand was onboarded with, and the day a CSM last went
 * through it with the client. Two fixed timestamps rather than one, so the fixtures show what every
 * real configuration looks like: written once at onboarding, revisited when the client asks for a
 * field to go away.
 */
const INTERFACE_CONFIGURED_AT = '2026-08-18T09:15:00.000Z';
const INTERFACE_REVIEWED_AT = '2026-09-11T15:40:00.000Z';

const INTERFACE_PAGE_CONCEPTS_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001';
const INTERFACE_PAGE_CREATIVES_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-000000000002';
const INTERFACE_PAGE_COPYWRITING_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-000000000003';
const INTERFACE_PAGE_UGC_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-000000000004';
const INTERFACE_PAGE_PARTNERSHIP_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-000000000005';

/** One field of a configured page, before `interfacePage` gives it its brand, page and position. */
type InterfaceFieldSeed = {
  id: string;
  fieldName: string;
  label: string;
  /** PRD §10's second column: may the CLIENT change this value, or only read it? */
  clientEditable: boolean;
};

/**
 * Builds one page row with its fields, taking each field's `position` from its index in the list —
 * so the order these fixtures are WRITTEN in is the order PRD §10 lists them in and the order the
 * client's interface renders them in, and no position can be typed wrong or repeated.
 */
function interfacePage(
  id: string,
  pageKey: InterfacePageKey,
  label: string,
  position: number,
  fields: InterfaceFieldSeed[],
): InterfacePageRow {
  return {
    ...base(id, INTERFACE_CONFIGURED_AT, INTERFACE_REVIEWED_AT),
    brandId: DEMO_BRAND_ID,
    pageKey,
    label,
    enabled: true,
    position,
    fields: fields.map((field, index) => ({
      ...base(field.id, INTERFACE_CONFIGURED_AT, INTERFACE_REVIEWED_AT),
      brandId: DEMO_BRAND_ID,
      pageId: id,
      fieldName: field.fieldName,
      label: field.label,
      visible: true,
      clientEditable: field.clientEditable,
      position: index,
    })),
  };
}

/**
 * The demo brand's client interface (PRD §10): the five pages in the PRD's order, all switched on,
 * each with the fields that brand's client actually sees.
 *
 * THE DEFAULTS ARE THE DOMAIN'S. `defaultInterfaceConfig()` in `packages/domain/src/interface/` is
 * the canonical §10 default — the five page keys and labels, and the twelve concept-card fields in
 * their PRD order. These fixtures are that configuration written as ROWS (ids, brand, timestamps and
 * positions included), not a second opinion about what the defaults are, for the reason
 * `conceptName` above gives at length: `@tas/db` does not depend on `@tas/domain`, the edge runs the
 * other way everywhere in this repo, and `apps/web` — which depends on both — is where the two are
 * asserted equal. A field key here is the storage vocabulary (`hook_examples`), snake_case like
 * every other stored vocabulary in this schema; the label beside it is what the client reads.
 *
 * WHAT IS EDITABLE, AND WHY THE CONCEPT CARD IS NOT. §10's table grants the client exactly four
 * sets of edits: Client Status and comments on Creatives, Status and Client's Comment on
 * Copywriting, Status, Note and Tracking Number on UGC Management, and nothing at all on
 * Partnership Ads Tracking, which is view, group and filter only. The twelve default concept-card
 * fields are the CONTENT of a concept — batch, angle, theme, the hypothesis, the hooks — none of
 * which §10 lets a client rewrite (the two things they may change on that page, Approval Status and
 * Client's Comments, are the approval track, not card fields), so every one of them is
 * `clientEditable: false`. That split is the whole point of the flag: a client reads twelve fields
 * on the concept card and may type into exactly seven fields across the other four pages.
 */
export const demoInterfaceConfig: InterfacePageRow[] = [
  interfacePage(INTERFACE_PAGE_CONCEPTS_ID, 'concepts', 'Concepts', 0, [
    {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000101',
      fieldName: 'batch',
      label: 'Batch',
      clientEditable: false,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000102',
      fieldName: 'category',
      label: 'Category',
      clientEditable: false,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000103',
      fieldName: 'concept_name',
      label: 'Concept name',
      clientEditable: false,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000104',
      fieldName: 'concept_style',
      label: 'Concept Style',
      clientEditable: false,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000105',
      fieldName: 'angle',
      label: 'Angle',
      clientEditable: false,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000106',
      fieldName: 'theme',
      label: 'Theme',
      clientEditable: false,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000107',
      fieldName: 'product',
      label: 'Product',
      clientEditable: false,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000108',
      fieldName: 'description',
      label: 'Description (hypothesis)',
      clientEditable: false,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000109',
      fieldName: 'pain_points',
      label: 'Pain Points',
      clientEditable: false,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000110',
      fieldName: 'usp',
      label: 'USP',
      clientEditable: false,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000111',
      fieldName: 'persona',
      label: 'Persona',
      clientEditable: false,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000112',
      fieldName: 'hook_examples',
      label: 'Hook examples',
      clientEditable: false,
    },
  ]),
  interfacePage(INTERFACE_PAGE_CREATIVES_ID, 'creatives', 'Creatives', 1, [
    {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000201',
      fieldName: 'client_status',
      label: 'Client Status',
      clientEditable: true,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000202',
      fieldName: 'client_comments',
      label: 'Comments & annotations',
      clientEditable: true,
    },
  ]),
  interfacePage(INTERFACE_PAGE_COPYWRITING_ID, 'copywriting', 'Copywriting', 2, [
    {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000301',
      fieldName: 'client_status',
      label: 'Status',
      clientEditable: true,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000302',
      fieldName: 'client_comment',
      label: "Client's Comment",
      clientEditable: true,
    },
  ]),
  interfacePage(INTERFACE_PAGE_UGC_ID, 'ugc', 'UGC Management', 3, [
    {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000401',
      fieldName: 'client_status',
      label: 'Status',
      clientEditable: true,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000402',
      fieldName: 'client_note',
      label: "Client's Note",
      clientEditable: true,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000403',
      fieldName: 'tracking_number',
      label: 'Tracking Number',
      clientEditable: true,
    },
  ]),
  // View, group and filter only (§10): the client reads this table and changes nothing on it, so
  // every field is `clientEditable: false`. The four listed are the columns `listPartnershipCreators`
  // returns that carry no internal figure — never the partnership price or the creator cost, which
  // CLAUDE.md non-negotiable 10 keeps out of the client interface entirely.
  interfacePage(INTERFACE_PAGE_PARTNERSHIP_ID, 'partnership', 'Partnership Ads Tracking', 4, [
    {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000501',
      fieldName: 'creator_name',
      label: 'Creator',
      clientEditable: false,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000502',
      fieldName: 'instagram_username',
      label: 'Instagram Username',
      clientEditable: false,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000503',
      fieldName: 'partnership_activity',
      label: 'Activity',
      clientEditable: false,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-000000000504',
      fieldName: 'partnership_expires_on',
      label: 'Expires On',
      clientEditable: false,
    },
  ]),
];

/**
 * Niagara Sleep Solutions' notification routing (PRD §12), written the morning the brand was
 * onboarded and last read through with Callum when the client interface was reviewed — the same two
 * days the interface configuration above carries, because in a real agency those two conversations
 * are one conversation.
 *
 * ALL EIGHT TRIGGERS, SLACK ON, EMAIL OFF. §12 is unambiguous about the default: the DM through the
 * existing TAS Bot app is the channel ("today automations post into Slack channels and it's noise
 * nobody reads"), and email is the extra a person opts into. So a freshly onboarded brand is
 * reachable on Slack for every one of §12's eight triggers and emails nobody until someone asks.
 *
 * Built from `notificationTriggers` rather than retyped, so the fixtures are in §12's order by
 * construction and a trigger can neither be missed nor positioned wrong. Each id is hardcoded and
 * keyed by trigger: a ninth trigger fails the build here until it has one, and no id changes between
 * processes — `seed(db)` inserts exactly these rows, ids included, so a seeded database and
 * `demoNotifications` are row-for-row identical.
 */
const NOTIFICATIONS_ROUTED_AT = '2026-08-18T09:15:00.000Z';
const NOTIFICATIONS_REVIEWED_AT = '2026-09-11T15:40:00.000Z';

const NOTIFICATION_SETTING_IDS: Readonly<Record<NotificationTriggerKey, string>> = {
  brief_assigned: 'dddddddd-dddd-4ddd-8ddd-000000000001',
  internal_revisions_requested: 'dddddddd-dddd-4ddd-8ddd-000000000002',
  ad_submitted: 'dddddddd-dddd-4ddd-8ddd-000000000003',
  client_approved: 'dddddddd-dddd-4ddd-8ddd-000000000004',
  client_requested_revisions: 'dddddddd-dddd-4ddd-8ddd-000000000005',
  creative_ready_to_launch: 'dddddddd-dddd-4ddd-8ddd-000000000006',
  creator_status_changed: 'dddddddd-dddd-4ddd-8ddd-000000000007',
  partnership_expiring: 'dddddddd-dddd-4ddd-8ddd-000000000008',
};

export const demoNotifications: NotificationSettingRow[] = notificationTriggers.map(
  (trigger, index) => ({
    ...base(
      NOTIFICATION_SETTING_IDS[trigger.key],
      NOTIFICATIONS_ROUTED_AT,
      NOTIFICATIONS_REVIEWED_AT,
    ),
    brandId: DEMO_BRAND_ID,
    triggerKey: trigger.key,
    slackEnabled: true,
    emailEnabled: false,
    position: index,
    label: trigger.label,
    recipients: trigger.recipients,
    recipientLabel: trigger.recipientLabel,
  }),
);

/**
 * The promotion requests waiting on an agency admin (PRD §5, §14.1; CLAUDE.md non-negotiable 2:
 * "child changes can *request* promotion to the parent... Nothing auto-promotes").
 *
 * THREE PENDING REQUESTS, RAISED BY THREE DIFFERENT BRANDS, AGAINST THREE DIFFERENT TABLES. That
 * spread is the point of the page: the admin dashboard is the one screen that reads ACROSS brands,
 * and three requests all from one brand against one table would show a queue that proves nothing.
 * Mattress Central wants a persona's pain points sharpened, Gratsi wants a theme's reference links
 * repointed, and Funky Painting wants a format the template's angle list does not offer.
 *
 * The rows they came from are real where a real row exists: Gratsi's request names
 * `THEME_PROBLEM_SOLUTION_ID`, an actual row of the global theme library, so an admin could open it.
 * Funky Painting's `rowId` is NULL on purpose and is the case the column is nullable for — the
 * request is about the SHAPE of the template's format list, not about one angle's value, so there is
 * no row to point at.
 *
 * Every id is a hardcoded uuid and every timestamp is fixed, like every other fixture here, and
 * `seed(db)` inserts exactly these rows, ids included, so a seeded database and the fixtures are
 * row-for-row identical. `brandName` is derived from `demoBrands` rather than retyped, so a brand
 * renamed above cannot leave a stale name on a request.
 */
const PROMOTION_PERSONA_PAIN_POINTS_ID = 'eeeeeeee-eeee-4eee-8eee-000000000001';
const PROMOTION_THEME_REFERENCE_LINKS_ID = 'eeeeeeee-eeee-4eee-8eee-000000000002';
const PROMOTION_ANGLE_FORMATS_ID = 'eeeeeeee-eeee-4eee-8eee-000000000003';
const PROMOTION_BRIEF_ELEMENTS_TESTED_ID = 'eeeeeeee-eeee-4eee-8eee-000000000004';
const PROMOTION_COPY_CTA_ID = 'eeeeeeee-eeee-4eee-8eee-000000000005';

/** The origin rows the requests point at, in the child brands that raised them. */
const PROMOTION_ROW_MATTRESS_PERSONA_ID = 'eeeeeeee-eeee-4eee-8eee-0000000000a1';
const PROMOTION_ROW_NIAGARA_BRIEF_ID = 'eeeeeeee-eeee-4eee-8eee-0000000000a2';
const PROMOTION_ROW_MATTRESS_COPY_ID = 'eeeeeeee-eeee-4eee-8eee-0000000000a3';

/** The shared columns a promotion request carries: raised by its requester, last touched by them. */
function requestBase(id: string, requester: string, created: string, updated: string) {
  return {
    ...base(id, created, updated),
    createdBy: requester,
    updatedBy: requester,
  };
}

/** The brand's name as `demoBrands` spells it, so a rename above cannot strand a stale name here. */
function brandNamed(brandId: string): string | null {
  return brandNameById.get(brandId) ?? null;
}

export const demoPromotionRequests: PromotionRequestRow[] = [
  {
    ...requestBase(
      PROMOTION_ANGLE_FORMATS_ID,
      'user_seed_designer',
      '2026-09-17T08:10:00.000Z',
      '2026-09-17T08:10:00.000Z',
    ),
    brandId: BRAND_FUNKY_PAINTING_ID,
    brandName: brandNamed(BRAND_FUNKY_PAINTING_ID),
    tableName: 'angles',
    rowId: null,
    fieldName: 'formats',
    currentValue: 'Static, Video, Carousel',
    proposedValue: 'Static, Video, Carousel, Motion Graphic',
    requestedBy: 'Rhiannon Okafor',
    requestedAt: at('2026-09-17T08:10:00.000Z'),
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
  },
  {
    ...requestBase(
      PROMOTION_THEME_REFERENCE_LINKS_ID,
      'user_seed_video_editor',
      '2026-09-16T09:05:00.000Z',
      '2026-09-16T09:05:00.000Z',
    ),
    brandId: BRAND_GRATSI_ID,
    brandName: brandNamed(BRAND_GRATSI_ID),
    tableName: 'themes',
    rowId: THEME_PROBLEM_SOLUTION_ID,
    fieldName: 'reference_links',
    currentValue: 'https://drive.tasdigital.example/themes/problem-solution-2024',
    proposedValue:
      'https://drive.tasdigital.example/themes/problem-solution-2026, https://vimeo.example/tas/gratsi-pour-and-explain',
    requestedBy: 'Imogen Bardsley',
    requestedAt: at('2026-09-16T09:05:00.000Z'),
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
  },
  {
    ...requestBase(
      PROMOTION_PERSONA_PAIN_POINTS_ID,
      DEMO_ACTOR_ID,
      '2026-09-15T14:20:00.000Z',
      '2026-09-15T14:20:00.000Z',
    ),
    brandId: BRAND_MATTRESS_CENTRAL_ID,
    brandName: brandNamed(BRAND_MATTRESS_CENTRAL_ID),
    tableName: 'personas',
    rowId: PROMOTION_ROW_MATTRESS_PERSONA_ID,
    fieldName: 'pain_points',
    currentValue: 'Sleeps hot and wakes around 3am, then blames the mattress before the bedroom.',
    proposedValue:
      'Sleeps hot and wakes around 3am. Has already bought a cooling topper and a fan, so “cooling” on its own no longer reads as a promise — it reads as a thing that failed.',
    requestedBy: 'Dorian Vance',
    requestedAt: at('2026-09-15T14:20:00.000Z'),
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
  },
];

/**
 * The two requests an admin has already settled, kept beside the pending three so the page's status
 * filter has something to show on each of its other two keys, and so filtering to a state with
 * nothing in it is reachable in demo mode rather than only in an empty database.
 *
 * They are a SEPARATE array, not three more entries above, because `/app/propagation` renders the
 * pending queue and nothing else: `demoPromotionRequests` is exactly what that table shows, three
 * rows, and a reviewed request can never leak into it by being appended to the wrong list.
 * `seed(db)` inserts both arrays, so the database holds all five and `listPromotionRequests` can be
 * asked for any of the three states.
 *
 * Marguerite Alaoui reviewed both, because she is the agency's only admin (`demoMemberships`), and
 * each note says what an admin's note is actually for: whether the change belongs to every brand or
 * only to the one that asked.
 */
export const demoReviewedPromotionRequests: PromotionRequestRow[] = [
  {
    ...requestBase(
      PROMOTION_COPY_CTA_ID,
      'user_seed_csm',
      '2026-09-08T16:45:00.000Z',
      '2026-09-09T10:30:00.000Z',
    ),
    brandId: BRAND_MATTRESS_CENTRAL_ID,
    brandName: brandNamed(BRAND_MATTRESS_CENTRAL_ID),
    tableName: 'copywriting',
    rowId: PROMOTION_ROW_MATTRESS_COPY_ID,
    fieldName: 'cta',
    currentValue: 'Shop Now',
    proposedValue: 'Claim My Offer',
    requestedBy: 'Callum Ashworth',
    requestedAt: at('2026-09-08T16:45:00.000Z'),
    status: 'rejected',
    reviewedBy: 'Marguerite Alaoui',
    reviewedAt: at('2026-09-09T10:30:00.000Z'),
    reviewNote:
      '“Claim My Offer” is a Mattress Central promise tied to their sale calendar, not a default every brand should inherit. Keep it as a local override.',
  },
  {
    ...requestBase(
      PROMOTION_BRIEF_ELEMENTS_TESTED_ID,
      DEMO_ACTOR_ID,
      '2026-09-04T11:35:00.000Z',
      '2026-09-05T09:12:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    brandName: brandNamed(DEMO_BRAND_ID),
    tableName: 'creative_briefs',
    rowId: PROMOTION_ROW_NIAGARA_BRIEF_ID,
    fieldName: 'elements_tested',
    currentValue: 'Hook, thumbnail',
    proposedValue: 'Hook, thumbnail, first-frame caption, CTA card',
    requestedBy: 'Dorian Vance',
    requestedAt: at('2026-09-04T11:35:00.000Z'),
    status: 'approved',
    reviewedBy: 'Marguerite Alaoui',
    reviewedAt: at('2026-09-05T09:12:00.000Z'),
    reviewNote:
      'Every brand already reports on these four in the monthly review, so the template should ask for them. Promoted.',
  },
];

export const demoAssets: AssetListRow[] = [
  {
    ...contentBase(ASSET_REF_VIDEO_ID, '2026-09-01T09:00:00.000Z', '2026-09-01T09:00:00.000Z'),
    brandId: DEMO_BRAND_ID,
    filename: 'competitor-sleep-ad.mp4',
    contentType: 'video/mp4',
    sizeBytes: 12_400_000,
    r2Key: `${DEMO_BRAND_ID}/reference/competitor-sleep-ad.mp4`,
    url: '/demo/assets/competitor-sleep-ad.mp4',
    category: 'reference',
    conceptId: CONCEPT_BODY_CLOCK_ID,
    caption: 'Competitor ad — body clock angle on Meta',
  },
  {
    ...contentBase(ASSET_BROLL_ID, '2026-09-02T14:30:00.000Z', '2026-09-02T14:30:00.000Z'),
    brandId: DEMO_BRAND_ID,
    filename: 'blanket-texture-closeup.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 2_100_000,
    r2Key: `${DEMO_BRAND_ID}/broll/blanket-texture-closeup.jpg`,
    url: '/demo/assets/blanket-texture-closeup.jpg',
    category: 'broll',
    conceptId: null,
    caption: 'Reusable B-roll — product texture close-up',
  },
  {
    ...contentBase(ASSET_RAW_ID, '2026-09-03T11:00:00.000Z', '2026-09-03T11:00:00.000Z'),
    brandId: DEMO_BRAND_ID,
    filename: 'danielle-take-3.mov',
    contentType: 'video/quicktime',
    sizeBytes: 48_700_000,
    r2Key: `${DEMO_BRAND_ID}/raw/danielle-take-3.mov`,
    url: '/demo/assets/danielle-take-3.mov',
    category: 'raw_asset',
    conceptId: CONCEPT_NOT_YOUR_AGE_ID,
    caption: null,
  },
  {
    ...contentBase(ASSET_MOOD_ID, '2026-09-04T08:15:00.000Z', '2026-09-04T08:15:00.000Z'),
    brandId: DEMO_BRAND_ID,
    filename: 'daylight-mood-ref.png',
    contentType: 'image/png',
    sizeBytes: 890_000,
    r2Key: `${DEMO_BRAND_ID}/mood/daylight-mood-ref.png`,
    url: '/demo/assets/daylight-mood-ref.png',
    category: 'mood_board',
    conceptId: CONCEPT_DAYLIGHT_ID,
    caption: 'Mood board — morning light colour palette',
  },
];

export const demoAdMetrics: AdMetricListRow[] = [
  {
    ...contentBase(METRIC_BODY_CLOCK_ID, '2026-09-10T08:00:00.000Z', '2026-09-15T08:00:00.000Z'),
    brandId: DEMO_BRAND_ID,
    briefId: BRIEF_BODY_CLOCK_VIDEO_ID,
    conceptId: CONCEPT_BODY_CLOCK_ID,
    metaAdId: '23851234567890',
    adName: 'VV01-B1-BodyClock-v1',
    spend: '1245.50',
    impressions: 89_200,
    clicks: 3_120,
    conversions: 156,
    ctr: '0.0350',
    cpc: '0.40',
    cpa: '7.98',
    roas: '4.20',
    dateRange: '2026-09-01 to 2026-09-14',
  },
  {
    ...contentBase(METRIC_NOT_YOUR_AGE_ID, '2026-09-10T08:00:00.000Z', '2026-09-15T08:00:00.000Z'),
    brandId: DEMO_BRAND_ID,
    briefId: BRIEF_NOT_YOUR_AGE_STATIC_ID,
    conceptId: CONCEPT_NOT_YOUR_AGE_ID,
    metaAdId: '23851234567891',
    adName: 'SI01-B1-NotYourAge-v1',
    spend: '820.00',
    impressions: 62_500,
    clicks: 1_875,
    conversions: 62,
    ctr: '0.0300',
    cpc: '0.44',
    cpa: '13.23',
    roas: '2.80',
    dateRange: '2026-09-01 to 2026-09-14',
  },
  {
    ...contentBase(METRIC_DAYLIGHT_ID, '2026-09-10T08:00:00.000Z', '2026-09-15T08:00:00.000Z'),
    brandId: DEMO_BRAND_ID,
    briefId: BRIEF_DAYLIGHT_MOTION_ID,
    conceptId: CONCEPT_DAYLIGHT_ID,
    metaAdId: '23851234567892',
    adName: 'MG01-B1-Daylight-v1',
    spend: '540.25',
    impressions: 41_000,
    clicks: 1_640,
    conversions: 41,
    ctr: '0.0400',
    cpc: '0.33',
    cpa: '13.18',
    roas: '3.10',
    dateRange: '2026-09-01 to 2026-09-14',
  },
  {
    ...contentBase(
      METRIC_NINETY_MINUTES_ID,
      '2026-09-10T08:00:00.000Z',
      '2026-09-15T08:00:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    briefId: BRIEF_NINETY_MINUTES_VIDEO_ID,
    conceptId: CONCEPT_NINETY_MINUTES_ID,
    metaAdId: '23851234567893',
    adName: 'VV02-B1-90Minutes-v1',
    spend: '1890.00',
    impressions: 124_000,
    clicks: 4_960,
    conversions: 248,
    ctr: '0.0400',
    cpc: '0.38',
    cpa: '7.62',
    roas: '5.50',
    dateRange: '2026-09-01 to 2026-09-14',
  },
];

export const demoCompetitorAds: CompetitorAdListRow[] = [
  {
    ...contentBase(COMP_AD_CASPER_ID, '2026-09-08T10:00:00.000Z', '2026-09-14T10:00:00.000Z'),
    brandId: DEMO_BRAND_ID,
    platform: 'meta',
    advertiserName: 'Casper Sleep',
    adUrl: 'https://facebook.com/ads/library/?id=100001',
    headline: 'The mattress designed for better sleep',
    bodyText: 'Try Casper risk-free for 100 nights.',
    format: 'video',
    estimatedSpend: '$50k-100k',
    daysActive: 42,
    firstSeen: '2026-08-01',
    lastSeen: '2026-09-14',
    notes: 'Heavy spend on cooling angle',
  },
  {
    ...contentBase(COMP_AD_PURPLE_ID, '2026-09-09T11:00:00.000Z', '2026-09-14T11:00:00.000Z'),
    brandId: DEMO_BRAND_ID,
    platform: 'meta',
    advertiserName: 'Purple Mattress',
    adUrl: 'https://facebook.com/ads/library/?id=100002',
    headline: 'Sleep cool all night',
    bodyText: null,
    format: 'carousel',
    estimatedSpend: '$25k-50k',
    daysActive: 28,
    firstSeen: '2026-08-15',
    lastSeen: '2026-09-12',
    notes: null,
  },
  {
    ...contentBase(COMP_AD_HELIX_ID, '2026-09-10T09:00:00.000Z', '2026-09-14T09:00:00.000Z'),
    brandId: DEMO_BRAND_ID,
    platform: 'tiktok',
    advertiserName: 'Helix Sleep',
    adUrl: 'https://library.tiktok.com/ads/detail/?id=200001',
    headline: 'Take the sleep quiz',
    bodyText: 'Find your perfect mattress in 2 minutes.',
    format: 'video',
    estimatedSpend: '$10k-25k',
    daysActive: 14,
    firstSeen: '2026-09-01',
    lastSeen: null,
    notes: 'UGC-style quiz funnel',
  },
];

export const demoCreatorRankings: CreatorRankingListRow[] = [
  {
    ...contentBase(RANKING_DANIELLE_ID, '2026-09-15T08:00:00.000Z', '2026-09-15T08:00:00.000Z'),
    brandId: DEMO_BRAND_ID,
    creatorId: CREATOR_DANIELLE_ID,
    creatorName: 'Danielle Torres',
    totalAds: 8,
    totalSpend: '3200.00',
    totalConversions: 320,
    avgRoas: '5.20',
    avgCpa: '7.50',
    rank: 1,
    periodLabel: 'Sep 2026',
  },
  {
    ...contentBase(RANKING_MARCUS_ID, '2026-09-15T08:00:00.000Z', '2026-09-15T08:00:00.000Z'),
    brandId: DEMO_BRAND_ID,
    creatorId: CREATOR_MARCUS_ID,
    creatorName: 'Marcus Chen',
    totalAds: 5,
    totalSpend: '1800.00',
    totalConversions: 144,
    avgRoas: '3.80',
    avgCpa: '12.50',
    rank: 2,
    periodLabel: 'Sep 2026',
  },
  {
    ...contentBase(RANKING_PRIYA_ID, '2026-09-15T08:00:00.000Z', '2026-09-15T08:00:00.000Z'),
    brandId: DEMO_BRAND_ID,
    creatorId: CREATOR_PRIYA_ID,
    creatorName: 'Priya Sharma',
    totalAds: 3,
    totalSpend: '950.00',
    totalConversions: 76,
    avgRoas: '3.20',
    avgCpa: '12.50',
    rank: 3,
    periodLabel: 'Sep 2026',
  },
];

export const demoUploadLinks: UploadLinkListRow[] = [
  {
    ...contentBase(UPLOAD_LINK_AGENCY_ID, '2026-09-10T10:00:00.000Z', '2026-09-14T10:00:00.000Z'),
    brandId: DEMO_BRAND_ID,
    token: 'tok_agency_niagara_sept',
    label: 'September Agency Deliverables',
    recipientName: 'Sleep Creative Agency',
    recipientEmail: 'uploads@sleepcreative.example',
    maxUploads: '50',
    expiresAt: at('2026-10-01T00:00:00.000Z'),
    isActive: true,
    uploadsUsed: '12',
    notes: 'Monthly asset delivery from creative agency',
  },
  {
    ...contentBase(UPLOAD_LINK_CREATOR_ID, '2026-09-12T14:00:00.000Z', '2026-09-15T09:00:00.000Z'),
    brandId: DEMO_BRAND_ID,
    token: 'tok_creator_danielle_sept',
    label: 'Danielle — Body Clock Takes',
    recipientName: 'Danielle Torres',
    recipientEmail: 'danielle@creator.example',
    maxUploads: '10',
    expiresAt: at('2026-09-30T00:00:00.000Z'),
    isActive: true,
    uploadsUsed: '3',
    notes: null,
  },
];

export const demoOnboardingForms: OnboardingFormListRow[] = [
  {
    ...base(ONBOARD_FORM_INTAKE_ID, '2026-09-05T10:00:00.000Z', '2026-09-10T10:00:00.000Z'),
    brandId: DEMO_BRAND_ID,
    title: 'Client Intake Questionnaire',
    description:
      'Collects brand guidelines, target audience, and creative preferences for new clients.',
    status: 'published',
    fieldsJson: JSON.stringify([
      { key: 'brand_name', label: 'Brand Name', type: 'text', required: true },
      { key: 'website', label: 'Website URL', type: 'url', required: true },
      { key: 'target_audience', label: 'Target Audience', type: 'textarea', required: true },
      {
        key: 'brand_guidelines',
        label: 'Brand Guidelines (upload)',
        type: 'file',
        required: false,
      },
    ]),
    submissionsCount: '4',
    shareToken: 'form_intake_niagara',
  },
  {
    ...base(ONBOARD_FORM_BRIEF_ID, '2026-09-08T15:00:00.000Z', '2026-09-12T11:00:00.000Z'),
    brandId: DEMO_BRAND_ID,
    title: 'Creative Brief Request',
    description: 'Clients submit creative brief requests directly.',
    status: 'draft',
    fieldsJson: JSON.stringify([
      { key: 'concept_type', label: 'Concept Type', type: 'select', required: true },
      { key: 'deadline', label: 'Requested Deadline', type: 'date', required: true },
      { key: 'notes', label: 'Additional Notes', type: 'textarea', required: false },
    ]),
    submissionsCount: '0',
    shareToken: 'form_brief_niagara',
  },
];
