import { demoAngles, type Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadAngle, loadAngles, withBrandScope } from './angles-source';

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

describe('loadAngles in demo mode', () => {
  it('returns the fixtures and constructs no database client, even with DATABASE_URL set', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const result = await loadAngles({ connect });

    expect(result.source).toBe('demo');
    expect(result.rows).toEqual(demoAngles);
    expect(result.rows).toHaveLength(5);
    expect(connect).not.toHaveBeenCalled();
  });

  it('answers from the fixtures with no environment variables at all', async () => {
    await expect(loadAngles({ connect })).resolves.toMatchObject({ source: 'demo' });
  });

  it('hands the rows over newest edit first, so the page never sorts', async () => {
    const { rows } = await loadAngles({ connect });

    const updated = rows.map((row) => row.updatedAt.getTime());
    expect(updated).toEqual([...updated].sort((a, b) => b - a));
  });

  it('spreads the five angles across the three personas, one persona carrying two', async () => {
    const { rows } = await loadAngles({ connect });

    const perPersona = new Map<string, number>();
    for (const row of rows) {
      const key = row.personaId ?? 'none';
      perPersona.set(key, (perPersona.get(key) ?? 0) + 1);
    }
    expect(perPersona.size).toBe(3);
    expect([...perPersona.values()].sort()).toEqual([1, 2, 2]);
  });

  it('carries the three array columns as arrays on every row, never null', async () => {
    const { rows } = await loadAngles({ connect });

    for (const row of rows) {
      expect(Array.isArray(row.formats)).toBe(true);
      expect(Array.isArray(row.type)).toBe(true);
      expect(Array.isArray(row.adInspoLinks)).toBe(true);
    }
    expect(rows.every((row) => row.formats.length > 0)).toBe(true);
  });

  it('resolves both link names, so no cell ever has to render a raw id', async () => {
    const { rows } = await loadAngles({ connect });

    for (const row of rows) {
      expect(row.personaName === null || row.personaName.length > 0).toBe(true);
      expect(row.productName === null || row.productName.length > 0).toBe(true);
    }
  });

  it('finds one fixture by id and misses an unknown id, without a connection', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const [first] = demoAngles;
    if (first === undefined) {
      throw new Error('the demo fixtures are empty');
    }

    await expect(loadAngle(first.id, { connect })).resolves.toEqual({
      angle: first,
      source: 'demo',
    });
    await expect(loadAngle('nope', { connect })).resolves.toEqual({
      angle: null,
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

describe('loadAngles in live mode', () => {
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
      loadAngles({
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

  it('closes the pool after a single-angle read too', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const close = vi.fn(() => Promise.resolve());
    const db = {
      select: () => {
        throw new Error('boom');
      },
    } as unknown as Db;

    await expect(
      loadAngle('any', { demoMode: () => false, connect: () => ({ db, close }) }),
    ).rejects.toThrow('boom');

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('returns no rows, and never queries angles, when the workspace has no brand yet', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const close = vi.fn(() => Promise.resolve());
    const db = { select: () => ({ from: () => Promise.resolve([]) }) } as unknown as Db;

    await expect(
      loadAngles({ demoMode: () => false, connect: () => ({ db, close }) }),
    ).resolves.toEqual({ rows: [], source: 'database' });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('never runs the write when the workspace has no brand yet, and still closes the pool', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const close = vi.fn(() => Promise.resolve());
    const db = { select: () => ({ from: () => Promise.resolve([]) }) } as unknown as Db;
    const run = vi.fn(() => Promise.resolve('written'));

    await expect(
      withBrandScope(run, { demoMode: () => false, connect: () => ({ db, close }) }),
    ).resolves.toBeNull();
    expect(run).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
