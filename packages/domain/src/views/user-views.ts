import type { ViewType } from './table-views';

/**
 * Per-user saved views (Sprint 7, VIEWS-01). A view is one person's way of looking at one table:
 * the view type, which fields show, in what order, which are frozen, the sort and the search. It is
 * stored per Clerk user id + table key and never shared — the rows underneath are the same for
 * everyone; only the lens is personal. Everything here is a pure function over that config, so the
 * grid, the gallery and the Fields popover apply a view the same way and the unit tests pin it.
 */

export type SortDirection = 'asc' | 'desc';

export interface UserViewSort {
  readonly key: string;
  readonly direction: SortDirection;
}

export interface UserViewConfig {
  readonly viewType: ViewType;
  /** The field keys shown; `null` means every field (a new view hides nothing). */
  readonly visibleFields: readonly string[] | null;
  /** The field order; keys absent here keep the table's own order after the listed ones. */
  readonly fieldOrder: readonly string[];
  /** The frozen (sticky) field keys; empty means the table's own default (its name column). */
  readonly frozenFields: readonly string[];
  readonly sort: UserViewSort | null;
  /** The search query the view opens with. */
  readonly filter: string;
  /**
   * Which media column covers a gallery card, or `null` for the page's own default cover (action
   * item 16, "customise the card"). A RESOLVER column key, chosen from the table's declared
   * `galleryFields`, so a cover is always a column the brand actually resolves.
   */
  readonly coverField: string | null;
}

export interface UserView extends UserViewConfig {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
}

/** The limits a view name respects: a tab label, not a sentence. */
export const USER_VIEW_NAME_MAX = 60;

export interface UserViewNameValidation {
  readonly ok: boolean;
  readonly name: string;
  readonly error: string | null;
}

/** A view name is trimmed, non-empty and short enough to read as a tab. */
export function validateUserViewName(raw: string): UserViewNameValidation {
  const name = raw.trim();
  if (name === '') return { ok: false, name, error: 'Give the view a name.' };
  if (name.length > USER_VIEW_NAME_MAX) {
    return {
      ok: false,
      name,
      error: `Keep the name under ${String(USER_VIEW_NAME_MAX)} characters.`,
    };
  }
  return { ok: true, name, error: null };
}

/** What a new view starts from: the table's own default, nothing hidden, nothing sorted. */
export function defaultUserViewConfig(viewType: ViewType = 'grid'): UserViewConfig {
  return {
    viewType,
    visibleFields: null,
    fieldOrder: [],
    frozenFields: [],
    sort: null,
    filter: '',
    coverField: null,
  };
}

/** Narrows an unknown stored value to a config, field by field, so a bad row never crashes a page. */
export function parseUserViewConfig(
  value: Partial<Record<keyof UserViewConfig, unknown>>,
  fallbackViewType: ViewType = 'grid',
): UserViewConfig {
  const strings = (input: unknown): string[] =>
    Array.isArray(input) ? input.filter((entry): entry is string => typeof entry === 'string') : [];
  const viewType = value.viewType;
  const sort = value.sort;
  let sortValue: UserViewSort | null = null;
  if (typeof sort === 'object' && sort !== null && 'key' in sort && 'direction' in sort) {
    const { key, direction } = sort;
    if (typeof key === 'string' && (direction === 'asc' || direction === 'desc')) {
      sortValue = { key, direction };
    }
  }
  return {
    viewType:
      viewType === 'grid' ||
      viewType === 'kanban' ||
      viewType === 'gallery' ||
      viewType === 'timeline'
        ? viewType
        : fallbackViewType,
    visibleFields:
      value.visibleFields === null || value.visibleFields === undefined
        ? null
        : strings(value.visibleFields),
    fieldOrder: strings(value.fieldOrder),
    frozenFields: strings(value.frozenFields),
    sort: sortValue,
    filter: typeof value.filter === 'string' ? value.filter : '',
    // A stored cover is narrowed to "the page's default" unless it is a non-empty string. `''` is
    // not a column key, and reading it as one would ask the gallery for a cover that cannot exist.
    coverField:
      typeof value.coverField === 'string' && value.coverField !== '' ? value.coverField : null,
  };
}

export interface ViewField {
  readonly key: string;
  readonly frozen?: boolean;
}

/**
 * The fields a view shows, in the view's order, with the view's freeze applied.
 *
 * Order: the keys in `fieldOrder` first (unknown keys dropped), then every other field in the
 * table's own order — so a column added after the view was saved still appears. Visibility: a
 * `null` list shows everything; otherwise only the listed keys. Freeze: a non-empty `frozenFields`
 * replaces the table's default; an empty one keeps it. The first column is never hidden by a view
 * that would hide every column: an empty grid has no name column to click.
 *
 * THIS IS THE LAST WORD ON `frozen`. The caller's own freeze (`gridColumnsFrom`'s `freezeFirst`, the
 * table's default name column) has already been written onto the fields by the time they arrive
 * here, so the rule the two of them make together is: the VIEWER's freeze wins when they have made
 * one, and the table's default stands when `frozenFields` is empty. Two writers of one property is
 * only safe while the order is fixed and stated, which is why `resolved-columns.test.ts` asserts
 * both directions rather than leaving the precedence to whichever line was edited last.
 */
