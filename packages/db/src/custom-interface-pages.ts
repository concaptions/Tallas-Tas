import { and, asc, eq, getTableColumns, isNull } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';

import type { Db } from './db';
import { listChildBrands } from './propagation';
import {
  brands,
  collections,
  concepts,
  copywriting,
  creativeBriefs,
  creators,
  customInterfacePages,
  interfaceTabVisibility,
  products,
  type CustomInterfacePage,
  type InterfaceTabVisibility,
  type NewCustomInterfacePage,
  type NewInterfaceTabVisibility,
} from './schema';
import { clientVisibleColumns } from './client-columns';

/**
 * Data access for the Oct 6/7 custom-interface-pages / tab-visibility sprint.
 *
 * No business logic lives here. The merge rules (`mergeCustomPages`, `mergeTabVisibility`) and
 * the operator semantics (`rowMatchesFilter`) live in `packages/domain/src/interface-config`;
 * these are the scoped queries the admin UI's Server Actions call.
 *
 * BRAND SCOPING. `custom_interface_pages.brand_id` is nullable (null = template default), so
 * `withBrand` cannot narrow this table — a brand-level read has to include the template rows the
 * child inherits. The two listing functions below are explicit about which rows they return and
 * read `deleted_at IS NULL` by hand, same contract as `promotion-requests.ts`.
 * `interface_tab_visibility.brand_id` is NOT NULL, so its reads scope by equality.
 */

export type { CustomInterfacePage, InterfaceTabVisibility };

/** Columns the clock and the scope manage; a caller never sets them. */
type ManagedColumn = 'id' | 'createdAt' | 'updatedAt' | 'deletedAt';

export type CustomInterfacePageInput = Omit<NewCustomInterfacePage, ManagedColumn>;
export type InterfaceTabVisibilityInput = Omit<NewInterfaceTabVisibility, ManagedColumn>;

/**
 * Every live `custom_interface_pages` row the brand reads: its own rows plus the template rows it
 * has NOT overridden. The admin UI uses this to render the "custom pages" section; the client
 * portal uses it to render the dynamic nav entries.
 *
 * Soft-deleted rows are excluded. Template rows (brand_id IS NULL) that the child has shadowed
 * with its own row (same slug) are dropped BEFORE returning — the shadowing is applied by
 * `mergeCustomPages`, so the two reads below return raw rows.
 */
export async function listTemplateCustomPages(db: Db): Promise<CustomInterfacePage[]> {
  return db
    .select()
    .from(customInterfacePages)
    .where(and(isNull(customInterfacePages.brandId), isNull(customInterfacePages.deletedAt)))
    .orderBy(asc(customInterfacePages.sortOrder), asc(customInterfacePages.title));
}

export async function listBrandCustomPages(
  db: Db,
  brandId: string,
): Promise<CustomInterfacePage[]> {
  return db
    .select()
    .from(customInterfacePages)
    .where(and(eq(customInterfacePages.brandId, brandId), isNull(customInterfacePages.deletedAt)))
    .orderBy(asc(customInterfacePages.sortOrder), asc(customInterfacePages.title));
}

/** One live custom page by slug for a brand, falling back to the template page with the same slug. */
export async function findCustomPageBySlug(
  db: Db,
  brandId: string,
  slug: string,
): Promise<CustomInterfacePage | null> {
  const [own] = await db
    .select()
    .from(customInterfacePages)
    .where(
      and(
        eq(customInterfacePages.brandId, brandId),
        eq(customInterfacePages.slug, slug),
        isNull(customInterfacePages.deletedAt),
      ),
    )
    .limit(1);
  if (own) return own;
  const [template] = await db
    .select()
    .from(customInterfacePages)
    .where(
      and(
        isNull(customInterfacePages.brandId),
        eq(customInterfacePages.slug, slug),
        isNull(customInterfacePages.deletedAt),
      ),
    )
    .limit(1);
  return template ?? null;
}

