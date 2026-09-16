# TICKET-031a · Promotion ops: request, withdraw, reject, list, preview; Server Actions and `requireTemplateEditor`

- Owners, in order: schema (stage 1, `packages/db/src/template/ops/**`) then backend (stage 2,
  `apps/web/src/app/app/(workspace)/brands/[brandSlug]/promotions/**`,
  `apps/web/src/app/app/(admin)/admin/promotions/actions.ts` and its factory,
  `apps/web/src/lib/auth/require-template-editor.ts`, `apps/web/src/lib/action-result.ts`)
- Size: M
- Depends on: TICKET-030, TICKET-024b (the `ops` directory and subpath), TICKET-008, TICKET-009
  (`toActionError`), TICKET-014 (`internalBrandRoles`)
- PRD: §5 (pop-up → request comes in to the Admin dashboard), §11 (Admin approves; clients get no access
  to internal data), §14.1
- Design: §4.3 (`requireTemplateEditor`, `assertTemplateWriter`, A10), §4.5 (request, reject, withdraw,
  review), §6 (ops module, route helpers, read scope without audit), I8, I9, T12, T16 (database half),
  T17 (read-scope part)

## Why

The popup of PRD §5 needs somewhere to send its request, and the admin dashboard needs to list and reject.
These are the non-approving halves of the lifecycle; approval (TICKET-031b) is kept apart because it is
the only code path that writes a parent row on behalf of a child (I9).

## Acceptance criteria

