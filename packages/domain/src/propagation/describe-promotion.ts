/**
 * One sentence naming what a promotion request is about, for the row's accessible label.
 *
 * The table reads beautifully with a mouse and badly with a screen reader: six cells of bare
 * identifiers ("Funky Painting", "angles", "formats") and two buttons called Approve and Reject that
 * say nothing about WHAT is being approved. Every row's Approve button would announce identically.
 * This is the sentence that fixes it, and it lives here rather than in the component for the reason
 * every other string in this package does — a Server Action that later confirms "Promote X?" or a
 * notification that says "your request was approved" must name the thing the same way the row did.
 *
 * TOTAL AND PURE. `brandName` is nullable on `PromotionRequestRow` by design: `listPromotionRequests`
 * left-joins `brands`, and a soft-deleted brand comes back with a null name rather than a missing row
 * (that is a tested guarantee in `@tas/db`, so the admin can still settle a request from a brand that
 * has since been archived). A null name is a placeholder here, never a crash and never an empty gap
 * in the sentence.
 *
 * The input is a structural subset, not `PromotionRequestRow` imported from `@tas/db`: this package
 * depends on nothing, the dependency edge runs `apps/web -> @tas/db -> (nothing)` and
 * `apps/web -> @tas/domain -> (nothing)`. A row from the database and a demo fixture both satisfy it.
 */

/** What the sentence needs from a request. Any `PromotionRequestRow` satisfies this structurally. */
export interface PromotionSubject {
  /** The child brand that raised the request; `null` when its brand row was soft-deleted. */
  readonly brandName?: string | null;
  /** The origin table in the child's data, as stored: `personas`, `creative_briefs`. */
  readonly tableName: string;
  /** The origin field, as stored: `pain_points`, `reference_links`. */
  readonly fieldName: string;
}

/**
 * What stands in for a brand whose row is gone. The page renders this in the Brand cell too, rather
 * than running a second query for a name the first query already proved is not there.
 */
export const PROMOTION_UNKNOWN_BRAND = 'Unknown brand';

/**
 * A stored identifier as a person reads it: `creative_briefs` becomes `Creative briefs`.
 *
 * Deliberately dumb and total. `table_name` and `field_name` are plain text naming any column in the
 * schema (the schema module says why they are not enums: a request outlives the row it came from),
 * so there is no fixed map to look a label up in and an unknown name must still render as something.
 * Sentence case, not title case, so the label reads as English inside `describePromotion` rather
 * than as a Heading Dropped Into A Sentence.
 */
export function humanizeIdentifier(value: string): string {
  const words = value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (words.length === 0) {
    return value;
  }
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The Table cell's label. */
export function promotionTableLabel(tableName: string): string {
  return humanizeIdentifier(tableName);
}

/** The Field cell's label. */
export function promotionFieldLabel(fieldName: string): string {
  return humanizeIdentifier(fieldName);
}

/** The Brand cell's label, with the placeholder for a soft-deleted brand. */
export function promotionBrandLabel(brandName: string | null | undefined): string {
  const name = typeof brandName === 'string' ? brandName.trim() : '';
  return name.length > 0 ? name : PROMOTION_UNKNOWN_BRAND;
}

/**
 * The sentence. One clause, no markup, ends in a full stop:
 *
 *   "Funky Painting requests promoting Formats on Angles to the template."
 *
 * "to the template" is the half that makes it a promotion rather than an edit, and it is why the
 * sentence does not name the target brand: the target is always the requesting brand's own template
 * (`brands.template_brand_id`), never a brand the admin picks here — per-brand targeting is out of
 * scope for this ticket and there is no second brand column to name.
 */
export function describePromotion(request: PromotionSubject): string {
  const brand = promotionBrandLabel(request.brandName);
  const field = promotionFieldLabel(request.fieldName);
  const table = promotionTableLabel(request.tableName);
  return `${brand} requests promoting ${field} on ${table} to the template.`;
}
