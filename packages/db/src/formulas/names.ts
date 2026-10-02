/** Airtable's `DATETIME_FORMAT(..., "MMMM")` month names, fixed rather than locale-dependent. */
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * Campaigns & Offers › `Name`.
 * Airtable: `CONCATENATE({Holiday},'-',{Discount Offer},'-',{Code})`.
 *
 * Mirrored exactly, separators and all, because parity with the base is the point: a row missing its
 * discount reads `BFCM--BF26` in Airtable and must read the same here. A row with nothing at all
 * reads `--`, which the grid's own empty state is free to treat as blank — this function does not
 * second-guess the base.
 */
export function campaignOfferName(
  holiday: string | null | undefined,
  discountOffer: string | null | undefined,
  code: string | null | undefined,
): string {
  return `${holiday ?? ''}-${discountOffer ?? ''}-${code ?? ''}`;
}

/**
 * Creative Sheet › `Name`.
 * Airtable: `DATETIME_FORMAT({Created}, "MMMM") & "-" & {Creative Name}`, i.e. the created month's
 * English name joined to the linked creative's name. UTC, for the same reason the due dates are.
 */
export function creativeSheetName(
  createdAt: Date | null | undefined,
  creativeName: string | null | undefined,
): string | null {
  if (createdAt === null || createdAt === undefined || Number.isNaN(createdAt.getTime())) {
    return null;
  }
  return `${MONTHS[createdAt.getUTCMonth()] ?? ''}-${creativeName ?? ''}`;
}