1. Every op takes `db`, `registry` and an `actorId`; mutating ops open `withTemplateScope` with a fixed
   reason and never accept a scope from the caller; read ops use `withTemplateRead`. No query in this
   ticket reads or writes a brand other than the child named in the argument and its template brand, and
   every query on `promotion_requests` carries `brand_id = $childBrandId` or runs in the read scope behind
   `requireAdmin()` (listing across brands is the admin dashboard's privileged read, I8).
2. Server Actions follow TICKET-009's shape: an `actions.ts` of `'use server'` export lines over a
   factory, returning `ActionResult<T>`; each validates input (zod), calls a route helper and calls one
   op. Nothing in this ticket writes a template row, so no factory takes `inngest` and none enqueues:
   `createPromotionActions({ auth, db })` for the workspace and `createAdminPromotionActions({ auth,
   db })` for the admin page (TICKET-031b extends the admin factory with `inngest`). No Server Action
   imports `@tas/db/template/scope` (the TICKET-024b fence stays green) and none calls `propagateRun`.
3. Unit tests never start Inngest; the factories are tested with `createAuth` and a stubbed `getSession`
   (TICKET-008).
4. `pnpm typecheck`, `pnpm lint`, `pnpm test` pass from the root.

## Stage 1 (schema) · `packages/db/src/template/ops/promotion.ts`

5. `requestPromotion(db, registry, { actorId, brandId, tableName, rowId, fields?, note?, now? })` runs in
   `withTemplateScope(reason: 'promotion_request', targetBrandId: brandId, subject: { tableName, rowId })`,
   one transaction: `childRowById(spec, brandId, rowId, { forUpdate: true })` (throws `NoSuchRow` for a
   missing or other-brand row), `parentRow(spec, child.templateRowId)` when linked,
   `resolveLinksToParent` for the row's link fields, `buildPromotionRequest` (TICKET-030), then: if a
   `pending` request exists for `(tableName, rowId)` it is set to `superseded` (`transitionPromotion
   ('pending', 'supersede', 'system')`) and the new row is inserted with `requested_by = actorId`,
   `status 'pending'`, `brand_id = brandId`. Returns `{ requestId, supersededId: string | null, fields }`.
   The unique violation on `promotion_requests_one_pending` is not caught (a violation is a bug, §4.5).
6. `withdrawPromotion(db, registry, { actorId, brandId, requestId, by: 'requester' | 'admin' })` and
   `rejectPromotion(db, registry, { actorId, requestId, reviewNote })` each run one `UPDATE
   promotion_requests SET status, reviewed_by = actorId, reviewed_at = now(), review_note WHERE id = $id AND
   status = 'pending'` (and `AND brand_id = $brandId` for withdraw) after `transitionPromotion`; zero rows →
   `NotPending`. `rejectPromotion` throws `NoteRequired` when `reviewNote` is blank. Withdraw by
   `'requester'` also requires `requested_by = actorId` (zero rows otherwise → `NotPending`). Both open the
   scope with reason `'promotion_request'`. No other table changes.
7. `listPromotionRequests(db, registry, templateBrandId, { status?: PromotionStatus[]; brandId?; limit?;
   cursor? })` runs in `withTemplateRead` and returns each request joined with the live parent row (deleted
   included) as `{ request, currentParent: Row | null, review: ReturnType<typeof reviewPromotion>, brand:
   { id, name } }`, newest first, default `status ['pending']`, page size 50.
8. `previewPromotion(db, registry, { brandId, tableName, rowId, fields? })` runs in `withTemplateRead` and
   returns the `PromotionDraft` from `buildPromotionRequest` without writing (the modal's two-column diff,
   TICKET-033). `UnresolvedLinkError` propagates unchanged.
9. `packages/db/src/template/ops/index.ts` (created by TICKET-024b) gets the four exports appended;
   later tickets append, never replace.
10. Tests in `packages/db/src/template/ops/promotion.test.ts` through `testTemplateWorld()`:
    - T12: `requestPromotion` from B after `updateTemplated(label)` stores `fields ['label']`, `base.label`
      = T's value, `proposed.label` = B's value; for an `interface_fields` row `proposed.pageId` is the
      parent page id (link remapped) and `base.pageId` the parent's own; two requests back to back → the
      first `superseded`, the second `pending`, no unique violation; a row with no overrides and no
      `fields` → `NothingToPromote`; `fields ['position']` on a row overriding only `label` is accepted
      (explicit fields need not be overridden); a brand-local row → `parent_row_id NULL` with all
      propagated fields.
    - T16 (database half): reject changes only the request row (`status`, `reviewed_*`, `review_note`);
      withdraw by requester, by admin; withdraw by a different requester → `NotPending`; reject without a
      note → `NoteRequired`; reject on an already rejected request → `NotPending`; the child row and its
      `overridden_fields` are byte-identical before and after each.
    - T17 (read part): `listPromotionRequests` and `previewPromotion` insert no `engine_audit_log` row;
      `requestPromotion`, `withdrawPromotion`, `rejectPromotion` each insert exactly one, closed
      `succeeded`, and one closed `failed` when the op throws (`NotPending`).
    - `listPromotionRequests` for two children returns both requests with the correct `brand` and a
      `review.stale` entry after T's `label` changed; `brandId` filter returns only B's.

## Stage 2 (backend) · Server Actions, `requireTemplateEditor`, error codes

11. `apps/web/src/lib/auth/require-template-editor.ts`: `requireTemplateEditor(auth, db, brandId)` =
    `await auth.requireAdmin()` (V1, A10) followed by `assertTemplateWriter(actor, brand)` (TICKET-022) on
    the brand row read through `findBrandForAgency(db, { brandId, agencyId: actor.agencyId })`
    (TICKET-008); throws `ForbiddenError` for a non-admin and `NotATemplate` when the brand is not the
    template or is not the actor's. Unit test with `createAuth` and a stubbed session: admin on the
    template passes; admin on a child → `NotATemplate`; member on the template → `ForbiddenError`.
12. `apps/web/src/lib/action-result.ts` (TICKET-009) `toActionError` learns the codes `unresolved_link`
    (with `field` in `message`), `nothing_to_promote`, `not_pending`, `note_required`, `no_such_row`,
    `not_a_template`; unknown errors still rethrow. `reservedSlugs` is not touched: admin pages live under
    `/app/admin/...`, outside the `/app/brands/[brandSlug]` tree (TICKET-010 Notes), so no slug can
    collide with them.
13. `apps/web/src/app/app/(workspace)/brands/[brandSlug]/promotions/actions.ts` (`'use server'`) built by
    `createPromotionActions({ auth, db })` in `promotion-actions.ts`: `requestPromotionAction({ brandId,
    tableName, rowId, fields?, note? })` → `requireBrandRole(brandId, ...internalBrandRoles)`
    (`@tas/domain`, TICKET-014) → `requestPromotion` → `{ ok: true, data: { requestId, fields } }`;
    `withdrawPromotionAction({ brandId, requestId })` → same helper → `withdrawPromotion` with `by:
    actor.agencyRole === 'admin' ? 'admin' : 'requester'`; `previewPromotionAction({ brandId, tableName,
    rowId, fields? })` → same helper → `previewPromotion`. Every domain error becomes `{ ok: false, code,
    message }` through `toActionError`.
14. `apps/web/src/app/app/(admin)/admin/promotions/actions.ts` built by `createAdminPromotionActions({
    auth, db })` in `admin-promotion-actions.ts`: `rejectPromotionAction({ requestId, reviewNote })` →
    `requireAdmin()` → `rejectPromotion`; `listPromotionRequestsAction(filters)` → `requireAdmin()` →
    `listPromotionRequests` (the template brand id is resolved from `actor.agencyId` through
    `listBrandsForAgency`, `isTemplate`).
15. Factory tests (PGlite through `testTemplateWorld()` plus TICKET-005's seed identities, stubbed
    session): a `client`-only identity calling `requestPromotionAction` gets `forbidden`; the seeded
    strategist on the child brand gets a request id; `rejectPromotionAction` by a member gets `forbidden`;
    a zod failure (missing `rowId`) gets `invalid_input`; an `UnresolvedLinkError` gets `unresolved_link`.
    No factory in this ticket takes `inngest`: requests and rejections change no parent row, so nothing
    propagates.

## Gated criteria (D-008)

none

## Files touched

`packages/db/src/template/ops/promotion.ts` (+ test), `packages/db/src/template/ops/index.ts`,
`apps/web/src/lib/auth/require-template-editor.ts` (+ test), `apps/web/src/lib/action-result.ts`,
`apps/web/src/app/app/(workspace)/brands/[brandSlug]/promotions/{actions,promotion-actions}.ts` (+ test),
`apps/web/src/app/app/(admin)/admin/promotions/{actions,admin-promotion-actions}.ts` (+ test).

## Notes

- Stage 1 stays inside `packages/db/src/template/ops/**`. Stage 2 stays inside the `apps/web` paths above
  and writes nothing under `packages/*`.
- Route tree: the paths above are TICKET-010's canonical tree verbatim.
- `requireTemplateEditor` is consumed by the row edit action of TICKET-033 for template-brand writes; it is
  defined here so the promotion flow and the template edit flow share one gate.
- `internalBrandRoles` is exported from `@tas/domain` (TICKET-014); do not hard-code the internal role
  list.
- Lock order inside `requestPromotion` is the child row only; `approvePromotion` (TICKET-031b) locks
  request → parent → child, never the child first, so the two cannot deadlock.
