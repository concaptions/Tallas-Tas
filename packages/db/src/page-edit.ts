import { and, inArray, isNull } from 'drizzle-orm';

import {
  brandOwnTabColumnKeys,
  brandTabColumns,
  setBrandTabColumns,
  tabColumnWrites,
} from './brand-tab-columns';
import type { Db } from './db';
import {
  listMergedPages,
  setBrandPageOverrides,
  type BrandPageOverrides,
} from './custom-interface-pages';
import { listChildBrands } from './propagation';
import { recordPropagationRun } from './propagation-runs';
import {
  brands,
  type Brand,
  type CustomPageColumnConfig,
  type CustomPageFilterConfig,
} from './schema';

/**
 * A PAGE EDIT applied to client brands (Part B, 2026-10-12): the Interface Config Edit dialog's
 * fields, written as each target brand's OWN page override — and, on a standard tab, the brand's
 * own column definition rows — never the template's. The payload shape is `@tas/domain`'s
 * `PageEditPayload` (this package reads it structurally); its conflict rule is reproduced here on
 * the stored `overridden_fields` names because a brand that already keeps its own value for a
 * field must be listed on the review (`previewPageEdit`) and kept or overwritten on approval
 * (`applyPageEdit`) by the same reading.
 */
export interface PageEditChangesLike {
  readonly title: string;
  readonly isVisible: boolean;
  readonly filterConfig?: CustomPageFilterConfig;
  readonly columnConfig?: readonly CustomPageColumnConfig[];
}

export interface PageEditPayloadLike {
  readonly slug: string;
  readonly targets: 'all' | readonly string[];
  readonly onConflict: 'skip' | 'overwrite';
  readonly changes: PageEditChangesLike;
}

export interface PageEditBrandOutcome {
  readonly brandId: string;
  readonly brandName: string;
  /** The stored field names the brand already keeps its own value for, among the edit's fields. */
  readonly conflicts: readonly string[];
  /** Whether anything was (or would be) written for the brand under the request's policy. */
  readonly applies: boolean;
}

const FIELD = {
  title: 'title',
  isVisible: 'is_visible',
  filterConfig: 'filter_config',
  columnConfig: 'column_config',
} as const;

/** The template's active child brands the edit names; an id outside them is dropped, never trusted. */
export async function pageEditTargets(
  db: Db,
  templateBrandId: string,
  targets: PageEditPayloadLike['targets'],
): Promise<Brand[]> {
  const children = await listChildBrands(db, templateBrandId);
  if (targets === 'all') return children;
  const wanted = new Set(targets);
  return children.filter((brand) => wanted.has(brand.id));
}

interface TargetRead {
  readonly brand: Brand;
  readonly page: Awaited<ReturnType<typeof listMergedPages>>[number] | undefined;
  readonly conflicts: readonly string[];
  readonly applicable: BrandPageOverrides | null;
  readonly standardTable: string | null;
}

async function readTarget(db: Db, brand: Brand, payload: PageEditPayloadLike): Promise<TargetRead> {
  const page = (await listMergedPages(db, brand.id)).find((row) => row.slug === payload.slug);
  if (page === undefined) {
    return { brand, page, conflicts: [], applicable: null, standardTable: null };
  }
  const standardTable = page.pageKind === 'standard' ? page.sourceTableKey : null;
  const brandOwnPage = page.brandId === brand.id && page.templateRowId === null;
  const kept = new Set(
    brandOwnPage ? Object.values(FIELD) : page.brandId === brand.id ? page.overriddenFields : [],
  );
  const ownColumns =
    standardTable !== null &&
    payload.changes.columnConfig !== undefined &&
    (await brandOwnTabColumnKeys(db, brand.id, standardTable)).length > 0;
  const { changes } = payload;
  const conflicts: string[] = [];
  if (kept.has(FIELD.title)) conflicts.push(FIELD.title);
  if (kept.has(FIELD.isVisible)) conflicts.push(FIELD.isVisible);
  if (changes.filterConfig !== undefined && kept.has(FIELD.filterConfig)) {
    conflicts.push(FIELD.filterConfig);
  }
  if (changes.columnConfig !== undefined && (kept.has(FIELD.columnConfig) || ownColumns)) {
    conflicts.push(FIELD.columnConfig);
  }
  const skip = new Set(payload.onConflict === 'overwrite' ? [] : conflicts);
  const applicable: BrandPageOverrides = {};
  if (!skip.has(FIELD.title)) applicable.title = changes.title;
  if (!skip.has(FIELD.isVisible)) applicable.isVisible = changes.isVisible;
  if (changes.filterConfig !== undefined && !skip.has(FIELD.filterConfig)) {
    applicable.filterConfig = changes.filterConfig;
  }
  if (changes.columnConfig !== undefined && !skip.has(FIELD.columnConfig)) {
    applicable.columnConfig = [...changes.columnConfig];
  }
  return {
    brand,
    page,
    conflicts,
    applicable: Object.keys(applicable).length === 0 ? null : applicable,
    standardTable,
  };
}

