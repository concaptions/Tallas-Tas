'use client';

import {
  creativeDimensionDisplay,
  dimensionOptionsFor,
  normalizeCreativeDimensions,
} from '@tas/domain/creatives';
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusChip,
} from '@tas/ui';

import { DIMENSIONS_ADD_PLACEHOLDER, DIMENSIONS_SAVE_LABELS, SHEET_LABELS } from './fields';

/** Where the last immediate save of the Dimensions field got to, as the panel reports it. */
export type DimensionsSaveState =
  | { readonly status: 'idle' }
  | { readonly status: 'pending' }
  | { readonly status: 'saved' }
  | { readonly status: 'error'; readonly error: string };

export interface DimensionsFieldProps {
  /** The row's stored array, raw: §8 keys and/or imported placement names. */
  readonly value: readonly string[];
  /**
   * Called SYNCHRONOUSLY with the new array on every pick and every chip removal. The panel's
   * handler is the server action — there is no Save button between a choice and the write, which
   * is the whole difference from the brief page's picker.
   */
  readonly onChange: (next: readonly string[]) => void;
  /** Demo mode, or a row that has no id yet to write to. */
  readonly disabled: boolean;
  readonly saveState: DimensionsSaveState;
}

const FIELD_ID = 'creative-sheet-field-dimensions';
const LABEL_CLASS = 'text-[11px] tracking-wide text-text3 uppercase';

/** The Select is always on its placeholder: it ADDS a value; the chips show what is stored. */
const NO_SELECTION = '';

/**
 * The Creative Sheet's Dimensions field: the stored ratios as removable chips, plus one `Select`
 * that adds a ratio. Hook-free on purpose: every change goes straight out through `onChange`, so
 * the component holds no draft the server has not seen and a test can drive it as a function.
 *
 * The options are the three §8 ratios and every legacy name the row already carries
 * (`dimensionOptionsFor`), so an Airtable-imported value stays visible and re-selectable rather
 * than vanishing because this build has no entry for it. A mapped name (`'IG Story / Reel'`) is
 * shown and stored as its ratio; an unknown one is shown and stored as itself.
 */
export function DimensionsField({ value, onChange, disabled, saveState }: DimensionsFieldProps) {
  const selected = normalizeCreativeDimensions(value);
  const options = dimensionOptionsFor(value);

  const add = (key: string): void => {
    const next = normalizeCreativeDimensions([...selected, key]);
    if (next.length === selected.length) return;
    onChange(next);
  };

  const remove = (key: string): void => {
    onChange(selected.filter((entry) => entry !== key));
  };

  return (
    <div data-slot={FIELD_ID} className="flex flex-col gap-1.5">
      <Label htmlFor={FIELD_ID} className={LABEL_CLASS}>
        {SHEET_LABELS.dimensions}
        <span className="ml-1.5 text-text4 normal-case">{DIMENSIONS_SAVE_LABELS.hint}</span>
      </Label>
      <div
        className="flex flex-wrap items-center gap-1.5"
        data-slot="creative-sheet-dimension-chips"
      >
        {selected.length === 0 ? (
          <span className="text-xs text-text4">{DIMENSIONS_SAVE_LABELS.none}</span>
        ) : (
          selected.map((key) => (
            <span key={key} className="inline-flex items-center gap-1">
              <StatusChip tone="mute" label={creativeDimensionDisplay(key)} />
              {disabled ? null : (
                <button
                  type="button"
                  onClick={() => {
                    remove(key);
                  }}
                  aria-label={`Remove ${creativeDimensionDisplay(key)}`}
                  data-slot="creative-sheet-dimension-remove"
                  data-dimension={key}
                  className="rounded-input px-1 text-xs text-text3 hover:text-text2"
                >
                  ×
                </button>
              )}
            </span>
          ))
        )}
      </div>
      <div className="flex items-center gap-2">
        <Select value={NO_SELECTION} onValueChange={add} disabled={disabled}>
          <SelectTrigger id={FIELD_ID} className="w-full" aria-label={SHEET_LABELS.dimensions}>
            <SelectValue placeholder={DIMENSIONS_ADD_PLACEHOLDER} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem
                key={option.key}
                value={option.key}
                data-slot="creative-sheet-dimension-option"
                data-dimension={option.key}
              >
                <span className="font-mono text-xs">{option.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {saveState.status === 'pending' ? (
          <span className="text-xs text-text3" data-slot="creative-sheet-dimensions-pending">
            {DIMENSIONS_SAVE_LABELS.pending}
          </span>
        ) : saveState.status === 'saved' ? (
          <span className="text-xs text-ok" data-slot="creative-sheet-dimensions-saved">
            {DIMENSIONS_SAVE_LABELS.saved}
          </span>
        ) : null}
      </div>
      {saveState.status === 'error' ? (
        <p className="text-xs text-bad" data-slot="creative-sheet-dimensions-error">
          {saveState.error}
        </p>
      ) : null}
    </div>
  );
}
