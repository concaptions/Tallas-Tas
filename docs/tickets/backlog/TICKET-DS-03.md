# TICKET-DS-03 · Two-Track Approval widget

- Owner: frontend (`packages/ui/src/approval/**`, `apps/web/src/app/(dev)/design-system/two-track/**`, `apps/web/e2e/**`)
- Size: M
- Depends on: TICKET-DS-01, TICKET-DS-02
- PRD: §9 (two tracks; a creative appears to the client only once internally approved)
- Design: handoff "TICKET-DS-03" (states, dimming, chip, stepper, transition values)

## Why

The first real component of the design system, and the one that makes non-negotiable 4 visible: the
client bar is inert until the internal track reaches Approved.

## Acceptance criteria

1. `packages/ui/src/approval/two-track.tsx` exports `TwoTrackApproval` with props exactly:
   ```ts
   type Props = {
     track: 'video' | 'static';
     internal: InternalStatusKey;
     client: ClientStatusKey;
     clientOnly?: boolean;
     onAdvanceInternal?: () => void;
     onAdvanceClient?: () => void;
   }
   ```
   Status lists, labels, descriptions, `isClientTrackOpen`, `stepState` and `chipTone` are imported from
   `@tas/domain/state`; the component computes nothing about legality itself.
2. Internal bar: title, the linear stepper of the track's states (excluding `on_hold`), the current state's
   chip top-right, and the step descriptions as tooltips (`title` attribute plus a visible tip line on the
   current step). When `internal === 'on_hold'` the stepper marks the `*_in_progress` row as current and
   renders a small side badge "On Hold" on that row (not a separate step).
3. Client bar: stepper of `CLIENT_STATUS`, chip top-right, and a note line. Closed (gate false): wrapper
   has `opacity: .42; filter: saturate(.4)`, border `--line`, chip shows `locked` in the mute tone, note
   "Opens when internal status reaches Approved." Open (gate true): opacity 1, filter none, border
   `--accent-line`, chip shows the client state in its tone, note "Client track is live. The client sees
   only this bar." The wrapper transitions `opacity, border-color, filter` over `500ms ease` in CSS.
4. `clientOnly`: the internal bar is not rendered and the client bar is always open, never dimmed.
5. Stepper marks: done → solid dot `--text3`; now → solid dot `--accent` with a 3px halo of
   `--accent-soft` (box-shadow); next → hollow ring in `--line2`. Connector lines between steps use `--line`.
6. Chip: monospace 10.5px, letter-spacing 0.03em, `rounded-input`, 1px border in the tone colour, background
   `color-mix(in srgb, <tone> 13%, transparent)`, text in the tone colour; mute tone uses `--text3` and
   `--line2`. Tone comes from `chipTone(label)`. All colours are token classes or `var(--token)`; the hex lint
   from DS-01 passes.
7. Radii: bars `rounded-card`, chips `rounded-input`. Advance buttons (when the callbacks are provided) are
   shadcn `Button` variants, never pill.
8. Stories: `packages/ui/src/approval/two-track.stories.tsx` exports a CSF-compatible default
   (`{ title: 'Approval/TwoTrack', component }`) and named stories: one per internal video state (seven),
   `OnHold`, `ClientOnly`, `StaticTrack`, plus `Interactive` (local state, both advance callbacks wired
   through the domain transition tables, illegal advances disabled). No Storybook dependency: the page
   `apps/web/src/app/(dev)/design-system/two-track/page.tsx` renders every story with its name as a heading
   and an `id` anchor (decision entry: stories are CSF modules rendered by the design-system pages).
9. Playwright `apps/web/e2e/two-track.spec.ts` on the `Interactive` story: clicks "Advance internal"
   through every state and asserts, after each click, the client bar's computed `opacity` is `0.42` for
   every state before Approved and `1` for Approved and Launched (`toHaveCSS` waits out the 500ms
   transition); asserts the chip text and note text in both modes; asserts `ClientOnly` renders no
   internal bar.
10. Vitest (`@testing-library/react`) `two-track.test.tsx`: renders each story and asserts the DOM
    structure (bar count, chip text, `data-state` attributes on step rows, `aria-disabled` on the closed
    client bar).
11. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` green.

## Gated criteria (D-008)

- Pixel parity with the bundled artifact: the artifact file was not delivered (DS-Q1). Geometry (spacing,
  font sizes other than the chip, bar padding) follows the written handoff and sensible defaults from the
  token scale; a follow-up TICKET-DS-03b "parity pass" runs once the file arrives:
  `pnpm test:e2e -- two-track` with baselines regenerated from the artifact.

## Files touched

`packages/ui/src/approval/two-track.tsx`, `two-track.stories.tsx`, `two-track.test.tsx`,
`packages/ui/src/index.ts`, `apps/web/src/app/(dev)/design-system/two-track/page.tsx`,
`apps/web/e2e/two-track.spec.ts`, `docs/decisions.md`.

## Notes

- Build the chip and the step row as internal helpers inside the widget file in this ticket;
  TICKET-DS-04 extracts them to `packages/ui/src/status/`. Do not export them from this ticket.
- The client bar's closed state must also be inert: the advance button is disabled and the bar carries
  `aria-disabled="true"`.
- No business logic beyond calling the domain functions; the widget never decides legality.
