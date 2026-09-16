/**
 * RFC 4180 CSV parsing for the bulk upload flow (PRD §5). Pure: it takes the text of a file that
 * something else already read, and returns rows. It never touches a File, a stream or the network.
 *
 * Deliberately tolerant, because the file comes from a spreadsheet export a human made:
 * - CRLF, LF and lone CR all end a record;
 * - a leading UTF-8 BOM (Excel writes one) is stripped;
 * - blank lines are skipped rather than returned as a one-empty-field row;
 * - ragged records are returned with the field count they actually had. Column alignment is
 *   `matchColumns`' job, not the tokeniser's.
 */

export interface ParsedCsv {
  /** The first non-blank record, verbatim (not trimmed, not lower-cased). Empty for empty input. */
  readonly headers: readonly string[];
  /** Every record after the header, positional — `rows[r][c]` is the field under `headers[c]`. */
  readonly rows: readonly (readonly string[])[];
}

function stripBom(text: string): string {
  return text.startsWith('﻿') ? text.slice(1) : text;
}

/** A record of exactly one empty, never-quoted field is a blank line, not a row of data. */
function isBlankRecord(record: readonly string[], hadQuotes: boolean): boolean {
  return !hadQuotes && record.length === 1 && record[0] === '';
}

function readRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  let hadQuotes = false;
  let index = 0;

  const endField = (): void => {
    record.push(field);
    field = '';
  };
  const endRecord = (): void => {
    endField();
    if (!isBlankRecord(record, hadQuotes)) records.push(record);
    record = [];
    hadQuotes = false;
  };

  while (index < text.length) {
    const char = text.charAt(index);

    if (inQuotes) {
      if (char === '"') {
        // A doubled quote inside a quoted field is one literal quote (RFC 4180 §2.7).
        if (text.charAt(index + 1) === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      // CR, LF and commas are ordinary characters while quoted.
      field += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      hadQuotes = true;
      index += 1;
      continue;
    }
    if (char === ',') {
      endField();
      index += 1;
      continue;
    }
    if (char === '\r') {
      endRecord();
      index += text.charAt(index + 1) === '\n' ? 2 : 1;
      continue;
    }
    if (char === '\n') {
      endRecord();
      index += 1;
      continue;
    }

    field += char;
    index += 1;
  }

  // Flush the last record unless the text ended on a record separator.
  if (field !== '' || record.length > 0 || hadQuotes) endRecord();

  return records;
}

/**
 * Splits CSV text into its header record and its data records. Input that is empty, or nothing but
 * line breaks, yields `{ headers: [], rows: [] }` rather than throwing: an empty upload is a
 * validation message, not a crash.
 */
export function parseCsv(text: string): ParsedCsv {
  const records = readRecords(stripBom(text));
  const [headers, ...rows] = records;
  if (!headers) return { headers: [], rows: [] };
  return { headers, rows };
}
