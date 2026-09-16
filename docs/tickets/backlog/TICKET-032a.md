# TICKET-032a · Ops: reset to template, acknowledge conflicts, conflicts query, resync brand

- Owners, in order: schema (stage 1, `packages/db/src/template/ops/**`, `packages/db/src/template/scope.ts`
  for `settlePendingPromotion` only) then backend (stage 2,
  `apps/web/src/app/app/(workspace)/brands/[brandSlug]/template-updates/**`,
  `apps/web/src/app/app/(admin)/admin/propagation/**`, `apps/web/src/lib/action-result.ts`)
- Size: M
- Depends on: TICKET-028b, TICKET-030, TICKET-029b (`createRun`, `enqueueRun`, `inngestForRequest`),
  TICKET-027b (`resyncBrand` for the test), TICKET-008, TICKET-014
- PRD: §5 (a child keeps its local edits and decides; structural change lands in every brand), §10
  (per-brand interface configuration), §14.1, §14.2 (reactivated brands catch up by resync)
- Design: §4.1 (`resyncBrand` trigger), §4.7 (`resetToTemplate`, `settlePendingPromotion`), §4.9
  (conflicts, `acknowledgeConflicts`, badge query), §6 (ops, route helpers), I4, I8, T11

## Why

Propagation records conflicts but nobody can resolve them yet, and an archived brand cannot catch up.
These ops close that loop: a brand takes the template value or keeps its own, and an admin resyncs a
brand. Field resync and the catalog reconcile are TICKET-032c so each half stays under the ceiling.

## Acceptance criteria

1. Every op names its brand in the argument and opens `withTemplateScope` with the reason in design §3.7
   (`reset_to_template`, `acknowledge`, `resync`); the conflicts query and the badge count run in
   `withTemplateRead` with `brand_id = $C` in every statement, behind `requireBrandRole` at the route
   (I8).
2. Request handlers only enqueue: `resyncBrandAction` creates the run inside the transaction and calls
   `enqueueRun` after commit; unit tests never start Inngest and drive `resyncBrand` from `@tas/db`
   directly (G6).
3. `pnpm typecheck`, `pnpm lint`, `pnpm test` pass from the root; the diff excluding tests is under 300
   lines.

## Stage 1 (schema) · ops and one scope method

4. `scope.settlePendingPromotion(childBrandId, tableName, childRowId, fields | 'all')` added to
   `TemplateScope` (`packages/db/src/template/scope.ts`, §4.7): locks the pending request for the row if
   any; when `fields` covers all of `request.fields` (or is `'all'`) → `transitionPromotion('pending',
   'withdraw', 'system')`, `review_note 'reset to template'`; when the intersection is partial →
   `transitionPromotion('pending', 'narrow', 'system')` sets it `superseded` and inserts a new `pending`
   request narrowed to `request.fields − fields` with the same `base` / `proposed` subsets, `requested_by`
   and `note`. Returns `{ withdrawn?: string; superseded?: string; narrowedTo?: string }`.
5. `resetToTemplate(db, registry, { actorId, brandId, tableName, rowId, fields: string[] | 'all' })` in
   `ops/reset.ts`: one transaction in `withTemplateScope(reason: 'reset_to_template', targetBrandId:
   brandId)`: `childRowById(..., { forUpdate: true })` (brand-local row → `NoTemplateRow`), `parentRow`
   (deleted included), `resolveLinks`, `resetFields(child, parent, links, fields, spec)` (TICKET-022) →
   `writeChild(values, { removeOverrides })` (jsonb `-`, I4 kept), `scope.acknowledgeConflicts(brandId,
   tableName, rowId, fields)` (field-level form, TICKET-024a), `settlePendingPromotion(...)`. `fields
   ['deletedAt']` or `'all'` reconciles lifecycle: restore when the parent is alive, soft-delete when the
   parent is deleted. An unresolvable non-nullable link → `UnresolvedLinkError`, transaction rolled back.
   Returns `{ values, removedOverrides, settled }`.
6. `acknowledgeConflicts(db, registry, { actorId, brandId, tableName, childRowId, fields? })` in
   `ops/conflicts.ts`, scope reason `'acknowledge'`, delegates to the scope method of TICKET-024a
   (row-level without `fields`, field-level with) and returns the number of outcome rows touched. The
   same file exports the read ops `listConflicts(db, registry, templateBrandId, brandId, { tableName? })`
   (latest unacknowledged outcome per `(table_name, child_row_id)` with `conflict_fields <> '[]'`, joined
   to the child row for the current child values and `spec.labelField`; `skipped_key_conflict` rows
   include the natural-key owner row id) and `countConflicts(...)` (the badge query of §4.9,
   `count(DISTINCT (table_name, child_row_id))`).
