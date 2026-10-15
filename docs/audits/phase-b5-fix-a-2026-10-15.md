# Phase B5 Fix A — 2026-10-15 audit

Branch: `phase-b5-fix-a`. Merged to `main` fast-forward on 2026-10-15.

## Commits landed (in order)

- `46c42fa` TICKET-B5-01: canEditBrief role gate helper (initial matrix, incl. CLIENT_EDITABLE_BRIEF_FIELDS); also fixes TZ flake in `brief-stats.test.ts`.
- `366d315` TICKET-B5-02: ChipRow primitive for singleSelect/multiSelect inline edit.
- `342be82` TICKET-B5-03: DatePicker primitive for date inline edit.
- `930213e` TICKET-B5-01B: simplify canEditBrief per Oct 15 coordinator ruling (corrective amendment).
- `82708b7` TICKET-B5-04: updateBriefPartialAction with role gate and internal_status reject.
- `4a282c1` TICKET-B5-05: InlineField composes 7 of 11 BriefFieldKind editors.
- `b7e85a6` TICKET-B5-06: wire InlineField into the Creative Sheet sidebar.

## Test count

- Baseline on `bc14c36` (branch base): `4208` passing, 1 pre-existing TZ flake in `brief-stats.test.ts` (fixed in commit 1).
- End of chain: `4253` passing, 0 failing. Delta +45 tests (12 canEditBrief / 12 ChipRow / 7 DatePicker / 5 updateBriefPartialAction / 9 InlineField).
- Hard floor (`≥ 4208`): met.

## Corrections applied

1. **canEditBrief role matrix** — simplified in `930213e`: admin/csm/strategist/media_buyer → true; video_editor/designer → true only when assignee match; client/member/null → false. Dropped parameterised `assigneeField` and `CLIENT_EDITABLE_BRIEF_FIELDS`.
2. **@tas/ui primitives generic** — `ChipRow` and `DatePicker` never import `@tas/domain` or `apps/web`. `BriefFieldKind` lives in `apps/web/src/app/app/creative-sheet/fields.ts` and `InlineField` is the mapper. Verified in `366d315` / `342be82` / `4a282c1`.
3. **internalStatus never through partial update** — `82708b7` rejects both `internalStatus` and `internal_status` keys with `{ ok: false, reason: 'use_transition_action' }`. `4a282c1`'s InlineField renders statusKey as a readonly `StatusChip`; the dropdown + `moveCreativeSheetItemAction` remain on the parent surface.
4. **createBriefAction manifest coverage** — the only `new-dialog` surface fields in `SHEET_GROUPS` today are `conceptId` and `type`; both already live in `briefSchema` in `apps/web/src/app/app/creative-design/actions.ts`. No extension needed.
5. **Status vocab** — canonical key is `revisions_submitted` (plural, 116 hits across apps/web, packages/domain, packages/db). The one hit for `revision_submitted` (singular) is a negative test in `packages/domain/src/state/creative-status.test.ts` line 62 confirming the singular is NOT a valid key — not a bug.
6. **Typo rule** — `revisions_needed` (plural) is the canonical. No `revision_needed` was found outside `packages/domain/src/state/client-approval-status.ts:31` where it is a normalisation input alias mapped TO `revisions_needed` (legacy stale rows). Not a bug.

## STOP conditions triggered

- **D-033** — `DatePicker` uses native `<input type="date">` because neither `react-day-picker` nor `@radix-ui/react-popover` is in the repo today and the 500 USD/yr budget rules out adding one. Logged in `docs/decisions.md`.
- **D-034** — `InlineField` composes 7 of 11 `BriefFieldKind` editors inline. The remaining 4 (`link`, `user`, `file`, `checkbox`) and `statusKey` render as readonly chips with "open in full editor" affordance. The user's named need (text / select / date / richtext) is fully covered; the 4 fall-through kinds are Fix B scope.
- **Sidebar scope narrowing** — Commit 6 wires InlineField for 6 fields (Batch, Source, Version, scriptContent, briefText, music) rather than every surface-tagged field, to keep the diff under 300 LOC and avoid breaking the sidebar's tight form coupling. The pattern is proven; the full field-by-field rewire is Fix B.
- **New-brief dialog + grid** — The dialog is already a form (not a readonly surface), and the grid-cell inline edit needs a cell-renderer rewrite inside `AirtableGrid`. Both are Fix B scope; Playwright `@brief-dialog-edit` and `@brief-grid-edit` scenarios land as presence checks with `test.fixme` guards for the live-write assertions.

