import { boolean, index, integer, jsonb, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';

/**
 * Admin-defined custom pages and standard-tab visibility for the per-brand client interface.
 *
 * TWO TABLES, ONE SPRINT. The shipped `interface_pages` / `interface_fields` pair (PRD §10, five
 * named pages with their stored field flags) stays untouched; this pair carries the Oct 6/7 Talal
 * requirement to let CSMs add brand-specific pages ON TOP of the standard four tabs and reorder /
 * hide the standard four themselves. Standard tabs are addressed by `tab_key`; custom pages are
 * addressed by their own uuid plus a per-brand `slug`.
 *
 * WHY A SEPARATE TABLE FROM `interface_pages`. The shipped table is keyed on the fixed PRD §10
 * vocabulary (`pageKey ∈ interfacePageKeys`): a row stores whether one of the five SHIPPED pages is
 * enabled and in what position. The custom pages here are not members of that vocabulary — they are
 * arbitrary filtered views of any source table — and their shape is entirely different (slug,
 * `filter_config`, `column_config`). Fusing them would blur one data contract across two product
 * concepts, so they live beside each other instead.
 *
 * INHERITANCE AT READ TIME, not propagation of a copy. `brand_id` is NULLABLE on
 * `custom_interface_pages`: null means "this is a TEMPLATE page every child sees unless the child
 * has written its own row with the same slug." A child's row is inheriting until the propagation
 * engine, or the admin UI, flips `is_inherited = false`, after which parent edits no longer touch
 * it (same pattern as `column_definitions.is_detached`). `interface_tab_visibility.brand_id` is NOT
 * NULL — a tab is standard for every brand already, so the only question is which brand hides it.
 *
 * ORDER IS A COLUMN. `sort_order` is 0-based and dense within a brand's own set; the client portal
 * nav reads custom pages and standard tabs in that order, and a reordered tab is a cheap update
 * rather than a row re-insert.
 *
 * `filter_config` holds a single-condition filter in V0 — `{column, op}` or `{column, op, value}` —
 * and `column_config` is an array of `{columnKey, displayLabel, displayOrder}` entries that narrow
 * the resolver's columns to a client-visible subset. Both are `jsonb` because the shape evolves
 * independently of the migration cadence (adding a second filter clause would not need a migration
 * to say something the DB never enforces anyway), and both default to the empty value so a page
 * created with no filter / no column pick still reads sanely.
 */
export const customPageKinds = ['standard', 'custom', 'module'] as const;
export type CustomPageKind = (typeof customPageKinds)[number];

export const customInterfacePages = pgTable(
  'custom_interface_pages',
  {
    ...baseColumns(),
    /**
     * `brand_id = NULL` is the TEMPLATE page every child inherits; a non-null `brand_id` is a
     * child-specific row (either inherited from a template page by the propagation engine, or
     * added only for this brand). The uniqueness index below pairs with it: a brand has at most
     * one page per slug, and the template has at most one page per slug.
     */
    brandId: uuid('brand_id').references(() => brands.id),
    /** `kebab-case` identifier that becomes the client-portal URL segment. */
    slug: text('slug').notNull(),
    /** Human-readable title in the client-portal nav and the page heading. */
    title: text('title').notNull(),
    /**
     * The resolver table this page draws rows from — one of `creative_briefs`, `creators`,
     * `copywriting`, `concepts`, `collections`, `products`. Stored as plain text so a V1 addition
     * is a vocabulary change and not a migration; the domain pins the allowed set (CUSTOM_PAGE_SOURCE_TABLE_KEYS).
     */
    sourceTableKey: text('source_table_key').notNull(),
    /** Single-condition filter: `{column, op}` or `{column, op, value}` or `{}`. */
    filterConfig: jsonb('filter_config').$type<CustomPageFilterConfig>().notNull().default({}),
    /** The ordered subset of resolver columns this page renders. */
    columnConfig: jsonb('column_config')
      .$type<readonly CustomPageColumnConfig[]>()
      .notNull()
      .default([]),
    sortOrder: integer('sort_order').notNull().default(0),
    isVisible: boolean('is_visible').notNull().default(true),
    /**
     * Migration 0062 (Scope A, B1): what kind of page the row is — a STANDARD tab (one of
     * `CLIENT_TAB_KEYS`, from migration 0063), an admin-defined CUSTOM filtered view, or a MODULE
     * page the platform renders (`module_key`, e.g. `partnership_ads`).
     */
    pageKind: text('page_kind').$type<CustomPageKind>().notNull().default('custom'),
    moduleKey: text('module_key'),
    /** The template page a child row inherits from (0062 backfilled it from the slug match). */
    templateRowId: uuid('template_row_id'),
    /** The fields this child keeps its own value for; propagation leaves them alone. */
    overriddenFields: jsonb('overridden_fields').$type<string[]>().notNull().default([]),
    /**
     * True on a child row that still mirrors the template. The propagation engine updates
     * inheriting rows when the template page changes; a child row with `is_inherited = false` is
     * ignored by propagation, same contract as `column_definitions.is_detached`.
     */
    isInherited: boolean('is_inherited').notNull().default(true),
  },
  (table) => [
    index('custom_interface_pages_brand_id_idx').on(table.brandId),
    index('custom_interface_pages_brand_sort_idx').on(table.brandId, table.sortOrder),
    // A brand (or the template, when brand_id IS NULL) carries at most one page per slug. The
    // combined-null behaviour of a unique index in Postgres is what makes two template rows with
    // the same slug a constraint violation and lets each child own exactly one row per slug.
    unique('custom_interface_pages_brand_slug_uq').on(table.brandId, table.slug),
  ],
);

/**
 * Per-brand visibility and ordering for the FOUR shipped client tabs
 * (concepts, creative_sheet, ugc_management, copywriting — PRD §9 + Oct 5 agent 5). The absence of
 * a row for a given `(brand_id, tab_key)` means "inherit the template default": the seed inserts
 * four rows against the template brand with `is_visible = true` and sort_order 1..4, and a child
 * brand reads its own row when present and falls through to the template row otherwise.
 */
export const interfaceTabVisibility = pgTable(
  'interface_tab_visibility',
  {
    ...baseColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    /** One of `CLIENT_TAB_KEYS` in `@tas/domain/interface-config`. */
    tabKey: text('tab_key').notNull(),
    isVisible: boolean('is_visible').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    index('interface_tab_visibility_brand_id_idx').on(table.brandId),
    unique('interface_tab_visibility_brand_tab_uq').on(table.brandId, table.tabKey),
  ],
);

/**
 * The V0 filter shape: zero or one condition, stored verbatim. `op = 'is_empty' | 'is_not_empty'`
 * carry no `value`; the other three require it. The read-side helper in `@tas/domain` enforces the
 * narrowing.
 */
export type CustomPageFilterOp = 'is' | 'is_not' | 'contains' | 'is_empty' | 'is_not_empty';

export type CustomPageFilterConfig =
  | Record<string, never>
  | {
      readonly column: string;
      readonly op: 'is' | 'is_not' | 'contains';
      readonly value: string;
    }
  | {
      readonly column: string;
      readonly op: 'is_empty' | 'is_not_empty';
    };

/** One column of a custom page's `column_config`, matching the resolver's shape at read time. */
export interface CustomPageColumnConfig {
  readonly columnKey: string;
  readonly displayLabel: string;
  readonly displayOrder: number;
}

export type CustomInterfacePage = typeof customInterfacePages.$inferSelect;
export type NewCustomInterfacePage = typeof customInterfacePages.$inferInsert;
export type InterfaceTabVisibility = typeof interfaceTabVisibility.$inferSelect;
export type NewInterfaceTabVisibility = typeof interfaceTabVisibility.$inferInsert;
