# P2A — Airtable-like Grid + Gallery views across 6 data tables

**Role**: frontend · **PRD**: §views (Sprint 5 multi-view) · **Est**: L · **Blockers**: none

## Context / current state
Sprint 5 already shipped `view-switcher.tsx`, `gallery-view.tsx`, `kanban-board.tsx`,
`timeline-view.tsx` (`apps/web/src/components/views/`). View persistence is per-user
(Sprint 5). This ticket makes **Grid** truly Airtable-like and confirms Gallery, on the
6 data tables: Products, Personas, Angles, Themes, Concepts, UGC Management.

## Acceptance criteria
- [ ] Grid view is the DEFAULT for all 6 tables
- [ ] Grid: full-width (no wasted side margins), horizontal scroll with all columns, freeze the primary/name column (min), inline cell display (no click-to-open)
- [ ] Grid: show/hide fields toggle, filter + sort controls, grouping option
- [ ] Gallery works on all 6; UGC uses creator profile pic as the card image; customizable card fields
- [ ] List view unchanged (sidebar-open-on-click)
- [ ] Kanban only on UGC (process table) among these 6; no Kanban on the other 5
- [ ] Per-user view persistence verified (no cross-user bleed); underlying data shared
- [ ] `/design-system` stories updated; typecheck/lint/test green

## Notes
Import colours/fonts/radii from the token layer; status values from `@tas/domain/state`;
reuse `StatusChip`/`StepRow` (UI governance). Split into sub-tickets if the diff exceeds
300 LOC (e.g. Grid freeze+scroll; Grid field controls; Gallery card config).
