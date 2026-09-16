import { demoProducts, type Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadProduct, loadProducts, withBrandScope } from './products-source';

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

describe('loadProducts in demo mode', () => {
  it('returns the fixtures and constructs no database client, even with DATABASE_URL set', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const result = await loadProducts({ connect });

    expect(result.source).toBe('demo');
    expect(result.rows).toEqual(demoProducts);
    expect(result.rows.length).toBeGreaterThanOrEqual(3);
    expect(connect).not.toHaveBeenCalled();
  });

  it('answers from the fixtures with no environment variables at all', async () => {
    await expect(loadProducts({ connect })).resolves.toMatchObject({ source: 'demo' });
  });

  it('hands the rows over newest edit first, so the page never sorts', async () => {
    const { rows } = await loadProducts({ connect });

    const updated = rows.map((row) => row.updatedAt.getTime());
    expect(updated).toEqual([...updated].sort((a, b) => b - a));
  });

  it('carries a numeric conceptCount on every row, zero included', async () => {
    const { rows } = await loadProducts({ connect });

    for (const row of rows) {
      expect(typeof row.conceptCount).toBe('number');
    }
    expect(rows.some((row) => row.conceptCount === 0)).toBe(true);
  });

  it('keeps the optional collection link nullable rather than empty', async () => {
    const { rows } = await loadProducts({ connect });

    expect(rows.some((row) => row.collectionLink === null)).toBe(true);
    expect(rows.every((row) => row.collectionLink !== '')).toBe(true);
  });

  it('finds one fixture by id and misses an unknown id, without a connection', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const [first] = demoProducts;
    if (first === undefined) {
      throw new Error('the demo fixtures are empty');
    }

    await expect(loadProduct(first.id, { connect })).resolves.toEqual({
      product: first,
      source: 'demo',
    });
    await expect(loadProduct('nope', { connect })).resolves.toEqual({
      product: null,
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

describe('loadProducts in live mode', () => {
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
      loadProducts({
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

  it('closes the pool after a single-product read too', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const close = vi.fn(() => Promise.resolve());
    const db = {
      select: () => {
        throw new Error('boom');
      },
    } as unknown as Db;

    await expect(
      loadProduct('any', { demoMode: () => false, connect: () => ({ db, close }) }),
    ).rejects.toThrow('boom');

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('returns no rows, and never queries products, when the workspace has no brand yet', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const close = vi.fn(() => Promise.resolve());
    const db = { select: () => ({ from: () => Promise.resolve([]) }) } as unknown as Db;

    await expect(
      loadProducts({ demoMode: () => false, connect: () => ({ db, close }) }),
    ).resolves.toEqual({ rows: [], source: 'database' });
    expect(close).toHaveBeenCalledTimes(1);
  });
});
