'use client';

import { useActionState, useCallback, useEffect, useState } from 'react';
import type { ClientAssetFolderListRow } from '@tas/db';
import {
  Button,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  Label,
  StatusChip,
  Textarea,
} from '@tas/ui';

import {
  createClientAssetFolderAction,
  updateClientAssetFolderAction,
  type ClientAssetFolderActionResult,
} from './actions';
import {
  CLIENT_ASSET_FOLDER_FIELDS,
  designCountLabel,
  linkCountTone,
  NOT_SET,
  type ClientAssetFolderField,
  type ClientAssetFolderFieldName,
} from './fields';

/** The `?folder=` value that means "the panel is open on a folder that does not exist yet". */
export const NEW_CLIENT_ASSET_FOLDER = 'new';

/** What the demo footer says instead of offering a save. */
export const DEMO_FOOTER_NOTICE = 'Demo mode — changes are not saved';

/** One record the chip picker offers: a brief (Creative Design) of the working brand. */
export interface LinkOption {
  readonly id: string;
  readonly name: string;
}

interface ClientAssetPanelProps {
  readonly folder: ClientAssetFolderListRow | null;
  readonly briefs: readonly LinkOption[];
  readonly demo: boolean;
  readonly onClose: () => void;
  readonly onSaved: (id: string) => void;
}

/** The stored value of one field, as the form's default. A null column is an empty control. */
function valueOf(row: ClientAssetFolderListRow | null, name: ClientAssetFolderFieldName): string {
  if (row === null) {
    return '';
  }
  const value = row[name];
  return typeof value === 'string' ? value : '';
}

const CHIP_ON =
  'rounded-input border border-accent-line bg-accent-soft px-2.5 py-1 font-mono text-[11px] tracking-wide text-accent uppercase disabled:cursor-not-allowed';
const CHIP_OFF =
  'rounded-input border border-line bg-surface2 px-2.5 py-1 font-mono text-[11px] tracking-wide text-text3 uppercase hover:border-line2 hover:text-text2 disabled:cursor-not-allowed';

interface ChipPickerProps {
  readonly options: readonly LinkOption[];
  readonly selected: readonly string[];
  readonly disabled: boolean;
  readonly onToggle: (id: string) => void;
}

/**
 * The multi-record link control, the `ugc/creator-panel.tsx` "Linked Concepts" pattern: one toggle
 * button per brief, `aria-pressed` for the state, and the selection posted as repeated hidden inputs
 * by the form around it. Brief names are auto-generated, so the chips are `font-mono`. Read-only in
 * demo mode, like every other control in the panel.
 */
function ChipPicker({ options, selected, disabled, onToggle }: ChipPickerProps) {
  if (options.length === 0) {
    return <p className="text-sm text-text3">No creative designs in this brand yet.</p>;
  }
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-labelledby="client-asset-design-heading"
      data-slot="design-picker"
    >
      {options.map((option) => {
        const on = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            data-slot="design-toggle"
            onClick={() => {
              onToggle(option.id);
            }}
            className={on ? CHIP_ON : CHIP_OFF}
          >
            {option.name}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The right-side folder panel. Deliberately not a modal: no backdrop, no focus trap, no
 * `aria-modal` — the grid beside it stays visible and clickable while this is open. It is fixed to
 * the right edge at 60% of the viewport, full width under 900px, and it closes on Escape or on its
 * close button.
 *
 * All four Airtable fields are editable in place: the three typed columns as controls (the
 * description a text area), the record link "(Internal) Creative Design" as a chip picker whose
 * selection is posted as repeated `briefIds` hidden inputs for the Server Action to sync. The count
 * is read-only: it is the picker's selection size. In demo mode every control is read-only and the
 * footer says so instead of saving.
 */
export function ClientAssetPanel({
  folder,
  briefs,
  demo,
  onClose,
  onSaved,
}: ClientAssetPanelProps) {
  const creating = folder === null;
  const action = creating ? createClientAssetFolderAction : updateClientAssetFolderAction;
  const [state, formAction, pending] = useActionState<
    ClientAssetFolderActionResult | null,
    FormData
  >(action, null);

  const [selectedBriefIds, setSelectedBriefIds] = useState<readonly string[]>(
    folder?.briefIds ?? [],
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

  const toggleBrief = useCallback((id: string) => {
    setSelectedBriefIds((previous) =>
      previous.includes(id) ? previous.filter((other) => other !== id) : [...previous, id],
    );
  }, []);

  const fieldError = (name: ClientAssetFolderFieldName): string | undefined =>
    state !== null && !state.ok ? state.fieldErrors?.[name] : undefined;

  const renderField = (field: ClientAssetFolderField) => {
    const id = `client-asset-field-${field.name}`;
    const error = fieldError(field.name);
    const shared = {
      id,
      name: field.name,
      readOnly: demo,
      'aria-invalid': error !== undefined,
      placeholder: demo ? NOT_SET : field.placeholder,
      defaultValue: valueOf(folder, field.name),
    };

    return (
      <div key={field.name} className="flex flex-col gap-1.5">
        <Label htmlFor={id} className="text-[11px] tracking-wide text-text3 uppercase">
          {field.label}
          {field.required ? null : <span className="ml-1.5 text-text4 normal-case">optional</span>}
        </Label>
        {field.control === 'textarea' ? (
          <Textarea {...shared} className="min-h-24 leading-relaxed" />
        ) : (
          <Input {...shared} type={field.name === 'locationUrl' ? 'url' : 'text'} />
        )}
        {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
      </div>
    );
  };

  return (
    <aside
      data-slot="client-asset-panel"
      aria-label={creating ? 'New folder' : `Folder: ${folder.name}`}
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-lg min-[900px]:w-[60%]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">
            {creating ? 'New folder' : 'Client asset folder'}
          </p>
          <h2
            className="truncate text-lg font-semibold text-text"
            data-slot="client-asset-panel-title"
          >
            {creating ? 'New folder' : folder.name}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close panel"
          data-slot="client-asset-panel-close"
        >
          Close
        </Button>
      </header>

      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        {creating ? null : <input type="hidden" name="id" value={folder.id} />}
        {selectedBriefIds.map((id) => (
          <input key={id} type="hidden" name="briefIds" value={id} />
        ))}

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-7">
            <section className="flex flex-col gap-3">
              <h3
                data-slot="client-asset-group-heading"
                className="border-b border-line pb-1 text-sm font-medium text-text2"
              >
                Folder
              </h3>
              <div className="flex flex-col gap-4">
                {CLIENT_ASSET_FOLDER_FIELDS.map(renderField)}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3
                id="client-asset-design-heading"
                data-slot="client-asset-group-heading"
                className="flex items-center gap-2 border-b border-line pb-1 text-sm font-medium text-text2"
              >
                Creative Designs
                <span data-slot="client-asset-design-count">
                  <StatusChip
                    tone={linkCountTone(selectedBriefIds.length)}
                    label={designCountLabel(selectedBriefIds.length)}
                  />
                </span>
              </h3>
              <p className="text-xs text-text3">
                The briefs whose material lives in this folder. Names are auto-generated on the
                brief.
              </p>
              <ChipPicker
                options={briefs}
                selected={selectedBriefIds}
                disabled={demo}
                onToggle={toggleBrief}
              />
            </section>
          </div>
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface2 px-4 py-3 sm:px-6">
          {demo ? (
            <p className="mr-auto text-xs text-text3" data-slot="client-asset-demo-note">
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
              data-slot="client-asset-save"
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
