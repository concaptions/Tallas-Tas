# Copywriting · Ad copy tied to a creative (PRD §5.11)

- Page: `/app/copywriting`, sidebar section `copywriting` (`href`-less today, so it renders a
  `SoonChip`). Pattern: Personas, mirrored file for file — a simple table plus a detail panel.

## Why

PRD §5.11: "Ad copy, written separately but tied to the creative. Keep this table lean."
The link to the Creative "is the connection that matters"; Funnel and Copy Type are dropped.

## Acceptance criteria

1. `/app/copywriting` renders inside the app shell with no frame, padding or background of its own,
   and the sidebar's Copywriting section is active on it (`copywritingPath` added to `routes.ts` and
   `href` added to `nav.ts` in the same change, so its `SoonChip` is gone).
2. The list is a single `Table` (`data-slot="copy-table"`) with exactly four columns in this order:
   **Copy title**, **Linked Creative**, **Status**, **Updated**. No other column, no card grid.
   Each row is `data-slot="copy-row"` and carries the copy id.
3. Copy title is the auto-generated Copy # (PRD §5.11 "auto-generated", CLAUDE.md non-negotiable 6):
   a pure function `copyTitle(...)` in `packages/domain/src/copy`, unit tested there, never an input
   in the UI and never typed by a user. The column renders it in `font-mono`.
4. Linked Creative renders the linked brief's auto-generated name, or a muted em dash in `text-text3`
   when the row has none. Status renders a `StatusChip` from `@tas/ui` toned by `chipTone`; Updated
   renders `updatedAt` in the same format the Personas table uses.
5. Copy statuses come from a new `COPY_STATUS` tuple in `packages/domain/src/state` (exported from
   `@tas/domain/state`, shaped exactly like `CLIENT_STATUS`: `key`, `label`, `description`) with the
   five PRD §5.11 entries — Pending For Client Review, Edited By Client, Approved, Revisions Needed,
   Disapproved. No status string is inline in a component or in `@tas/db` (non-negotiable 2);
   `copy.status` is plain `text` carrying the KEY, as on `briefs`.
6. Clicking a row opens a detail panel in the Personas pattern (`data-slot="copy-panel"`, title,
   close button `data-slot="copy-panel-close"`, grouped fields from a `fields.ts` descriptor) with
   exactly four copy fields, in this order: **Primary Copy**, **Headline**, **News Feed / Link
   Description**, **CTA**, each showing its PRD character guidance (~125 / ~40 / ~27) as helper
   text in `text-text3`. Client's Comment is out of scope.
7. Linked Creative is a `Select` in the panel populated from the Creative Briefs table — the same
   rows `listBriefs` returns — labelled by the brief's auto-generated name. It is never a free-text
   input. It includes an explicit "No creative" option, because `copy.brief_id` is nullable.
8. CTA is a `Select` over a `copyCtas` tuple — Shop Now / Learn More / Get Offer / Get Directions /
   Visit Us / Download — declared once in `packages/db/src/schema/enums.ts` with its `pgEnum`,
   exactly as `angleFormats` is, and never re-typed in a component.
9. In demo mode every write is disabled through `DisabledWrite` + `disabledWriteClassName` from
   `@tas/ui`, tooltip "Sign in required to save changes", and `saveCopy` refuses before any
   validation, actor lookup or connection, returning a typed result carrying `DEMO_MUTATION_REFUSED`
   and never throwing (copy `personas/actions.ts` exactly).
10. `loadCopy()` in `apps/web/src/lib/copy-source.ts` copies `personas-source.ts`: demo mode reads
    `demoCopy` from `@tas/db` and constructs **no** database client even when `DATABASE_URL` is set;
    live mode opens Neon per call and closes it in a `finally`. A connect-spy unit test proves the
    demo branch never calls `connect`.
11. `listCopy(db, brandId)` in `packages/db/src/copy.ts` is brand-scoped through `withBrand`, joins
    the brief for its name with a LEFT JOIN so a row with `brief_id: null` is still returned, and
    orders by `updated_at` descending. A db test on PGlite covers both the linked and the unlinked
    row and asserts another brand's copy is never returned.
12. `demoCopy` in `packages/db/src/demo-data.ts` has exactly **4 rows**, each with a hardcoded uuid
    and fixed timestamps so demo rows and `seed(db)` rows are identical. Three link to existing
    `demoBriefs` ids (reusing their constants, not new literals) and one has `briefId: null`; at
    least three different `COPY_STATUS` keys and three different CTAs appear across the set.
13. Colours go through the token layer only (no hex), rounded controls use `rounded-input` /
    `rounded-card`, no button is `rounded-full`, every status label is a `StatusChip`.
14. `tsc --noEmit` and vitest are clean for `@tas/web`, `@tas/db` and `@tas/domain`, and
    `apps/web/e2e/copywriting.spec.ts` covers: four rows with the four columns, a row opening the
    panel with its four copy fields, Linked Creative being a select of brief names (not a text
    input), the unlinked row showing the em dash, and save disabled in demo mode.

Out of scope: Client's Comment, creating or deleting a copy row, CSV upload, AI spell check,
filtering, sorting, pagination, any change to the Creative Briefs page.

## Files each agent touches

- schema/db: `packages/db/src/schema/{enums.ts (copyCtas),copy.ts,index.ts}`, a generated migration
  in `packages/db/drizzle`, `packages/db/src/{demo-data.ts,copy.ts,copy.test.ts,index.ts,seed.ts}`
- domain: `packages/domain/src/state/{copy-status.ts,copy-status.test.ts,index.ts}`,
  `packages/domain/src/copy/{copy-name.ts,copy-name.test.ts,index.ts}`, `packages/domain/src/index.ts`
- app: `apps/web/src/lib/copy-source.ts` + `copy-source.test.ts`,
  `apps/web/src/app/app/copywriting/{page.tsx,copywriting-workspace.tsx,copy-panel.tsx,fields.ts,actions.ts,actions.test.ts}`,
  `apps/web/src/lib/routes.ts` (`copywritingPath`), `apps/web/src/components/shell/nav.ts`
- qa: `apps/web/e2e/copywriting.spec.ts`

## Gated criteria

None. Every criterion runs locally in demo mode (no Clerk key, no database); db tests run on PGlite.
