import type { AngleListRow } from './angles';
import type { BriefListRow } from './briefs';
import type { ConceptListRow } from './concepts';
import type { CopyListRow } from './copy';
import type { PersonaListRow } from './personas';
import type { ProductListRow } from './products';
import type { CreativeFunnel, CreativeType } from './schema';
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
const COPY_BODY_CLOCK_ID = '88888888-8888-4888-8888-000000000001';
const COPY_NOT_YOUR_AGE_ID = '88888888-8888-4888-8888-000000000002';
const COPY_DAYLIGHT_ID = '88888888-8888-4888-8888-000000000003';
const COPY_BUNDLE_UNATTACHED_ID = '88888888-8888-4888-8888-000000000004';

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
    ...base(PRODUCT_BLANKET_ID, '2026-08-02T09:00:00.000Z', '2026-09-11T14:10:00.000Z'),
    brandId: DEMO_BRAND_ID,
    name: 'Niagara Deep Sleep Weighted Blanket',
    link: 'https://niagarasleep.example/products/deep-sleep-weighted-blanket',
    collectionLink: 'https://niagarasleep.example/collections/sleep-essentials',
    conceptCount: 2,
  },
  {
    ...base(PRODUCT_MASK_ID, '2026-08-02T09:05:00.000Z', '2026-09-09T11:30:00.000Z'),
    brandId: DEMO_BRAND_ID,
    name: 'Niagara Cooling Blackout Sleep Mask',
    link: 'https://niagarasleep.example/products/cooling-blackout-sleep-mask',
    collectionLink: null,
    conceptCount: 2,
  },
  {
    ...base(PRODUCT_RESET_BUNDLE_ID, '2026-08-12T15:45:00.000Z', '2026-09-05T13:20:00.000Z'),
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
  ...base(THEME_PROBLEM_SOLUTION_ID, '2026-07-20T10:00:00.000Z', '2026-08-28T10:00:00.000Z'),
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
    ...base(THEME_YAPPER_ID, '2026-08-04T09:30:00.000Z', '2026-09-12T13:25:00.000Z'),
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
  },
  {
    ...base(THEME_HOLIDAY_GIFTING_ID, '2026-08-09T11:15:00.000Z', '2026-09-07T10:50:00.000Z'),
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
  },
  {
    ...base(THEME_POV_ID, '2026-07-28T14:20:00.000Z', '2026-09-02T09:05:00.000Z'),
    brandId: null,
    name: 'POV: X vs Y',
    category: 'Framework',
    referenceLinks: ['https://foreplay.example/boards/pov-x-vs-y-comparison'],
    notes:
      'Split the frame and let the viewer pick a side: the night before versus the night after, the thing they own versus the thing we sell. It earns the comparison the ad would otherwise have to claim, and it gives the editor a structure that reads with the sound off. Keep the losing side a situation and never a competitor by name — legal made Funky Painting re-cut a whole batch over a visible rival can.',
    usedByBrandCount: 1,
  },
  {
    ...base(THEME_GREEN_SCREEN_ID, '2026-07-20T10:05:00.000Z', '2026-08-30T16:40:00.000Z'),
    brandId: null,
    name: 'Green Screen',
    category: 'Production Style',
    referenceLinks: ['https://foreplay.example/boards/green-screen-reaction'],
    notes:
      'Creator reacts over a screenshot of a review, a Reddit thread or a sleep-tracker graph. Cheap to produce, high hook rate, and the on-screen artefact carries the proof so the script can stay short.',
    usedByBrandCount: 1,
  },
  problemSolutionTheme,
  {
    ...base(THEME_SPRING_SOCCER_ID, '2026-08-11T16:00:00.000Z', '2026-08-19T15:35:00.000Z'),
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
  },
];

/**
 * Three researched personas (PRD §5.4, all fourteen fields). `productName` is the joined product
 * name `listPersonas` returns, so the fixtures satisfy `PersonaListRow[]` and the Personas page
 * reads demo rows and database rows through one type.
 */
