import type { ClientAssetFolderListRow } from './client-asset-folders';
import { DEMO_ACTOR_ID, DEMO_BRAND_ID, demoBriefs } from './demo-data';

/**
 * The Client Assets fixtures the app serves in DEMO MODE (Airtable "Client Assets Organisation",
 * audit §2.9). Same conventions as `demo-data.ts`: every id is a hardcoded uuid, every timestamp a
 * fixed ISO string, never `randomUUID()` or `new Date()` at module scope — the fixtures are linked
 * and rendered by id and compared row for row in `client-asset-folders.test.ts`.
 *
 * The links point at the seeded briefs by THEIR fixture ids, and the names are looked up from those
 * fixtures rather than retyped, so a regenerated brief name can never leave a folder describing a
 * link that no longer exists. Names are kept in the order `listClientAssetFolders` returns them
 * (alphabetical), ids alongside, so a seeded database and these rows are identical.
 *
 * Three folders for Niagara Sleep Solutions: the brand kit and the blanket photography each feed two
 * designs; the September UGC drop has no location yet (the optional column is visibly optional) and
 * nothing built on it (a real zero in the grid). In `updated_at` descending order, the order the
 * query returns.
 */

const FOLDER_BRAND_KIT_ID = 'f01de125-f01d-4f01-8f01-000000000001';
const FOLDER_BLANKET_PHOTOGRAPHY_ID = 'f01de125-f01d-4f01-8f01-000000000002';
const FOLDER_UGC_SEPTEMBER_ID = 'f01de125-f01d-4f01-8f01-000000000003';

const BRIEF_BODY_CLOCK_VIDEO_ID = '77777777-7777-4777-8777-000000000001';
const BRIEF_NOT_YOUR_AGE_STATIC_ID = '77777777-7777-4777-8777-000000000002';
const BRIEF_BUNDLE_STANDALONE_ID = '77777777-7777-4777-8777-000000000005';
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

function briefName(id: string): string {
  const row = demoBriefs.find((brief) => brief.id === id);
  if (row === undefined) throw new Error(`demoBriefs has no ${id}`);
  return row.name;
}

/** Ids paired with their brief names, alphabetical by name — the order the query returns. */
function linked(briefIds: readonly string[]) {
  const pairs = briefIds.map((id) => ({ id, name: briefName(id) }));
  pairs.sort((a, b) => a.name.localeCompare(b.name));
  return { briefIds: pairs.map((pair) => pair.id), briefNames: pairs.map((pair) => pair.name) };
}

export const demoClientAssetFolders: ClientAssetFolderListRow[] = [
  {
    ...propagationBase(FOLDER_BRAND_KIT_ID, '2026-07-28T10:00:00.000Z', '2026-09-14T15:20:00.000Z'),
    brandId: DEMO_BRAND_ID,
    name: 'Brand Kit — Logos, Fonts & Colour',
    description:
      'Primary and secondary logo lockups (SVG and PNG), the brand sans and mono, and the colour swatches as an .ase file. Every static design starts from here.',
    locationUrl: 'https://drive.google.com/drive/folders/1NiagaraSleepBrandKit2026',
    ...linked([BRIEF_NOT_YOUR_AGE_STATIC_ID, BRIEF_BUNDLE_STANDALONE_ID]),
  },
  {
    ...propagationBase(
      FOLDER_BLANKET_PHOTOGRAPHY_ID,
      '2026-08-04T09:30:00.000Z',
      '2026-09-12T11:45:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    name: 'Product Photography — Deep Sleep Blanket',
    description:
      'Studio and lifestyle shots of the weighted blanket from the 2026 refresh, RAW and edited, one subfolder per colourway.',
    locationUrl: 'https://www.dropbox.com/sh/niagara-blanket-photography-2026',
    ...linked([BRIEF_BODY_CLOCK_VIDEO_ID, BRIEF_BODY_CLOCK_LAUNCHED_ID]),
  },
  {
    ...propagationBase(
      FOLDER_UGC_SEPTEMBER_ID,
      '2026-09-03T14:10:00.000Z',
      '2026-09-08T08:50:00.000Z',
    ),
    brandId: DEMO_BRAND_ID,
    name: 'UGC Raw Footage — September Drop',
    description:
      'Creator deliverables for batch B1, unedited. The client is still consolidating the uploads, so the share link is not in yet.',
    locationUrl: null,
    ...linked([]),
  },
];
