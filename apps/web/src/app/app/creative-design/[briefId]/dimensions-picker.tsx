'use client';

import {
  Button,
  DEMO_WRITE_HINT,
  disabledWriteClassName,
  DisabledWrite,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@tas/ui';

import { BRIEF_DIMENSION_OPTIONS, BRIEF_DIMENSIONS_SAVE_LABELS, BRIEF_HEADINGS } from '../fields';

/** Where the last save-on-tick got to, as the page reports it. */
export type DimensionsSaveState =
  | { readonly status: 'idle' }
  | { readonly status: 'pending' }
  | { readonly status: 'saved' }
  | { readonly status: 'error'; readonly error: string };

export interface BriefDimensionsPickerProps {
  /** The ratios ticked right now: the stored array, normalised, or the page's optimistic copy. */
  readonly selected: readonly string[];
  /** Demo mode: the control is inert, with the usual reason on hover. */
  readonly disabled: boolean;
  readonly saveState: DimensionsSaveState;
  /**
   * Called SYNCHRONOUSLY with the ratio on every tick and untick. The page's handler is the server
   * action — there is no Save button between a tick and the write, which is what the 2026-10-10
   * smoke test found missing: the items only set React state, and refresh reverted the tick.
   */
  readonly onToggle: (key: string) => void;
}

/**
 * The brief page's Dimensions picker: one `DropdownMenuCheckboxItem` per §8 ratio, ticked when the
 * brief carries it. Hook-free on purpose, like the Creative Sheet's `DimensionsField`: every tick
 * goes straight out through `onToggle`, so the component holds no draft the server has not seen
 * and a test can drive it as a function. `onSelect` is prevented so the menu stays open across
 * several ticks.
 */
export function BriefDimensionsPicker({
  selected,
  disabled,
  saveState,
  onToggle,
}: BriefDimensionsPickerProps) {
  return (
    <div className="flex flex-col gap-1.5" data-slot="brief-dimensions-picker">
      <div className="flex items-center gap-2">
        <DisabledWrite active={disabled} hint={DEMO_WRITE_HINT}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                data-slot="brief-dimensions-trigger"
                className={disabledWriteClassName}
              >
                {selected.length === 0
                  ? BRIEF_DIMENSIONS_SAVE_LABELS.none
                  : `${String(selected.length)} selected`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>{BRIEF_HEADINGS.dimensions}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {BRIEF_DIMENSION_OPTIONS.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.key}
                  checked={selected.includes(option.key)}
                  onCheckedChange={() => {
                    onToggle(option.key);
                  }}
                  onSelect={(event) => {
                    event.preventDefault();
                  }}
                  data-slot="brief-dimension-option"
                  data-dimension={option.key}
                >
                  <span className="font-mono text-xs">
                    {option.label}
                    <span className="pl-2 text-text3">{option.pixels}</span>
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </DisabledWrite>
        {saveState.status === 'pending' ? (
          <span className="text-xs text-text3" data-slot="brief-dimensions-pending">
            {BRIEF_DIMENSIONS_SAVE_LABELS.pending}
          </span>
        ) : saveState.status === 'saved' ? (
          <span className="text-xs text-ok" data-slot="brief-dimensions-saved">
            {BRIEF_DIMENSIONS_SAVE_LABELS.saved}
          </span>
        ) : (
          <span className="text-xs text-text4">{BRIEF_DIMENSIONS_SAVE_LABELS.hint}</span>
        )}
      </div>
      {saveState.status === 'error' ? (
        <p className="text-xs text-bad" data-slot="brief-dimensions-error">
          {saveState.error}
        </p>
      ) : null}
    </div>
  );
}
