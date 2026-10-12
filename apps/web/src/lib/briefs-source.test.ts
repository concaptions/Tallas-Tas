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
import {
  CLIENT_STATUS,
  INTERNAL_ENTRY_STATUS,
  INTERNAL_STATUS,
  isClientTrackOpen,
} from '@tas/domain/state';
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

  it('narrows every fixture status to a step the one internal list really contains', async () => {
    const { rows } = await loadBriefs({ connect });

    for (const row of rows) {
      expect(INTERNAL_STATUS.map((entry) => entry.key)).toContain(row.internalStatus);
      expect(CLIENT_STATUS.map((entry) => entry.key)).toContain(row.clientStatus);
    }
  });

  it('keeps every stored status it can place, changing no value', async () => {
    const { rows } = await loadBriefs({ connect });

    const kept = rows.filter(
      (row, index) => row.internalStatus === demoBriefs[index]?.internalStatus,
    );

    // Every fixture is on the list (the exact 0067 image), so every one is kept as stored.
    expect(kept).toHaveLength(demoBriefs.length);
    for (const row of kept) {
      expect(INTERNAL_STATUS.map((entry) => entry.key)).toContain(row.internalStatus);
    }
    expect(rows.map((row) => row.clientStatus)).toEqual(demoBriefs.map((row) => row.clientStatus));
  });

  /**
   * A stored value this build cannot place — a retired spelling 0067 moved every row off, a key a
   * newer build wrote — falls back to `INTERNAL_ENTRY_STATUS` for a video AND for a static brief:
   * one list, one fallback, never a per-track first step and never a legacy-key map.
   */
  it('falls back to INTERNAL_ENTRY_STATUS for an unplaceable value, on either track', () => {
    const [video] = demoBriefs.filter((row) => row.type === 'Video');
    const [staticBrief] = demoBriefs.filter((row) => row.type === 'Static');
    if (video === undefined || staticBrief === undefined) {
      throw new Error('the fixtures cover fewer types than the ticket requires');
    }
    const stored = (row: BriefListRow, internalStatus: string): BriefListRow => ({
      ...row,
      internalStatus,
    });

    expect(toBriefRow(stored(video, 'on_hold')).internalStatus).toBe(INTERNAL_ENTRY_STATUS);
    expect(toBriefRow(stored(video, 'sent_to_video_editor')).internalStatus).toBe(
      INTERNAL_ENTRY_STATUS,
    );
    expect(toBriefRow(stored(staticBrief, 'on_hold')).internalStatus).toBe(INTERNAL_ENTRY_STATUS);
    expect(toBriefRow(stored(staticBrief, 'sent_to_designer')).internalStatus).toBe(
      INTERNAL_ENTRY_STATUS,
    );
    expect(BRIEF_INTERNAL_STATUS_DEFAULT).toBe(INTERNAL_ENTRY_STATUS);
    expect(toBriefRow({ ...video, clientStatus: 'invented' }).clientStatus).toBe(
      BRIEF_CLIENT_STATUS_DEFAULT,
    );
  });

  /**
   * The gate, pinned against the shipped distribution (ticket `client-queue`, the 0067 image):
   * FOUR fixtures are internally Approved, so four rows have an open client track. Only three of
   * them are on the client BOARD — the fourth is the client's own `launched`, the media buyer's
   * column, not an approval the client still owes — and that second half of the rule lives in
   * `isOnClientQueue` / `clientQueueRows`, tested in `client-queue-source.test.ts`, not here.
   */
  it('opens the client track on the four approved fixtures, one of them launched by the client', async () => {
    const { rows } = await loadBriefs({ connect });

    const open = rows.filter((row) => isClientTrackOpen(row.internalStatus));
    expect(open).toHaveLength(4);
    expect(open.map((row) => row.internalStatus)).toEqual([
      'approved',
      'approved',
      'approved',
      'approved',
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

  it('agree that the internal track starts where the column default says it does', () => {
    expect(INTERNAL_ENTRY_STATUS).toBe(BRIEF_INTERNAL_STATUS_DEFAULT);
    expect(INTERNAL_STATUS[0].key).toBe('draft');
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
