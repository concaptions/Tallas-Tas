import type { CreativeModuleListRow } from './creative-modules';
import { DEMO_ACTOR_ID, DEMO_BRAND_ID, demoAngles, demoBriefs } from './demo-data';

/**
 * The Creative Modules fixtures the app serves in DEMO MODE (Airtable "(Internal) Creative
 * Modules", audit §2.4). Same conventions as `demo-data.ts`: every id is a hardcoded uuid, every
 * timestamp a fixed ISO string, never `randomUUID()` or `new Date()` at module scope — the fixtures
 * are linked and rendered by id and compared row for row in `creative-modules.test.ts`.
 *
 * The links point at the seeded angles and briefs by THEIR fixture ids, and the names are looked up
 * from those fixtures rather than retyped, so a renamed angle or a regenerated brief name can never
 * leave a module describing a link that no longer exists. Names are kept in the order
 * `listCreativeModules` returns them (alphabetical), ids alongside, so a seeded database and these
 * rows are identical.
 *
 * Four modules: two with a Foreplay board and several links, one with no board (the optional column
 * is visibly optional), one with no designs yet (a real zero in the grid). In `updated_at`
 * descending order, the order the query returns.
 */

const MODULE_PROBLEM_SOLUTION_ID = '1234abcd-1234-4abc-8abc-000000000001';
const MODULE_DAYLIGHT_PROOF_ID = '1234abcd-1234-4abc-8abc-000000000002';
const MODULE_HANDOVER_WINDOW_ID = '1234abcd-1234-4abc-8abc-000000000003';
const MODULE_THERMOSTAT_ID = '1234abcd-1234-4abc-8abc-000000000004';

const ANGLE_BODY_CLOCK_ID = '55555555-5555-4555-8555-000000000001';
const ANGLE_NINETY_MINUTES_ID = '55555555-5555-4555-8555-000000000002';
const ANGLE_NOT_YOUR_AGE_ID = '55555555-5555-4555-8555-000000000003';
const ANGLE_DAYLIGHT_ID = '55555555-5555-4555-8555-000000000004';
const ANGLE_THERMOSTAT_ID = '55555555-5555-4555-8555-000000000005';

const BRIEF_BODY_CLOCK_VIDEO_ID = '77777777-7777-4777-8777-000000000001';
const BRIEF_NOT_YOUR_AGE_STATIC_ID = '77777777-7777-4777-8777-000000000002';
const BRIEF_DAYLIGHT_MOTION_ID = '77777777-7777-4777-8777-000000000003';
const BRIEF_NINETY_MINUTES_VIDEO_ID = '77777777-7777-4777-8777-000000000004';
const BRIEF_NINETY_MINUTES_CAROUSEL_ID = '77777777-7777-4777-8777-000000000006';
const BRIEF_BODY_CLOCK_LAUNCHED_ID = '77777777-7777-4777-8777-000000000007';

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

function angleName(id: string): string {
  const row = demoAngles.find((angle) => angle.id === id);
  if (row === undefined) throw new Error(`demoAngles has no ${id}`);
  return row.name;
}

function briefName(id: string): string {
  const row = demoBriefs.find((brief) => brief.id === id);
  if (row === undefined) throw new Error(`demoBriefs has no ${id}`);
  return row.name;
}

/** Ids paired with their names, alphabetical by name — the order `listCreativeModules` returns. */
function links(ids: readonly string[], nameOf: (id: string) => string) {
  const pairs = ids.map((id) => ({ id, name: nameOf(id) }));
  pairs.sort((a, b) => a.name.localeCompare(b.name));
  return { ids: pairs.map((pair) => pair.id), names: pairs.map((pair) => pair.name) };
}

function linked(angleIds: readonly string[], briefIds: readonly string[]) {
  const linkedAngles = links(angleIds, angleName);
  const linkedBriefs = links(briefIds, briefName);
  return {
    angleIds: linkedAngles.ids,
    angleNames: linkedAngles.names,
    briefIds: linkedBriefs.ids,
    briefNames: linkedBriefs.names,
  };
}

export const demoCreativeModules: CreativeModuleListRow[] = [
  {
    ...propagationBase(
      MODULE_PROBLEM_SOLUTION_ID,
      '2026-08-20T10:00:00.000Z',
      '2026-09-15T17:05:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    moduleName: 'Problem → Solution Hooks',
    foreplayLink: 'https://app.foreplay.co/board/niagara-problem-solution-hooks',
    ...linked(
      [ANGLE_BODY_CLOCK_ID, ANGLE_NOT_YOUR_AGE_ID],
      [BRIEF_BODY_CLOCK_VIDEO_ID, BRIEF_NOT_YOUR_AGE_STATIC_ID, BRIEF_BODY_CLOCK_LAUNCHED_ID],
    ),
  },
  {
    ...propagationBase(
      MODULE_DAYLIGHT_PROOF_ID,
      '2026-08-27T09:30:00.000Z',
      '2026-09-12T18:40:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    moduleName: 'Daylight Proof Demos',
    foreplayLink: 'https://app.foreplay.co/board/niagara-daylight-proof-demos',
    ...linked([ANGLE_DAYLIGHT_ID], [BRIEF_DAYLIGHT_MOTION_ID]),
  },
  {
    ...propagationBase(
      MODULE_HANDOVER_WINDOW_ID,
      '2026-08-22T14:15:00.000Z',
      '2026-09-10T11:50:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    moduleName: 'Parent Handover Window',
    foreplayLink: null,
    ...linked(
      [ANGLE_NINETY_MINUTES_ID],
      [BRIEF_NINETY_MINUTES_VIDEO_ID, BRIEF_NINETY_MINUTES_CAROUSEL_ID],
    ),
  },
  {
    ...propagationBase(
      MODULE_THERMOSTAT_ID,
      '2026-09-01T16:20:00.000Z',
      '2026-09-06T14:30:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    moduleName: 'Couples Thermostat Series',
    foreplayLink: 'https://app.foreplay.co/board/niagara-couples-thermostat',
    ...linked([ANGLE_THERMOSTAT_ID], []),
  },
];