export const demoPersonas: PersonaListRow[] = [
  {
    ...base(PERSONA_SHIFT_ID, '2026-08-05T08:30:00.000Z', '2026-09-12T10:20:00.000Z'),
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
    ...base(PERSONA_PARENT_ID, '2026-08-06T09:15:00.000Z', '2026-09-10T16:05:00.000Z'),
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
    ...base(PERSONA_PERI_ID, '2026-08-07T11:00:00.000Z', '2026-09-08T08:45:00.000Z'),
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
  ...base(ANGLE_BODY_CLOCK_ID, '2026-08-14T13:00:00.000Z', '2026-09-11T09:40:00.000Z'),
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
    ...base(ANGLE_NOT_YOUR_AGE_ID, '2026-08-18T09:20:00.000Z', '2026-09-13T11:15:00.000Z'),
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
  },
  bodyClockAngle,
  {
    ...base(ANGLE_DAYLIGHT_ID, '2026-08-21T14:45:00.000Z', '2026-09-10T08:25:00.000Z'),
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
  },
  {
    ...base(ANGLE_NINETY_MINUTES_ID, '2026-08-15T10:30:00.000Z', '2026-09-09T15:20:00.000Z'),
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
  },
  {
    ...base(ANGLE_THERMOSTAT_ID, '2026-08-25T16:10:00.000Z', '2026-09-06T14:05:00.000Z'),
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
    ...base(CONCEPT_NOT_YOUR_AGE_ID, '2026-08-29T09:45:00.000Z', '2026-09-14T11:20:00.000Z'),
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
  },
  {
    ...base(CONCEPT_BODY_CLOCK_ID, '2026-08-20T12:00:00.000Z', '2026-09-11T17:05:00.000Z'),
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
  },
  {
    ...base(CONCEPT_DAYLIGHT_ID, '2026-08-27T15:30:00.000Z', '2026-09-09T08:50:00.000Z'),
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
  },
  {
    ...base(CONCEPT_NINETY_MINUTES_ID, '2026-09-01T10:15:00.000Z', '2026-09-04T16:35:00.000Z'),
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
 * Six creative briefs for Niagara Sleep Solutions (PRD §5.10), one record per creative asset.
 *
 * They sit in six DIFFERENT internal statuses, across both tracks of the state machine — the video
 * track's `sent_to_video_editor`, `video_editing_in_progress`, `ad_submitted` and `approved`, and the
 * static track's `static_design_in_progress` and `images_revisions` (`@tas/domain/state` keys).
 * Exactly one is `approved`, so `isClientTrackOpen` is true on exactly one row and the client bar is
 * visibly open there and shut everywhere else (PRD §9, CLAUDE.md non-negotiable 4); that row sits at
 * the first client status, `pending_for_approval`, which is the pairing the client interface gates on.
 *
 * All four types are covered (two Video, one Static, one Carousel, one Motion Image, plus the
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
    ...base(BRIEF_BODY_CLOCK_VIDEO_ID, '2026-08-30T09:20:00.000Z', '2026-09-15T16:40:00.000Z'),
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
    internalStatus: 'approved',
    clientStatus: 'pending_for_approval',
    performance: null,
  },
  {
    ...base(BRIEF_NOT_YOUR_AGE_STATIC_ID, '2026-09-02T11:05:00.000Z', '2026-09-14T09:10:00.000Z'),
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
    internalStatus: 'static_design_in_progress',
    clientStatus: 'pending_for_approval',
    performance: null,
  },
  {
    ...base(BRIEF_DAYLIGHT_MOTION_ID, '2026-08-28T13:40:00.000Z', '2026-09-12T18:25:00.000Z'),
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
    internalStatus: 'ad_submitted',
    clientStatus: 'pending_for_approval',
    performance: null,
  },
  {
    ...base(BRIEF_NINETY_MINUTES_VIDEO_ID, '2026-09-03T08:55:00.000Z', '2026-09-11T10:05:00.000Z'),
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
    designFileUrl: null,
    qaVideoEditor: false,
    qaDesigner: false,
    qaStrategist: false,
    spellingFeedback: null,
    internalStatus: 'video_editing_in_progress',
    clientStatus: 'pending_for_approval',
    performance: null,
  },
  {
    ...base(BRIEF_BUNDLE_STANDALONE_ID, '2026-08-19T15:15:00.000Z', '2026-09-08T15:30:00.000Z'),
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
    qaVideoEditor: false,
    qaDesigner: true,
    qaStrategist: false,
    spellingFeedback: null,
    internalStatus: 'images_revisions',
    clientStatus: 'pending_for_approval',
    performance: 'High Potential to Iterate',
  },
  {
    ...base(
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
    internalStatus: 'sent_to_video_editor',
    clientStatus: 'pending_for_approval',
    performance: null,
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
    ...base(COPY_BODY_CLOCK_ID, '2026-09-01T10:15:00.000Z', '2026-09-16T11:20:00.000Z'),
    brandId: DEMO_BRAND_ID,
    creativeBriefId: BRIEF_BODY_CLOCK_VIDEO_ID,
    copyNumber: 1,
    primaryCopy:
      'Six years of night shifts and he still could not sleep at noon. It is the rota, not you. Weight, not heat. Ninety nights.',
    headline: 'Your Rota Is Broken. You Are Not.',
    linkDescription: '90 nights. Sleep or return.',
    cta: 'Shop Now',
    status: 'approved',
    clientComment: null,
    creativeName: demoBrief(BRIEF_BODY_CLOCK_VIDEO_ID).name,
  },
  {
    ...base(COPY_NOT_YOUR_AGE_ID, '2026-09-04T09:40:00.000Z', '2026-09-15T14:05:00.000Z'),
    brandId: DEMO_BRAND_ID,
    creativeBriefId: BRIEF_NOT_YOUR_AGE_STATIC_ID,
    copyNumber: 2,
    primaryCopy:
      'Her doctor called it her age. Four hundred women in one thread called it 3:47am. Quilted weight that spreads, never traps.',
    headline: 'They Called It Your Age. It Is 3am.',
    linkDescription: 'Read the 3am thread first.',
    cta: 'Learn More',
    status: 'pending_for_client_review',
    clientComment: null,
    creativeName: demoBrief(BRIEF_NOT_YOUR_AGE_STATIC_ID).name,
  },
  {
    ...base(COPY_DAYLIGHT_ID, '2026-09-02T12:25:00.000Z', '2026-09-13T17:30:00.000Z'),
    brandId: DEMO_BRAND_ID,
    creativeBriefId: BRIEF_DAYLIGHT_MOTION_ID,
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
  },
  {
    ...base(COPY_BUNDLE_UNATTACHED_ID, '2026-08-27T16:05:00.000Z', '2026-09-10T08:50:00.000Z'),
    brandId: DEMO_BRAND_ID,
    // Drafted before anyone chose which bundle static it runs on: the PRD §5.11 unattached case.
    creativeBriefId: null,
    copyNumber: 4,
    primaryCopy:
      'You bought the blanket and left the mask behind. The weight handles 3am, the light handles 6am, and the box handles both.',
    headline: 'Save $64 When They Ship Together.',
    linkDescription: 'Both for $174 tonight.',
    cta: 'Shop Now',
    status: 'revisions_needed',
    clientComment: null,
    creativeName: null,
  },
];
