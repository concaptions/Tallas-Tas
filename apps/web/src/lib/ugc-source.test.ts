import {
  demoCreators,
  demoPartnershipCreators,
  PARTNERSHIP_REFERENCE_DATE,
  type Db,
} from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadCreator, loadCreators, loadPartnerships, loadUgc, withBrandScope } from './ugc-source';

/**
 * The demo-mode guarantee, proved rather than asserted: with no Clerk key and a `DATABASE_URL` set,
 * the source answers from the fixtures and the connection factory is never called. The factory is
 * injected for exactly that reason — "no client was constructed" is not observable otherwise.
 */
const connect = vi.fn<(databaseUrl: string) => never>(() => {
  throw new Error('the demo branch opened a database connection');
});

/** A clock that fails if it is read: demo mode must answer with the pinned reference date instead. */
const clock = vi.fn<() => Date>(() => {
  throw new Error('the demo branch read the wall clock');
});

afterEach(() => {
  connect.mockClear();
  clock.mockClear();
  vi.unstubAllEnvs();
});

describe('loadUgc in demo mode', () => {
  it('returns both fixture lists and constructs no database client, even with DATABASE_URL set', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const result = await loadUgc({ connect, clock });

    expect(result.source).toBe('demo');
    expect(result.creators).toEqual(demoCreators);
    expect(result.creators).toHaveLength(5);
    expect(result.partnerships).toEqual(demoPartnershipCreators);
    expect(result.partnerships).toHaveLength(3);
    expect(connect).not.toHaveBeenCalled();
  });

  it('reads against the pinned reference date, never the wall clock', async () => {
    const result = await loadUgc({ connect, clock });

    expect(result.now).toEqual(PARTNERSHIP_REFERENCE_DATE);
    expect(clock).not.toHaveBeenCalled();
  });

  it('answers the two single-list loaders from the fixtures with no environment variables at all', async () => {
    await expect(loadCreators({ connect })).resolves.toEqual({
      rows: demoCreators,
      source: 'demo',
    });
    await expect(loadPartnerships({ connect })).resolves.toEqual({
      rows: demoPartnershipCreators,
      source: 'demo',
    });
    expect(connect).not.toHaveBeenCalled();
  });

  it('finds one fixture by id and misses an unknown id, without a connection', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const [first] = demoCreators;
    if (first === undefined) {
      throw new Error('the demo fixtures are empty');
    }

    await expect(loadCreator(first.id, { connect })).resolves.toEqual({
      creator: first,
      source: 'demo',
    });
    await expect(loadCreator('nope', { connect })).resolves.toEqual({
      creator: null,
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

describe('loadUgc in live mode', () => {
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
      loadUgc({
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

  it('carries the injected clock through as `now` when the workspace has no brand yet', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const at = new Date('2026-10-01T12:00:00.000Z');
    const db = { select: () => ({ from: () => Promise.resolve([]) }) } as unknown as Db;

    const result = await loadUgc({
      demoMode: () => false,
      actorScope: () => Promise.resolve({ clerkOrgId: 'org-live', clerkUserId: null }),
      clock: () => at,
      connect: () => ({ db, close: () => Promise.resolve() }),
    });

    expect(result).toEqual({ creators: [], partnerships: [], now: at, source: 'database' });
  });
});
