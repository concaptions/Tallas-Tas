import {
  CONCEPT_CLIENT_STATUS_DEFAULT,
  CONCEPT_INTERNAL_STATUS_DEFAULT,
  demoConcepts,
  type Db,
} from '@tas/db';
import { conceptName } from '@tas/domain/concepts';
import {
  CLIENT_STATUS,
  INTERNAL_VIDEO_STATUS,
  internalStatusFor,
  isClientTrackOpen,
} from '@tas/domain/state';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CONCEPT_TRACK, loadConceptById, loadConcepts, withBrandScope } from './concepts-source';

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

describe('loadConcepts in demo mode', () => {
  it('returns the fixtures and constructs no database client, even with DATABASE_URL set', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const result = await loadConcepts({ connect });

    expect(result.source).toBe('demo');
    expect(result.rows).toEqual(demoConcepts);
    expect(result.rows).toHaveLength(4);
    expect(connect).not.toHaveBeenCalled();
  });

  it('answers from the fixtures with no environment variables at all', async () => {
    await expect(loadConcepts({ connect })).resolves.toMatchObject({ source: 'demo' });
  });

  it('finds one fixture by id and misses an unknown id, without a connection', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const [first] = demoConcepts;
    if (first === undefined) {
      throw new Error('the demo fixtures are empty');
    }

    await expect(loadConceptById(first.id, { connect })).resolves.toEqual({
      concept: first,
      source: 'demo',
    });
    await expect(loadConceptById('nope', { connect })).resolves.toEqual({
      concept: null,
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

describe('loadConcepts in live mode', () => {
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
      loadConcepts({
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

/**
 * `apps/web` is the only package that depends on BOTH `@tas/db` and `@tas/domain`, so it is the only
 * place the two copies of these three strings — and the one hand-written copy of the naming formula
 * in `packages/db/src/demo-data.ts` — can be proved equal. Both package agents asked for this test
 * by name; if one of these fails, the fixtures and the state machine have drifted and the narrowing
 * in `concepts-source.ts` is silently rewriting statuses.
 */
describe('the db copies of the domain vocabulary', () => {
  it('starts a concept on the first step of the video track', () => {
    expect(CONCEPT_INTERNAL_STATUS_DEFAULT).toBe(INTERNAL_VIDEO_STATUS[0].key);
    expect(internalStatusFor(CONCEPT_TRACK)).toBe(INTERNAL_VIDEO_STATUS);
  });

  it('starts a concept on the first step of the client track', () => {
    expect(CONCEPT_CLIENT_STATUS_DEFAULT).toBe(CLIENT_STATUS[0].key);
  });

  it('names every fixture with the domain formula, character for character', () => {
    for (const row of demoConcepts) {
      expect(
        conceptName({ batch: row.batch, angleName: row.angleName, themeName: row.themeName }),
      ).toBe(row.name);
    }
  });

  it('leaves the client track closed on all four fixtures (AC 11)', () => {
    const internal = demoConcepts.map((row) => row.internalStatus);

    expect(new Set(internal).size).toBe(4);
    for (const key of internal) {
      expect(INTERNAL_VIDEO_STATUS.some((entry) => entry.key === key)).toBe(true);
      // Narrowed the same way `toConceptRow` does, so the gate is asked the stored value itself.
      const narrowed = internalStatusFor(CONCEPT_TRACK).find((entry) => entry.key === key)?.key;
      expect(narrowed).toBeDefined();
      expect(isClientTrackOpen(narrowed ?? CONCEPT_INTERNAL_STATUS_DEFAULT)).toBe(false);
    }
  });
});