/**
 * The one shape a custom page must never have. `column_config = []` is read by the client route as
 * "every resolver column of the source table" — internal status, costs, prices — and
 * `loadCustomPageRows` strips nothing, so an empty column set is a client-facing leak whatever the
 * filter says (non-negotiable 10; the seeded template `internal-queue` page, contained 2026-10-10).
 * Refused at the write path, for a template row and a brand row alike, so no caller can store it.
 */
export const EMPTY_COLUMN_CONFIG_REFUSED =
  'A custom page needs at least one column: an empty column set would show every column of the table.';

function refuseEmptyColumns(columnConfig: readonly unknown[] | undefined): void {
  if (columnConfig !== undefined && columnConfig.length === 0) {
    throw new Error(EMPTY_COLUMN_CONFIG_REFUSED);
  }
}

/**
 * Insert one custom page (template-level when `brandId` is null, brand-level otherwise). Returns
 * the written row. Refuses an empty `columnConfig` (see `EMPTY_COLUMN_CONFIG_REFUSED`).
 */
export async function insertCustomPage(
  db: Db,
  input: CustomInterfacePageInput,
): Promise<CustomInterfacePage> {
  refuseEmptyColumns(input.columnConfig);
  const [row] = await db.insert(customInterfacePages).values(input).returning();
  if (!row) throw new Error('insertCustomPage: insert returned no row');
  return row;
}

/**
 * Update one custom page by id (scoped by the owning brand). `brandId = null` is the template
 * scope.
 */
export async function updateCustomPage(
  db: Db,
  id: string,
  brandId: string | null,
  patch: Partial<
    Pick<
      CustomInterfacePage,
      | 'title'
      | 'slug'
      | 'sourceTableKey'
      | 'filterConfig'
      | 'columnConfig'
      | 'sortOrder'
      | 'isVisible'
      | 'isInherited'
      | 'updatedBy'
    >
  >,
): Promise<CustomInterfacePage | null> {
  refuseEmptyColumns(patch.columnConfig);
  const brandFilter =
    brandId === null
      ? isNull(customInterfacePages.brandId)
      : eq(customInterfacePages.brandId, brandId);
  const [row] = await db
    .update(customInterfacePages)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(eq(customInterfacePages.id, id), brandFilter, isNull(customInterfacePages.deletedAt)),
    )
    .returning();
  return row ?? null;
}

/** Soft-delete one custom page by id, scoped by brand. */
export async function softDeleteCustomPage(
  db: Db,
  id: string,
  brandId: string | null,
  actorId: string,
): Promise<boolean> {
  const brandFilter =
    brandId === null
      ? isNull(customInterfacePages.brandId)
      : eq(customInterfacePages.brandId, brandId);
  const now = new Date();
  const result = await db
    .update(customInterfacePages)
    .set({ deletedAt: now, updatedAt: now, updatedBy: actorId })
    .where(
      and(eq(customInterfacePages.id, id), brandFilter, isNull(customInterfacePages.deletedAt)),
    )
    .returning({ id: customInterfacePages.id });
  return result.length > 0;
}

/**
 * Upsert a brand's row for a template page by slug, flipping `is_inherited` depending on the
 * patch. Returns the written row.
 */