export function applyUserView<Field extends ViewField>(
  fields: readonly Field[],
  view: Pick<UserViewConfig, 'visibleFields' | 'fieldOrder' | 'frozenFields'>,
): Field[] {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const ordered: Field[] = [];
  for (const key of view.fieldOrder) {
    const field = byKey.get(key);
    if (field !== undefined && !ordered.includes(field)) ordered.push(field);
  }
  for (const field of fields) {
    if (!ordered.includes(field)) ordered.push(field);
  }
  const visible =
    view.visibleFields === null
      ? ordered
      : ordered.filter((field) => view.visibleFields?.includes(field.key));
  const shown = visible.length === 0 && ordered.length > 0 ? ordered.slice(0, 1) : visible;
  if (view.frozenFields.length === 0) return shown;
  return shown.map((field) => ({ ...field, frozen: view.frozenFields.includes(field.key) }));
}

/** Hides a shown field or shows a hidden one; `null` (everything) becomes an explicit list first. */
export function toggleViewField(
  view: Pick<UserViewConfig, 'visibleFields'>,
  key: string,
  allKeys: readonly string[],
): readonly string[] {
  const current = view.visibleFields ?? allKeys;
  return current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key];
}

/** Whether a field is shown under a view; everything is shown under `null`. */
/** `dayInTheLife` -> `day_in_the_life`, the spelling a Postgres column key uses. */
function toSnakeCase(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/**
 * Reconcile a SAVED `visibleFields` against the field keys a table actually has today.
 *
 * A view stores the keys of the columns it shows, so it is only meaningful while those keys exist.
 * The column-inheritance work changed the vocabulary underneath: a grid's keys used to be the
 * module's own camelCase field names (`dayInTheLife`, `stageOfAwareness`, `angles`) and are now the
 * resolver's column keys, which are Postgres column and junction names (`day_in_the_life`,
 * `stage_of_awareness`, `angle_personas`). `isViewFieldVisible` treats "not in the list" as hidden,
 * so a view saved before the change would have hidden EVERY column — a blank grid and empty gallery
 * cards, from a view the person had set up to show everything.
 *
 * Each stored key is therefore resolved in turn: used as-is when the table still has it, matched by
 * its snake_case spelling when that is what the key became, and dropped when neither exists (a
 * column that is gone, like the `updated` metadata column removed from every grid). Then:
 *
 * - `null` stays `null`. It means "no choice recorded", i.e. show everything.
 * - `[]` stays `[]`. An empty list is a real choice — the person hid every column one by one — and
 *   is distinguishable from staleness precisely because nothing was stored to go stale.
 * - A non-empty list that resolves to nothing becomes `null`. Every key it names belongs to a
 *   vocabulary the table no longer speaks, so it records no usable choice, and showing everything is
 *   the honest reading of that. Treating it as "hide all" would be inventing an intent.
 *
 * The next save writes the reconciled keys back, so a view migrates itself by being used.
 */
export function reconcileViewFields(
  visibleFields: readonly string[] | null,
  allKeys: readonly string[],
): readonly string[] | null {
  if (visibleFields === null) return null;
  if (visibleFields.length === 0) return [];
  const bySnakeCase = new Map(allKeys.map((key) => [toSnakeCase(key), key]));
  const resolved = [
    ...new Set(
      visibleFields.flatMap((stored) => {
        if (allKeys.includes(stored)) return [stored];
        const match = bySnakeCase.get(toSnakeCase(stored));
        return match === undefined ? [] : [match];
      }),
    ),
  ];
  return resolved.length === 0 ? null : resolved;
}

export function isViewFieldVisible(
  view: Pick<UserViewConfig, 'visibleFields'>,
  key: string,
): boolean {
  return view.visibleFields === null || view.visibleFields.includes(key);
}

/**
 * The freeze a "freeze up to and including this column" choice means (action item 22).
 *
 * A freeze is a PREFIX of the columns as the viewer sees them, never a scattered set: a sticky
 * column only reads as frozen when everything to its left is frozen too, so picking the third
 * column freezes the first three. `keys` is therefore the view's own order — what `applyUserView`
 * returned — not the table's declaration order.
 *
 * `null`, or a key the view does not show, returns an empty list, which `applyUserView` reads as
 * "the table's own default freeze" (its name column). That is deliberate: a table always has one
 * column worth pinning, and an empty list is the only value the stored config has ever used for it,
 * so clearing a freeze can never leave a grid with nothing pinned at all.
 */
export function freezeUpTo(keys: readonly string[], key: string | null): readonly string[] {
  if (key === null) return [];
  const index = keys.indexOf(key);
  return index === -1 ? [] : keys.slice(0, index + 1);
}

/**
 * The column a freeze control shows as chosen: the last one in the view's order that is frozen, or
 * `null` when the view carries no freeze of its own (the table's default is in force).
 *
 * Read from the end so a stored `frozenFields` that is NOT a clean prefix — a row written before
 * `freezeUpTo` existed, or hand-edited — still resolves to a single sensible choice rather than
 * refusing to render the control.
 */
export function frozenUpTo(
  keys: readonly string[],
  view: Pick<UserViewConfig, 'frozenFields'>,
): string | null {
  for (let index = keys.length - 1; index >= 0; index -= 1) {
    const key = keys[index];
    if (key !== undefined && view.frozenFields.includes(key)) return key;
  }
  return null;
}
