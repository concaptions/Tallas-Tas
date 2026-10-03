'use client';

import Link from 'next/link';
import { startTransition, useActionState, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DisabledWrite,
  Input,
  StatusChip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  disabledWriteClassName,
} from '@tas/ui';

import { reattachColumnAction, saveColumnsAction, type ColumnActionResult } from './actions';
import {
  COLUMN_ADMIN_ENFORCEMENT_NOTE,
  HIDE_NOTE,
  INHERITANCE_NOTE,
  LEAVES_TEMPLATE_WARNING,
  ORIGIN_LABEL,
  ORIGIN_TONE,
  REATTACH_WARNING,
  RESTORE_NOTE,
  columnAdminPath,
  labelProblem,
  moveColumn,
  restoreWriteOf,
  writeOf,
  type ColumnAdminBase,
  type ColumnAdminRow,
  type ColumnWrite,
  type ResolvedColumnView,
} from './fields';

/**
 * Column Admin's workspace: the chosen base, the chosen table, and one row per resolved column with
 * the controls that change its structure.
 *
 * NO RULE IS RESTATED HERE. Where a column comes from is `columnOrigin`, what can be brought back
 * is `restorableColumns` and what that write looks like is `restoreWriteOf`, a move is `moveColumn`,
 * and what is valid is `labelProblem` — all pure functions in `fields.ts`, all unit tested. This
 * component owns exactly three things that are not rules: which dialog is open, what is typed in it,
 * and which submission is in flight.
 *
 * THERE IS NO FREE-TEXT "ADD COLUMN". A `column_definitions` row for a key the table does not store
 * is a column the grid adapter has to drop (`gridColumnsFrom` returns it in `missing`), so this page
 * only ever writes keys the resolver already returns: this base's own columns, and — on a brand —
 * the parent template's, which is what Restore offers. Declaring a genuinely new field is
 * `/app/propagation`'s custom-field path, and the Server Action refuses any other key again.
 *
 * THE CHOOSERS ARE THE ADDRESS. Base and table are `?base=` and `?table=` links rather than client
 * state, because they change which ROWS exist: the server resolves one base's columns and hands down
 * exactly those, so a view is a link you can paste, and an unknown value falls back to the template
 * rather than throwing.
 *
 * EVERY WRITE CARRIES THE WHOLE ROW, because `upsertColumnDefinition` replaces it. A change is
 * therefore `writeOf(row, { oneField })` and never a hand-built object, which is what keeps "hide"
 * from quietly also clearing a label.
 *
 * IN DEMO MODE EVERY CONTROL IS DISABLED, through `DisabledWrite` + `disabledWriteClassName` with
 * the shared tooltip, and both actions refuse again on the server before any validation, actor
 * lookup or connection.
 */
export interface ColumnAdminWorkspaceProps {
  readonly bases: readonly ColumnAdminBase[];
  readonly tables: readonly string[];
  readonly baseId: string | null;
  readonly tableKey: string;
  readonly isTemplateBase: boolean;
  readonly rows: readonly ColumnAdminRow[];
  /** Parent columns this base hides, from `restorableColumns`. Always empty on the parent base. */
  readonly restorable: readonly ResolvedColumnView[];
  readonly demo: boolean;
  readonly adminNote: string;
  readonly demoNote: string | null;
}

/** One option of a chooser: the view it leads to, and whether it is the one in view. */
interface ChooserOption {
  readonly key: string;
  readonly label: string;
  readonly href: string;
  readonly active: boolean;
}

interface ChooserProps {
  readonly id: string;
  readonly heading: string;
  /** The `data-slot` each option carries, so a test can address one chooser's options. */
  readonly slot: string;
  readonly options: readonly ChooserOption[];
  readonly mono?: boolean;
}

/**
 * A row of links that changes which rows the server resolves. Base and table are the same control
 * twice, so they are the same component twice: the chooser is a navigation, never client state.
 */
function Chooser({ id, heading, slot, options, mono = false }: ChooserProps) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="text-sm font-medium text-text2">
        {heading}
      </h2>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.key}
            asChild
            size="sm"
            variant={option.active ? 'secondary' : 'outline'}
            className="h-8 max-w-full truncate"
          >
            <Link
              href={option.href}
              data-slot={slot}
              data-option={option.key}
              data-active={option.active}
              aria-current={option.active ? 'page' : undefined}
              className={mono ? 'font-mono text-xs' : undefined}
            >
              {option.label}
            </Link>
          </Button>
        ))}
      </div>
    </section>
  );
}

