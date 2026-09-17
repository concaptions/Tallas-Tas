import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';

/**
 * A child brand asking for one of its local edits to be promoted into the parent template (PRD §5,
 * §14.1; CLAUDE.md non-negotiable 2: "child changes can *request* promotion to the parent (popup →
 * Admin dashboard → approve). Nothing auto-promotes"). One row per field a brand wants changed
 * upstream, raised by the brand and settled by an agency admin on `/app/propagation`.
 *
 * `brand_id` IS NOT NULL AND IT MEANS THE CHILD: the brand that raised the request, never the
 * template the request is aimed at. There is no second brand column, because the target is always
 * the same row's template (`brands.template_brand_id`) — storing it again would let a request name a
 * template its own brand is not a child of, and nothing could say which of the two was right.
 *
 * THE READ IS THE UNUSUAL HALF. Every other branded table is read through `withBrand(brandId)`, one
 * brand at a time. The Admin dashboard's whole job is the opposite: it reads PENDING requests ACROSS
 * every brand of the agency, so the scope that protects it is the AGENCY, not the brand. That query
 * is written out explicitly in `promotion-requests.ts` with its reason attached, the way `themes.ts`
 * documents its global scope, and it is proven by a test that another agency's request never appears.
 * The per-brand index below is still what serves the child-side read that raises them.
 *
 * `table_name` and `field_name` are plain text naming the row's origin in the child's data ("
 * personas", "pain_points"). Deliberately NOT foreign keys and not enums: a request outlives the row
 * it came from (the child may delete the persona while the admin is still deciding), and the set of
 * promotable tables is the whole schema, which a database enum would have to be migrated to follow.
 * `row_id` is the uuid of that origin row and is NULLABLE for the same reason — the row may be gone,
 * or the request may be about a field's shape rather than one row's value.
 *
 * `current_value` and `proposed_value` are the diff the admin reads: what the parent holds today and
 * what the child wants instead, both rendered as TEXT whatever the origin column's type was (a jsonb
 * list of formats arrives here as the list the page would have shown). They are NOT NULL: a request
 * with nothing on one side of the arrow is not a request, it is a bug, and the Change cell has two
 * halves to fill.
 *
 * `status` is plain `text` carrying a KEY of `PROMOTION_STATUS` in `@tas/domain/state`, the
 * arrangement `schema/copy.ts` documents: the domain owns the set of states and their labels, this
 * column only stores which one the row is in, and `@tas/db` does not depend on `@tas/domain`. The
 * three review columns are null until someone acts: an admin's name, when they acted, and the note
 * they left. They move together — a settled request has all the audit it needs on its own row, so
 * this page never needs an audit table to explain itself.
 */
export const PROMOTION_STATUS_DEFAULT: PromotionRequestStatus = 'pending';

/**
 * The three keys `status` stores, as STORAGE vocabulary only: the labels, the tones and the order
 * the page renders them in are `PROMOTION_STATUS` in `@tas/domain/state`. The union is written out
 * here rather than imported for the reason `schema/copy.ts` gives — `@tas/db` does not depend on
 * `@tas/domain`, the edge runs the other way everywhere in this repo, and `apps/web` is where the
 * two are asserted equal. The column stays plain `text`, not a pg enum, so a fourth state is a
 * domain change and not a migration.
 */
export type PromotionRequestStatus = 'pending' | 'approved' | 'rejected';

export const promotionRequests = pgTable(
  'promotion_requests',
  {
    ...baseColumns(),
    /** The CHILD brand that raised the request; the target is that brand's template. */
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    tableName: text('table_name').notNull(),
    rowId: uuid('row_id'),
    fieldName: text('field_name').notNull(),
    currentValue: text('current_value').notNull(),
    proposedValue: text('proposed_value').notNull(),
    requestedBy: text('requested_by').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    status: text('status')
      .$type<PromotionRequestStatus>()
      .notNull()
      .default(PROMOTION_STATUS_DEFAULT),
    reviewedBy: text('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNote: text('review_note'),
  },
  (table) => [
    // The child-side read ("what has my brand asked for?") and the foreign key's own lookups.
    index('promotion_requests_brand_id_idx').on(table.brandId),
    // The admin dashboard's read: one status, newest first, across every brand of the agency.
    index('promotion_requests_status_requested_at_idx').on(table.status, table.requestedAt),
  ],
);

export type PromotionRequest = typeof promotionRequests.$inferSelect;
export type NewPromotionRequest = typeof promotionRequests.$inferInsert;
