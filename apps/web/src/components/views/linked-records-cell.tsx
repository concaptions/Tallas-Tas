import type { ColumnRenderer } from './resolved-columns';
import { EmptyCell } from './grid-cells';

/**
 * THE read-only "linked records" grid cell (GRATSI-MATCH, 2026-10-04).
 *
 * Airtable shows a reverse link — the far side of a junction or foreign key another table owns — as
 * a row of linked record names. The platform showed those only on the record page (AI-43's panel
 * display); the strict Gratsi-matches-Airtable rule asks for read-only GRID columns too, and this is
 * the ONE cell they all render through, so six tables cannot grow six slightly different readings
 * of "a list of linked names". Nothing here writes: the cell takes finished `{ label, href }` data
 * the server page already built for its panel, and a column rendered by it never has a form control.
 *
 * `mono` is for GENERATED names — a concept's Batch-Angle-Theme, a brief's §7 name — which CLAUDE.md
 * UI governance says always render in `font-mono`. A linked record with an `href` renders as a real
 * anchor (cmd-clickable, copyable) that stops propagation so the row's own click does not fire
 * underneath it, exactly as the generated-name links in the Concepts and Creative Design grids do.
 */
export interface LinkedRecordRef {
  readonly id: string;
  readonly label: string;
  readonly href?: string | null;
}

/** How many linked names a cell shows before the rest collapse into `+N` (full list in the title). */
const MAX_CELL_RECORDS = 3;

export function linkedRecordsTitle(records: readonly LinkedRecordRef[]): string | undefined {
  if (records.length === 0) return undefined;
  return records.map((record) => record.label).join(', ');
}

export function LinkedRecordsCell({
  records,
  mono = false,
}: {
  readonly records: readonly LinkedRecordRef[];
  readonly mono?: boolean;
}) {
  if (records.length === 0) return <EmptyCell />;
  const shown = records.slice(0, MAX_CELL_RECORDS);
  const overflow = records.length - shown.length;
  const labelClass = mono ? 'font-mono text-xs' : 'text-xs';
  return (
    <span
      className="flex items-center gap-1.5"
      title={linkedRecordsTitle(records)}
      data-slot="linked-records"
    >
      {shown.map((record, index) => (
        <span key={record.id} className="flex min-w-0 items-center gap-1.5">
          {record.href === undefined || record.href === null ? (
            <span className={`${labelClass} max-w-40 truncate`}>{record.label}</span>
          ) : (
            <a
              href={record.href}
              className={`${labelClass} max-w-40 truncate text-text2 underline decoration-line hover:text-text`}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              {record.label}
            </a>
          )}
          {index < shown.length - 1 ? <span className="text-text4">·</span> : null}
        </span>
      ))}
      {overflow > 0 ? <span className="font-mono text-[11px] text-text3">+{overflow}</span> : null}
    </span>
  );
}

/**
 * A registry entry for one reverse-link column: the cell above over whatever list `read` picks off
 * the row, sorted by how many records link it, the whole name list in the cell title. The page
 * builds these inside the component because the linked-record indexes arrive as props.
 */
export function linkedRecordsRenderer<Row>(
  read: (row: Row) => readonly LinkedRecordRef[],
  options: { readonly mono?: boolean } = {},
): ColumnRenderer<Row> {
  return {
    render: (row) => <LinkedRecordsCell records={read(row)} mono={options.mono ?? false} />,
    sortValue: (row) => read(row).length,
    cellTitle: (row) => linkedRecordsTitle(read(row)),
  };
}
