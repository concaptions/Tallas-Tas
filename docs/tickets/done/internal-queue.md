# Internal Queue · Kanban of the internal approval track (PRD §9, §13)

- Page: `/app/queue/internal`, sidebar section `internal-queue` (Approvals group, currently `SoonChip`)
- Pattern: Briefs list for the source + `?` filter, Concepts for the board cards. Depends on `demoBriefs`, `@tas/domain/state`, `@tas/ui`

## Why

PRD §9: "**Internal Status** (our team only, client never sees it): Sent to Designer → Static Design in Progress /
Sent to Video Editor → Video Editing in Progress → (On Hold) → Ad Submitted → Images Revisions / Videos Revisions →
Revisions Submitted → Approved → LAUNCHED". PRD §13: an overview "where each role can see their pending tasks…
per team member, as of what their assigned, and pending tasks."

## Acceptance criteria

1. `/app/queue/internal` renders inside the app shell with no frame, padding or background of its own; `internalQueuePath`
   lands in `apps/web/src/lib/routes.ts` and the `internal-queue` section in `nav.ts` gets that `href` in the same change,
   its `SoonChip` disappears, and the section is active on the page. The page is a server component shaped like
   `app/app/briefs/page.tsx`: it resolves every label and tone through the domain and hands a plain item array down.
2. The board is a horizontal row of columns, one per internal status, in the PRD §9 order, each column headed by the status
   `label` from `@tas/domain/state` plus a count. Columns come only from a pure, unit-tested `internalQueueColumns()` in
   `packages/domain/src/state/queue-columns.ts`: the union of `INTERNAL_VIDEO_STATUS` and `INTERNAL_STATIC_STATUS` with the
   four shared keys (`ad_submitted`, `revisions_submitted`, `approved`, `launched`) appearing once, the track-specific
   entries kept in §9 order, and `ON_HOLD` last. No component lists a status, compares one to a literal or orders them.
3. Every seeded brief appears in exactly one column, chosen by its stored `internalStatus`. A column with no brief still
   renders, with a count of 0 and a muted empty note — a queue that hides its empty stages hides the work that is not moving.
4. A card (`data-slot="queue-card"`) shows, in order: the creative **name** in `font-mono`, a **thumbnail**, the **assignee**,
   and a **priority chip** rendered with `StatusChip` through the existing `priorityView` from `apps/web/src/app/app/briefs/fields.ts`
   (imported, never re-implemented). A brief with no priority shows no chip, never a blank pill.
