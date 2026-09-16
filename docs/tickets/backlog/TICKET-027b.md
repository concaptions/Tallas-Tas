# TICKET-027b · Per-child apply and `resyncBrand` (plan, chunk, in-process twin)

- Owner: schema (`packages/db/src/template/apply-child.ts`, `resync.ts`)
- Size: M
- Depends on: TICKET-027a
- PRD: §5 (per-brand tables seeded from the parent template; a child's own edits are kept), §14.1,
  §14.2 (reactivated brands catch up by resync)
- Design: §2 (I3 for resync, I11, I12), §4.1 (`resyncBrand`: seed followed by a full re-apply), §4.4
  step 2 (the per-child reads and plan execution resync shares with propagation), §5.3 (resync steps
  `claim`, `seed`, `apply:0 … apply:n-1`, `finish`), §8 (T19b, T20 resync clauses, T29 resync clause),
  §11 (insert-only resync rejected), A7

## Why

Resync is the one repair tool for every gap (unresolved links, an archived brand reactivated, a child
created while a parent row was deleted). It is seed plus a full re-apply under the normal override rules,
and the per-child apply written here is what propagation (TICKET-028b) reuses, so the two can never
disagree about what a child receives.

## Acceptance criteria

1. `apply-child.ts` exports `applyGroupsToChild(scope, registry, { childBrandId, runId, groups,
   parentsByTable, actorId })`: inside `scope.tx`, for each table in registry order it locks the copies
   (`childRows(..., { forUpdate: true })`, deleted included), reads the link map for this table's link
   fields after the earlier tables were written, reads `naturalKeyOwners` for insert / restore groups
   (key values remapped), calls `planChildChange` (TICKET-023) per group, executes the plans through
   `applyChildPlans` (TICKET-024b), and collects the informative outcomes; then upserts the outcomes with
   `dropKeys` for non-informative ones and one `propagation_child_runs` row `{ status 'succeeded',
   counts }`. Returns `{ counts, statements }`. It never writes a row with `template_row_id IS NULL`
   (I12).
2. `resync.ts` exports the three functions TICKET-029a's `seed-brand` function and the tests use:
   - `resyncPlan(db, registry, { runId, actorId = 'system:inngest', stepBudget = 2000, auditId? })`
     (Inngest step `seed` for `trigger 'resync'`): under `withTemplateScope(reason 'resync',
     targetBrandId, existingAuditId)` (audit id resolved as in TICKET-027a criterion 1), runs
     `seedStatements` (TICKET-027a) in one transaction, never touching `seeded_at`; then builds, per
     table in registry order, synthetic groups `{ lifecycle 'none', fields: all propagated }` for every
     live parent row and `{ lifecycle 'soft_delete', fields [] }` for every soft-deleted parent row with
     an alive copy in the child, and slices them into `ceil(groups.length / stepBudget)` chunks (one
     child, many groups: the transpose of `chunkChildren`, at least one chunk). Returns `{ seed, chunks:
     ChangeGroup[][] }` (ids and field names only, A6).
   - `resyncChunk(db, registry, { runId, groups, actorId?, auditId? })` (Inngest step `apply:<i>`): reads
     the parent rows for `groups` (deleted included) and applies them to the run's `target_brand_id`
     through `applyGroupsToChild` in one transaction under the same scope; a throw rolls the chunk back
     and rethrows (retryable). Returns `{ counts, statements }`.
   - `resyncBrand(db, registry, { runId, actorId?, stepBudget? })`: the in-process twin, `resyncPlan`
     then `resyncChunk` per chunk, returning `{ seed, counts, chunks: number }`. Idempotent: a second call
     changes no business row.
   Run status and stats stay TICKET-028a's (`claimRun` / `finishRun`); none of the three changes
   `propagation_runs`.
3. Tests on PGlite through `testTemplateWorld()`:
   - `apply-child.test.ts`: one update group over a clean copy → `counts.applied 1`, no outcome row; an
     overridden copy → outcome `skipped_overridden` with `conflict_fields` and `parent_values`; a
     brand-local row in the child is untouched and never planned; the child-run row is upserted once
     per call.
   - `resync.test.ts`: T19b (B archived; raw update of `P.label` on T and raw soft delete of `Q` on T; B
     reactivated; `resyncBrand(B)` → B's `label` equals the parent, B's overridden field kept, B's copy
     of `Q` deleted, one child-run row and the outcomes under the resync run); T20 resync clauses (a
     `fx_links` parent whose `fx_items` target has no copy is excluded and counted `unresolved`; after
     the target exists, resync inserts it; a nullable `theme_ref`-style link seeded `NULL` is repaired);
     T21 resync half (a brand seeded from an empty template, three parent rows inserted raw,
     `resyncBrand` → three copies); T29 resync clause (B holds a brand-local `interface_pages` row
     `page_key 'ugc'`; T gets a raw `'ugc'` page; resync → outcome `skipped_key_conflict` with
     `conflict_fields ['pageKey']` for B, A gets the copy; B soft-deletes its local row; the next resync
     inserts the copy); idempotence (two resyncs → identical rows, one child-run row per run, no
     duplicate outcomes); the chunk count for 2,500 fixture parent rows at `stepBudget 1000` is 3 and
     `resyncPlan` + three `resyncChunk` calls equal one `resyncBrand` (I11); a run whose `audit_id` is
     set gets no second audit row across plan and chunks.
4. `packages/db/src/index.ts` exports `applyGroupsToChild`, `resyncPlan`, `resyncChunk`, `resyncBrand`.
   `pnpm typecheck && pnpm lint && pnpm test` exit 0.

## Gated criteria (D-008)

none

## Files touched

`packages/db/src/template/apply-child.ts`, `packages/db/src/template/resync.ts`,
`packages/db/src/index.ts`, the `*.test.ts` files next to the code.

## Notes

- No new dependency. Every write runs in the privileged scope with the child brand from the run's
  `target_brand_id`; the only reads of brand-local rows are the natural-key checks.
- `applyGroupsToChild` lives here because resync is its first caller; TICKET-028b composes it over
  chunks of children.
- Design A7's trigger ("reactivating an archived brand runs `resyncBrand`") has no brand status action
  in Phase 1 or 2; TICKET-037 stage 1 puts the brand status action (`archived → active` calls
  `requestResync`) on the Phase 3 backlog.
- Estimated size ≈180 LOC excluding tests.
