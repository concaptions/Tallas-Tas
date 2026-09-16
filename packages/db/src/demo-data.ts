import type { AngleListRow } from './angles';
import type { PersonaListRow } from './personas';
import type { ProductListRow } from './products';
import type { Concept } from './schema';
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
const CONCEPT_ID = '66666666-6666-4666-8666-000000000001';

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
 * the brand whose angle points at the product (`concepts.angleId` → `angles.productId`). Only the
 * weighted blanket carries a concept so far, so the fixtures show a real count and a real zero.
 */
export const demoProducts: ProductListRow[] = [
  {
    ...base(PRODUCT_BLANKET_ID, '2026-08-02T09:00:00.000Z', '2026-09-11T14:10:00.000Z'),
    brandId: DEMO_BRAND_ID,
    name: 'Niagara Deep Sleep Weighted Blanket',
    link: 'https://niagarasleep.example/products/deep-sleep-weighted-blanket',
    collectionLink: 'https://niagarasleep.example/collections/sleep-essentials',
    conceptCount: 1,
  },
  {
    ...base(PRODUCT_MASK_ID, '2026-08-02T09:05:00.000Z', '2026-09-09T11:30:00.000Z'),
    brandId: DEMO_BRAND_ID,
    name: 'Niagara Cooling Blackout Sleep Mask',
    link: 'https://niagarasleep.example/products/cooling-blackout-sleep-mask',
    collectionLink: null,
    conceptCount: 0,
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
 * reads demo rows and database rows through one type. The seeded database holds one brand and one
 * concept, on Problem/Solution: the counts below are exactly what `listThemes` returns there — a
 * real one and five real zeros, never an invented number.
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
    usedByBrandCount: 0,
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
    usedByBrandCount: 0,
  },
  {
    ...base(THEME_GREEN_SCREEN_ID, '2026-07-20T10:05:00.000Z', '2026-08-30T16:40:00.000Z'),
    brandId: null,
    name: 'Green Screen',
    category: 'Production Style',
    referenceLinks: ['https://foreplay.example/boards/green-screen-reaction'],
    notes:
      'Creator reacts over a screenshot of a review, a Reddit thread or a sleep-tracker graph. Cheap to produce, high hook rate, and the on-screen artefact carries the proof so the script can stay short.',
    usedByBrandCount: 0,
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

/**
 * One concept: the pairing of one angle and one theme (PRD §5.7). `name` is the auto-generated
 * `Batch-Angle-Theme` string, built here from its two inputs and never typed by hand.
 */
const demoConceptBatch = 'B1';

export const demoConcepts: Concept[] = [
  {
    ...base(CONCEPT_ID, '2026-08-20T12:00:00.000Z', '2026-09-11T17:05:00.000Z'),
    brandId: DEMO_BRAND_ID,
    angleId: bodyClockAngle.id,
    themeId: problemSolutionTheme.id,
    batch: demoConceptBatch,
    name: `${demoConceptBatch}-${bodyClockAngle.name}-${problemSolutionTheme.name}`,
    category: 'New',
    conceptStyle: 'Filming',
    hookExamples:
      '"Six years of nights. It is not you that is broken, it is the rota." / "If you can sleep at 9am in a bright room, you are not tired — you are equipped." / "Nurses: stop calling this a sleep problem."',
    scriptIdea:
      'Open on a nurse pulling into the driveway in full morning sun, still in scrubs. Two seconds of the problem: bins, dog, daylight through thin curtains. He says the line about the rota being the abnormal thing. Cut to the blanket going on, one line on breathable weight versus sedation, then the same man asleep with the room still bright. End on him leaving for the 19:00 shift clear-eyed, with the trial window on screen.',
  },
];
