# P2A — Airtable-like Grid + Gallery views across 6 data tables

**Role**: frontend · **PRD**: §views (Sprint 5 multi-view) · **Est**: L · **Blockers**: none

## Context / current state
Sprint 5 already shipped `view-switcher.tsx`, `gallery-view.tsx`, `kanban-board.tsx`,
`timeline-view.tsx` (`apps/web/src/components/views/`). View persistence is per-user
(Sprint 5). This ticket makes **Grid** truly Airtable-like and confirms Gallery, on the
6 data tables: Products, Personas, Angles, Themes, Concepts, UGC Management.

## Sub-tickets
### P2A-1 Reusable `<AirtableGrid>` component (DONE — component only, no live page touched)
- [x] `components/views/airtable-grid.tsx` — full-width, `overflow-x-auto`, `min-w-max`, frozen primary column (`sticky left-0`), inline `render` per column, click-to-sort headers, Fields menu (`DropdownMenuCheckboxItem`) to show/hide columns
- [x] Column visibility remembered per viewer (localStorage, guarded for SSR/private/node) — `airtable-grid-logic.ts`
- [x] Pure logic unit-tested (`airtable-grid-logic.test.ts`, 6 tests); `/design-system` story added (grid + empty)
- [x] typecheck 6/6, lint clean, test 1970
- [ ] **Visual confirmation pending deploy** — verify freeze/scroll/Fields on the deployed /design-system page

### P2A-2..7 Wire per table (FOLLOW-ON — one sub-commit each, ≤300 LOC)
- [ ] Products, Personas, Angles, Themes, Concepts, UGC: replace the bespoke inline `<Table>` with `<AirtableGrid>` + a per-table column config; make Grid the default view
- [ ] Gallery on all 6 (UGC card image = profile pic); List unchanged; Kanban only on UGC
- [ ] Per-table column configs pass sortValue + inline renderers (badges/link-counts/checkbox icons)

## Notes
Do P2A-2+ only after the grid is visually approved on the deployed design-system page.

## Notes
Import colours/fonts/radii from the token layer; status values from `@tas/domain/state`;
reuse `StatusChip`/`StepRow` (UI governance). Split into sub-tickets if the diff exceeds
300 LOC (e.g. Grid freeze+scroll; Grid field controls; Gallery card config).
