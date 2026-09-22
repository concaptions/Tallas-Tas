/**
 * The campaign naming formula, replicated from the live Airtable Campaigns & Offers table:
 * `CONCATENATE({Holiday},'-',{Discount Offer},'-',{Code})` → e.g. `BFCM-20%OFF-BFCM26`.
 *
 * Airtable's CONCATENATE treats empty fields as empty strings, so a missing segment produces a
 * double-dash (e.g. `BFCM--BFCM26` when Discount Offer is blank). We match that behavior exactly.
 *
 * Pure: reads three strings, returns one. No lookup, no database, no throw.
 */

export const CAMPAIGN_NAME_SEPARATOR = '-';

export const CAMPAIGN_NAME_PARTS = ['holiday', 'discountOffer', 'code'] as const;

export type CampaignNamePart = (typeof CAMPAIGN_NAME_PARTS)[number];

export interface CampaignNameInput {
  readonly holiday?: string | null;
  readonly discountOffer?: string | null;
  readonly code?: string | null;
}

/**
 * `Holiday-DiscountOffer-Code`.
 *
 * Matches Airtable's CONCATENATE exactly: a null/undefined segment becomes an empty string, so
 * `campaignName({ holiday: 'BFCM', code: 'BFCM26' })` returns `BFCM--BFCM26` — the same
 * double-dash Airtable produces.
 */
export function campaignName(input: CampaignNameInput): string {
  const holiday = input.holiday?.trim() ?? '';
  const discountOffer = input.discountOffer?.trim() ?? '';
  const code = input.code?.trim() ?? '';
  return [holiday, discountOffer, code].join(CAMPAIGN_NAME_SEPARATOR);
}
