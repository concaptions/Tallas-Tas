import type { ChipTone } from '@tas/domain/state';

/**
 * The pure half of Column Admin: every decision this route makes that is not a database read and
 * not a React render (CLAUDE.md: components never contain business logic).
 *
 * Nothing here imports `@tas/db`, React or Clerk, so the client workspace, the Server Actions, the
 * sidebar and the unit tests all read the same rules from one module.
 *
 * WHY THE ROUTE'S PATH LIVES HERE rather than in `@/lib/routes`: the constant and the only two
 * things that need it (the sidebar entry and the E2E spec) ship in this ticket, and the route owns
 * it the way `propagation/fields.ts` owns its enforcement note. Moving it into the shared route
 * table is a one-line follow-up.
 */
export const columnAdminPath = '/app/column-admin';

/** What a base is called in the chooser when it is the parent template. */
export const TEMPLATE_BASE_LABEL = 'Parent template';

/** The table a visit with no `?table=` lands on: the one the column seed already covers. */
export const DEFAULT_TABLE_KEY = 'personas';

/** The sentence above the list: who the page is for and what a change here does. */
export const COLUMN_ADMIN_ADMIN_NOTE =
  'This page is admin only. A column on the parent template reaches every attached brand the next ' +
  'time it is read, for as long as that brand holds no definition of its own for it.';

/**
 * WHAT THE RESOLVER ACTUALLY DOES, said in the UI rather than implied by the chips.
 *
 * `resolveColumns` has ONE rule for a child: a local row wins, and the parent's row is used only
 * when there is no local row. It does not read `is_detached` as a condition anywhere, so a column
 * a brand has relabelled or moved has already stopped following the template whether or not it
 * carries the flag. Detach records the intent and is stored; it changes no read today, and that gap
 * is `packages/db`'s to close. The page says so instead of showing a difference that is not there.
 */
export const INHERITANCE_NOTE =
  'On a brand, a column follows the parent template only while this brand holds no definition of ' +
  'its own for it. Relabelling or moving a column creates that definition, so from then on this ' +
  'brand keeps its own label and position and later template edits to them do not apply — the ' +
  'Inheritance chip changes from “Following template” to “Local override” when it happens. Detach ' +
  'marks the column as deliberately held back and is recorded, but the resolver does not read the ' +
  'flag yet, so it changes no read on its own. Reattach is what puts a column back on the ' +
  'template track.';

/** Said in the relabel dialog when the column is still following the parent. */
export const LEAVES_TEMPLATE_WARNING =
  'This column is following the parent template. Saving a label here gives this brand its own ' +
  'definition of it, and later template edits to the label and position stop applying. Reattach ' +
  'puts it back.';

/** What the page says instead of the list when the guard refuses. */
export const COLUMN_ADMIN_NOT_ADMIN_NOTE =
  'Only an agency Admin can change column structure. Ask your Admin to add, hide, relabel or ' +
  'reorder a column.';

/** Said in both modes: the page gate is not the only gate. */
export const COLUMN_ADMIN_ENFORCEMENT_NOTE =
  'Both writes on this page check the same rule again on the server before they save.';

/** The warning the reattach confirmation carries, before the custom label and order are lost. */
export const REATTACH_WARNING =
  'Reattaching drops this brand’s own definition of the column: its custom label and position are ' +
  'lost and the template’s take over. The row is soft-deleted, so the choice is recoverable in the ' +
  'data, but it is gone from this view.';

/**
 * Hiding never drops data, and the way back is NOT "add it again".
 *
 * The resolver filters hidden rows out, so this list cannot show what it hides, and re-adding a key
 * by hand would resurrect the row as a locally added column — `source: 'custom'` on a column the
 * parent owns, which the schema forbids and which can then never be put back on the template track.
 * On a brand there is a safe way back, because the parent's own resolved set still has the column:
 * that is the Restore list below. On the parent template there is no second source to read it from,
 * so unhiding there needs a `listColumnDefinitions` read that `packages/db` does not expose yet.
 */
