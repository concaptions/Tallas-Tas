import { demoBriefs } from '@tas/db';
import { isClientTrackOpen } from '@tas/domain/state';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { toBriefRow } from './briefs-source';
import { loadClientQueue } from './client-queue-source';

/**
 * The demo-mode guarantee, proved rather than asserted (ticket `client-queue` criterion 6): with no
 * Clerk key and a `DATABASE_URL` set, the board answers from the fixtures and the connection factory
 * is never called. The factory is injected for exactly that reason — "no client was constructed" is
 * not observable otherwise — and it is handed straight down to `loadBriefs`, so the spy watches the
 * real read path.
 */
const connect = vi.fn<(databaseUrl: string) => never>(() => {
  throw new Error('the demo branch opened a database connection');
});

/** The three fixtures PRD §9 lets a client see, in loader order. Pinned so a fixture edit fails here. */
const ELIGIBLE_IDS = [
  '77777777-7777-4777-8777-000000000001',
  '77777777-7777-4777-8777-000000000004',
  '77777777-7777-4777-8777-000000000005',
];

/** Internally Approved AND already finished on the client track: on nobody's approval board. */
const LAUNCHED_ID = '77777777-7777-4777-8777-000000000007';

afterEach(() => {
  connect.mockClear();
  vi.unstubAllEnvs();
});

describe('loadClientQueue in demo mode', () => {
  it('answers from the fixtures and constructs no database client, even with DATABASE_URL set', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const result = await loadClientQueue({ connect });

    expect(result.source).toBe('demo');
    expect(connect).not.toHaveBeenCalled();
    expect(result.rows.map((row) => row.id)).toEqual(ELIGIBLE_IDS);
  });

  it('counts every brief it loaded and every one internal sign-off is holding back', async () => {
    const result = await loadClientQueue({ connect });

    expect(result.total).toBe(demoBriefs.length);
    expect(result.rows).toHaveLength(ELIGIBLE_IDS.length);
    expect(result.withheld).toBe(demoBriefs.length - ELIGIBLE_IDS.length);
  });

  it('withholds every pre-Approved brief, so an ineligible row never leaves the loader', async () => {
    const { rows } = await loadClientQueue({ connect });

    expect(rows.every((row) => isClientTrackOpen(row.internalStatus))).toBe(true);
  });

  it('withholds the launched brief: its client track is finished, not waiting on an answer', async () => {
    const { rows } = await loadClientQueue({ connect });

    expect(rows.some((row) => row.id === LAUNCHED_ID)).toBe(false);
    expect(rows.some((row) => row.clientStatus === 'launched')).toBe(false);
  });

  it('keeps the loader order and sorts nothing of its own', async () => {
    const { rows } = await loadClientQueue({ connect });
    const expected = demoBriefs
      .map(toBriefRow)
      .filter((row) => isClientTrackOpen(row.internalStatus) && row.clientStatus !== 'launched');

    expect(rows).toEqual(expected);
  });
});

describe('loadClientQueue in live mode', () => {
  it('reports the database as the source and gates those rows by the same rule', async () => {
    const rows = demoBriefs.map(toBriefRow);

    const result = await loadClientQueue({
      demoMode: () => false,
      briefs: () => Promise.resolve({ rows, source: 'database' as const }),
    });

    expect(result.source).toBe('database');
    expect(result.rows.map((row) => row.id)).toEqual(ELIGIBLE_IDS);
    expect(result.total).toBe(rows.length);
  });

  it('is an empty board, not a crash, when the workspace has no briefs yet', async () => {
    const result = await loadClientQueue({
      demoMode: () => false,
      briefs: () => Promise.resolve({ rows: [], source: 'database' as const }),
    });

    expect(result).toEqual({ rows: [], source: 'database', total: 0, withheld: 0 });
  });
});
