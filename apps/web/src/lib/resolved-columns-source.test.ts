import { agencies, brands, memberships, users, type Db, type ResolvedColumn } from '@tas/db';
import { describe, expect, it, vi } from 'vitest';

import type { ActorScope } from './data-source';
import { loadResolvedColumns } from './resolved-columns-source';

/**
 * Oct-14 fix (DEV_NOTICE): a retired column such as `elements_we_are_testing` on `creative_briefs`
 * still carries a `column_definitions` row on live brands even though no page has a renderer for
 * it. `loadResolvedColumns` must filter it out before the grid adapter would flag it in `missing`,
 * so the Column Admin's grey "Configured for this brand but not drawn here" box never names it.
 */

interface FakeRows {
  readonly agencies?: readonly unknown[];
  readonly brands?: readonly unknown[];
  readonly users?: readonly unknown[];
  readonly memberships?: readonly unknown[];
}

function fakeDb(rows: FakeRows): Db {
  const byTable = new Map<unknown, readonly unknown[]>([
    [agencies, rows.agencies ?? []],
    [brands, rows.brands ?? []],
    [users, rows.users ?? []],
    [memberships, rows.memberships ?? []],
  ]);
  return {
    select: () => ({
      from: (table: unknown) => Promise.resolve([...(byTable.get(table) ?? [])]),
    }),
  } as unknown as Db;
}

const agencyA = { id: 'agency-a', clerkOrgId: 'org-a', deletedAt: null };
const brandOfA = {
  id: 'brand-a',
  name: 'Brand A',
  status: 'active',
  agencyId: agencyA.id,
  isTemplate: false,
  deletedAt: null,
};
const asOrg = (clerkOrgId: string) => (): Promise<ActorScope> =>
  Promise.resolve({ clerkOrgId, clerkUserId: null });

function col(partial: Partial<ResolvedColumn>): ResolvedColumn {
  return {
    columnKey: partial.columnKey ?? 'name',
    displayLabel: partial.displayLabel ?? 'Name',
    displayOrder: partial.displayOrder ?? 1,
    fieldType: partial.fieldType ?? null,
    source: partial.source ?? 'parent',
    formula: partial.formula ?? null,
    isDetached: partial.isDetached ?? false,
    inheritedFrom: partial.inheritedFrom ?? null,
  };
}

describe('loadResolvedColumns filters retired columns', () => {
  it('drops `elements_we_are_testing` from the resolved set for `creative_briefs`', async () => {
    const resolve = vi
      .fn()
      .mockResolvedValue([
        col({ columnKey: 'name', displayOrder: 1 }),
        col({ columnKey: 'elements_we_are_testing', displayLabel: 'Elements', displayOrder: 2 }),
        col({ columnKey: 'internal_status', displayLabel: 'Internal Status', displayOrder: 3 }),
      ]);
    const db = fakeDb({ agencies: [agencyA], brands: [brandOfA] });
    const result = await loadResolvedColumns('creative_briefs', {
      demoMode: () => false,
      withDb: <T>(query: (db: Db) => Promise<T>) => query(db),
      resolveColumns: resolve,
      actorScope: asOrg('org-a'),
    });
    const keys = result.columns.map((c) => c.columnKey);
    expect(keys).toContain('name');
    expect(keys).toContain('internal_status');
    expect(keys).not.toContain('elements_we_are_testing');
    expect(result.unconfigured).toBe(false);
  });

  it('a brand that configures ONLY retired columns falls back to the parent master set', async () => {
    // The brand has one row and it is the retired one, so after filtering the resolved set is
    // empty and the loader serves the template master. The master itself no longer carries the
    // retired key (the seed dropped it on Oct 14), so the fallback is also clean.
    const resolve = vi
      .fn()
      .mockResolvedValue([
        col({ columnKey: 'elements_we_are_testing', displayLabel: 'Elements', displayOrder: 2 }),
      ]);
    const db = fakeDb({ agencies: [agencyA], brands: [brandOfA] });
    const result = await loadResolvedColumns('creative_briefs', {
      demoMode: () => false,
      withDb: <T>(query: (db: Db) => Promise<T>) => query(db),
      resolveColumns: resolve,
      actorScope: asOrg('org-a'),
    });
    expect(result.unconfigured).toBe(true);
    expect(result.columns.some((c) => c.columnKey === 'elements_we_are_testing')).toBe(false);
  });

  it('demo mode: the parent master set never carries a retired key either', async () => {
    const result = await loadResolvedColumns('creative_briefs', {
      demoMode: () => true,
      withDb: <T>(query: (db: Db) => Promise<T>) => query({} as Db),
    });
    expect(result.source).toBe('demo');
    expect(result.columns.some((c) => c.columnKey === 'elements_we_are_testing')).toBe(false);
  });
});
