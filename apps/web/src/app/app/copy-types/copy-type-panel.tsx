'use client';

import { useActionState, useEffect } from 'react';
import type { CopyTypeListRow } from '@tas/db';
import {
  Button,
  cn,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  Label,
  StatusChip,
  Textarea,
} from '@tas/ui';

import { createCopyTypeAction, updateCopyTypeAction, type CopyTypeActionResult } from './actions';
import {
  COPY_TYPE_FIELDS,
  linkCountTone,
  metaCopyCountLabel,
  NOT_SET,
  youtubeCopyCountLabel,
  type CopyTypeField,
  type CopyTypeFieldName,
  type LinkedCopyLabel,
} from './fields';

/** The `?copyType=` value that means "the panel is open on a copy type that does not exist yet". */
export const NEW_COPY_TYPE = 'new';

/** What the demo footer says instead of offering a save. */
export const DEMO_FOOTER_NOTICE = 'Demo mode — changes are not saved';

/**
 * One copy type as the grid and the panel render it: the row plus everything the page derived from
 * it on the server — the description's first line, the label of every linked copy (headline or the
 * generated title) and the formatted timestamps — so no component computes a lookup while it renders.
 */
export interface CopyTypeItem {
  readonly copyType: CopyTypeListRow;
  /** The first line of the description, shortened for the grid cell, or null when there is none. */
  readonly descriptionPreview: string | null;
  /** The "Ads Copywriting copy" record link: the Meta copies tagged with this type, in Copy # order. */
  readonly metaCopies: readonly LinkedCopyLabel[];
  /** The "Copywriting" record link: the YouTube copies tagged with this type, in Copy # order. */
  readonly youtubeCopies: readonly LinkedCopyLabel[];
  readonly updatedLabel: string;
  readonly updatedTitle: string;
}

interface CopyTypePanelProps {
  readonly item: CopyTypeItem | null;
  readonly demo: boolean;
  readonly onClose: () => void;
  readonly onSaved: (id: string) => void;
}

/** The stored value of one field, as the form's default. A null description is an empty textarea. */
function valueOf(row: CopyTypeListRow | null, name: CopyTypeFieldName): string {
  if (row === null) {
    return '';
  }
  const value = row[name];
  return typeof value === 'string' ? value : '';
}

interface LinkedCopyListProps {
  readonly slot: 'meta' | 'youtube';
  readonly copies: readonly LinkedCopyLabel[];
  readonly emptyText: string;
}

/**
 * One read-only record-link list. The headline is the copy's own words; a generated `Copy #N` title
 * is system output and renders in `font-mono`, as every auto-generated name does.
 */
