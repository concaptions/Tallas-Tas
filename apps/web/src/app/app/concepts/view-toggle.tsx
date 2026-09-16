'use client';

import { CONCEPT_VIEW_OPTIONS, type ConceptView } from './fields';

interface ViewToggleProps {
  readonly view: ConceptView;
  readonly onChange: (next: ConceptView) => void;
}

/**
 * Table or board, over the same rows (ticket criterion 2).
 *
 * Two controls, never a dropdown: there are exactly two views and both are worth a single click.
 * They are `button`s rather than links because switching a view is not a navigation — the rows are
 * already loaded, the workspace re-renders them, and the URL is written with the History API by the
 * caller, so a refresh or a shared link restores the view without a server round trip.
 *
 * `rounded-input`, never `rounded-full`: the handoff has no pill controls. The selected control
 * carries `aria-pressed` and `data-state="on"`, so what is selected is legible to a screen reader,
 * to the E2E spec and to the eye, rather than by colour alone.
 */
export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div
      data-slot="concepts-view-toggle"
      role="group"
      aria-label="View"
      className="inline-flex items-center gap-1 rounded-input border border-line bg-surface2 p-0.5"
    >
      {CONCEPT_VIEW_OPTIONS.map((option) => {
        const on = option.value === view;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            data-slot="concepts-view-option"
            data-view={option.value}
            data-state={on ? 'on' : 'off'}
            onClick={() => {
              onChange(option.value);
            }}
            className={
              on
                ? 'rounded-input border border-accent-line bg-accent-soft px-3 py-1 font-mono text-[11px] tracking-wide text-accent uppercase'
                : 'rounded-input border border-transparent px-3 py-1 font-mono text-[11px] tracking-wide text-text3 uppercase hover:text-text2'
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
