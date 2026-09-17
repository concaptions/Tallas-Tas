# Notifications · One row per trigger, Slack DM and Email (PRD §12)

- Page: `/app/notifications`, sidebar group `settings`, section key `notifications` (`href`-less today,
  so it renders with a `SoonChip`). Pattern: Interface Config, mirrored file for file — a settings table
  of switches, read through a `*-source.ts` demo branch, every write disabled in demo mode.

## Why

PRD §12: "notifications go as **Slack direct messages to the assigned person**, through our existing
TAS Bot app" and "Routing comes from the team assignment made at onboarding (§3) — filled once, never
rebuilt by hand."

## Acceptance criteria

1. `/app/notifications` renders inside the app shell with no frame, padding or background of its own.
   `notificationsPath` is added to `routes.ts` and the same change adds `href` to the `notifications`
   section in `nav.ts`, so its `SoonChip` is gone and the section is active on the route.
2. A note sits at the top of the page, above the table, `data-slot="routing-note"`: recipients are
   derived from the team assignment made at onboarding and cannot be edited here. It is one short
   paragraph in `text-text3` inside a `rounded-card` `border-line` block, `bg-surface2`, and it links
   to `teamPath`. No hex, no `rounded-full`.
3. The page renders exactly one `<table>` (`data-slot="notification-table"`) with one row per trigger
   (`data-slot="notification-row"`, `data-trigger="<key>"`) and exactly four columns in this order:
   **Trigger**, **Recipient**, **Slack DM**, **Email**.
4. The Recipient cell is read-only text naming the role(s) the DM goes to (e.g. "Media Buyer",
   "CSM + Strategist"). It is rendered from the row data, never editable, never a control — that is
   what criterion 2's note is about.
5. The Slack DM and Email cells are each a switch bound to that trigger's stored on/off value. Nothing
   else in the row is interactive; there is no add, delete, reorder, per-person override, channel picker,
   message template, test-send or Slack OAuth anywhere on the page.
6. Exactly 8 triggers are seeded, in PRD §12 order, one per bullet: brief assigned to an
   editor/designer (assignee), revisions requested internally (assignee), ad submitted (strategist /
   CSM), client approved a concept/creative/copy/creator (CSM + strategist), client requested
   revisions (CSM + strategist), creative approved internally and ready to launch (media buyer),
   creator status changes (UGC manager), partnership permission expiring in 5 days (media buyer + CSM).
7. Trigger keys, labels and recipient labels come from a single shared `notificationTriggers` tuple
   (`as const`) in `packages/db/src/schema/enums.ts` beside `angleFormats`; no trigger string literal
   appears in a component. Recipient roles reuse the existing role enums — no new role names.
8. `demoNotifications` in `packages/db/src/demo-data.ts` has those 8 rows with hardcoded uuids and
   fixed timestamps, so `demoNotifications` and `seed(db)` rows are identical, ids included. Defaults:
   Slack DM on for all 8, Email off for all 8 (PRD §12: Slack is the channel, email is the extra).
9. `loadNotifications()` in `apps/web/src/lib/notifications-source.ts` copies `personas-source.ts`
   function for function: demo mode reads `demoNotifications` from `@tas/db` and constructs **no**
   database client even when `DATABASE_URL` is set; live mode opens Neon per call and closes it in a
   `finally`, brand-scoped. `notifications-source.test.ts` proves the demo branch with an injected
   `connect` spy that throws if it is ever called.
10. In demo mode both switches in every row are disabled through `DisabledWrite` +
    `disabledWriteClassName` from `@tas/ui` with the tooltip "Sign in required to save changes", and
    `setNotificationChannel` refuses before any validation, actor lookup or connection, returning a
    typed result carrying `DEMO_MUTATION_REFUSED` and never throwing (copy
    `interface-config/actions.ts`).
11. Colours go through the token layer only (`bg-surface2/3/4`, `border-line`, `text-text2/3/4`,
    `text-accent`, `font-mono`, `rounded-input`, `rounded-card`): no hex in a component, no
    `rounded-full` button. This page has no workflow status, so none is invented and no label is
    written inline.
12. `pnpm --filter @tas/web exec tsc --noEmit`, `pnpm --filter @tas/db exec tsc --noEmit` and the
    vitest runs for both packages are clean, and `apps/web/e2e/notifications.spec.ts` covers: the
    routing note is visible, the table renders exactly 8 rows in PRD order, each row shows a recipient
    and two switches, the column headers read Trigger / Recipient / Slack DM / Email, and both
    switches are disabled in demo mode with the tooltip present.

Out of scope: sending anything, the TAS Bot Slack app or any Slack call, channel posts, per-person or
per-brand overrides, templates, history or an inbox, digests, quiet hours, editing team assignment here.

## Files each agent touches

- schema/db: `packages/db/src/schema/enums.ts` (`notificationTriggers` + `pgEnum`),
  `packages/db/src/schema/notifications.ts`, a generated migration in `packages/db/drizzle`,
  `packages/db/src/demo-data.ts` (8 rows), `packages/db/src/notifications.ts` +
  `notifications.test.ts` (`listNotifications`, `setNotificationChannel`),
  `packages/db/src/index.ts`, `packages/db/src/seed.ts`
- app: `apps/web/src/lib/notifications-source.ts` + `notifications-source.test.ts`,
  `apps/web/src/app/app/notifications/{page.tsx,notifications-workspace.tsx,notification-row.tsx,fields.ts,actions.ts,actions.test.ts}`,
  `apps/web/src/lib/routes.ts` (`notificationsPath`), `apps/web/src/components/shell/nav.ts`
- qa: `apps/web/e2e/notifications.spec.ts`

## Gated criteria

None. Every criterion runs locally in demo mode (no Clerk key, no database); the db tests run on PGlite.
