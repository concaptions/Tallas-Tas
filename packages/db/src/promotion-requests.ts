import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';

import type { Db } from './db';
import { PROPAGATION_TABLES, propagateTemplateRow } from './propagation';
import {
  brands,
  promotionRequests,
  type NewPromotionRequest,
  type PromotionRequest,
  type PromotionRequestStatus,
} from './schema';
import { withBrand } from './tenancy';

/**
 * The Propagation page's data access (PRD §5, §14.1: a child brand asks, the Admin dashboard
 * approves). Every function takes the database as its first argument (no module-level singleton) and
 * none of them contains business logic; the domain functions call these.
 *
 * NOT `withBrand`, and that is the point. `promotion_requests.brand_id` is NOT NULL and names the
 * CHILD brand that raised the request, so the table is branded in storage — but the read this page
 * needs is the one scope `withBrand` cannot express: the agency admin looks at every brand's pending
 * requests AT ONCE, because deciding one brand's request is deciding what the template holds for all
 * of them. That is the privileged, cross-brand scope the engine design reserves for the parent
 * template, and it is written out here as an explicit AGENCY-scoped query rather than smuggled past
 * `withBrand`.
 *
 * So the scope is not missing, it is one level up: every statement below joins `brands` and filters
 * `brands.agency_id = $agencyId`, which is what makes one agency's requests unreachable from
 * another's session — proven by `promotion-requests.test.ts`, which seeds a second agency and
 * asserts its request never comes back. A later reader must not "fix" this by wrapping it in
 * `withBrand`: doing so would show an admin one brand at a time and the page would stop being a
 * dashboard. What IS kept from the ordinary scope is the live filter: every read carries
 * `deleted_at IS NULL`.
 */

/** The columns the clock, the scope and the review own; a caller never sets them. */
type ManagedColumn =
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'createdBy'
  | 'updatedBy'
  | 'deletedAt'
  | 'reviewedBy'
  | 'reviewedAt'
  | 'reviewNote';

/**
 * What the child-side popup submits when it raises a request: the brand, the origin of the edit and
 * the two sides of the diff. The review columns are absent — an admin fills those through
 * `setPromotionRequestStatus`, never the requester.
 */
export type PromotionRequestInput = Omit<NewPromotionRequest, ManagedColumn>;

/**
 * A promotion request as the admin table renders it: the stored row plus the name of the child brand
 * that raised it, so the Brand column costs no second query (the page renders the name straight off
 * the row). `demoPromotionRequests` satisfies `PromotionRequestRow[]`, so the page reads demo
 * fixtures and database rows through one type and without a branch.
 *
 * `brandName` is NULLABLE even though `brand_id` is NOT NULL and points at a real brand by foreign
 * key: a brand that has been soft-deleted (a client offboarded while a request of theirs was still
 * open) comes back with a null name rather than dropping the request out of the admin's list, the
 * same choice `listPersonas` makes for a persona whose product has gone. The request is still the
 * agency's to settle; the page falls back to a placeholder instead of the read throwing.
 */
export type PromotionRequestRow = PromotionRequest & { brandName: string | null };

/**
 * Every live promotion request of the AGENCY, newest request first, each with its child brand's name;
 * `status` narrows to one state, and omitting it returns all three.
 *
 * Cross-brand ON PURPOSE — see the module note. The `innerJoin` on `brands` is what carries the
 * agency scope: a request whose brand belongs to another agency is filtered out in SQL, not in
 * TypeScript, so there is no widened read to audit. The join is inner rather than left because
 * `brand_id` is NOT NULL and a foreign key, so every request HAS a brand row; whether that brand is
 * still live is a separate question, answered by nulling the name rather than by hiding the request.
 *
 * Ordered by `requested_at` descending — the clock the requester's popup stamped, not `updated_at`,
 * so approving one request does not reshuffle the queue under the admin's cursor — with the id as a
 * tiebreaker, so two requests raised in the same second have one stable order.
 */
export async function listPromotionRequests(
  db: Db,
  agencyId: string,
  status?: PromotionRequestStatus,
): Promise<PromotionRequestRow[]> {
  const rows = await db
    .select({
      request: promotionRequests,
      brandName: brands.name,
      brandDeletedAt: brands.deletedAt,
    })
    .from(promotionRequests)
    .innerJoin(brands, eq(promotionRequests.brandId, brands.id))
    .where(
      and(
        eq(brands.agencyId, agencyId),
        isNull(promotionRequests.deletedAt),
        status === undefined ? undefined : eq(promotionRequests.status, status),
      ),
    )
    .orderBy(desc(promotionRequests.requestedAt), asc(promotionRequests.id));
  return rows.map((row) => ({
    ...row.request,
    brandName: row.brandDeletedAt === null ? row.brandName : null,
  }));
}

