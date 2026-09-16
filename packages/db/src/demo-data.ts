import type { PersonaListRow } from './personas';
import type { ProductListRow } from './products';
import type { Angle, Concept, Theme } from './schema';

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
const ANGLE_BODY_CLOCK_ID = '55555555-5555-4555-8555-000000000001';
const ANGLE_NINETY_MINUTES_ID = '55555555-5555-4555-8555-000000000002';
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
 * Two themes from the GLOBAL library (PRD §5.5): one framework and one production style. Their
 * `brandId` is null, which the `themes_global` check constraint requires.
 */
const problemSolutionTheme: Theme = {
  ...base(THEME_PROBLEM_SOLUTION_ID, '2026-07-20T10:00:00.000Z', '2026-08-28T10:00:00.000Z'),
  brandId: null,
  name: 'Problem/Solution',
  referenceLinks: [
    'https://foreplay.example/boards/problem-solution-sleep',
    'https://atria.example/collections/sleep-aids-2026',
  ],
  notes:
    'Open on the problem in the first two seconds, name it in the viewer’s own words, then land the product as the mechanism that removes it. Works coldest at problem-aware and solution-aware.',
};

export const demoThemes: Theme[] = [
  problemSolutionTheme,
  {
    ...base(THEME_GREEN_SCREEN_ID, '2026-07-20T10:05:00.000Z', '2026-08-30T16:40:00.000Z'),
    brandId: null,
    name: 'Green Screen',
    referenceLinks: ['https://foreplay.example/boards/green-screen-reaction'],
    notes:
      'Creator reacts over a screenshot of a review, a Reddit thread or a sleep-tracker graph. Cheap to produce, high hook rate, and the on-screen artefact carries the proof so the script can stay short.',
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
const bodyClockAngle: Angle = {
  ...base(ANGLE_BODY_CLOCK_ID, '2026-08-14T13:00:00.000Z', '2026-09-11T09:40:00.000Z'),
  brandId: DEMO_BRAND_ID,
  personaId: PERSONA_SHIFT_ID,
  productId: PRODUCT_BLANKET_ID,
  name: 'Your Body Clock Is Not Broken',
  description:
    'Hypothesis: shift workers reject sleep products because every one of them implies they are doing something wrong. Reframe the problem as occupational, not personal — the rota is the abnormal thing, not him — and the weighted blanket becomes equipment for the job rather than a wellness purchase. We expect this to lift cold-traffic hook rate among the healthcare audience and cut the "this is not for me" objection in comments.',
  painPoints:
    'Cannot fall asleep in daylight. Wakes every ninety minutes. Melatonin leaves him groggy for the first hours of a shift. Treats his exhaustion as a personal failing.',
  usp: 'Breathable weighted construction that signals sleep by pressure instead of sedation, so it works at 09:00 in a bright room and leaves nothing in his system when he clocks in at 19:00.',
  type: 'Identity',
};

/** One angle per persona (PRD §5.6): the hypothesis, its pain points and its USP. */
export const demoAngles: Angle[] = [
  bodyClockAngle,
  {
    ...base(ANGLE_NINETY_MINUTES_ID, '2026-08-15T10:30:00.000Z', '2026-09-09T15:20:00.000Z'),
    brandId: DEMO_BRAND_ID,
    personaId: PERSONA_PARENT_ID,
    productId: PRODUCT_MASK_ID,
    name: 'Sleep In The Ninety Minutes You Actually Get',
    description:
      'Hypothesis: new parents have stopped responding to "sleep better" because more sleep is not on offer. Sell the use of the window they already have — the morning handover — instead of the length of the night. Narrow, concrete and immediately testable, which we expect to beat the generic bedtime framing on both hook rate and add-to-cart.',
    painPoints:
      'The only sleep window is in full daylight. Too hot and too alert to drop off. Cannot block sound because of the monitor. Feels selfish spending anything on herself.',
    usp: 'Contoured blackout that clears the eyes with a cooling insert, blocking light only — so the two-hour handover becomes real sleep and she still hears the baby.',
    type: 'Functional',
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
