'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import type { AngleListRow } from '@tas/db';
import { validateAngleDraft, type AngleTypeKey } from '@tas/domain/angles';
import {
  Button,
  DEMO_WRITE_HINT,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SoonChip,
  Textarea,
} from '@tas/ui';

import { createAngleAction, updateAngleAction, type AngleActionResult } from './actions';
import {
  ANGLE_FIELD_GROUPS,
  ANGLE_TYPES,
  NONE_OPTION_LABEL,
  NONE_VALUE,
  NOT_SET,
  TYPE_SOON_HINT,
  type AngleFieldName,
} from './fields';

/** The `?angle=` value that means "the panel is open on an angle that does not exist yet". */
export const NEW_ANGLE = 'new';

/** What the demo footer says instead of offering a save. */
export const DEMO_FOOTER_NOTICE = 'Demo mode — changes are not saved';

/** One row of a dropdown: the linked table's id and the name a strategist recognises. */
export interface LinkOption {
  readonly id: string;
  readonly name: string;
}

interface AnglePanelProps {
  readonly angle: AngleListRow | null;
  readonly personas: readonly LinkOption[];
  readonly products: readonly LinkOption[];
  readonly demo: boolean;
  readonly onClose: () => void;
  readonly onSaved: (id: string) => void;
}

/** The stored value of one prose field, as the form's default. */
function valueOf(angle: AngleListRow | null, name: AngleFieldName): string {
  if (angle === null) {
    return '';
  }
  const value = angle[name];
  return typeof value === 'string' ? value : '';
}

/**
 * The link editor always keeps one empty input at the bottom, so adding a link is typing rather
 * than clicking "Add" first. The action drops blank entries before it writes, which is what makes
 * that safe.
 */
function linkRowsOf(angle: AngleListRow | null): string[] {
  return [...(angle?.adInspoLinks ?? []), ''];
}

/**
 * The right-side angle panel (PRD §5.6). Deliberately not a modal: no backdrop, no focus trap, no
 * `aria-modal` — the table beside it stays visible and clickable while this is open, which is the
 * point of a panel. It is fixed to the right edge at 60% of the viewport, full width under 900px,
 * and it closes on Escape or on its close button.
 *
 * Six groups, in the order `fields.ts` states: Identity, Hypothesis, Pain Points, USP, Targeting
 * and Inspiration. Persona and Product are `Select` dropdowns over the rows the page loaded, never
 * free text, each with an explicit "None" whose value is `''` — which is exactly what the Server
 * Action stores as NULL. Formats are toggles that submit one repeated `formats` entry per selection;
 * Type is rendered the same way but inert, because this page does not write that column yet, so it
 * carries a `SoonChip` and says so on hover rather than pretending a click was saved.
 *
 * The save button is disabled by `validateAngleDraft` from `@tas/domain/angles` — the same function
 * the Server Action re-runs before it writes. No rule is restated here. In demo mode every write is
 * disabled through `DisabledWrite` and the footer says so instead of saving.
 */
