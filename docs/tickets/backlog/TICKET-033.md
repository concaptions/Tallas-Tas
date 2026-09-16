# TICKET-033 · Child edit popup and promotion modal

- Owners, in order: backend (stage 1,
  `apps/web/src/app/app/(workspace)/brands/[brandSlug]/interface/{actions,interface-actions}.ts`,
  `apps/web/src/lib/action-result.ts`) then frontend (stage 2,
  `apps/web/src/app/app/(workspace)/brands/[brandSlug]/interface/**` pages and components,
  `apps/web/src/components/promotion/**`, `apps/web/vitest.config.ts`, `apps/web/vitest.setup.ts`,
  `apps/web/package.json`, `apps/web/e2e/promotion-popup.spec.ts`, `docs/decisions.md`)
- Size: M
- Depends on: TICKET-031a, TICKET-029b (`enqueueRun`, `inngestForRequest`), TICKET-028a (`resendRun`),
  TICKET-023 (`shouldResend`), TICKET-026, TICKET-025, TICKET-012b, TICKET-010, TICKET-013 (`alert-dialog`,
  `dialog`, `checkbox`, `switch`, `badge`, `textarea`, `table`), TICKET-008 (`findBrandForAgency`)
- PRD: §5 (whenever we make a change in a child page, when we add it, it will give a pop-up if we want to
  duplicate it to other bases), §10 (which pages appear per brand: `interface_pages` is the first editable
  templated table), §14.1
- Design: §4.2 (`updateTemplated` returns `overriddenAdded`; the popup), §4.3 (template-brand writes
  behind `requireTemplateEditor`, backstop), §4.5 (request), §7 (interface configuration as a template),
  §9 TICKET-033 row, A8

## Why

Non-negotiable 2 starts in the UI: a strategist edits a field in her brand and is asked whether the change
should be proposed to the template. Without this screen, promotion requests can only be created from
tests.

## Acceptance criteria

1. Components contain no business logic: which fields are proposed by default, whether the popup shows,
   and what the diff displays come from Server Action results and from pure helpers
   (`allowedPromotionActions` in `@tas/domain`, `buildPromotionRequest` through `previewPromotionAction`,
   `defaultPromotionFields` below).
2. Every mutation goes through a Server Action that calls a `withBrand(...)` templated method or an op;
   no component imports `@tas/db` (`grep -rn "@tas/db" apps/web/src/components "apps/web/src/app/app/(workspace)/brands/[brandSlug]/interface/"*.tsx`
   prints nothing).
3. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` pass from the root; the E2E runs on the
   PGlite database and test sign-in that `playwright.config.ts` provides (TICKET-012b) and needs no
   credentials.

## Stage 1 (backend) · row edit action

4. `updateTemplatedRowAction({ brandId, tableName, rowId, patch })` built by `createInterfaceActions({
   auth, db, inngest, now })` (`inngest` = `inngestForRequest()`, `now` = `() => new Date()` in
   `actions.ts`): zod-validate (`tableName` must be `'interface_pages'` or `'interface_fields'` in this
   ticket; `patch` keys are validated by the domain function, not re-listed); `requireActor()`; load the
   brand through `findBrandForAgency(db, { brandId, agencyId: actor.agencyId })` (TICKET-008; `null` →
   `forbidden`); when `brand.isTemplate` → `requireTemplateEditor(auth, db, brand.id)` (TICKET-031a),
   else `requireBrandRole(brandId, ...internalBrandRoles)`; `withBrand(db, brandId, { actorId,
   isTemplate: brand.isTemplate }).updateTemplated(spec, rowId, patch)`; on the template brand, after
   commit, when `shouldResend(run, now())` (TICKET-023, the five-minute backstop of design §4.3) →
   `resendRun(db, run.runId, now())` then `enqueueRun(inngest, resent, { resend: true })`, otherwise
   `enqueueRun(inngest, run)`; returns `{ ok: true, data: { row, overriddenAdded, overriddenFields,
   runId? } }`. `UnknownFieldError` / `HiddenFieldError` become `invalid_patch` with the field in
   `message`.
5. `listInterfacePagesAction({ brandId })` returns the brand's alive `interface_pages` rows through
   `withBrand(db, brandId).select(interfacePages)` with `overriddenFields`, plus the ids of pending
   promotion requests for those rows (`promotion_requests` filtered by `brand_id = $brandId AND status =
   'pending'`), behind `requireBrandRole(brandId, ...internalBrandRoles)`.
6. Factory tests (PGlite through `testTemplateWorld()`, stubbed session, fake `inngest`, injected `now`):
   on child B the action returns `overriddenAdded ['label']` and sends nothing; on T by the admin it
   returns `overriddenAdded []`, a `runId`, and `send` was called once with the plain event id; on T by
   a member → `forbidden`; a `client`-only identity on B → `forbidden`; a brand of another agency →
   `forbidden`; with a queued run whose `created_at` is six minutes before `now` the action calls
   `resendRun` and sends the `:resend:1` id.

## Stage 2 (frontend) · component test setup, host page, popup, modal, pills

7. Component tests: `apps/web/package.json` gains devDependencies `@testing-library/react` (major 16,
   exact major pinned), `@testing-library/jest-dom` (major 6) and `jsdom` (current major, exact major
   pinned); `apps/web/vitest.config.ts` sets `setupFiles: ['./vitest.setup.ts']` where `vitest.setup.ts`
   imports `@testing-library/jest-dom/vitest`; every `*.test.tsx` that renders a component starts with
   `// @vitest-environment jsdom` (node stays the default so TICKET-013's `render.test.tsx` and the
   PGlite tests are unaffected). One serialised `pnpm install`, announced. TICKET-034, 035 and 036b reuse
   this setup and add nothing.
