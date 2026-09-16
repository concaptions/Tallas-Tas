# TICKET-036a · Run listing ops and the propagation admin actions

- Owners, in order: schema (stage 1, `packages/db/src/template/ops/runs.ts`) then backend (stage 2,
  `apps/web/src/app/app/(admin)/admin/propagation/{actions,propagation-actions}.ts`,
  `apps/web/src/lib/action-result.ts`)
- Size: S
- Depends on: TICKET-032a (`createPropagationActions`), TICKET-029b, TICKET-028a (`retryRun`,
  `resendRun`), TICKET-023 (`shouldResend`, `canRetry`)
- PRD: §5 (whenever we make a change in the parent base, it will be replicated: the admin must see that it
  did), §11 (Admin sees everything), §14.1
- Design: §3.5 (`propagation_runs` semantics), §3.6 (child runs and outcomes), §5.2 (Retry after
  `attempt = 3`), §5.4 (stale queued re-send on page load), §6 (`listRuns`, `retryRun`, `resendRun` ops,
  read scope), I8, I14

## Why

The propagation page (TICKET-036b) needs its reads and its three mutations as ops and Server Actions
that are tested without a browser. Keeping them apart from the pages keeps each ticket under the ceiling
and inside one or two roles.

## Acceptance criteria

1. Every listing runs in `withTemplateRead` behind `requireAdmin()` (no audit row, I8); every mutation
   (`retryRun`, `resendRun`, `requestResync`) runs through an op and the Server Action only enqueues after
   commit. Unit tests never start Inngest (G6).
2. `pnpm typecheck`, `pnpm lint`, `pnpm test` pass from the root.

## Stage 1 (schema) · `packages/db/src/template/ops/runs.ts`

3. `listRuns(db, registry, templateBrandId, { status?: RunStatus[]; limit? = 50; cursor? })` returns runs
   newest first with `trigger`, `status`, `attempt`, `resendCount`, `lastEnqueuedAt`, `createdAt`,
   `startedAt`, `finishedAt`, `stats`, `error`, `targetBrand: { id, name } | null`, `changes: number`
   (count of `template_changes`) and `batchIds: string[]` (distinct `template_changes.batch_id`, so the
   Decided tab can link an `applied_batch_id` to its run). `runDetail(db, registry, templateBrandId,
   runId)` returns the run plus its `propagation_child_runs` rows joined to `brands.name` and, per child,
   the informative `propagation_outcomes` rows (`outcome`, `table_name`, `parent_row_id`,
   `applied_fields`, `conflict_fields`, `unresolved_fields`, `error`). Both in `withTemplateRead`; every
   row returned carries TICKET-025's `RunRef` fields so `shouldResend` / `canRetry` (TICKET-023) apply to
   it directly. No predicate is defined here.
4. `packages/db/src/template/ops/index.ts` appends `listRuns`, `runDetail`.
5. Tests through `testTemplateWorld()` (`ops/runs.test.ts`): `listRuns` orders newest first, filters by
   status, reports `changes` and `batchIds`; `runDetail` returns the failed child with its error and the
   `skipped_overridden` outcome after the T6/T7 fixtures; neither inserts an audit row; `runDetail` for a
   run of another template brand returns `null`.

## Stage 2 (backend) · admin actions

6. `createPropagationActions({ auth, db, inngest })` (TICKET-032a) gains `listRunsAction`,
   `runDetailAction` → `requireAdmin()` → read ops; `retryRunAction({ runId })` → `requireAdmin()` →
   `retryRun` (TICKET-028a; `null` → `retry_budget`) → `enqueueRun(inngest, run)`;
   `resendStaleRunsAction()` → `requireAdmin()` → `listRuns({ status: ['queued'] })` → `runs.filter(r =>
   shouldResend(r, now()))` → `resendRun` + `enqueueRun(..., { resend: true })` per run, returns the count
   (the page-load re-send of §5.4). `toActionError` learns `retry_budget`.
7. Factory tests (stubbed session, fake `inngest`, injected `now`): `retryRunAction` on a `failed` run
   sends `template/run.queued` with `attempt` incremented; on a run at `attempt 3` sends nothing and
   returns `retry_budget`; `resendStaleRunsAction` with one six-minute-old queued run sends one event whose
   id ends in `:resend:1` and bumps `resend_count`; a fresh queued run sends nothing; a member →
   `forbidden`; TICKET-032a's `resyncBrandAction` still passes.

## Gated criteria (D-008)

none

## Files touched

`packages/db/src/template/ops/runs.ts` (+ test), `packages/db/src/template/ops/index.ts`,
`apps/web/src/app/app/(admin)/admin/propagation/{actions,propagation-actions}.ts` (+ test),
`apps/web/src/lib/action-result.ts` (`retry_budget`).

## Notes

- Stage 1 writes only in `packages/db/src/template/ops/**`; the predicates are TICKET-023's and nothing
  under `packages/domain` is touched. Stage 2 writes only the actions files and the error code.
- The page-load re-send uses `resendRun`, never `retryRun`: a stale queued run keeps its full retry budget
  (design §5.4).
- Estimated size ≈150 LOC excluding tests.