export function AnglePanel({ angle, personas, products, demo, onClose, onSaved }: AnglePanelProps) {
  const creating = angle === null;
  const action = creating ? createAngleAction : updateAngleAction;
  const [state, formAction, pending] = useActionState<AngleActionResult | null, FormData>(
    action,
    null,
  );

  const [name, setName] = useState(valueOf(angle, 'name'));
  const [personaId, setPersonaId] = useState(angle?.personaId ?? NONE_VALUE);
  const [productId, setProductId] = useState(angle?.productId ?? NONE_VALUE);
  const formats = angle?.formats ?? [];
  const links = linkRowsOf(angle);

  const types: readonly AngleTypeKey[] = angle?.type ?? [];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (state !== null && state.ok) {
      onSaved(state.id);
    }
  }, [state, onSaved]);

  const draft = useMemo(
    () =>
      validateAngleDraft({
        name,
        personaId: personaId === NONE_VALUE ? null : personaId,
        formats,
        adInspoLinks: links,
      }),
    [name, personaId, formats, links],
  );

  /** The server's message for a field, or — while editing — the domain's own. */
  const fieldError = (field: AngleFieldName): string | undefined => {
    if (state !== null && !state.ok && state.fieldErrors?.[field] !== undefined) {
      return state.fieldErrors[field];
    }
    return undefined;
  };

  /** Why the save is inert, in the order a strategist can act on. */
  const blockedHint = demo
    ? DEMO_WRITE_HINT
    : (Object.values(draft.fieldErrors)[0] ?? 'Nothing to save yet.');
  const blocked = demo || !draft.ok;

  const renderProse = (field: { name: AngleFieldName; label: string; hint?: string }) => {
    const id = `angle-field-${field.name}`;
    const error = fieldError(field.name);
    const single = field.name === 'name';

    return (
      <div key={field.name} className="flex flex-col gap-1.5">
        <Label htmlFor={id} className="text-[11px] tracking-wide text-text3 uppercase">
          {field.label}
        </Label>
        {field.hint === undefined ? null : <p className="text-xs text-text3">{field.hint}</p>}
        {single ? (
          <Input
            id={id}
            name={field.name}
            readOnly={demo}
            aria-invalid={error !== undefined}
            placeholder={NOT_SET}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        ) : (
          <Textarea
            id={id}
            name={field.name}
            readOnly={demo}
            aria-invalid={error !== undefined}
            placeholder={NOT_SET}
            defaultValue={valueOf(angle, field.name)}
            className="min-h-24 leading-relaxed"
          />
        )}
        {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
      </div>
    );
  };

  const renderDropdown = (
    field: 'personaId' | 'productId',
    label: string,
    options: readonly LinkOption[],
    value: string,
    set: (next: string) => void,
  ) => {
    const id = `angle-field-${field}`;
    const error = fieldError(field);

    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id} className="text-[11px] tracking-wide text-text3 uppercase">
          {label}
        </Label>
        <Select
          value={value === NONE_VALUE ? undefined : value}
          onValueChange={set}
          disabled={demo}
        >
          <SelectTrigger id={id} className="w-full" aria-label={label} data-slot={`angle-${field}`}>
            <SelectValue placeholder={NONE_OPTION_LABEL} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* The stored value, including the "None" case: an empty string, which the action writes as NULL. */}
        <input type="hidden" name={field} value={value} />
        {value === NONE_VALUE || demo ? null : (
          <button
            type="button"
            onClick={() => {
              set(NONE_VALUE);
            }}
            className="self-start rounded-input text-xs text-text3 underline-offset-2 hover:text-text2 hover:underline"
          >
            Clear {label.toLowerCase()}
          </button>
        )}
        {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
      </div>
    );
  };

  return (
    <aside
      data-slot="angle-panel"
      aria-label={creating ? 'New angle' : `Angle: ${angle.name}`}
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-lg min-[900px]:w-[60%]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">
            {creating ? 'New angle' : 'Angle'}
          </p>
          <h2 className="truncate text-lg font-semibold text-text" data-slot="angle-panel-title">
            {creating ? 'New angle' : angle.name}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close panel"
          data-slot="angle-panel-close"
        >
          Close
        </Button>
      </header>

      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        {creating ? null : <input type="hidden" name="id" value={angle.id} />}
        {formats.map((key) => (
          <input key={key} type="hidden" name="formats" value={key} />
        ))}

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-7">
            {ANGLE_FIELD_GROUPS.map((group) => (
              <section key={group.heading} className="flex flex-col gap-3">
                <h3
                  data-slot="angle-group-heading"
                  className="flex items-center gap-2 border-b border-line pb-1 text-sm font-medium text-text2"
                >
                  {group.heading}
                </h3>

                <div className="flex flex-col gap-4">
                  {group.fields.map(renderProse)}

                  {group.heading === 'Targeting' ? (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {renderDropdown('personaId', 'Persona', personas, personaId, setPersonaId)}
                        {renderDropdown('productId', 'Product', products, productId, setProductId)}
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label className="flex items-center gap-2 text-[11px] tracking-wide text-text3 uppercase">
                          Type
                          <SoonChip />
                        </Label>
                        <DisabledWrite hint={TYPE_SOON_HINT} className="w-full">
                          <div
                            className="flex flex-wrap gap-2"
                            role="group"
                            aria-label="Type"
                            data-slot="angle-types"
                          >
                            {ANGLE_TYPES.map((entry) => {
                              const on = types.includes(entry.key);
                              return (
                                <button
                                  key={entry.key}
                                  type="button"
                                  disabled
                                  aria-pressed={on}
                                  data-slot="type-toggle"
                                  data-type={entry.key}
                                  className={
                                    on
                                      ? 'rounded-input border border-line2 bg-surface3 px-2.5 py-1 font-mono text-[11px] tracking-wide text-text2 uppercase'
                                      : 'rounded-input border border-line bg-surface2 px-2.5 py-1 font-mono text-[11px] tracking-wide text-text4 uppercase'
                                  }
                                >
                                  {entry.label}
                                </button>
                              );
                            })}
                          </div>
                        </DisabledWrite>
                      </div>
                    </>
                  ) : null}

                  {group.heading === 'Resources'
                    ? group.fields.map((field) => {
                        const id = `angle-field-${field.name}`;
                        const error = fieldError(field.name);
                        return (
                          <div key={field.name} className="flex flex-col gap-1.5">
                            <Label
                              htmlFor={id}
                              className="text-[11px] tracking-wide text-text3 uppercase"
                            >
                              {field.label}
                            </Label>
                            {field.hint === undefined ? null : (
                              <p className="text-xs text-text3">{field.hint}</p>
                            )}
                            <Input
                              id={id}
                              name={field.name}
                              type="url"
                              readOnly={demo}
                              aria-invalid={error !== undefined}
                              placeholder="https://…"
                              defaultValue={valueOf(angle, field.name)}
                              className="font-mono text-xs"
                            />
                            {error === undefined ? null : (
                              <p className="text-xs text-bad">{error}</p>
                            )}
                          </div>
                        );
                      })
                    : null}
                </div>
              </section>
            ))}
          </div>
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface2 px-4 py-3 sm:px-6">
          {demo ? (
            <p className="mr-auto text-xs text-text3" data-slot="angle-demo-note">
              {DEMO_FOOTER_NOTICE}
            </p>
          ) : state !== null && !state.ok ? (
            <p className="mr-auto text-xs text-bad">{state.error}</p>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <DisabledWrite active={blocked} hint={blockedHint}>
            <Button
              type="submit"
              size="sm"
              disabled={blocked || pending}
              data-slot="angle-save"
              className={disabledWriteClassName}
            >
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </DisabledWrite>
        </footer>
      </form>
    </aside>
  );
}
