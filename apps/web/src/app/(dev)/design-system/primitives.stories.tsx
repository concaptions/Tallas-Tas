import {
  Button,
  Checkbox,
  DEMO_WRITE_HINT,
  DisabledWrite,
  disabledWriteClassName,
  SectionLabel,
  StatusChip,
} from '@tas/ui';
import { Check, Lock } from '@tas/ui/icons';
import { BRIEF_QA_CHECK_LABELS, qaGateReason, QA_RESET } from '@tas/domain/state';

import { QA_GATE_HEADING } from '@/app/app/creative-sheet/focus-mode';

/**
 * The three `@tas/ui` primitives the Oct 12 UI overhaul added or extended (package 2 of
 * `docs/sprint-oct12-ui-gap.md`), each in every state the boards draw, so the reviewer can check
 * the drawn checkbox, the gate popover and the section slab against boards 1–5 without opening a
 * product page. A server module on purpose: none of these states needs a handler, and the
 * `Checkbox` keeps its own state as a native input does (`server-safe-props.test.ts`).
 */

/**
 * Forces the CSS-only popover visible for review. The product shows it on hover and keyboard
 * focus alone (`group-hover/hint:visible`, `group-focus-within/hint:visible`); a story cannot
 * hover for the reader, so the wrapper's descendant rule overrides the primitive's `invisible`.
 */
export const POPOVER_OPEN_CLASS = '[&_[data-slot=disabled-write-popover]]:visible';

/** The first missing required tick of a video brief with no ticks: board 1's own tooltip. */
const QA_HINT = qaGateReason('video', QA_RESET) ?? '';

/** The drawn `Checkbox` (B2.V15): the five states boards 1, 2, 3 and 5 draw, plus disabled. */
export function CheckboxStory() {
  const states = [
    { id: 'ds-checkbox-off', label: 'Unchecked' },
    { id: 'ds-checkbox-on', label: 'Checked', defaultChecked: true },
    { id: 'ds-checkbox-some', label: 'Indeterminate (header, some rows)', indeterminate: true },
    { id: 'ds-checkbox-na', label: 'N/A — the other track’s tick', variant: 'na' as const },
    { id: 'ds-checkbox-disabled', label: 'Disabled', disabled: true },
    {
      id: 'ds-checkbox-disabled-on',
      label: 'Disabled, checked',
      disabled: true,
      defaultChecked: true,
    },
  ];
  return (
    <div className="grid gap-3 rounded-card border border-line bg-surface p-5 sm:grid-cols-2">
      {states.map(({ id, label, ...props }) => (
        <div key={id} className="flex items-center gap-2.5">
          <Checkbox id={id} {...props} />
          <label htmlFor={id} className="text-xs text-text2">
            {label}
          </label>
        </div>
      ))}
    </div>
  );
}

/**
 * `DisabledWrite` with the board 1 popover (B1.V6 / B1.A6): the QA refusal with its warn heading
 * and the missing tick in bold, the plain demo hint without a heading, and the closed state the
 * product starts from. The first two are held open by `POPOVER_OPEN_CLASS`; the third opens on
 * hover or keyboard focus, as every disabled write control does in the product.
 */
export function DisabledWritePopoverStory() {
  return (
    <div className="grid gap-6 rounded-card border border-line bg-surface p-5 sm:grid-cols-3">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] tracking-wide text-text4 uppercase">
          QA refusal — heading, bold tick (held open)
        </span>
        <div className="flex justify-end pb-24">
          <DisabledWrite
            hint={QA_HINT}
            heading={QA_GATE_HEADING}
            hintEmphasis={BRIEF_QA_CHECK_LABELS.qaVideoEditor}
            popover
            className={POPOVER_OPEN_CLASS}
          >
            <Button
              size="sm"
              variant="success"
              disabled
              className={`text-xs ${disabledWriteClassName}`}
            >
              <Check aria-hidden="true" className="size-3.5" strokeWidth={2.4} />
              Approve
            </Button>
          </DisabledWrite>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] tracking-wide text-text4 uppercase">
          Demo hint — no heading (held open)
        </span>
        <div className="flex justify-end pb-24">
          <DisabledWrite hint={DEMO_WRITE_HINT} popover className={POPOVER_OPEN_CLASS}>
            <Button size="sm" disabled className={`text-xs ${disabledWriteClassName}`}>
              <Lock aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
              Submit to Client
            </Button>
          </DisabledWrite>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] tracking-wide text-text4 uppercase">
          Closed — hover or focus it
        </span>
        <div className="flex justify-end pb-24">
          <DisabledWrite hint={QA_HINT} heading={QA_GATE_HEADING} popover>
            <Button size="sm" disabled className={`text-xs ${disabledWriteClassName}`}>
              Save
            </Button>
          </DisabledWrite>
        </div>
      </div>
    </div>
  );
}

/**
 * `SectionLabel` (B4.V5): the boards' `.slab` as the three elements it renders, and beside a chip
 * with `flex-1` so the rule fills to it, the way the two-track bars mount it.
 */
export function SectionLabelStory() {
  return (
    <div className="flex max-w-md flex-col gap-4 rounded-card border border-line bg-surface p-5">
      <SectionLabel as="h2">Identity — as h2</SectionLabel>
      <SectionLabel>QA Checklist — as h3, the default</SectionLabel>
      <SectionLabel as="p">Not a heading — as p</SectionLabel>
      <div className="flex items-center gap-2">
        <SectionLabel className="flex-1">Client</SectionLabel>
        <StatusChip tone="mute" label="locked" />
      </div>
    </div>
  );
}
