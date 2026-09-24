import { demoBriefs, demoCopy, type Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  loadCopy,
  loadCopyById,
  loadCopyWorkspace,
  loadCreativeOptions,
  withBrandScope,
} from './copy-source';

/**
 * The demo-mode guarantee, proved rather than asserted: with no Clerk key and a `DATABASE_URL` set,
 * the source answers from the fixtures and the connection factory is never called. The factory is
 * injected for exactly that reason — "no client was constructed" is not observable otherwise.
 */
const connect = vi.fn<(databaseUrl: string) => never>(() => {
  throw new Error('the demo branch opened a database connection');
});

const DATABASE_URL = 'postgres://user:pw@example.test/db';

afterEach(() => {
  connect.mockClear();
  vi.unstubAllEnvs();
});

describe('loadCopy in demo mode', () => {
  it('returns the four fixtures and constructs no database client, even with DATABASE_URL set', async () => {
    vi.stubEnv('DATABASE_URL', DATABASE_URL);

    const result = await loadCopy({ connect });

    expect(result.source).toBe('demo');
    expect(result.rows).toEqual(demoCopy);
    expect(result.rows).toHaveLength(4);
    expect(connect).not.toHaveBeenCalled();
  });

  it('answers from the fixtures with no environment variables at all', async () => {
    await expect(loadCopy({ connect })).resolves.toMatchObject({ source: 'demo' });
    expect(connect).not.toHaveBeenCalled();
  });

  it('hands the rows on newest edit first, sorting nothing itself', async () => {
    const { rows } = await loadCopy({ connect });
    const updated = rows.map((row) => row.updatedAt.getTime());

    expect(updated).toEqual([...updated].sort((a, b) => b - a));
  });

  it('leaves the unattached row creativeName null and names the other three', async () => {
    const { rows } = await loadCopy({ connect });

    expect(rows.filter((row) => row.creativeName === null)).toHaveLength(1);
    expect(rows.filter((row) => row.creativeName !== null)).toHaveLength(3);
    for (const row of rows) {
      expect(row.creativeName === null).toBe(row.creativeBriefId === null);
    }
  });
});

describe('loadCreativeOptions in demo mode', () => {
  it('offers every demo brief by its auto-generated name, without a connection', async () => {
    vi.stubEnv('DATABASE_URL', DATABASE_URL);

    const options = await loadCreativeOptions({ connect });

    expect(options).toEqual(demoBriefs.map((brief) => ({ id: brief.id, name: brief.name })));
    expect(options.every((option) => option.name !== '')).toBe(true);
    expect(connect).not.toHaveBeenCalled();
  });

  it('carries no "No creative" sentinel — the absent choice is not a brief', async () => {
    const options = await loadCreativeOptions({ connect });

    expect(options.some((option) => option.id === '')).toBe(false);
  });
});

describe('loadCopyWorkspace in demo mode', () => {
  it('returns both halves of the page from the fixtures, with no client constructed', async () => {
    vi.stubEnv('DATABASE_URL', DATABASE_URL);

    const result = await loadCopyWorkspace({ connect });

    expect(result.source).toBe('demo');
    expect(result.rows).toEqual(demoCopy);
    expect(result.creatives).toHaveLength(demoBriefs.length);
    expect(connect).not.toHaveBeenCalled();
  });

  it('can name every attached row out of its own creative options', async () => {
    const { rows, creatives } = await loadCopyWorkspace({ connect });
    const names = new Map(creatives.map((option) => [option.id, option.name]));

    for (const row of rows) {
      if (row.creativeBriefId !== null) {
        expect(names.get(row.creativeBriefId)).toBe(row.creativeName);
      }
    }
  });
});

describe('loadCopyById in demo mode', () => {
  it('finds one fixture by id and misses an unknown id, without a connection', async () => {
    vi.stubEnv('DATABASE_URL', DATABASE_URL);
    const [first] = demoCopy;
    if (first === undefined) {
      throw new Error('the demo fixtures are empty');
    }

    await expect(loadCopyById(first.id, { connect })).resolves.toEqual({
      copy: first,
      source: 'demo',
    });
    await expect(loadCopyById('nope', { connect })).resolves.toEqual({
      copy: null,
      source: 'demo',
    });
    expect(connect).not.toHaveBeenCalled();
  });
});

describe('withBrandScope in demo mode', () => {
  it('refuses a write outright, before any connection', async () => {
    vi.stubEnv('DATABASE_URL', DATABASE_URL);

    await expect(withBrandScope(() => Promise.resolve('written'), { connect })).rejects.toThrow(
      /Demo mode/u,
    );
    expect(connect).not.toHaveBeenCalled();
  });
});

describe('loadCopy in live mode', () => {
  it('opens a connection from DATABASE_URL and closes it even when the query throws', async () => {
    vi.stubEnv('DATABASE_URL', DATABASE_URL);
    const close = vi.fn(() => Promise.resolve());
    // A handle that fails on first use: enough to prove the `finally` closes the pool.
    const db = {
      select: () => {
        throw new Error('boom');
      },
    } as unknown as Db;
    const openings: string[] = [];

    await expect(
      loadCopy({
        demoMode: () => false,
        actorScope: () => Promise.resolve({ clerkOrgId: 'org-live', clerkUserId: null }),
        connect: (url) => {
          openings.push(url);
          return { db, close };
        },
      }),
    ).rejects.toThrow('boom');

    expect(openings).toEqual([DATABASE_URL]);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('opens exactly one connection for the whole workspace', async () => {
    vi.stubEnv('DATABASE_URL', DATABASE_URL);
    const close = vi.fn(() => Promise.resolve());
    const db = {
      select: () => {
        throw new Error('boom');
      },
    } as unknown as Db;
    const connectSpy = vi.fn(() => ({ db, close }));

    await expect(
      loadCopyWorkspace({
        demoMode: () => false,
        actorScope: () => Promise.resolve({ clerkOrgId: 'org-live', clerkUserId: null }),
        connect: connectSpy,
      }),
    ).rejects.toThrow('boom');

    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
