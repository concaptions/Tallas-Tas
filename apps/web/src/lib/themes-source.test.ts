import { demoThemes, type Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadTheme, loadThemes, withGlobalScope } from './themes-source';

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

describe('loadThemes in demo mode', () => {
  it('returns the fixtures and constructs no database client, even with DATABASE_URL set', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const result = await loadThemes({ connect });

    expect(result.source).toBe('demo');
    expect(result.rows).toEqual(demoThemes);
    expect(result.rows).toHaveLength(6);
    expect(connect).not.toHaveBeenCalled();
  });

  it('answers from the fixtures with no environment variables at all', async () => {
    await expect(loadThemes({ connect })).resolves.toMatchObject({ source: 'demo' });
  });

  it('carries the brand count computed in the data layer, not a component', async () => {
    const { rows } = await loadThemes({ connect });

    expect(rows.every((row) => typeof row.usedByBrandCount === 'number')).toBe(true);
    // A global library with no concepts on it is still a library: count 0 is a valid row.
    expect(rows.some((row) => row.usedByBrandCount === 0)).toBe(true);
    expect(connect).not.toHaveBeenCalled();
  });

  it('finds one fixture by id and misses an unknown id, without a connection', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const [first] = demoThemes;
    if (first === undefined) {
      throw new Error('the demo fixtures are empty');
    }

    await expect(loadTheme(first.id, { connect })).resolves.toEqual({
      theme: first,
      source: 'demo',
    });
    await expect(loadTheme('nope', { connect })).resolves.toEqual({
      theme: null,
      source: 'demo',
    });
    expect(connect).not.toHaveBeenCalled();
  });

  it('refuses a write outright', async () => {
    await expect(withGlobalScope(() => Promise.resolve('written'), { connect })).rejects.toThrow(
      /Demo mode/u,
    );
    expect(connect).not.toHaveBeenCalled();
  });
});

describe('loadThemes in live mode', () => {
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
      loadThemes({
        demoMode: () => false,
        connect: (url) => {
          openings.push(url);
          return { db, close };
        },
      }),
    ).rejects.toThrow('boom');

    expect(openings).toEqual(['postgres://user:pw@example.test/db']);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('hands the write path the database and nothing else — there is no brand to scope to', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const close = vi.fn(() => Promise.resolve());
    const db = {} as Db;
    const seen: unknown[][] = [];

    const written = await withGlobalScope(
      (...args) => {
        seen.push(args);
        return Promise.resolve('written');
      },
      { demoMode: () => false, connect: () => ({ db, close }) },
    );

    expect(written).toBe('written');
    expect(seen).toEqual([[db]]);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
