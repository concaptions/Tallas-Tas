'use client';

import { useActionState, useCallback, useEffect, useState } from 'react';
import type { CreativeModuleListRow } from '@tas/db';
import { Button, disabledWriteClassName, DisabledWrite, Input, Label, StatusChip } from '@tas/ui';

import {
  createCreativeModuleAction,
  updateCreativeModuleAction,
  type CreativeModuleActionResult,
} from './actions';
import {
  angleCountLabel,
  CREATIVE_MODULE_FIELDS,
  designCountLabel,
  linkCountTone,
  NOT_SET,
  type CreativeModuleField,
  type CreativeModuleFieldName,
} from './fields';

/** The `?module=` value that means "the panel is open on a module that does not exist yet". */
export const NEW_CREATIVE_MODULE = 'new';

/** What the demo footer says instead of offering a save. */
export const DEMO_FOOTER_NOTICE = 'Demo mode — changes are not saved';

/** One record a chip picker offers: an angle or a brief of the working brand. */
export interface LinkOption {
  readonly id: string;
  readonly name: string;
}

interface CreativeModulePanelProps {
  readonly creativeModule: CreativeModuleListRow | null;
  readonly angles: readonly LinkOption[];
  readonly briefs: readonly LinkOption[];
  readonly demo: boolean;
  readonly onClose: () => void;
  readonly onSaved: (id: string) => void;
}

/** The stored value of one field, as the form's default. A null Foreplay link is an empty input. */
function valueOf(row: CreativeModuleListRow | null, name: CreativeModuleFieldName): string {
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
  readonly slot: 'angle' | 'design';
  readonly options: readonly LinkOption[];
  readonly selected: readonly string[];
  readonly disabled: boolean;
  readonly emptyText: string;
  readonly onToggle: (id: string) => void;
}

/**
 * The multi-record link control, the `ugc/creator-panel.tsx` "Linked Concepts" pattern: one toggle
 * button per option, `aria-pressed` for the state, and the selection posted as repeated hidden
 * inputs by the form around it. Read-only in demo mode, like every other control in the panel.
 */