5. The thumbnail is built by a pure, unit-tested `briefThumbnail({ name, designFileUrl, inspoLinks })` in
   `packages/domain/src/creatives/thumbnail.ts`: it returns a labelled tile (provider label from `inspirationLink` when a
   link exists, otherwise the name's leading token) drawn entirely from the token layer. No image is fetched, no new fixture
   column is added, and a malformed or absent URL degrades to the tile rather than throwing.
6. Clicking a card — or pressing Enter/Space on it — navigates to `briefPath(id)` (`/app/briefs/<id>`), the real Creative Brief
   detail page. Back returns to the board with the current filter intact.
7. One filter control, URL-backed in `?view=`: `mine` (briefs assigned to the viewer), `all` (default, no param written), and
   `brand:<brandId>` for a named brand. The value is parsed by a pure, unit-tested `parseQueueView(param)` in
   `apps/web/src/app/app/queue/internal/fields.ts` that returns `all` for anything unknown, so a hand-edited URL never throws.
   Selecting a view rewrites the address with the History API exactly as `briefs-workspace.tsx` writes `?q=`; a reload restores
   the same board and the URL is shareable.
8. Brand options are derived from the loaded rows (`brandId`, labelled with the brand name from `currentBrand()`), never a
   hardcoded list. Demo mode has one brand, so the control offers that one brand and says so rather than listing a brand with
   no briefs behind it.
9. "Mine" is a pure, unit-tested `assignedToViewer(assignee, viewerName)` comparison (trimmed, case-insensitive); the option
   label names the viewer so nothing is implied. In demo mode the viewer resolves to `DEMO_QUEUE_ASSIGNEE` in
   `apps/web/src/lib/demo-mode.ts` — one constant naming a seeded assignee, NOT a new fixture and NOT a change to `DEMO_ACTOR` —
   so "Mine" shows real cards; in live mode it is the actor's full name from `currentActor()`.
10. The board reads the 6 seeded briefs through the existing `loadBriefs()` in `apps/web/src/lib/briefs-source.ts`. No new
    fixture, no new demo-data row, no new query: `packages/db/src/demo-data.ts` and `packages/db/src/briefs.ts` are untouched.
11. Every write is absent, not faked. There is no drag-and-drop, no status advance and no "New brief" on this page; nothing on
    the board mutates. If any control is added it goes through `DisabledWrite` + `disabledWriteClassName` from `@tas/ui` with a
    tooltip, and its action refuses with a typed result before any validation or connection, never throwing.
12. Colours, radii and fonts come from the token layer only — `bg-surface2/3`, `border-line`, `text-text2/3`, `rounded-card`,
    `rounded-input`, `font-mono` — no hex in a component, no `rounded-full` button, every chip a `StatusChip`. The column strip
    scrolls horizontally on a narrow viewport and never forces the shell into a horizontal page scroll.
13. The card and the column are rendered on `/design-system` as a story module the page mounts, before the ticket is Done.
14. `tsc --noEmit` and vitest are clean for `@tas/web` and `@tas/domain`, and `apps/web/e2e/internal-queue.spec.ts` covers:
    every column present in §9 order with its count, six cards across the board, a monospace name plus thumbnail, assignee and
    priority chip on one card, a card click landing on `/app/briefs/<id>`, and `?view=mine` narrowing the board and surviving a reload.

Out of scope: the client queue and client track, drag-and-drop or any status transition, role-based dashboards and per-role
counts (PRD §13 cards), notifications, the brand switcher, new fixtures, CSV upload, performance data.

## Files each agent touches

- domain: `packages/domain/src/state/{queue-columns.ts,queue-columns.test.ts,index.ts}`,
  `packages/domain/src/creatives/{thumbnail.ts,thumbnail.test.ts,index.ts}`
- app: `apps/web/src/app/app/queue/internal/{page.tsx,internal-queue-board.tsx,queue-card.tsx,fields.ts,fields.test.ts}`,
  `apps/web/src/lib/routes.ts` (`internalQueuePath`), `apps/web/src/lib/routes.test.ts`,
  `apps/web/src/lib/demo-mode.ts` (`DEMO_QUEUE_ASSIGNEE`), `apps/web/src/components/shell/nav.ts`,
  `apps/web/src/app/design-system/stories/queue-card.stories.tsx`
- qa: `apps/web/e2e/internal-queue.spec.ts`

## Gated criteria

None. Every criterion runs locally in demo mode (no Clerk key, no database, no new fixture); the board reads `demoBriefs`
through the existing `loadBriefs()`.

## Why this feature ships no Server Action (backend, criterion 11)

`apps/web/src/app/app/queue/internal/` contains no `actions.ts`, deliberately. The Internal Queue is a
READ of `creative_briefs`, not a second place to edit one. Criterion 11 puts drag-and-drop, status
advance and "New brief" out of scope, and criterion 10 forbids a new query, so the page has nothing to
write: every card links to `briefPath(id)`, and a status moves on the brief's own detail page where the
transition, its validation and its domain function already live. An action here would be a second write
path onto the same column — the thing CLAUDE.md's "Every mutation goes through a domain function" rule
exists to prevent — and in demo mode it would be an always-refusing stub with no caller.

"Absent, not faked" is the point of the criterion: there is no disabled button whose tooltip promises a
save that was never built. `DisabledWrite` + `disabledWriteClassName` and the typed
`{ ok: false, error: DEMO_MUTATION_REFUSED }` refusal stay ready in `@tas/ui` and
`apps/web/src/lib/demo-mode.ts` for the first control this board ever gains; until then the demo-mode
guarantee this route has to keep is the READ one, and that is what
`apps/web/src/lib/internal-queue-source.test.ts` proves with an injected connection factory that throws.
