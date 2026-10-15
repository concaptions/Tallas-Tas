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
