'use client';

import { useActionState, useEffect } from 'react';
import type { CollectionListRow } from '@tas/db';
import { Button, disabledWriteClassName, DisabledWrite, Input, Label } from '@tas/ui';

import {
  createCollectionAction,
  updateCollectionAction,
  type CollectionActionResult,
} from './actions';
import {
  COLLECTION_FIELDS,
  NOT_SET,
  type CollectionField,
  type CollectionFieldName,
} from './fields';

/** The `?collection=` value that means "the panel is open on a collection that does not exist yet". */
export const NEW_COLLECTION = 'new';

/** What the demo footer says instead of offering a save. */
export const DEMO_FOOTER_NOTICE = 'Demo mode — changes are not saved';

interface CollectionPanelProps {
  readonly collection: CollectionListRow | null;
  readonly demo: boolean;
  readonly onClose: () => void;
  readonly onSaved: (id: string) => void;
}

/** The stored value of one field, as the form's default. A null value is an empty input. */
function valueOf(collection: CollectionListRow | null, name: CollectionFieldName): string {
  if (collection === null) {
    return '';
  }
  const value = collection[name];
  return typeof value === 'string' ? value : '';
}

/**
 * The right-side collection panel, in the shape of `products/product-panel.tsx`. Deliberately not a
 * modal: no backdrop, no focus trap, no `aria-modal` — the table beside it stays visible and
 * clickable while this is open, which is the point of a panel. It is fixed to the right edge at 60%
 * of the viewport, full width under 900px, and it closes on Escape or on its close button.
 *
 * Every field posts to the Server Actions as plain text; the relation fields (`campaignId`,
 * `angleId`, `productId`, `copywritingId`, `creativeDesign2Id`) take a uuid rather than a name —
 * there is no picker in this ticket's scope, only the create/edit form itself. In demo mode the
 * fields are read-only and the footer says so instead of saving.
 */
export function CollectionPanel({ collection, demo, onClose, onSaved }: CollectionPanelProps) {
  const creating = collection === null;
  const action = creating ? createCollectionAction : updateCollectionAction;
  const [state, formAction, pending] = useActionState<CollectionActionResult | null, FormData>(
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

  const fieldError = (name: CollectionFieldName): string | undefined =>
    state !== null && !state.ok ? state.fieldErrors?.[name] : undefined;

  const renderField = (field: CollectionField) => {
    const id = `collection-field-${field.name}`;
    const error = fieldError(field.name);

    return (
      <div key={field.name} className="flex flex-col gap-1.5">
        <Label htmlFor={id} className="text-[11px] tracking-wide text-text3 uppercase">
          {field.label}
          {field.required ? null : <span className="ml-1.5 text-text4 normal-case">optional</span>}
        </Label>
        <Input
          id={id}
          name={field.name}
          readOnly={demo}
          aria-invalid={error !== undefined}
          placeholder={demo ? NOT_SET : field.placeholder}
          defaultValue={valueOf(collection, field.name)}
        />
        {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
      </div>
    );
  };

  return (
    <aside
      data-slot="collection-panel"
      aria-label={creating ? 'New collection' : `Collection: ${collection.name}`}
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-lg min-[900px]:w-[60%]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">
            {creating ? 'New collection' : 'Collection'}
          </p>
          <h2
            className="truncate text-lg font-semibold text-text"
            data-slot="collection-panel-title"
          >
            {creating ? 'New collection' : collection.name}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close panel"
          data-slot="collection-panel-close"
        >
          Close
        </Button>
      </header>

      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        {creating ? null : <input type="hidden" name="id" value={collection.id} />}

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-7">
            <section className="flex flex-col gap-3">
              <h3
                data-slot="collection-group-heading"
                className="border-b border-line pb-1 text-sm font-medium text-text2"
              >
                Collection
              </h3>
              <div className="flex flex-col gap-4">{COLLECTION_FIELDS.map(renderField)}</div>
            </section>
          </div>
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface2 px-4 py-3 sm:px-6">
          {demo ? (
            <p className="mr-auto text-xs text-text3" data-slot="collection-demo-note">
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
              data-slot="collection-save"
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
