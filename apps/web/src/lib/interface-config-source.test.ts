import { demoInterfaceConfig, type Db, type InterfacePageRow } from '@tas/db';
import { defaultInterfaceConfig, type InterfacePageConfig } from '@tas/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadInterfaceConfig, loadInterfacePage, withBrandScope } from './interface-config-source';

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

describe('loadInterfaceConfig in demo mode', () => {
  it('returns the fixtures and constructs no database client, even with DATABASE_URL set', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const result = await loadInterfaceConfig({ connect });

    expect(result.source).toBe('demo');
    expect(result.rows).toEqual(demoInterfaceConfig);
    expect(result.rows).toHaveLength(6);
    expect(connect).not.toHaveBeenCalled();
  });

  it('answers from the fixtures with no environment variables at all', async () => {
    await expect(loadInterfaceConfig({ connect })).resolves.toMatchObject({ source: 'demo' });
  });

  it('finds one page by id and misses an unknown id, without a connection', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const [first] = demoInterfaceConfig;
    if (first === undefined) {
      throw new Error('the demo interface configuration is empty');
    }

    await expect(loadInterfacePage(first.id, { connect })).resolves.toEqual({
      page: first,
      source: 'demo',
    });
    await expect(loadInterfacePage('nope', { connect })).resolves.toEqual({
      page: null,
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

describe('loadInterfaceConfig in live mode', () => {
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
      loadInterfaceConfig({
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
});

/**
 * Ticket criterion 12. `@tas/db` does not depend on `@tas/domain` — the edge runs the other way
 * everywhere in this repo — so neither package can assert this about the other. `apps/web` depends
 * on both, which makes this file the only place the two can be pinned equal. Without it the demo
 * page and a seeded database are free to drift apart one label at a time.
 *
 * The comparison is the CONFIGURATION, not the row: ids, brand and timestamps are storage, the
 * defaults are the five pages, their order, their labels and the two flags on every field.
 */
function asConfig(page: InterfacePageRow): InterfacePageConfig {
  return {
    pageKey: page.pageKey,
    label: page.label,
    enabled: page.enabled,
    position: page.position,
    fields: page.fields.map((field) => ({
      fieldName: field.fieldName,
      label: field.label,
      visible: field.visible,
      clientEditable: field.clientEditable,
      position: field.position,
    })),
  };
}

describe('demoInterfaceConfig against the domain defaults', () => {
  it('is exactly defaultInterfaceConfig(), page for page and field for field', () => {
    expect(demoInterfaceConfig.map(asConfig)).toEqual(defaultInterfaceConfig());
  });

  it('carries the twelve concept-card fields the preview renders, in PRD §10 order', () => {
    const [concepts] = demoInterfaceConfig;
    expect(concepts?.pageKey).toBe('concepts');
    expect(concepts?.fields.map((field) => field.label)).toEqual([
      'Batch',
      'Category',
      'Concept name',
      'Concept Style',
      'Angle',
      'Theme',
      'Product',
      'Description (hypothesis)',
      'Pain Points',
      'USP',
      'Persona',
      'Hook examples',
    ]);
  });
});
