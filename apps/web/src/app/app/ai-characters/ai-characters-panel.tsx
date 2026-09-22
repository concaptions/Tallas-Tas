'use client';

import { useActionState, useEffect, useState } from 'react';
import type { AiCharacterListRow } from '@tas/db';
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
  createAiCharacterAction,
  updateAiCharacterAction,
  type AiCharacterActionResult,
} from './actions';
import {
  AI_CHARACTER_FIELD_GROUPS,
  AI_CHARACTER_STATUS_OPTIONS,
  NOT_SET,
  type AiCharacterField,
  type AiCharacterFieldName,
  type AiCharacterStatus,
} from './fields';

/** The `?character=` value that means "the panel is open on a character that does not exist yet". */
export const NEW_AI_CHARACTER = 'new';

/** What the demo footer says instead of offering a save. */
export const DEMO_FOOTER_NOTICE = 'Demo mode — changes are not saved';

interface AiCharacterPanelProps {
  readonly character: AiCharacterListRow | null;
  readonly demo: boolean;
  readonly onClose: () => void;
  readonly onSaved: (id: string) => void;
}

/** The stored value of one field, as the form's default. */
function valueOf(character: AiCharacterListRow | null, name: AiCharacterFieldName): string {
  if (character === null) {
    return '';
  }
  const value = character[name];
  return typeof value === 'string' ? value : '';
}

/**
 * The right-side AI character panel. Deliberately not a modal: no backdrop, no focus trap, no
 * `aria-modal` — the table beside it stays visible and clickable while this is open, which is the
 * point of a panel. It is fixed to the right edge at 60% of the viewport, full width under 900px,
 * and it closes on Escape or on its close button.
 *
 * Every one of the twelve fields is editable in place; the form posts to the Server Actions. In
 * demo mode the fields are read-only and the footer says so instead of saving. Shaped exactly like
 * `personas/persona-panel.tsx`.
 */
export function AiCharacterPanel({ character, demo, onClose, onSaved }: AiCharacterPanelProps) {
  const creating = character === null;
  const action = creating ? createAiCharacterAction : updateAiCharacterAction;
  const [state, formAction, pending] = useActionState<AiCharacterActionResult | null, FormData>(
    action,
    null,
  );
  const initialStatus = character?.status ?? '';
  const [status, setStatus] = useState<AiCharacterStatus | ''>(
    initialStatus === '' ? '' : (initialStatus as AiCharacterStatus),
  );

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

  const fieldError = (name: AiCharacterFieldName): string | undefined =>
    state !== null && !state.ok ? state.fieldErrors?.[name] : undefined;

  const renderField = (field: AiCharacterField) => {
    const id = `ai-character-field-${field.name}`;
    const error = fieldError(field.name);
    const shared = {
      id,
      name: field.name,
      readOnly: demo,
      'aria-invalid': error !== undefined,
      placeholder: NOT_SET,
      defaultValue: valueOf(character, field.name),
    };

    return (
      <div key={field.name} className="flex flex-col gap-1.5">
        <Label htmlFor={id} className="text-[11px] tracking-wide text-text3 uppercase">
          {field.label}
        </Label>
        {field.kind === 'status' ? (
          <>
            <Select
              value={status === '' ? undefined : status}
              onValueChange={(next) => {
                setStatus(next as AiCharacterStatus);
              }}
              disabled={demo}
            >
              <SelectTrigger id={id} className="w-full" aria-label={field.label}>
                <SelectValue placeholder={NOT_SET} />
              </SelectTrigger>
              <SelectContent>
                {AI_CHARACTER_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name={field.name} value={status} />
          </>
        ) : field.kind === 'input' ? (
          <Input {...shared} />
        ) : (
          <Textarea {...shared} className="min-h-20 leading-relaxed" />
        )}
        {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
      </div>
    );
  };

  return (
    <aside
      data-slot="ai-character-panel"
      aria-label={creating ? 'New AI character' : `AI character: ${character.name}`}
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-lg min-[900px]:w-[60%]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">
            {creating ? 'New AI character' : 'AI Character'}
          </p>
          <h2
            className="truncate text-lg font-semibold text-text"
            data-slot="ai-character-panel-title"
          >
            {creating ? 'New AI character' : character.name}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close panel"
          data-slot="ai-character-panel-close"
        >
          Close
        </Button>
      </header>

      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        {creating ? null : <input type="hidden" name="id" value={character.id} />}

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-7">
            {AI_CHARACTER_FIELD_GROUPS.map((group) => (
              <section key={group.heading} className="flex flex-col gap-3">
                <h3
                  data-slot="ai-character-group-heading"
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
            <p className="mr-auto text-xs text-text3" data-slot="ai-character-demo-note">
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
              data-slot="ai-character-save"
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