export const HIDE_NOTE =
  'A hidden column leaves this list and keeps its data. On a brand, a hidden template column comes ' +
  'back from the Restore list below. A column hidden on the parent template cannot be brought back ' +
  'from this page yet.';

/** The heading and the sentence above the restore list. */
export const RESTORE_NOTE =
  'These columns exist on the parent template but this brand does not show them. Restoring one ' +
  'writes the template’s own label, position and type back onto this brand.';

/**
 * What demo mode adds to the note. The fixtures have no database to resolve inheritance against,
 * so the list is what each base DEFINES rather than what it resolves to, and the role check is
 * stubbed as an admin rather than skipped — the same wording `/app/propagation` uses.
 */
export const DEMO_COLUMN_ADMIN_NOTE =
  'Demo mode signs you in as an Admin, so the controls show; the role check is stubbed, not ' +
  'skipped. Each base lists the columns it defines — inheritance is resolved against the database.';

/** One base an admin can configure: the parent template, or one of its brands. */
export interface ColumnAdminBase {
  readonly id: string;
  readonly name: string;
  readonly isTemplate: boolean;
}

/**
 * One column as `resolveColumns` returned it. Structural on purpose — declared here rather than
 * imported from `@tas/db`, so the client component can take it without pulling the database package
 * into the browser bundle, exactly as `ResolvedColumnView` does for the grid adapter.
 */
export interface ResolvedColumnView {
  readonly columnKey: string;
  readonly displayLabel: string;
  readonly displayOrder: number;
  readonly fieldType: string | null;
  readonly source: 'parent' | 'custom' | 'platform';
  readonly isDetached: boolean;
  readonly inheritedFrom: string | null;
}

/**
 * Where a column's definition comes from, which is the one thing this page exists to show.
 *
 * `master` is reserved for the parent base, where "following the template" is meaningless: those
 * rows ARE the template. On a child the four others read back what this base holds: no local row at
 * all (`inherited`), a local row for a column the parent does not have (`custom`), and a local row
 * for a parent column either with the detach flag (`detached`) or without it (`overriding`).
 *
 * `overriding` and `detached` behave IDENTICALLY in the resolver — both are simply "a local row" —
 * so the two labels distinguish how the row got there, not what a read does with it. `INHERITANCE_NOTE`
 * says that in the UI rather than letting the chips imply a difference the code does not have.
 */
export type ColumnOrigin = 'master' | 'inherited' | 'overriding' | 'detached' | 'custom';

/**
 * What the platform marker means, said on the page rather than left for an admin to infer. The two
 * approval tracks and the generated names are columns the platform owns, so they appear on every
 * base and are not Airtable fields anyone could re-import or declare away.
 */
export const PLATFORM_NOTE =
  'This platform defines this column — the approval tracks and the generated names. It is not an ' +
  'Airtable field, and every base has it. Relabel or reorder it freely; hiding it only changes ' +
  'this grid, never the approval rules behind it.';

/** The marker's own label and tone, read from here so the page never spells either inline. */
export const PLATFORM_LABEL = 'Platform';
export const PLATFORM_TONE: ChipTone = 'info';

export const ORIGIN_LABEL: Record<ColumnOrigin, string> = {
  master: 'Master',
  inherited: 'Following template',
  overriding: 'Local override',
  detached: 'Detached',
  custom: 'Added here',
};

/** Tones come from the chip vocabulary, never from a colour decision in a component. */
export const ORIGIN_TONE: Record<ColumnOrigin, ChipTone> = {
  master: 'accent',
  inherited: 'info',
  overriding: 'mute',
  detached: 'warn',
  custom: 'ok',
};

/**
 * Read the origin back off one resolved column. `inheritedFrom` is the parent brand the row was
 * read from, so a non-null value means this base holds no row of its own for the column.
 */
