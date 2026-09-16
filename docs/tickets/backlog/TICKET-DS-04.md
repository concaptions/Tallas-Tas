# TICKET-DS-04 · Extract StatusChip and StepRow into shared UI

- Owner: frontend (`packages/ui/src/status/**`, `packages/ui/src/approval/two-track.tsx`)
- Size: S
- Depends on: TICKET-DS-03
- PRD: §5.7, §5.8, §5.10, §5.11 (every status-bearing record), §11 (brand switcher status dot)
- Design: handoff "TICKET-DS-04"

## Why

The chip and the step row are used by every status-bearing UI (Concept card, Creative Brief card, UGC
creator card, brand switcher status dot, propagation review timeline). One implementation, imported
everywhere.

## Acceptance criteria

1. `packages/ui/src/status/status-chip.tsx` exports `StatusChip({ tone, label, className? })` with
   `tone: 'ok' | 'warn' | 'bad' | 'info' | 'accent' | 'mute'`, rendering exactly the chip of DS-03
   criterion 6 (mono 10.5px, 0.03em, 1px tone border, 13% colour-mix background, `rounded-input`).
2. `packages/ui/src/status/step-row.tsx` exports `StepRow({ label, tip, state, isLast, badge? })` with
   `state: 'done' | 'now' | 'next'`, rendering the marks of DS-03 criterion 5, the connector unless
   `isLast`, the tip line when `state === 'now'`, and an optional side badge (used for On Hold).
3. `TwoTrackApproval` imports both and contains no chip or step-row styling of its own; the DS-03 tests
   and E2E still pass unchanged.
4. `packages/ui/src/status/index.ts` re-exports both; `@tas/ui` root re-exports `status`.
5. Unit tests: `status-chip.test.tsx` renders every tone and asserts the tone class and label;
   `step-row.test.tsx` renders the three states, `isLast`, and the badge.
6. Governance: ESLint `no-restricted-syntax` (or a Vitest grep test) fails on any file under
   `apps/web/src` or `packages/ui/src` other than `status-chip.tsx` that sets `letter-spacing: 0.03em`
   together with a 10.5px font size, the chip's signature. CLAUDE.md governance rule 3 references
   `StatusChip` and `StepRow` by path.
7. Both primitives render on the design-system page (`/design-system/status`) with every variant.

## Gated criteria (D-008)

none.

## Files touched

`packages/ui/src/status/*`, `packages/ui/src/approval/two-track.tsx`, `packages/ui/src/index.ts`,
`apps/web/src/app/(dev)/design-system/status/page.tsx`.

## Notes

- Keep `StatusChip` presentational: it takes a tone, never a status key. Callers compute the tone with
  `chipTone` from `@tas/domain/state`.
