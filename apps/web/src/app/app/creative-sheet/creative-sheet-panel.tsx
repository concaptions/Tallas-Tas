'use client';

import { useActionState, useEffect, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import type { CreativeSheetItemListRow } from '@tas/db';
import { creativeTrack } from '@tas/domain/creatives';
import { internalStatusFor, ON_HOLD } from '@tas/domain/state';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  StatusChip,
  Textarea,
} from '@tas/ui';

import { briefPath } from '@/lib/routes';

import {
  updateCreativeSheetItemAction,
  updateCreativeSheetItemDimensionsAction,
  type CreativeSheetActionResult,
} from './actions';
import type { SheetLookups } from './creative-sheet-workspace';
import { DimensionsField, type DimensionsSaveState } from './dimensions-field';
import {
  BRIEF_LOOKUP_LABELS,
  DEMO_FOOTER_NOTICE,
  EM_DASH,
  internalStatusView,
  joinUrlLines,
  NAME_GENERATED_NOTE,
  NOT_SET,
  OPEN_CREATIVE_LABEL,
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
import { notApplicableTag, sidebarQaChecklist } from './focus-mode';
import { SheetIcon } from './sheet-icons';

interface CreativeSheetPanelProps {
  readonly item: CreativeSheetItemListRow;
  /** The brief's resolved lookups (concept, angle, product…), for the Identity section. */
  readonly lookups?: SheetLookups;
  readonly demo: boolean;
  readonly onClose: () => void;
  readonly onSaved: (id: string) => void;
  /** Opens the same creative in Focus Mode (Oct 12); absent where there is no Focus view. */
  readonly onFocusMode?: (id: string) => void;
}

/** A select's "no value", which the action reads as "leave it where it is". */
const NONE_VALUE = '';

type Checks = Record<CreativeSheetCheck, boolean>;

function checksOf(item: CreativeSheetItemListRow): Checks {
  return {
    qaVideoEditor: item.qaVideoEditor,
    qaDesigner: item.qaDesigner,
    qaStrategist: item.qaStrategist,
    spellCheckRequested: item.spellCheckRequested,
  };
}

const LABEL_CLASS = 'text-[11px] tracking-wide text-text3 uppercase';

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
 * The internal-status options for ONE row: its own track's ladder, from the state machine, plus
 * the `on_hold` branch when the row is on it — never the other track's steps, which the server
 * would refuse anyway.
 */
function internalOptionsFor(item: CreativeSheetItemListRow): readonly SheetStatusView[] {
  const track = creativeTrack(item.briefType ?? 'Video');
  const ladder = internalStatusFor(track).map((entry) => internalStatusView(entry.key));
  const onHold = item.internalStatus === ON_HOLD.key ? [internalStatusView(ON_HOLD.key)] : [];
  return [...ladder, ...onHold].filter((view): view is SheetStatusView => view !== null);
}

/**
 * The Brief row sidebar (Oct 12 scope 2): a shadcn/ui Sheet, `side="right"`, in place of the old
 * fixed quick-look panel. It dims the grid behind it, traps focus, closes on Escape, its close
 * button and a press on the overlay; the open row still lives in `?creative-sheet=`. Six sections
 * — Identity, Status, Content, QA, Assets, Meta — titled with the brief's generated name: a FULL
 * record view, so the QA tick the other track owns is listed struck through rather than hidden
 * (Focus Mode hides it). The footer opens the same creative in Focus Mode or on its full page.
 *
 * Since the single-source cutover (2026-10-09) the row IS the brief, so every control here edits
 * `creative_briefs`: the two status tracks (the internal select is the row's own ladder), the
 * three QA ticks, the QA checklist links and the spell-check trigger, and the Dimensions field,
 * which saves on pick. Read-only on purpose: the NAME, which is the month formula, the spelling
 * feedback the AI check wrote, and the brief's own lookups (type, platform, funnel, performance,
 * design link), which the creative's page edits. The header links to that page.
 *
 * Selects and checkboxes post through hidden inputs so an untouched select arrives as `''` (the
 * action leaves the status alone) and an unticked box as `''` (the action stores false), the same
 * contract the Campaigns panel uses. In demo mode every control is inert and the footer says so.
 */
export function CreativeSheetPanel({
  item,
  lookups,
  demo,
  onClose,
  onSaved,
  onFocusMode,
}: CreativeSheetPanelProps) {
  const [state, formAction, pending] = useActionState<CreativeSheetActionResult | null, FormData>(
    updateCreativeSheetItemAction,
    null,
  );

  const [internalStatus, setInternalStatus] = useState(item.internalStatus);
  const [status, setStatus] = useState(item.status);
  const [checks, setChecks] = useState<Checks>(() => checksOf(item));
  const internalOptions = internalOptionsFor(item);

  // The Dimensions field saves ON PICK, outside the form: its own array, its own transition and
  // its own state, so a pick is one write and the footer's Save never has to be pressed for it.
  const [dimensions, setDimensions] = useState<readonly string[]>(item.dimensions);
  const [dimensionsState, setDimensionsState] = useState<DimensionsSaveState>({ status: 'idle' });
  const [, startDimensionsSave] = useTransition();
  const saveDimensions = (next: readonly string[]) => {
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
        {error === undefined ? null : <p className="text-xs text-bad">{error}</p>}
      </div>
    );
  };

  const qaRows = sidebarQaChecklist(item);
  const track = creativeTrack(item.briefType ?? 'Video');

  /**
   * One checkbox. A QA tick the other track owns is still a control — the row IS the brief and
   * the column exists — but it is drawn struck through with an N/A tag, the full-record reading.
   */
  const checkField = (field: SheetCheckField) => {
    const id = `creative-sheet-field-${field.name}`;
    const qa = qaRows.find((row) => row.key === field.name);
    const applicable = qa === undefined || qa.required;
    return (
      <div
        key={field.name}
        data-slot={id}
        data-applicable={qa === undefined ? undefined : applicable ? 'true' : 'false'}
        className="flex items-center gap-3"
      >
        <input
          id={id}
          type="checkbox"
          checked={checks[field.name]}
          disabled={demo}
          onChange={(event) => {
            const next = event.target.checked;
            setChecks((current) => ({ ...current, [field.name]: next }));
          }}
          className={
            applicable
              ? 'size-4 shrink-0 rounded-input border border-line2 bg-surface2 accent-[var(--accent)] disabled:cursor-not-allowed'
              : 'size-4 shrink-0 rounded-input border border-dashed border-line bg-transparent accent-[var(--accent)] disabled:cursor-not-allowed'
          }
        />
        <Label
          htmlFor={id}
          className={
            applicable ? LABEL_CLASS : `${LABEL_CLASS} text-text4 line-through decoration-text4`
          }
        >
          {field.label}
        </Label>
        {qa === undefined ? null : applicable ? (
          checks[field.name] ? null : (
            <span className="ml-auto font-mono text-[9.5px] tracking-wide text-warn uppercase">
              Required
            </span>
          )
        ) : (
          <span className="ml-auto font-mono text-[9.5px] tracking-wide text-text4 uppercase">
            {notApplicableTag(track)}
          </span>
        )}
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

  const row = (label: string, value: ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-1">
      <span className="shrink-0 text-xs text-text3">{label}</span>
      <span className="min-w-0 text-right text-xs leading-relaxed text-text2">{value}</span>
    </div>
  );
  const block = (label: string, value: string | null) => (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold tracking-wide text-text4 uppercase">{label}</span>
      <p className="rounded-input border border-line bg-surface2 px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap text-text2">
        {value ?? dash}
      </p>
    </div>
  );
  const files = (label: string, urls: readonly string[] | null) =>
    urls === null || urls.length === 0 ? (
      <div className="flex items-center gap-2 rounded-input border border-dashed border-line2 px-3 py-2 text-xs text-text4">
        {label} — not uploaded
      </div>
    ) : (
      <div className="flex items-center gap-2 rounded-input border border-line bg-surface2 px-3 py-2 text-xs text-text2">
        <span className="flex-1">{label}</span>
        <span className="font-mono text-[10px] text-text4">
          {String(urls.length)} {urls.length === 1 ? 'file' : 'files'}
        </span>
      </div>
    );
  const detail = item.detail;
  const internalView = internalStatusView(item.internalStatus);
  const clientView = statusView(item.status);

  return (
    <Sheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        data-slot="creative-sheet-panel"
        aria-label={`Creative: ${item.name}`}
        className="w-full gap-0 p-0 sm:max-w-[520px]"
      >
        <SheetHeader className="pr-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">
                Creative Sheet
              </p>
              <SheetTitle
                className="font-mono text-sm leading-snug font-medium break-all text-text"
                data-slot="creative-sheet-panel-title"
              >
                {item.name}
              </SheetTitle>
              <SheetDescription>{NAME_GENERATED_NOTE}</SheetDescription>
              <Link
                href={briefPath(item.id)}
                className="text-xs text-accent underline-offset-2 hover:underline"
                data-slot="creative-sheet-open-brief"
              >
                {OPEN_CREATIVE_LABEL}
              </Link>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-7 shrink-0"
              onClick={onClose}
              aria-label="Close panel"
              data-slot="creative-sheet-panel-close"
            >
              <SheetIcon name="x" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5" data-slot="creative-sheet-panel-chips">
            {internalView === null ? null : (
              <StatusChip tone={internalView.tone} label={internalView.label} />
            )}
            {clientView === null ? null : (
              <StatusChip tone={clientView.tone} label={clientView.label} />
            )}
            {item.briefType === null ? null : <StatusChip tone="mute" label={item.briefType} />}
          </div>
        </SheetHeader>

        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="internalStatus" value={internalStatus} />
          <input type="hidden" name="status" value={status} />
          {(Object.keys(checks) as CreativeSheetCheck[]).map((name) => (
            <input key={name} type="hidden" name={name} value={checks[name] ? 'true' : ''} />
          ))}

          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="flex flex-col gap-7">
              <Group heading={SHEET_GROUPS.identity}>
                <div data-slot="creative-sheet-identity">
                  {row('Concept', lookups?.concept ?? dash)}
                  {row('Angle', lookups?.angle ?? dash)}
                  {row('Batch', <span className="font-mono">{detail.batch ?? EM_DASH}</span>)}
                  {row('Type', item.briefType ?? dash)}
                  {row('Source', detail.source)}
                  {row('Funnel', item.briefFunnel ?? dash)}
                  {row('Version', <span className="font-mono">V{String(detail.version)}</span>)}
                  {row('Product', lookups?.internalProduct ?? dash)}
                </div>
              </Group>

              <Group heading={SHEET_GROUPS.creative}>
                <DimensionsField
                  value={dimensions}
                  onChange={saveDimensions}
                  disabled={demo}
                  saveState={dimensionsState}
                />

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
                    Read from the creative. Edit them on its own page.
                  </p>
                </div>
              </Group>

              <Group heading={SHEET_GROUPS.approval}>
                {selectField(
                  'internalStatus',
                  internalOptions,
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
                <div data-slot="creative-sheet-status-facts">
                  {row(
                    'Due date',
                    detail.dueDate === null ? (
                      dash
                    ) : (
                      <span className="font-mono">{detail.dueDate.toISOString().slice(0, 10)}</span>
                    ),
                  )}
                  {row('Assignee', detail.assignee ?? dash)}
                  {row('Priority', detail.priority ?? dash)}
                  {row('Client note', detail.clientStatusNote ?? dash)}
                </div>
              </Group>

              <Group heading={SHEET_GROUPS.content}>
                <div className="flex flex-col gap-3" data-slot="creative-sheet-content">
                  {block('Script / Ad Content', detail.scriptContent ?? detail.adContent)}
                  {block('Brief to Design', detail.briefToDesign)}
                  {block('Elements tested', detail.elementsTested)}
                  {block('Offer', detail.offer)}
                  {block('Inspiration', detail.inspiration)}
                  {detail.inspoLinks.length === 0 ? null : (
                    <ul className="flex flex-col gap-1">
                      {detail.inspoLinks.map((url) => (
                        <li key={url} className="truncate">
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-[11px] text-accent underline-offset-2 hover:underline"
                          >
                            {url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
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
                    defaultValue={joinUrlLines(item.qaChecklistDoc)}
                    className="min-h-20 font-mono text-xs leading-relaxed"
                  />
                  {docError === undefined ? null : <p className="text-xs text-bad">{docError}</p>}
                </div>
              </Group>

              <Group heading={SHEET_GROUPS.assets}>
                <div className="flex flex-col gap-2" data-slot="creative-sheet-assets">
                  {files('Inspiration images', detail.inspirationImage)}
                  {files('Script breakdown', detail.scriptAndBriefBreakdown)}
                  {files('Design file', detail.designFile)}
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
                    placeholder="The AI check has not run on this creative yet."
                    defaultValue={item.spellingFeedback ?? ''}
                    className="min-h-20 leading-relaxed"
                  />
                </div>
              </Group>

              <Group heading={SHEET_GROUPS.meta}>
                <div data-slot="creative-sheet-meta">
                  {row(
                    'Created',
                    <span className="font-mono">{item.createdAt.toISOString().slice(0, 10)}</span>,
                  )}
                  {row(
                    'Last modified',
                    <span className="font-mono">{item.updatedAt.toISOString().slice(0, 10)}</span>,
                  )}
                  {row('Created by', detail.createdBy ?? dash)}
                  {row('Updated by', detail.updatedBy ?? dash)}
                  {row('Name mode', <span className="font-mono">{detail.nameMode}</span>)}
                </div>
              </Group>
            </div>
          </div>

          <footer className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface2 px-4 py-3 sm:px-6">
            {onFocusMode === undefined ? null : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onFocusMode(item.id);
                }}
                data-slot="creative-sheet-focus-mode"
              >
                <SheetIcon name="focus" />
                Focus Mode
              </Button>
            )}
            <Button asChild variant="secondary" size="sm">
              <Link href={briefPath(item.id)} data-slot="creative-sheet-open-full">
                Open full page
                <SheetIcon name="arrow" />
              </Link>
            </Button>
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
      </SheetContent>
    </Sheet>
  );
}
