# TICKET-031b · Op `approvePromotion` and the approve Server Action

- Owners, in order: schema (stage 1, `packages/db/src/template/ops/**`) then backend (stage 2,
  `apps/web/src/app/app/(admin)/admin/promotions/**`, `apps/web/src/lib/action-result.ts`)
- Size: M
- Depends on: TICKET-031a, TICKET-029b (`enqueueRun`, `inngestForRequest`)
- PRD: §5 (request comes in to the ADMIN dashboard to approve everything), §14.1, §11 (Admin: everything)
- Design: §4.5 (approve: lock order, decisions on locked rows, new-row promotion, `settleOverrides`,
  `overridesForLinkedRow`), §3.8 (`applied_batch_id`), §4.3 (journal `source 'promotion'`), I9, I12, T13,
  T14, T15

## Why

This is the one code path allowed to write a parent row on behalf of a child (I9). It must decide on
locked rows, journal what it wrote, leave the origin child's later edits intact, and hand the result to
the same propagation as any other template write.

## Acceptance criteria

1. `approvePromotion` is the only function in the repository that journals with a `promotion_request_id`:
   `grep -rln "promotionRequestId" packages/db/src --include=*.ts` lists only the schema file
   `schema/promotion-requests.ts`, `tenancy.ts` and `template/journal.ts` (TICKET-025 criterion 1 defines
   the ctx field and passes it through), `template/ops/promotion-approve.ts` and test files.
2. Unit tests never start Inngest; the Server Action enqueues after commit through an injected fake and
   propagation in tests is driven by calling `claimRun` → `applyChildChunk` → `finishRun` from `@tas/db`
   directly (G6).
3. `pnpm typecheck`, `pnpm lint`, `pnpm test` pass from the root.

## Stage 1 (schema) · `packages/db/src/template/ops/promotion-approve.ts`