export function columnOrigin(column: ResolvedColumnView, isTemplateBase: boolean): ColumnOrigin {
  if (isTemplateBase) return 'master';
  if (column.inheritedFrom !== null) return 'inherited';
  // `custom` is read BEFORE `detached`, and the order matters: the seed marks Gratsi's own `passion`
  // as both, and a column the parent does not have is not detached from anything. Reading it as
  // detached would offer a Reattach that has no parent row to fall back on, so the column would
  // disappear from the view instead of snapping back.
  if (column.source === 'custom') return 'custom';
  return column.isDetached ? 'detached' : 'overriding';
}

/** A resolved column plus the two answers the controls need. */
export interface ColumnAdminRow extends ResolvedColumnView {
  readonly origin: ColumnOrigin;
  /**
   * A column the PLATFORM owns, which Airtable has no field for: the two approval tracks and the
   * generated names (CLAUDE.md non-negotiables 4 and 6). Reported separately from `origin` rather
   * than folded into it, because the two answer different questions — `origin` says where the row
   * lives and decides whether Detach and Reattach apply, which platform columns follow like any
   * other inherited column, while this says who the column belongs to. An admin seeing "Following
   * template" against Internal Status should still be told the platform defines it.
   */
  readonly isPlatform: boolean;
  /** Detaching needs a parent to stop following, and a row that is not detached already. */
  readonly canDetach: boolean;
  /** Reattaching needs a local row to drop; an inherited column has none. */
  readonly canReattach: boolean;
}

export function toColumnAdminRows(
  columns: readonly ResolvedColumnView[],
  isTemplateBase: boolean,
): readonly ColumnAdminRow[] {
  return columns.map((column) => {
    const origin = columnOrigin(column, isTemplateBase);
    return {
      ...column,
      origin,
      isPlatform: column.source === 'platform',
      canDetach: !isTemplateBase && origin !== 'detached' && origin !== 'custom',
      canReattach: !isTemplateBase && origin !== 'inherited' && origin !== 'custom',
    };
  });
}

/** The full state one upsert writes: the row as it should be after the change. */
export interface ColumnWrite {
  readonly columnKey: string;
  readonly displayLabel: string;
  readonly displayOrder: number;
  readonly isHidden: boolean;
  readonly isDetached: boolean;
  readonly fieldType: string | null;
  readonly source: 'parent' | 'custom' | 'platform';
}

/**
 * What `source` a write should carry — the rule `saveColumnsAction` applies, as a pure function so
 * it is tested without a database or a session.
 *
 * The submitted value is not trusted, because `source` decides whether Detach and Reattach can ever
 * apply again and a wrong one strands the column:
 *
 * - A PLATFORM column stays `platform` wherever it is written. The platform owns the approval tracks
 *   and the generated names; relabelling one on a brand does not transfer ownership, and the brand
 *   must keep being told. It behaves like `parent` for Detach and Reattach regardless, because the
 *   template does define the key.
 * - On the TEMPLATE base every column IS the master set, so `parent`.
 * - On a child, any key the parent defines is `parent`: a child's override of a parent column is an
 *   override, and a `custom` row for it could never be detached or reattached again.
 * - Only a key the parent does not have keeps what was submitted, which is the one case where
 *   `custom` is the truth.
 */
export function sourceForWrite(args: {
  readonly columnKey: string;
  readonly submitted: 'parent' | 'custom' | 'platform';
  readonly isTemplateBase: boolean;
  readonly parentKeys: ReadonlySet<string>;
  readonly platformKeys: ReadonlySet<string>;
}): 'parent' | 'custom' | 'platform' {
  if (args.platformKeys.has(args.columnKey)) return 'platform';
  if (args.isTemplateBase || args.parentKeys.has(args.columnKey)) return 'parent';
  return args.submitted;
}

/**
 * One column as it stands, ready to be changed. `upsertColumnDefinition` REPLACES the row, so every
 * write carries the whole state and a change is "this row, with one field different".
 */
