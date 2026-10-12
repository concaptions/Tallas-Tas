# Oct 12 client sync — UI overhaul (FOCUS-01 … QA-05)

**PRD sections**: §5.10 (Creative Briefs / Creative Design), §9 (two-track approval; the client gate),
§7 (names are generated, never typed), §10 (comments).

**Design handoff**: `tas-ui-overhaul.zip` (six boards, 2026-10-12). Pure UI, component and minor
logic changes: no new tables, no migrations. The boards are titled "Creative Design"; the live home of
the briefs is the Creative Sheet (`/app/creative-sheet`, a view over `creative_briefs` since 2026-10-09;
the Creative Design list redirects there), so every surface lands on the sheet and on the brief's page.

| Ticket   | Scope |
| -------- | ----- |
| FOCUS-01 | Focus Mode: a third view beside Grid and Kanban (`ViewType 'focus'`). One creative full width, prev/next (buttons and arrow keys), `07 / 23` counter, name and both chips, Request Changes / Approve / Submit to Client, Identity and Status facts, the QA checklist FILTERED BY TYPE with the gate box, asset preview, Script / Brief to Design / Elements tested / Offer cards, Feedback & Comments (read, post). `focus-mode.ts` + `focus-mode-view.tsx` |
| SHEET-02 | Brief row sidebar: shadcn/ui `Sheet` (`@tas/ui`, side right) replacing the fixed panel. Six sections — Identity, Status, Content, QA, Assets, Meta — titled with the brief name; the non-applicable QA tick struck through with an N/A tag; footer: Focus Mode, Open full page, Save. Every existing control and `data-slot` kept. `creative-sheet-panel.tsx` |
| MULTI-03 | Multi-select and duplicate: checkbox as the first grid column with an indeterminate header, right-click context menu (Duplicate ⌘D, Open in Focus Mode, Copy link, Delete), floating action bar (Duplicate (n), Change status, Delete (n), Clear). Duplicate copies every field, bumps the version, names the copy through the formula (auto) or by bumping the version segment (manual), resets QA and both tracks to their entry states (`sent_to_video_editor` / `sent_to_designer` — there is no `draft`), keeps `name_mode`. Delete is a soft delete. `review-actions.ts`, `duplicate-values.ts`, `components/views/{airtable-grid,row-context-menu,selection-bar}.tsx` |
| QA-04    | QA gate: `canSubmitToClient()` in `@tas/domain/state/qa-gate.ts`, additive to `isClientTrackOpen()`. Applied in Focus Mode's bar, the brief page's approval rail (Advance to Approved, the client-status Save), the sheet's save and Kanban drop, the bulk Change status, and RE-RUN by every Server Action before it writes. |
| QA-05    | QA auto-reset: a move into `videos_revisions`, `images_revisions` (internal) or `revisions_needed` (client) clears the three ticks in the SAME statement as the status (`qaResetFor`; `updateBriefClientStatus` carries the columns alongside). |

## Decisions taken while building (see `docs/decisions.md`, 2026-10-12)

- The brief name's **version segment** is `V1`–`V9`; the Oct 5 formula's `V007` head is the brief's
  NUMBER and is never bumped (`duplicateManualName`).
- **"Submit to Client" in this schema**: `client_status` is NOT NULL and starts at
  `pending_for_approval`, so a creative is in the client's queue the moment internal status reaches
  Approved. The QA gate therefore guards the two moves that put a creative in front of the client:
  internal → Approved (Focus Mode's Approve, the page's Advance, the sheet's select and drops) and the
  client-track resubmission `revisions_needed` → `revisions_submitted` (Focus Mode's Submit to Client).
  Board 1 showed Approve enabled with QA incomplete; here it is gated, because Approve is what sends
  the creative to the client. A creative already pending with the client has nothing to submit, and
  the button says so.
- Client revisions (`revisions_needed`) also reset QA, as board 5 proposed (the open question in the
  handoff's footer): the asset is re-cut either way.
- `performance`, `legacy_airtable_id`, the template columns and the client stamp/note/launch are not
  copied by Duplicate: they describe the source ad, not the new cut.

## Acceptance criteria

- [x] `ViewType` carries `focus`; the Creative Sheet offers Grid, Kanban, Focus Mode; `?view=focus`
      and the saved preference round-trip; the creative in focus is `?creative-sheet=`.
- [x] Focus Mode's three buttons are enabled exactly when the matching Server Action would succeed
      (`focus-mode.test.ts`, `review-actions.test.ts`); a disabled one carries the action's refusal.
- [x] A video brief never renders Graphic Designer QA in Focus Mode; the sidebar renders all three
      with the N/A one struck through (`qa-gate.test.ts`, `focus-mode.test.ts`).
- [x] `canSubmitToClient` by track: video editor + strategist / designer + strategist / strategist
      alone; `submitToClientRefusal` composes the internal gate first.
- [x] Every status writer re-runs the gate and lands the QA reset in the same patch
      (`status-guard.test.ts`, `actions.test.ts`, `update-brief-gate.test.ts`,
      `client-status-actions.test.ts`, `briefs.test.ts`).
- [x] Duplicate's copy-and-reset rules, Delete's soft delete, bulk Change status as strict as one
      move (`review-actions.test.ts`, `duplicate-name.test.ts`).
- [x] The grid's selection helpers (`airtable-grid-logic.test.ts`); the Sheet primitive (`sheet.test.tsx`).
- [x] `/design-system` mounts Focus Mode, the sidebar and the multi-select grid as stories.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter @tas/web build:ci`.
- [ ] Playwright (demo): `creative-sheet.spec.ts` — the Focus Mode tab, the sidebar's sections, the
      selection checkbox and bar, the context menu. Written; not run here (no browser in this session).

## Pending human verification

- Run `pnpm test:e2e -- creative-sheet.spec.ts briefs.spec.ts` locally.
- Live, on Gratsi: open a video brief at Ad Submitted with no ticks → Approve is held with
  "Video Editor QA must be ticked…"; tick both → Approve; send it back from the portal
  (Revisions Needed) → both ticks clear; re-tick → Submit to Client → Revisions Submitted.
- Live: select two rows → Duplicate (2) → two copies at the ladder's first step, version +1, QA
  clear; Delete (1) → the row leaves the sheet, the queues and the portal; the row is soft-deleted.
