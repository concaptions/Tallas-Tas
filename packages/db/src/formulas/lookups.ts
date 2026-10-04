/**
 * THE Airtable lookup semantic, as one pure function (GRATSI-MATCH, 2026-10-04).
 *
 * An Airtable `multipleLookupValues` field is nothing but "the values of one field across the
 * records a link points at", displayed joined. Every lookup column the Gratsi column match added —
 * Meta Copywriting's `Offer` and `Collection URL`, Creative Sheet's thirteen `(from Creative Name)`
 * fields, Youtube Copywriting's campaign and product lookups — is that one computation over a
 * different link and a different field, so they all name this ONE registered formula rather than
 * twenty identity functions. WHICH link and WHICH field a column reads is the pairing of its
 * `column_key` with its page's source loader, recorded on each seed row; what makes the column a
 * lookup — derived on read, never stored, never writable — is this function and the `formula`
 * mechanism (`isVirtualColumn`, `storedColumns`).
 *
 * The loaders hand in whatever the linked rows carried, nulls and blanks included, because a linked
 * row with an empty looked-up field contributes nothing in Airtable either. No caller pre-filters.
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