export function writeOf(row: ColumnAdminRow, change: Partial<ColumnWrite> = {}): ColumnWrite {
  return {
    columnKey: row.columnKey,
    displayLabel: row.displayLabel,
    displayOrder: row.displayOrder,
    isHidden: false,
    isDetached: row.isDetached,
    fieldType: row.fieldType,
    source: row.source,
    ...change,
  };
}

/**
 * The columns the parent template has that this brand does not show: the only safe "add" this page
 * offers, and the one honest way back from Hide on a brand.
 *
 * Because the resolver omits a hidden row, a key in the parent's resolved set that is missing from
 * this base's is exactly a column this base has hidden. Restoring it writes the PARENT'S row back —
 * its label, its position, its type, `source: 'parent'`, not detached — so the metadata the page
 * exists to display stays true and the column can still be detached or reattached afterwards.
 *
 * On the parent base there is no second source to read from, so the list is empty there by
 * construction: `parentColumns` and `columns` are then the same set.
 */
export function restorableColumns(
  parentColumns: readonly ResolvedColumnView[],
  columns: readonly ResolvedColumnView[],
): readonly ResolvedColumnView[] {
  const shown = new Set(columns.map((column) => column.columnKey));
  return parentColumns.filter((column) => !shown.has(column.columnKey));
}

/** The write that restores one parent column onto a brand: the parent's row, unhidden. */
export function restoreWriteOf(parentColumn: ResolvedColumnView): ColumnWrite {
  return {
    columnKey: parentColumn.columnKey,
    displayLabel: parentColumn.displayLabel,
    displayOrder: parentColumn.displayOrder,
    isHidden: false,
    isDetached: false,
    fieldType: parentColumn.fieldType,
    source: 'parent',
  };
}

const byOrder = (left: ColumnAdminRow, right: ColumnAdminRow): number =>
  left.displayOrder - right.displayOrder || left.columnKey.localeCompare(right.columnKey);

/**
 * Move one column one place up or down, and return ONLY the rows whose `display_order` has to
 * change — two of them in the ordinary case, because the pair simply swaps numbers.
 *
 * A table whose numbers are not distinct cannot be reordered by swapping values (the resolver
 * tie-breaks on `column_key`, so a tie would not move anything), so a list with any duplicate
 * renumbers to 1..n instead and still reports only the rows that actually moved. An impossible move
 * — the first row up, the last row down, an unknown key — writes nothing.
 */
export function moveColumn(
  rows: readonly ColumnAdminRow[],
  columnKey: string,
  direction: 'up' | 'down',
): readonly ColumnWrite[] {
  const ordered = [...rows].sort(byOrder);
  const index = ordered.findIndex((row) => row.columnKey === columnKey);
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  const moved = ordered[index];
  const displaced = ordered[targetIndex];
  if (moved === undefined || displaced === undefined) return [];

  const distinct = new Set(ordered.map((row) => row.displayOrder)).size === ordered.length;
  if (distinct) {
    return [
      writeOf(moved, { displayOrder: displaced.displayOrder }),
      writeOf(displaced, { displayOrder: moved.displayOrder }),
    ];
  }

  const swapped = [...ordered];
  swapped[index] = displaced;
  swapped[targetIndex] = moved;
  return swapped
    .map((row, position) => ({ row, order: position + 1 }))
    .filter(({ row, order }) => row.displayOrder !== order)
    .map(({ row, order }) => writeOf(row, { displayOrder: order }));
}

/** What a label may be. Returned as a sentence, or null when the label is fine. */
export function labelProblem(label: string): string | null {
  const trimmed = label.trim();
  if (trimmed.length === 0) return 'A label is required.';
  if (trimmed.length > 120) return 'Keep the label under 120 characters.';
  return null;
}

/** A query-string value, which Next hands over as a string, a repeat, or nothing. */
export type QueryValue = string | string[] | undefined;

function one(value: QueryValue): string | null {
  if (typeof value === 'string') return value;
  return value?.[0] ?? null;
}

