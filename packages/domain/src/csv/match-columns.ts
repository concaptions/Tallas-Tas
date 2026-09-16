/**
 * Column-name matching for the bulk upload flow (PRD §5). The uploaded file comes from a
 * spreadsheet, so its header row is `Name`, ` link `, `Collection Link` as often as it is the exact
 * template. Matching is therefore case-insensitive and ignores surrounding whitespace — and nothing
 * else: `collection link` is not `collection_link`, because silently accepting a near-miss is how a
 * column ends up imported into the wrong field.
 *
 * Pure. The upload UI renders the result as a message; the Server Action refuses on the same result.
 * Neither decides what "missing" means on its own.
 */

export interface ColumnMatch {
  /** Expected columns found in the header row, in the order they were expected. */
  readonly present: readonly string[];
  /** Expected columns with no header, in the order they were expected. */
  readonly missing: readonly string[];
  /**
   * Headers nothing expected, verbatim as the file spelled them, in header order. A second copy of
   * an expected column is not unknown — it is a duplicate, and `indexes` keeps the first.
   */
  readonly unknown: readonly string[];
  /**
   * Expected column → its position in the header row, for reading a `parseCsv` row. Only present
   * columns appear. On a duplicated header the first occurrence wins.
   */
  readonly indexes: Readonly<Record<string, number>>;
}

function normalise(header: string): string {
  return header.trim().toLowerCase();
}

/**
 * Compares an uploaded header row against the columns a table expects.
 *
 * `matchColumns(['Name', ' Link '], ['name', 'link', 'collection_link'])` reports `name` and `link`
 * present at 0 and 1, `collection_link` missing and nothing unknown.
 */
export function matchColumns(headers: readonly string[], expected: readonly string[]): ColumnMatch {
  const positions = new Map<string, number>();
  headers.forEach((header, index) => {
    const key = normalise(header);
    if (!positions.has(key)) positions.set(key, index);
  });

  const present: string[] = [];
  const missing: string[] = [];
  const indexes: Record<string, number> = {};

  for (const column of expected) {
    const index = positions.get(normalise(column));
    if (index === undefined) {
      missing.push(column);
      continue;
    }
    present.push(column);
    indexes[column] = index;
  }

  const expectedKeys = new Set(expected.map(normalise));
  const unknown = headers.filter((header) => !expectedKeys.has(normalise(header)));

  return { present, missing, unknown, indexes };
}
