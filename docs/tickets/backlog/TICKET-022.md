# TICKET-022 · Domain template spec, override functions and brand rules

- Owners, in order: backend (stage 1, `packages/domain/**`) then schema (stage 2,
  `packages/db/src/schema/enums.ts`)
- Size: M
- Depends on: TICKET-014 (the `@tas/domain` skeleton, `src/roles.ts` and the `@tas/db → @tas/domain`
  edge), TICKET-005
- Decisions: D-022 (package direction, the design's D-011) is appended by the planner before TICKET-020
  is picked; stage 2 confirms it
- PRD: §5 (every table is per-brand, seeded from the parent template; a child change is a *request* to
  the parent), §14.1 (one template propagated), §11 (who may edit: Admin everything, the template
  brand is admin-only in V1)
- Design: §2 (I4, I5 pure half; I13, I14 pure half), §3.1 (brand rules, `brandReadiness`), §3.2
  (semantics of `overridden_fields`, field classes), §3.3 (`spec.ts` types and string arrays; the
  package direction db → domain), §4.2 (`diffPropagated`, `applyChildEdit`), §4.3
  (`assertTemplateWriter`), §4.5 (`settleOverrides`, `overridesForLinkedRow`), §4.7 (`resetFields`),
  §8 (Domain row; T21 and T26 domain halves), §12 (package direction decision)

## Why

Every engine decision is a pure function in `@tas/domain`; `@tas/db` only executes the plans they
return (design §3.3). This ticket creates the package, fixes the field-level spec that every later
ticket builds on, and completes the package direction TICKET-014 started (db imports domain, never the
reverse) so the role and status enums have one source of truth.

## Stage 1 (backend) · `packages/domain`

1. The package `@tas/domain` from TICKET-014 is used as is: no new runtime dependency (`zod` stays the
   only one), no dependency on `@tas/db` or `drizzle-orm`. The existing `src/roles.ts` arrays
   (`agencyRoles`, `brandRoles`, `internalBrandRoles`, `brandStatuses`) are not duplicated: `spec.ts`
   re-exports them.
2. `src/template/spec.ts` exports, exactly with the values of design §3.3, §3.6 and §3.7: the types
   `LinkSpec`, `TemplatedFieldSpec`, `Row`, `ChangeLifecycle`, `ChangeGroup`, `PlanStep`, `ChildPlan`,
   `TemplateChange` (`{ id, seq, tableName, rowId, kind, changedFields }`), `PromotionDecision`; the
   `as const` arrays `changeKinds`, `changeSources`, `runTriggers`, `runStatuses`, `childRunStatuses`
   (`['succeeded', 'failed']`), `outcomeKinds`, `promotionStatuses`, `engineReasons` (plus the
   re-exported role and status arrays of criterion 1); the derived unions `ChangeKind`, `ChangeSource`,
   `RunTrigger`, `RunStatus`, `ChildRunStatus`, `OutcomeKind`, `PromotionStatus`, `EngineReason`; and
   `systemFields`
   (`['id','brandId','templateRowId','overriddenFields','createdAt','updatedAt','createdBy','updatedBy','deletedAt']`)
   and `informativeOutcomes` (the eight kinds of §3.6 that write a per-row outcome). The file imports
   only `../roles`.
   `src/template/errors.ts` is the single errors module for the template domain: every error class this
   ticket names (`UnknownFieldError`, `HiddenFieldError`, `UnresolvedLinkError { field }`,
   `NoTemplateRow`, `NotATemplate`, `ClientOnTemplate`, `NotTemplateEditor`, `IllegalRunTransition`) is
   defined there, each with a `code` literal, and TICKET-030 appends its own classes to the same file.
   No error class is defined in any other domain file (`grep -rln "extends Error" packages/domain/src/template packages/domain/src/state`
   lists only `template/errors.ts`).
3. `src/template/override.ts`:
   - `normalise(value)` used by every comparison below: `null` and `undefined` are equal; `Date` compares
     by epoch milliseconds; arrays and plain objects by stable JSON (sorted keys); everything else by
     `===`.
   - `diffPropagated(before, after, spec): string[]` returns the sorted keys of `spec.propagatedFields`
     whose normalised value differs. Local and system keys are never returned.
   - `assertKnownFields(patch, spec, hiddenFields = [])` throws `UnknownFieldError { field }` for a key
     outside `propagatedFields ∪ localFields` (system keys included) and `HiddenFieldError { field }` for
     a key in `hiddenFields`. Both errors carry `nonRetriable = true`.
   - `applyChildEdit(row, patch, spec, hiddenFields = [])` calls `assertKnownFields`, then returns
     `{ values: patch, overriddenFields, overriddenAdded }` where `overriddenAdded =
     diffPropagated(row, { ...row, ...patch }, spec) − row.overriddenFields` and `overriddenFields =
     sortedUnion(row.overriddenFields, overriddenAdded)` (I4, I5). It never adds `'deletedAt'`.
   - `sortedUnion(a, b)` and `without(a, b)` (both return a sorted, de-duplicated copy) exported for the
     scope's arithmetic tests and for `resetFields`.
4. `src/template/reset.ts`: `resetFields(child, parent, links, fields | 'all', spec)` returns
   `{ values, removeOverrides, lifecycle }`: for every requested propagated field, `values[f]` is the
   parent value, or `links[f]` for a link field (`null` when the parent value is null; a nullable link
   whose `links[f]` is `'unresolved'` becomes `null`; a non-nullable one throws `UnresolvedLinkError
   { field }`); `removeOverrides = requested ∩ child.overriddenFields`; `lifecycle` is `'restore'` when
   `'deletedAt'` is requested, the child copy is deleted and the parent is alive, `'soft_delete'` when
   the parent is deleted and the copy is alive, otherwise `'none'`. `'all'` means every propagated field
   plus `'deletedAt'`. A requested key outside `propagatedFields ∪ {'deletedAt'}` throws
   `UnknownFieldError`. A child with `templateRowId === null` throws `NoTemplateRow`.
5. `src/template/settle.ts`: `settleOverrides(childLocked, proposed, appliedFields): { remove: string[] }`
   returns the fields of `appliedFields` that are in `childLocked.overriddenFields` and whose normalised
   child value equals `proposed[f]`. The return type has no other property (design §4.5: only removals,
   never a replacement array).
6. `src/template/linked-row.ts`: `overridesForLinkedRow(child, parent, links, spec): string[]` returns,
   sorted, every propagated field whose child value differs from the remapped parent value; for link
   fields the comparison is `child[f]` against `links[f]`, and `links[f] === 'unresolved'` (target has no
   copy, or the child's target is brand-local) counts as different.
7. `src/template/brand-rules.ts`: `assertTemplateParent(parent)` throws `NotATemplate` unless
   `parent.isTemplate`; `assertAssignment(brand, role)` throws `ClientOnTemplate` when `role === 'client'`
   and `brand.isTemplate` (A9); `assertTemplateWriter(actor: { userId, agencyRole }, brand)` throws
   `NotTemplateEditor` when `brand.isTemplate` and `actor.agencyRole !== 'admin'` (A10, the one line to
   widen per design §10 q2); `brandReadiness(brand, lastSeedRun)` returns `'ready'` whenever
   `brand.isTemplate` is true, regardless of `seededAt` and runs (the template is never seeded; its
   `seeded_at` stays `NULL`), otherwise `'ready'` when `seededAt` is set, otherwise `'seeding'` when the
   run is `queued | running | partial`, and `'seed_failed'` when the run is missing, `failed`, or
   `succeeded` with `seededAt` still null.
8. `src/state/propagation-run.ts`: `runTransitions: Record<RunStatus, readonly RunStatus[]>` =
   `queued → [running]`, `running → [succeeded, partial, failed]`, `failed → [running]`,
   `partial → [running]`, `succeeded → []`; `canRunTransition(from, to)`; `assertRunTransition(from, to)`
   throws `IllegalRunTransition { from, to }` (I14 pure half). Re-sending a queued run is not a
   transition and is not in the table.
9. Unit tests, fixtures only, no database:
   - `override.test.ts`: `diffPropagated` (changed field, equal field, `null` vs `undefined` equal,
     `Date` by epoch, object key order irrelevant, local field ignored, system field ignored, result
     sorted); `applyChildEdit` (adds one override, union stays sorted and de-duplicated, same value again
     adds nothing (A8), local-only patch gives `overriddenAdded []`, unknown key throws
     `UnknownFieldError`, hidden field throws `HiddenFieldError`, system key `brandId` throws, never
     emits `'deletedAt'`); `sortedUnion` and `without`.
   - `reset.test.ts`: one field, `'all'`, link remapped, nullable unresolved → null, non-nullable
     unresolved throws, `'deletedAt'` restore and soft_delete cases, brand-local row throws, unknown
     field throws, `removeOverrides` never lists a field the child had not overridden.
   - `settle.test.ts`: equal → removed, changed since request → kept, field not overridden → not listed,
     return object has only `remove`.
   - `linked-row.test.ts`: equal row → `[]`, one differing field, link resolved equal, link unresolved
     counts, result sorted.
   - `brand-rules.test.ts`: the three assertions (throw and pass cases; T26 domain half: `client` on the
     template refused) and `brandReadiness` for missing, queued, running, failed, succeeded-without-flag
     and ready (T21 domain half), plus a template brand with `seededAt null` and no run → `'ready'`.
   - `state/propagation-run.test.ts`: exhaustive: every ordered pair of the five statuses is asserted
     legal or illegal against the table (25 cases).
10. `src/index.ts` re-exports everything above.

## Stage 2 (schema) · enums from the domain arrays

11. The workspace edge `"@tas/domain": "workspace:*"` in `packages/db/package.json` already exists
    (TICKET-014 criterion 4); no `pnpm install` is needed. TICKET-014's drift test
    `packages/domain/src/roles.test.ts` is kept and still passes.
12. `packages/db/src/schema/enums.ts` builds `pgEnum('brand_status', brandStatuses)`,
    `pgEnum('agency_role', agencyRoles)` and `pgEnum('brand_role', brandRoles)` from the arrays imported
    from `@tas/domain` (`roles.ts`) and re-exports the unions as aliases of the domain types. A file
    comment cites D-018 and D-022 and states that TICKET-005 note 2 is superseded.
13. `pnpm --filter @tas/db db:generate` emits no new migration: the listing of `packages/db/drizzle/`
    before and after the command is identical (values and order are unchanged). TICKET-005's tests
    still pass.
14. `docs/decisions.md` carries `D-022 · Package direction @tas/db → @tas/domain` (design §12, listed
    there as D-011; appended by the planner before TICKET-020 is picked): domain defines the template
    field spec, row and plan types and every status / role string array; db builds tables and `pgEnum`s
    from them and re-exports the unions; the CI cycle check is TICKET-006's `pnpm turbo run build --dry`
    step, fenced by TICKET-020. This stage confirms it is present; if it is missing, stop and report.
15. `pnpm typecheck && pnpm lint && pnpm test` exit 0 from the root.

## Gated criteria (D-008)

none

## Files touched

Stage 1: `packages/domain/src/index.ts` (re-exports), `packages/domain/src/template/*.ts` (including
`errors.ts`),
`packages/domain/src/state/propagation-run.ts`, the `*.test.ts` files next to them.
Stage 2: `packages/db/src/schema/enums.ts`.

## Notes

- No new dependency. The package, `roles.ts` and the workspace edge come from TICKET-014; stage 1
  writes nothing under `packages/domain/src/brand/**` or `roles.ts`.
- `ChildPlan`, `ChangeGroup` and `PlanStep` are types only here; `coalesceChanges` and
  `planChildChange` land in TICKET-023.
- Stage 2 changes no table and no migration; if `db:generate` does emit a file, the arrays do not match
  TICKET-005's values and stage 2 must stop and report.
- Estimated size ≈200 LOC excluding tests.
