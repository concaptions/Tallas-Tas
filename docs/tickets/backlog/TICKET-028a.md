# TICKET-028a · Run lifecycle: claim, assert, finish, resend, retry

- Owner: schema (`packages/db/src/template/run.ts`)
- Size: M
- Depends on: TICKET-025, TICKET-027a, TICKET-023 (`shouldResend`, `canRetry`, the run transition table
  through TICKET-022)
- PRD: §5 (a parent change is replicated to every brand: reliably, with a visible ledger), §14.1
- Design: §2 (I6 after a claim, I7, I14), §3.5 (`attempt`, `resend_count`, `last_enqueued_at`,
  `claimed_by`, `claim_generation`, `stats` derived at finish), §4.4 step 1 (claim, coalesce, child
  list, `attempt > 1` narrowing) and step 3 (finish, `onFailure`), §5.1 (event id scheme), §5.2
  (mutual exclusion), §5.4 (`findRunsToResend`, resend vs retry), §8 (T24), §11 (debounce /
  idempotency as correctness rejected)

## Why

The database claim, not Inngest, is the authority on who applies a run (A12). Claim generation makes
a takeover explicit so a stale instance can never change run state; the sweeper's two paths (re-send
a lost event without spending an attempt, retry an executed run up to three times) keep a poisoned run
from burning executions forever. All of it is provable on PGlite except the two-connection races.

## Acceptance criteria

1. `claimRun(db, registry, { runId, inngestRunId, actorId = 'system:inngest' })` returns
   `{ skipped: true }` or `{ skipped: false, attempt, claimGeneration, auditId, trigger,
   templateBrandId, targetBrandId, groups, childIds }` (the shape TICKET-029a's `claim` step consumes;
   `registry` is needed for `coalesceChanges`). It runs the `UPDATE ... RETURNING` of design
   §4.4 step 1 verbatim (statuses `queued | failed | partial`, or `running` when `claimed_by =
   $inngestRunId` or `started_at < now() − 30 min`) as its own statement; zero rows → `skipped: true`
   and nothing else written. On success, in one transaction: insert the `engine_audit_log` row
   (`reason` `'propagate' | 'seed' | 'resync'` by trigger, `status 'running'`, `subject { runId }`,
   `target_brand_id` for seed / resync) and `UPDATE propagation_runs SET audit_id = $auditId WHERE id =
   $runId AND claim_generation = $mine`. For a `changes` run it then reads `template_changes ... ORDER
   BY seq`, returns `coalesceChanges(...)` and the child ids (`template_brand_id = $T AND deleted_at IS
   NULL AND status <> 'archived'`, unseeded included), narrowed on `attempt > 1` to children whose
   `propagation_child_runs` row for this run is missing or `failed`. For `seed | resync` it returns
   `groups []` and `childIds [targetBrandId]`. Output holds ids and field names only (A6).
2. `assertClaim(db, { runId, inngestRunId, claimGeneration })` throws `LostClaimError` (with
   `nonRetriable = true`, mapped to Inngest's `NonRetriableError` in TICKET-029a) unless both
   `claimed_by` and `claim_generation` match.
3. `finishRun(db, { runId, claimGeneration, childIds?, seedStats? })` in one transaction guarded by
   `WHERE claim_generation = $mine` (zero rows → `LostClaimError`): `childIds` defaults to the run's
   non-archived children created before `started_at` (so TICKET-029a's `finish` step passes only
   `runId` and `claimGeneration`); `failedChildren` = children in `childIds` with no
   `propagation_child_runs` row plus rows with `status 'failed'`; `stats` =
   `deriveRunStats(childRuns, outcomes, childIds, seedStats)` (never incremented); `status` `succeeded`
   when `failedChildren = 0` else `partial`, checked through `assertRunTransition`; `finished_at =
   now()`; the audit row closed `succeeded` with `rows_written` = applied + inserted + softDeleted +
   restored. `failRun(db, { runId, claimGeneration, error })` sets `status 'failed'`, `error`,
   `finished_at` under the same guard and closes the audit row `failed`.
4. `deriveRunStats(childRuns, outcomes, childIds, seedStats?)` is an exported pure function producing
   the `RunStats` shape of design §3.5 (`children`, `changes`, `applied`, `inserted`, `softDeleted`,
   `restored`, `skipped`, `conflicts`, `unresolved`, `failedChildren`, optional `tables`).
5. `findRunsToResend(db, now)` runs the §5.4 query and returns each run tagged `kind: 'resend'`
   (stale queued) or `'retry'` (stale running, `failed | partial` under `attempt 3`). The SQL is the
   database twin of TICKET-023's `shouldResend` / `canRetry` and uses their exported constants
   (`RESEND_AFTER_MS`, `STALE_RUNNING_MS`, `MAX_ATTEMPTS`) for its intervals; `sweep.test.ts` asserts
   that for every fixture run the SQL tag equals the predicate's answer.
6. `resendRun(db, runId, now)`: `SET resend_count = resend_count + 1, last_enqueued_at = $now WHERE id =
   $runId AND status = 'queued' RETURNING *`, `null` when zero rows; `attempt` untouched.
   `retryRun(db, runId)`: `SET attempt = attempt + 1 WHERE id = $runId AND attempt < 3 AND (status IN
   ('failed', 'partial') OR (status = 'running' AND started_at < now() − 30 min)) RETURNING *`, `null`
   when zero rows. `runEventId(run, { resend })` is the pure naming formula
   `run:<runId>:<attempt>` / `run:<runId>:<attempt>:resend:<resendCount>` (design §5.1); `enqueueRun`
   (TICKET-029a) uses it. `resendRun` and `retryRun` return TICKET-025's `RunRef` shape (plus the full
   row), so `enqueueRun` accepts their result directly.
