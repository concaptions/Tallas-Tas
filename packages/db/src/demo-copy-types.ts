import type { CopyTypeListRow, LinkedCopy } from './copy-types';
import { DEMO_ACTOR_ID, DEMO_BRAND_ID, demoCopy } from './demo-data';
import { demoYoutubeCopy } from './demo-youtube-copy';

/**
 * The Copy Types fixtures the app serves in DEMO MODE (Airtable "(Internal) Copy Type", gap audit
 * 2026-10-01 §2.13). Same conventions as `demo-data.ts`: every id is a hardcoded uuid, every
 * timestamp a fixed ISO string, never `randomUUID()` or `new Date()` at module scope — the fixtures
 * are linked and rendered by id and compared row for row in `copy-types.test.ts`.
 *
 * The links point at the seeded Meta copy (`demoCopy`) and the sibling YouTube copy fixtures
 * (`demoYoutubeCopy`) by THEIR ids, and the Copy # and headline are looked up from those fixtures
 * rather than retyped, so a rewritten headline can never leave a copy type describing words that no
 * longer exist. Each list is in Copy # order, the order `listCopyTypes` returns, so a seeded database
 * and these rows are identical.
 *
 * Four copy types for Niagara Sleep Solutions: two tagged on several copies, one on a single copy of
 * each channel, and one with no description and no copy yet (the optional column is visibly optional
 * and the grid shows a real zero). In `updated_at` descending order, the order the query returns.
 */

const COPY_TYPE_PAS_ID = 'c0b7a1d3-0013-4013-8013-000000000001';
const COPY_TYPE_TESTIMONIAL_ID = 'c0b7a1d3-0013-4013-8013-000000000002';
const COPY_TYPE_OFFER_LED_ID = 'c0b7a1d3-0013-4013-8013-000000000003';
const COPY_TYPE_FOUNDER_NOTE_ID = 'c0b7a1d3-0013-4013-8013-000000000004';

const META_COPY_BODY_CLOCK_ID = '88888888-8888-4888-8888-000000000001';
const META_COPY_NOT_YOUR_AGE_ID = '88888888-8888-4888-8888-000000000002';
const META_COPY_DAYLIGHT_ID = '88888888-8888-4888-8888-000000000003';
const META_COPY_BUNDLE_ID = '88888888-8888-4888-8888-000000000004';

const YOUTUBE_COPY_BODY_CLOCK_ID = 'a1b2c3d4-0012-4012-8012-000000000001';
const YOUTUBE_COPY_DAYLIGHT_ID = 'a1b2c3d4-0012-4012-8012-000000000002';
const YOUTUBE_COPY_THERMOSTAT_ID = 'a1b2c3d4-0012-4012-8012-000000000003';
const YOUTUBE_COPY_NINETY_MINUTES_ID = 'a1b2c3d4-0012-4012-8012-000000000004';

const at = (iso: string): Date => new Date(iso);

/** The shared and propagation columns every demo row carries; the same shape `demo-data.ts` builds. */
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

/** The linked copies by id, Copy # and headline read off the fixture, in Copy # order. */
function linkedCopies(
  rows: readonly { id: string; copyNumber: number; headline: string | null }[],
  ids: readonly string[],
  what: string,
): LinkedCopy[] {
  const linked = ids.map((id) => {
    const row = rows.find((candidate) => candidate.id === id);
    if (row === undefined) throw new Error(`demo ${what} ${id} is missing`);
    return { id: row.id, copyNumber: row.copyNumber, headline: row.headline };
  });
  linked.sort((a, b) => a.copyNumber - b.copyNumber || a.id.localeCompare(b.id));
  return linked;
}

function linked(metaIds: readonly string[], youtubeIds: readonly string[]) {
  return {
    metaCopies: linkedCopies(demoCopy, metaIds, 'Meta copy'),
    youtubeCopies: linkedCopies(demoYoutubeCopy, youtubeIds, 'YouTube copy'),
  };
}

export const demoCopyTypes: CopyTypeListRow[] = [
  {
    ...propagationBase(COPY_TYPE_PAS_ID, '2026-08-18T09:00:00.000Z', '2026-09-16T12:00:00.000Z'),
    brandId: DEMO_BRAND_ID,
    name: 'Problem / Agitate / Solve',
    description:
      'Name the 3am problem in the first line, make it worse for two more, then hand over the product. The default structure for cold traffic.',
    ...linked(
      [META_COPY_BODY_CLOCK_ID, META_COPY_DAYLIGHT_ID],
      [YOUTUBE_COPY_BODY_CLOCK_ID, YOUTUBE_COPY_DAYLIGHT_ID],
    ),
  },
  {
    ...propagationBase(
      COPY_TYPE_TESTIMONIAL_ID,
      '2026-08-18T09:05:00.000Z',
      '2026-09-14T09:30:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    name: 'Testimonial',
    description:
      "A customer's own words first, the product second. Quote a real thread or review; never paraphrase it into marketing.",
    ...linked([META_COPY_NOT_YOUR_AGE_ID], [YOUTUBE_COPY_THERMOSTAT_ID]),
  },
  {
    ...propagationBase(
      COPY_TYPE_OFFER_LED_ID,
      '2026-08-25T14:20:00.000Z',
      '2026-09-11T15:45:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    name: 'Offer-Led',
    description:
      'Price, bundle and deadline up front. Reserved for retargeting and the BFCM and gifting windows.',
    ...linked([META_COPY_BUNDLE_ID], [YOUTUBE_COPY_NINETY_MINUTES_ID]),
  },
  {
    ...propagationBase(
      COPY_TYPE_FOUNDER_NOTE_ID,
      '2026-09-05T10:10:00.000Z',
      '2026-09-05T10:10:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    name: 'Founder Note',
    description: null,
    ...linked([], []),
  },
];
