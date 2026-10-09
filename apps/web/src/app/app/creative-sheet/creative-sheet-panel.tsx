'use client';

import { useActionState, useEffect, useState, useTransition, type ReactNode } from 'react';
import type { CreativeSheetItemListRow } from '@tas/db';
import {
  Button,
  DEMO_WRITE_HINT,
  disabledWriteClassName,
  DisabledWrite,
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
  createCreativeSheetItemAction,
  updateCreativeSheetItemAction,
  updateCreativeSheetItemDimensionsAction,
  type CreativeSheetActionResult,
} from './actions';
import { DimensionsField, type DimensionsSaveState } from './dimensions-field';
import {
  BRIEF_LOOKUP_LABELS,
  DEMO_FOOTER_NOTICE,
  DIMENSIONS_AFTER_SAVE_NOTE,
  EM_DASH,
  INTERNAL_STATUS_OPTIONS,
  internalStatusView,
  joinUrlLines,
  NAME_GENERATED_NOTE,
  NEW_ITEM,
  NOT_SET,
  QA_CHECKS,
  QA_DOC_HINT,
  SHEET_GROUPS,
  SHEET_LABELS,
  SPELL_CHECK_FIELD,
  STATUS_OPTIONS,
  statusView,
  type CreativeSheetCheck,
  type CreativeSheetFieldName,
  type SheetCheckField,
  type SheetStatusView,
} from './fields';

export { NEW_ITEM };

export interface LinkOption {
  readonly id: string;
  readonly name: string;
}

interface CreativeSheetPanelProps {
  readonly item: CreativeSheetItemListRow | null;
  /** The brand's briefs, for the "Creative Name" picker: id and generated name. */
  readonly briefs: readonly LinkOption[];
  readonly demo: boolean;
  readonly onClose: () => void;
  readonly onSaved: (id: string) => void;
}

/** A select's "no value", which the action stores as NULL. Empty, never the string `'none'`. */
const NONE_VALUE = '';

type Checks = Record<CreativeSheetCheck, boolean>;

function checksOf(item: CreativeSheetItemListRow | null): Checks {
  return {
    qaVideoEditor: item?.qaVideoEditor ?? false,
    qaDesigner: item?.qaDesigner ?? false,
    qaStrategist: item?.qaStrategist ?? false,
    spellCheckRequested: item?.spellCheckRequested ?? false,
  };
}

const LABEL_CLASS = 'text-[11px] tracking-wide text-text3 uppercase';
const CLEAR_CLASS =
  'self-start rounded-input text-xs text-text3 underline-offset-2 hover:text-text2 hover:underline';