interface WriteButtonProps {
  readonly label: string;
  readonly ariaLabel?: string;
  readonly demo: boolean;
  readonly busy: boolean;
  readonly variant?: 'outline' | 'ghost';
  readonly onClick: () => void;
}

/**
 * Every control on this page that would write. There is exactly one of these, because in demo mode
 * all of them are disabled AND have to say why: `DisabledWrite` carries the tooltip, since a
 * disabled button receives no pointer events and its own `title` would never open.
 */
function WriteButton({
  label,
  ariaLabel,
  demo,
  busy,
  variant = 'ghost',
  onClick,
}: WriteButtonProps) {
  return (
    <DisabledWrite active={demo}>
      <Button
        size="sm"
        variant={variant}
        aria-label={ariaLabel}
        className={demo ? disabledWriteClassName : undefined}
        disabled={demo || busy}
        onClick={onClick}
      >
        {label}
      </Button>
    </DisabledWrite>
  );
}

function viewHref(baseId: string, tableKey: string): string {
  return `${columnAdminPath}?base=${encodeURIComponent(baseId)}&table=${encodeURIComponent(tableKey)}`;
}

export function ColumnAdminWorkspace({
  bases,
  tables,
  baseId,
  tableKey,
  isTemplateBase,
  rows,
  restorable,
  demo,
  adminNote,
  demoNote,
}: ColumnAdminWorkspaceProps) {
  const [renaming, setRenaming] = useState<ColumnAdminRow | null>(null);
  const [label, setLabel] = useState('');
  const [reattaching, setReattaching] = useState<ColumnAdminRow | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const [saveResult, save, saving] = useActionState<ColumnActionResult | null, FormData>(
    saveColumnsAction,
    null,
  );
  const [reattachResult, reattach, reattachPending] = useActionState<
    ColumnActionResult | null,
    FormData
  >(reattachColumnAction, null);

  const busy = saving || reattachPending;
  const error =
    problem ??
    (saveResult !== null && !saveResult.ok ? saveResult.error : null) ??
    (reattachResult !== null && !reattachResult.ok ? reattachResult.error : null);

  function submit(columns: readonly ColumnWrite[]): void {
    if (baseId === null || columns.length === 0) return;
    setProblem(null);
    const data = new FormData();
    data.set('payload', JSON.stringify({ baseId, tableKey, columns }));
    startTransition(() => {
      save(data);
    });
  }

  function confirmReattach(): void {
    if (baseId === null || reattaching === null) return;
    const data = new FormData();
    data.set('payload', JSON.stringify({ baseId, tableKey, columnKey: reattaching.columnKey }));
    setReattaching(null);
    startTransition(() => {
      reattach(data);
    });
  }

  function saveLabel(): void {
    if (renaming === null) return;
    const invalid = labelProblem(label);
    if (invalid !== null) {
      setProblem(invalid);
      return;
    }
    const row = renaming;
    setRenaming(null);
    submit([writeOf(row, { displayLabel: label.trim() })]);
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Settings</p>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Column Admin</h1>
        <div
          data-slot="admin-note"
          className="flex max-w-prose flex-col gap-2 rounded-card border border-line bg-surface2 p-4"
        >
          <p className="text-sm text-text3">{adminNote}</p>
          {isTemplateBase ? null : (
            <p data-slot="inheritance-note" className="text-xs text-text3">
              {INHERITANCE_NOTE}
            </p>
          )}
          {demoNote === null ? null : <p className="text-xs text-text4">{demoNote}</p>}
          <p className="text-xs text-text4">{COLUMN_ADMIN_ENFORCEMENT_NOTE}</p>
        </div>
      </header>

      <Chooser
        id="base-chooser"
        heading="Base"
        slot="base-option"
        options={bases.map((base) => ({
          key: base.id,
          label: base.isTemplate ? `${base.name} ★` : base.name,
          href: viewHref(base.id, tableKey),
          active: base.id === baseId,
        }))}
      />

      <Chooser
        id="table-chooser"
        heading="Table"
        slot="table-option"
        mono
        options={tables.map((key) => ({
          key,
          label: key,
          href: baseId === null ? columnAdminPath : viewHref(baseId, key),
          active: key === tableKey,
        }))}
      />

      <section aria-labelledby="columns-heading" className="flex min-w-0 flex-col gap-3">
        <h2 id="columns-heading" className="text-sm font-medium text-text2">
          Columns
        </h2>

        <p className="text-xs text-text4">{HIDE_NOTE}</p>

        {error === null ? null : (
          <p data-slot="column-admin-error" className="text-sm text-bad">
            {error}
          </p>
        )}

        <div className="rounded-card border border-line">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Order</TableHead>
                <TableHead>Column</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Inheritance</TableHead>
                <TableHead className="w-64" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-text3">
                    No columns are configured for this table on this base yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.columnKey} data-slot="column-row" data-column={row.columnKey}>
                    <TableCell className="font-mono text-xs text-text3">
                      {row.displayOrder}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.columnKey}</TableCell>
                    <TableCell className="text-sm">{row.displayLabel}</TableCell>
                    <TableCell className="text-xs text-text3">{row.fieldType ?? '—'}</TableCell>
                    <TableCell>
                      <StatusChip tone={ORIGIN_TONE[row.origin]} label={ORIGIN_LABEL[row.origin]} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <WriteButton
                          label="↑"
                          ariaLabel={`Move ${row.columnKey} up`}
                          demo={demo}
                          busy={busy}
                          onClick={() => {
                            submit(moveColumn(rows, row.columnKey, 'up'));
                          }}
                        />
                        <WriteButton
                          label="↓"
                          ariaLabel={`Move ${row.columnKey} down`}
                          demo={demo}
                          busy={busy}
                          onClick={() => {
                            submit(moveColumn(rows, row.columnKey, 'down'));
                          }}
                        />
                        <WriteButton
                          label="Relabel"
                          demo={demo}
                          busy={busy}
                          onClick={() => {
                            setProblem(null);
                            setLabel(row.displayLabel);
                            setRenaming(row);
                          }}
                        />
                        <WriteButton
                          label="Hide"
                          demo={demo}
                          busy={busy}
                          onClick={() => {
                            submit([writeOf(row, { isHidden: true })]);
                          }}
                        />
                        {row.canDetach ? (
                          <WriteButton
                            label="Detach"
                            demo={demo}
                            busy={busy}
                            onClick={() => {
                              submit([writeOf(row, { isDetached: true })]);
                            }}
                          />
                        ) : null}
                        {row.canReattach ? (
                          <WriteButton
                            label="Reattach"
                            demo={demo}
                            busy={busy}
                            onClick={() => {
                              setProblem(null);
                              setReattaching(row);
                            }}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {isTemplateBase || restorable.length === 0 ? null : (
        <section aria-labelledby="restore-heading" className="flex min-w-0 flex-col gap-3">
          <h2 id="restore-heading" className="text-sm font-medium text-text2">
            Restore a template column
          </h2>
          <p className="text-xs text-text4">{RESTORE_NOTE}</p>
          <div className="flex flex-wrap gap-2">
            {restorable.map((column) => (
              <WriteButton
                key={column.columnKey}
                label={`Restore ${column.displayLabel}`}
                ariaLabel={`Restore ${column.columnKey}`}
                variant="outline"
                demo={demo}
                busy={busy}
                onClick={() => {
                  submit([restoreWriteOf(column)]);
                }}
              />
            ))}
          </div>
        </section>
      )}

      <Dialog
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) setRenaming(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Relabel this column</DialogTitle>
            <DialogDescription>
              The key <span className="font-mono">{renaming?.columnKey}</span> never changes; the
              label is what this base displays.
            </DialogDescription>
            {renaming?.origin === 'inherited' ? (
              <DialogDescription data-slot="leaves-template-warning">
                {LEAVES_TEMPLATE_WARNING}
              </DialogDescription>
            ) : null}
          </DialogHeader>
          <Input
            aria-label="Column label"
            value={label}
            onChange={(event) => {
              setLabel(event.target.value);
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRenaming(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={saveLabel} disabled={busy}>
              {saving ? 'Saving…' : 'Save label'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reattaching !== null}
        onOpenChange={(open) => {
          if (!open) setReattaching(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Follow the template again?</DialogTitle>
            <DialogDescription data-slot="reattach-warning">{REATTACH_WARNING}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReattaching(null);
              }}
            >
              Keep this base’s version
            </Button>
            <Button onClick={confirmReattach} disabled={busy}>
              {reattachPending ? 'Reattaching…' : 'Reattach'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
