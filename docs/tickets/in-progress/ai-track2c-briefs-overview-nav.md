# Sep 28 action items, Track 2 / Area C — briefs UI, Overview, role-scoped nav

Source of the items: the Sep 28 dev-sync action list, as audited in
[`docs/audits/action-items-status-2026-10-02.md`](../../audits/action-items-status-2026-10-02.md).
The item numbers below (AI-nn) are that file's numbering.

Six items plus one shared-primitive extraction. They are **separate tickets on purpose**: measured
together the area is **+502 / −98 non-test lines** (`git diff --numstat` over the non-test files,
doc-comment prose included), over the 300-line ceiling in CLAUDE.md's Definition of Done, and the
remedy that line names is to split the ticket. Each ticket below is independently reviewable and
carries its own PRD section and its own acceptance criteria. An exact per-ticket line count is NOT
claimed here, because several files (`briefs-workspace.tsx`, `creative-design/page.tsx`) carry two
items at once; the principal files are named instead, and the largest single ticket by a long way is
AI-54 at roughly 120 non-test lines.

| Ticket   | PRD        | Scope                                                             | Principal files                                        |
| -------- | ---------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| AI-59    | §9, §7     | The editor board's first column is named by track                 | `domain/state/editor-board.ts`, board headings, stories |
| AI-49    | §5.10      | Briefs grid: Due date, Created, rows colour-coded by stage        | `creative-design/fields.ts`, `briefs-workspace.tsx`    |
| AI-54    | §5.10      | A brief inherits its persona through its angle (read-only)        | `db/src/briefs.ts`, `[briefId]/brief-detail.tsx`       |
| AI-8     | §13        | "Angles in library" comes off every Overview                      | `lib/dashboard-source.ts`, `app/app/page.tsx`          |
| AI-48    | §13, §5.10 | The pipeline strip at the top of the Creative Briefs page         | `creative-design/page.tsx`, `lib/dashboard-source.ts`  |
| AI-57    | §11        | The sidebar lists only what the viewer's role should see           | `shell/nav.ts`, `shell/sidebar.tsx`, `app/layout.tsx`  |
| AI-UI-01 | —          | ONE tone→stripe map in `@tas/ui`, read by the board and the grid  | `ui/src/status/tone-stripe.ts`, `views/kanban-board.tsx` |

Nothing here is a schema change: no migration is generated, and no database is touched.

---

## AI-59 — the editor board's first column is named by track

**PRD §9** (the two approval tracks: this names the first step of the INTERNAL track) and **§7**'s
rule that system output is never hand-typed — the column heading is read from the domain, never
written in a component.

`EDITOR_STAGES[0]` read `Incoming`, which says nothing about who is waiting. Talal asked for
"Sent to Editor" on a video brief and "Sent to Designer" on a static/design brief. One constant
cannot hold two words, so the per-brief reading is a pure function and the stage keeps a neutral
label for the both-tracks case.

- `packages/domain/src/state/editor-board.ts`: `editorStageLabelFor(stage, track)` and
  `editorStageColumnLabel(stage, tracks)`; `EDITOR_STAGES[0].label` becomes the neutral
  "Sent to Editor / Designer".
- `briefs-workspace.tsx` column headings and the detail page's stage chip read those functions.

### Acceptance criteria

- [x] The stored status keys are untouched: `sent_to_video_editor` / `sent_to_designer` still are
      what rows carry and what `canTransitionInternal` grades. This is a label, not a transition.
- [x] Unit tests over BOTH tracks, the mixed column, the empty column and every other stage
      (`editor-board.test.ts`).
- [x] The column heading and the detail page's chip both come from the domain; no component
      composes the word.
- [x] UI governance rule 4: both readings render on `/design-system` (`EditorStageChipsStory`), and
      the Section's title and note describe the renamed board.
- [x] `briefs-editor.spec.ts` updated — the demo fixture in the first column is a carousel, which
      `creativeTrack` grades static, so the column and the chip read "Sent to Designer".

## AI-49 — briefs grid: Due date, Created, rows colour-coded by stage

**PRD §5.10** (Creative Briefs — the fields the internal sheet shows).