function Group({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3
        data-slot="creative-sheet-group-heading"
        className="border-b border-line pb-1 text-sm font-medium text-text2"
      >
        {heading}
      </h3>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

/**
 * The right-side Creative Sheet panel. Deliberately not a modal: no backdrop, no focus trap — the
 * grid beside it stays visible and clickable. Fixed to the right edge at 60% of the viewport, full
 * width under 900px, closes on Escape or on its close button.
 *
 * Every stored Airtable field is here as a labelled control: the "Creative Name" link as a picker
 * over the brand's briefs, the three selects over the `@tas/db` vocabularies, the six checkboxes,
 * the client's comments and the QA checklist links. Two things are read-only on purpose: the NAME,
 * which is the formula the query layer computed, and the spelling feedback, which the AI check
 * wrote. The brief's own fields (type, platform, funnel, performance, design link) are lookups the
 * query layer joined in and are shown, never edited, here.
 *
 * Selects and checkboxes post through hidden inputs so an unset select arrives as `''` (the
 * action stores NULL) and an unticked box as `''` (the action stores false), the same contract the
 * Campaigns panel uses. In demo mode every control is inert and the footer says so.
 */
export function CreativeSheetPanel({
  item,
  briefs,
  demo,
  onClose,
  onSaved,
}: CreativeSheetPanelProps) {
  const creating = item === null;
  const action = creating ? createCreativeSheetItemAction : updateCreativeSheetItemAction;
  const [state, formAction, pending] = useActionState<CreativeSheetActionResult | null, FormData>(
    action,
    null,
  );

  const [briefId, setBriefId] = useState(item?.briefId ?? NONE_VALUE);
  const [internalStatus, setInternalStatus] = useState(item?.internalStatus ?? NONE_VALUE);
  const [status, setStatus] = useState(item?.status ?? NONE_VALUE);
  const [checks, setChecks] = useState<Checks>(() => checksOf(item));

  // The Dimensions field saves ON PICK, outside the form: its own array, its own transition and
  // its own state, so a pick is one write and the footer's Save never has to be pressed for it.
  const [dimensions, setDimensions] = useState<readonly string[]>(item?.dimensions ?? []);
  const [dimensionsState, setDimensionsState] = useState<DimensionsSaveState>({ status: 'idle' });
  const [, startDimensionsSave] = useTransition();
  const saveDimensions = (next: readonly string[]) => {
    if (item === null) return;
    const previous = dimensions;
    setDimensions(next);
    setDimensionsState({ status: 'pending' });
    startDimensionsSave(async () => {
      const result = await updateCreativeSheetItemDimensionsAction(item.id, next);
      if (result.ok) {
        setDimensionsState({ status: 'saved' });
        onSaved(result.id);
      } else {
        setDimensions(previous);
        setDimensionsState({ status: 'error', error: result.error });
      }
    });
  };

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

  const fieldError = (name: CreativeSheetFieldName): string | undefined =>
    state !== null && !state.ok ? state.fieldErrors?.[name] : undefined;

  const selectField = (
    name: 'internalStatus' | 'status',
    options: readonly SheetStatusView[],
    value: string,
    setValue: (next: string) => void,
    view: SheetStatusView | null,
  ) => {
    const id = `creative-sheet-field-${name}`;
    const error = fieldError(name);
    return (
      <div data-slot={id} className="flex flex-col gap-1.5">
        <Label htmlFor={id} className={LABEL_CLASS}>
          {SHEET_LABELS[name]}
        </Label>
        <div className="flex items-center gap-2">
          <Select
            value={value === NONE_VALUE ? undefined : value}
            onValueChange={setValue}
            disabled={demo}
          >
            <SelectTrigger id={id} className="w-full" aria-label={SHEET_LABELS[name]}>
              <SelectValue placeholder={NOT_SET} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {view === null ? null : <StatusChip tone={view.tone} label={view.label} />}
        </div>
        {value !== NONE_VALUE && !demo ? (
          <button
            type="button"
            onClick={() => {
              setValue(NONE_VALUE);
            }}
            className={CLEAR_CLASS}
          >
            Clear
          </button>
        ) : null}
        {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
      </div>
    );
  };

  const checkField = (field: SheetCheckField) => {
    const id = `creative-sheet-field-${field.name}`;
    return (
      <div key={field.name} data-slot={id} className="flex items-center gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checks[field.name]}
          disabled={demo}
          onChange={(event) => {
            const next = event.target.checked;
            setChecks((current) => ({ ...current, [field.name]: next }));
          }}
          className="size-4 shrink-0 rounded-input border border-line2 bg-surface2 accent-[var(--accent)] disabled:cursor-not-allowed"
        />
        <Label htmlFor={id} className={LABEL_CLASS}>
          {field.label}
        </Label>
      </div>
    );
  };

  const lookup = (label: string, value: ReactNode) => (
    <div className="flex flex-col gap-0.5">
      <span className={LABEL_CLASS}>{label}</span>
      <span className="text-sm text-text2">{value}</span>
    </div>
  );

  const dash = <span className="text-text4">{EM_DASH}</span>;
  const docError = fieldError('qaChecklistDoc');
  const briefError = fieldError('briefId');

  return (
    <aside
      data-slot="creative-sheet-panel"
      aria-label={creating ? 'New sheet row' : `Sheet row: ${item.name}`}
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-lg min-[900px]:w-[60%]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">
            {creating ? 'New sheet row' : 'Creative Sheet'}
          </p>
          <h2
            className="truncate font-mono text-lg font-semibold text-text"
            data-slot="creative-sheet-panel-title"
          >
            {creating ? 'New sheet row' : item.name}
          </h2>
          <p className="text-xs text-text3">{NAME_GENERATED_NOTE}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close panel"
          data-slot="creative-sheet-panel-close"
        >
          Close
        </Button>
      </header>

      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        {creating ? null : <input type="hidden" name="id" value={item.id} />}
        <input type="hidden" name="briefId" value={briefId} />
        <input type="hidden" name="internalStatus" value={internalStatus} />
        <input type="hidden" name="status" value={status} />
        {(Object.keys(checks) as CreativeSheetCheck[]).map((name) => (
          <input key={name} type="hidden" name={name} value={checks[name] ? 'true' : ''} />
        ))}

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-7">
            <Group heading={SHEET_GROUPS.creative}>
              <div data-slot="creative-sheet-field-briefId" className="flex flex-col gap-1.5">
                <Label htmlFor="creative-sheet-field-briefId" className={LABEL_CLASS}>
                  {SHEET_LABELS.briefId}
                </Label>
                <Select
                  value={briefId === NONE_VALUE ? undefined : briefId}
                  onValueChange={setBriefId}
                  disabled={demo}
                >
                  <SelectTrigger
                    id="creative-sheet-field-briefId"
                    className="w-full font-mono text-xs"
                    aria-label={SHEET_LABELS.briefId}
                  >
                    <SelectValue placeholder="No creative linked" />
                  </SelectTrigger>
                  <SelectContent>
                    {briefs.map((brief) => (
                      <SelectItem key={brief.id} value={brief.id} className="font-mono text-xs">
                        {brief.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {briefId !== NONE_VALUE && !demo ? (
                  <button
                    type="button"
                    onClick={() => {
                      setBriefId(NONE_VALUE);
                    }}
                    className={CLEAR_CLASS}
                  >
                    Clear creative
                  </button>
                ) : null}
                {briefError === undefined ? null : <p className="text-xs text-bad">{briefError}</p>}
              </div>

              {creating ? (
                <p className="text-xs text-text4" data-slot="creative-sheet-dimensions-later">
                  {DIMENSIONS_AFTER_SAVE_NOTE}
                </p>
              ) : (
                <DimensionsField
                  value={dimensions}
                  onChange={saveDimensions}
                  disabled={demo}
                  saveState={dimensionsState}
                />
              )}

              {creating ? null : (
                <div
                  data-slot="creative-sheet-brief-lookups"
                  className="grid gap-3 rounded-card border border-line bg-surface2 p-3 sm:grid-cols-2"
                >
                  {lookup(BRIEF_LOOKUP_LABELS.briefType, item.briefType ?? dash)}
                  {lookup(BRIEF_LOOKUP_LABELS.briefFunnel, item.briefFunnel ?? dash)}
                  {lookup(
                    BRIEF_LOOKUP_LABELS.briefPlatform,
                    item.briefPlatform.length === 0 ? (
                      dash
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {item.briefPlatform.map((platform) => (
                          <StatusChip key={platform} tone="mute" label={platform} />
                        ))}
                      </span>
                    ),
                  )}
                  {lookup(
                    BRIEF_LOOKUP_LABELS.briefPerformance,
                    item.briefPerformance === null ? (
                      dash
                    ) : (
                      <StatusChip tone="info" label={item.briefPerformance} />
                    ),
                  )}
                  {lookup(
                    BRIEF_LOOKUP_LABELS.briefDesignFileUrl,
                    item.briefDesignFileUrl === null ? (
                      dash
                    ) : (
                      <a
                        href={item.briefDesignFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate font-mono text-xs text-accent underline-offset-2 hover:underline"
                      >
                        {item.briefDesignFileUrl}
                      </a>
                    ),
                  )}
                  <p className="text-xs text-text4 sm:col-span-2">
                    Read from the linked creative. Edit them on its own page.
                  </p>
                </div>
              )}
            </Group>

            <Group heading={SHEET_GROUPS.approval}>
              {selectField(
                'internalStatus',
                INTERNAL_STATUS_OPTIONS,
                internalStatus,
                setInternalStatus,
                internalStatusView(internalStatus === NONE_VALUE ? null : internalStatus),
              )}
              {selectField(
                'status',
                STATUS_OPTIONS,
                status,
                setStatus,
                statusView(status === NONE_VALUE ? null : status),
              )}
            </Group>

            <Group heading={SHEET_GROUPS.qa}>
              <DisabledWrite active={demo} hint={DEMO_WRITE_HINT} className="w-full">
                <div className="flex w-full flex-col gap-2">{QA_CHECKS.map(checkField)}</div>
              </DisabledWrite>
              <div
                data-slot="creative-sheet-field-qaChecklistDoc"
                className="flex flex-col gap-1.5"
              >
                <Label htmlFor="creative-sheet-field-qaChecklistDoc" className={LABEL_CLASS}>
                  {SHEET_LABELS.qaChecklistDoc}
                  <span className="ml-1.5 text-text4 normal-case">{QA_DOC_HINT}</span>
                </Label>
                <Textarea
                  id="creative-sheet-field-qaChecklistDoc"
                  name="qaChecklistDoc"
                  readOnly={demo}
                  aria-invalid={docError !== undefined}
                  placeholder={demo ? NOT_SET : 'https://docs.example/qa-checklist'}
                  defaultValue={joinUrlLines(item?.qaChecklistDoc ?? null)}
                  className="min-h-20 font-mono text-xs leading-relaxed"
                />
                {docError === undefined ? null : <p className="text-xs text-bad">{docError}</p>}
              </div>
            </Group>

            <Group heading={SHEET_GROUPS.spelling}>
              <DisabledWrite active={demo} hint={DEMO_WRITE_HINT} className="w-full">
                <div className="flex w-full flex-col gap-2">{checkField(SPELL_CHECK_FIELD)}</div>
              </DisabledWrite>
              <div
                data-slot="creative-sheet-field-spellingFeedback"
                className="flex flex-col gap-1.5"
              >
                <Label htmlFor="creative-sheet-field-spellingFeedback" className={LABEL_CLASS}>
                  {SHEET_LABELS.spellingFeedback}
                  <span className="ml-1.5 text-text4 normal-case">read-only</span>
                </Label>
                <Textarea
                  id="creative-sheet-field-spellingFeedback"
                  readOnly
                  placeholder="The AI check has not run on this row yet."
                  defaultValue={item?.spellingFeedback ?? ''}
                  className="min-h-20 leading-relaxed"
                />
              </div>
            </Group>
          </div>
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface2 px-4 py-3 sm:px-6">
          {demo ? (
            <p className="mr-auto text-xs text-text3" data-slot="creative-sheet-demo-note">
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
              data-slot="creative-sheet-save"
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
