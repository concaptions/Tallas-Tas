import {
  BRIEF_CLIENT_STATUS_DEFAULT,
  BRIEF_INTERNAL_STATUS_DEFAULT,
  STANDALONE_CONCEPT_SLUG as DB_STANDALONE_CONCEPT_SLUG,
  creativeFunnels,
  creativePriorities,
  creativeTypes,
  demoBriefs,
  type BriefListRow,
  type Db,
} from '@tas/db';
import {
  CREATIVE_FUNNEL_KEYS,
  CREATIVE_PRIORITY_KEYS,
  CREATIVE_TYPE_KEYS,
  STANDALONE_CONCEPT_SLUG,
  conceptNameSegment,
  creativeName,
  creativeTrack,
  dimensionsFor,
} from '@tas/domain/creatives';
import { CLIENT_STATUS, internalStatusFor, isClientTrackOpen } from '@tas/domain/state';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadBriefById, loadBriefs, toBriefRow, withBrandScope } from './briefs-source';

/**
 * The demo-mode guarantee, proved rather than asserted: with no Clerk key and a `DATABASE_URL` set,
 * the source answers from the fixtures and the connection factory is never called. The factory is
 * injected for exactly that reason — "no client was constructed" is not observable otherwise.
 */
const connect = vi.fn<(databaseUrl: string) => never>(() => {
  throw new Error('the demo branch opened a database connection');
});

afterEach(() => {
  connect.mockClear();
  vi.unstubAllEnvs();
});

describe('loadBriefs in demo mode', () => {
  it('returns the seven fixtures and constructs no database client, even with DATABASE_URL set', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const result = await loadBriefs({ connect });

    expect(result.source).toBe('demo');
    expect(result.rows).toEqual(demoBriefs.map(toBriefRow));
    expect(result.rows).toHaveLength(7);
    expect(connect).not.toHaveBeenCalled();
  });

  it('answers from the fixtures with no environment variables at all', async () => {
    await expect(loadBriefs({ connect })).resolves.toMatchObject({ source: 'demo' });
  });

  it('keeps the fixtures in their stored newest-edit-first order, sorting nothing', async () => {
    const { rows } = await loadBriefs({ connect });

    expect(rows.map((row) => row.id)).toEqual(demoBriefs.map((row) => row.id));
    const stamps = rows.map((row) => row.updatedAt.getTime());
    expect([...stamps].sort((a, b) => b - a)).toEqual(stamps);
  });

  it('finds one fixture by id and misses an unknown id, without a connection', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const [first] = demoBriefs;
    if (first === undefined) {
      throw new Error('the demo fixtures are empty');
    }

    await expect(loadBriefById(first.id, { connect })).resolves.toEqual({
      brief: toBriefRow(first),
      source: 'demo',
    });
    await expect(loadBriefById('nope', { connect })).resolves.toEqual({
      brief: null,
      source: 'demo',
    });
    expect(connect).not.toHaveBeenCalled();
  });

  it('refuses a write outright', async () => {
    await expect(withBrandScope(() => Promise.resolve('written'), { connect })).rejects.toThrow(
      /Demo mode/u,
    );
    expect(connect).not.toHaveBeenCalled();
  });
});