`BRIEF_COLUMNS` showed six columns and neither date, though the detail page already edits the
`due_date` migration 0043 added.

- `fields.ts`: `Due date` and `Created` appended to `BRIEF_COLUMNS` (appended, not interleaved, so
  the six keep the places every reader has learnt); `briefDateLabel` prints UTC `YYYY-MM-DD` or the
  em dash; `briefStageStripe` maps a stored status to its stage's stripe class.
- `briefs-workspace.tsx`: the two cells, and `border-l-4` + the stage's stripe on the row.

### Acceptance criteria

- [x] Both dates are formatted on the server in UTC, so a server render and its hydration cannot
      disagree; unset reads the em dash, never an empty cell.
- [x] The row stripe is a semantic token class from the token layer (`border-l-ok`, …) — no hex, no
      arbitrary value; asserted by `fields.test.ts` and by `briefs.spec.ts`.
- [x] A brief off the editor board is painted muted rather than left unpainted.
- [x] Unit tests for `briefDateLabel` and `briefStageStripe`; `briefs.spec.ts` asserts the eight
      headers, the mono dates and the 4px stripe on every row.

**Deliberately NOT done:** the item also asked for a submission count per brief. There is no such
datum — see "Open, needs a product decision" below.

## AI-54 — a brief inherits its persona through its angle

**PRD §5.10**: "Concept (link) → auto-fills Batch, Angle, Persona, Product".

`BriefListRow` carried `conceptName`, `angleName` and `productName` and nothing resolved
`angle_personas`.

- `packages/db/src/briefs.ts`: `reachableAngleIds` follows the brief's OWN `angle_id` and every
  angle hanging off its concept; `personaNames` is the deduped list of personas those angles argue
  to, scoped by brand.
- `brief-detail.tsx`: a read-only `Persona` fact, beside the Angle it came through, in a four-column
  grid so the chain concept → angle → persona reads on one row.

### Acceptance criteria

- [x] NOTHING is stored: `creative_briefs` gains no persona column, because the persona is a
      property of the angle and a copy would go stale when the angle is re-targeted.
- [x] A LIST, not a single name — `angle_personas` is many-to-many — and empty rather than null when
      there is nothing to reach (standalone brief, angle with no persona, out-of-scope link).
- [x] PGlite tests: inheritance through the concept, through the brief's own angle, the empty case,
      and that another brand's persona is never reached through a shared angle id.
- [x] `briefs.spec.ts` asserts the rendered value, that there is no input for it, and the em dash on
      a standalone brief.

**Note for the reviewer:** `angleName` and `productName` still follow the concept's FIRST angle and
that angle's first product. Widening them would change a value the brief page already displays, so
they were left exactly as they were; only the new field reads every reachable angle.

## AI-8 — "Angles in library" comes off every Overview

**PRD §13** (the overview dashboard: pending work per role).

The tile was emitted by `csmItems`, which `adminItems` spreads and `client` aliases, so it rendered
on three overviews; the Library block on `/app` also counted Angles.

- `dashboard-source.ts`: the tile is gone from `csmItems` (it counted CONCEPTS under an "Angles"
  label besides).
- `apps/web/src/app/app/page.tsx`: the Angles card is gone from the Library block, and the grid's
  track count comes down from four to three with it so the row has no orphan cell.

### Acceptance criteria

- [x] The tile is absent from the CSM, Admin AND client sets — asserted as an absence on all three
      in `dashboard-source.test.ts`.
- [x] The Library block keeps its card shape and its three remaining counts; only the track count
      changed, because a four-track row holding three cards is itself a layout change.
- [x] `/app/angles` is still in the sidebar: the COUNT was the noise, not the section.

## AI-48 — the pipeline strip at the top of the Creative Briefs page

**PRD §13** and **§5.10**.

The eight metric cards and the stage chart existed only on `/app`.

- `creative-design/page.tsx` loads `loadOverviewContext()` — the Overview's concepts, copy and
  creators — beside the briefs it already reads, then calls the Overview's own pure
  `buildOverviewPanels(role, rows, context)`.
- `briefs-workspace.tsx` renders the existing `MetricCards` and `PipelineChart`.

