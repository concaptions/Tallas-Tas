/**
 * RFC 4180 CSV serialisation (PRD §5: "make sure that there is an upload feature where the team can
 * upload bulk data. Build downloadable CSV templates").
 *
 * Pure: no I/O, no Blob, no DOM. The browser wraps the returned string in a Blob to trigger the
 * template download; a Server Action wraps the same string when it exports. Neither reimplements the
 * quoting rule.
 */

/** Everything a cell may hold. `null` and `undefined` both serialise to an empty field. */
export type CsvValue = string | number | null | undefined;

/**
 * A row is either positional (already in column order) or keyed by header name. Keyed rows are read
 * through `headers`, so the column order of the output is always the order of `headers`, whatever
 * order the object's own keys happen to be in.
 */
export type CsvRow = readonly CsvValue[] | Readonly<Record<string, CsvValue>>;

/** RFC 4180 §2.1: records are separated by CRLF. */
const RECORD_SEPARATOR = '\r\n';

/** A field must be quoted when it contains a comma, a double quote, CR or LF (RFC 4180 §2.6, §2.7). */
function needsQuoting(field: string): boolean {
  return field.includes(',') || field.includes('"') || field.includes('\r') || field.includes('\n');
}

function serialiseValue(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'number' ? String(value) : value;
}

/** Quotes the field when it needs it and doubles every inner quote (RFC 4180 §2.7). */
export function escapeCsvField(value: CsvValue): string {
  const field = serialiseValue(value);
  return needsQuoting(field) ? `"${field.replaceAll('"', '""')}"` : field;
}

function cellsFor(headers: readonly string[], row: CsvRow): CsvValue[] {
  if (Array.isArray(row)) {
    const positional = row as readonly CsvValue[];
    return headers.map((_header, index) => positional[index]);
  }
  const keyed = row as Readonly<Record<string, CsvValue>>;
  return headers.map((header) => keyed[header]);
}

/**
 * Builds an RFC 4180 document: the header row first, then one record per row, every record holding
 * exactly `headers.length` fields in `headers` order. There is no trailing separator, so a template
 * with no rows is exactly the header line — `toCsv(['name', 'link'], [])` is `'name,link'`.
 */
export function toCsv(headers: readonly string[], rows: readonly CsvRow[]): string {
  const lines = [headers.map(escapeCsvField).join(',')];
  for (const row of rows) {
    lines.push(cellsFor(headers, row).map(escapeCsvField).join(','));
  }
  return lines.join(RECORD_SEPARATOR);
}
