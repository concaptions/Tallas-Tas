# Design handoff — TAS Creative Platform

Source: the Claude Design bundle handoff (2026-09-16). The bundle file itself was never delivered, so
this document is the authoritative specification. Every value below is verbatim from the handoff.

Non-negotiable: every colour goes through the token layer. No hex literal in any component.

## Palette — warm dark (default)

```
--bg:           #14110F
--bg-deep:      #0D0B0A
--surface:      #1C1916
--surface2:     #221C17
--surface3:     #241F1B
--surface4:     #2B251F
--line:         #2E2823
--line2:        #3B332B
--text:         #EAE4DB
--text2:        #CFC6B9
--text3:        #948A7F
--text4:        #756A60
--accent:       #D98B4A
--accent-line:  #B36A2B
--accent-soft:  color-mix(in srgb, #D98B4A 22%, transparent)
--ok:           #7A9B6B
--warn:         #C69A46
--bad:          #AB6753
--info:         #7688A0
--mono:         'JetBrains Mono', ui-monospace, monospace
--sans:         'Inter', ui-sans-serif, system-ui
```

## Palette — warm light (theme switch)

```
--bg:           #FAF8F5
--surface:      #FFFDFA
--surface2:     #F3EFE9
--surface3:     #EDE7E0
--surface4:     #E2DBD1
--line:         #CFC6B9
--line2:        #A79D93
--text:         #241F1B
--text2:        #3B332B
--text3:        #6B6057
--text4:        #948A7F
--accent:       #93513D
--accent-line:  #93513D
--accent-soft:  color-mix(in srgb, #93513D 18%, transparent)
```

`--bg-deep`, `--ok`, `--warn`, `--bad`, `--info`, `--mono` and `--sans` are not redefined by the light
theme; the dark values carry over (open question DS-Q2).

## Typography and shape

- Inter 400, 500, 600 and JetBrains Mono 400, 500 through `next/font/google`.
- Body uses `--sans`. Auto-generated system output (concept names, creative names, IDs) always uses `--mono`.
- Radii: 6px inputs and chips, 8px cards. No pill buttons.
- Dark is the default theme.

## Semantic Tailwind classes

The tokens are exposed as utilities: `bg-bg`, `bg-surface`, `bg-surface2`, `bg-surface3`, `bg-surface4`,
`border-line`, `border-line2`, `text-text`, `text-text2`, `text-text3`, `text-text4`, `bg-accent`,
`text-accent`, `border-accent-line`, `bg-accent-soft`, `text-ok`, `text-warn`, `text-bad`, `text-info`,
`font-sans`, `font-mono`, `rounded-input`, `rounded-card`.

## Status values (verbatim; source of truth for tooltips, notifications, analytics labels)

```ts
export const INTERNAL_VIDEO_STATUS = [
  {
    key: 'sent_to_video_editor',
    label: 'Sent to Video Editor',
    description: 'Set when the strategist submits the brief and assigns an editor.',
  },
  {
    key: 'video_editing_in_progress',
    label: 'Video Editing in Progress',
    description: 'Editor opened the brief and claimed it.',
  },
  {
    key: 'ad_submitted',
    label: 'Ad Submitted',
    description: 'Editor uploaded a cut and marked the brief submitted.',
  },
  {
    key: 'videos_revisions',
    label: 'Videos Revisions',
    description: 'Internal reviewer left revisions. Client never sees this state.',
  },
  {
    key: 'revisions_submitted',
    label: 'Revisions Submitted',
    description: 'Editor re-uploaded against the revision notes.',
  },
  {
    key: 'approved',
    label: 'Approved',
    description: 'Internal sign-off. This is the gate that opens the client track.',
  },
  { key: 'launched', label: 'Launched', description: 'Media buyer confirmed the ad is live.' },
] as const;

export const CLIENT_STATUS = [
  {
    key: 'pending_for_approval',
    label: 'Pending for Approval',
    description: 'Visible to the client the moment internal status hits Approved.',
  },
  {
    key: 'approved',
    label: 'Approved',
    description: 'Client signed off. Moves to the media buyer queue.',
  },
  {
    key: 'launched',
    label: 'Launched',
    description: 'Set by the media buyer once the ad is live in the account.',
  },
] as const;
```

`INTERNAL_STATIC_STATUS` is the same shape with `sent_to_designer` / "Sent to Designer",
`static_design_in_progress` / "Static Design in Progress" and `images_revisions` / "Images Revisions" in
place of the three video entries. `Ad Submitted`, `Revisions Submitted`, `Approved` and `Launched` are
unchanged.

`on_hold` ("On Hold") is a branchable non-linear state between `*_in_progress` and `ad_submitted`. It is
rendered as a side badge on the current step row, never as a step in the linear stepper.

## The gate

```ts
export function isClientTrackOpen(internal: InternalStatusKey): boolean {
  return internal === 'approved' || internal === 'launched';
}
```

Every UI that renders the client track imports `isClientTrackOpen`. No component computes this itself.

## Two-Track Approval widget

Props:

```ts
type Props = {
  track: 'video' | 'static';
  internal: InternalStatusKey;
  client: ClientStatusKey;
  clientOnly?: boolean; // hides the internal bar entirely; used on the client interface
  onAdvanceInternal?: () => void;
  onAdvanceClient?: () => void;
};
```

- Internal status earlier than Approved: the client bar is dimmed at `opacity:.42; filter:saturate(.4)`,
  its chip reads `locked` in the muted tone, and the note reads
  "Opens when internal status reaches Approved."
- Internal status Approved or Launched: the client bar animates to full opacity and saturation over
  500ms, the border switches from `--line` to `--accent-line`, and the note reads
  "Client track is live. The client sees only this bar."
- `clientOnly`: the internal bar is not rendered and the client bar is always live, never dimmed.
- Stepper marks: done steps use a `--text3` dot, the current step an `--accent` dot with a 3px
  `--accent-soft` halo, upcoming steps a hollow ring in `--line2`.
- Status chip: monospace, 10.5px, letter-spacing 0.03em, tone-mapped border, background a 13% colour mix
  of the tone. Tone map: Approved is `ok`, Launched is `accent`, any `Revisions` label (not `Submitted`)
  is `warn`, `Pending for Approval` is `info`, everything else is muted.
- Transitions on the client bar wrapper are pure CSS: 500ms ease on opacity, border-color and filter.

## Shared primitives

- `StatusChip({ tone: 'ok' | 'warn' | 'bad' | 'info' | 'accent' | 'mute', label })` — the chip above.
- `StepRow({ label, tip, state: 'done' | 'now' | 'next', isLast, badge? })` — the step row above.

No other component re-implements either one.

## Governance

Every UI change, in this order:

1. Import tokens from the palette, never a hex.
2. Import status values from `@tas/domain/state`, never a magic string.
3. Import `StatusChip` and `StepRow` from `@tas/ui`, never re-implement them.
4. Render on the `/design-system` page before the work is called done.

Deviations require an entry in `docs/decisions.md`.
