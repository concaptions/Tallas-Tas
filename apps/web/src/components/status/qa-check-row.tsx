import type { ReactNode } from 'react';
import { Checkbox, cn } from '@tas/ui';

/**
 * One QA tick as every surface draws it (Oct 12 UI overhaul, B4.V3 / B4.V17): the `@tas/ui`
 * Checkbox, the reviewer's label, and a mono tag on the right — `Required` in warn while a
 * required tick is unset, the N/A tag in text4 for the tick the other track owns (that row also
 * takes the dashed box and a struck-through label, board 2's full-record rule), nothing once a
 * required tick is set. The brief page, the Sheet sidebar and Focus Mode each drew their own
 * row with three tag recipes; this is the one row, so the three cannot drift again.
 *
 * The row is deliberately dumb: whether a tick is required comes from `qaChecklistFor` in
 * `@tas/domain/state`, and the write belongs to the caller (`onCheckedChange`). The input keeps
 * the caller's `data-slot` and carries `data-check`, so each surface's locators
 * (`brief-qa-check`, `focus-qa-check`) survive the move.
 */
export interface QaCheckRowProps {
  /** The input's `id`, which the label targets. */
  readonly id: string;
  /** The tick's stored key (`qaVideoEditor`, …) — `data-check` on the input and the row. */
  readonly checkKey: string;
  /** The input's `data-slot`, one per surface, so a spec keeps its locator. */
  readonly inputSlot: string;
  readonly label: string;
  /** Whether this creative's track needs the tick; false draws the N/A row. */
  readonly required: boolean;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  /** What the N/A tag says (`N/A · video`); the row never words it itself. */
  readonly notApplicableTag?: string;
  /** An optional second line under the label (Focus Mode's "Ticked" / "Required on the video track"). */
  readonly meta?: ReactNode;
  /** The element the row renders as: `li` inside a list (the default), `div` in a form group. */
  readonly as?: 'li' | 'div';
  readonly className?: string;
}

/** The board's `.qtag` (B4.V17): mono 10px, `.03em`, uppercase, toned by what it says. */
const TAG_CLASS = 'ml-auto shrink-0 font-mono text-[10px] tracking-[.03em] uppercase';

export function QaCheckRow({
  id,
  checkKey,
  inputSlot,
  label,
  required,
  checked,
  disabled = false,
  onCheckedChange,
  notApplicableTag,
  meta,
  as: Tag = 'li',
  className,
}: QaCheckRowProps) {
  const tag = !required ? (
    <span data-slot="qa-check-tag" data-kind="na" className={cn(TAG_CLASS, 'text-text4')}>
      {notApplicableTag ?? 'N/A'}
    </span>
  ) : checked ? null : (
    <span data-slot="qa-check-tag" data-kind="required" className={cn(TAG_CLASS, 'text-warn')}>
      Required
    </span>
  );

  return (
    <Tag
      data-slot="qa-check-row"
      data-check={checkKey}
      data-applicable={required ? 'true' : 'false'}
      className={cn('flex gap-2', meta === undefined ? 'items-center' : 'items-start', className)}
    >
      <Checkbox
        id={id}
        variant={required ? 'default' : 'na'}
        checked={checked}
        disabled={disabled}
        onChange={(event) => {
          onCheckedChange(event.target.checked);
        }}
        data-slot={inputSlot}
        data-check={checkKey}
        className={meta === undefined ? undefined : 'mt-0.5'}
      />
      <label
        htmlFor={id}
        className={cn(
          'flex min-w-0 flex-col text-xs',
          required ? 'text-text2' : 'text-text4 line-through decoration-text4',
        )}
      >
        <span>{label}</span>
        {meta === undefined ? null : <span>{meta}</span>}
      </label>
      {tag}
    </Tag>
  );
}
