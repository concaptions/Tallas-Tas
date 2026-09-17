import { demoTeam, type Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadTeam, withAgencyScope } from './team-source';

/**
 * The demo-mode guarantee, proved rather than asserted (ticket `team.md` criterion 12): with no
 * Clerk key and a `DATABASE_URL` set, the source answers from the fixtures and the connection
 * factory is never called. The factory is injected for exactly that reason — "no client was
 * constructed" is not observable otherwise.
 */
const connect = vi.fn<(databaseUrl: string) => never>(() => {
  throw new Error('the demo branch opened a database connection');
});

afterEach(() => {
  connect.mockClear();
  vi.unstubAllEnvs();
});

describe('loadTeam in demo mode', () => {
  it('returns the fixtures and constructs no database client, even with DATABASE_URL set', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const result = await loadTeam({ connect });

    expect(result.source).toBe('demo');
    expect(result.rows).toEqual(demoTeam);
    expect(result.rows).toHaveLength(5);
    expect(connect).not.toHaveBeenCalled();
  });

  it('answers from the fixtures with no environment variables at all', async () => {
    await expect(loadTeam({ connect })).resolves.toMatchObject({ source: 'demo' });
    expect(connect).not.toHaveBeenCalled();
  });

  it('hands the page rows it never has to sort or fill in', async () => {
    const { rows } = await loadTeam({ connect });

    expect(rows.map((row) => row.fullName)).toEqual(
      [...rows.map((row) => row.fullName)].sort((a, b) => a.localeCompare(b)),
    );
    for (const row of rows) {
      expect(row.roles.length).toBeGreaterThan(0);
      expect(row.role).toBe(row.roles[0]);
      expect(row.brandNames).toEqual([...row.brandNames].sort((a, b) => a.localeCompare(b)));
    }
    // Criterion 4: an admin is agency-wide and holds no assignments — the "All brands" cell.
    const admin = rows.find((row) => row.role === 'admin');
    expect(admin?.brandNames).toEqual([]);
  });

  it('refuses a write outright', async () => {
    await expect(withAgencyScope(() => Promise.resolve('written'), { connect })).rejects.toThrow(
      /Demo mode/u,
    );
    expect(connect).not.toHaveBeenCalled();
  });
});

describe('loadTeam in live mode', () => {
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
      loadTeam({
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

  it('returns no rows, and never reads agency-wide, when the workspace has no agency', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const close = vi.fn(() => Promise.resolve());
    const db = { select: () => ({ from: () => Promise.resolve([]) }) } as unknown as Db;

    await expect(
      loadTeam({ demoMode: () => false, connect: () => ({ db, close }) }),
    ).resolves.toEqual({ rows: [], source: 'database' });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('gives the write path the agency id and closes the pool', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const close = vi.fn(() => Promise.resolve());
    const db = {
      select: () => ({
        from: () => Promise.resolve([{ id: 'agency-1', deletedAt: null }]),
      }),
    } as unknown as Db;

    await expect(
      withAgencyScope((_db, agencyId) => Promise.resolve(agencyId), {
        demoMode: () => false,
        connect: () => ({ db, close }),
      }),
    ).resolves.toBe('agency-1');
    expect(close).toHaveBeenCalledTimes(1);
  });
});
