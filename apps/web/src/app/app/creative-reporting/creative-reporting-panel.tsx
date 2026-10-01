'use client';

import { useActionState, useEffect, useState } from 'react';
import type { CreativeReportListRow } from '@tas/db';
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
  createCreativeReportAction,
  updateCreativeReportAction,
  type CreativeReportActionResult,
} from './actions';
import {
  CREATIVE_REPORT_FIELD_GROUPS,
  ctrToPercentText,
  differenceCpaView,
  EM_DASH,
  NOT_SET,
  urlListText,
  type CreativeReportField,
  type CreativeReportFieldName,
} from './fields';

/** The `?creativeReport=` value that means "the panel is open on a row that does not exist yet". */
export const NEW_CREATIVE_REPORT = 'new';

/** What the demo footer says instead of offering a save. */
export const DEMO_FOOTER_NOTICE = 'Demo mode — changes are not saved';

/** One brief of the brand, as the Creative picker lists it. */
export interface CreativeReportBriefOption {
  readonly id: string;
  readonly name: string;
}

interface CreativeReportingPanelProps {
  readonly report: CreativeReportListRow | null;
  readonly briefOptions: readonly CreativeReportBriefOption[];
  readonly demo: boolean;
  readonly onClose: () => void;
  readonly onSaved: (id: string) => void;
}

const NONE_VALUE = '';

/** The stored value of one field as the form's default: null and arrays become text, CTR a percent. */
function valueOf(row: CreativeReportListRow | null, field: CreativeReportField): string {
  if (row === null) return '';
  if (field.name === 'ctr') return ctrToPercentText(row.ctr);
  const value = row[field.name];
  if (Array.isArray(value)) return urlListText(value);
  return typeof value === 'string' ? value : '';
}

const LABEL_CLASS = 'text-[11px] tracking-wide text-text3 uppercase';

/**
 * A single-select backed by a hidden input, so an unset value posts as `''` (stored NULL) and a
 * chosen one can be cleared again. The trigger carries the field id, so its Label addresses it.
 */
function BriefField({
  id,
  name,
  options,
  initial,
  initialName,
  demo,
}: {
  id: string;
  name: string;
  options: readonly CreativeReportBriefOption[];
  initial: string;
  initialName: string | null;
  demo: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Select
        value={value === NONE_VALUE ? undefined : value}
        onValueChange={setValue}
        disabled={demo}
      >
        <SelectTrigger id={id} className="w-full font-mono text-xs" data-slot={`${id}-trigger`}>
          <SelectValue placeholder={demo ? (initialName ?? NOT_SET) : 'Not linked'} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id} className="font-mono text-xs">
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value !== NONE_VALUE && !demo ? (
        <button
          type="button"
          onClick={() => {
            setValue(NONE_VALUE);
          }}
          className="self-start rounded-input text-xs text-text3 underline-offset-2 hover:text-text2 hover:underline"
        >
          Unlink
        </button>
      ) : null}
    </>
  );
}

/**
 * The right-side report panel. Not a modal: no backdrop, no focus trap, the grid beside it stays
 * clickable. Fixed to the right edge at 60% of the viewport, full width under 900px, closes on
 * Escape or its close button. Every stored field is editable in place — the metrics as number
 * inputs at their column's scale, the ad design as one URL per line, the creative as a single
 * Select over the brand's briefs. "Difference CPA" is read-only because it is the base's formula,
 * computed by the query layer. In demo mode every control is read-only and the footer says so.
 */