function ChipPicker({ slot, options, selected, disabled, emptyText, onToggle }: ChipPickerProps) {
  if (options.length === 0) {
    return <p className="text-sm text-text3">{emptyText}</p>;
  }
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-labelledby={`creative-module-${slot}-heading`}
      data-slot={`${slot}-picker`}
    >
      {options.map((option) => {
        const on = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            data-slot={`${slot}-toggle`}
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
 * The right-side module panel. Deliberately not a modal: no backdrop, no focus trap, no
 * `aria-modal` — the grid beside it stays visible and clickable while this is open. It is fixed to
 * the right edge at 60% of the viewport, full width under 900px, and it closes on Escape or on its
 * close button.
 *
 * All four Airtable fields are editable in place: the two typed columns as inputs, the two record
 * links ("Concepts", which links to ANGLES, and "(Internal) Creative Design", which links to briefs)
 * as chip pickers whose selection is posted as repeated `angleIds` / `briefIds` hidden inputs for
 * the Server Action to sync. The counts are read-only: they are the pickers' selection sizes. In
 * demo mode every control is read-only and the footer says so instead of saving.
 */
export function CreativeModulePanel({
  creativeModule,
  angles,
  briefs,
  demo,
  onClose,
  onSaved,
}: CreativeModulePanelProps) {
  const creating = creativeModule === null;
  const action = creating ? createCreativeModuleAction : updateCreativeModuleAction;
  const [state, formAction, pending] = useActionState<CreativeModuleActionResult | null, FormData>(
    action,
    null,
  );

  const [selectedAngleIds, setSelectedAngleIds] = useState<readonly string[]>(
    creativeModule?.angleIds ?? [],
  );
  const [selectedBriefIds, setSelectedBriefIds] = useState<readonly string[]>(
    creativeModule?.briefIds ?? [],
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

  const toggleAngle = useCallback((id: string) => {
    setSelectedAngleIds((previous) =>
      previous.includes(id) ? previous.filter((other) => other !== id) : [...previous, id],
    );
  }, []);

  const toggleBrief = useCallback((id: string) => {
    setSelectedBriefIds((previous) =>
      previous.includes(id) ? previous.filter((other) => other !== id) : [...previous, id],
    );
  }, []);

  const fieldError = (name: CreativeModuleFieldName): string | undefined =>
    state !== null && !state.ok ? state.fieldErrors?.[name] : undefined;

  const renderField = (field: CreativeModuleField) => {
    const id = `creative-module-field-${field.name}`;
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
          defaultValue={valueOf(creativeModule, field.name)}
        />
        {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
      </div>
    );
  };

  return (
    <aside
      data-slot="creative-module-panel"
      aria-label={
        creating ? 'New creative module' : `Creative module: ${creativeModule.moduleName}`
      }
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-lg min-[900px]:w-[60%]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">
            {creating ? 'New creative module' : 'Creative module'}
          </p>
          <h2
            className="truncate text-lg font-semibold text-text"
            data-slot="creative-module-panel-title"
          >
            {creating ? 'New creative module' : creativeModule.moduleName}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close panel"
          data-slot="creative-module-panel-close"
        >
          Close
        </Button>
      </header>

      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        {creating ? null : <input type="hidden" name="id" value={creativeModule.id} />}
        {selectedAngleIds.map((id) => (
          <input key={id} type="hidden" name="angleIds" value={id} />
        ))}
        {selectedBriefIds.map((id) => (
          <input key={id} type="hidden" name="briefIds" value={id} />
        ))}

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-7">
            <section className="flex flex-col gap-3">
              <h3
                data-slot="creative-module-group-heading"
                className="border-b border-line pb-1 text-sm font-medium text-text2"
              >
                Module
              </h3>
              <div className="flex flex-col gap-4">{CREATIVE_MODULE_FIELDS.map(renderField)}</div>
            </section>

            <section className="flex flex-col gap-3">
              <h3
                id="creative-module-angle-heading"
                data-slot="creative-module-group-heading"
                className="flex items-center gap-2 border-b border-line pb-1 text-sm font-medium text-text2"
              >
                Angles
                <span data-slot="creative-module-angle-count">
                  <StatusChip
                    tone={linkCountTone(selectedAngleIds.length)}
                    label={angleCountLabel(selectedAngleIds.length)}
                  />
                </span>
              </h3>
              <p className="text-xs text-text3">
                Airtable calls this field “Concepts”; it links to the brand&apos;s angles.
              </p>
              <ChipPicker
                slot="angle"
                options={angles}
                selected={selectedAngleIds}
                disabled={demo}
                emptyText="No angles in this brand yet."
                onToggle={toggleAngle}
              />
            </section>

            <section className="flex flex-col gap-3">
              <h3
                id="creative-module-design-heading"
                data-slot="creative-module-group-heading"
                className="flex items-center gap-2 border-b border-line pb-1 text-sm font-medium text-text2"
              >
                Creative Designs
                <span data-slot="creative-module-design-count">
                  <StatusChip
                    tone={linkCountTone(selectedBriefIds.length)}
                    label={designCountLabel(selectedBriefIds.length)}
                  />
                </span>
              </h3>
              <p className="text-xs text-text3">
                The briefs built on this module. Names are auto-generated on the brief.
              </p>
              <ChipPicker
                slot="design"
                options={briefs}
                selected={selectedBriefIds}
                disabled={demo}
                emptyText="No creative designs in this brand yet."
                onToggle={toggleBrief}
              />
            </section>
          </div>
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface2 px-4 py-3 sm:px-6">
          {demo ? (
            <p className="mr-auto text-xs text-text3" data-slot="creative-module-demo-note">
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
              data-slot="creative-module-save"
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
