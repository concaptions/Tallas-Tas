# Sprint Oct 12 — status log

Ticket index: `docs/tickets/in-progress/sprint-oct12-client-sync.md`. One entry per ticket, in the
order they were worked; blockers and the decisions the human owns are at the bottom.

## Phase A

### Ticket 1 — Collections removal, Products relabel, freeze + grep guard — DONE

- **Nav / route**: `collections` is in `REMOVED_WORKSPACES` (`packages/domain/src/team/access.ts`)
  with a new redirect target `products`; `/app/collections` and every address under it permanently
  redirect to `/app/products` through the segment's `sectionGuard` layout. The sidebar never offers
  Collections on any brand or role (the catalogue entry stays, hidden, as every Oct 7 retirement does:
  `nav.test.ts` requires each retired key to keep its href so an old URL still resolves); the Products
  entry reads "Products / Landing Pages".
- **Copywriting**: the Linked Collection select, its hidden input, the chip and the reverse-read list
  are removed from `copy-panel.tsx`; `updateCopyAction` no longer accepts `collectionId` nor calls
  `setCollectionCopywritingLinkInBrand`; the three grid renderers (`collections`, `collection_url`,
  `products_from_collections`) and the `CopyLookupCollection` read are removed. A copy links to a
  Creative and a Product only.
- **Brief / concept / sheet**: the brief page's Collection fact, the `collection_id` grid renderer,
  the concept rail's Collections section, the `concept_collections` grid renderer and the Creative
  Sheet's `Collection` lookup (grid and sidebar) are removed.
- **Products**: eyebrow and h1 "Products / Landing Pages"; form label "Product Name / Landing Page
  Name" (the grid header already carried the seeded label).
- **Freeze**: `packages/db/src/schema/collections.ts` carries the deprecation comment (as of Oct 12);
  `collections` is in `FROZEN_PROPAGATION_TABLES` (no seed, no row propagation, no resync); the six
  seeded columns that read the table are `is_hidden` on every brand through
  `RETIRED_COLLECTION_COLUMNS` in `column-seed.ts`; `frozen-tables.test.ts` scans `apps/web`,
  `packages/domain`, `packages/ui` and `packages/integrations` and fails on any import of the
  `collections` Drizzle table. The query layer (`packages/db/src/collections.ts`), the junction reads
  and the importer are untouched: the table is frozen, not dropped.
- **What stays on purpose**: the Campaigns & Offers grid's read-only "Collections" column (the
  reverse of `collections.campaign_id`, through `loadCollections`) — not named by the ticket; flagged
  below for Talal.
- **Files**: `packages/domain/src/team/access.ts`, `apps/web/src/lib/removed-workspaces.ts`,
  `apps/web/src/components/shell/{nav,icons}.ts(x)`, `apps/web/src/app/app/products/{products-workspace.tsx,fields.ts}`,
  `apps/web/src/app/app/copywriting/{copy-panel,copywriting-workspace}.tsx`,
  `apps/web/src/app/app/copywriting/{actions,build-items,fields,page}.ts(x)`,
  `apps/web/src/lib/{copy-source,creative-sheet-source,collections-source}.ts`,
  `apps/web/src/app/app/concepts/{[conceptId]/concept-detail.tsx,[conceptId]/page.tsx,fields.ts,concepts-workspace.tsx,page.tsx}`,
  `apps/web/src/app/app/creative-design/{[briefId]/page.tsx,[briefId]/brief-detail.tsx,fields.ts,briefs-workspace.tsx}`,
  `apps/web/src/app/app/creative-sheet/{build-items.ts,creative-sheet-workspace.tsx,creative-sheet-panel.tsx,fields.ts,page.tsx}`,
  `apps/web/src/app/app/collections/page.tsx` (stub; workspace, panel, actions and fields deleted),
  `apps/web/src/app/(dev)/design-system/{copywriting,creative-sheet}.stories.tsx`,
  `packages/db/src/{column-seed,propagation}.ts`, `packages/db/src/schema/collections.ts`,
  `packages/db/src/frozen-tables.test.ts`, tests and e2e specs alongside (`collections.spec.ts`
  deleted; `removed-workspaces.spec.ts` covers the redirect).
