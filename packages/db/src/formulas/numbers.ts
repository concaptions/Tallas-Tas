/**
 * UGC Management › `Creator's cost (USD)`.
 *
 * Airtable:
 *   IF({Platform} = 'Fiverr',  {Creator's cost (USD) - Internal} * 1.055,
 *   IF({Platform} = 'Insense', {Creator's cost (USD) - Internal} * 1.10,
 *                              {Creator's cost (USD) - Internal}))
 *
 * The fee is PLATFORM-DEPENDENT, not the flat 5% the Airtable field description claims: 5.5% on
 * Fiverr, 10% on Insense, nothing elsewhere. The formula is the authority and the description is
 * stale; transcribed from the base's own config on 2026-10-02.
 *
 * `platform` accepts an array because this schema stores it as jsonb where Airtable has a single
 * select, so a row may carry several. The fee of the first matching platform applies.
 */
export function creatorCostWithFee(
  creatorCost: number | null | undefined,
  platform: readonly string[] | string | null | undefined,
): number | null {
  if (creatorCost === null || creatorCost === undefined || Number.isNaN(creatorCost)) return null;
  const platforms = (typeof platform === 'string' ? [platform] : (platform ?? [])).map((entry) =>
    entry.trim().toLowerCase(),
  );
  if (platforms.includes('fiverr')) return round2(creatorCost * 1.055);
  if (platforms.includes('insense')) return round2(creatorCost * 1.1);
  return round2(creatorCost);
}

/** Money to the cent, so 95 * 1.055 reads 100.23 rather than 100.22500000000001. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Creative Reporting › `Difference CPA`.
 * Airtable: `{CPA} - {Target CPA}`. Either side missing makes the difference unknowable, not zero.
 */
export function differenceCpa(
  cpa: number | null | undefined,
  targetCpa: number | null | undefined,
): number | null {
  if (cpa === null || cpa === undefined || targetCpa === null || targetCpa === undefined) {
    return null;
  }
  if (Number.isNaN(cpa) || Number.isNaN(targetCpa)) return null;
  return round2(cpa - targetCpa);
}
