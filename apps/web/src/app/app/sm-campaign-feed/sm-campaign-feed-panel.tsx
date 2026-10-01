'use client';

import { useActionState, useEffect, useState } from 'react';
import type { SmPlatformsKey, SmTaskStatusesKey } from '@tas/db';
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
  StatusChip,
  Textarea,
} from '@tas/ui';

import {
  createSmCampaignFeedTaskAction,
  updateSmCampaignFeedTaskAction,
  type SmTaskActionResult,
} from './actions';
import {
  EM_DASH,
  isPlatformKey,
  isStatusKey,
  NOT_SET,
  PLATFORM_OPTIONS,
  REMINDER_LABEL,
  REMINDER_LEAD_HOURS,
  REMINDER_TONE,
  SM_TASK_FIELDS,
  STATUS_OPTIONS,
  toDateTimeLocalValue,
  type SmSelectOption,
  type SmTaskField,
  type SmTaskFieldName,
  type SmTaskItem,
} from './fields';

/** The `?task=` value that means "the panel is open on a task that does not exist yet". */
export const NEW_TASK = 'new';

/** What the demo footer says instead of offering a save. */
export const DEMO_FOOTER_NOTICE = 'Demo mode — changes are not saved';

interface SmCampaignFeedPanelProps {
  readonly item: SmTaskItem | null;
  readonly demo: boolean;
  readonly onClose: () => void;
  readonly onSaved: (id: string) => void;
}

/** The stored text of one field, as the form's default. A null value is an empty control. */
function textValueOf(item: SmTaskItem | null, name: 'taskName' | 'notes'): string {
  return item?.task[name] ?? '';
}

/**
 * The right-side task panel. Deliberately not a modal: no backdrop, no focus trap, no `aria-modal` —
 * the grid beside it stays visible and clickable while this is open, which is the point of a panel.
 * It is fixed to the right edge at 60% of the viewport, full width under 900px, and it closes on
 * Escape or on its close button.
 *
 * All five stored fields are editable in place; the form posts to the Server Actions. The two Selects
 * keep their chosen key in state and post it through a hidden input, so the action receives a plain
 * string it validates against the vocabulary. The Reminder is read-only: it is the Airtable formula,
 * computed on the server from Due Date and Status with the page's clock, never something typed. In
 * demo mode the fields are read-only and the footer says so instead of saving.
 */
export function SmCampaignFeedPanel({ item, demo, onClose, onSaved }: SmCampaignFeedPanelProps) {
  const creating = item === null;
  const action = creating ? createSmCampaignFeedTaskAction : updateSmCampaignFeedTaskAction;
  const [state, formAction, pending] = useActionState<SmTaskActionResult | null, FormData>(
    action,
    null,
  );
  const [platform, setPlatform] = useState<SmPlatformsKey | ''>(item?.task.platform ?? '');
  const [status, setStatus] = useState<SmTaskStatusesKey | ''>(item?.task.status ?? '');

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

  const fieldError = (name: SmTaskFieldName): string | undefined =>
    state !== null && !state.ok ? state.fieldErrors?.[name] : undefined;

  const renderSelect = <Key extends string>(
    field: SmTaskField,
    id: string,
    options: readonly SmSelectOption<Key>[],
    value: Key | '',
    onChange: (next: string) => void,
  ) => (
    <>
      <Select value={value === '' ? undefined : value} onValueChange={onChange} disabled={demo}>
        <SelectTrigger id={id} className="w-full" aria-label={field.label}>
          <SelectValue placeholder={NOT_SET} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name={field.name} value={value} />
    </>
  );

  const renderField = (field: SmTaskField) => {
    const id = `sm-task-field-${field.name}`;
    const error = fieldError(field.name);

    let control;
    switch (field.kind) {
      case 'platform':
        control = renderSelect(field, id, PLATFORM_OPTIONS, platform, (next) => {
          if (isPlatformKey(next)) setPlatform(next);
        });
        break;
      case 'status':
        control = renderSelect(field, id, STATUS_OPTIONS, status, (next) => {
          if (isStatusKey(next)) setStatus(next);
        });
        break;
      case 'datetime':
        control = (
          <Input
            id={id}
            name={field.name}
            type="datetime-local"
            step={60}
            readOnly={demo}
            aria-invalid={error !== undefined}
            defaultValue={toDateTimeLocalValue(item?.task.dueDate ?? null)}
          />
        );
        break;
      case 'textarea':
        control = (
          <Textarea
            id={id}
            name={field.name}
            readOnly={demo}
            aria-invalid={error !== undefined}
            placeholder={demo ? NOT_SET : field.placeholder}
            defaultValue={textValueOf(item, 'notes')}
            className="min-h-24 leading-relaxed"
          />
        );
        break;
      case 'input':
        control = (
          <Input
            id={id}
            name={field.name}
            readOnly={demo}
            aria-invalid={error !== undefined}
            placeholder={demo ? NOT_SET : field.placeholder}
            defaultValue={textValueOf(item, 'taskName')}
          />
        );
        break;
    }

    return (
      <div key={field.name} data-slot={id} className="flex flex-col gap-1.5">
        <Label htmlFor={id} className="text-[11px] tracking-wide text-text3 uppercase">
          {field.label}
          {field.required ? null : <span className="ml-1.5 text-text4 normal-case">optional</span>}
        </Label>
        {control}
        {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
      </div>
    );
  };

  return (
    <aside
      data-slot="sm-task-panel"
      aria-label={creating ? 'New task' : `Task: ${item.task.taskName}`}
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-lg min-[900px]:w-[60%]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">
            {creating ? 'New task' : 'Task'}
          </p>
          <h2 className="truncate text-lg font-semibold text-text" data-slot="sm-task-panel-title">
            {creating ? 'New task' : item.task.taskName}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close panel"
          data-slot="sm-task-panel-close"
        >
          Close
        </Button>
      </header>

      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        {creating ? null : <input type="hidden" name="id" value={item.task.id} />}

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-7">
            <section className="flex flex-col gap-3">
              <h3
                data-slot="sm-task-group-heading"
                className="border-b border-line pb-1 text-sm font-medium text-text2"
              >
                Task
              </h3>
              <div className="flex flex-col gap-4">{SM_TASK_FIELDS.map(renderField)}</div>
            </section>

            {creating ? null : (
              <section className="flex flex-col gap-3">
                <h3
                  data-slot="sm-task-group-heading"
                  className="border-b border-line pb-1 text-sm font-medium text-text2"
                >
                  Reminder
                </h3>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] tracking-wide text-text3 uppercase">
                    Reminder Trigger
                  </span>
                  <div className="flex flex-wrap items-center gap-2" data-slot="sm-task-reminder">
                    {item.reminder === 'due' ? (
                      <StatusChip tone={REMINDER_TONE} label={REMINDER_LABEL} />
                    ) : (
                      <span className="font-mono text-xs text-text4">{EM_DASH}</span>
                    )}
                    <span className="text-xs text-text3">
                      Fires from {String(REMINDER_LEAD_HOURS)} hours before the due moment until the
                      task is done. Read-only: computed from Due Date and Status.
                    </span>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface2 px-4 py-3 sm:px-6">
          {demo ? (
            <p className="mr-auto text-xs text-text3" data-slot="sm-task-demo-note">
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
              data-slot="sm-task-save"
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