function LinkedCopyList({ slot, copies, emptyText }: LinkedCopyListProps) {
  return (
    <div data-slot={`copy-type-${slot}-copies`} aria-labelledby={`copy-type-${slot}-heading`}>
      {copies.length === 0 ? (
        <p className="text-sm text-text3">{emptyText}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-card border border-line bg-surface2">
          {copies.map((copy) => (
            <li
              key={copy.id}
              data-slot={`copy-type-${slot}-copy`}
              className={cn('px-3 py-2 text-sm text-text', copy.generated && 'font-mono')}
            >
              {copy.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The right-side copy-type panel. Deliberately not a modal: no backdrop, no focus trap, no
 * `aria-modal` — the grid beside it stays visible and clickable while this is open. It is fixed to
 * the right edge at 60% of the viewport, full width under 900px, and it closes on Escape or on its
 * close button.
 *
 * Both Airtable fields are editable in place: Name as an input, Description as a textarea. The two
 * record links are read-only lists: they are the inverse sides of links the copy tables own, so a
 * copy is tagged with a type from the copy's own panel, never from here. In demo mode every control
 * is read-only and the footer says so instead of saving.
 */
export function CopyTypePanel({ item, demo, onClose, onSaved }: CopyTypePanelProps) {
  const creating = item === null;
  const row = item?.copyType ?? null;
  const action = creating ? createCopyTypeAction : updateCopyTypeAction;
  const [state, formAction, pending] = useActionState<CopyTypeActionResult | null, FormData>(
    action,
    null,
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

  const fieldError = (name: CopyTypeFieldName): string | undefined =>
    state !== null && !state.ok ? state.fieldErrors?.[name] : undefined;

  const renderField = (field: CopyTypeField) => {
    const id = `copy-type-field-${field.name}`;
    const error = fieldError(field.name);
    const shared = {
      id,
      name: field.name,
      readOnly: demo,
      'aria-invalid': error !== undefined,
      placeholder: demo ? NOT_SET : field.placeholder,
      defaultValue: valueOf(row, field.name),
    };

    return (
      <div key={field.name} className="flex flex-col gap-1.5">
        <Label htmlFor={id} className="text-[11px] tracking-wide text-text3 uppercase">
          {field.label}
          {field.required ? null : <span className="ml-1.5 text-text4 normal-case">optional</span>}
        </Label>
        {field.kind === 'textarea' ? (
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
      data-slot="copy-type-panel"
      aria-label={row === null ? 'New copy type' : `Copy type: ${row.name}`}
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-lg min-[900px]:w-[60%]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">
            {row === null ? 'New copy type' : 'Copy type'}
          </p>
          <h2
            className="truncate text-lg font-semibold text-text"
            data-slot="copy-type-panel-title"
          >
            {row === null ? 'New copy type' : row.name}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close panel"
          data-slot="copy-type-panel-close"
        >
          Close
        </Button>
      </header>

      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        {row === null ? null : <input type="hidden" name="id" value={row.id} />}

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-7">
            <section className="flex flex-col gap-3">
              <h3
                data-slot="copy-type-group-heading"
                className="border-b border-line pb-1 text-sm font-medium text-text2"
              >
                Copy type
              </h3>
              <div className="flex flex-col gap-4">{COPY_TYPE_FIELDS.map(renderField)}</div>
            </section>

            {item === null ? null : (
              <>
                <section className="flex flex-col gap-3">
                  <h3
                    id="copy-type-meta-heading"
                    data-slot="copy-type-group-heading"
                    className="flex items-center gap-2 border-b border-line pb-1 text-sm font-medium text-text2"
                  >
                    Meta copies
                    <span data-slot="copy-type-meta-count">
                      <StatusChip
                        tone={linkCountTone(item.metaCopies.length)}
                        label={metaCopyCountLabel(item.metaCopies.length)}
                      />
                    </span>
                  </h3>
                  <p className="text-xs text-text3">
                    Airtable calls this field “Ads Copywriting copy”. Read-only here: a copy is
                    tagged from its own panel in Copywriting.
                  </p>
                  <LinkedCopyList
                    slot="meta"
                    copies={item.metaCopies}
                    emptyText="No copy carries this type yet."
                  />
                </section>

                <section className="flex flex-col gap-3">
                  <h3
                    id="copy-type-youtube-heading"
                    data-slot="copy-type-group-heading"
                    className="flex items-center gap-2 border-b border-line pb-1 text-sm font-medium text-text2"
                  >
                    YouTube copies
                    <span data-slot="copy-type-youtube-count">
                      <StatusChip
                        tone={linkCountTone(item.youtubeCopies.length)}
                        label={youtubeCopyCountLabel(item.youtubeCopies.length)}
                      />
                    </span>
                  </h3>
                  <p className="text-xs text-text3">
                    Airtable calls this field “Copywriting”. Read-only here: a copy is tagged from
                    its own panel in YouTube Copywriting.
                  </p>
                  <LinkedCopyList
                    slot="youtube"
                    copies={item.youtubeCopies}
                    emptyText="No YouTube copy carries this type yet."
                  />
                </section>
              </>
            )}
          </div>
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface2 px-4 py-3 sm:px-6">
          {demo ? (
            <p className="mr-auto text-xs text-text3" data-slot="copy-type-demo-note">
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
              data-slot="copy-type-save"
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
