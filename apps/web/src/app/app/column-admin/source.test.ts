import { afterEach, describe, expect, it, vi } from 'vitest';

import { SEED_PARENT_BASE_ID, TEMPLATE_BASE_LABEL } from './fields';
import { columnAdminTables, loadColumnAdmin } from './source';

/**
 * The demo guarantee, for this route: with no Clerk key — or with a key but no `DATABASE_URL` — the
 * page is served from `COLUMN_SEED` and NOTHING opens a connection. The second case is the one that
 * would otherwise throw: `withAgencyScope` refuses a scope it cannot honour, so the loader has to
 * decide "no database" before it ever calls it.
 */
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('columnAdminTables', () => {
  it('offers the propagation registry, sorted, and never the global themes library', () => {
    const tables = columnAdminTables();

    expect(tables).toContain('personas');
    expect(tables).toContain('creative_briefs');
    expect(tables).not.toContain('themes');
    expect(tables).toEqual([...tables].sort((left, right) => left.localeCompare(right)));
  });
});

describe('loadColumnAdmin in demo mode', () => {
  it('serves the parent template and the fixture brands from the seed', async () => {
    const data = await loadColumnAdmin(undefined, undefined);

    expect(data.source).toBe('demo');
    expect(data.baseId).toBe(SEED_PARENT_BASE_ID);
    expect(data.templateBaseId).toBe(SEED_PARENT_BASE_ID);
    expect(data.bases[0]).toEqual({
      id: SEED_PARENT_BASE_ID,
      name: TEMPLATE_BASE_LABEL,
      isTemplate: true,
    });
    expect(data.bases.map((base) => base.name)).toContain('Gratsi');
    expect(data.tableKey).toBe('personas');
    expect(data.columns.length).toBeGreaterThan(0);
  });

  it('honours a base and a table from the address', async () => {
    const data = await loadColumnAdmin('gratsi', 'angles');

    expect(data.baseId).toBe('gratsi');
    expect(data.tableKey).toBe('angles');
    expect(data.columns).toEqual([]);
    expect(data.restorable).toEqual([]);
  });

  /**
   * The only "add" the route offers, and the only way back from Hide on a brand: the parent columns
   * a brand does not show. It is NOT "every parent column this base has no row for" — in the
   * fixtures that set includes the columns a base simply inherits, and offering to restore one of
   * those would claim a base hides a column it shows.
   */
  it('offers a brand the template columns it hides, and the parent base none', async () => {
    const gratsi = await loadColumnAdmin('gratsi', 'personas');

    expect(gratsi.restorable.map((column) => column.columnKey)).toContain('day_in_the_life');
    expect(gratsi.restorable.map((column) => column.columnKey)).not.toContain('demographic');
    expect(gratsi.columns.map((column) => column.columnKey)).not.toContain('day_in_the_life');

    const parent = await loadColumnAdmin(undefined, 'personas');

    expect(parent.restorable).toEqual([]);
  });

  it('offers nothing for a base the seed says nothing about, which hides nothing', async () => {
    const data = await loadColumnAdmin('funky-painting', 'personas');

    expect(data.columns).toEqual([]);
    expect(data.restorable).toEqual([]);
  });

  it('falls back to the template for a base this workspace does not have', async () => {
    const data = await loadColumnAdmin('brand-of-another-agency', undefined);

    expect(data.baseId).toBe(SEED_PARENT_BASE_ID);
  });

  it('stays on the fixtures when Clerk is configured but no database is', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const data = await loadColumnAdmin(undefined, undefined, { demoMode: () => false });

    expect(data.source).toBe('demo');
    expect(data.columns.length).toBeGreaterThan(0);
  });
});