7. `requestResync(db, registry, { actorId, brandId })` in `ops/resync.ts` verifies the brand is a
   non-template child of `templateBrandId` (`NotAChild`), refuses when a `seed` or `resync` run for the
   brand is `queued` or `running` (`ResyncInProgress`), inserts a `resync` run through `createRun`
   (TICKET-029a) and returns the `RunRef`. The job (TICKET-029a `seed-brand`, `trigger 'resync'`)
   executes `resyncPlan` / `resyncChunk`; this op never calls them.
8. `packages/db/src/template/ops/index.ts` appends `resetToTemplate`, `acknowledgeConflicts`,
   `listConflicts`, `countConflicts`, `requestResync`.
9. Tests through `testTemplateWorld()` (no `queued` seed run exists after the fixture, TICKET-027a
   criterion 3, so `requestResync` is not blocked by the seed):
   - T11 (`ops/reset.test.ts`): `resetToTemplate(B, ['label'])` copies the parent value, removes only
     that override (an override on `position` stays), narrows a `['label','position']` outcome to
     `['position']` unacknowledged, writes one audit row closed `succeeded`; brand-local row →
     `NoTemplateRow`; `['deletedAt']` restores a child-deleted copy when the parent is alive and deletes
     it when the parent is deleted, removing `'deletedAt'`; a pending promotion on `['label']` becomes
     `withdrawn` with `review_note 'reset to template'`; one on `['label','position']` becomes
     `superseded` and a new `pending` request on `['position']` exists with the subset snapshots;
     `resetToTemplate(..., 'all')` clears every override.
   - `ops/conflicts.test.ts`: row-level acknowledge closes two open outcomes of the same row from two
     runs; field-level leaves `position` open; `listConflicts(B)` returns one entry per row with the
     child values and `parent_values`, none for A, and a `skipped_key_conflict` entry with the owner row
     id (T29 data from TICKET-028b's fixture); `countConflicts` matches; `listConflicts` inserts no audit
     row.
   - `ops/resync.test.ts`: `requestResync(B)` creates a `resync` run targeting B; a second call while it
     is queued → `ResyncInProgress`; `requestResync(T)` → `NotAChild`; running `resyncBrand(db,
     registry, { runId })` (TICKET-027b) afterwards, then a direct `finishRun`-free status check, leaves
     the run's child-run row written (T19b itself stays in TICKET-027b).

## Stage 2 (backend) · Server Actions

10. `apps/web/src/app/app/(workspace)/brands/[brandSlug]/template-updates/actions.ts` built by
    `createTemplateUpdateActions({ auth, db })` in `template-update-actions.ts`: `resetToTemplateAction({
    brandId, tableName, rowId, fields })`, `acknowledgeConflictsAction({ brandId, tableName, childRowId,
    fields? })`, `listConflictsAction({ brandId, tableName? })`, `countConflictsAction({ brandId })`, each
    behind `requireBrandRole(brandId, ...internalBrandRoles)` (TICKET-014). `toActionError` learns
    `no_template_row`, `not_a_child`, `resync_in_progress`.
11. `apps/web/src/app/app/(admin)/admin/propagation/actions.ts` built by `createPropagationActions({ auth,
    db, inngest })` in `propagation-actions.ts` (`inngest` = `inngestForRequest()`, TICKET-029b):
    `resyncBrandAction({ brandId })` → `requireAdmin()` → `requestResync` → `enqueueRun(inngest, run)`
    after commit → `{ runId }`. TICKET-036a extends this factory.
12. Factory tests (stubbed session, fake `inngest`): a `client`-only identity → `forbidden` on every
    workspace action; the seeded strategist on the child brand can reset and acknowledge;
    `resyncBrandAction` by the admin sends exactly one `brand/seed.queued` event with `trigger 'resync'`
    and the run id from PGlite; by a member → `forbidden`.

## Gated criteria (D-008)

none

## Files touched

`packages/db/src/template/scope.ts` (one method), `packages/db/src/template/ops/reset.ts` (+ test),
`packages/db/src/template/ops/conflicts.ts` (+ test), `packages/db/src/template/ops/resync.ts` (+ test),
`packages/db/src/template/ops/index.ts`,
`apps/web/src/app/app/(workspace)/brands/[brandSlug]/template-updates/{actions,template-update-actions}.ts`
(+ test), `apps/web/src/app/app/(admin)/admin/propagation/{actions,propagation-actions}.ts` (+ test),
`apps/web/src/lib/action-result.ts`.

## Notes

- Stage 1 touches `scope.ts` for `settlePendingPromotion` only; every other scope method is TICKET-024a's
  or TICKET-024b's. Stage 2 never writes in `packages/db`.
- `resetToTemplate` always uses the field-level acknowledge form, even for `'all'` (pass the full
  propagated list plus `'deletedAt'`), so an outcome opened after the reset is not closed by accident.
- `listConflicts` needs no cross-brand read: template values come from `parent_values` on the outcome
  (design §4.9); do not join the parent table.
- TICKET-035 builds the "Template updates" page on `listConflictsAction` / `countConflictsAction`;
  TICKET-036b builds the propagation page on `resyncBrandAction`.
- Estimated size ≈230 LOC excluding tests.
