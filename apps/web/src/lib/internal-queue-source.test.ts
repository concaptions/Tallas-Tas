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
  it('names the signed-in actor as the viewer and offers every brand of the scope', async () => {
    const rows = demoBriefs.map(toBriefRow);

    const result = await loadInternalQueue({
      demoMode: () => false,
      briefs: () => Promise.resolve({ rows, source: 'database' as const }),
      actor: () => Promise.resolve({ fullName: 'Imogen Bardsley' }),
      brands: () =>
        Promise.resolve([
          { id: DEMO_BRAND_ID, name: 'Live Brand', status: 'active', isTemplate: false },
          { id: 'gratsi', name: 'Gratsi', status: 'active', isTemplate: false },
        ]),
    });

    expect(result.source).toBe('database');
    expect(result.viewer).toBe('Imogen Bardsley');
    // Every brand of the agency, the scoped rows counted under the working one (smoke test
    // 2026-10-10: deriving the options from the rows always found one brand).
    expect(result.brands).toEqual([
      { id: DEMO_BRAND_ID, name: 'Live Brand', count: 7 },
      { id: 'gratsi', name: 'Gratsi', count: 0 },
    ]);
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

  const niagara = { id: DEMO_BRAND_ID, name: 'Niagara', status: 'active', isTemplate: false };
  const gratsi = { id: 'gratsi', name: 'Gratsi', status: 'active', isTemplate: false };
  const template = { id: 'tpl', name: 'Creative Hub Template', status: 'active', isTemplate: true };

  it('offers every brand in scope with a zero count for an empty board, never the template', () => {
    expect(queueBrandOptions([], [niagara, gratsi, template])).toEqual([
      { id: DEMO_BRAND_ID, name: 'Niagara', count: 0 },
      { id: 'gratsi', name: 'Gratsi', count: 0 },
    ]);
  });

  it('counts the rows under their brand and keeps scope order', () => {
    const options = queueBrandOptions(
      [row('gratsi'), row(DEMO_BRAND_ID), row('gratsi')],
      [niagara, gratsi],
    );

    expect(options).toEqual([
      { id: DEMO_BRAND_ID, name: 'Niagara', count: 1 },
      { id: 'gratsi', name: 'Gratsi', count: 2 },
    ]);
  });

  it('keeps a row whose brand is outside the scope reachable, by id, after the scoped ones', () => {
    const options = queueBrandOptions([row(DEMO_BRAND_ID), row('other')], [niagara]);

    expect(options).toEqual([
      { id: DEMO_BRAND_ID, name: 'Niagara', count: 1 },
      { id: 'other', name: 'other', count: 1 },
    ]);
  });
});