7. Tests on PGlite through `testTemplateWorld()`; template writes through `withBrand(T,
   ctx).updateTemplated` (TICKET-025):
   - `run.test.ts` (T24 clauses from "after a claim" onward, I7, I14, A12; the first clause, "a
     committed template write leaves a `queued` run", is TICKET-025's `outbox.test.ts` and is not
     repeated here): after `claimRun` the next write opens a new `queued` run and the claimed run's
     journal is unchanged;
     `claimRun` on a `succeeded` run → `skipped: true`; on a `running` run held by another
     `inngestRunId` with fresh `started_at` → `skipped: true`; the same `inngestRunId` re-claims its
     own `running` row; a `running` row with `started_at` 31 minutes old is claimed by another instance
     with `claim_generation + 1`, after which the old instance's `assertClaim` throws `LostClaimError`
     and its `finishRun` throws and updates zero rows; every claim inserts one audit row and sets
     `audit_id`; a `changes` claim returns the coalesced groups and the non-archived children (archived
     excluded, unseeded included); on `attempt 2` only children with a missing or `failed` child-run
     row are returned; `finishRun` with a missing child-run row → `partial`, with all `succeeded` →
     `succeeded`, `stats` equal to the sums of the child-run counts, `finished_at` set, audit closed;
     `finishRun` without `childIds` counts a child created after `started_at` as neither missing nor
     failed;
     `failRun` → `failed` with the message; an illegal transition (`finishRun` on a `queued` run)
     throws `IllegalRunTransition`.
   - `sweep.test.ts` (§5.4): `findRunsToResend` lists a queued run whose `coalesce(last_enqueued_at,
     created_at)` is 6 minutes old, a running run started 31 minutes ago, `failed` and `partial` runs at
     `attempt 2`; skips a queued run 4 minutes old, a running run started 5 minutes ago, `succeeded`,
     and `failed` at `attempt 3`; `resendRun` bumps `resend_count` and `last_enqueued_at` and leaves
     `attempt`; `resendRun` on a `running` run returns `null`; `retryRun` bumps `attempt` on `failed`,
     `partial` and stale `running`, returns `null` at `attempt 3` and on `queued`.
   - `run-stats.test.ts` and `run-event-id.test.ts`: `deriveRunStats` over fixture child-run rows and
     outcomes (counts, `failedChildren`, seed `tables` pass-through); `runEventId` for first send,
     retry and re-send.
8. `packages/db/src/index.ts` exports the functions. `pnpm typecheck && pnpm lint && pnpm test` exit 0.

## Gated criteria (D-008)

none

## Files touched

`packages/db/src/template/run.ts`, `packages/db/src/index.ts`,
`packages/db/src/template/run.test.ts`, `packages/db/src/template/sweep.test.ts`,
`packages/db/src/template/run-stats.test.ts`, `packages/db/src/template/run-event-id.test.ts`.

## Notes

- No new dependency. Every statement targets `propagation_runs`, `engine_audit_log`,
  `template_changes` and `propagation_child_runs` by `run_id` under the claim guard; no business row is
  read or written here.
- The two-connection properties (a queued-run row lock against a concurrent claim, a live takeover)
  are D-025 (design §12 D-014) and TICKET-037's runbook script against Neon; T24 proves the
  single-connection half.
- No Inngest code here; TICKET-029a wraps these functions. `scope.ts` is not edited: `closeAudit` comes
  from TICKET-024a.
- Estimated size ≈200 LOC excluding tests.
