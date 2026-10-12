import type {
  CustomPageColumnConfig,
  CustomPageFilterConfig,
} from '../interface-config/custom-pages';

/**
 * A PAGE EDIT request (Part B, 2026-10-12): the Interface Config Edit dialog, saved by an Admin for
 * "Selected brands" or "All clients", opens ONE review request on the Propagation page instead of
 * writing anything. Approval (an Admin, non-negotiable 2) applies the edit as each target brand's
 * OWN override — the template never changes, and a brand that already keeps its own value for a
 * field the edit touches is a CONFLICT: skipped (the default) or overwritten, as the request says.
 *
 * Stored on `promotion_requests` like a page push (`table_name = custom_interface_pages`, the
 * template page as `row_id`, `brand_id` = the template brand) under `field_name = 'edit'`, the
 * whole edit as JSON in `proposed_value`. No new column: this module is the one reader and writer
 * of that JSON, so the shape is checked here and nowhere else.
 */

/** The same table a page push names (`PAGE_PUSH_TABLE`); the edit kind's own field name. */
export const PAGE_EDIT_TABLE = 'custom_interface_pages';
export const PAGE_EDIT_FIELD = 'edit';

/** Every active client brand of the template, or an explicit list of child brand ids. */
export type PageEditTargets = 'all' | readonly string[];

export const PAGE_EDIT_CONFLICT_POLICIES = ['skip', 'overwrite'] as const;
export type PageEditConflictPolicy = (typeof PAGE_EDIT_CONFLICT_POLICIES)[number];
export const PAGE_EDIT_CONFLICT_DEFAULT: PageEditConflictPolicy = 'skip';

export function isPageEditConflictPolicy(value: unknown): value is PageEditConflictPolicy {
  return (PAGE_EDIT_CONFLICT_POLICIES as readonly unknown[]).includes(value);
}

/** What the dialog saved: the fields it posts for one page. */
export interface PageEditChanges {
  readonly title: string;
  readonly isVisible: boolean;
  readonly filterConfig?: CustomPageFilterConfig;
  readonly columnConfig?: readonly CustomPageColumnConfig[];
}

export interface PageEditPayload {
  readonly slug: string;
  readonly targets: PageEditTargets;
  readonly onConflict: PageEditConflictPolicy;
  readonly changes: PageEditChanges;
}

/** The stored name of each field an edit may touch — what `overridden_fields` lists. */
export const PAGE_EDIT_FIELD_NAMES = {
  title: 'title',
  isVisible: 'is_visible',
  filterConfig: 'filter_config',
  columnConfig: 'column_config',
} as const;
export type PageEditFieldName = (typeof PAGE_EDIT_FIELD_NAMES)[keyof typeof PAGE_EDIT_FIELD_NAMES];

export function serializePageEdit(payload: PageEditPayload): string {
  return JSON.stringify(payload);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isColumnConfig(value: unknown): value is CustomPageColumnConfig[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry['columnKey'] === 'string' &&
        typeof entry['displayLabel'] === 'string' &&
        typeof entry['displayOrder'] === 'number',
    )
  );
}

/** The stored JSON back as a payload; null for anything that is not one. */
export function parsePageEdit(text: string | null | undefined): PageEditPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text ?? '');
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const { slug, targets, onConflict, changes } = parsed;
  if (typeof slug !== 'string' || slug === '') return null;
  if (targets !== 'all' && !isStringArray(targets)) return null;
  if (!isPageEditConflictPolicy(onConflict)) return null;
  if (!isRecord(changes)) return null;
  if (typeof changes['title'] !== 'string' || typeof changes['isVisible'] !== 'boolean') {
    return null;
  }
  const out: { -readonly [K in keyof PageEditChanges]: PageEditChanges[K] } = {
    title: changes['title'],
    isVisible: changes['isVisible'],
  };
  if (changes['filterConfig'] !== undefined) {
    if (!isRecord(changes['filterConfig'])) return null;
    out.filterConfig = changes['filterConfig'] as CustomPageFilterConfig;
  }
  if (changes['columnConfig'] !== undefined) {
    if (!isColumnConfig(changes['columnConfig'])) return null;
    out.columnConfig = changes['columnConfig'];
  }
  return { slug, targets, onConflict, changes: out };
}

