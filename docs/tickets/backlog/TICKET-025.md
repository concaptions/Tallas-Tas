# TICKET-025 · `withBrand` templated methods and the template journal

- Owner: integrator (`packages/db/src/tenancy.ts`, `packages/db/src/template/journal.ts`)
- Size: M
- Depends on: TICKET-022, TICKET-024a, TICKET-026 (`fieldVisibility` for hidden fields)
- PRD: §5 (a change in the parent is replicated; a change in a child is kept locally and can be
  proposed), §14.1, §10 (per-brand interface configuration is an override on the child)
- Design: §2 (I4, I5, I6, I7 one queued run per template), §3.5 semantics (`changes` runs), §4.2
  (child update with override tracking), §4.3 (parent update → journal → run; request-path backstop
  data), §6 first paragraph, §8 (T4, T5, T24 outbox clauses), §11 (`is_template` at construction
  rejected)

## Why

Every mutation goes through a domain function, and the only user-code writers of `overridden_fields`
and the journal are four methods on the tenancy helper every Server Action already uses. On a child
they track overrides; on the template brand they write the outbox in the same transaction, which is
what makes "a parent change lands in every child" an atomic promise (I6).

## Acceptance criteria

1. `withBrand(db, brandId, ctx?)` accepts an optional `ctx: WithBrandCtx = { actorId: string;
   batchId?: string; isTemplate?: boolean; source?: ChangeSource; promotionRequestId?: string }`
   (`source` and `promotionRequestId` are passed through to the journal for TICKET-031b and
   TICKET-032a). Every TICKET-005 method and test is unchanged and still passes; `withBrand` stays
   synchronous.
2. Four methods, typed to accept only a `TemplatedTableSpec` from the registry (a compile-time test
   with `@ts-expect-error` shows `updateTemplated(agencies, ...)` does not compile):
   `updateTemplated(spec, id, patch)`, `insertTemplated(spec, values)`, `softDeleteTemplated(spec, id)`,
   `restoreTemplated(spec, id)`. Each runs in one transaction that: reads
   `SELECT is_template, template_brand_id FROM brands WHERE id = $brandId FOR SHARE` (throws
   `NoSuchBrand`; throws `BrandMismatch` when `ctx.isTemplate` is given and differs); locks the target
   row `FOR UPDATE` scoped by `brand_id = $brandId` and `deleted_at IS NULL` (`IS NOT NULL` for
   `restoreTemplated`), zero rows → `NoSuchRow`; on a child brand reads `fieldVisibility` (TICKET-026)
   and calls `applyChildEdit(row, patch, spec, hidden)` / `assertKnownFields`; writes.
3. Child branch: `overridden_fields` is updated with the union arithmetic of design §4.2 on the locked
   row; `softDeleteTemplated` adds `'deletedAt'`; `restoreTemplated` keeps it; brand-local rows
   (`template_row_id IS NULL`) never gain entries; `insertTemplated` stores `template_row_id NULL`,
   `overridden_fields '[]'`, `brand_id` forced to the scoped brand whatever the payload says. Returns
   `{ row, overriddenAdded }`.
4. Template branch: `overridden_fields` untouched (I5); when `diffPropagated` is non-empty, or the
   method is insert / soft delete / restore, `journal.ts`'s `attachChange(tx, { templateBrandId,
   actorId, batchId, tableName, rowId, kind, changedFields, source, promotionRequestId? })` runs the two
   statements of design §4.3 (queued-run upsert on `propagation_runs_one_queued` with `DO UPDATE SET
   updated_at = now()`, then the `template_changes` row). A patch that changes only local fields writes
   no journal row and returns no run. `source` defaults to `'edit'`; `batchId` defaults to
   `randomUUID()` per call. Returns `{ row, overriddenAdded: [], run: RunRef }` where `RunRef`,
   exported from `journal.ts`, is `{ runId, brandId, trigger: RunTrigger, targetBrandId: string | null,
   attempt, resendCount, createdAt, lastEnqueuedAt }` (the queued-run upsert's `RETURNING` adds
   `brand_id, trigger, target_brand_id`; for a `changes` run `trigger` is `'changes'` and
   `targetBrandId` is `null`). `RunRef` is the one run shape `enqueueRun` (TICKET-029a) and `resendRun`
   (TICKET-028a) accept; TICKET-029a's `createRun` returns the same type.
5. `attachChange` is exported for TICKET-031b (`source 'promotion'`) and TICKET-032a
   (`source 'field_resync'`); it never sends an event and never runs outside a transaction.
6. Tests on PGlite through `testDb()` plus `fixtureRegistry` and the TICKET-026 seed (`testTemplateWorld()`
   arrives in TICKET-027a and is not a dependency here; TICKET-028a's tests are the first to use both);
   the production table is `interface_pages`:
   - `tenancy-templated.test.ts` (T5, I4, I5, A8): child `updateTemplated(label)` → `overridden_fields
     ['label']`, `overriddenAdded ['label']`; the same value again → unchanged, `overriddenAdded []`; a
     local-only patch → nothing; an unknown key and a hidden field (a `brand_field_overrides` row
     `hidden = true`) are rejected before any SQL (row unchanged); `ctx.isTemplate: true` on a child
     throws `BrandMismatch`; `softDeleteTemplated` adds `'deletedAt'` and `restoreTemplated` keeps it;
     `insertTemplated` with `brandId: B` in the payload on `withBrand(A)` stores A; `withBrand(A)
     .updateTemplated(spec, idOfBRow, ...)` throws `NoSuchRow` and B's row is unchanged.
   - `journal.test.ts` (T4, I6): template `updateTemplated(label)` → one `template_changes` row
     `kind 'update'`, `changed_fields ['label']`, `source 'edit'`, attached to a run `status 'queued'`,
     `trigger 'changes'`, `brand_id = T`; `overridden_fields` still `[]`; a local-only patch writes no
     journal row; insert / soft delete / restore write `kind` accordingly with `changed_fields []`; the
     returned `RunRef` carries `runId`, `brandId = T`, `trigger 'changes'`, `targetBrandId null`,
     `createdAt`, `resendCount 0`, `attempt 1`, `lastEnqueuedAt null`; a transaction that throws after
     the journal statement (a value violating a fixture CHECK) leaves neither a journal row nor a run.
   - `outbox.test.ts` (T24 outbox clauses, I7): a committed template write leaves exactly one `queued`
     run; three writes in three transactions before any claim share the same `runId` with three
     journal rows; two saves with one `ctx.batchId` share the `batch_id`. (The clause "after a claim the
     next write opens a new run" is TICKET-028a.)
7. `pnpm typecheck && pnpm lint && pnpm test` exit 0.

## Gated criteria (D-008)

none

## Files touched

`packages/db/src/tenancy.ts`, `packages/db/src/template/journal.ts`, `packages/db/src/index.ts`,
`packages/db/src/tenancy-templated.test.ts`, `packages/db/src/template/journal.test.ts`,
`packages/db/src/template/outbox.test.ts`.

## Notes

- No new dependency. Every query is scoped by the constructed `brandId`; the template branch writes
  only ledger rows for its own brand and never reads or writes a child.
- The queued-run row lock against a concurrent claim needs two connections; it is D-025 (design §12
  D-014) and runs in TICKET-037's runbook script, not here.
- `enqueueRun` is not called from here (never an external call before commit); TICKET-029a defines it
  and TICKET-029b wires it.
- Estimated size ≈200 LOC excluding tests.