describe('loadBriefs in live mode', () => {
  it('opens a connection from DATABASE_URL and closes it even when the query throws', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const close = vi.fn(() => Promise.resolve());
    // A handle that fails on first use: enough to prove the `finally` closes the pool.
    const db = {
      select: () => {
        throw new Error('boom');
      },
    } as unknown as Db;
    const openings: string[] = [];

    await expect(
      loadBriefs({
        demoMode: () => false,
        actorScope: () => Promise.resolve({ clerkOrgId: 'org-live', clerkUserId: null }),
        connect: (url) => {
          openings.push(url);
          return { db, close };
        },
      }),
    ).rejects.toThrow('boom');

    expect(openings).toEqual(['postgres://user:pw@example.test/db']);
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('toBriefRow', () => {
  it('attaches each fixture to the track its own type is graded on', async () => {
    const { rows } = await loadBriefs({ connect });

    expect(rows.map((row) => [row.type, row.track])).toEqual([
      ['Video', 'video'],
      ['Static', 'static'],
      ['Motion Image', 'video'],
      ['Video', 'video'],
      ['Static', 'static'],
      ['Carousel', 'static'],
      ['Video', 'video'],
    ]);
  });

  it('narrows every fixture status to a step its own track really contains', async () => {
    const { rows } = await loadBriefs({ connect });

    for (const row of rows) {
      expect(internalStatusFor(row.track).map((entry) => entry.key)).toContain(row.internalStatus);
      expect(CLIENT_STATUS.map((entry) => entry.key)).toContain(row.clientStatus);
    }
  });

  it('keeps every stored status it can place, changing no value', async () => {
    const { rows } = await loadBriefs({ connect });

    const kept = rows.filter(
      (row, index) => row.internalStatus === demoBriefs[index]?.internalStatus,
    );

    expect(kept).toHaveLength(6);
    for (const row of kept) {
      expect(internalStatusFor(row.track).map((entry) => entry.key)).toContain(row.internalStatus);
    }
    expect(rows.map((row) => row.clientStatus)).toEqual(demoBriefs.map((row) => row.clientStatus));
  });

  /**
   * The sixth. The carousel fixture rests on the COLUMN DEFAULT, `sent_to_video_editor`, which is a
   * video-track literal because a Postgres default cannot look at another column
   * (`schema/briefs.ts` says so in as many words) — yet a carousel is a set of stills and is graded
   * on the static ladder. Rendering the stored string would put a step on the stepper that the
   * static track does not have, so the boundary shows that track's equivalent first step instead.
   */
  it('renders a static-track brief resting on the column default as its own track first step', async () => {
    const { rows } = await loadBriefs({ connect });

    const carousel = rows.find((row) => row.type === 'Carousel');
    const stored = demoBriefs.find((row) => row.type === 'Carousel');

    expect(stored?.internalStatus).toBe(BRIEF_INTERNAL_STATUS_DEFAULT);
    expect(carousel?.track).toBe('static');
    expect(carousel?.internalStatus).toBe('sent_to_designer');
  });

  it('falls back to the FIRST step of the row own track, never to the other track', () => {
    const [video] = demoBriefs.filter((row) => row.type === 'Video');
    const [staticBrief] = demoBriefs.filter((row) => row.type === 'Static');
    if (video === undefined || staticBrief === undefined) {
      throw new Error('the fixtures cover fewer types than the ticket requires');
    }
    // `on_hold` is a stored value the machine knows but neither linear list contains, so it is the
    // honest stand-in for "a status this build cannot place on the stepper".
    const unplaceable = (row: BriefListRow): BriefListRow => ({
      ...row,
      internalStatus: 'on_hold',
    });

    expect(toBriefRow(unplaceable(video)).internalStatus).toBe(BRIEF_INTERNAL_STATUS_DEFAULT);
    expect(toBriefRow(unplaceable(staticBrief)).internalStatus).toBe(
      internalStatusFor('static')[0]?.key,
    );
    expect(toBriefRow({ ...video, clientStatus: 'invented' }).clientStatus).toBe(
      BRIEF_CLIENT_STATUS_DEFAULT,
    );
  });

  /**
   * The gate, pinned against the shipped distribution (ticket `client-queue`): three fixtures are
   * internally Approved and one has gone all the way to Launched, so FOUR rows have an open client
   * track. Only three of them are on the client BOARD — `launched` is the media buyer's column, not an
   * approval the client still owes — and that second half of the rule lives in `isOnClientQueue` /
   * `clientQueueRows`, tested in `client-queue-source.test.ts`, not here.
   */
  it('opens the client track on the three approved fixtures and the launched one', async () => {
    const { rows } = await loadBriefs({ connect });

    const open = rows.filter((row) => isClientTrackOpen(row.internalStatus));
    expect(open).toHaveLength(4);
    expect(open.map((row) => row.internalStatus)).toEqual([
      'approved',
      'approved',
      'approved',
      'launched',
    ]);
    expect(open.map((row) => row.clientStatus)).toEqual([
      BRIEF_CLIENT_STATUS_DEFAULT,
      BRIEF_CLIENT_STATUS_DEFAULT,
      'approved',
      'launched',
    ]);
  });

  it('leaves the standalone fixture with no inherited name at all', async () => {
    const { rows } = await loadBriefs({ connect });

    const standalone = rows.filter((row) => row.conceptId === null);
    expect(standalone).toHaveLength(1);
    expect(standalone[0]).toMatchObject({
      conceptName: null,
      angleName: null,
      productName: null,
    });
    expect(standalone[0]?.name).toContain(STANDALONE_CONCEPT_SLUG);
  });
});

/**
 * THE PARITY SUITE the two packages both point at.
 *
 * `@tas/db` may not depend on `@tas/domain` — the edge runs app → db and app → domain everywhere in
 * this repo — so `packages/db/src/demo-data.ts` keeps a two-line copy of the PRD §7 formula and its
 * own copies of the storage vocabularies. `apps/web` is the only package that imports both, which
 * makes this the one place the copies can be proved equal rather than assumed equal. A formula that
 * drifts fails here, loudly, instead of silently renaming six fixtures.
 */
describe('the @tas/domain formula and the @tas/db copy', () => {
  it('spell the standalone slug the same way', () => {
    expect(DB_STANDALONE_CONCEPT_SLUG).toBe(STANDALONE_CONCEPT_SLUG);
  });

  it('carry the same storage vocabularies, value for value and in the same order', () => {
    expect(CREATIVE_FUNNEL_KEYS).toEqual([...creativeFunnels]);
    expect(CREATIVE_TYPE_KEYS).toEqual([...creativeTypes]);
    expect(CREATIVE_PRIORITY_KEYS).toEqual([...creativePriorities]);
  });

  it('rebuild every fixture name from the fixture row itself', () => {
    const rebuilt = demoBriefs.map((row) =>
      creativeName({
        source: row.source,
        funnel: row.funnel,
        format: row.type,
        number: row.sequence,
        batch: row.batch,
        version: row.version,
        conceptName:
          row.conceptName === null
            ? null
            : conceptNameSegment({ name: row.conceptName, batch: row.batch }),
        product: row.conceptId === null ? STANDALONE_FIXTURE_PRODUCT : null,
      }),
    );

    expect(rebuilt).toEqual(demoBriefs.map((row) => row.name));
  });

  it('pins the seven names the db handoff published, so a rename is never silent', () => {
    expect(demoBriefs.map((row) => row.name)).toEqual([
      'TAS-TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2',
      'TAS-TS1-B2-It Is Not Just Your Age-Green Screen-V1',
      'TAS-AM1-B2-Make 9am Look Like 3am-POV: X vs Y-V1',
      'TAS-TV2-B3-Sleep In The Ninety Minutes You Actually Get-Yapper Style-V1',
      'Client-RS1-B4-Standalone-V3-NIGHT RESET BUNDLE',
      'TAS-TC1-B3-Sleep In The Ninety Minutes You Actually Get-Yapper Style-V1',
      'TAS-TV3-B1-Your Body Clock Is Not Broken-Problem/Solution-V1',
    ]);
  });

  it('agree on the §8 dimension defaults every fixture was stored with', () => {
    for (const row of demoBriefs) {
      expect(row.dimensions).toEqual([...dimensionsFor(row.type)]);
    }
  });

  it('agree that the video track starts where the column default says it does', () => {
    expect(internalStatusFor('video')[0]?.key).toBe(BRIEF_INTERNAL_STATUS_DEFAULT);
    expect(CLIENT_STATUS[0].key).toBe(BRIEF_CLIENT_STATUS_DEFAULT);
    expect(creativeTrack('Video')).toBe('video');
  });
});

/**
 * The optional §7 product suffix the one standalone fixture was named with. Written out rather than
 * read back off the name, which would make the rebuild above circular: a standalone brief stores no
 * product column at all (`productName` is the inherited join, and it is null precisely because there
 * is no concept to reach an angle or a product through), so the product exists only as an input to
 * the formula. Exactly one fixture is standalone, which the suite above asserts separately.
 */
const STANDALONE_FIXTURE_PRODUCT = 'NIGHT RESET BUNDLE';