/**
 * The agency's PENDING requests, newest first: what `/app/propagation` renders, under the name the
 * page asks for. One call into `listPromotionRequests` rather than a second statement, so there is
 * only ever one query to audit — the arrangement `listNotifications` uses — and the status literal
 * is written once, here, instead of in the page.
 */
export async function listPendingPromotionRequests(
  db: Db,
  agencyId: string,
): Promise<PromotionRequestRow[]> {
  return listPromotionRequests(db, agencyId, 'pending');
}

/**
 * Settles one live request of the agency and returns it, or null when the id is unknown, already
 * soft-deleted, or belongs to another agency — the scope makes those the same outcome: zero rows
 * changed.
 *
 * The three review columns move together: who decided, when, and the note they left (null when they
 * left none). `requested_at` is never touched, so the queue's order survives a decision.
 *
 * The scope is applied by RESOLVING the id inside the agency first and only then updating that row,
 * because an `UPDATE` cannot join in Postgres and a `where id = $id` alone would degrade the scope
 * to "any request with this id, in any agency". The resolve carries the same three conditions the
 * read carries — the agency join, the id, and `deleted_at IS NULL` — so a request another agency
 * owns is simply not found, exactly as a soft-deleted one is not.
 */
export async function setPromotionRequestStatus(
  db: Db,
  agencyId: string,
  id: string,
  status: PromotionRequestStatus,
  actorId: string,
  reviewNote: string | null = null,
): Promise<PromotionRequestRow | null> {
  const [target] = await db
    .select({ id: promotionRequests.id })
    .from(promotionRequests)
    .innerJoin(brands, eq(promotionRequests.brandId, brands.id))
    .where(
      and(
        eq(brands.agencyId, agencyId),
        eq(promotionRequests.id, id),
        isNull(promotionRequests.deletedAt),
      ),
    )
    .limit(1);
  if (target === undefined) return null;
  const now = new Date();
  const [row] = await db
    .update(promotionRequests)
    .set({
      status,
      reviewedBy: actorId,
      reviewedAt: now,
      reviewNote,
      updatedBy: actorId,
      updatedAt: now,
    })
    .where(and(eq(promotionRequests.id, target.id), isNull(promotionRequests.deletedAt)))
    .returning();
  if (row === undefined) return null;
  const [brand] = await db.select().from(brands).where(eq(brands.id, row.brandId)).limit(1);
  const brandName = brand === undefined || brand.deletedAt !== null ? null : brand.name;
  return { ...row, brandName };
}

export interface ApplyPromotionResult {
  readonly applied: boolean;
  readonly reason?: string;
  readonly childrenUpdated?: number;
}

/**
 * Apply an approved promotion request: write the proposed value into the template row,
 * then propagate the change to all child brands. Returns whether the application succeeded.
 *
 * Only applies if the request status is 'approved' and the table/field are in the propagation
 * registry. The template brand is resolved from the child brand's `templateBrandId`.
 */
export async function applyApprovedPromotion(
  db: Db,
  agencyId: string,
  requestId: string,
  actorId: string,
): Promise<ApplyPromotionResult> {
  const [reqRow] = await db
    .select({
      request: promotionRequests,
      childBrandId: promotionRequests.brandId,
    })
    .from(promotionRequests)
    .innerJoin(brands, eq(promotionRequests.brandId, brands.id))
    .where(
      and(
        eq(brands.agencyId, agencyId),
        eq(promotionRequests.id, requestId),
        isNull(promotionRequests.deletedAt),
      ),
    )
    .limit(1);

  if (!reqRow) return { applied: false, reason: 'Request not found' };
  const request = reqRow.request;

  if (request.status !== 'approved') {
    return { applied: false, reason: `Request status is ${request.status}, not approved` };
  }

  const table = PROPAGATION_TABLES[request.tableName];
  if (!table) {
    return { applied: false, reason: `Table ${request.tableName} is not propagation-eligible` };
  }

  const [childBrand] = await db
    .select()
    .from(brands)
    .where(eq(brands.id, request.brandId))
    .limit(1);
  if (!childBrand?.templateBrandId) {
    return { applied: false, reason: 'Child brand has no template parent' };
  }

  const templateBrandId = childBrand.templateBrandId;

  if (request.rowId) {
    const templateScope = withBrand(db, templateBrandId);
    const camelField = request.fieldName.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    await templateScope.update(
      table,
      { [camelField]: request.proposedValue, updatedBy: actorId },
      eq(
        (table as unknown as Record<string, ReturnType<typeof sql>>).id as ReturnType<typeof sql>,
        request.rowId,
      ),
    );

    const result = await propagateTemplateRow(
      db,
      templateBrandId,
      request.tableName,
      request.rowId,
      'update',
      actorId,
    );

    return { applied: true, childrenUpdated: result.childrenUpdated };
  }

  return { applied: false, reason: 'Request has no rowId to update' };
}
