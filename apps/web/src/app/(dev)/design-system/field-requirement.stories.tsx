'use client';

import { REQUIRED_CONCEPT_FIELDS } from '@tas/domain/concepts';
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tas/ui';

import { NAME_PART_LABELS } from '@/app/app/concepts/fields';

/**
 * The required/optional marker on `Label` (UI governance rule 4, action item 37).
 *
 * THE PRIMITIVE, not a copy of it. `Label`'s `required` prop is what draws the word — nothing here
 * re-implements the marker — and the three states are shown side by side because the third one is
 * the point: a label that says NOTHING is different from one that says "Optional", and it is what
 * every form in the app renders today, so adding the prop moves nothing until a page opts in.
 *
 * The word rather than an asterisk: these labels live in panels, an asterisk needs a legend
 * somewhere on the page, and the legend is the first thing a split form loses. `aria-required` is
 * set on the CONTROL, never on the `<label>` — the trigger below carries `role="combobox"`, which
 * supports it, while a `<label>` has no role that does.
 */
export function FieldRequirementStory() {
  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-3">
        {[
          { required: true, note: 'the save path rejects a draft without it' },
          { required: false, note: 'the save path does not care' },
          { required: undefined, note: 'the form has made no claim — every label before this one' },
        ].map((state) => (
          <li key={String(state.required)} className="flex flex-col gap-1.5">
            <Label
              required={state.required}
              className="text-[11px] tracking-wide text-text3 uppercase"
            >
              Batch
            </Label>
            <p className="text-xs text-text3">
              <code className="font-mono text-[11px] text-text4">
                required={String(state.required)}
              </code>{' '}
              — {state.note}
            </p>
          </li>
        ))}
      </ul>

      {/*
        The pairing as the Concept form draws it. Which fields are marked is read from
        `REQUIRED_CONCEPT_FIELDS` in `@tas/domain/concepts` — the same set `validateConceptDraft`
        rejects a draft for — so a rule added in the domain shows up here and on the form together,
        and the page can never mark a different set than the server enforces.
      */}
      <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
        {(
          [
            ['batch', 'Batch', ['B1', 'B2', 'B3']],
            ['themeIds', NAME_PART_LABELS.themeName, ['Green Screen', 'Yapper Style']],
            ['conceptStyle', 'Concept Style', ['Editing', 'Static']],
          ] as const
        ).map(([field, label, options]) => {
          const required = (REQUIRED_CONCEPT_FIELDS as readonly string[]).includes(field);
          return (
            <div key={field} className="flex min-w-0 flex-col gap-1.5">
              <Label
                htmlFor={`story-requirement-${field}`}
                required={required}
                className="text-[11px] tracking-wide text-text3 uppercase"
              >
                {label}
              </Label>
              <Select>
                <SelectTrigger
                  id={`story-requirement-${field}`}
                  className="w-full"
                  aria-label={label}
                  aria-required={required ? true : undefined}
                  data-slot={`story-requirement-${field}`}
                >
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>

      {/* The marker sits on the label, so it works the same above any control. */}
      <div className="flex flex-col gap-1.5 border-t border-line pt-4">
        <Label
          htmlFor="story-requirement-text"
          required
          className="text-[11px] tracking-wide text-text3 uppercase"
        >
          Concept name
        </Label>
        <Input id="story-requirement-text" placeholder="Not set" readOnly />
      </div>
    </div>
  );
}