4. `approvePromotion(db, registry, { actorId, requestId, approvedFields?, decisions?, reviewNote? })` runs
   in `withTemplateScope(reason: 'promotion_apply', subject: { requestId })`, one transaction, locks in this
   order and no other: (1) the `promotion_requests` row `FOR UPDATE` (zero rows or `status <> 'pending'` →
   `NotPending`), (2) `scope.parentRow(spec, request.parentRowId, { forUpdate: true })` (skipped for a
   new-row request), (3) `scope.childRowById(spec, request.brandId, request.childRowId, { forUpdate:
   true })`. Then `resolveLinksToParent` for the child's link fields and `decidePromotion(request,
   parentLocked, approvedFields ?? request.fields, decisions)` (TICKET-030). One `batchId` for the whole
   transaction. The `withBrand` ctx fields `source` and `promotionRequestId` come from TICKET-025
   criterion 1; nothing in `tenancy.ts` changes.
5. Existing parent: if `decision.restoreParent`, `withBrand(tx, T, { actorId, batchId, source:
   'promotion', promotionRequestId }).restoreTemplated(spec, parentRowId)`; then `.updateTemplated(spec,
   parentRowId, decision.parentPatch)` (skipped when the patch is empty); then `settleOverrides
   (childLocked, request.proposed, decision.appliedFields)` (TICKET-022) → `scope.writeChild(spec,
   request.brandId, childRowId, {}, { removeOverrides })`.
6. New row (`parentRowId NULL`): refuse with `UnresolvedLinkError` before any write when a link of the
   child maps to `null` (target still brand-local; nothing cascades, I9); `insertTemplated(spec,
   decision.parentValues)` on T with the same ctx (journal `insert`); then `overridesForLinkedRow
   (childLocked, parent, links, spec)` → `scope.writeChild(spec, request.brandId, childRowId, {
   templateRowId: parent.id }, { addOverrides })`; the request's `parent_row_id` is set to the new id.
7. Finally `UPDATE promotion_requests SET status = 'approved', reviewed_by, reviewed_at = now(),
   review_note, approved_fields, conflicts, decisions, applied_batch_id = $batchId WHERE id = $r AND status =
   'pending'` (zero rows → `NotPending`, transaction rolls back). Returns `{ request, run }` where `run` is
   the `RunRef` returned by the templated method (for `enqueueRun`), or `null` when nothing was journaled
   (all fields `alreadyMatching`).
8. Tests in `packages/db/src/template/ops/promotion-approve.test.ts` through `testTemplateWorld()`:
   - T13: approve with the parent unchanged → parent `label` updated, journal rows with `source
     'promotion'` and `promotion_request_id`, `applied_batch_id` equals the journal `batch_id`, B's
     `label` override removed; a B `updateTemplated(position)` committed between request and approval keeps
     `'position'` in B's overrides after approval and after `claimRun` → `applyChildChunk` → `finishRun`
     deliver the run; A receives the value; approving a subset (`approvedFields ['label']` of
     `['label','position']`) writes only `label` and leaves B's `position` override.
   - T14: after the review read, T's `label` changes again; approve without `decisions` → `MissingDecision
     ('label')` and the request stays `pending`; `decisions { label: 'keep_current' }` → parent value kept,
     B's override kept, request `approved` with `conflicts.label` recorded; `take_proposed` → proposed
     written; T soft-deletes the parent → approve throws `MissingDecision('deletedAt')`; with
     `decisions { deletedAt: 'restore_parent' }` the parent is restored (journal `restore` then `update`).
   - T15: a brand-local `interface_fields` row whose page is brand-local → `UnresolvedLinkError` and no
     write (audit row `failed`); after the page is promoted and approved, approving the field request
     inserts a parent row, sets B's `template_row_id`, computes B's overrides positively (a field not
     approved is listed), journals `insert`; running the propagation inserts into A only (B hits `ON
     CONFLICT`, counted `noop`, no duplicate); a subset approval (`visible` approved, `position` not)
     leaves B's `position` intact after the insert propagation.
   - `NotPending` on an approved request; `NotASubset` on `approvedFields ['enabled']` when the request
     holds `['label']`; an all-`alreadyMatching` approval writes no journal row and returns `run: null`.

## Stage 2 (backend) · approve Server Action

9. `createAdminPromotionActions` (TICKET-031a) gains an `inngest` dependency
   (`createAdminPromotionActions({ auth, db, inngest })`, built in `actions.ts` with
   `inngestForRequest()`, TICKET-029b) and `approvePromotionAction({ requestId, approvedFields?,
   decisions?, reviewNote? })`: zod-validate (`decisions` values restricted to the three
   `PromotionDecision` literals), `requireAdmin()`, `approvePromotion`, then if `run` is not null
   `enqueueRun(inngest, run)` after the transaction committed (never inside), return `{ ok: true, data:
   { requestId, runId } }`. `toActionError` learns `missing_decision` (field in `message`) and
   `not_a_subset` (`unresolved_link` is already present).
10. Factory test with the stubbed session and fake `inngest`: member → `forbidden`; admin approval → the
    fake `send` was called once with `template/run.queued` whose `runId` equals the queued run in PGlite;
    a `missing_decision` result → `send` not called and the request still `pending`; TICKET-031a's
    `rejectPromotionAction` and `listPromotionRequestsAction` still pass with the extended factory.

## Gated criteria (D-008)

- The `FOR UPDATE` serialisation of approval against a concurrent child edit and against a concurrent
  `requestPromotion` needs two connections. Runbook "Pending human verification" line:
  `DATABASE_URL=<neon preview> pnpm --filter @tas/db engine:concurrency` (script from TICKET-037;
  properties 2 and 3 of TICKET-037 criterion 8 cover this ticket); expected last line
  `engine-concurrency: 4/4 properties held`. PGlite proves the single-connection semantics above.

## Files touched

`packages/db/src/template/ops/promotion-approve.ts` (+ test), `packages/db/src/template/ops/index.ts`
(one export line), `apps/web/src/app/app/(admin)/admin/promotions/{actions,admin-promotion-actions}.ts`
(+ test), `apps/web/src/lib/action-result.ts` (two codes).

## Notes

- Stage 1 writes only the ops file, its test and the index line. Stage 2 writes only the admin actions
  files, their test and the two error codes. Neither stage touches `packages/db/src/tenancy.ts`.
- `settleOverrides` returns removals only and `writeChild` applies jsonb set arithmetic (TICKET-024a);
  never assign `overridden_fields` wholesale here (design §11).
