# TICKET-032c · Ops: field resync, field catalog reconcile, `db:migrate` hook and deploy hook

- Owners, in order: schema (stage 1, `packages/db/src/template/ops/field-resync.ts`, the `db:migrate`
  entrypoint under `packages/db/src/`, `packages/db/scripts/resync-field.ts`, `packages/db/package.json`
  scripts) then backend (stage 2, `apps/web/src/app/app/(admin)/admin/fields/**`,
  `apps/web/src/lib/action-result.ts`, `apps/web/vercel.json`, `docs/runbook.md`)
- Size: M
- Depends on: TICKET-032a, TICKET-025 (`attachChange`), TICKET-026 (`fieldVisibility`,
  `brandFieldOverridesSpec`), TICKET-012a (the `db:migrate` entrypoint), TICKET-007 (`vercel.json`, the
  runbook "Deploy" section)
- PRD: §5 (structural change lands in every brand), §10 (which fields appear is a setting), §14.1
- Design: §4.6 (structural change: `resyncTemplateField`, `reconcileFieldCatalog`, `db:migrate` hook,
  `fieldVisibility`), §4.3 (a journaled run is sent by the backstop or the sweeper), §5.4, I8, T27

## Why

A new column has no path to every brand until the field catalog knows it and a backfilled value can be
pushed to children without an override. These two ops and the migrate hook are what make "structural
change = one migration + one registry line" true (G4).

## Acceptance criteria

1. Both ops open `withTemplateScope(reason: 'field_resync')` on the template brand; every write is a
   template-brand journal write through `withBrand(tx, T, ...)` templated methods or `attachChange`, so
   propagation delivers it like any other template change (I8, §4.6).
2. Request handlers only enqueue: `resyncTemplateFieldAction` and `reconcileFieldCatalogAction` attach to
   a run inside the transaction and call `enqueueRun` after commit; the `db:migrate` hook and the
   `resync-field` script run in `packages/db`, which cannot import Inngest (TICKET-029a criterion 1), so
   the run they journal is sent by the next template save (request-path backstop, design §4.3) or by
   `sweep-runs` within the hour; the runbook says so.
3. `pnpm typecheck`, `pnpm lint`, `pnpm test` pass from the root; the diff excluding tests is under 300
   lines.

## Stage 1 (schema) · ops, migrate hook, script

4. `resyncTemplateField(db, registry, { actorId, templateBrandId, tableName, field })` in
   `ops/field-resync.ts`: refuses a field not in `spec.propagatedFields` (`NotPropagated`); one
   transaction that calls `attachChange` (TICKET-025) once per live parent row of the table with `kind
   'update'`, `changedFields [field]`, `source 'field_resync'` and one `batchId` (all rows attach to the
   same queued run). Returns `{ run: RunRef, changes: number }`.
5. `reconcileFieldCatalog(db, registry, { actorId })` in the same file: for every registered spec and
   every key in `propagatedFields ∪ localFields`, inserts a `brand_field_overrides` row (`hidden false`,
   `read_only false`) into the template brand through `withBrand(tx, T, { actorId, batchId, source:
   'field_resync' }).insertTemplated(brandFieldOverridesSpec, ...)` when no alive row exists for
   `(tableName, fieldName)`, and soft-deletes catalog rows whose field is no longer registered through
   `softDeleteTemplated`. Returns `{ inserted, softDeleted, run: RunRef | null }` (`run` is `null` when
   nothing was written). When no `is_template` brand exists (a fresh database: first deploy, a new Neon
   preview branch) it returns `{ inserted: 0, softDeleted: 0, run: null }` and prints
   `reconcileFieldCatalog: no template brand`.
6. The `db:migrate` entrypoint (TICKET-012a) calls `reconcileFieldCatalog` after the migrations with
   `actorId 'system:migrate'` and prints `reconcileFieldCatalog: inserted N, softDeleted M` (or the
   no-template line). `packages/db/package.json` gains the script `resync-field` running
   `packages/db/scripts/resync-field.ts <table> <field>` with the same runner `db:migrate` uses
   (TICKET-003 criterion 8; no new dependency): it calls `resyncTemplateField` with `actorId
   'system:migrate'` against `serverEnv().DATABASE_URL` and prints `resync-field: <n> changes attached to
   run <runId>`; a bad table or field prints the error and exits 1.
