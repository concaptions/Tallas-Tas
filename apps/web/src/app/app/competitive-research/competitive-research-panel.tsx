'use client';

import { useActionState, useEffect, useState } from 'react';
import type { CompetitiveResearchListRow } from '@tas/db';
import {
  Button,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@tas/ui';

import {
  createCompetitiveResearchAction,
  updateCompetitiveResearchAction,
  type CompetitiveResearchActionResult,
} from './actions';
import {
  COMPETITIVE_RESEARCH_FIELD_GROUPS,
  COMPETITIVE_RESEARCH_TYPE_OPTIONS,
  DEMO_FOOTER_NOTICE,
  NOT_SET,
  type CompetitiveResearchField,
  type CompetitiveResearchFieldName,
} from './fields';

/** The `?entry=` value that means "the panel is open on an entry that does not exist yet". */
export const NEW_COMPETITIVE_RESEARCH = 'new';

interface CompetitiveResearchPanelProps {
  readonly entry: CompetitiveResearchListRow | null;
  readonly demo: boolean;
  readonly onClose: () => void;
  readonly onSaved: (id: string) => void;
}

/** The stored value of one field, as the form's default. A null value is an empty input. */
function valueOf(
  entry: CompetitiveResearchListRow | null,
  name: CompetitiveResearchFieldName,
): string {
  if (entry === null) {
    return '';
  }
  const value = entry[name];
  return typeof value === 'string' ? value : '';
}

/**
 * The right-side competitive research panel. Deliberately not a modal: no backdrop, no focus trap,
 * no `aria-modal` — the table beside it stays visible and clickable while this is open, which is the
 * point of a panel. It is fixed to the right edge at 60% of the viewport, full width under 900px,
 * and it closes on Escape or on its close button.
 *
 * All seven fields are editable in place; the form posts to the Server Actions. `type` is presented
 * as a Select over `COMPETITIVE_RESEARCH_TYPE_OPTIONS`, but the column is plain text, so a value
 * typed before this list existed still round-trips untouched. In demo mode the fields are read-only
 * and the footer says so instead of saving.
 */
export function CompetitiveResearchPanel({
  entry,
  demo,
  onClose,
  onSaved,
}: CompetitiveResearchPanelProps) {
  const creating = entry === null;
  const action = creating ? createCompetitiveResearchAction : updateCompetitiveResearchAction;
  const [state, formAction, pending] = useActionState<
    CompetitiveResearchActionResult | null,
    FormData
  >(action, null);
  const [type, setType] = useState<string>(entry?.type ?? '');

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

  const fieldError = (name: CompetitiveResearchFieldName): string | undefined =>
    state !== null && !state.ok ? state.fieldErrors?.[name] : undefined;

  const renderField = (field: CompetitiveResearchField) => {
    const id = `competitive-research-field-${field.name}`;
    const error = fieldError(field.name);
    const shared = {
      id,
      name: field.name,
      readOnly: demo,
      'aria-invalid': error !== undefined,
      placeholder: demo ? NOT_SET : field.placeholder,
      defaultValue: valueOf(entry, field.name),
    };

    return (
      <div key={field.name} className="flex flex-col gap-1.5">
        <Label htmlFor={id} className="text-[11px] tracking-wide text-text3 uppercase">
          {field.label}
          {field.required ? null : <span className="ml-1.5 text-text4 normal-case">optional</span>}
        </Label>
        {field.kind === 'select' ? (
          <>
            <Select value={type === '' ? undefined : type} onValueChange={setType} disabled={demo}>
              <SelectTrigger id={id} className="w-full" aria-label={field.label}>
                <SelectValue placeholder={NOT_SET} />
              </SelectTrigger>
              <SelectContent>
                {COMPETITIVE_RESEARCH_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name={field.name} value={type} />
          </>
        ) : field.kind === 'textarea' ? (
          <Textarea {...shared} className="min-h-24 leading-relaxed" />
        ) : (
          <Input {...shared} />
        )}
        {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
      </div>
    );
  };

  return (
    <aside
      data-slot="competitive-research-panel"
      aria-label={creating ? 'New competitor' : `Competitor: ${entry.name}`}
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-lg min-[900px]:w-[60%]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">
            {creating ? 'New competitor' : 'Competitor'}
          </p>
          <h2
            className="truncate text-lg font-semibold text-text"
            data-slot="competitive-research-panel-title"
          >
            {creating ? 'New competitor' : entry.name}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close panel"
          data-slot="competitive-research-panel-close"
        >
          Close
        </Button>
      </header>

      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        {creating ? null : <input type="hidden" name="id" value={entry.id} />}

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-7">
            {COMPETITIVE_RESEARCH_FIELD_GROUPS.map((group) => (
              <section key={group.heading} className="flex flex-col gap-3">
                <h3
                  data-slot="competitive-research-group-heading"
                  className="border-b border-line pb-1 text-sm font-medium text-text2"
                >
                  {group.heading}
                </h3>
                <div className="flex flex-col gap-4">{group.fields.map(renderField)}</div>
              </section>
            ))}
          </div>
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface2 px-4 py-3 sm:px-6">
          {demo ? (
            <p className="mr-auto text-xs text-text3" data-slot="competitive-research-demo-note">
              {DEMO_FOOTER_NOTICE}
            </p>
          ) : state !== null && !state.ok ? (
            <p className="mr-auto text-xs text-bad">{state.error}</p>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <DisabledWrite active={demo}>
            <Button
              type="submit"
              size="sm"
              disabled={demo || pending}
              data-slot="competitive-research-save"
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
