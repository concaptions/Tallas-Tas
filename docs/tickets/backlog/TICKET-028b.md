# TICKET-028b · `applyChildChunk` and `propagateRun`

- Owner: schema (`packages/db/src/template/apply.ts`, `packages/db/src/template/propagate.ts`)
- Size: L
- Depends on: TICKET-028a, TICKET-027b (`applyGroupsToChild`)
- PRD: §5 (whenever we make a change in the parent base, it is replicated; a child's own edits are
  kept), §14.1 (one template, propagated), §14.3 (inheritance actually automated)
- Design: §2 (I3, I7, I10 propagation clause, I11, I12), §3.6 (informative outcomes, upsert
  semantics), §4.4 step 2 (parent re-read per step, per-table link map, per-child transaction, failed
  child-run side transaction), §4.8 (delete, restore, new parent rows), §4.9 (conflicts written as
  outcomes), §5.2 (failure isolation, chunking, statement budget), §8 (T6, T7, T8, T9, T10, T18
  propagation clause, T19, T20, T25, T29)

## Why

This is the job body of Non-negotiable 1: a parent insert, update, soft delete or restore lands in
every non-archived child within a run, skips what the child edited, records a conflict where the two
disagree, and survives retries without duplicating anything. Tests drive it in-process; Inngest
(TICKET-029a) only sequences the steps.

## Acceptance criteria

1. `applyChildChunk(db, registry, { runId, inngestRunId, claimGeneration, groups, childIds, auditId?,
   actorId = 'system:inngest' })` (`auditId` is read from the run row when omitted, so TICKET-029a's
   `apply:<i>` step passes ids only): calls `assertClaim` first; reads the parent rows for the chunk's groups (one `SELECT *
   FROM <table> WHERE id = ANY($ids)` per table, deleted rows included: the live state is what
   propagates); for each child in `childIds`, one transaction through `applyGroupsToChild` (TICKET-027b)
   under `withTemplateScope({ reason 'propagate', existingAuditId: auditId })`; when a child's
   transaction throws it is rolled back, one `propagation_child_runs` row `{ status 'failed', error }`
   is upserted for that child in a separate short transaction (no per-row outcomes invented), and the
   error is rethrown (retryable) after the remaining children are not attempted. Returns
   `{ perChild: Record<childId, { counts, statements }> }`. `updated_by` on every propagated write is
   `system:propagation:<runId>`.
2. `propagateRun(db, registry, { runId, inngestRunId, stepBudget = 2000, actorId?, hooks? })` is the
   in-process orchestration TICKET-029a's function mirrors step for step: `claimRun` (→ `{ skipped:
   true }` when the claim is skipped), `chunkChildren(childIds, groups.length, stepBudget)`, `applyChildChunk`
   per chunk, `finishRun`. `hooks.beforeChunk?(index)` lets a test inject a failure between chunks;
   an exception after the claim propagates to the caller (tests call `failRun` explicitly, as Inngest's
   `onFailure` will). Returns `{ runId, status, stats, chunks }`.
3. Tests on PGlite through `testTemplateWorld()`, template writes through `withBrand(T,
   ctx).updateTemplated` / `insertTemplated` / `softDeleteTemplated` / `restoreTemplated`, runs applied
   with `propagateRun`. A helper `assertPropagated(world, group)` checks I3 (for every non-archived
   child copy and each field of the group, the value equals the remapped parent value unless the field
   is in `overridden_fields`) and `assertLocalRowsUntouched(world)` checks I12 (brand-local rows'
   count and values unchanged); both run at the end of every propagation test:
   - `propagate-update.test.ts` (T6, I3, I7): A (no override) gets `label`, no per-row outcome, child-run
     `counts.applied 1`; B (overridden) keeps its value with an outcome `skipped_overridden`,
     `conflict_fields ['label']`, `parent_values { label }`; B overridden to the same value → counted
     `skipped_equal`, no outcome row; run `stats` equal the child-run rows and outcomes; a soft-deleted
     copy in A receives the update too.
   - `propagate-idempotence.test.ts` (T7, I11, I7, I14): the same run applied twice; two runs in
     reverse order; a retried chunk after an injected failure (fixture CHECK on `fx_items`) → identical
     rows, one child-run row per `(run, child)`, one outcome per `(run, child, row)`, the `failed`
     child-run row overwritten, run `partial` after `failRun`, then `retryRun` + `propagateRun` on
     attempt 2 applies only the failed child and finishes `succeeded`; a child whose failed-row write is
     suppressed (hook) has no child-run row and the run is `partial`.
   - `propagate-insert.test.ts` (T8, I12, §4.8): template `insertTemplated(page)` after seed → A and B
     receive copies with `overridden_fields []`; brand-local rows in A untouched; a fixture
     `fx_items` + `fx_links` pair inserted in one batch applies in registry order and the link resolves;
     an insert of a page and a repoint of `interface_fields.page_id` to it in one run resolves through
     the per-table link map; T19 (archived child skipped with no child-run row, paused child updated,
     a child created unseeded receives the insert).
   - `propagate-lifecycle.test.ts` (T9, T10, §4.8): template soft-deletes a page → A's clean copy
     deleted, B's overridden copy kept with `conflict_fields ['deletedAt']`; template restores → A's
     copy restored, a copy B deleted itself stays deleted, brand C seeded while the parent was deleted
     receives the copy; an edit followed by a delete in one run writes the edit and the tombstone; a
     restore followed by an edit inserts-or-restores and writes the edit.
   - `propagate-links.test.ts` (T18 clause, T20 clauses): fixture `theme_ref` propagates verbatim
     (I10); an insert with an unresolvable NOT NULL link → `skipped_unresolved_link`; a nullable link to
     a missing target inserted `NULL` and listed in `unresolved_fields`; an update to an unresolved link
     leaves the child's value (never `NULL` over a value).
   - `propagate-natural-key.test.ts` (T29): B holds a brand-local `'ugc'` page; T inserts `'ugc'` → B
     outcome `skipped_key_conflict` with `conflict_fields ['pageKey']` and `parent_values`, A gets the
     copy, the run is `succeeded`; the same for a restore whose key B reused.
   - `propagate-load.test.ts` (T25, §4.4 batching): 5 children × 20 rows × the 3 fixture tables
     seeded; one template update propagates and a 20-row import in one batch propagates; for every
     child transaction `statements ≤ 3 × tables + 1`; the chunk count matches `chunkChildren`.
4. `packages/db/src/index.ts` exports `applyChildChunk` and `propagateRun`. `pnpm typecheck && pnpm
   lint && pnpm test` exit 0.

## Gated criteria (D-008)

none

## Files touched

`packages/db/src/template/apply.ts`, `packages/db/src/template/propagate.ts`,
`packages/db/src/template/testing.ts` (`assertPropagated`, `assertLocalRowsUntouched`),
`packages/db/src/index.ts`, `packages/db/src/template/propagate-*.test.ts`.

## Notes

- No new dependency. Every write runs in the privileged scope with the child brand taken from the
  claim's child list; parent rows are read from the template brand only.
- T25L (50 children × 100 rows × 8 tables, nightly) and its Vitest project are TICKET-037.
- The `FOR UPDATE` serialisation of a child edit against a running propagation needs two connections:
  D-025 (design §12 D-014), TICKET-037.
- No Inngest step or event here; `propagateRun` is the in-process twin TICKET-029a wraps.
- Estimated size ≈180 LOC excluding tests (the per-child apply is TICKET-027b's).
