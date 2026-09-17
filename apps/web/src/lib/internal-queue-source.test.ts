import { DEMO_BRAND_ID, demoBriefs } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ currentUser: vi.fn() }));

// `currentActor` imports Clerk at module load; the demo branch must never reach it, and the live
// branch under test is given its own `actor` seam, so the real module is never wanted here.
vi.mock('@clerk/nextjs/server', () => ({ currentUser: mocks.currentUser }));

import { toBriefRow, type BriefRow } from './briefs-source';
import { DEMO_QUEUE_ASSIGNEE } from './demo-mode';
import { loadInternalQueue, queueBrandOptions } from './internal-queue-source';

/**
 * The demo-mode guarantee, proved rather than asserted: with no Clerk key and a `DATABASE_URL` set,
 * the queue answers from the fixtures and the connection factory is never called. The factory is
 * injected for exactly that reason — "no client was constructed" is not observable otherwise — and
 * it is handed straight down to `loadBriefs`, so the spy watches the real read path.
 */
const connect = vi.fn<(databaseUrl: string) => never>(() => {
  throw new Error('the demo branch opened a database connection');
});

afterEach(() => {
  connect.mockClear();
  mocks.currentUser.mockClear();
  vi.unstubAllEnvs();
});

describe('loadInternalQueue in demo mode', () => {
  it('returns the seven fixtures and constructs no database client, even with DATABASE_URL set', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const result = await loadInternalQueue({ connect });

    expect(result.source).toBe('demo');
    expect(result.rows).toEqual(demoBriefs.map(toBriefRow));
    expect(result.rows).toHaveLength(7);
    expect(connect).not.toHaveBeenCalled();
  });

  it('asks Clerk nothing: there is no session to ask about', async () => {
    await loadInternalQueue({ connect });

    expect(mocks.currentUser).not.toHaveBeenCalled();
  });

  it('keeps the rows in the loader order, sorting and filtering nothing', async () => {
    const { rows } = await loadInternalQueue({ connect });

    expect(rows.map((row) => row.id)).toEqual(demoBriefs.map((row) => row.id));
  });

  it('resolves the viewer to a seeded assignee, so "Mine" is never an empty board', async () => {
    const { rows, viewer } = await loadInternalQueue({ connect });

    expect(viewer).toBe(DEMO_QUEUE_ASSIGNEE);
    const mine = rows.filter((row) => row.assignee === viewer);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.length).toBeLessThan(rows.length);
  });

  it('offers exactly the one seeded brand, labelled and counted from the rows', async () => {
    const { brands } = await loadInternalQueue({ connect });

    expect(brands).toEqual([{ id: DEMO_BRAND_ID, name: 'Niagara Sleep Solutions', count: 7 }]);
  });
});

describe('loadInternalQueue in live mode', () => {
  it('names the signed-in actor as the viewer and labels the brand from currentBrand()', async () => {
    const rows = demoBriefs.map(toBriefRow);

    const result = await loadInternalQueue({
      demoMode: () => false,
      briefs: () => Promise.resolve({ rows, source: 'database' as const }),
      actor: () => Promise.resolve({ fullName: 'Imogen Bardsley' }),
      brand: () => Promise.resolve({ id: DEMO_BRAND_ID, name: 'Live Brand', status: 'active' }),
    });

    expect(result.source).toBe('database');
    expect(result.viewer).toBe('Imogen Bardsley');
    expect(result.brands).toEqual([{ id: DEMO_BRAND_ID, name: 'Live Brand', count: 7 }]);
  });
});

describe('queueBrandOptions', () => {
  const row = (brandId: string): BriefRow => ({ ...toBriefRow(first()), brandId });

  function first(): (typeof demoBriefs)[number] {
    const [row] = demoBriefs;
    if (row === undefined) {
      throw new Error('the demo fixtures are empty');
    }
    return row;
  }

  it('is empty for an empty board rather than offering a brand with nothing behind it', () => {
    expect(queueBrandOptions([], { id: DEMO_BRAND_ID, name: 'Niagara', status: 'active' })).toEqual(
      [],
    );
  });

  it('counts each brand and keeps first-seen order', () => {
    const options = queueBrandOptions([row('b-2'), row('b-1'), row('b-2')], null);

    expect(options).toEqual([
      { id: 'b-2', name: 'b-2', count: 2 },
      { id: 'b-1', name: 'b-1', count: 1 },
    ]);
  });

  it('labels only the working brand by name and keeps any other id reachable', () => {
    const options = queueBrandOptions([row(DEMO_BRAND_ID), row('other')], {
      id: DEMO_BRAND_ID,
      name: 'Niagara Sleep Solutions',
      status: 'active',
    });

    expect(options).toEqual([
      { id: DEMO_BRAND_ID, name: 'Niagara Sleep Solutions', count: 1 },
      { id: 'other', name: 'other', count: 1 },
    ]);
  });
});
