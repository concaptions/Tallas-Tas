# TICKET-021 · Engine ledger tables and `renameFieldKey`

- Owner: schema
- Size: M
- Depends on: TICKET-020
- PRD: §5 (a change in the parent is replicated to every brand: the journal and run ledger are how
  that is tracked), §14.1
- Design: §2 (I6 and I7 structural half; I8 audit table), §3.4 (`template_changes`), §3.5
  (`propagation_runs`), §3.6 (`propagation_child_runs`, `propagation_outcomes`, retention), §3.7
  (`engine_audit_log`), §4.6 step 6 (`renameFieldKey`, `fieldKeyTargets`), §8 (T23), §12 (engine
  ledgers are operational logs)

## Why

The outbox (journal plus queued run) is what makes a template write and its propagation one atomic
fact (I6); the ledger tables are what make retries idempotent and conflicts visible without a
cross-brand read. They are created here, empty, so TICKET-024a and TICKET-025 can write them.

## Acceptance criteria

1. Tables exactly as design §3.4–§3.7, one file each under `packages/db/src/schema/`:
   `engine-audit-log.ts`, `propagation-runs.ts` (with the `RunStats` type on the `stats` jsonb),
   `template-changes.ts`, `propagation-child-runs.ts`, `propagation-outcomes.ts`. All use `baseColumns`
   and the `pgEnum`s of TICKET-020. Every index, partial unique index and CHECK named in the design is
   present with the design's name: `template_changes_run_idx`, `template_changes_row_idx`,
   `template_changes_brand_not_null`, `propagation_runs_one_queued`, `propagation_runs_status_idx`,
   `propagation_runs_target_idx`, `propagation_child_runs_uq`, `propagation_outcomes_uq`,
   `propagation_outcomes_conflicts_idx`, `engine_audit_actor_idx`. Defaults: `attempt 1`,
   `resend_count 0`, `claim_generation 0`, `status 'queued'`, `stats '{}'`, `counts '{}'`, the four
   field arrays `'[]'`, `engine_audit_log.status 'running'`, `rows_written 0`.
2. One migration generated; `testDb()` applies it on PGlite.
3. `packages/db/src/template/field-key-targets.ts` exports `FieldKeyTarget =
   { table: string; column: string; kind: 'array' | 'objectKeys' | 'scalar' }` and the array literal
   `fieldKeyTargets`, initially `[{ table: 'self', column: 'overridden_fields', kind: 'array' },
   { table: 'template_changes', column: 'changed_fields', kind: 'array' }]`. `'self'` means the table
   being renamed (every templated table has `overridden_fields`); every other target table carries a
   `table_name` column. TICKET-026 and TICKET-030 append to the literal.
4. `packages/db/src/template/migrate-helpers.ts` exports `renameFieldKey(tx, targets, tableName, from,
   to)`: for each target, `array` rewrites the jsonb array replacing `from` with `to`, de-duplicates and
   sorts (`WHERE <column> ? $from`); `objectKeys` moves the value under `from` to `to`
   (`(<column> - $from) || jsonb_build_object($to, <column> -> $from)`, `WHERE <column> ? $from`);
   `scalar` sets `<column> = $to WHERE <column> = $from`. A `'self'` target runs against `tableName`
   with no further filter; every other target adds `AND table_name = $tableName`. Returns
   `Record<'<table>.<column>', number>` of rows updated (`'self'` reported under the real table name).
   It runs inside the caller's transaction (a migration renaming the column runs it in the same
   migration).
5. Tests on PGlite through `testDb()`:
   - `ledger-tables.test.ts` (I6, I7 structural half): `template_changes` with `brand_id NULL` fails the
     CHECK; two `queued` `changes` runs for one template brand fail `propagation_runs_one_queued`; a
     `queued` `seed` run and a `queued` `changes` run for the same brand coexist; after the first
     `changes` run is set to `running` a new `queued` one inserts; two `propagation_child_runs` rows for
     one `(run, brand)` fail and `ON CONFLICT (run_id, brand_id) DO UPDATE` succeeds; the same for
     `propagation_outcomes` on `(run_id, brand_id, table_name, parent_row_id)`; `status = 'done'` on a
     run is rejected by the enum; every default of criterion 1 is read back.
   - `rename-field-key.test.ts` (T23, this ticket's targets) on `fixtureRegistry(db)`: `fx_items` rows
     with `overridden_fields ['name', 'status']` and `['name']`, `fx_links` rows with `['name']`,
     `template_changes` rows `changed_fields ['name']` for `table_name 'fx_items'` and for `'fx_links'`;
     after `renameFieldKey(tx, fieldKeyTargets, 'fx_items', 'name', 'title')`: the `fx_items`
     arrays read `['status', 'title']` and `['title']`, `fx_links` arrays are untouched, the `fx_items`
     journal row reads `['title']`, the `fx_links` journal row is untouched, a row that already held
     `'title'` is de-duplicated, and the returned counts are `{ 'fx_items.overridden_fields': 2,
     'template_changes.changed_fields': 1 }` plus zeros. A second `objectKeys` and `scalar` case each
     run against a throwaway fixture column so all three kinds are exercised.
6. `docs/decisions.md` carries `D-021 · Engine ledgers are operational logs` (design §12, listed there
   as D-010; appended by the planner before TICKET-020 was picked): `propagation_outcomes`,
   `propagation_child_runs`, `template_changes` and `engine_audit_log` may be hard-deleted by the
   retention job (TICKET-032b) after 90 days; the "soft delete only" rule protects business data;
   `propagation_runs` and `promotion_requests` are kept. This ticket confirms the entry is present and
   cites its number in the header comment of every ledger schema file; if it is missing, stop and
   report (the planner appends it), do not append it here.
7. `packages/db/src/index.ts` exports the five tables, `fieldKeyTargets` and `renameFieldKey`.
   `pnpm typecheck && pnpm lint && pnpm test` exit 0.

## Gated criteria (D-008)

none

## Files touched

`packages/db/src/schema/engine-audit-log.ts`, `packages/db/src/schema/propagation-runs.ts`,
`packages/db/src/schema/template-changes.ts`, `packages/db/src/schema/propagation-child-runs.ts`,
`packages/db/src/schema/propagation-outcomes.ts`, `packages/db/src/schema/index.ts`,
`packages/db/src/template/field-key-targets.ts`, `packages/db/src/template/migrate-helpers.ts`,
`packages/db/drizzle/*`, `packages/db/src/index.ts`, the `*.test.ts` files next to the code.

## Notes

- No new dependency. No production code writes these tables yet (TICKET-024a, TICKET-025, TICKET-028a).
- `brand_id` on every ledger table is the template brand except `propagation_child_runs` and
  `propagation_outcomes`, where it is the child brand (design §3.6); document this in each file header.
- `renameFieldKey` is registry-driven so a Phase 3 rename is one migration line; nothing here hard
  deletes.
- Estimated size ≈220 LOC excluding tests.
