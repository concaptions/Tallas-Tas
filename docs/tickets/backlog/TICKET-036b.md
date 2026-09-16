# TICKET-036b · Admin propagation page, "Setting up from template" page, brand switcher Template badge

- Owner: frontend (`apps/web/src/app/app/(admin)/admin/propagation/**` pages and components,
  `apps/web/src/app/app/(admin)/admin/layout.tsx` link,
  `apps/web/src/app/app/(admin)/admin/promotions/promotion-table.tsx` one link,
  `apps/web/src/components/workspace/setting-up.tsx`, `apps/web/src/components/workspace/brand-switcher.tsx`,
  `apps/web/src/components/workspace/items.ts`, `apps/web/e2e/propagation.spec.ts`)
- Size: M
- Depends on: TICKET-036a, TICKET-034 (admin layout, Decided tab, drain route), TICKET-033 (RTL setup),
  TICKET-029b (placeholder `setting-up.tsx`, readiness gate), TICKET-012b, TICKET-010, TICKET-011
- PRD: §5 (whenever we make a change in the parent base, it will be replicated), §3 (adding a client is a
  short setup), §11 (brand switcher in the top nav; Admin sees everything), §14.1
- Design: §3.5, §3.6, §4.1 (readiness), §5.2 (Retry after `attempt = 3`), §5.4 (stale queued re-send on
  page load), §9 TICKET-036 row, I8, I14

## Why

An admin must see whether the template's last change reached every brand, which child failed and why,
and be able to retry. Brand creation must not show an empty workspace while the seed is running, and the
template brand must be unmistakable in the switcher.

## Acceptance criteria

1. Components contain no business logic: run and child statuses, the stale predicate and the Retry
   eligibility are computed by `@tas/domain` (`shouldResend`, `canRetry`, TICKET-023) and the TICKET-036a
   actions and passed as data.
2. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` pass from the root with no credentials.
3. Page `/app/admin/propagation` (`page.tsx`; the admin layout of TICKET-034 gains the "Propagation"
   link): calls `resendStaleRunsAction()` on load (server component) and shows "Re-sent N stale runs" when
   N > 0; a table (`data-testid="run-table"`, `run-table.tsx`) of runs with status pills, trigger, target
   brand (seed / resync), changes, attempt, started / finished times, and a "Retry" button (`retry-run`)
   when `canRetry(run, now)`; a "Resync brand" select + button (`resync-brand`) per child brand calling
   `resyncBrandAction` (TICKET-032a). Clicking a run opens `/app/admin/propagation/[runId]` with the
   per-child rows (brand, status, counts) and, expanded per child, the informative outcomes with their
   fields and errors.
4. The Decided tab of TICKET-034 (`promotion-table.tsx`) links `applied_batch_id` to
   `/app/admin/propagation/<runId>` of the run whose `batchIds` (TICKET-036a `listRuns`) contains it; when
   no run is listed it stays text. One link, no other change to the table.
5. "Setting up from template": replace TICKET-029b's placeholder component
   (`apps/web/src/components/workspace/setting-up.tsx`) with a designed one keeping
   `data-testid="setting-up"`: the brand name, a spinner and "Setting up from template" for `seeding`; or
   "Template setup failed" with the run error and, for admins, a "Resync now" button (`resync-now`,
   `resyncBrandAction`) for `seed_failed`; a small client component calls `router.refresh()` every five
   seconds while `seeding`.
6. Brand switcher: `brand-switcher.tsx` (TICKET-010) fills its badge slot with "Template"
   (`data-testid="template-badge"`) for items with `isTemplate`, and `brandSwitcherItems` lists the
   template brand first (its test updated: template first, then the rest by name).
7. Unit tests (React Testing Library and jsdom from TICKET-033; nothing added): `run-table.test.tsx`: a
   `failed` run with `attempt 2` shows `retry-run`, one with `attempt 3` does not; `brand-switcher.test.tsx`:
   the switcher renders `template-badge` on the first item; `items.test.ts` updated for the new order.
8. E2E `apps/web/e2e/propagation.spec.ts` (`seedIdentities.admin`): edit the template page `label` on
   `/app/brands/template/interface`, open `/app/admin/propagation`, assert one `queued` run with `changes
   1`; `POST /api/test/engine { action: 'drain' }`; reload and assert `succeeded` with `stats.children`
   equal to the number of child brands; open the run and assert one row per child with `applied 1`.
   Second test: add a brand through `/app/onboarding` (TICKET-011), land on it and assert `setting-up`;
   drain; reload and assert `/app/brands/<slug>/interface` renders the template's pages. Third test: the
   switcher's first item carries `template-badge`.

## Gated criteria (D-008)

- Same E2E with a real Clerk sign-in: runbook line
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=… CLERK_SECRET_KEY=… E2E_CLERK_ADMIN=<admin> pnpm test:e2e apps/web/e2e/propagation.spec.ts`.
- Retry of a genuinely failed run under Inngest: needs a run that failed three times; the runbook line
  describes producing one on a Neon preview by adding a CHECK to `interface_pages`
  (`alter table interface_pages add constraint e2e_block check (label <> 'BLOCK') not valid`), editing
  the template label to `BLOCK`, waiting for `partial`, dropping the constraint and clicking Retry.

## Files touched

`apps/web/src/app/app/(admin)/admin/layout.tsx`, `apps/web/src/app/app/(admin)/admin/propagation/page.tsx`,
`apps/web/src/app/app/(admin)/admin/propagation/run-table.tsx` (+ test),
`apps/web/src/app/app/(admin)/admin/propagation/[runId]/page.tsx`,
`apps/web/src/app/app/(admin)/admin/promotions/promotion-table.tsx` (one link),
`apps/web/src/components/workspace/setting-up.tsx`, `apps/web/src/components/workspace/brand-switcher.tsx`
(+ test), `apps/web/src/components/workspace/items.ts` (+ test), `apps/web/e2e/propagation.spec.ts`.

## Notes

- Nothing under `packages/*` and no `actions.ts` is edited; every read and mutation is a TICKET-036a or
  TICKET-032a action.
- Route tree: the paths above are TICKET-010's canonical tree verbatim.
- Outcome rows shown are the informative kinds only (design §3.6); "applied" counts come from the
  child-run row.
- A "Setting up" badge on child items in the switcher is not built: `listAccessibleBrands` (TICKET-008)
  does not carry `seededAt`, and the layout gate already covers the case.
- No dependency and no decisions entry.
- UI governance (CLAUDE.md "UI governance", from the 2026-09-16 design handoff): colours, fonts and radii
  only through the token classes (no hex, no `rounded-full` buttons); status values from
  `@tas/domain/state`; any status pill or stepper row is `StatusChip` / `StepRow` from `@tas/ui`; every new
  primitive or status-bearing component gets a story rendered on the `/design-system` page before Done.
