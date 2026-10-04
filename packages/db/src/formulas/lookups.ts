/**
 * Airtable LOOKUP fields the strict Gratsi-matches-Airtable rule surfaces as read-only columns
 * (GRATSI-MATCH, 2026-10-04 — the links cluster). A lookup is not a formula in Airtable's own
 * vocabulary, but it is the same thing to this platform: a value with NO stored column behind it,
 * computed on read from rows the link layer already loaded. Each function here is the one reading
 * of one lookup, so a grid cell and a future panel cannot join or deduplicate differently.
 *
 * The inputs are the LINKED rows' already-resolved values — names a page's own loaders carry —
 * never ids and never a database handle: these stay pure, and the caller owns the (single-pass)
 * load exactly as it does for the reverse-link columns.
 */

/** Unique, blank-dropped, order kept, joined the way Airtable prints a multi-value lookup. */
function joinLookup(values: readonly (string | null | undefined)[]): string | null {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw?.trim() ?? '';
    if (value === '' || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out.length === 0 ? null : out.join(', ');
}

/**
 * Creative Design (Internal & Interface) › `Concepts (from Angles)`.
 * Airtable: lookup through the brief's `Angle` link into Angles › `Concepts` — i.e. the concepts
 * `concept_angles` pairs with the brief's angle. Takes those concepts' generated names.
 */
export function briefConceptsFromAngles(
  conceptNames: readonly (string | null | undefined)[],
): string | null {
  return joinLookup(conceptNames);
}

/**
 * Concepts › `Performance`.
 * Airtable: lookup of `Performance` on the concept's `(Internal) Creative Design` briefs — the
 * reverse side of `creative_briefs.concept_id`. NOT a stored column: `concepts` has no
 * `performance` column and the importer writes performance only on briefs
 * (`import-mappings.ts` documents a phantom `concepts.performance`; the live meta says lookup).
 */
export function conceptPerformance(
  briefPerformances: readonly (string | null | undefined)[],
): string | null {
  return joinLookup(briefPerformances);
}

/**
 * Creative Reporting › `Creative Name (from Creative)`.
 * Airtable: lookup of the linked creative's name through the report's `Creative` link — a bare
 * passthrough of `creative_briefs.name` via `creative_reporting.brief_id` (the base's own
 * `Creative Name` formula field is, in turn, a passthrough of THIS lookup).
 */
export function creativeNameFromCreative(briefName: string | null | undefined): string | null {
  const name = briefName?.trim() ?? '';
  return name === '' ? null : name;
}
