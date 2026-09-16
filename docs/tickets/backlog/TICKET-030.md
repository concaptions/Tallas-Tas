# TICKET-030 · `promotion_requests` table, promotion state machine and promotion domain functions

- Owners, in order: schema (stage 1, `packages/db/**`) then backend (stage 2, `packages/domain/**`)
- Size: M
- Depends on: TICKET-022, TICKET-021, TICKET-014
- PRD: §5 (a change in a child page gives a pop-up to duplicate it to other bases; the request comes in to
  the Admin dashboard to approve), §14.1 (one template, propagated), §11 (Admin: everything, all brands)
- Design: §3.8 (`promotion_requests`), §4.5 (promotion lifecycle, state machine), §4.6 step 6
  (`fieldKeyTargets`), §4.7 (withdraw-by-reset, narrow-supersede), I9, T16 (domain half), T23b

## Why

Non-negotiable 2: child changes request promotion; nothing auto-promotes. This ticket stores the request
with its three-way snapshot and defines, as pure functions, what a request contains, what the reviewer sees
and what an approval may write. TICKET-031a/b execute those decisions against the database.

## Acceptance criteria

1. `pnpm typecheck`, `pnpm lint`, `pnpm test` pass from the root. No `any`, no `TODO`.
2. Every function added to `packages/domain` is pure (no database, no `Date.now()` except through an
   injected `now`), and every one has a fixture-only unit test named below (CLAUDE.md "state machines are
   code in `packages/domain/state`").

## Stage 1 (schema) · table, migration, rename targets

3. `packages/db/src/schema/promotion-requests.ts` defines `promotion_requests` exactly as design §3.8:
   `baseColumns` (`brand_id` = requesting child brand, `CHECK brand_id IS NOT NULL`), `table_name`,
   `child_row_id`, `parent_row_id` (nullable = "promote as a new parent row"), `fields` jsonb `string[]`,
   `base` jsonb, `proposed` jsonb, `parent_updated_at`, `note`, `status` using the `promotionStatus`
   `pgEnum` exported by `packages/db/src/template/enums.ts` (TICKET-020 criterion 4; no enum is defined
   here), `requested_by` not null, `reviewed_by`, `reviewed_at`, `review_note`, `approved_fields`, `conflicts`,
   `decisions`, `applied_batch_id`. Indexes: partial unique `promotion_requests_one_pending (table_name,
   child_row_id) WHERE status = 'pending'`, `(status, created_at)`, `(brand_id, status)`.
4. Migration generated with `drizzle-kit generate` into `packages/db/drizzle/` and applied by the PGlite
   suite; it contains `CREATE TABLE "promotion_requests"` and its indexes and no `CREATE TYPE` (the enum
   exists since TICKET-020; `grep -c "CREATE TYPE" <new migration file>` prints `0`). Test
   `promotion-requests.test.ts`: inserting two `pending` rows for the same `(table_name,
   child_row_id)` fails on the partial unique index; a `pending` plus a `superseded` row for the same key
   succeeds; a row with `brand_id NULL` fails the CHECK.
5. `fieldKeyTargets` (`packages/db/src/template/field-key-targets.ts`, TICKET-021) gains
   `{ table: 'promotion_requests', column: 'fields', kind: 'array' }`, `{ ..., column: 'base', kind:
   'objectKeys' }` and `{ ..., column: 'proposed', kind: 'objectKeys' }`. Test T23b in
   `packages/db/src/template/migrate-helpers.test.ts`: after `renameFieldKey(tx, fieldKeyTargets,
   'interface_pages', 'label', 'title')` a pending request with `fields ['label','position']`, `base
   { label: 'a' }`, `proposed { label: 'b' }` reads back as `fields ['title','position']`, `base { title:
   'a' }`, `proposed { title: 'b' }`; a request for another table is untouched.
6. `packages/db/src/index.ts` re-exports the table and the `PromotionRequestRow` type.

## Stage 2 (backend) · `packages/domain/src/state/promotion.ts`, `packages/domain/src/template/promotion.ts`

7. `packages/domain/src/state/promotion.ts` exports `promotionActions = ['approve', 'reject', 'withdraw',
   'supersede', 'narrow'] as const`, `promotionTransitions: readonly { from: PromotionStatus; action:
   PromotionAction; to: PromotionStatus; actors: readonly PromotionActor[] }[]` where `PromotionActor` is
   `'admin' | 'requester' | 'system'` (`'system'` = `resetToTemplate` and a new request on the same row),
   and `transitionPromotion(status, action, actor): PromotionStatus` which throws `IllegalTransition`
   `{ from, action, actor }` for any pair not in the table. The table is exactly design §4.5: from `pending`
   only; `approve` (admin) → `approved`; `reject` (admin) → `rejected`; `withdraw` (requester, admin,
   system) → `withdrawn`; `supersede` (system) → `superseded`; `narrow` (system) → `superseded`. Terminal
   states have no outgoing row. `allowedPromotionActions(status, actor)` returns the actions the UI may
   offer (the UI reads transitions from here, CLAUDE.md).
8. Unit test `state/promotion.test.ts` (T16, domain half): enumerates every `(status, action, actor)`
   triple (5 × 5 × 3 = 75) and asserts the exact set of passing triples equals the table (every legal one
   returns the documented target, every other throws `IllegalTransition`); `allowedPromotionActions
   ('pending', 'requester')` is `['withdraw']`; a `client` brand role is not a `PromotionActor` (compile-time
   `@ts-expect-error` plus the runtime guard `promotionActorFor(agencyRole, brandRoles: BrandRole[],
   isRequester)` which returns `'admin'` for `agencyRole 'admin'`, `'requester'` when `isRequester` and
   the roles intersect `internalBrandRoles` (TICKET-014), and `null` otherwise, so a `client`-only actor
   gets `null`).
9. `packages/domain/src/template/promotion.ts`:
   - `buildPromotionRequest(child, parent | null, links, spec, fields?, now)` → `PromotionDraft = { tableName,
     childRowId, parentRowId, fields, base, proposed, parentUpdatedAt }`. `fields` defaults to
     `child.overriddenFields ∩ spec.propagatedFields` when `parent` exists and to all `propagatedFields` for a
     brand-local row (`parent === null`); `base = pick(parent, fields)` with parent link ids (`{}` for a new
     row); `proposed = pick(child, fields)` with link fields remapped child → parent through `links`
     (`LinkMaps = Record<field, Map<childId, parentId | null>>`); throws `UnresolvedLinkError { field,
     childLinkId }` when a link target maps to `null` (brand-local target) and `NothingToPromote` when
     `fields` is empty or contains a non-propagated key.
   - `reviewPromotion(request, currentParent | null)` → `{ stale: string[]; conflicts: Record<string,
     { base; current; proposed }>; parentDeleted: boolean; alreadyMatching: string[] }`: `stale` lists
     fields where `currentParent[f] ≠ base[f]`; `conflicts[f]` exists when `currentParent[f] ≠ base[f]` and
     `≠ proposed[f]`; `alreadyMatching` lists fields where `currentParent[f] = proposed[f]`; `parentDeleted`
     is `currentParent.deletedAt !== null` and adds a single conflict on `'deletedAt'`; a new-row request
     (`parentRowId null`) returns all-empty with `parentDeleted false`.
   - `decidePromotion(request, parentLocked | null, approvedFields, decisions)` → `{ parentValues,
     parentPatch, appliedFields, approvedFields, conflicts, restoreParent }`: throws `NotASubset` if
     `approvedFields ⊄ request.fields`; recomputes `reviewPromotion` on the locked parent; throws
     `MissingDecision(field)` for an approved field in conflict without a decision; throws
     `MissingDecision('deletedAt')` when the parent is soft-deleted and `decisions.deletedAt !==
     'restore_parent'`; `parentPatch` = `proposed` for non-conflicting approved fields plus `take_proposed`
     fields; `keep_current` fields are dropped from the patch; `alreadyMatching` fields stay in
     `approvedFields` but are absent from `parentPatch` and `appliedFields`; for a new-row request
     `parentValues = proposed` over all approved fields and `parentPatch` is empty.
   - `PromotionDecision` is imported from `spec.ts` (TICKET-022 criterion 2, the one definition) and
     `UnresolvedLinkError` from `packages/domain/src/template/errors.ts` (TICKET-022); the new error
     classes `NotASubset`, `MissingDecision { field }` and `NothingToPromote` are appended to that same
     file (TICKET-022's single errors module), each with a `code` literal.
10. Unit tests `template/promotion.test.ts`, fixtures only: `buildPromotionRequest` default fields for a
    copy and for a brand-local row, link remap, `UnresolvedLinkError`, `NothingToPromote` on `[]` and on a
    local field; `reviewPromotion` with an unchanged parent (all empty), a moved parent (`stale` without
    conflict when current equals proposed → `alreadyMatching`), a conflicting parent, a deleted parent, a
    new-row request; `decidePromotion` for each `reviewPromotion` case: subset approval, `NotASubset`,
    `MissingDecision(field)`, `MissingDecision('deletedAt')`, `take_proposed`, `keep_current`,
    `restore_parent`, `alreadyMatching` not written.
11. `packages/domain/src/index.ts` exports the new modules. `packages/domain` still has no dependency on
    `@tas/db` (`pnpm turbo run build --dry` passes, TICKET-020 cycle check).

## Gated criteria (D-008)

none

## Files touched

`packages/db/src/schema/promotion-requests.ts`, `packages/db/src/schema/index.ts`, `packages/db/drizzle/*`,
`packages/db/src/template/field-key-targets.ts`, `packages/db/src/template/migrate-helpers.test.ts`,
`packages/db/src/schema/promotion-requests.test.ts`, `packages/db/src/index.ts`,
`packages/domain/src/state/promotion.ts` (+ test), `packages/domain/src/template/promotion.ts` (+ test),
`packages/domain/src/template/errors.ts` (three classes appended), `packages/domain/src/index.ts`.

## Notes

- Stage 1 never writes in `packages/domain`; stage 2 never writes in `packages/db`. The `promotion_status`
  enum array lives in `@tas/domain` (TICKET-022 `promotionStatuses`) and its `pgEnum` in TICKET-020's
  `enums.ts`; stage 1 imports the latter.
- TICKET-025 is not a dependency: nothing here calls a templated method; `approvePromotion`
  (TICKET-031b) does.
- No queries or Server Actions in this ticket. `requestPromotion` and friends are TICKET-031a,
  `approvePromotion` is TICKET-031b.
- `stale`, `parentDeleted` and `alreadyMatching` are computed badges, never stored states; `conflicts` and
  `decisions` are stored only at approval (§4.5).
- Equality in `reviewPromotion` and `decidePromotion` uses the same normalised comparison as
  `diffPropagated` (TICKET-022); reuse it, do not write a second one.