7. `packages/db/src/template/ops/index.ts` appends `resyncTemplateField`, `reconcileFieldCatalog`.
8. Tests through `testTemplateWorld()`: T27 (`ops/field-resync.test.ts`): `reconcileFieldCatalog` creates
   the missing template `brand_field_overrides` rows for every registered field (count = Σ fields)
   attached to one run; `claimRun` → `applyChildChunk` → `finishRun` inserts them into A and B; a second
   call inserts nothing and returns `run: null`; a B `hidden = true` override survives a template `label`
   change propagated afterwards; `fieldVisibility(withBrand(db, B), 'interface_pages')` (TICKET-026)
   omits the hidden field; `resyncTemplateField('interface_pages', 'position')` journals one change per
   live parent row with `source 'field_resync'` and, after propagation, A without an override has the
   backfilled value while B's override is untouched; `resyncTemplateField` on a local field →
   `NotPropagated`; on a fresh PGlite with migrations and no seed, `reconcileFieldCatalog` returns the
   zero result and writes nothing (empty-database case). `scripts/resync-field.test.ts`: the script's
   `main(['interface_pages', 'position'])` on PGlite prints the success line; `main(['nope', 'x'])` exits
   1.

## Stage 2 (backend) · admin actions, deploy hook, runbook

9. `apps/web/src/app/app/(admin)/admin/fields/actions.ts` built by `createFieldActions({ auth, db,
   inngest })` in `field-actions.ts` (`inngest` = `inngestForRequest()`): `resyncTemplateFieldAction({
   tableName, field })` and `reconcileFieldCatalogAction()` → `requireAdmin()` → op → `enqueueRun` when a
   run was returned → `{ runId }` (or `{ runId: null }`). `toActionError` learns `not_propagated`. No page
   is built here (TICKET-036b does not build `/app/admin/fields` either; the script of criterion 6 is the
   operator's path until Phase 3 needs a page).
10. Factory tests (stubbed session, fake `inngest`): `reconcileFieldCatalogAction` on an already
    reconciled catalog sends nothing and returns `runId: null`; on a catalog missing one row it sends one
    `template/run.queued`; `resyncTemplateFieldAction` by a member → `forbidden`; on a local field →
    `not_propagated`.
11. `apps/web/vercel.json` (TICKET-007) `buildCommand` becomes `pnpm turbo run build --filter=@tas/web &&
    pnpm --filter @tas/db db:migrate`, so every production and preview deploy migrates its database and
    reconciles the catalog last; the runbook "Deploy" table marks `db:migrate` as the build's last
    command and notes that a preview without `DATABASE_URL` fails the build on purpose.
12. `docs/runbook.md` section "Rolling a schema change out to every brand" receives the six steps of
    design §4.6 with the exact commands (`pnpm --filter @tas/db db:generate`, `db:migrate`, `pnpm --filter
    @tas/db resync-field <table> <field>`), and "Migrations" notes that `db:migrate` runs
    `reconcileFieldCatalog` last, prints the no-template line on a fresh database, and that a run
    journaled by the hook or the script is sent by the next template save or by `sweep-runs` within the
    hour (criterion 2).

## Gated criteria (D-008)

- `db:migrate` deploy hook on a Neon preview branch. Runbook line: `DATABASE_URL=<neon preview>
  pnpm --filter @tas/db db:migrate` prints `reconcileFieldCatalog: inserted N, softDeleted 0`, and after
  the propagation run finishes `psql $DATABASE_URL -c "select count(*) from brand_field_overrides where
  deleted_at is null"` equals the registered field count times the number of brands.

## Files touched

`packages/db/src/template/ops/field-resync.ts` (+ test), `packages/db/src/template/ops/index.ts`, the
`db:migrate` entrypoint under `packages/db/src/`, `packages/db/scripts/resync-field.ts` (+ test),
`packages/db/package.json` (one script), `apps/web/src/app/app/(admin)/admin/fields/{actions,field-actions}.ts`
(+ test), `apps/web/src/lib/action-result.ts`, `apps/web/vercel.json`, `docs/runbook.md`.

## Notes

- Stage 1 never writes in `apps/web`; stage 2 never writes in `packages/db`.
- No new dependency: the script uses the runner `db:migrate` already uses. If TICKET-003 gave
  `packages/db` no script runner at all, stop and report rather than adding one here.
- Estimated size ≈200 LOC excluding tests.