/** What a request row must carry for this module to read it. */
export interface PageEditRequestLike {
  readonly tableName: string;
  readonly fieldName: string;
  readonly proposedValue?: string | null;
}

/** The edit a request carries; null when the request is not a page edit. */
export function pageEditOf(request: PageEditRequestLike): PageEditPayload | null {
  if (request.tableName !== PAGE_EDIT_TABLE || request.fieldName !== PAGE_EDIT_FIELD) return null;
  return parsePageEdit(request.proposedValue);
}

/** How many brands an edit names, in words. */
export function pageEditTargetLabel(targets: PageEditTargets): string {
  if (targets === 'all') return 'every client brand';
  return `${String(targets.length)} client ${targets.length === 1 ? 'brand' : 'brands'}`;
}

export function pageEditPolicyLabel(policy: PageEditConflictPolicy): string {
  return policy === 'skip'
    ? "a brand's own value for a field is kept"
    : "a brand's own value for a field is overwritten";
}

/** What a target brand already keeps of its own, as the apply sees it. */
export interface PageEditTargetState {
  /** The brand's `overridden_fields` for the page, or every field when the page is the brand's own. */
  readonly overriddenFields: readonly string[];
  /** A standard tab: the brand has column definition rows of its own for the tab's columns. */
  readonly ownColumns: boolean;
}

/** The fields of the edit the target brand already keeps its own value for. */
export function pageEditConflicts(
  changes: PageEditChanges,
  target: PageEditTargetState,
): readonly PageEditFieldName[] {
  const kept = new Set(target.overriddenFields);
  const conflicts: PageEditFieldName[] = [];
  if (kept.has(PAGE_EDIT_FIELD_NAMES.title)) conflicts.push(PAGE_EDIT_FIELD_NAMES.title);
  if (kept.has(PAGE_EDIT_FIELD_NAMES.isVisible)) conflicts.push(PAGE_EDIT_FIELD_NAMES.isVisible);
  if (changes.filterConfig !== undefined && kept.has(PAGE_EDIT_FIELD_NAMES.filterConfig)) {
    conflicts.push(PAGE_EDIT_FIELD_NAMES.filterConfig);
  }
  if (
    changes.columnConfig !== undefined &&
    (kept.has(PAGE_EDIT_FIELD_NAMES.columnConfig) || target.ownColumns)
  ) {
    conflicts.push(PAGE_EDIT_FIELD_NAMES.columnConfig);
  }
  return conflicts;
}

/**
 * The part of the edit that applies to one target under the policy: everything on `overwrite`;
 * on `skip`, every field the brand does not already keep. Null when nothing is left to write.
 */
export function pageEditApplicable(
  changes: PageEditChanges,
  conflicts: readonly PageEditFieldName[],
  policy: PageEditConflictPolicy,
): Partial<PageEditChanges> | null {
  if (policy === 'overwrite') return changes;
  const skip = new Set<string>(conflicts);
  const out: { -readonly [K in keyof PageEditChanges]?: PageEditChanges[K] } = {};
  if (!skip.has(PAGE_EDIT_FIELD_NAMES.title)) out.title = changes.title;
  if (!skip.has(PAGE_EDIT_FIELD_NAMES.isVisible)) out.isVisible = changes.isVisible;
  if (changes.filterConfig !== undefined && !skip.has(PAGE_EDIT_FIELD_NAMES.filterConfig)) {
    out.filterConfig = changes.filterConfig;
  }
  if (changes.columnConfig !== undefined && !skip.has(PAGE_EDIT_FIELD_NAMES.columnConfig)) {
    out.columnConfig = changes.columnConfig;
  }
  return Object.keys(out).length === 0 ? null : out;
}