export function CreativeReportingPanel({
  report,
  briefOptions,
  demo,
  onClose,
  onSaved,
}: CreativeReportingPanelProps) {
  const creating = report === null;
  const action = creating ? createCreativeReportAction : updateCreativeReportAction;
  const [state, formAction, pending] = useActionState<CreativeReportActionResult | null, FormData>(
    action,
    null,
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (state !== null && state.ok) onSaved(state.id);
  }, [state, onSaved]);

  const fieldError = (name: CreativeReportFieldName): string | undefined =>
    state !== null && !state.ok ? state.fieldErrors?.[name] : undefined;

  const renderControl = (field: CreativeReportField, id: string, error: string | undefined) => {
    const common = {
      id,
      name: field.name,
      readOnly: demo,
      'aria-invalid': error !== undefined,
      placeholder: demo ? NOT_SET : field.placeholder,
      defaultValue: valueOf(report, field),
    };
    switch (field.kind) {
      case 'textarea':
        return <Textarea {...common} className="min-h-28 leading-relaxed" />;
      case 'urlList':
        return <Textarea {...common} className="min-h-20 font-mono text-xs leading-relaxed" />;
      case 'url':
        return <Input {...common} type="url" className="font-mono text-xs" />;
      case 'text':
        return <Input {...common} type="text" />;
      case 'number':
        return (
          <div className="flex items-center gap-2">
            <Input
              {...common}
              type="number"
              inputMode="decimal"
              min={0}
              step={field.scale === undefined ? 1 : 10 ** -field.scale}
              className="font-mono text-xs"
            />
            {field.unit === undefined ? null : (
              <span className="font-mono text-xs text-text3">{field.unit}</span>
            )}
          </div>
        );
      case 'brief':
        return (
          <BriefField
            id={id}
            name={field.name}
            options={briefOptions}
            initial={report?.briefId ?? NONE_VALUE}
            initialName={report?.briefName ?? null}
            demo={demo}
          />
        );
    }
  };

  const renderField = (field: CreativeReportField) => {
    const id = `creative-report-field-${field.name}`;
    const error = fieldError(field.name);
    return (
      <div
        key={field.name}
        className="flex flex-col gap-1.5"
        data-slot="creative-report-field"
        data-field={field.name}
      >
        <Label htmlFor={id} className={LABEL_CLASS}>
          {field.label}
          {field.required ? null : <span className="ml-1.5 text-text4 normal-case">optional</span>}
        </Label>
        {renderControl(field, id, error)}
        {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
      </div>
    );
  };

  const difference = differenceCpaView(report?.differenceCpa ?? null);

  return (
    <aside
      data-slot="creative-report-panel"
      aria-label={creating ? 'New report' : `Report: ${report.nameAngleOffer}`}
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-lg min-[900px]:w-[60%]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">
            {creating ? 'New report' : 'Creative report'}
          </p>
          <h2
            className="truncate text-lg font-semibold text-text"
            data-slot="creative-report-panel-title"
          >
            {creating ? 'New report' : report.nameAngleOffer}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close panel"
          data-slot="creative-report-panel-close"
        >
          Close
        </Button>
      </header>

      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        {creating ? null : <input type="hidden" name="id" value={report.id} />}

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-7">
            {CREATIVE_REPORT_FIELD_GROUPS.map((group) => (
              <section key={group.heading} className="flex flex-col gap-3">
                <h3
                  data-slot="creative-report-group-heading"
                  className="border-b border-line pb-1 text-sm font-medium text-text2"
                >
                  {group.heading}
                </h3>
                <div className="flex flex-col gap-4">{group.fields.map(renderField)}</div>
                {group.heading === 'Cost & return' ? (
                  <div className="flex flex-col gap-1.5">
                    <span className={LABEL_CLASS}>Difference CPA</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span data-slot="creative-report-difference-cpa">
                        {difference === null ? (
                          <span className="font-mono text-sm text-text4">{EM_DASH}</span>
                        ) : (
                          <StatusChip tone={difference.tone} label={difference.label} />
                        )}
                      </span>
                      <span className="text-xs text-text3">
                        CPA minus target CPA, computed on save. Read-only.
                      </span>
                    </div>
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface2 px-4 py-3 sm:px-6">
          {demo ? (
            <p className="mr-auto text-xs text-text3" data-slot="creative-report-demo-note">
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
              data-slot="creative-report-save"
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
