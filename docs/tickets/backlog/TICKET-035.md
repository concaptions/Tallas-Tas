# TICKET-035 · Brand "Template updates" page, conflict badge, reset-to-template menu items

- Owners, in order: backend (stage 1, `softDeleteTemplatedRowAction` and `restoreTemplatedRowAction` in
  `apps/web/src/app/app/(workspace)/brands/[brandSlug]/interface/interface-actions.ts`) then frontend
  (stage 2, `apps/web/src/app/app/(workspace)/brands/[brandSlug]/template-updates/**` pages and
  components, `apps/web/src/app/app/(workspace)/brands/[brandSlug]/layout.tsx` badge,
  `apps/web/src/app/app/(workspace)/brands/[brandSlug]/interface/interface-table.tsx` menu items,
  `apps/web/src/components/template-updates/**`, `apps/web/src/components/workspace/top-nav.tsx`,
  `apps/web/e2e/template-updates.spec.ts`)
- Size: M
- Depends on: TICKET-032a, TICKET-033, TICKET-034 (drain route, admin flow), TICKET-012b, TICKET-010
- PRD: §5 (whenever we make a change in the parent base, it will be replicated; the child decides on its
  local edits), §10 (per-brand interface configuration), §14.1
- Design: §4.8 (parent delete and restore: Keep mine / Delete here too), §4.9 (conflicts, Keep mine per
  field, Take template, `skipped_key_conflict`, badge query), §4.7 (`resetToTemplate` field and row
  forms), §9 TICKET-035 row

## Why

Propagation skips a field the brand overrode and records a conflict; the brand's team must see that the
template moved and choose. Without this page conflicts pile up silently and "one template, propagated"
is only half true.

## Acceptance criteria

1. Components contain no business logic: the grouped conflict list is the result of the pure
   `groupConflicts(outcomes)` helper in `apps/web/src/components/template-updates/group.ts`, actions are
   the Server Actions of TICKET-032a, and no component imports `@tas/db`.
2. No cross-brand read: the page shows template values from `parent_values` on the outcome as returned by
   `listConflictsAction` (design §4.9) and never calls a template-brand action.
3. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` pass from the root with no credentials.

## Stage 1 (backend) · soft-delete and restore row actions

4. `softDeleteTemplatedRowAction({ brandId, tableName, rowId })` and `restoreTemplatedRowAction` added to
   `createInterfaceActions` (TICKET-033): same guards as `updateTemplatedRowAction`, call
   `softDeleteTemplated` / `restoreTemplated`, enqueue on the template brand after commit (same
   `shouldResend` backstop), return `{ row, runId? }`. Factory test: on B the soft delete adds `'deletedAt'`
   to the row's overrides and sends nothing; on T by the admin it journals `soft_delete` and sends once.

## Stage 2 (frontend) · page, badge, menu items, E2E

5. Page `/app/brands/<brandSlug>/template-updates` (`page.tsx`, reached through the TICKET-010 layout, so
   a `client`-only identity gets the 404) lists the open conflicts of the brand grouped by table then
   row (`spec.labelField` as the row title), one line (`data-testid="conflict-line"`) per conflicting
   field with "This brand" (child value) and "Template" (`parent_values[field]`) columns and two buttons:
   "Keep mine" (`keep-mine`) → `acknowledgeConflictsAction({ fields: [field] })`, "Take template"
   (`take-template`) → `resetToTemplateAction({ fields: [field] })`. A row header offers "Keep all mine"
   (row-level acknowledge) and "Take template for this row" (`fields: 'all'`).
6. Row-level lifecycle conflicts (`conflict_fields` containing `'deletedAt'`): the line reads "Deleted in
   the template" or "Restored in the template" depending on `parent_values.deletedAt`, with "Keep mine"
   (acknowledge) and "Delete here too" / "Restore here too" (`resetToTemplateAction({ fields:
   ['deletedAt'] })`).
7. `skipped_key_conflict` entries show both rows (the template's `parent_values` and the local owner row
   returned by `listConflictsAction`) with the text "A template row could not be added because this brand
   already has a row with the same <natural key>", and the actions "Keep mine" (acknowledge) and a link to
   the local row on the interface page (the user renames or deletes it there; the next resync inserts the
   copy).
8. Navigation badge: the `[brandSlug]` layout's `TopNav` (TICKET-010) gets a "Template updates" link with
   the `countConflictsAction` number (`data-testid="conflict-badge"`) when it is greater than zero; the
   count is read in the server component, not by a client fetch.
9. Interface page menu items (TICKET-033's table): a per-cell "Reset to template" item on any cell with
   an `overridden-pill` (`resetToTemplateAction({ fields: [key] })`) and a row menu with "Reset row to
   template" (`fields: 'all'`) and "Delete" (`softDeleteTemplatedRowAction`), the reset items only for
   rows with `templateRowId` (brand-local rows show only Delete). After a reset the pill disappears and a
   pending promotion on that field shows an inline `role="status"` message from the action's `settled`
   result ("Promotion withdrawn" / "Promotion narrowed"; no toast library, D-019).
10. Unit tests: `group.test.ts` for `groupConflicts` (groups by table then row, newest first, one entry
    per `(table, row)`, separates `deletedAt` from field conflicts, tags `skipped_key_conflict`, empty
    input → `[]`); `conflict-list.test.tsx` (React Testing Library and jsdom from TICKET-033; nothing
    added) renders a conflict line with the two buttons carrying the right `fields` argument.
11. E2E `apps/web/e2e/template-updates.spec.ts`: seed a conflict through the UI and the drain route
    (strategist overrides the child's page `label`; admin edits the template `label` on
    `/app/brands/template/interface`; `POST /api/test/engine { action: 'drain' }`); as the strategist
    open `/app/brands/<child>/template-updates`, assert one `conflict-line` with both values and
    `conflict-badge` "1"; click `keep-mine` → line gone, badge gone; repeat with a `position` conflict and
    click `take-template` → the interface page shows the template value without `overridden-pill`. A
    third test: admin deletes a template page through the row menu, drains, and asserts the child (which
    overrode the page) sees "Deleted in the template".

## Gated criteria (D-008)

- Same E2E with real Clerk sign-ins: runbook line
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=… CLERK_SECRET_KEY=… E2E_CLERK_USER=<strategist> E2E_CLERK_ADMIN=<admin> pnpm test:e2e apps/web/e2e/template-updates.spec.ts`.

## Files touched

`apps/web/src/app/app/(workspace)/brands/[brandSlug]/interface/{actions,interface-actions}.ts` (+ test,
stage 1 only), `apps/web/src/app/app/(workspace)/brands/[brandSlug]/template-updates/page.tsx`,
`apps/web/src/app/app/(workspace)/brands/[brandSlug]/template-updates/conflict-list.tsx` (+ test),
`apps/web/src/components/template-updates/group.ts` (+ test),
`apps/web/src/components/workspace/top-nav.tsx` (badge link),
`apps/web/src/app/app/(workspace)/brands/[brandSlug]/layout.tsx` (count read),
`apps/web/src/app/app/(workspace)/brands/[brandSlug]/interface/interface-table.tsx` (menu items),
`apps/web/e2e/template-updates.spec.ts`.

## Notes

- Stage 1 writes only the interface action files; stage 2 never edits them.
- Route tree: the paths above are TICKET-010's canonical tree verbatim.
- "Take template" on a field uses the field-level reset; never call the row-level form for a single field
  (design §4.9: other open conflicts on the row must stay open).
- The page lists open outcomes only; acknowledged ones are not shown (no history view in Phase 2).
- No dependency and no decisions entry.
- UI governance (CLAUDE.md "UI governance", from the 2026-09-16 design handoff): colours, fonts and radii
  only through the token classes (no hex, no `rounded-full` buttons); status values from
  `@tas/domain/state`; any status pill or stepper row is `StatusChip` / `StepRow` from `@tas/ui`; every new
  primitive or status-bearing component gets a story rendered on the `/design-system` page before Done.