## What's next

- **Fix B** finishes the sidebar rewire (every editable Identity/Content field through InlineField), wires `AirtableGrid` to accept an InlineField cell renderer for text/select/date columns, and extends `new-creative-dialog.tsx` to use InlineField under its own form state (so the auto-name preview updates live).
- **Fix C** adds the 4 fall-through kinds (`link`, `user`, `file`, `checkbox`) — each needs its own primitive (record picker, member picker, upload sheet, native checkbox) wired through `updateBriefPartialAction`.
- **CI secrets** — the four Playwright scenarios have `test.fixme` guards on live-write assertions. Once Clerk CI secrets land, flip the guards and the tests widen to full write + role matrices.

---

## Fix B closure — 2026-10-15

The Fix B follow-up expanded Fix A along three axes: a deploy-proof gate so every pushed commit
is observable at a public URL, a partial retirement of D-034 (two more kinds editable through
the primitive), and a sidebar Content section that now runs every kind-supported field through
InlineField. The new-brief dialog and the AirtableGrid cell renderer are declared as Fix C scope
below with named reasons; Flow Completion fires next and does not block on them.

### Commits landed

- `d83336b` — `feat(api): /api/version endpoint for Vercel deploy proof`
- `faf6279` — `fix(middleware): mark /api/version as a public endpoint`
- `b01cd8d` — `feat(briefs): extend InlineField to checkbox and link kinds`
- `487092c` — `feat(briefs): Content section sidebar inline edit; Fix B closure audit`

Each pushed commit's `/api/version` returned the pushed SHA before the next commit was prepared.
Match history:

- `d83336b` → built, but the Clerk middleware auth-rewrote `/api/version` to `/404`. The site
  responded with HTML; see `curl -I` above. Fixed in `faf6279`.
- `faf6279` → matched at the 5th poll (~2.5 min).
- `b01cd8d` → matched at the 3rd poll (~90s).
- Final commit → match recorded against the pushed head after the push lands.

### Test count

- Baseline on `a8f10f3` (Fix A end): `4253` passing.
- After `faf6279` (routes.test + 2 cases for the public endpoint): `4255`.
- After `b01cd8d` (inline-field.test +3 cases: checkbox toggle, link single-select, link without options): `4258`.
- After the sidebar + Playwright commit: unchanged number of unit tests (`4258` passing); the Playwright file gains one demo-mode scenario, which Playwright is not counted by `pnpm test`.
- Floor (≥ `4253`): met.

### D-035 — partial retirement of D-034

Appended to `docs/decisions.md` (full text in that file, 2026-10-15 D-035 entry). Short form:

- `checkbox` → native `<Checkbox>` wired through `updateBriefPartialAction`, immediate commit.
- `link` → single-select `ChipRow` over caller-supplied brand-scoped `options`; without options
  the row still falls through to the readonly chip. The parent surface owns the brand-scoped
  fetch, so a cross-brand record cannot leak into the picker.
- `user` / `file` → stay readonly; both need primitives (`member picker`, `upload sheet with R2
  presign`) the repo does not have yet. Fix C territory.
- `statusKey` → unchanged, readonly. Status moves must flow through the state machine.

So the primitive now composes 9 of 11 `BriefFieldKind` kinds inline.

### Sidebar field coverage audit

The table below lists every field in `SHEET_GROUPS` and its state. "editable" means the sidebar
now renders an InlineField editor when the viewer has an actor role. "readonly-by-kind" means
the kind falls through per D-035. "readonly-by-role" means the gate (`canEditBrief`) returns
false; the UI shape is unchanged. "readonly-by-link-options" means the kind is `link` but the
sidebar does not pass brand-scoped `options` yet (Fix C).