- **Tests**: see the gate line below.
- **Production step (no migration)**: the hidden rows reach Railway only when the column seed is
  re-applied: `pnpm --filter @tas/db seed-columns -- --apply` (prod `DATABASE_URL` in the live
  repo's `.env.local`). Until then the six columns stay configured in `column_definitions` and the
  Copywriting, Concepts and Creative Sheet pages report them as "configured but not drawn" — a
  notice, not a failure.

### Ticket 5 — Internal status values cleanup — DONE (code on main; 0068 pending on Railway)

- **Migration 0067** (applied to Railway by hand on 2026-10-12; sha256
  `aac0e647a86c817a63b161661521277dbf3595d73a380386905c1e36af3fdb26`, recorded by `apply67.mjs`):
  `video_editing_in_progress` / `static_design_in_progress` → `under_editing_or_designing` (7 rows),
  `sent_to_video_editor` / `sent_to_designer` → `sent_to_editor_or_designer` (5), `images_revisions` /
  `videos_revisions` → `revisions_needed` (0), `launched` → `approved` (1), `on_hold` → `draft` (0).
  Live now: approved 373, revisions_submitted 17, under_editing_or_designing 5,
  sent_to_editor_or_designer 2, ad_submitted 1.
- **One list** in `@tas/domain/state` (`INTERNAL_STATUS`): `draft → sent_to_editor_or_designer →
  under_editing_or_designing → ad_submitted → revisions_needed → revisions_submitted → approved`;
  `INTERNAL_TRANSITIONS` (approved terminal), `INTERNAL_ENTRY_STATUS = 'draft'` (a new brief and a
  duplicate start there), `isClientTrackOpen` opens at `approved` only, `QA_INVALIDATING_INTERNAL`
  derives to `revisions_needed`. The two per-track lists, `on_hold`, the internal `launched` and every
  track-keyed helper (`internalStatusFor`, `internalTransitionsFor`, `startedStatusFor`,
  `internalEntryStatus`) are deleted; the Internal Queue has the seven columns; the editor board maps
  `sent_to_editor_or_designer` → Incoming, `under_editing_or_designing` + `revisions_needed` → Under
  Editing, `ad_submitted` + `revisions_submitted` → Under Review, `draft` and `approved` off the board.
- **Spelling kept on purpose**: the brief wrote `revision_submitted`; 17 live rows carry
  `revisions_submitted` (0067 did not touch them), so the key stays plural (label "Revisions
  Submitted"). The singular is one UPDATE plus one constant if Talal wants it.
- **Dashboards**: the launch is not an internal status; the overview reads "live" as the client
  track's `launched` or a `launched_at` timestamp, never `internal_status = 'launched'`.
- **Migration 0068** (written, NOT applied — Railway is unreachable from this session): both
  `internal_status` column defaults → `draft`, and `concepts.internal_status` (which shares the brief
  vocabulary; ~103 production concepts sat on the old default `sent_to_video_editor`) moved with the
  0067 rules. `cd packages/db && DATABASE_URL=… node apply68.mjs`. Until then those concepts render
  as Draft (the fallback for an unknown stored key).
- **Review** (four adversarial lenses, every finding verified by two skeptics): 21 findings, 6 held
  and fixed before the push — the importer could still store four retired spellings verbatim from an
  Airtable option (guarded, with a fixture); the editor board's off-board sentence called drafts
  "approved"; the 0067/0068 PGlite test covered one concept key (now every key, and the seeded rows
  are proved untouched); a design-system story hand-typed chip tones; a stale "on its own track"
  comment; the root `handoff-design.md` now carries a dated superseded note. The 15 refuted ones
  were pre-existing or by design; three of them are worth a follow-up ticket (below).
- **Follow-ups surfaced by the review (pre-existing, not changed here)**: the shared client-status
  dropdown action (`apps/web/src/lib/client-status-actions.ts`) checks the QA gate but neither the
  internal gate nor `canTransitionClient` (the UI only offers it when the gate is open); the Client
  Queue's Request Revisions action writes `revisions_needed` without the QA reset the brief page
  applies; `createBriefAction` accepts a submitted internal status on create (the form sends the
  entry state, so nothing mints anything today). Each is a one-function fix in a domain-gated action.
- **Playwright (demo mode, nine specs, 86 tests)**: 64 pass, 22 fail — and the same 20 fail on the
  previous head (`cbaa207`, run in a throwaway checkout, same first failing assertion on each), so
  none is this change's. The two extras were `page.goto` cold-compile timeouts in
  `removed-workspaces.spec.ts` (50.9 s and 52.9 s alone against a 60 s budget; both pass when the
  spec runs by itself). The 20 are stale specs from earlier sprints, listed under follow-ups below;
  the specs touched here (`internal-queue`, `creative-sheet`, `overview`, `smoke`, `client-queue`,
  `concepts`, `briefs-editor`, `briefs`, `live/briefs-start`) carry the new vocabulary and fail, where
  they fail, for those older reasons only.
- **Files**: see commit `refactor(briefs): consolidate internal_status vocabulary per Oct 12 decisions`.

### Ticket 15 — Copywriting field cleanup — DONE

- **Done**: Used, Winning, Meta Rating and the Client's Comment section are off the Copywriting
  panel; `updateCopyAction` no longer reads or writes them; the four grid renderers are gone and the
  seeded rows (`copywriting.used` on the template, Gratsi's `client_comment`, `used`, `winning`,
  `meta_rating`) are hidden on every brand. A copy links to a Creative and a Product only (Ticket 1
  took Collection). `client_approval_status` is on `copywriting` already (migration 0055; the panel's
  "Client Approval" select writes it).
- **Migration 0066** (applied to Railway by hand on 2026-10-12; sha256
  `212a5f9c8283046e988bf37937bbedb3913f14e854ccf26b333be76c85af8720`, recorded by `apply66.mjs`)
  dropped `used`, `winning`, `meta_rating` and `client_comment`; the schema, the importer, the seed
  rows, the demo fixtures and the tests followed in commit `refactor(copywriting,concepts): drop
  retired columns from schema and code`. The client's note on a copy row is `client_approval_note`
  (AUDIT-13): `updateCopyStatus` writes it, the portal reads it, the interface-config default names it.
- **Vocabulary (decision, Talal)**: the brief's four values (`pending_client_approval`, `approved`,
  `disapproved`, `revision_needed`) conflict with AUDIT-13 (`docs/decisions.md` 2026-10-10: ONE
  client vocabulary, `CLIENT_STATUS`, six keys, on briefs, concepts and copywriting). Left on
  `CLIENT_STATUS` pending his call; Ticket 16 has the same question.
- **Files**: `apps/web/src/app/app/copywriting/{copy-panel.tsx,copywriting-workspace.tsx,actions.ts,build-items.ts,fields.ts}`,
  `packages/db/src/column-seed.ts` (`RETIRED_COLUMNS`), `packages/db/src/scripts/verify-rollout.ts`,
  tests and specs alongside.

### Ticket 2 — Concepts table finalisation — DONE; one item for Talal

- **Done**: Batch, Angle and Theme are the only required fields (Category is optional, still a closed
  vocabulary when chosen; `REQUIRED_CONCEPT_FIELDS` drives the form's Required marks and the Server
  Action re-runs `validateConceptDraft` before every write — both already existed). The concept name
  stays derived on save and read-only. Creator was already optional. The duplicate
  "Formats to create (production)" (`concepts.formats_to_create`) is off the form, the grid and the
  seed; `production_status` is off the form's write path and hidden on every brand including Gratsi
  (the Oct 4 fidelity row). Product and Persona stay the read-only "from Angle" block
  (`inheritedFromAngle`). The brief section is headed "Concept Details". Domain tests cover the
  required set, the name formula and the inherited read-only rule.
- **Decision, Talal — the separator**: the brief writes `${batch} - ${angle} - ${theme}`; PRD §7 and
  CLAUDE.md non-negotiable 6 write `Batch-Angle-Theme`, every live concept (102 on Gratsi) carries the
  hyphen, and the creative name formula slices the batch off it. The hyphen stays until he rules;
  `concept-name.test.ts` pins it.
- **`blind_approval`**: no such column or field exists on `concepts` (nothing to make optional).
- **Migration 0066** (same hash as above) dropped `formats_to_create` and `production_status`; the
  schema, the concept production vocabulary, the importer, the seed rows and the tests followed.
- **Files**: `packages/domain/src/concepts/validate-concept-draft.ts` (+test), `concept-name.test.ts`,
  `apps/web/src/app/app/concepts/{[conceptId]/concept-detail.tsx,[conceptId]/page.tsx,actions.ts,fields.ts,concepts-workspace.tsx}`,
  `packages/db/src/column-seed.ts`, `packages/db/src/scripts/verify-rollout.ts`, tests and specs alongside.

### Ticket 0 — UI overhaul foundation (the six boards) — DONE (2026-10-13)

- **Gap report**: `docs/sprint-oct12-ui-gap.md` — the six boards of `tas-ui-overhaul.zip` (the Oct 13 HTML
  bundle is the same six boards in a React runtime) read by two lenses each, 194 findings, 22 cross-lens
  rulings, 105 Ticket 0 gaps; 101 rows done, 2 deferred with reasons, 3 escalations, 3 deferrals.
- **Commits**: `0500b3a` feat(ui): add missing semantic tokens from ZIP designs · `c392758`
  feat(creative-sheet): match ZIP designs for Focus Mode, Sidebar, Multi-select, QA gate, Activity log,
  Vocabulary · this docs commit docs(sprint-oct12): close UI gap report.
- **Tokens** (`packages/ui/src/styles/tokens.css`, all four theme blocks, `tokens-declared.test.ts`):
  `--on-accent` #ffffff (ink on a filled accent / the gradient — the old `text-bg` was dark on purple in
  dark mode), `--on-ok` #0f2418 (the Approve ink on the solid `--ok`), `--shadow-float`, `--shadow-sheet`
  (light values through `var(--text)` at 16%); `--primary-foreground` → `var(--on-accent)`.
