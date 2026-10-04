/**
 * Airtable LOOKUP fields, computed on read — never stored, never writable (GRATSI-MATCH,
 * 2026-10-04; two clusters merged). An Airtable `multipleLookupValues` field is "the values of one
 * field across the records a link points at", displayed joined. Two shapes live here, and both are
 * pinned by their own tests:
 *
 * - `lookupRollup` — THE generic semantic: non-empty values joined in loader order, duplicates
 *   kept, exactly as Airtable prints a multi-value lookup. Every Creative Sheet / Meta / Youtube
 *   lookup column names this one registered formula; WHICH link and WHICH field a column reads is
 *   the pairing of its `column_key` with its page's source loader, recorded on each seed row.
 * - The named per-field readings below (`briefConceptsFromAngles`, `conceptPerformance`,
 *   `creativeNameFromCreative`) — lookups whose platform reading needed its own documented rule
 *   (deduplication, phantom-column history), so a grid cell and a future panel cannot join or
 *   deduplicate differently.
 *
 * Inputs are the LINKED rows' already-resolved values — names a page's own loaders carry on its
 * single connection pass — never ids and never a database handle. No caller pre-filters blanks.
 */

/**
 * The looked-up values of one row's link, as the cell displays them: non-empty values joined with
 * `', '` in the order the loader resolved them, or `null` when the link points at nothing — the
 * muted em dash case, same as every other absent value.
 */
export function lookupRollup(values: readonly (string | null | undefined)[]): string | null {
  const present = values.filter(
    (value): value is string => typeof value === 'string' && value.trim() !== '',
  );
  return present.length === 0 ? null : present.join(', ');
}

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