### Acceptance criteria

- [x] The same components and the same builders the Overview uses; nothing is counted twice and no
      counting logic is duplicated into the page.
- [x] `creative_briefs` is read ONCE per render. `loadBriefs` is not request-memoised, so
      `loadOverviewPanels` (which loads briefs itself) is deliberately NOT called here — the page
      hands its own rows to the pure builder instead.
- [x] The cards count every brief of the brand, not the `?status=`-filtered list, and keep their
      click-through to this page's own filtered list.
- [x] `briefs.spec.ts`: the strip is above the list, eight cards, the chart's counts sum to the
      brief count, and a card click filters in place and leaves the cards counting everything.

## AI-57 — the sidebar lists only what the viewer's role should see

**PRD §11** (roles, brands and access).

`NAV_SECTIONS` took no role, so a video editor saw Concepts, Products and Angles.

- `nav.ts`: `SECTION_KEYS_BY_ROLE` plus `navGroupsForRole` / `navSectionsForRole` (pure, tested).
- `app/layout.tsx`: `loadActiveRole()` joins the shell's existing `Promise.all`; `sidebar.tsx` takes
  `role` and maps `navGroupsForRole(role)`.

### Acceptance criteria

- [x] An editor (video_editor AND designer) is shown Creative Design and nothing else; admin, CSM,
      strategist, media buyer and client keep the whole rail, as the same object.
- [x] A group that filters to nothing is dropped, so no empty heading renders.
- [x] The role comes from `loadActiveRole` — the one the Overview draws its dashboard for — not from
      a second source of truth, and the rail and the dashboard therefore cannot disagree.
- [x] Unit tests: the editor's rail, the named regression (no concepts/products/angles), the
      unchanged roles, the dropped group, and that no role's rail invents or resorts a section.
- [x] Demo mode answers `admin` without a connection, so every demo Playwright spec still sees the
      full rail.

**Out of scope, and stated in the module header so no one mistakes it:** this is the RAIL, not
access control. `/app/concepts` is still served to an editor who types the URL — there is no
per-role route guard in the tree yet (the only `requireAdmin` is local to the propagation actions).
Route-level protection is the follow-up this filter does not substitute for.

## AI-UI-01 — one tone→stripe map

Not an action item: the two items above both needed a left stripe, and `fields.ts` had copied
`kanban-board.tsx`'s private `ACCENT_STRIPE` byte for byte. Two tone→class maps drift the moment a
tone is added or a token is renamed, which is what UI governance rule 3 forbids for the pill itself.

- `packages/ui/src/status/tone-stripe.ts`: `TONE_STRIPE` / `toneStripe`, beside `StatusChip`.
- `kanban-board.tsx` and `creative-design/fields.ts` both read it; neither holds a map.

### Acceptance criteria

- [x] One map in the product; `grep ACCENT_STRIPE` finds nothing.
- [x] Typed `Record<ChipTone, string>`, so a new tone in the domain cannot be forgotten.
- [x] Unit test: every tone has a `border-l-*` token class and nothing is a hex, an `rgb()` or an
      arbitrary value.

---

## Open, needs a product decision (not implemented)

- **AI-49, the submission count.** The item asked the briefs grid to show how many submissions a
  brief has. `packages/db/src/schema/briefs.ts` has no such column and no table counts one, and
  "submission" is ambiguous in this schema — an editor's `ad_submitted` transition, a row in
  `creative_sheet_items`, an uploaded design file, or a revision round. Inventing either the datum
  or the definition would be a guess. Needs: Talal's definition of a submission, then a schema field
  (or a counted junction) and a migration.
- **AI-9, cross-client role overviews** (ticket P3-2). Explicitly out of scope for this area: it is
  an aggregate across brands, which is its own ticket and larger than any change here.

## Pending human verification

- Playwright is run per branch by the orchestrator; the demo specs above were updated but not
  executed in this worktree (one shared port).
- Live mode (Neon + Clerk) for AI-57: confirm that a real `video_editor` membership resolves through
  `loadActiveRole` and that the rail collapses to Creative Design for that account. No credentials
  exist on this machine, so only the demo/`admin` path was exercised.