- **Primitives** (`@tas/ui`): `@tas/ui/icons` (lucide, canonical names; `sheet-icons.tsx` deleted),
  `Checkbox` (styled native input, `indeterminate`, `variant="na"`), `DisabledWrite` popover (`heading`,
  `popover`, `hintEmphasis`), `SectionLabel`, Button `success`, `formatSheetDate` / `formatCommentStamp`.
- **Surfaces**: Focus Mode (full-bleed, success Approve, gradient Submit with white ink, gate popover
  "QA checklist incomplete", preview frame with the play disc and `Video · 9:16` stamp, composer, dates
  and stamps formatted); the Sheet (six sections at 460px, primitive close, asset tiles, `SheetFooter`
  with Save on the gradient, Open full page outline, no Cancel; title = brief name); the grid (header
  type and 42px rows product-wide, three row states, Checkbox column, Type as a mute chip, view
  switcher icons), the context menu and the floating bar, `SelectionStatusPicker` /
  `SelectionDeleteConfirm`; the brief page (QA rows via `qa-check-row.tsx`, the grouped Activity entry
  for a QA auto-reset); one tone source (`chipTone(label)`, the sheet's local map gone).
- **Stories**: Button success, Checkbox, DisabledWrite open, SectionLabel, status vocabulary + QA
  matrix, Focus Mode gated state, QA gate box, sidebar, multi-select grid with picker and confirm,
  brief QA rows, grouped Activity — all on `/design-system`, each with a no-colour-literal markup test.
- **Playwright** (demo): `creative-sheet.spec.ts` + new `ui-overhaul-smoke.spec.ts`, 15 of 15 green; the
  five stale creative-sheet assertions from the Follow-ups list are repaired (hydration wait, real
  fixture names, resolved header list). The live spec `live/briefs-start.spec.ts` is updated for the
  Activity `data-value` attributes but unrun here (no live env).
- **Size**: the surfaces commit is far above the 300-LOC rule (≈ +2,500 / −750 across 39 files, tests
  and stories included); the user asked for three commits for the whole ticket, so it is flagged, not
  split. The natural split points are in the gap report's implementation plan.
- **For Talal** (gap report "Open questions"): white ink contrast on the violet end of the dark gradient;
  who grades a Motion Image; a creative with no type; the count noun ("briefs" vs "creatives"); the
  working-step chip tones (mute, as drawn, or richer); Due / Assignee as sheet columns; Music /
  Voiceover columns (Ticket 6); "Ticked by"; the backend ticket for the portal's Request Revisions
  (B5.A3, must — until it lands the "send it back from the portal → both ticks clear" check fails).

### Ticket 8 — Multi-select + right-click on every data grid — DONE (2026-10-13)

- **Six commits**: `softDelete*` writers for angles / personas / products / concepts / creators /
  copy in `@tas/db` (themes GLOBAL, no writer by design); the `useGridSelection` + `GridSelectionOverlay`
  shared primitives in `components/views`; four page-group commits wiring the four light tables
  (angles, themes, personas, products), UGC + copywriting (both carry one single status track and a
  sub-nav where selection resets on tab change) and concepts (both status tracks, the pure gate
  helpers extracted to `concepts/status-guard.ts` so the single-row save and the bulk Change-status
  action re-run the same `clientGateRefusal` / `clientMoveRefusal` / `internalMoveRefusal` — a
  `'use server'` module may only export async functions, hence the extraction); a sheet-parity fix
  the adversarial review caught (every page now passes the brand's whole row set, not the
  search-narrowed one, to the hook — a selection the user ticked survives a filter); and a specs
  reconciliation that picks up the Ticket 8 leading checkbox cell plus three baseline drifts the
  baseline run turned up (`concepts` lost `Approval Status` with 0066 and gained `Client Approval`
  at the end; UGC's resolver returned 33 → 34 columns; UGC's workspace tabs added `Creator Pool`).
- **E2E**: Playwright on the eight touched specs reaches 80 passing. The four remaining failures
  (`concepts.spec.ts:277, 376, 398` + `copywriting.spec.ts:169`) also fail at the pre-Ticket-8
  baseline `bbab582` — they are the SMOKE-31 (Oct 11) and client-status-section (Oct 11) drifts
  under "Stale Playwright specs" below, never Ticket 8 regressions.
- **Lead question answered**: the adversarial review's one confirmed finding — "should pages pass
  unfiltered rows so a search does not drop the selection, i.e. sheet parity?" — is yes, and
  commit `a1ddd0e` wires every page to the sheet's rule. The hook's `rows` docstring states the
  contract.

### Ticket 7 — Group-by on all data tables — DONE (2026-10-13)

- **Five commits**: the `GroupByControl` primitive (groupable columns only, `Layers2` trigger); the
  seven tables passing `groupableFields` + `apps/web/e2e/group-by.spec.ts`; the Creative Sheet joining
  the per-user views with the Kanban picker as a persisted GroupByControl; status group headers as
  `StatusChip` + booleans grouping as Yes/No; this docs commit. Details in `docs/decisions.md`
  2026-10-13 "Ticket 7".
- **Persistence**: grid grouping was already per user (`user_table_views.group_by`, Sprint 7); the
  Creative Sheet now participates; the Kanban field persists in `user_view_preferences` + `?groupBy=`.
- **E2E**: `group-by.spec.ts` green on all eight pages; the UGC `user-views` and `first-paint-click`
  failures reproduce at the pre-ticket commit (pre-existing, container-bound; noted in decisions).
- **Follow-up**: fold the Themes / UGC / Copywriting / Angles cell-tone maps into the domain's
  `chipTone` so a grouped header chip can never diverge from the cells beneath it.

## Blockers and decisions the human owns

- **Apply on Railway (operator, in this order)**: `cd packages/db && DATABASE_URL=… node apply66.mjs
  && node apply67.mjs` (record the two hashes; nothing re-runs), then `node apply68.mjs` (column
  defaults → `draft`, concept rows onto the one list; prints the concept counts before/after), then
  `pnpm --filter @tas/db seed-columns -- --apply` (retires the dropped columns' `column_definitions`
  rows and hides the Collections rows). `docs/runbook.md` has the verification steps.
- **Ticket 5 · `revisions_submitted` spelling**: kept plural to match the 17 stored rows; say the word
  and it becomes `revision_submitted` (one UPDATE, one constant).
- **Ticket 5 · concepts in 0068**: the ~103 never-touched concepts move to `sent_to_editor_or_designer`
  (the 0067 rule for their old default). If they should land on `draft` instead, change the UPDATE
  in `0068_internal_status_defaults.sql` BEFORE `apply68.mjs` runs (the hash is recorded on apply).
- **Ticket 5 · draft is off the editor board**: a new brief and a duplicate start at `draft`, which the
  editor's board does not show; a strategist advances it to `sent_to_editor_or_designer` from the
  brief page, the sheet or the bulk picker. A "Send to editor/designer" button and the PRD §12 "Brief
  assigned" DM are not in this ticket.
- **Ticket 2 · the concept name separator**: the brief writes `${batch} - ${angle} - ${theme}`; PRD
  §7 / CLAUDE.md non-negotiable 6 write `Batch-Angle-Theme` and every live concept carries the
  hyphen. The hyphen stays until Talal rules.
- **Ticket 16 · vocabulary**: keep the six-key `CLIENT_STATUS` (AUDIT-13, 2026-10-10) or switch to the
  brief's four values (`pending_client_approval`, `approved`, `disapproved`, `revision_needed`). Not
  changed.
- **Ticket 1 · Campaigns & Offers** still shows its read-only "Collections" reverse-link column and
  panel list (not named in the ticket). Drop it too?

## Follow-ups (not in Phase A)

- **Stale Playwright specs (20 tests, pre-existing on `cbaa207`)**, one repair session, no product
  code expected: `internal-queue` and `client-queue` look for sidebar links the F1 containment hid
  and count "briefs" where the board says "creatives" (d81330c); `client-queue` expects four
  columns, the board has five since `disapproved` (a66b7ec); `concepts`, `copywriting` and
  `creative-sheet` pin header lists from before the "Client Approval" relabel, the Dimensions column
  and the select-all checkbox column; `concepts` expects a `concept-name-preview` on a manual-named
  concept, a client bar on a rail that is `internalOnly`, and a `concept-client-status` slot that no
  longer exists; `copywriting` expects a `copy-client-status` slot the panel deliberately dropped;
  (`creative-sheet`'s five — the header list, the "Daylight" brief, the search, the panel and
  multi-select clicks before hydration — were repaired by Ticket 0 on 2026-10-13, 15 remain); `overview` and `smoke` expect the pipeline cards to
  land on `/app/creative-design?status=…` while the cards link to the Creative Sheet (the
  `creative-design` list route redirects there since the single-source cutover — decide which is
  right); `removed-workspaces` expects `?q=hook` to survive the `youtube-copywriting` redirect and
  the redirect drops it (a real, small bug in the redirect chain, pre-existing).