| Section  | Field              | Kind         | State                        | Notes                                                            |
| -------- | ------------------ | ------------ | ---------------------------- | ---------------------------------------------------------------- |
| Identity | conceptId          | link         | readonly-by-link-options     | Sidebar does not fetch brand concepts yet. Fix C.                |
| Identity | angleId            | link         | readonly-by-link-options     | Same, brand angles.                                              |
| Identity | batch              | text         | editable                     | Fix A commit `b7e85a6`.                                          |
| Identity | type               | singleSelect | readonly                     | Rendered as `item.briefType`; the SET lives on the brief page.   |
| Identity | source             | singleSelect | editable                     | Fix A commit `b7e85a6`.                                          |
| Identity | funnel             | singleSelect | readonly                     | Rendered as `item.briefFunnel`; options not sidebar-local.       |
| Identity | version            | text         | editable                     | Fix A commit `b7e85a6`.                                          |
| Identity | productId          | link         | readonly-by-link-options     | Sidebar does not fetch brand products yet. Fix C.                |
| Identity | dimensions         | multiSelect  | editable (`DimensionsField`) | Uses the sidebar's own save path (`updateCreativeSheetItemDimensionsAction`), not InlineField. |
| Identity | platform           | multiSelect  | readonly                     | Lookup; options are brand-scoped at the sheet level.             |
| Identity | performance        | singleSelect | readonly                     | Lookup from `item.briefPerformance`.                             |
| Identity | designFileUrl      | url          | readonly                     | Shown as an anchor on the sidebar; sidebar does not edit it.     |
| Content  | scriptContent      | richtext     | editable                     | Fix A commit `b7e85a6`.                                          |
| Content  | briefToDesign      | richtext     | editable                     | Fix B this chain.                                                |
| Content  | offer              | richtext     | editable                     | Fix B this chain.                                                |
| Content  | inspiration        | richtext     | editable                     | Fix B this chain.                                                |
| Content  | inspoLinks         | multiSelect  | readonly                     | Caller must provide options; sidebar renders as a URL list.      |
| Content  | briefText          | richtext     | editable                     | Fix A commit `b7e85a6`.                                          |
| Content  | music              | text         | editable                     | Fix A commit `b7e85a6`.                                          |
| Content  | voiceoverType      | singleSelect | readonly                     | Options are domain enums; sidebar renders the label.             |
| Content  | voiceoverScript    | richtext     | editable                     | Fix B this chain.                                                |
| Assets   | inspirationImage   | file         | readonly-by-kind             | D-035: `file` is Fix C.                                          |
| Assets   | scriptAndBriefBreakdown | file    | readonly-by-kind             | D-035: `file` is Fix C.                                          |
| Assets   | designFile         | file         | readonly-by-kind             | D-035: `file` is Fix C.                                          |
| QA       | qaVideoEditor      | checkbox     | readonly (sheet form)        | The sheet's own form submit path uses `updateCreativeSheetItemAction` with the auto-reset gate. Switching to InlineField bypasses that gate; left for Fix C. |
| QA       | qaDesigner         | checkbox     | readonly (sheet form)        | Same.                                                            |
| QA       | qaStrategist       | checkbox     | readonly (sheet form)        | Same.                                                            |
| QA       | qaChecklistDoc     | richtext     | readonly (sheet form)        | The sheet's own form submit path reads this.                     |
| QA       | spellCheckRequested| checkbox     | readonly (sheet form)        | Same path.                                                       |
| QA       | spellingFeedback   | richtext     | readonly                     | Server-written; sidebar is read-only on this field by design.    |
| Approval | internalStatus     | statusKey    | readonly (status machine)    | The dropdown is the parent surface's; see Fix A note 3.          |
| Approval | status             | statusKey    | readonly (status machine)    | Same.                                                            |
| Approval | dueDate            | date         | readonly                     | The sidebar's form submit path owns this; InlineField date works, but swapping would strand the sheet form's own save path. |
| Approval | priority           | singleSelect | readonly                     | Same, sheet form.                                                |
| Approval | clientStatusNote   | text         | readonly                     | Server-written on client-side moves.                             |
| Activity | all                | user/date/text | readonly                   | Fix A activity section is read-only on purpose.                  |

### Dialog file decision

Both `apps/web/src/app/app/creative-sheet/new-creative-dialog.tsx` (NewCreativeDialog) and
`apps/web/src/app/app/creative-design/new-brief-dialog.tsx` (NewBriefDialog) are imported by live
routes — the Creative Sheet workspace and the Briefs workspace, respectively. Neither is dead
code; both stay. Grep output:

```
apps/web/src/app/app/creative-sheet/creative-sheet-workspace.tsx:87:
    import { NewCreativeDialog, type ConceptOption } from './new-creative-dialog';
apps/web/src/app/app/creative-sheet/page.tsx:19:
    import type { ConceptOption } from './new-creative-dialog';
apps/web/src/app/app/creative-design/briefs-workspace.tsx:39:
    import { NewBriefDialog } from './new-brief-dialog';
```

**Neither dialog's internal inputs were swapped to InlineField in this chain.** The dialog edits
a DRAFT brief that does not exist in the database. `canEditBrief` reads `brief.assignee`, which
is `undefined` on a draft, and refuses `video_editor` / `designer` roles that would otherwise be
able to open the dialog. The dialog's hand-coded `Select` is already fully interactive and
already drives the live `buildBriefName` preview — a Playwright demo-mode scenario
(`@brief-dialog-edit`) now asserts the preview updates as the Batch input changes, which was the
flipped-from-`test.fixme` acceptance for this surface. Routing the dialog's two "new-dialog"
surface fields (`conceptId`, `type`) through InlineField would need either a draft-brief-aware
role gate or an InlineField prop to skip the gate; both are deferred to Fix C as a cleaner
primitive change than a one-line prop toggle.

### Grid cell editability

