# TAS Sprint Oct 12 — Phase B summary (2026-10-14)

Phase B1 (UI, no schema) is complete and on `origin/main` as of commit `5eb8523`. Phase B2 (schema,
operator), B3 (big builds) and B4 (blocked on Talal) are each queued and need the human to hand down
their scope — the Phase B prompt pointed at them by number but their descriptions were not committed
to the repo. See **Open items** at the bottom.

## What shipped in Phase B1

Six tickets, 24 commits on `main` (`0500b3a..5eb8523`), four gates green at every push
(`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter @tas/web build:ci`).

### Ticket 0 — UI overhaul foundation (the six boards) — 3 commits

- `0500b3a` feat(ui): add missing semantic tokens from ZIP designs
- `c392758` feat(creative-sheet): match ZIP designs for Focus Mode, Sidebar, Multi-select, QA gate,
  Activity log, Vocabulary
- `e93b5a0` docs(sprint-oct12): close UI gap report

Added `--on-accent`, `--on-ok`, `--shadow-float`, `--shadow-sheet` tokens across all four theme
blocks; the new `@tas/ui/icons` subpath (lucide-react canonical names); the `Checkbox`,
`SectionLabel`, `DisabledWrite` popover, `Button` success variant primitives; `formatSheetDate`
('18 Oct 2026') and `formatCommentStamp` ('10 Oct, 3:42 PM'); every creative-sheet and brief-page
surface restyled pixel-for-pixel against the 2026-10-13 UI bundle.

### Ticket 7 — Group-by on all data tables — 5 commits

- `6b571e8` feat(views): GroupByControl offers only groupable columns
- `d84da97` feat(tables): the seven tables offer only groupable columns; Copywriting sorts
- `1216c5e` feat(creative-sheet): join the per-user views; the Kanban picker is a GroupByControl
- `9dfbcf8` feat(views): status group headers wear the StatusChip; booleans group as Yes/No
- `bbab582` docs(sprint-oct12): Ticket 7 decisions, sprint entry, review fixes

Shared `GroupByControl` replacing the earlier `GroupMenu`, `groupableFields(columns)` so every
table offers only the columns it can bucket under, status headers rendered as `StatusChip`,
booleans grouped under Yes/No. Per-user per-view persistence through `user_table_views.group_by`
(Sprint 7 schema) now reaches the Creative Sheet too; the Kanban field persists through
`user_view_preferences` + `?groupBy=`.

### Ticket 8 — Multi-select + right-click on every data grid — 6 commits

- `0461fb0` feat(db): brand-scoped soft-delete writers for six tables
- `a9b88a9` feat(views): useGridSelection + GridSelectionOverlay
- `65d444f` Ticket 8 (part 2): Angles, Themes, Personas, Products
- `2bf7aae` Ticket 8 (part 3): UGC Pool and Copywriting
- `77723c2` Ticket 8 (part 4): Concepts, both status tracks
- `a1ddd0e` Ticket 8 (part 5): sheet parity — a selection survives the search filter

`softDelete*` writers for angles / personas / products / concepts / creators / copy; themes stay
GLOBAL (archive-restore only via `extraActions`, no delete, no activity logging). The shared
`useGridSelection` hook + `GridSelectionOverlay` carrying the SAME multi-select UX the Creative
Sheet drew. Concepts' two status tracks re-run the SAME `clientGateRefusal` /
`clientMoveRefusal` / `internalMoveRefusal` the single-row save runs — the pure helpers moved to
`concepts/status-guard.ts` because a `'use server'` module may only export async functions. The
adversarial review's one confirmed finding (sheet parity: every page passes the brand's whole row
set, not the search-narrowed one, to the hook) was fixed in commit `a1ddd0e`.

### Ticket 9 — Sheet sidebar on row click for Concepts, Personas, Angles, Copywriting — 4 commits

- `34f40c1` Ticket 9 (part 1): a shared record sidebar for every data grid
- `13a56f6` Ticket 9 (part 2): Personas and Angles ride the shared record sidebar
- `bbc5d52` Ticket 9 (part 3): Concepts and Copywriting ride the shared record sidebar
- `fe454a1` Ticket 9 (part 4): reconcile the four specs with the shipped sheet layout

