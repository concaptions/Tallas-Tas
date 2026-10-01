import { creativeReportDifferenceCpa, type CreativeReportListRow } from './creative-reporting';
import { DEMO_ACTOR_ID, DEMO_BRAND_ID } from './demo-data';

/**
 * The Creative Reporting fixtures the app serves in DEMO MODE (Airtable "Creative Reporting",
 * `tblgW4bwDSSeqihlr`). Same conventions as `demo-data.ts`: every id is a hardcoded uuid, every
 * timestamp a fixed ISO string (never `new Date()` at module scope), and each row is typed as the
 * query layer's `CreativeReportListRow`, so a fixture and a database row are one shape. The
 * `numeric` columns are strings at their column scale, exactly as Postgres returns them, and
 * `differenceCpa` comes from `creativeReportDifferenceCpa`, the one place the base's formula lives,
 * so a fixture can never disagree with a live row. The rows are ordered newest edit first, as
 * `listCreativeReports` returns them.
 *
 * `brief_id` points at the demo brand's own briefs (`demoBriefs` in `demo-data.ts`); the ids are
 * repeated here rather than imported because that module does not export them, and the names are
 * the §7 names those fixtures generate. The last row has no brief: an Airtable-imported report,
 * whose link the base had lost (`creative-reporting.ts` schema note).
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

const REPORT_BODY_CLOCK_LAUNCHED_ID = 'c0c0c0c0-c0c0-4c0c-8c0c-000000000001';
const REPORT_BODY_CLOCK_V2_ID = 'c0c0c0c0-c0c0-4c0c-8c0c-000000000002';
const REPORT_NOT_YOUR_AGE_ID = 'c0c0c0c0-c0c0-4c0c-8c0c-000000000003';
const REPORT_LEGACY_BUNDLE_ID = 'c0c0c0c0-c0c0-4c0c-8c0c-000000000004';

/** `demoBriefs` ids and their generated names. */
const BRIEF_BODY_CLOCK_LAUNCHED_ID = '77777777-7777-4777-8777-000000000007';
const BRIEF_BODY_CLOCK_VIDEO_ID = '77777777-7777-4777-8777-000000000001';
const BRIEF_NOT_YOUR_AGE_STATIC_ID = '77777777-7777-4777-8777-000000000002';
const BRIEF_BODY_CLOCK_LAUNCHED_NAME =
  'TAS-TV3-B1-Your Body Clock Is Not Broken-Problem/Solution-V1';
const BRIEF_BODY_CLOCK_VIDEO_NAME = 'TAS-TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2';
const BRIEF_NOT_YOUR_AGE_STATIC_NAME = 'TAS-TS1-B2-It Is Not Just Your Age-Green Screen-V1';

/** One row's metrics as the panel stores them, with the formula applied once. */
function metrics(values: {
  ctr: string | null;
  thumbStopRate: string | null;
  results: string | null;
  cpa: string | null;
  targetCpa: string | null;
  roas: string | null;
  targetRoas: string | null;
}) {
  return { ...values, differenceCpa: creativeReportDifferenceCpa(values.cpa, values.targetCpa) };
}

export const demoCreativeReports: CreativeReportListRow[] = [
  {
    ...propagationBase(
      REPORT_BODY_CLOCK_LAUNCHED_ID,
      '2026-09-08T09:00:00.000Z',
      '2026-09-19T15:40:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    nameAngleOffer: 'Body Clock V1 — Shift Worker — 90-Night Trial',
    briefId: BRIEF_BODY_CLOCK_LAUNCHED_ID,
    briefName: BRIEF_BODY_CLOCK_LAUNCHED_NAME,
    notes:
      'Week two of the launch. Thumb-stop held above 30% once the driveway open replaced the bed open; CPA came in under target from day four.',
    adDesign: ['https://picsum.photos/seed/report-body-clock-v1/1200/900'],
    adLink: 'https://www.facebook.com/ads/library/?id=1204339857741622',
    ...metrics({
      ctr: '0.0412',
      thumbStopRate: '31.50',
      results: '184.0',
      cpa: '19.80',
      targetCpa: '22.00',
      roas: '3.40',
      targetRoas: '3.0',
    }),
  },
  {
    ...propagationBase(
      REPORT_BODY_CLOCK_V2_ID,
      '2026-09-12T10:15:00.000Z',
      '2026-09-18T11:05:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    nameAngleOffer: 'Body Clock V2 — Shift Worker — 90-Night Trial',
    briefId: BRIEF_BODY_CLOCK_VIDEO_ID,
    briefName: BRIEF_BODY_CLOCK_VIDEO_NAME,
    notes:
      'The V2 recut, three days in. Click-through is up on V1 but the results have not caught up yet; leave it another week before calling it.',
    adDesign: [
      'https://picsum.photos/seed/report-body-clock-v2/1200/900',
      'https://picsum.photos/seed/report-body-clock-v2-916/900/1600',
    ],
    adLink: 'https://www.facebook.com/ads/library/?id=1204339857741699',
    ...metrics({
      ctr: '0.0468',
      thumbStopRate: '34.20',
      results: '41.0',
      cpa: '24.50',
      targetCpa: '22.00',
      roas: '2.60',
      targetRoas: '3.0',
    }),
  },
  {
    ...propagationBase(
      REPORT_NOT_YOUR_AGE_ID,
      '2026-09-10T14:30:00.000Z',
      '2026-09-16T09:50:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    nameAngleOffer: 'Not Your Age — Peri-Menopause — Free Shipping',
    briefId: BRIEF_NOT_YOUR_AGE_STATIC_ID,
    briefName: BRIEF_NOT_YOUR_AGE_STATIC_NAME,
    notes: null,
    adDesign: ['https://picsum.photos/seed/report-not-your-age/1080/1080'],
    adLink: 'https://www.facebook.com/ads/library/?id=982254173318827',
    ...metrics({
      ctr: '0.0295',
      thumbStopRate: null,
      results: '63.0',
      cpa: '27.10',
      targetCpa: '25.00',
      roas: '2.20',
      targetRoas: '2.5',
    }),
  },
  {
    ...propagationBase(
      REPORT_LEGACY_BUNDLE_ID,
      '2026-08-20T08:00:00.000Z',
      '2026-09-02T16:10:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    legacyAirtableId: 'recCRlegacyBundle01',
    nameAngleOffer: 'Night Reset Bundle — Gifting — BFCM Early Access',
    briefId: null,
    briefName: null,
    notes: 'Imported from the Airtable sheet; the base had already lost its link to the creative.',
    adDesign: null,
    adLink: null,
    ...metrics({
      ctr: '0.0210',
      thumbStopRate: '22.00',
      results: '17.0',
      cpa: null,
      targetCpa: '30.00',
      roas: '1.80',
      targetRoas: null,
    }),
  },
];