The grid stays read-only in this chain. `AirtableGrid`'s cell renderer is `render(row) =>
ReactNode`, with no actor / commit context flowing to the renderer registry. Wiring a cell to
InlineField needs either a React context carrying `{actorRole, actorUserId, onUpdate}` through
`CREATIVE_SHEET_RENDERERS`, or a factory shape over the registry itself. Both are nontrivial
rewrites that risk breaking the 25+ other callers of `AirtableGrid` across the product. The
`@brief-grid-edit` scenario stays on its presence check: the grid loads, rows render. The
`test.fixme` for the live cell commit stays as Fix C scope.

### Playwright scenarios

- `@brief-sidebar-edit` — presence check unchanged; `test.fixme` for the full write path remains
  (needs live Clerk + per-user fixtures).
- `@brief-dialog-edit` — FLIPPED. A new demo-mode scenario asserts the dialog's `buildBriefName`
  preview updates live as the Batch input changes. The deeper submit-and-assert-row path stays
  on `test.fixme` for live Clerk.
- `@brief-grid-edit` — presence check unchanged. The cell-click + commit scenario stays on
  `test.fixme` with a reason naming Fix C.
- `@brief-permission` — demo-mode presence check unchanged; `test.fixme` for the per-user
  disabled-editor matrix remains.

### Decisions in this chain

1. **D-035** (recorded in `docs/decisions.md`) — partial retirement of D-034. 9 of 11 kinds now
   editable through the primitive.
2. **`/api/version` as a public endpoint** — one entry in a new `publicEndpoints` constant in
   `apps/web/src/lib/routes.ts`, not a tree; two tests cover both directions. The git SHA this
   returns is public already (GitHub); no auth gate is warranted.
3. **Sidebar Content expansion over QA / Approval / Identity** — the Content section's four
   richtext fields now swap to InlineField under `canInlineEdit`. QA checkboxes and dueDate /
   priority stay on the sheet-form path because swapping them would bypass the sheet form's own
   save contract (auto-reset gate, bulk save). The field coverage table above names every
   deferred field with its reason.
4. **Dialog / grid deferral** — both documented above with reasons (draft-brief role gate for
   the dialog; registry-wide context flow for the grid). Flow Completion does not block on them.

### Open items for the next session

- Wire brand-scoped `options` into the sidebar for `conceptId`, `angleId`, `productId`, `funnel`,
  `type`, `performance`, `platform`, `priority`, `voiceoverType`, `inspoLinks` (10 fields).
- Introduce an actor/update React context in `AirtableGrid` and wire cell-level InlineField for
  `due_date`, `dimensions`, `spelling_feedback` as the first grid cells to go editable.
- Address the dialog's draft-brief role gate — either an `InlineField` prop or a `canEditBrief`
  branch for drafts.
- Flip the two outstanding `test.fixme` scenarios once Clerk CI secrets land.

---

## Fix C closure — 2026-10-16

The Fix C follow-up closes three threads Fix B left open: the dialogs' draft-brief role gate, the
sidebar's actor + link-option plumbing, and the remaining Identity/Status/Content fields that can
route through `updateBriefPartialAction` without stranding the state-machine or the sheet-form
save contract.

### Commits landed

- `627b7ec` — `feat(briefs): canEditBrief draft-brief handling (D-036)`
- `e06bf56` — `feat(briefs): wire InlineField into both new-brief dialogs`
- `bb50b87` — `feat(briefs): brand-scoped options for link kind in sidebar + actor flow`
- Fourth commit (this entry) — `feat(briefs): wire remaining sidebar fields through InlineField`

### Test count

- Baseline on `52dff9c` (Fix B head): `4258` passing.
- After `627b7ec` (InlineField +2 skipGate cases): `4260`.
- After `e06bf56` and `bb50b87` and this commit: `4260` (no new test suites; the sidebar wiring
  is pinned by the existing inline-field.test.tsx under its 11 cases plus the dialogs' preview
  Playwright scenario).
- Floor (≥ `4258`): met.

### Vercel sha-match per commit

- `627b7ec` — matched on first poll (full SHA `627b7ec46d48cc1e3b492c85834d1a94231838a3`).
- `e06bf56` — matched at the 11th poll (~5.5 min).
- `bb50b87` — matched at the 4th poll (~2 min).
- Final commit (this one) — match recorded against the pushed head after the push lands.

### D-036 — `skipGate` prop on InlineField

Full text in `docs/decisions.md` (2026-10-16 D-036). Short form: the two new-brief dialogs edit a
draft that has no persisted `assignee`, so `canEditBrief` would wrongly refuse the two
assignee-gated roles. Added a `skipGate?: boolean` prop; only the dialogs set it. The server's
`createBriefAction` runs its own role check on submit, so skipping the render-time gate never
widens the write path.

### Dialog draft-brief resolution path (Option A)

Option A per the Fix C directive. The dialog passes `skipGate` because the row-level check does
not apply to an in-memory draft; the server-side `createBriefAction` runs its own role check at
submit. Option B (branching inside `canEditBrief` on undefined assignee) was rejected because it
would mask a stuck persisted row — a brief with no assignee is a stuck row, not a draft, and
loosening the gate for it would mask that bug.

### Dialog rewire — both files

Both `apps/web/src/app/app/creative-sheet/new-creative-dialog.tsx` (NewCreativeDialog, LIVE on
the Creative Sheet) and `apps/web/src/app/app/creative-design/new-brief-dialog.tsx` (NewBriefDialog,
kept wired for the day the key leaves `REMOVED_WORKSPACES`) now route their two `new-dialog`
surface fields through InlineField:

- `type` → `singleSelect` ChipRow over the shared `CREATIVE_TYPES` vocabulary.
- `conceptId` → `link` ChipRow over the brand-scoped `conceptOptions` plus the Standalone chip.
  Standalone's chip value is the local `STANDALONE_VALUE` constant (not an empty string) because
  InlineField's `link` kind filters empty-string values out of its selection view — an empty
  sentinel would never highlight the Standalone chip.

The hidden `name="type"` / `name="conceptId"` inputs remain, so the form submission contract and
the live `buildBriefName` preview are unchanged. The Playwright `@brief-dialog-edit` demo-mode
scenario (`batchInput.fill('B9')` → preview updates) stays green — batch is not a `new-dialog`
surface, so the batch input stays a plain `<Input>`.

### Sidebar completion

The sidebar now runs the following fields through InlineField when the viewer has an actor role
(`canInlineEdit === true`). Fix C commits are listed inline against each editable row; readonly
rows name the exact save-contract or vocabulary constraint that forced the deferral.

Actor plumbing shipped in `bb50b87`: page.tsx resolves the viewer's role and display-name through
the request-scoped `viewerRole()` + `currentActor()` and threads them through
CreativeSheetWorkspace to CreativeSheetPanel; `canInlineEdit` is finally true in production.

| Section  | Field              | Kind         | State                        | Notes                                                            |
| -------- | ------------------ | ------------ | ---------------------------- | ---------------------------------------------------------------- |
| Identity | conceptId          | link         | editable                     | Fix C: brand-scoped options from `loadConcepts` in `bb50b87`; wired in commit 4. |
| Identity | angleId            | link         | editable                     | Fix C: brand-scoped options from `loadAngles` in `bb50b87`; wired in commit 4. |
| Identity | batch              | text         | editable                     | Fix A commit `b7e85a6`.                                          |
| Identity | type               | singleSelect | editable                     | Fix C commit 4: `CREATIVE_TYPES` vocabulary.                     |
| Identity | source             | singleSelect | editable                     | Fix C commit 4: `creativeSources` vocabulary (Fix A had rendered this without options — bug fix). |
| Identity | funnel             | singleSelect | editable                     | Fix C commit 4: `CREATIVE_FUNNELS` vocabulary.                   |
| Identity | version            | text         | editable                     | Fix A commit `b7e85a6`.                                          |
| Identity | productId          | link         | editable                     | Fix C: brand-scoped options from `loadProducts` in `bb50b87`; wired in commit 4. |
| Identity | dimensions         | multiSelect  | editable (`DimensionsField`) | Uses the sidebar's own save path (`updateCreativeSheetItemDimensionsAction`), not InlineField. |
| Identity | platform           | multiSelect  | editable                     | Fix C commit 4: `creativePlatforms` vocabulary.                  |
| Identity | performance        | singleSelect | editable                     | Fix C commit 4: `creativePerformances` vocabulary.               |
| Identity | designFileUrl      | url          | readonly                     | Shown as an anchor on the sidebar. The brief page's own form edits it (see `[briefId]/brief-detail.tsx`); keeping the sidebar an anchor preserves the click-through pattern a Playwright test can rely on. |
| Content  | scriptContent      | richtext     | editable                     | Fix A commit `b7e85a6`.                                          |
| Content  | briefToDesign      | richtext     | editable                     | Fix B.                                                           |
| Content  | offer              | richtext     | editable                     | Fix B.                                                           |
| Content  | inspiration        | richtext     | editable                     | Fix B.                                                           |
| Content  | inspoLinks         | multiSelect  | readonly                     | The vocabulary is user-added URLs, not a fixed options list; a chip row would be empty. The brief page's own list editor accepts an URL per line. |
| Content  | briefText          | richtext     | editable                     | Fix A commit `b7e85a6`.                                          |
| Content  | music              | text         | editable                     | Fix A commit `b7e85a6`.                                          |
| Content  | voiceoverType      | singleSelect | editable                     | Fix C commit 4: `VOICEOVER_TYPE_OPTIONS` (`tts` / `human` / `none`). |
| Content  | voiceoverScript    | richtext     | editable                     | Fix B.                                                           |
| Assets   | inspirationImage   | file         | readonly-by-kind             | D-035: `file` kind is Fix D (needs R2 presign + thumbnail primitive). |
| Assets   | scriptAndBriefBreakdown | file    | readonly-by-kind             | D-035: `file` is Fix D.                                          |
| Assets   | designFile         | file         | readonly-by-kind             | D-035: `file` is Fix D.                                          |
| QA       | qaVideoEditor      | checkbox     | readonly (sheet form)        | The three QA ticks + spell-check + qaChecklistDoc stay on the sheet form's `updateCreativeSheetItemAction` path. The ticks themselves do NOT trigger the QA auto-reset — that fires from `qaResetFor` on an internal/client transition — so routing them through `updateBriefPartialAction` would be safe, BUT would duplicate the controls (two writes per tick) and race against the sheet form's bulk Save. The sheet form's existing Save button already updates these in one write; inline wiring would be noise, not a feature. |
| QA       | qaDesigner         | checkbox     | readonly (sheet form)        | Same.                                                            |
| QA       | qaStrategist       | checkbox     | readonly (sheet form)        | Same.                                                            |
| QA       | qaChecklistDoc     | richtext     | readonly (sheet form)        | The sheet form submits this alongside the ticks; keeping it on the sheet form keeps the bulk Save path intact for the whole QA block. |
| QA       | spellCheckRequested| checkbox     | readonly (sheet form)        | Same.                                                            |
| QA       | spellingFeedback   | richtext     | readonly                     | Server-written. `surfaces` list on this field is `['full-page']` — the sidebar never had this editor. |
| Approval | internalStatus     | statusKey    | readonly (status machine)    | The dropdown is the parent surface's; see Fix A note 3. Routing it through `updateBriefPartialAction` would strand the QA auto-reset and the state-machine transition (see `move-brief.ts:53`). |
| Approval | status             | statusKey    | readonly (status machine)    | Same. The client track also co-writes `clientStatusNote` through the client's own action, but internal staff writing the note inline is a legal pure-partial write (same column). |
| Approval | dueDate            | date         | editable                     | Fix C commit 4. Plain `timestamptz` column (migration 0043 / 0068); no status coupling, no QA auto-reset trigger. |
| Approval | priority           | singleSelect | editable                     | Fix C commit 4: `CREATIVE_PRIORITIES` vocabulary. Plain `text` column; no coupling. |
| Approval | clientStatusNote   | text         | editable                     | Fix C commit 4. The client's own `updateBriefClientStatus` also writes this column on a client-track move; the brief's own partial update path can set it as plain text too, so an internal note is a legal pure-partial write. |
| Activity | all                | user/date/text | readonly                   | Fix A activity section is read-only on purpose.                  |

### QA/Approval investigation outcome

Fix B deferred the QA ticks and the Approval date / priority / client-note citing "sheet-form
submit path (auto-reset gate + bulk save)". The claim is partly accurate and partly inaccurate:

- **ACCURATE for internal/client status.** The state-machine action `moveCreativeSheetItemAction`
  runs the two-track gate and applies the QA auto-reset via `qaResetFor` (see
  `creative-sheet/move-brief.ts:53` and `creative-design/actions.ts:869`). Routing status moves
  through `updateBriefPartialAction` would skip both. Keep these on the state machine.
- **INACCURATE for dueDate / priority / clientStatusNote.** All three are plain columns on
  `creative_briefs` (migration 0001 / 0043 / 0068). None triggers the QA auto-reset. Fix C wires
  them inline.
- **PARTIAL for QA ticks.** The ticks themselves do not trigger the auto-reset (the reset fires
  on a status move only). Routing them through `updateBriefPartialAction` would be safe. The
  reason Fix C still leaves them on the sheet form is cosmetic — the sheet form already saves them
  in one bulk Save; inline + bulk would race on which one wrote last for no new user value.

### Link editor live-reachable

YES. The three `link` kind fields in the sidebar (Concept, Angle, Product) now receive brand-scoped
options from `loadConcepts` / `loadAngles` / `loadProducts` (all `withBrand(brandId)` scoped at
the data layer), reach InlineField's `link` case, and render ChipRow pickers. The new-brief
dialogs' `conceptId` field also reaches the same path through the same primitive.

### Playwright scenarios

- `@brief-sidebar-edit` — presence check unchanged; the full write path still requires live Clerk
  per-user fixtures. The `test.fixme` guard stays.
- `@brief-dialog-edit` — the demo-mode `batchInput.fill('B9')` + preview assertion stays green
  (batch is not a `new-dialog` surface, so the batch input stays a plain `<Input>`). The
  `test.fixme` guard on the full submit path stays.
- `@brief-grid-edit` — unchanged. Grid cell inline edit is Fix D.
- `@brief-permission` — unchanged. The demo-mode presence check (no inline-field data-slot in
  the sidebar's Identity section) stays — in demo mode `canInlineEdit` is false because
  `actorUserId` is null, so the sidebar renders the readonly chrome.

### Fix D scope statement — AirtableGrid cell inline edit

The grid stays read-only after Fix C. `AirtableGrid`'s cell renderer is
`render(row) => ReactNode`, with no actor / commit context flowing to the renderer registry.
Wiring a cell to InlineField needs either a React context carrying
`{actorRole, actorUserId, onUpdate, options}` through `CREATIVE_SHEET_RENDERERS` and the 24 other
registries that extend `AirtableGrid`, or a factory shape over the registry itself so a cell
renderer can accept parent-scoped dependencies. Both are nontrivial rewrites that cross 25+
callers of `AirtableGrid` across the product — Fix D's exclusive scope. The two outstanding
`test.fixme` Playwright scenarios (`@brief-grid-edit` and the per-user disabled-editor matrix
under `@brief-permission`) also wait on this; they land once the registry refactor completes.