export async function upsertBrandCustomPageFromTemplate(
  db: Db,
  brandId: string,
  template: CustomInterfacePage,
  overrides: Partial<
    Pick<
      CustomInterfacePage,
      | 'title'
      | 'sourceTableKey'
      | 'filterConfig'
      | 'columnConfig'
      | 'sortOrder'
      | 'isVisible'
      | 'isInherited'
    >
  >,
  actorId: string,
  /** The fields the child now keeps its own value for (0062 `overridden_fields`), added to any it already kept. */
  overridden: readonly string[] = [],
): Promise<CustomInterfacePage> {
  // Soft-deleted rows included: `(brand_id, slug)` is unique across them too, so a brand row that
  // "Reset to template" retired is REVIVED here, never inserted beside (SMOKE-23 — Gratsi's calendar
  // toggle after a reset collided on the index and the page could not be saved).
  const [existing] = await db
    .select()
    .from(customInterfacePages)
    .where(
      and(eq(customInterfacePages.brandId, brandId), eq(customInterfacePages.slug, template.slug)),
    )
    .limit(1);
  if (existing && existing.deletedAt !== null) {
    // A revived row starts over from the template: a reset meant "forget what this brand kept".
    const [row] = await db
      .update(customInterfacePages)
      .set({
        title: overrides.title ?? template.title,
        sourceTableKey: overrides.sourceTableKey ?? template.sourceTableKey,
        filterConfig: overrides.filterConfig ?? template.filterConfig,
        columnConfig: overrides.columnConfig ?? template.columnConfig,
        sortOrder: overrides.sortOrder ?? template.sortOrder,
        isVisible: overrides.isVisible ?? template.isVisible,
        isInherited: overrides.isInherited ?? true,
        pageKind: template.pageKind,
        moduleKey: template.moduleKey,
        templateRowId: template.id,
        overriddenFields: [...overridden],
        deletedAt: null,
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(eq(customInterfacePages.id, existing.id))
      .returning();
    if (!row) throw new Error('upsertBrandCustomPageFromTemplate: revive returned no row');
    return row;
  }
  if (existing) {
    const [row] = await db
      .update(customInterfacePages)
      .set({
        ...overrides,
        templateRowId: existing.templateRowId ?? template.id,
        overriddenFields: [...new Set([...existing.overriddenFields, ...overridden])],
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(eq(customInterfacePages.id, existing.id))
      .returning();
    if (!row) throw new Error('upsertBrandCustomPageFromTemplate: update returned no row');
    return row;
  }
  const [row] = await db
    .insert(customInterfacePages)
    .values({
      brandId,
      slug: template.slug,
      title: overrides.title ?? template.title,
      sourceTableKey: overrides.sourceTableKey ?? template.sourceTableKey,
      filterConfig: overrides.filterConfig ?? template.filterConfig,
      columnConfig: overrides.columnConfig ?? template.columnConfig,
      sortOrder: overrides.sortOrder ?? template.sortOrder,
      isVisible: overrides.isVisible ?? template.isVisible,
      isInherited: overrides.isInherited ?? true,
      pageKind: template.pageKind,
      moduleKey: template.moduleKey,
      templateRowId: template.id,
      overriddenFields: [...overridden],
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning();
  if (!row) throw new Error('upsertBrandCustomPageFromTemplate: insert returned no row');
  return row;
}

// ── the brand's page list: visibility and order (Scope A, B4) ──────────────────────────────────

/**
 * The brand's page list as the portal and the admin section read it: every template row and every
 * brand row, the brand's row winning by slug, in `sort_order` then title. The same rule as
 * `mergeCustomPages` in `@tas/domain`, on the raw rows (which carry `page_kind`, `template_row_id`
 * and `overridden_fields` the view type does not).
 */
export async function listMergedPages(db: Db, brandId: string): Promise<CustomInterfacePage[]> {
  const [templateRows, brandRows] = await Promise.all([
    listTemplateCustomPages(db),
    listBrandCustomPages(db, brandId),
  ]);
  const bySlug = new Map(templateRows.map((row) => [row.slug, row] as const));
  for (const row of brandRows) bySlug.set(row.slug, row);
  return [...bySlug.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
  );
}

/**
 * Show or hide one page for one brand (Admin + CSM). A TEMPLATE page gets a brand row that keeps
 * `is_visible` (and tracks the template for everything else); a brand's OWN page is updated in
 * place. The merged list `mergeCustomPages` reads prefers the brand row, so the portal follows.
 */
export async function setBrandPageVisibility(
  db: Db,
  brandId: string,
  page: CustomInterfacePage,
  isVisible: boolean,
  actorId: string,
): Promise<CustomInterfacePage> {
  if (page.brandId === brandId) {
    const row = await updateCustomPage(db, page.id, brandId, { isVisible });
    if (row === null) throw new Error('setBrandPageVisibility: the brand page is gone');
    return row;
  }
  return upsertBrandCustomPageFromTemplate(db, brandId, page, { isVisible }, actorId, [
    'is_visible',
  ]);
}

/**
 * The brand's page order, whole: one `sort_order` per merged page, written to the brand's own row
 * (created from the template where the brand had none). Written whole because a move renumbers
 * every page (`movePage` in `@tas/domain`), so the stored orders stay dense and total.
 */
export async function setBrandPageOrder(
  db: Db,
  brandId: string,
  pages: readonly CustomInterfacePage[],
  order: readonly { readonly slug: string; readonly sortOrder: number }[],
  actorId: string,
): Promise<void> {
  for (const entry of order) {
    const page = pages.find((candidate) => candidate.slug === entry.slug);
    if (page === undefined) continue;
    if (page.brandId === brandId) {
      await updateCustomPage(db, page.id, brandId, { sortOrder: entry.sortOrder });
    } else {
      await upsertBrandCustomPageFromTemplate(
        db,
        brandId,
        page,
        { sortOrder: entry.sortOrder },
        actorId,
        ['sort_order'],
      );
    }
  }
}

// ── interface_tab_visibility ────────────────────────────────────────────────────────────────────

export async function listTabVisibility(
  db: Db,
  brandId: string,
): Promise<InterfaceTabVisibility[]> {
  return db
    .select()
    .from(interfaceTabVisibility)
    .where(
      and(eq(interfaceTabVisibility.brandId, brandId), isNull(interfaceTabVisibility.deletedAt)),
    )
    .orderBy(asc(interfaceTabVisibility.sortOrder));
}

/**
 * Upsert a brand's row for one standard tab. The seed inserts template defaults; a child brand
 * inherits them until it writes its own row, which is what this function creates.
 */
export async function upsertTabVisibility(
  db: Db,
  input: InterfaceTabVisibilityInput,
): Promise<InterfaceTabVisibility> {
  const [existing] = await db
    .select()
    .from(interfaceTabVisibility)
    .where(
      and(
        eq(interfaceTabVisibility.brandId, input.brandId),
        eq(interfaceTabVisibility.tabKey, input.tabKey),
        isNull(interfaceTabVisibility.deletedAt),
      ),
    )
    .limit(1);
  if (existing) {
    const [row] = await db
      .update(interfaceTabVisibility)
      .set({
        isVisible: input.isVisible ?? existing.isVisible,
        sortOrder: input.sortOrder ?? existing.sortOrder,
        updatedAt: new Date(),
        updatedBy: input.updatedBy ?? null,
      })
      .where(eq(interfaceTabVisibility.id, existing.id))
      .returning();
    if (!row) throw new Error('upsertTabVisibility: update returned no row');
    return row;
  }
  const [row] = await db.insert(interfaceTabVisibility).values(input).returning();
  if (!row) throw new Error('upsertTabVisibility: insert returned no row');
  return row;
}

/**
 * Hard-delete a brand's own tab-visibility row by tab_key — the "reset to template default"
 * action. The template default is the row left behind (brand_id = template, not the deleted one),
 * so after this call the brand reads the template at render time.
 *
 * Hard delete rather than soft delete, because the ABSENCE of a row IS the fallback semantics —
 * leaving a soft-deleted row behind would require an extra `deleted_at IS NULL` on every read
 * (which the readers already do, but a reset-to-default conceptually is "no override exists" and
 * that is clearest as a non-existent row).
 */
export async function resetTabVisibility(
  db: Db,
  brandId: string,
  tabKey: string,
): Promise<boolean> {
  const result = await db
    .delete(interfaceTabVisibility)
    .where(
      and(eq(interfaceTabVisibility.brandId, brandId), eq(interfaceTabVisibility.tabKey, tabKey)),
    )
    .returning({ id: interfaceTabVisibility.id });
  return result.length > 0;
}

// ── propagation ────────────────────────────────────────────────────────────────────────────────

export interface CustomPagePropagationResult {
  readonly applied: boolean;
  readonly reason?: string;
  readonly childrenUpdated: number;
}

/**
 * Push one TEMPLATE custom page to every live, non-template child brand of the agency.
 *
 * Idempotence contract per child:
 *   - A child with NO row for this slug gets a fresh `is_inherited = true` row that mirrors the
 *     template.
 *   - A child with an `is_inherited = true` row for this slug is UPDATED in place to match the
 *     new template fields; the propagation is "track the parent".
 *   - A child with an `is_inherited = false` row for this slug is LEFT ALONE — the child has
 *     customised and the propagation respects that (CLAUDE.md architecture: "propagation skips
 *     overridden fields"). The returned `childrenUpdated` counts only the children the push
 *     actually changed.
 *
 * The template id must point at a `custom_interface_pages` row with `brand_id IS NULL` and
 * `deleted_at IS NULL`. Otherwise returns `applied: false` with a reason.
 */
export async function propagateCustomInterfacePageToChildren(
  db: Db,
  templatePageId: string,
  childBrandIds: readonly string[],
  actorId: string,
): Promise<CustomPagePropagationResult> {
  const [template] = await db
    .select()
    .from(customInterfacePages)
    .where(
      and(
        eq(customInterfacePages.id, templatePageId),
        isNull(customInterfacePages.brandId),
        isNull(customInterfacePages.deletedAt),
      ),
    )
    .limit(1);
  if (!template) {
    return {
      applied: false,
      reason: 'This page is no longer a template page.',
      childrenUpdated: 0,
    };
  }
  let changed = 0;
  for (const childId of childBrandIds) {
    const [existing] = await db
      .select()
      .from(customInterfacePages)
      .where(
        and(
          eq(customInterfacePages.brandId, childId),
          eq(customInterfacePages.slug, template.slug),
          isNull(customInterfacePages.deletedAt),
        ),
      )
      .limit(1);
    if (existing && !existing.isInherited) {
      continue; // child owns the row; propagation respects the override
    }
    if (existing) {
      await db
        .update(customInterfacePages)
        .set({
          title: template.title,
          sourceTableKey: template.sourceTableKey,
          filterConfig: template.filterConfig,
          columnConfig: template.columnConfig,
          sortOrder: template.sortOrder,
          isVisible: template.isVisible,
          isInherited: true,
          updatedBy: actorId,
          updatedAt: new Date(),
        })
        .where(eq(customInterfacePages.id, existing.id));
    } else {
      await db.insert(customInterfacePages).values({
        brandId: childId,
        slug: template.slug,
        title: template.title,
        sourceTableKey: template.sourceTableKey,
        filterConfig: template.filterConfig,
        columnConfig: template.columnConfig,
        sortOrder: template.sortOrder,
        isVisible: template.isVisible,
        isInherited: true,
        createdBy: actorId,
        updatedBy: actorId,
      });
    }
    changed += 1;
  }
  return { applied: true, childrenUpdated: changed };
}

/**
 * Every live, non-template child brand of the agency the template brand belongs to — the targets
 * of `propagateCustomInterfacePageToChildren`. Thin wrapper around `listChildBrands` scoped by the
 * template brand's own agency, used by the admin UI's push-to-clients action.
 */
export async function listLivePropagationTargets(
  db: Db,
  templateBrandId: string,
): Promise<readonly { id: string }[]> {
  // `listChildBrands` already filters status='active' and deleted_at IS NULL
  const children = await listChildBrands(db, templateBrandId);
  return children.map((brand) => ({ id: brand.id }));
}

/**
 * Resolve the template brand of the actor's agency for a push-to-clients call. The admin UI's
 * server action calls this with the actor's resolved brand id to find the template; a brand that
 * IS the template returns itself.
 */
export async function resolveTemplateBrandFromAny(
  db: Db,
  anyBrandId: string,
): Promise<string | null> {
  const [brand] = await db
    .select()
    .from(brands)
    .where(and(eq(brands.id, anyBrandId), isNull(brands.deletedAt)))
    .limit(1);
  if (!brand) return null;
  if (brand.isTemplate) return brand.id;
  return brand.templateBrandId ?? null;
}

// ── custom-page rows ───────────────────────────────────────────────────────────────────────────

/**
 * The six source tables a custom page may draw from (mirrors
 * `CUSTOM_PAGE_SOURCE_TABLE_KEYS` in `@tas/domain`). Local allow-list — a stored row with a
 * `source_table_key` outside this set reads zero rows, so the admin UI's zod gate is the first
 * line and this is the belt.
 *
 * `brandIdCol` and `deletedAtCol` are read as `unknown` and compared in SQL via `eq` and
 * `isNull`; a stored string that is not in the record is handled by `SOURCE_TABLES` lookup
 * returning undefined.
 */
const SOURCE_TABLES: Readonly<Record<string, PgTable>> = {
  creative_briefs: creativeBriefs,
  creators,
  copywriting,
  concepts,
  collections,
  products,
};

/**
 * Fetch the CLIENT-VISIBLE cells of a source table for the custom-page renderer. Scoped by brand
 * through the table's own `brand_id` and `deleted_at IS NULL`; the empty set for a
 * `sourceTableKey` outside the allow-list.
 *
 * Every row is PROJECTED to the columns `clientVisibleColumns(sourceTableKey)` names, keyed by
 * their Postgres names (`client_status`), which is the spelling `column_config`, the filter and
 * the portal route use — Drizzle's camelCase property names (`clientStatus`) never leave this
 * function. Before 2026-10-10 the rows went out whole and camelCased: a page's filter on
 * `client_status` never matched (so the template queue pages drew nothing, by accident), and had
 * the keys agreed, `column_config = []` would have drawn every column, internal status included
 * (F1). Now a column the client may not see is not in the row at all, whatever the page asks for.
 */
export async function loadCustomPageRows(
  db: Db,
  brandId: string,
  sourceTableKey: string,
): Promise<readonly Record<string, unknown>[]> {
  const table = SOURCE_TABLES[sourceTableKey];
  if (!table) return [];
  // Every allowed table carries `brand_id` and `deleted_at` through `baseColumns()`; the lookup
  // above refuses anything else, so these columns are known to exist.
  const columns = table as unknown as Record<'brandId' | 'deletedAt', AnyPgColumn>;
  const rows = await db
    .select()
    .from(table)
    .where(and(eq(columns.brandId, brandId), isNull(columns.deletedAt)));
  const visible = clientVisibleColumns(sourceTableKey);
  // Property name → Postgres column name, from the table's own definition.
  const names = Object.entries(getTableColumns(table) as Record<string, { name: string }>)
    .map(([property, column]) => [property, column.name] as const)
    .filter(([, name]) => visible.has(name));
  return rows.map((row) => {
    const record = row as Record<string, unknown>;
    const projected: Record<string, unknown> = {};
    for (const [property, name] of names) projected[name] = record[property];
    return projected;
  });
}

/** The one-shot read for a client custom-page route: config + rows. */
export async function loadCustomPageRender(
  db: Db,
  brandId: string,
  slug: string,
): Promise<null | {
  readonly page: CustomInterfacePage;
  readonly rows: readonly Record<string, unknown>[];
}> {
  const page = await findCustomPageBySlug(db, brandId, slug);
  if (!page || !page.isVisible) return null;
  // A STANDARD page row (migration 0063) only carries a tab's visibility and order; its route is
  // the tab's own, never this one.
  if (page.pageKind === 'standard') return null;
  const rows = await loadCustomPageRows(db, brandId, page.sourceTableKey);
  // The page's own column picks, narrowed the same way: a stored pick of a column the client may
  // not see is dropped here, so the route never even asks for it.
  const visible = clientVisibleColumns(page.sourceTableKey);
  const columnConfig = page.columnConfig.filter((pick) => visible.has(pick.columnKey));
  return { page: { ...page, columnConfig }, rows };
}