/** What approval would do, brand by brand, without writing: the review's conflict listing. */
export async function previewPageEdit(
  db: Db,
  templateBrandId: string,
  payload: PageEditPayloadLike,
): Promise<PageEditBrandOutcome[]> {
  const targets = await pageEditTargets(db, templateBrandId, payload.targets);
  const reads = await Promise.all(targets.map((brand) => readTarget(db, brand, payload)));
  return reads.map((read) => ({
    brandId: read.brand.id,
    brandName: read.brand.name,
    conflicts: read.conflicts,
    applies: read.applicable !== null,
  }));
}

export interface ApplyPageEditResult {
  readonly outcomes: readonly PageEditBrandOutcome[];
  readonly childrenUpdated: number;
  readonly skipped: number;
}

/**
 * Applies the edit to every target brand under its policy and writes the `propagation_runs`
 * ledger row. A standard tab's column picks become the brand's column definition rows (the same
 * writer Column Admin and the one-brand save use); the page row keeps title and visibility.
 */
export async function applyPageEdit(
  db: Db,
  templateBrandId: string,
  templatePageId: string | null,
  payload: PageEditPayloadLike,
  actorId: string,
): Promise<ApplyPageEditResult> {
  const targets = await pageEditTargets(db, templateBrandId, payload.targets);
  const outcomes: PageEditBrandOutcome[] = [];
  let childrenUpdated = 0;
  for (const brand of targets) {
    const read = await readTarget(db, brand, payload);
    const applies = read.page !== undefined && read.applicable !== null;
    outcomes.push({ brandId: brand.id, brandName: brand.name, conflicts: read.conflicts, applies });
    if (read.page === undefined || read.applicable === null) continue;
    const { columnConfig, ...pageFields } = read.applicable;
    if (read.standardTable !== null) {
      if (columnConfig !== undefined) {
        const columns = await brandTabColumns(db, brand.id, read.standardTable);
        await setBrandTabColumns(
          db,
          brand.id,
          read.standardTable,
          tabColumnWrites(columns, columnConfig),
          actorId,
        );
      }
      await setBrandPageOverrides(db, brand.id, read.page, pageFields, actorId);
    } else {
      await setBrandPageOverrides(db, brand.id, read.page, read.applicable, actorId);
    }
    childrenUpdated += 1;
  }
  await recordPropagationRun(
    db,
    {
      templateBrandId,
      tableName: 'custom_interface_pages',
      trigger: 'interface',
      templateRowId: templatePageId,
      childrenUpdated,
      skipped: targets.length - childrenUpdated,
    },
    actorId,
  );
  return { outcomes, childrenUpdated, skipped: targets.length - childrenUpdated };
}

/** The names of the brands an id list names, for a review that lists targets; unknown ids dropped. */
export async function brandNamesOf(db: Db, ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: brands.id, name: brands.name })
    .from(brands)
    .where(and(inArray(brands.id, [...ids]), isNull(brands.deletedAt)));
  return new Map(rows.map((row) => [row.id, row.name]));
}
