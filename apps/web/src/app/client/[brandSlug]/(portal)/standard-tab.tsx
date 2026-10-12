import { clientApprovalLabel, chipTone } from '@tas/domain/state';
import { StatusChip, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@tas/ui';

/**
 * A standard tab of the client portal, rendered from the brand's RESOLVED columns (Part A2,
 * 2026-10-12): `loadStandardTabRender` hands over the brand's client-visible, stored columns — in
 * the brand's order, under the brand's labels, which the Interface Config Edit dialog sets — and
 * the rows projected to exactly those keys. A cell is read-only text; the two client-approval
 * columns read as the one client vocabulary's label in a chip, never the stored key (SMOKE-33).
 */
export interface StandardTabRender {
  readonly columns: readonly { readonly columnKey: string; readonly displayLabel: string }[];
  readonly rows: readonly Record<string, unknown>[];
}

interface StandardTabProps {
  readonly title: string;
  /** Singular noun for the count line, e.g. "concept". */
  readonly noun: string;
  readonly emptyNote: string;
  readonly render: StandardTabRender;
}

export const EM_DASH = '—';

const CLIENT_VOCABULARY_COLUMNS = new Set(['client_status', 'client_approval_status']);

/** A jsonb-or-primitive cell as plain text; an object the table cannot read is an explicit dash. */
export function renderCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return EM_DASH;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map((v) => renderCell(v)).join(', ');
  return EM_DASH;
}

function Cell({ columnKey, value }: { columnKey: string; value: unknown }) {
  if (CLIENT_VOCABULARY_COLUMNS.has(columnKey) && typeof value === 'string' && value !== '') {
    const label = clientApprovalLabel(value);
    return <StatusChip label={label} tone={chipTone(label)} />;
  }
  return <>{renderCell(value)}</>;
}

export function StandardTab({ title, noun, emptyNote, render }: StandardTabProps) {
  const { columns, rows } = render;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-text">{title}</h1>
        <p className="text-sm text-text2">
          {rows.length === 0
            ? emptyNote
            : `${String(rows.length)} ${noun}${rows.length === 1 ? '' : 's'}`}
        </p>
      </div>
      {rows.length > 0 && columns.length > 0 ? (
        <div className="overflow-x-auto" data-slot="standard-tab-table">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.columnKey} data-column-key={column.columnKey}>
                    {column.displayLabel}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={typeof row['id'] === 'string' ? row['id'] : index}>
                  {columns.map((column) => (
                    <TableCell key={column.columnKey} className="text-sm text-text2">
                      <Cell columnKey={column.columnKey} value={row[column.columnKey]} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </>
  );
}
