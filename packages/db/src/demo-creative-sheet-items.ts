import type { BriefListRow } from './briefs';
import { type CreativeSheetItemListRow } from './creative-sheet-items';
import { creativeSheetName } from './formulas';
import { DEMO_ACTOR_ID, DEMO_BRAND_ID, demoBriefs } from './demo-data';

/**
 * Five Creative Sheet rows for Niagara Sleep Solutions (Airtable `tblGC0TxnHI7lKaNQ`): the month's
 * client-facing sheet, one row per creative. Same conventions as `demo-data.ts`: every id is a
 * hardcoded uuid, every timestamp a fixed ISO string, and the array is in `updated_at` descending
 * order — the order `listCreativeSheetItems` returns — so a test can compare the two directly.
 *
 * Four rows link to a seeded brief and read their brief fields FROM that fixture, so the sheet and
 * the Creative Design fixtures cannot disagree; `name` is `creativeSheetName` over the row's own
 * `created_at`, never typed. The fifth has `briefId: null` — Airtable lets a sheet row exist before
 * its link is filled, the same rule as `creative_briefs.concept_id` — and is named by its month alone.
 * Three rows were created in September and two in October, so both month prefixes are on screen.
 */

const SHEET_BODY_CLOCK_V2_ID = 'c5c5c5c5-c5c5-4c5c-8c5c-000000000001';
const SHEET_UNLINKED_ID = 'c5c5c5c5-c5c5-4c5c-8c5c-000000000002';
const SHEET_BUNDLE_V3_ID = 'c5c5c5c5-c5c5-4c5c-8c5c-000000000003';
const SHEET_DAYLIGHT_ID = 'c5c5c5c5-c5c5-4c5c-8c5c-000000000004';
const SHEET_BODY_CLOCK_LIVE_ID = 'c5c5c5c5-c5c5-4c5c-8c5c-000000000005';

/** The seeded brief ids these rows link to, as `demo-data.ts` declares them. */
const BRIEF_BODY_CLOCK_VIDEO_ID = '77777777-7777-4777-8777-000000000001';
const BRIEF_DAYLIGHT_MOTION_ID = '77777777-7777-4777-8777-000000000003';
const BRIEF_BUNDLE_STANDALONE_ID = '77777777-7777-4777-8777-000000000005';
const BRIEF_BODY_CLOCK_LAUNCHED_ID = '77777777-7777-4777-8777-000000000007';

const at = (iso: string): Date => new Date(iso);

/** The shared columns every demo row carries, the `propagationBase` of `demo-data.ts`. */
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

/** One seeded brief by id, past `noUncheckedIndexedAccess`. */
function demoBrief(id: string): BriefListRow {
  const row = demoBriefs.find((brief) => brief.id === id);
  if (row === undefined) throw new Error(`demoBriefs has no ${id}`);
  return row;
}

/** The fields a sheet row reads through its brief, copied from the brief fixture itself. */
function fromBrief(briefId: string | null, createdAt: string) {
  const brief = briefId === null ? null : demoBrief(briefId);
  return {
    briefId,
    name: creativeSheetName(at(createdAt), brief?.name ?? null) ?? '',
    briefName: brief?.name ?? null,
    briefType: brief?.type ?? null,
    briefPlatform: brief?.platform ?? [],
    briefFunnel: brief?.funnel ?? null,
    briefPerformance: brief?.performance ?? null,
    briefDesignFileUrl: brief?.designFileUrl ?? null,
  };
}

export const demoCreativeSheetItems: CreativeSheetItemListRow[] = [
  {
    ...propagationBase(
      SHEET_BODY_CLOCK_V2_ID,
      '2026-10-01T08:00:00.000Z',
      '2026-10-01T09:30:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    ...fromBrief(BRIEF_BODY_CLOCK_VIDEO_ID, '2026-10-01T08:00:00.000Z'),
    internalStatus: 'approved',
    status: 'pending_for_approval',
    qaChecklistDoc: ['https://docs.niagarasleep.example/qa/tv1-b1-v2-checklist'],
    qaVideoEditor: true,
    qaDesigner: true,
    qaStrategist: true,
    clientComments:
      'Can we hold the "your rota is the abnormal thing" card one beat longer? Otherwise this is the one.',
    used: false,
    deniedRevisionsNeeded: false,
    winning: null,
    spellCheckRequested: false,
    spellingFeedback: null,
  },
  {
    ...propagationBase(SHEET_UNLINKED_ID, '2026-10-01T07:00:00.000Z', '2026-10-01T07:05:00.000Z'),
    brandId: DEMO_BRAND_ID,
    ...fromBrief(null, '2026-10-01T07:00:00.000Z'),
    internalStatus: 'sent_to_designer',
    status: null,
    qaChecklistDoc: null,
    qaVideoEditor: false,
    qaDesigner: false,
    qaStrategist: false,
    clientComments: null,
    used: false,
    deniedRevisionsNeeded: false,
    winning: null,
    spellCheckRequested: false,
    spellingFeedback: null,
  },
  {
    ...propagationBase(SHEET_BUNDLE_V3_ID, '2026-09-20T10:15:00.000Z', '2026-09-28T16:40:00.000Z'),
    brandId: DEMO_BRAND_ID,
    ...fromBrief(BRIEF_BUNDLE_STANDALONE_ID, '2026-09-20T10:15:00.000Z'),
    internalStatus: 'approved',
    status: 'approved',
    qaChecklistDoc: [
      'https://docs.niagarasleep.example/qa/rs1-b4-v3-checklist',
      'https://docs.niagarasleep.example/qa/rs1-b4-v3-client-markup',
    ],
    qaVideoEditor: false,
    qaDesigner: true,
    qaStrategist: true,
    clientComments: 'Approved. Ship the 9:16 first — stories is where the bundle converts.',
    used: true,
    deniedRevisionsNeeded: false,
    winning: 'average',
    spellCheckRequested: false,
    spellingFeedback: null,
  },
  {
    ...propagationBase(SHEET_DAYLIGHT_ID, '2026-09-12T19:00:00.000Z', '2026-09-25T11:20:00.000Z'),
    brandId: DEMO_BRAND_ID,
    ...fromBrief(BRIEF_DAYLIGHT_MOTION_ID, '2026-09-12T19:00:00.000Z'),
    internalStatus: 'ad_submitted',
    status: 'revisions_needed',
    qaChecklistDoc: null,
    qaVideoEditor: true,
    qaDesigner: true,
    qaStrategist: false,
    clientComments:
      'The lux readings need the meter brand on screen or legal will not clear the "ninety to one" claim.',
    used: false,
    deniedRevisionsNeeded: true,
    winning: null,
    spellCheckRequested: true,
    spellingFeedback:
      'Card 3 says "ninety to one" while card 2 reads 186 over 2, which is ninety-three to one. "on-call room" is hyphenated on card 5 and not on the end card.',
  },
  {
    ...propagationBase(
      SHEET_BODY_CLOCK_LIVE_ID,
      '2026-09-02T09:10:00.000Z',
      '2026-09-18T08:45:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    ...fromBrief(BRIEF_BODY_CLOCK_LAUNCHED_ID, '2026-09-02T09:10:00.000Z'),
    internalStatus: 'approved',
    status: 'launched',
    qaChecklistDoc: ['https://docs.niagarasleep.example/qa/tv3-b1-v1-checklist'],
    qaVideoEditor: true,
    qaDesigner: true,
    qaStrategist: true,
    clientComments: null,
    used: true,
    deniedRevisionsNeeded: false,
    winning: 'best_performing',
    spellCheckRequested: false,
    spellingFeedback: null,
  },
];
