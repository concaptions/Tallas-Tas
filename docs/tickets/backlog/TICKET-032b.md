# TICKET-032b · Ops `linkToTemplate` and `retentionSweep`, retention cron

- Owners, in order: schema (stage 1, `packages/db/src/template/ops/link.ts`,
  `packages/db/src/template/retention.ts`) then backend (stage 2,
  `packages/integrations/src/inngest/functions/retention.ts`, `packages/integrations/src/inngest/index.ts`)
- Size: S
- Depends on: TICKET-032a
- PRD: §15 (migration: everything currently in Airtable moved across; existing rows become children of
  the template), §14.6 (cost: bounded storage on the free Neon plan)
- Design: §4.10 (`linkToTemplate`), §3.6 retention paragraph, §5.5 (storage at target), §6 (ops), I2,
  I12, T28, T30, §12 "Engine ledgers are operational logs" (D-021 in this plan's numbering, appended by
  the planner before TICKET-020)

## Why

Migrated Airtable rows arrive brand-local and would be duplicated by the template's copies unless adopted
(I12). And the outcome ledger grows without bound on a free storage plan unless old, resolved rows are
hard-deleted; the ledger decision (D-021) carves that exception out of the soft-delete rule for engine
logs only.

## Acceptance criteria

1. `linkToTemplate` opens `withTemplateScope(reason: 'import', targetBrandId: brandId)`; `retentionSweep`
   opens `withTemplateScope(reason: 'retention')` and is the only function that deletes ledger rows by
   age. The only other `DELETE` in `packages/db` is the non-informative-outcome drop inside
   `upsertOutcomes` / `applyChildPlans` (TICKET-024b, design §3.6). Command:
   `grep -rln "\.delete(\|DELETE FROM" packages/db/src --include=*.ts | grep -v "\.test\.ts"` lists exactly
   `packages/db/src/template/retention.ts` and the TICKET-024b generator file (`template/sql.ts` or
   `template/sql-ledger.ts`). `retentionSweep` never touches `propagation_runs`, `promotion_requests` or
   any business table.
2. Unit tests never start Inngest; the cron function is a wrapper over `retentionSweep`, which tests call
   directly on PGlite (G6). Request handlers are not involved (no Server Action in this ticket; the
   migrator script of Phase 6 calls `linkToTemplate` directly).
3. `pnpm typecheck`, `pnpm lint`, `pnpm test` pass from the root.

## Stage 1 (schema) · the two functions

4. `linkToTemplate(db, registry, { actorId, brandId, tableName, rowId, parentRowId })` in `ops/link.ts`,
   one transaction: lock the child row `FOR UPDATE` (`NoSuchRow` if missing or not in `brandId`); refuse
   unless `template_row_id IS NULL` (`AlreadyLinked`); refuse unless `parentRowId` exists in the brand's
   `template_brand_id` for the same table, deleted included (`NoSuchParent`); refuse when any row in the
   brand, deleted included, already has `template_row_id = parentRowId` (`CopyExists`, I2); then
   `resolveLinksToParent` for the child's link fields and `writeChild(spec, brandId, rowId, {
   templateRowId: parentRowId }, { addOverrides: overridesForLinkedRow(child, parent, links, spec) })`
   (TICKET-022; links pointing at brand-local targets count as overrides). No journal row, no run.
   Returns `{ rowId, parentRowId, overriddenFields }`.
5. `retentionSweep(db, registry, { actorId: 'system:inngest', now, days = 90 })` in
   `packages/db/src/template/retention.ts`, three statements in one transaction plus the audit row: (a)
   `DELETE FROM propagation_outcomes WHERE created_at < now − days AND (conflict_fields = '[]' OR
   acknowledged_at IS NOT NULL)`; (b) `DELETE FROM propagation_child_runs` and `DELETE FROM
   template_changes` for runs whose `finished_at < now − days`; (c) `DELETE FROM engine_audit_log WHERE
   created_at < now − days AND id NOT IN (SELECT audit_id FROM propagation_runs WHERE audit_id IS NOT
   NULL)`. Returns `{ outcomes, childRuns, changes, audits }` counts. `propagation_runs` and
   `promotion_requests` rows are never deleted.
6. `packages/db/src/template/ops/index.ts` appends `linkToTemplate`; `packages/db/src/template/index.ts`
   exports `retentionSweep`.
7. Tests through `testTemplateWorld()`:
   - T28 (`ops/link.test.ts`): refuses a linked row (`AlreadyLinked`), a missing parent (`NoSuchParent`)
     and a parent that already has a copy in B, including a soft-deleted copy (`CopyExists`); links a
     brand-local `interface_pages` row in B whose `label` differs from the parent → `template_row_id` set,
     `overridden_fields ['label']`, no `template_changes` row written; the next propagation of a parent
     edit to `position` updates B's `position` and leaves `label`; a brand-local `interface_fields` row
     whose `page_id` points at a brand-local page gets `'pageId'` in its overrides; every call writes one
     audit row (`reason 'import'`), `failed` on refusal.
   - T30 (`retention.test.ts`, `now` injected): outcomes created 91 days ago with empty or acknowledged
     conflicts are gone; a 91-day-old unacknowledged conflict stays; 89-day-old rows stay; child-run and
     journal rows of a run finished 91 days ago are gone while those of a run finished yesterday stay;
     the audit row of a 91-day-old run is kept while an orphan 91-day-old audit row is gone; `propagation_runs`
     and `promotion_requests` counts are unchanged; a second sweep deletes nothing.

## Stage 2 (backend) · retention cron

8. `packages/integrations/src/inngest/functions/retention.ts`: `createRetention(inngest, deps)` with
   `retentionConfig(timezone) = { id: 'retention', cron: \`TZ=${timezone} 0 4 * * 0\` }` (weekly, Sunday
   04:00 agency time, off the sweeper's hours) and one `step.run('sweep', () => retentionSweep(db,
   registry, { actorId: 'system:inngest', now: new Date() }))` returning the counts. `createInngestFunctions`
   (TICKET-029a) appends it, so the serve route registers four functions.
9. Unit test `retention.test.ts` in the integrations package: `retentionConfig('Asia/Karachi').cron ===
   'TZ=Asia/Karachi 0 4 * * 0'`; `createInngestFunctions` returns four functions whose ids are
   `['propagate-run', 'seed-brand', 'sweep-runs', 'retention']`.
10. `docs/decisions.md`: confirm the "Engine ledgers are operational logs" entry (D-021; 90-day hard
    delete) is present and cite its number from the header comment of `retention.ts`; if it is missing,
    stop and report (the planner appends it), do not append it here.

## Gated criteria (D-008)

none

## Files touched

`packages/db/src/template/ops/link.ts` (+ test), `packages/db/src/template/retention.ts` (+ test),
`packages/db/src/template/ops/index.ts`, `packages/db/src/template/index.ts`,
`packages/integrations/src/inngest/functions/retention.ts` (+ test),
`packages/integrations/src/inngest/index.ts`.

## Notes

- Stage 1 never writes in `packages/integrations`; stage 2 never writes in `packages/db`.
- `linkToTemplate` is `requireAdmin()` territory when a UI arrives (Phase 6 dry-run reconciliation); this
  ticket ships the op only, consumed by `scripts/` in Phase 6.
- The retention function is the one Inngest function that runs outside agency hours; it wakes Neon once a
  week (design §5.5 counts it).
