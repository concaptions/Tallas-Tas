# TICKET-024b · Batched plan execution, ledger upserts, package subpaths and the import fence

- Owners, in order: schema (stage 1, `packages/db/src/template/scope.ts` methods,
  `packages/db/src/template/sql.ts`, `packages/db/src/template/ops/index.ts`, `packages/db/package.json`
  `exports`, `packages/db/src/index.ts`) then integrator (stage 2, root `eslint.config.js`)
- Size: M
- Depends on: TICKET-024a
- PRD: §5 (the parent replicates into every brand), §11 (clients never reach cross-brand code)
- Design: §3.3 (self-link post-pass), §3.6 (outcome upsert semantics, non-informative drop), §4.1
  (the `INSERT ... SELECT` shape seed and propagation share), §4.4 step 2 (batched statements (a)–(d)),
  §6 (`applyChildPlans`, `insertChildFromParent`, `upsertChildRun`, `upsertOutcomes`; the import fence),
  §8 (the statement-count hook for T25)

## Why

An apply step at the row-operation budget must be a few statements per table, not a round trip per
row (design §11 rejected the fixed chunk for that reason). This ticket is the batched SQL every seed,
resync and propagation runs through, plus the lint fence that keeps the scope out of `apps/web`.

## Stage 1 (schema) · writers and generators

1. `TemplateScope` (TICKET-024a) gains:
   - `applyChildPlans(spec, childBrandId, plans: PlannedGroup[])`: executes the plans of a table for one
     child in at most three statements: (a) one multi-row `INSERT ... SELECT` from the template brand's
     rows `ON CONFLICT (brand_id, template_row_id) DO NOTHING RETURNING id, template_row_id`, outcome
     `inserted` only for rows RETURNING listed, else `noop`; then the self-link post-pass when the spec
     has one; (b) one `UPDATE ... FROM (VALUES ...)` carrying a set-flag per propagated column and a
     lifecycle per row (`soft_delete` → `deleted_at = now()`, `restore` → `NULL`), `updated_by =
     'system:propagation:' || $runId`; (c) one outcomes upsert on `propagation_outcomes_uq` (`DO UPDATE`
     replacing outcome, the four field arrays, `parent_values`, `error = NULL`) plus one `DELETE` for the
     non-informative keys of this batch (design §3.6: the one sanctioned delete outside retention).
     Returns `AppliedCounts` (a count per `OutcomeKind`) and `statements` (the number executed, for T25).
   - `insertChildFromParent(spec, childBrandId, parentRowId)` (statement (a) for one row),
     `upsertChildRun(row)` (statement (d), on `propagation_child_runs_uq`),
     `upsertOutcomes(rows, dropKeys)` (statement (c) standalone).
   Every writer accepts only registered tables and takes the brand from the argument; `rowsWritten`
   accumulates their affected-row counts.
2. `sql.ts` gains: `insertCopiesSql(spec, T, C, actor, ids | 'all')` (the §4.1 shape with the link
   subqueries and the `EXISTS` filter for non-nullable links; the one insert generator seed
   (TICKET-027a) and propagation share), `selfLinkPostPassSql`, `applyUpdatesSql` (the VALUES form),
   `outcomesUpsertSql`, `childRunUpsertSql`. If `sql.ts` passes 150 lines, the ledger generators
   (`outcomesUpsertSql`, `childRunUpsertSql`) move to `sql-ledger.ts` in this stage.
3. `packages/db/package.json` `exports` adds `./template/scope` and `./template/ops` subpaths; the
   `ops` directory is created with an `index.ts` that exports nothing yet (TICKET-031a onward append to
   it, never replace it).
4. Tests on PGlite with `fixtureRegistry(db)`: `sql.test.ts` (§4.4 batching): a mixed batch on
   `fx_items` for one child (one insert, one update of two fields, one soft_delete, one restore, two
   outcomes, one non-informative key) executes exactly 3 statements and `AppliedCounts` matches; the
   insert RETURNING drives `inserted` vs `noop`; a second run of the same insert batch returns `noop`
   for every row (`ON CONFLICT`); the self-link post-pass resolves `parent_item_id` for rows inserted in
   the same batch; `insertCopiesSql(..., 'all')` on `fx_links` excludes a parent whose `fx_items` target
   has no copy and inserts `NULL` for a nullable `theme_ref`-style link to a missing target;
   `upsertOutcomes` overwrites a `failed` outcome with the real one and `dropKeys` removes rows;
   `upsertChildRun` twice for one `(run, brand)` leaves one row with the second counts; every statement
   binds the child brand from the argument (a plan carrying another brand's row id changes nothing).
5. `packages/db/src/index.ts` re-exports the generators. `pnpm typecheck && pnpm lint && pnpm test`
   exit 0.

## Stage 2 (integrator) · import fence

6. Root `eslint.config.js` `no-restricted-imports`: `@tas/db/template/scope` and any relative path
   ending in `template/scope` may be imported only from `packages/db/src/template/**` and
   `packages/integrations/src/inngest/**`; `apps/web/**` may import from `@tas/db/template/ops` and the
   package root only. Message: "cross-brand access only through template ops (design §6)".
7. Verified and pasted in the report: a scratch `apps/web/src/x.ts` importing `@tas/db/template/scope`
   fails `pnpm lint` naming `no-restricted-imports`; the same file importing `@tas/db/template/ops`
   passes; files removed.

## Gated criteria (D-008)

none

## Files touched

Stage 1: `packages/db/src/template/scope.ts` (methods only), `packages/db/src/template/sql.ts` (and
`sql-ledger.ts` per criterion 2), `packages/db/src/template/ops/index.ts`, `packages/db/package.json`,
`packages/db/src/index.ts`, `packages/db/src/template/sql.test.ts`. Stage 2: `eslint.config.js`.

## Notes

- No new dependency.
- Stage 1 never edits the factories, the audit logic or the read methods of TICKET-024a; stage 2 edits
  only the root ESLint config.
- Estimated size ≈200 LOC excluding tests.
