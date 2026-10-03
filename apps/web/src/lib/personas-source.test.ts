import { agencies, brands, demoPersonas, type Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadPersona, loadPersonaColumns, loadPersonas, withBrandScope } from './personas-source';

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

describe('loadPersonas in demo mode', () => {
  it('returns the fixtures and constructs no database client, even with DATABASE_URL set', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const result = await loadPersonas({ connect });

    expect(result.source).toBe('demo');
    expect(result.rows).toEqual(demoPersonas);
    expect(result.rows).toHaveLength(3);
    expect(connect).not.toHaveBeenCalled();
  });

  it('answers from the fixtures with no environment variables at all', async () => {
    await expect(loadPersonas({ connect })).resolves.toMatchObject({ source: 'demo' });
  });

  it('finds one fixture by id and misses an unknown id, without a connection', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const [first] = demoPersonas;
    if (first === undefined) {
      throw new Error('the demo fixtures are empty');
    }

    await expect(loadPersona(first.id, { connect })).resolves.toEqual({
      persona: first,
      source: 'demo',
    });
    await expect(loadPersona('nope', { connect })).resolves.toEqual({
      persona: null,
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

describe('loadPersonaColumns in demo mode', () => {
  it('serves the parent template\u2019s master set, from the seed, with no connection', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const { columns, source } = await loadPersonaColumns({ connect });

    expect(source).toBe('demo');
    expect(connect).not.toHaveBeenCalled();
    // The demo fixtures are Niagara Sleep Solutions, a child with no `column_definitions` rows of
    // its own, and a child that departs nowhere resolves to the parent verbatim — so the fallback
    // is the parent's fifteen fields, in the order `display_order` seeds from.
    expect(columns.map((column) => column.displayLabel)).toEqual([
      'Persona Name',
      'A Day in the Life',
      'Demographic',
      'Psychographic',
      'Core Desires (Cashvertising)',
      'Emotional Triggers (Cashvertising)',
      'Pain Points (Cashvertising)',
      'Success Factors (Buyer Personas)',
      'Perceived Barriers (Buyer Personas)',
      'Stage of Market Awareness (Breakthrough Advertising)',
      'Buying Triggers (Breakthrough Advertising)',
      'Problem/Challenge (StoryBrand)',
      'Success/Transformation (StoryBrand)',
      'Trigger Words (Mindstates)',
      'Angles',
    ]);
  });

  it('carries the Postgres column as the key, so a label is never a rename', async () => {
    const { columns } = await loadPersonaColumns({ connect });

    expect(columns.map((column) => column.columnKey)).toContain('core_desires');
    // Gratsi\u2019s own child-added column is not the parent\u2019s, so it is not in the fallback.
    expect(columns.map((column) => column.columnKey)).not.toContain('passion');
  });

  it('does not flag the demo set as unconfigured: there it is the designed answer', async () => {
    await expect(loadPersonaColumns({ connect })).resolves.toMatchObject({ unconfigured: false });
  });
});

/**
 * A handle that answers `select().from(table)` from fixed rows, enough for the ONE brand resolver in
 * `data-source.ts` to resolve a brand \u2014 which the live branch must do before it can ask for any
 * columns. The same shape `data-source.test.ts` uses: no SQL, no Postgres.
 */
function brandResolvingDb(): Db {
  const rows = new Map<unknown, readonly unknown[]>([
    [agencies, [{ id: 'agency-a', clerkOrgId: 'org-live', deletedAt: null }]],
    [
      brands,
      [
        {
          id: 'brand-a',
          name: 'Brand A',
          status: 'active',
          isTemplate: false,
          agencyId: 'agency-a',
          deletedAt: null,
        },
      ],
    ],
  ]);
  return {
    select: () => ({ from: (table: unknown) => Promise.resolve([...(rows.get(table) ?? [])]) }),
  } as unknown as Db;
}

/**
 * THE case the page must never pass on. `resolveColumns` returns `[]` for a brand with no
 * `column_definitions` rows of its own and no seeded parent \u2014 before `0045_column-inheritance.sql`
 * and `seedColumnDefinitions` have run, that is EVERY brand \u2014 and `[]` does not degrade the page,
 * it erases it: no `th`, no cells, an empty Fields popover, a name-only panel. The brand's stored
 * prose would be neither shown nor editable, with no notice.
 */
describe('loadPersonaColumns when the brand resolves nothing', () => {
  const live = {
    demoMode: () => false,
    actorScope: () => Promise.resolve({ clerkOrgId: 'org-live', clerkUserId: null }),
  };

  it('serves the parent master set and flags it, rather than passing an empty set to the page', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const close = vi.fn(() => Promise.resolve());

    const result = await loadPersonaColumns({
      ...live,
      connect: () => ({ db: brandResolvingDb(), close }),
      resolveColumns: () => Promise.resolve([]),
    });

    expect(result.unconfigured).toBe(true);
    expect(result.source).toBe('database');
    expect(result.columns).toHaveLength(15);
    expect(result.columns.map((column) => column.columnKey)).toContain('core_desires');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('keeps what the resolver DID return, unflagged, and never substitutes the fallback', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const only = {
      columnKey: 'core_desires',
      displayLabel: 'Drivers for this persona',
      displayOrder: 4,
      fieldType: null,
      source: 'parent' as const,
      isDetached: true,
      inheritedFrom: null,
    };

    const result = await loadPersonaColumns({
      ...live,
      connect: () => ({ db: brandResolvingDb(), close: () => Promise.resolve() }),
      resolveColumns: () => Promise.resolve([only]),
    });

    expect(result.unconfigured).toBe(false);
    expect(result.columns).toEqual([only]);
  });

  it('falls back and flags when the workspace has no brand at all', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const db = { select: () => ({ from: () => Promise.resolve([]) }) } as unknown as Db;

    await expect(
      loadPersonaColumns({ ...live, connect: () => ({ db, close: () => Promise.resolve() }) }),
    ).resolves.toMatchObject({ unconfigured: true, source: 'database' });
  });
});

describe('loadPersonas in live mode', () => {
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
      loadPersonas({
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
});
