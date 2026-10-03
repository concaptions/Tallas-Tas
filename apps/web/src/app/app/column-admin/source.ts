import {
  COLUMN_SEED,
  PROPAGATION_TABLES,
  demoBrands,
  listChildBrands,
  resolveColumns,
  resolveTemplateBrandId,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { isDemoMode } from '@/lib/demo-mode';
import { withAgencyScope } from '@/lib/propagation-source';

import {
  SEED_PARENT_BASE_ID,
  TEMPLATE_BASE_LABEL,
  resolveBaseId,
  resolveTableKey,
  restorableColumns,
  seedColumnsFor,
  seedHiddenColumnKeys,
  type ColumnAdminBase,
  type QueryValue,
  type ResolvedColumnView,
} from './fields';

/**
 * Where Column Admin gets its rows. One read, two modes, the same shape either way.
 *
 * DEMO MODE (no Clerk key, or no `DATABASE_URL`): `COLUMN_SEED` from `@tas/db`, projected by the
 * pure `seedColumnsFor`. No client is constructed and no connection is opened — the demo branch
 * returns before `withAgencyScope` is reached, which is the half of the demo-mode rule that makes
 * the unauthenticated deployment safe.
 *
 * LIVE MODE: the agency is resolved once by `withAgencyScope` (`@/lib/propagation-source`, reused
 * rather than copied), then the bases are the agency's template plus its live children and the
 * columns are whatever `resolveColumns` says — THE resolver, inheritance included. Nothing here
 * merges a parent with a child, orders a column or decides a label; all three are the resolver's
 * answer, and this module only chooses which base and which table to ask about.
 *
 * THE BASE ID IS NEVER TRUSTED. `resolveBaseId` honours `?base=` only when it names one of the
 * bases this agency actually has, so a forged or stale id falls back to the template instead of
 * reaching a query.
 */
export type ColumnAdminSourceKind = 'database' | 'demo';

export interface ColumnAdminData {
  readonly bases: readonly ColumnAdminBase[];
  readonly tables: readonly string[];
  /** The base in view, or null when the workspace has no template brand yet. */
  readonly baseId: string | null;
  readonly tableKey: string;
  readonly columns: readonly ResolvedColumnView[];
  /**
   * Parent columns this base hides, which is the only "add" the page offers and the way back from
   * Hide on a brand. Empty on the parent base, which has no second source to read a hidden row from.
   */
  readonly restorable: readonly ResolvedColumnView[];
  /** The parent base's id, so the page can tell the master set from a child's departures. */
  readonly templateBaseId: string | null;
  readonly source: ColumnAdminSourceKind;
}

/**
 * The tables a column can be configured on: the propagation registry, which is the same vocabulary
 * the Server Actions validate against, so the chooser can never offer a table a write refuses.
 * Themes is absent on purpose — the themes library is global, not per-brand (non-negotiable 3).
 */
export function columnAdminTables(): readonly string[] {
  return Object.keys(PROPAGATION_TABLES).sort((left, right) => left.localeCompare(right));
}

/** Seams, for tests only. Production passes nothing. */
export interface ColumnAdminSourceDeps {
  readonly demoMode?: () => boolean;
}

function inDemoMode(deps: ColumnAdminSourceDeps): boolean {
  if ((deps.demoMode ?? isDemoMode)()) return true;
  return serverEnv().DATABASE_URL === undefined;
}

/** The bases demo mode offers: the parent the seed targets, then the fixture brands by slug. */
function demoBases(): readonly ColumnAdminBase[] {
  return [
    { id: SEED_PARENT_BASE_ID, name: TEMPLATE_BASE_LABEL, isTemplate: true },
    ...demoBrands.map((brand) => ({ id: brand.slug, name: brand.name, isTemplate: false })),
  ];
}

export async function loadColumnAdmin(
  baseParam: QueryValue,
  tableParam: QueryValue,
  deps: ColumnAdminSourceDeps = {},
): Promise<ColumnAdminData> {
  const tables = columnAdminTables();
  const tableKey = resolveTableKey(tableParam, tables);

  if (inDemoMode(deps)) {
    const bases = demoBases();
    const baseId = resolveBaseId(baseParam, bases);
    const columns = baseId === null ? [] : seedColumnsFor(COLUMN_SEED, baseId, tableKey);
    // Only the rows this base's own seed marks hidden, never every parent column it has no row for:
    // in the fixtures the second set includes the columns a base simply inherits.
    const hidden =
      baseId === null || baseId === SEED_PARENT_BASE_ID
        ? []
        : seedHiddenColumnKeys(COLUMN_SEED, baseId, tableKey);
    return {
      bases,
      tables,
      baseId,
      tableKey,
      columns,
      restorable: restorableColumns(
        seedColumnsFor(COLUMN_SEED, SEED_PARENT_BASE_ID, tableKey).filter((column) =>
          hidden.includes(column.columnKey),
        ),
        columns,
      ),
      templateBaseId: SEED_PARENT_BASE_ID,
      source: 'demo',
    };
  }

  const loaded = await withAgencyScope(async (db, agencyId) => {
    const templateBaseId = await resolveTemplateBrandId(db, agencyId);
    if (templateBaseId === null) {
      return { bases: [], baseId: null, columns: [], restorable: [], templateBaseId };
    }
    const children = await listChildBrands(db, templateBaseId);
    const bases: readonly ColumnAdminBase[] = [
      { id: templateBaseId, name: TEMPLATE_BASE_LABEL, isTemplate: true },
      ...children.map((child) => ({ id: child.id, name: child.name, isTemplate: false })),
    ];
    const baseId = resolveBaseId(baseParam, bases);
    const columns = baseId === null ? [] : await resolveColumns(db, baseId, tableKey);
    // A parent column missing from a child's resolved set is a column the child HID, because that is
    // the only thing the resolver drops. On the parent base the two sets are the same read, so the
    // list is empty by construction and the second query is skipped.
    const parentColumns =
      baseId === null || baseId === templateBaseId
        ? []
        : await resolveColumns(db, templateBaseId, tableKey);
    return {
      bases,
      baseId,
      columns,
      restorable: restorableColumns(parentColumns, columns),
      templateBaseId,
    };
  });

  return {
    bases: loaded?.bases ?? [],
    tables,
    baseId: loaded?.baseId ?? null,
    tableKey,
    columns: loaded?.columns ?? [],
    restorable: loaded?.restorable ?? [],
    templateBaseId: loaded?.templateBaseId ?? null,
    source: 'database',
  };
}