8. Page `/app/brands/<brandSlug>/interface`
   (`apps/web/src/app/app/(workspace)/brands/[brandSlug]/interface/page.tsx`) lists the brand's interface
   pages as a table (`data-testid="interface-table"`) with editable `label` (text), `enabled` (switch) and
   `position` (number) cells; each cell whose key is in `overriddenFields` shows an "Overridden" pill
   (`data-testid="overridden-pill"`), and a row with a pending request shows a "Promotion pending" pill
   (`data-testid="pending-pill"`). Saving a cell calls `updateTemplatedRowAction`. On the template brand
   the header reads "Template" and no pills or popup appear (template rows have `[]`).
9. Popup (`promote-popup.tsx`, `data-testid="promote-popup"`): when the action returns a non-empty
   `overriddenAdded`, the shadcn `AlertDialog` (TICKET-013) opens with the PRD §5 wording and two buttons,
   "Keep for this brand only" (`keep-local`) and "Propose to template" (`propose`). Keep closes it.
   Propose opens the promotion modal.
10. Promotion modal (`apps/web/src/components/promotion/promotion-modal.tsx`, props only,
    `data-testid="promotion-modal"`): loads `previewPromotionAction({ brandId, tableName, rowId })` and
    shows a field picker (checkboxes; default selection = `defaultPromotionFields(overriddenAdded,
    overriddenFields, propagatedFields)`, the pure function in `apps/web/src/components/promotion/fields.ts`
    returning the sorted, de-duplicated union restricted to propagated keys), a two-column diff (template
    value from `draft.base`, this brand's value from `draft.proposed`, per selected field), a note textarea
    (`promotion-note`) and a "Send request" button (`send-request`) calling `requestPromotionAction`. An
    `unresolved_link` result renders "Promote the linked <field> row first" and disables Send;
    `nothing_to_promote` renders "Nothing to propose". Success closes the modal and shows the
    "Promotion pending" pill on the row.
11. Row menu "Withdraw promotion" appears only when `allowedPromotionActions('pending',
    promotionActorFor(actor.agencyRole, roles, isRequester))` contains `'withdraw'` and calls
    `withdrawPromotionAction`.
12. Unit tests: `fields.test.ts` for `defaultPromotionFields` (union, dedupe, drops non-propagated keys,
    sorted, empty inputs → `[]`); `promotion-modal.test.tsx` (React Testing Library, jsdom) renders the
    diff rows from a draft fixture and disables Send on the `unresolved_link` result.
13. E2E `apps/web/e2e/promotion-popup.spec.ts` (`signInAs(page, seedIdentities.strategist)` from
    TICKET-012b): open `/app/brands/<child slug>/interface`, edit the `label` of the first page, see
    `promote-popup`, click `propose`, see the diff with the old template value and the new value, click
    `send-request`, and assert the row shows `overridden-pill` and `pending-pill`. A second test clicks
    `keep-local` and asserts only `overridden-pill`.
14. `docs/decisions.md` gets `D-026 · React Testing Library and jsdom for component tests` (next free
    number if taken; update this header): the three devDependencies of criterion 7, why (component
    behaviour such as "Approve is disabled until a decision is chosen" is a unit test, not an E2E), the
    per-file `@vitest-environment jsdom` rule, and that no runtime dependency was added (shadcn
    components come from TICKET-013, D-019).

## Gated criteria (D-008)

- The same flow with a real Clerk sign-in instead of the test sign-in: runbook line
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=… CLERK_SECRET_KEY=… E2E_CLERK_USER=<strategist email> pnpm test:e2e
  apps/web/e2e/promotion-popup.spec.ts`.

## Files touched

`apps/web/src/app/app/(workspace)/brands/[brandSlug]/interface/{actions,interface-actions}.ts` (+ test),
`apps/web/src/lib/action-result.ts` (`invalid_patch`),
`apps/web/src/app/app/(workspace)/brands/[brandSlug]/interface/page.tsx`,
`apps/web/src/app/app/(workspace)/brands/[brandSlug]/interface/interface-table.tsx`,
`apps/web/src/app/app/(workspace)/brands/[brandSlug]/interface/promote-popup.tsx`,
`apps/web/src/components/promotion/promotion-modal.tsx` (+ `promotion-modal.test.tsx`),
`apps/web/src/components/promotion/fields.ts` (+ test), `apps/web/vitest.config.ts`,
`apps/web/vitest.setup.ts`, `apps/web/package.json`, `pnpm-lock.yaml`,
`apps/web/e2e/promotion-popup.spec.ts`, `docs/decisions.md`.

## Notes

- Stage 1 writes only the two action files, their test and the one error code; stage 2 never edits them.
- Route tree: the paths above are TICKET-010's canonical tree verbatim.
- shadcn components come from TICKET-013 and live in `packages/ui/src/components/`; `@tas/ui` is deferred
  (D-019). This ticket vendors nothing.
- The interface table is the Phase 2 host for the popup; Phase 4 replaces it with the configured client
  interface screens and keeps the popup and modal.
- The modal never reads template rows itself; `previewPromotionAction` is the only source of template
  values (design §6: `apps/web` never imports the scope).
- Do not add a "promote all" shortcut; every request names its fields (Non-negotiable 2).
- UI governance (CLAUDE.md "UI governance", from the 2026-09-16 design handoff): colours, fonts and radii
  only through the token classes (no hex, no `rounded-full` buttons); status values from
  `@tas/domain/state`; any status pill or stepper row is `StatusChip` / `StepRow` from `@tas/ui`; every new
  primitive or status-bearing component gets a story rendered on the `/design-system` page before Done.