/**
 * The base the address asks for, honoured only when it is one the agency actually has. Anything
 * else — a stale link, a forged id, another agency's brand — falls back to the parent template, so
 * no unchecked id ever reaches a query.
 */
export function resolveBaseId(
  requested: QueryValue,
  bases: readonly ColumnAdminBase[],
): string | null {
  const asked = one(requested);
  const match = asked === null ? undefined : bases.find((base) => base.id === asked);
  return match?.id ?? bases.find((base) => base.isTemplate)?.id ?? bases[0]?.id ?? null;
}

/** The table the address asks for, honoured only when the product has it. */
export function resolveTableKey(requested: QueryValue, tables: readonly string[]): string {
  const asked = one(requested);
  if (asked !== null && tables.includes(asked)) return asked;
  return tables.includes(DEFAULT_TABLE_KEY) ? DEFAULT_TABLE_KEY : (tables[0] ?? DEFAULT_TABLE_KEY);
}

/** One seed row, structurally: `UpsertColumnDefinition` as this module needs to read it. */
export interface SeedRowLike {
  readonly tableKey: string;
  readonly columnKey: string;
  readonly displayLabel: string;
  readonly displayOrder: number;
  readonly isHidden?: boolean;
  readonly isDetached?: boolean;
  readonly fieldType?: string | null;
  readonly source?: 'parent' | 'custom' | 'platform';
}

export interface SeedGroupLike {
  readonly target: { readonly kind: 'parent' } | { readonly kind: 'slug'; readonly slug: string };
  readonly rows: readonly SeedRowLike[];
}

/** The id demo mode gives the parent base, where there is no brand row to carry a uuid. */
export const SEED_PARENT_BASE_ID = 'parent';

/** Which base a seed group is for, as the demo chooser addresses it. */
export function seedBaseId(group: SeedGroupLike): string {
  return group.target.kind === 'parent' ? SEED_PARENT_BASE_ID : group.target.slug;
}

/**
 * The keys one base's seed marks HIDDEN for a table — demo mode's stand-in for the rows the
 * resolver filters out. It is what makes the demo Restore list honest: without it the list would be
 * "every parent column this base has no seed row for", which in the fixtures includes the columns a
 * base simply INHERITS, and offering to restore those would say a base hides a column it shows.
 */
export function seedHiddenColumnKeys(
  groups: readonly SeedGroupLike[],
  baseId: string,
  tableKey: string,
): readonly string[] {
  return groups
    .filter((group) => seedBaseId(group) === baseId)
    .flatMap((group) => group.rows)
    .filter((row) => row.tableKey === tableKey && row.isHidden === true)
    .map((row) => row.columnKey);
}

/**
 * Demo mode's columns: what the seed says a base DEFINES for one table.
 *
 * It deliberately does not merge a child with the parent. Inheritance is resolved by reading the
 * parent inside `resolveColumns`, and a second merge written here would be a second definition of
 * the rule — the page says so in its demo note instead. Hidden rows are left out, which is the one
 * thing it does copy from the resolver, because a hidden column is not part of a base's view.
 */
export function seedColumnsFor(
  groups: readonly SeedGroupLike[],
  baseId: string,
  tableKey: string,
): readonly ResolvedColumnView[] {
  return groups
    .filter((group) => seedBaseId(group) === baseId)
    .flatMap((group) => group.rows)
    .filter((row) => row.tableKey === tableKey && row.isHidden !== true)
    .map((row) => ({
      columnKey: row.columnKey,
      displayLabel: row.displayLabel,
      displayOrder: row.displayOrder,
      fieldType: row.fieldType ?? null,
      source: row.source ?? 'parent',
      isDetached: row.isDetached ?? false,
      inheritedFrom: null,
    }))
    .sort(
      (left, right) =>
        left.displayOrder - right.displayOrder || left.columnKey.localeCompare(right.columnKey),
    );
}
