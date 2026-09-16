# TICKET-024a · Privileged template scope: factories, audit, reads, `writeChild`, acknowledge

- Owner: schema (`packages/db/src/template/scope.ts`, `packages/db/src/template/sql.ts`,
  `packages/db/src/template/testing.ts`, `packages/db/src/index.ts`)
- Size: M
- Depends on: TICKET-021, TICKET-023
- PRD: §5 (the parent replicates into every brand: the one place that legitimately crosses brands),
  §11 (clients never reach cross-brand code)
- Design: §2 (I8), §3.2 (jsonb set arithmetic on `overridden_fields`), §4.9 (`acknowledgeConflicts`
  row-level and field-level), §6 (the scope, its read methods, `writeChild`, the audit rule), §8 (T17),
  §11 (auditing reads rejected)

## Why

Tenancy is enforced at the query layer. `withBrand` cannot cross brands, so the engine needs one
audited door: a scope that cannot be constructed without an `engine_audit_log` row and whose every
query takes the brand from an argument, never a payload. This ticket is the door and the reads; the
batched writers that propagation uses are TICKET-024b.

## Acceptance criteria

1. `scope.ts` exports `withTemplateScope(db, registry, templateBrandId, audit: EngineAudit, fn)` and
   `withTemplateRead(db, registry, templateBrandId, fn)`. `withTemplateScope` inserts the
   `engine_audit_log` row (`status 'running'`, `actor_id`, `reason`, `target_brand_id`, `subject`) in
   its own statement outside any transaction, runs `fn(scope)`, then updates the row to `succeeded`
   with `rows_written`, or to `failed` with `error` and rethrows (also when `fn` throws inside a
   transaction it opened). It accepts `audit.existingAuditId` to attach to an audit row another step
   opened (used by TICKET-027a/b and TICKET-028a/b), in which case it adds to `rows_written` and does not
   close the row; `closeAudit(db, auditId, { status, error? })` is exported for the owner of such a row
   (TICKET-028a's `finishRun` / `failRun`). `withTemplateRead` writes no audit row (I8).
2. `TemplateScope` is a class with a private constructor; the two factories are the only way to get an
   instance. `TemplateReadScope` (returned by `withTemplateRead`) exposes only: `childBrands()` (brands
   with `template_brand_id = $T AND deleted_at IS NULL`, with `status` and `seededAt`), `parentRow`,
   `parentRows` (template brand only, deleted rows included, `null`/empty for any other brand),
   `childRow`, `childRowById`, `childRows` (child brand from the argument, `forUpdate` option),
   `resolveLinks` (parent id → alive child copy id), `resolveLinksToParent` (child id →
   `template_row_id`, `null` for brand-local), `naturalKeyOwners` (alive rows holding a remapped natural
   key). Every SQL binds the brand id from the method argument.
3. `TemplateScope` adds `auditId`, `tx(fn)` (one transaction; nested calls reuse it), `rowsWritten`
   (accumulates the affected-row counts of every writer) and two writers:
   - `writeChild(spec, childBrandId, rowId, values, { addOverrides?, removeOverrides? })`: raw write
     without override tracking; throws `IllegalValue` when `values` contains `overriddenFields` or
     `brandId` (stricter than design T17's "ignores `brand_id`": a payload naming a brand is a bug, not
     noise); `templateRowId` is allowed (promotion approval and `linkToTemplate` set it);
     `overridden_fields` is written as set arithmetic on the locked row,
     `sort(dedupe((overridden_fields − $remove) || $add))`, never assigned wholesale; zero rows
     (wrong brand, missing row) throws `NoSuchRow`.
   - `acknowledgeConflicts(childBrandId, tableName, childRowId, fields?)`: without `fields` all open
     outcomes of the row get `acknowledged_at = now(), acknowledged_by`; with `fields`,
     `conflict_fields` and `parent_values` lose those keys and the row is acknowledged only when
     `conflict_fields` becomes `[]`. Returns rows updated.
   The batched writers (`applyChildPlans`, `insertChildFromParent`, `upsertChildRun`, `upsertOutcomes`)
   are TICKET-024b; `settlePendingPromotion` is TICKET-032a. The class is written so TICKET-024b adds
   methods without touching the factories or the audit logic.
4. `sql.ts` exports pure generators (Drizzle `sql` fragments, no execution) from a spec: `columnName`
   (Drizzle key → SQL column), `overridesArithmeticSql(add, remove)`, `linkMapSql(spec, C, linkTargetIds)`
   (per link field: `template_row_id, id` of alive copies) and `naturalKeyOwnersSql(spec, C, keys)`.
   TICKET-024b appends the insert, update and ledger generators to the same file. There is no
   `seedTable` scope method: seed (TICKET-027a) composes TICKET-024b's `insertCopiesSql` directly.
5. Tests on PGlite, `fixtureRegistry(db)` for tables (production templated tables arrive in
   TICKET-026, which adds the `interface_pages` clause of T17): `scope.test.ts` (T17, I8):
   `TemplateScope` cannot be constructed outside the module (compile-time `@ts-expect-error` on
   `new TemplateScope(...)`, plus the constructor is not exported); each `withTemplateScope` call inserts
   exactly one audit row, closed `succeeded` with `rows_written` equal to the rows its writers touched;
   when `fn` throws the row is `failed` with the message and the error is rethrown; `withTemplateRead`
   inserts none; `existingAuditId` inserts none, adds to `rows_written` and leaves the row `running`
   until `closeAudit`; `writeChild` throws `IllegalValue` on `overriddenFields` and on `brandId` in
   `values` (T17's stricter form); `writeChild` on a row of another brand throws `NoSuchRow` and changes
   nothing; `addOverrides` / `removeOverrides` leave unrelated entries in place, sorted and
   de-duplicated; `parentRow` for a non-template brand id returns `null`; `childRows` never returns
   another brand's rows; `naturalKeyOwners` returns only alive rows of the named brand;
   `acknowledgeConflicts` row-level closes every open outcome of the row; field-level on a
   `['label','position']` outcome with `['label']` leaves `position` open and unacknowledged, and with
   both fields acknowledges it.
6. `packages/db/src/index.ts` exports `withTemplateScope`, `withTemplateRead`, `closeAudit` and the scope
   types. `pnpm typecheck && pnpm lint && pnpm test` exit 0.

## Gated criteria (D-008)

none

## Files touched

`packages/db/src/template/scope.ts`, `packages/db/src/template/sql.ts`,
`packages/db/src/template/testing.ts` (fixture additions only), `packages/db/src/index.ts`,
`packages/db/src/template/scope.test.ts`.

## Notes

- No new dependency.
- Every query in this ticket runs in the privileged template scope by definition; the tests prove the
  brand comes from the argument and never from a payload.
- No `ops/*` function is written here; TICKET-024b creates the `ops` directory and each ops ticket
  creates its own file.
- Estimated size ≈200 LOC excluding tests.
