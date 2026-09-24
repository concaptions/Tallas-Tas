import { demoPromotionRequests, demoReviewedPromotionRequests, type Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  loadPromotionRequest,
  loadPromotionRequests,
  loadPromotionRequestsByStatus,
  withAgencyScope,
} from './propagation-source';

/**
 * The demo-mode guarantee, proved rather than asserted (ticket criterion 9): with no Clerk key and a
 * `DATABASE_URL` set, the source answers from the fixtures and the connection factory is never
 * called. The factory is injected for exactly that reason — "no client was constructed" is not
 * observable otherwise.
 */
const connect = vi.fn<(databaseUrl: string) => never>(() => {
  throw new Error('the demo branch opened a database connection');
});

afterEach(() => {
  connect.mockClear();
  vi.unstubAllEnvs();
});

describe('loadPromotionRequests in demo mode', () => {
  it('returns the fixtures and constructs no database client, even with DATABASE_URL set', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const result = await loadPromotionRequests({ connect });

    expect(result.source).toBe('demo');
    expect(result.rows).toEqual(demoPromotionRequests);
    expect(connect).not.toHaveBeenCalled();
  });

  it('answers from the fixtures with no environment variables at all', async () => {
    await expect(loadPromotionRequests({ connect })).resolves.toMatchObject({ source: 'demo' });
  });

  it('is exactly the three pending requests, newest first (criteria 4 and 8)', async () => {
    const { rows } = await loadPromotionRequests({ connect });

    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.status === 'pending')).toBe(true);
    const requestedAt = rows.map((row) => row.requestedAt.getTime());
    expect([...requestedAt].sort((a, b) => b - a)).toEqual(requestedAt);
  });

  it('spans more than one brand and more than one table', async () => {
    const { rows } = await loadPromotionRequests({ connect });

    expect(new Set(rows.map((row) => row.brandId)).size).toBeGreaterThan(1);
    expect(new Set(rows.map((row) => row.tableName)).size).toBeGreaterThan(1);
  });

  it('carries the brand name on the row, so the Brand cell costs no second query', async () => {
    const { rows } = await loadPromotionRequests({ connect });

    expect(rows.every((row) => 'brandName' in row)).toBe(true);
    expect(connect).not.toHaveBeenCalled();
  });

  it('never shows a settled request in the queue', async () => {
    const { rows } = await loadPromotionRequests({ connect });
    const settled = demoReviewedPromotionRequests.map((row) => row.id);

    expect(rows.some((row) => settled.includes(row.id))).toBe(false);
  });
});

describe('loadPromotionRequest in demo mode', () => {
  it('finds one pending fixture by id and misses an unknown id, without a connection', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const [first] = demoPromotionRequests;
    if (first === undefined) {
      throw new Error('the demo promotion fixtures are empty');
    }

    await expect(loadPromotionRequest(first.id, { connect })).resolves.toEqual({
      request: first,
      source: 'demo',
    });
    await expect(loadPromotionRequest('nope', { connect })).resolves.toEqual({
      request: null,
      source: 'demo',
    });
    expect(connect).not.toHaveBeenCalled();
  });

  it('answers about an already-settled request rather than pretending it never existed', async () => {
    const [settled] = demoReviewedPromotionRequests;
    if (settled === undefined) {
      throw new Error('the reviewed promotion fixtures are empty');
    }

    await expect(loadPromotionRequest(settled.id, { connect })).resolves.toEqual({
      request: settled,
      source: 'demo',
    });
  });
});

describe('the write path in demo mode', () => {
  it('refuses a write outright, before any connection', async () => {
    await expect(withAgencyScope(() => Promise.resolve('written'), { connect })).rejects.toThrow(
      /Demo mode/u,
    );
    expect(connect).not.toHaveBeenCalled();
  });
});

describe('loadPromotionRequests in live mode', () => {
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
      loadPromotionRequests({
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

  it('yields an empty table, and never an unscoped read, when there is no agency row', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const close = vi.fn(() => Promise.resolve());
    const db = { select: () => ({ from: () => Promise.resolve([]) }) } as unknown as Db;

    await expect(
      loadPromotionRequests({
        demoMode: () => false,
        actorScope: () => Promise.resolve({ clerkOrgId: 'org-live', clerkUserId: null }),
        connect: () => ({ db, close }),
      }),
    ).resolves.toEqual({ rows: [], source: 'database' });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('runs the write callback under the resolved agency id and closes the pool', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const close = vi.fn(() => Promise.resolve());
    const db = {
      select: () => ({
        from: () => Promise.resolve([{ id: 'agency-1', clerkOrgId: 'org-live', deletedAt: null }]),
      }),
    } as unknown as Db;
    const seen: string[] = [];

    await expect(
      withAgencyScope(
        (_db, agencyId) => {
          seen.push(agencyId);
          return Promise.resolve('written');
        },
        {
          demoMode: () => false,
          actorScope: () => Promise.resolve({ clerkOrgId: 'org-live', clerkUserId: null }),
          connect: () => ({ db, close }),
        },
      ),
    ).resolves.toBe('written');

    expect(seen).toEqual(['agency-1']);
    expect(close).toHaveBeenCalledTimes(1);
  });
});

/**
 * The read behind the page's `?status=` filter. Same guarantee as every branch above — the fixtures
 * are narrowed here, in the source, and no client is constructed to do it.
 */
describe('loadPromotionRequestsByStatus in demo mode', () => {
  it('is the pending queue when asked for pending, and nothing else', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const { rows, source } = await loadPromotionRequestsByStatus('pending', { connect });

    expect(source).toBe('demo');
    expect(rows).toEqual(demoPromotionRequests);
    expect(connect).not.toHaveBeenCalled();
  });

  it('answers the two settled states from the reviewed fixtures', async () => {
    const approved = await loadPromotionRequestsByStatus('approved', { connect });
    const rejected = await loadPromotionRequestsByStatus('rejected', { connect });

    expect(approved.rows.map((row) => row.status)).toEqual(['approved']);
    expect(rejected.rows.map((row) => row.status)).toEqual(['rejected']);
    expect(connect).not.toHaveBeenCalled();
  });

  it('returns every request, newest first, when the state is left open', async () => {
    const { rows } = await loadPromotionRequestsByStatus(undefined, { connect });

    expect(rows).toHaveLength(demoPromotionRequests.length + demoReviewedPromotionRequests.length);
    const requestedAt = rows.map((row) => row.requestedAt.getTime());
    expect([...requestedAt].sort((a, b) => b - a)).toEqual(requestedAt);
  });

  it('never mutates the fixture arrays it sorts', async () => {
    const before = [...demoPromotionRequests];

    await loadPromotionRequestsByStatus(undefined, { connect });

    expect(demoPromotionRequests).toEqual(before);
  });

  it('shares one code path with loadPromotionRequests, so the queue cannot drift', async () => {
    const queue = await loadPromotionRequests({ connect });
    const pending = await loadPromotionRequestsByStatus('pending', { connect });

    expect(queue.rows).toEqual(pending.rows);
  });
});
