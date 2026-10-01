# Sprint 7 — Airtable-style grid on the six core tables (GRID-01 … GRID-06)

**PRD sections**: §5.1 (Products), §5.2 (Personas), §5.6 (Angles), §5.5 (Themes), §5.7 (Concepts),
§5.8 (UGC Management). Design: `handoff-design.md` P2A (full-width grid, frozen primary column).

## Goal

Every one of the six tables opens on the shared `<AirtableGrid>` (`apps/web/src/components/views`)
the way Airtable does: every stored column visible without opening a row, horizontal scroll inside
the grid, the name column frozen, full page width. A row click opens the table's existing side panel
(or detail route for Concepts); archive/restore and every other write is unchanged.

One ticket per table, one commit per table:

| Ticket  | Table    | What changed |
| ------- | -------- | ------------ |
| GRID-01 | Products | linked-record counts as columns (angles, concepts, designs, creators, campaigns, copy) |
| GRID-02 | Personas | product, linked angles and every panel prose field as columns |
| GRID-03 | Angles   | plain `Table` → `AirtableGrid`; status, potential, winning, formats, type, prose, URLs |
| GRID-04 | Themes   | card grid → `AirtableGrid`; new `ThemePanel` (`?theme=`) hosts the labelled card + Archive/Restore; assignee reads as plain text, never "null" |
| GRID-05 | Concepts | client status, approval status, category, style, formats, prose, collection, counts (Production Status hidden) |
| GRID-06 | UGC      | card grid → `AirtableGrid`; avatar inside the frozen name cell; every creator column; Kanban and Gallery kept |

## Acceptance criteria

- [x] All six tables default to Grid; the `ViewSwitcher` still offers Kanban / Gallery where the
      table capability lists them (`packages/domain/src/views/table-views.ts`).
- [x] The grid scrolls horizontally inside its own box (`overflow-x-auto`), never the page; the
      first (name) column is `position: sticky` — asserted by each table's Playwright spec.
- [x] Every stored column of the record is a grid column (`thead th` lists pinned in the specs).
- [x] Row click opens the existing side panel (Products, Personas, Angles, UGC), the new Themes
      panel, or the Concept detail route; the open record stays in the URL.
- [x] Themes: `assignee_id` holding an imported Airtable collaborator name renders as plain text;
      a literal `"null"` renders the dash (`textValue`, `assigneeValue`, unit-tested).
- [x] Shared cell primitives (`grid-cells.tsx`) and the Themes panel render on `/design-system`.
- [x] `pnpm typecheck`, `pnpm lint` (zero warnings), `pnpm test` pass.
- [x] Playwright specs for the six pages updated and passing (summaries in the session log).

## Pending human verification

- Live mode: the Themes panel's Archive / Restore form against Neon (demo mode disables it).
