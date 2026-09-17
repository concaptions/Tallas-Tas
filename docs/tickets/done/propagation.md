# Propagation · Pending promotion requests, admin approval (PRD §5, §14.1)

- Page: `/app/propagation`, sidebar group `settings`, section key `propagation` (`href`-less today, so
  it renders with a `SoonChip`). Pattern: Notifications, mirrored file for file.

## Why

PRD §5: "Sometimes, we test an idea a child base... request comes in to the ADMIN dashboard to approve
everything." PRD §14.1: "One template, propagated. A change to the template updates every brand."

## Acceptance criteria

1. `/app/propagation` renders inside the app shell with no frame, padding or background of its own.
   `propagationPath` is added to `routes.ts` and the same change adds `href` to the `propagation`
   section in `nav.ts`, so its `SoonChip` is gone and the section is active on the route.
2. A note sits at the top of the page, above the table, `data-slot="admin-note"`: this page is admin
   only — a change made in one brand can request promotion to the template, and an agency admin
   approves or rejects it here. One short paragraph in `text-text3` inside a `rounded-card`
   `border-line` `bg-surface2` block. No hex, no `rounded-full`.
3. Admin only is enforced, not just written: `canSeePropagationPage(actor)` in
   `packages/domain/src/team/access.ts` takes the existing `TeamPageActor` and is true only for
   `agencyRole === 'admin'`. `page.tsx` resolves the actor with `currentTeamActor` and renders one
   `data-slot="not-admin"` block instead of the table when the guard says no; no component writes
   `role === 'admin'` by hand. In demo mode `DEMO_TEAM_ACTOR` stands in for an admin, so the table
   renders locally and the note says the check is stubbed.
4. The page renders exactly one `<table>` (`data-slot="promotion-table"`) listing only **pending**
   requests, one row per request (`data-slot="promotion-row"`, `data-request="<id>"`), with exactly
   six columns in this order: **Brand**, **Table**, **Field**, **Requested by**, **Requested at**,
   **Change**.
5. The Change cell is a diff preview (`data-slot="diff-preview"`): previous value in `text-text4`
   struck through, requested value in `text-text2`, both `font-mono`, each truncated to one line.
   Read-only text, never an input.
6. Requested at renders from the row's fixed timestamp in the form the Team page uses; Brand names come
   from the request row, not a second query. Each row ends with an **Approve** and a **Reject** button
   in one actions cell (`data-slot="promotion-actions"`). Nothing else in the row is interactive: no
   bulk select, filter, history tab, approved/rejected list, editing of the proposed value, "apply to
   selected brands" picker, or way to create a request here.
7. Status keys, labels and tones come from a single `PROMOTION_STATUS` tuple in
   `packages/domain/src/state/promotion-status.ts` (`pending` / `approved` / `rejected`), exported from
   `@tas/domain/state` with `promotionStatusLabel` and `promotionStatusTone`. No status string literal
   appears in a component; any status chip on the page is `StatusChip` from `@tas/ui`.
8. Exactly 3 promotion requests are seeded across at least two brands and two tables (e.g. a Personas,
   a Themes and a Creative Brief field), with hardcoded uuids and fixed timestamps in
   `demoPromotionRequests` in `packages/db/src/demo-data.ts`, so `demoPromotionRequests` and `seed(db)`
   rows are identical, ids included. All 3 are `pending`.
9. `loadPromotionRequests()` in `apps/web/src/lib/propagation-source.ts` copies `personas-source.ts`
   function for function: demo mode reads `demoPromotionRequests` from `@tas/db` and constructs **no**
   database client even when `DATABASE_URL` is set; live mode opens Neon per call and closes it in a
   `finally`. `propagation-source.test.ts` proves it with an injected `connect` spy that throws if called.
10. In demo mode both buttons in every row are disabled through `DisabledWrite` +
    `disabledWriteClassName` from `@tas/ui` with the tooltip "Sign in required to save changes", and
    `approvePromotionRequest` / `rejectPromotionRequest` refuse before any validation, actor lookup or
    connection, returning a typed result carrying `DEMO_MUTATION_REFUSED` and never throwing (copy
    `notifications/actions.ts`).
11. Colours go through the token layer only (`bg-surface2/3/4`, `border-line`, `text-text2/3/4`,
    `text-accent`, `bg-accent-soft`, `font-mono`, `rounded-input`, `rounded-card`): no hex, no
    `rounded-full` button.
12. `pnpm --filter @tas/web exec tsc --noEmit`, `pnpm --filter @tas/db exec tsc --noEmit`,
    `pnpm --filter @tas/domain exec tsc --noEmit` and the vitest runs for all three are clean, and
    `apps/web/e2e/propagation.spec.ts` covers: the admin note is visible, the table renders exactly 3
    rows, headers read Brand / Table / Field / Requested by / Requested at / Change, each row shows a
    diff preview with both values, and Approve and Reject are disabled in demo mode with the tooltip.

Out of scope: applying a promotion to other brands, the child-side "duplicate this?" pop-up, per-brand targeting, request creation, history, approval notifications, audit log.

## Files each agent touches

- domain: `packages/domain/src/state/promotion-status.ts` + test, `state/index.ts`,
  `packages/domain/src/team/access.ts` + `access.test.ts` (`canSeePropagationPage`)
- schema/db: `packages/db/src/schema/promotion-requests.ts`, a generated migration in `packages/db/drizzle`,
  `packages/db/src/demo-data.ts` (3 rows), `packages/db/src/promotion-requests.ts` + test
  (`listPendingPromotionRequests`, `setPromotionRequestStatus`), `packages/db/src/index.ts`, `seed.ts`
- app: `apps/web/src/lib/propagation-source.ts` + `propagation-source.test.ts`,
  `apps/web/src/app/app/propagation/{page.tsx,propagation-workspace.tsx,promotion-row.tsx,fields.ts,actions.ts,actions.test.ts}`,
  `apps/web/src/lib/routes.ts` (`propagationPath`), `apps/web/src/components/shell/nav.ts`
- qa: `apps/web/e2e/propagation.spec.ts`

## Gated criteria

None. Every criterion runs locally in demo mode (no Clerk key, no database); the db tests run on PGlite.
