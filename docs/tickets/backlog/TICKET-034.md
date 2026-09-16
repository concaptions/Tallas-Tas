# TICKET-034 · Admin promotion dashboard and the end-to-end promotion flow

- Owners, in order: backend (stage 1, `apps/web/src/app/api/test/engine/route.ts`) then frontend (stage 2,
  `apps/web/src/app/app/(admin)/admin/layout.tsx`, `apps/web/src/app/app/(admin)/admin/promotions/**`
  pages and components, `apps/web/e2e/promotion-flow.spec.ts`, `docs/runbook.md`)
- Size: M
- Depends on: TICKET-031b, TICKET-033 (test ids, RTL setup), TICKET-012b (`isTestBypassEnabled`),
  TICKET-029b, TICKET-011, TICKET-013 (`tabs`, `radio-group`)
- PRD: §5 (request comes in to the ADMIN dashboard to approve everything), §11 (Admin: everything, all
  brands), §14.1
- Design: §4.5 (review: three-way diff, badges, per-field approve, decisions for conflicts, reject with
  note), §6 (`listPromotionRequests` read scope behind `requireAdmin()`), §9 TICKET-034 row (engine driven
  through a test-only route), I9

## Why

The admin dashboard is where Non-negotiable 2 is enforced by a person. This ticket also proves the whole
loop through the browser: a child edit becomes a request, the admin approves it, propagation lands the
value in a second brand.

## Acceptance criteria

1. Components contain no business logic: badges come from `review` in `listPromotionRequestsAction`
   (`reviewPromotion`), allowed buttons from `allowedPromotionActions`, and decisions are collected as
   data and passed to `approvePromotionAction`.
2. The test-only route is the only place in `apps/web` that calls engine functions directly, it is
   unreachable in production through `isTestBypassEnabled(serverEnv())` (imported from
   `apps/web/src/lib/auth/bypass.ts`, TICKET-012b), and it is not a request path for users:
   `grep -rln "claimRun\|applyChildChunk\|finishRun\|seedBrand(\|resyncBrand(" apps/web/src` lists only
   `apps/web/src/app/api/test/engine/route.ts` and its test.
3. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` pass from the root with no credentials.

## Stage 1 (backend) · test-only engine route

4. `POST /api/test/engine` with body `{ action: 'drain' }` runs every `queued` run of the template brand
   in `created_at` order: `changes` runs through `claimRun` → `applyChildChunk` per chunk from
   `chunkChildren` → `finishRun` (TICKET-028a/b), `seed` / `resync` runs through `seedBrand` /
   `resyncBrand` (TICKET-027a/b) after `claimRun` and then `finishRun`; returns `{ runs: [{ id, trigger,
   status }] }`. It returns 404 with an empty body unless `isTestBypassEnabled(serverEnv())` is true,
   before reading the body. It never starts Inngest and never runs on a schedule; it exists so Playwright
   can drive propagation without the Inngest dev server.
5. Unit test `route.test.ts` (node environment, injected env and db): with the bypass refused the handler
   returns 404 and opens no database; with it allowed on PGlite through `testTemplateWorld()`, a template
   `updateTemplated` followed by `drain` leaves the run `succeeded` and the child updated.

## Stage 2 (frontend) · admin layout, dashboard, E2E

6. `apps/web/src/app/app/(admin)/admin/layout.tsx` (URL prefix `/app/admin`, TICKET-010's canonical
   tree): `getAuth().requireAdmin()` (`UnauthenticatedError` → `redirect('/sign-in')`, `ForbiddenError` →
   `notFound()`), renders `TopNav`-less admin chrome with links "Promotions" and "Propagation" (the
   second page arrives in TICKET-036b; until then the link is omitted). No other logic.
7. Page `/app/admin/promotions` (`page.tsx`) with two shadcn `Tabs` (TICKET-013), "Pending" and
   "Decided" (`status` filter of `listPromotionRequestsAction`), a table (`data-testid="promotion-table"`,
   `promotion-table.tsx`) of requests (brand, table, row label from `spec.labelField`, requested by, age,
   badges "Stale", "Conflict", "Parent deleted", "Already matching" from `review`), and a detail panel per
   request.
8. Detail panel (`promotion-review.tsx`, `data-testid="promotion-review"`): three columns per field,
   "Template at request" (`base`), "Template now" (`currentParent`), "Proposed" (`proposed`); a checkbox
   per field (approved fields, default all); for each field in `review.conflicts` a shadcn `RadioGroup`
   (TICKET-013) "Take proposed / Keep current" (`decision-<field>`); when `review.parentDeleted`, a
   required radio "Restore template row" (`restore_parent`) with Approve disabled until chosen; a
   "Reject" button (`reject`) opening a note dialog (`review-note`, submit disabled while blank); "Approve"
   (`approve`) calls `approvePromotionAction({ requestId, approvedFields, decisions, reviewNote })`. A
   `missing_decision` result highlights the named field; `not_pending` refreshes the list and shows an
   inline `role="status"` message "This request was already decided" (no toast library, D-019).
9. Decided tab rows show `status`, reviewer, `review_note`, `approved_fields` and, for approved ones, the
   `applied_batch_id` as text (TICKET-036b turns it into a link to the run).
10. Unit test `promotion-review.test.tsx` (React Testing Library and jsdom from TICKET-033; nothing
    added) with a fixture request whose `review` has one conflict: Approve is disabled until the radio is
    chosen, the submitted `decisions` object equals `{ label: 'take_proposed' }`; with `parentDeleted`
    the submitted decisions include `deletedAt: 'restore_parent'`.
11. E2E `apps/web/e2e/promotion-flow.spec.ts`: as `seedIdentities.admin`, add a second brand "Brand A"
    through `/app/onboarding` (TICKET-011) and `POST /api/test/engine { action: 'drain' }` so it is seeded;
    as `seedIdentities.strategist` on the seeded child brand, edit a page `label` and propose it
    (TICKET-033 test ids); as the admin open `/app/admin/promotions`, see the request with no badges,
    click `approve`; drain again from the test; open `/app/brands/brand-a/interface` and assert the row
    shows the new label with no `overridden-pill`; open the child's and assert `overridden-pill` is gone;
    the Decided tab lists the request as approved. A second test edits the template label between
    request and review (as admin on `/app/brands/template/interface`), sees the "Conflict" badge, chooses
    "Keep current" and approves, and asserts the child keeps its own value and Brand A shows the
    template's.
12. `docs/runbook.md` "Everyday commands" notes that `pnpm test:e2e` drives propagation through
    `/api/test/engine` and needs neither Inngest nor credentials.

## Gated criteria (D-008)

- Same flow with real Clerk sign-ins for both identities: runbook line
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=… CLERK_SECRET_KEY=… E2E_CLERK_USER=<strategist> E2E_CLERK_ADMIN=<admin> pnpm test:e2e apps/web/e2e/promotion-flow.spec.ts`.
- Same flow with propagation executed by Inngest instead of the drain route: `npx inngest-cli@latest dev
  -u http://localhost:3000/api/inngest` running, `INNGEST_DEV=1 pnpm dev`, repeat the steps by hand and
  confirm Brand A's label changes within a minute of the approval.

## Files touched

`apps/web/src/app/api/test/engine/route.ts` (+ test), `apps/web/src/app/app/(admin)/admin/layout.tsx`,
`apps/web/src/app/app/(admin)/admin/promotions/page.tsx`,
`apps/web/src/app/app/(admin)/admin/promotions/promotion-table.tsx`,
`apps/web/src/app/app/(admin)/admin/promotions/promotion-review.tsx` (+ test),
`apps/web/e2e/promotion-flow.spec.ts`, `docs/runbook.md`.

## Notes

- Stage 1 writes only the route and its test; stage 2 never edits the route.
- Route tree: the paths above are TICKET-010's canonical tree verbatim; `/app/admin` is outside the
  `/app/brands/[brandSlug]` tree, so no brand slug can collide with it and no slug is reserved for it.
- The dashboard reads through `listPromotionRequestsAction` only (TICKET-031a); it never queries
  `promotion_requests` itself and never reads a child brand's rows.
- The drain route replaces the Inngest dev server in E2E only; the sweeper and the coalescing sleep are
  not exercised by E2E (unit tests in TICKET-029a cover them).
- No dependency and no decisions entry: `tabs`, `radio-group` and the test libraries come from
  TICKET-013 and TICKET-033.
- UI governance (CLAUDE.md "UI governance", from the 2026-09-16 design handoff): colours, fonts and radii
  only through the token classes (no hex, no `rounded-full` buttons); status values from
  `@tas/domain/state`; any status pill or stepper row is `StatusChip` / `StepRow` from `@tas/ui`; every new
  primitive or status-bearing component gets a story rendered on the `/design-system` page before Done.