Shared `RecordSheet` (prev/next walk the grid's `onScreenOrder` list, sort + group aware, keyboard
ArrowLeft/Right that ignore text inputs and selects), `recordNavigation`, `onScreenOrder`,
`ReadOnlyFields`. The four pages carry their forms unchanged (`useActionState`, Status chips, the
pending-create flow on Copywriting, the demo-note slot); only the SHELL changed. Concepts gained a
read-only sidebar on row click; "Open full page" stays on the right-click menu for the detail
route. 39/42 Playwright tests pass on the four specs; the three remaining failures
(`concepts.spec.ts:286, 385, 407`) are SMOKE-31 drifts the baseline carried into the sprint.

### Ticket 13 — Creator Pool as a top-level nav + two-way brand link — 2 commits

- `ae060f8` Creator Pool as a top-level nav section (PRD §5.8, Oct 8 Talal sync)
- `8fb4981` two-way link — "In other brands:" chip row on the UGC creator panel

New `/app/creator-pool` route under Production, right after UGC Management, with a `sectionGuard`
on `creator-pool` (admin / CSM / strategist / media buyer). The server page loads every registry
creator and their brand history in one connection. The per-brand UGC creator panel grows the
"In other brands:" chip row above the stats block.

Deferred to a follow-up: the full `AirtableGrid` + `useGridSelection` + `RecordSheet` workspace
for the pool (card presentation shipped instead — would have broken the 300-LOC-per-commit cap).

### Ticket 14 — UGC gallery polish — 2 commits

- `9ac859a` profile pic card at the top of the creator panel
- `5eb8523` brand history timeline, scrollable showcase videos

New `creator-profile-card.tsx` and `brand-history-timeline.tsx` primitives, each mounted on
`/design-system`. The showcase videos layout flipped from a 2-column grid to a horizontally
scrollable snap strip (`snap-x snap-mandatory`, 224/256 px cards). The timeline reads the same
`loadRegistryBrandHistory` result the Ticket 13 chip row reads, so no second round trip for the
open creator.

## Open items (Thursday sync)

1. **Phase B2 (schema, needs operator): Tickets 6, 10, 11** — the Phase B prompt listed them by
   number alone. Their scopes and the exact migration shape (what the column is, which brand it
   lives on, which readers it must survive) are not in the repo. **Hand over the three ticket
   descriptions**; this session can author the SQL and `applyNN.mjs` without running them, so the
   operator can apply on Railway in the window of their choice.
2. **Phase B3 (big builds): Tickets 3, 10 (full), 12** — same gap. Each is a larger diff than the
   300-LOC-per-commit rule allows unsplit, so planning them end-to-end (file list, commit split,
   dependency order) needs the brief.
3. **Phase B4 (blocked on Talal): Ticket 16** — the client-vocabulary question
   (keep the six-key `CLIENT_STATUS` from AUDIT-13 or switch to the brief's four values). Noted
   in `docs/sprint-oct12.md` → "Blockers and decisions the human owns".
4. **Pre-existing e2e drifts, three of 42 on the Ticket 9 specs**: SMOKE-31 renamed
   `concept-name-preview` → `concept-name` for existing (manual-named) concepts, removed the
   `concept-client-status` and `copy-client-status` sections, and shut the client-track bar on an
   `internalOnly` rail. The specs still check the old shape at `concepts.spec.ts:286, 385, 407`
   and `copywriting.spec.ts` (`copy-client-status` was deleted by Ticket 9's part 3). One repair
   session, no product code. Flagged in the "Follow-ups" section of `docs/sprint-oct12.md` since
   2026-10-13.
5. **Ticket 13 deferred full-grid workspace**: `creator_registry` AirtableGrid + bulk soft-delete
   + column registry + PGlite tests. ~400 LOC, listed as a follow-up on Ticket 13's hand-back.
6. **A locked git worktree from the Ticket 8 commit-2 agent** (`agent-af13c795bb585bc67`) remains
   on disk; the lock holder PID is gone but the lock file was never removed. `git worktree remove
   -f -f` on next hands-on session will clear it; nothing else references the branch.

## Scope — a tally for the sync

- 24 commits · 22 feature / 2 docs.
- Six tickets closed in Phase B1; three phases still queued (B2, B3, B4).
- Four gates green at every push.
- Full test suite ran green on every ticket's final commit; 3984→3986 vitest tests across the window.
- Playwright coverage: angles, themes, personas, products, concepts, ugc, copywriting,
  creative-sheet, creator-pool, design-system — the sprint added or amended an e2e spec for every
  touched surface.
- No migrations applied on Railway in Phase B1.
- No new dependencies or hosted services.
