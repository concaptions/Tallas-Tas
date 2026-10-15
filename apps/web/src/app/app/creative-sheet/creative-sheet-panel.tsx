'use client';

import { useActionState, useEffect, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import type { CreativeSheetItemListRow } from '@tas/db';
import { creativeTrack } from '@tas/domain/creatives';
import {
  Button,
  Checkbox,
  cn,
  DEMO_WRITE_HINT,
  disabledWriteClassName,
  DisabledWrite,
  formatSheetDate,
  Label,
  SectionLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  StatusChip,
  Textarea,
} from '@tas/ui';
import { ArrowRight, Captions, File, Image, Plus, type LucideIcon } from '@tas/ui/icons';

import type { Role as ViewerRole } from '@tas/domain/roles';

import { briefPath } from '@/lib/routes';
import { updateBriefPartialAction } from '@/app/app/creative-design/actions';
import {
  BriefScriptsTable,
  SIDEBAR_SCRIPTS_EMPTY_MESSAGE,
  type BriefScriptRow,
} from '@/components/briefs/scripts-table';
import { InlineField } from '@/components/briefs/inline-field';

import {
  updateCreativeSheetItemAction,
  updateCreativeSheetItemDimensionsAction,
  type CreativeSheetActionResult,
} from './actions';
import type { SheetLookups } from './creative-sheet-workspace';
import { DimensionsField, type DimensionsSaveState } from './dimensions-field';
import {
  assetSubline,
  BRIEF_LOOKUP_LABELS,
  DEMO_FOOTER_NOTICE,
  EM_DASH,
  INTERNAL_STATUS_OPTIONS,
  internalStatusView,
  joinUrlLines,
  NOT_SET,
  QA_CHECKS,
  QA_DOC_HINT,
  SHEET_DUE_DATE_LABEL,
  SHEET_GROUPS,
  SHEET_LABELS,
  sheetQaGate,
  SPELL_CHECK_FIELD,
  STATUS_OPTIONS,
  statusView,
  VOICEOVER_TYPE_OPTIONS,
  type BriefSectionField,
  type CreativeSheetCheck,
  type CreativeSheetFieldName,
  type SheetCheckField,
  type SheetStatusView,
} from './fields';
import { notApplicableTag, sidebarQaChecklist } from './focus-mode';

interface CreativeSheetPanelProps {
  readonly item: CreativeSheetItemListRow;
  /** The brief's resolved lookups (concept, angle, product…), for the Identity section. */
  readonly lookups?: SheetLookups;
  readonly demo: boolean;
  readonly onClose: () => void;
  readonly onSaved: (id: string) => void;
  /** Opens the same creative in Focus Mode (Oct 12); absent where there is no Focus view. */
  readonly onFocusMode?: (id: string) => void;
  /**
   * Phase B5 Fix A (Oct 15): when the parent resolves the viewer's role and user id, the sidebar
   * exposes the Identity and Content fields as InlineField editors; when they are absent, those
   * fields keep their read-only renders exactly as before. The role gate (`canEditBrief`) runs
   * for every editor, so a video_editor who is not the brief's assignee sees the same chip as
   * the role-less demo mode render.
   */
  readonly actorRole?: ViewerRole | null;
  readonly actorUserId?: string | null;
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

/** The form labels (textareas); the selects and the QA ticks read in sentence case (B2.V33, B2.V16). */
const LABEL_CLASS = 'text-[11px] tracking-wide text-text3 uppercase';
const FIELD_LABEL_CLASS = 'text-xs text-text3';

/**
 * One board section (B2.V9, B2.V10): full-bleed, a rule beneath every section but the last, and
 * the 10px eyebrow heading with its trailing rule from `@tas/ui`.
 */
function Group({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="border-b border-line px-5 py-3.5 last:border-b-0">
      <SectionLabel data-slot="creative-sheet-group-heading" className="mb-3">
        {heading}
      </SectionLabel>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

/**
 * The Brief row sidebar (Oct 12 scope 2): a shadcn/ui Sheet, `side="right"`, in place of the old
 * fixed quick-look panel. It dims the grid behind it, traps focus, closes on Escape, the
 * primitive's own close button and a press on the overlay; the open row still lives in
 * `?creative-sheet=`. Six sections — Identity, Status, Content, QA, Assets, Meta — titled with the
 * brief's generated name (the sheet's month-prefixed name is the dialog's accessible description):
 * a FULL record view, so the QA tick the other track owns is listed struck through rather than
 * hidden (Focus Mode hides it). The footer opens the same creative in Focus Mode or on its full
 * page, and saves.
 *
 * Since the single-source cutover (2026-10-09) the row IS the brief, so every control here edits
 * `creative_briefs`: the two status tracks (the internal select is the one `INTERNAL_STATUS` list,
 * the same for both creative tracks since the Oct 12 consolidation, Ticket 5 / 0067), the
 * three QA ticks, the QA checklist links and the spell-check trigger, and the Dimensions field,
 * which saves on pick. Read-only on purpose: the NAME, which is the month formula, the spelling
 * feedback the AI check wrote, and the brief's own lookups (platform, performance, design link),
 * which the creative's page edits.
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
  actorRole,
  actorUserId,
}: CreativeSheetPanelProps) {
  const [state, formAction, pending] = useActionState<CreativeSheetActionResult | null, FormData>(
    updateCreativeSheetItemAction,
    null,
  );

  const [internalStatus, setInternalStatus] = useState(item.internalStatus);
  const [status, setStatus] = useState(item.status);
  const [checks, setChecks] = useState<Checks>(() => checksOf(item));
  const internalOptions = INTERNAL_STATUS_OPTIONS;

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
        <Label htmlFor={id} className={FIELD_LABEL_CLASS}>
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
  // The gate line follows the LOCAL ticks, so it moves before Save (B4.A12).
  const gate = sheetQaGate(track, checks);

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
        className="flex items-center gap-2 py-1"
      >
        <Checkbox
          id={id}
          variant={applicable ? 'default' : 'na'}
          checked={checks[field.name]}
          disabled={demo}
          onChange={(event) => {
            const next = event.target.checked;
            setChecks((current) => ({ ...current, [field.name]: next }));
          }}
        />
        <Label
          htmlFor={id}
          className={
            applicable ? 'text-xs text-text2' : 'text-xs text-text4 line-through decoration-text4'
          }
        >
          {field.label}
        </Label>
        {qa === undefined ? null : applicable ? (
          checks[field.name] ? null : (
            <span
              data-slot="qa-check-tag"
              data-kind="required"
              className="ml-auto shrink-0 font-mono text-[10px] tracking-[.03em] text-warn uppercase"
            >
              Required
            </span>
          )
        ) : (
          <span
            data-slot="qa-check-tag"
            data-kind="na"
            className="ml-auto shrink-0 font-mono text-[10px] tracking-[.03em] text-text4 uppercase"
          >
            {notApplicableTag(track)}
          </span>
        )}
      </div>
    );
  };

  const dash = <span className="text-text4">{EM_DASH}</span>;
  const docError = fieldError('qaChecklistDoc');

  const row = (label: string, value: ReactNode) => (
    <div className="flex items-start justify-between gap-3.5 py-1">
      <span className="shrink-0 text-xs whitespace-nowrap text-text3">{label}</span>
      <span className="min-w-0 text-right text-xs leading-normal text-text2">{value}</span>
    </div>
  );
  const block = (label: string, value: string | null) => (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold tracking-wider text-text4 uppercase">{label}</span>
      <p className="rounded-input border border-line bg-surface2 px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap text-text2">
        {value ?? dash}
      </p>
    </div>
  );

  // The board's asset row (B2.V20, B2.V21): an icon tile, the name over a mono sub-line; the empty
  // row keeps its dashed chrome and gains the plus glyph.
  const files = (label: string, urls: readonly string[] | null, Icon: LucideIcon) =>
    urls === null || urls.length === 0 ? (
      <div className="flex items-center gap-2 rounded-input border border-dashed border-line2 px-3 py-2 text-xs text-text4">
        <Plus aria-hidden="true" className="size-3.5 shrink-0" />
        {label} — not uploaded
      </div>
    ) : (
      <div className="flex items-center gap-2.5 rounded-input border border-line bg-surface2 px-2.5 py-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-input bg-surface4 text-text3">
          <Icon aria-hidden="true" className="size-3.5" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-xs leading-tight text-text2">{label}</span>
          <span className="mt-0.5 font-mono text-[9.5px] text-text4">{assetSubline(urls)}</span>
        </span>
      </div>
    );
  const detail = item.detail;
  const internalView = internalStatusView(item.internalStatus);
  const clientView = statusView(item.status);

  // Phase B5 Fix A (Oct 15): the row where the Identity / Content InlineField editors land.
  // Reads the manifest for the right surface, routes commits through `updateBriefPartialAction`.
  // When the parent has not resolved an actor role (older callers, demo mode), the row falls
  // back to the plain readonly `row` / `block` helper above.
  const briefRecord = {
    ...item,
    ...detail,
  } as unknown as Readonly<Record<string, unknown>>;
  const inlineUpdate = async (patch: Readonly<Record<string, unknown>>): Promise<void> => {
    const result = await updateBriefPartialAction(item.briefId, patch);
    if (result.ok) {
      onSaved(result.id);
    }
  };
  const inlineRow = (field: BriefSectionField): ReactNode => (
    <div className="flex items-start justify-between gap-3.5 py-1">
      <span className="shrink-0 text-xs whitespace-nowrap text-text3">{field.label}</span>
      <span className="min-w-0 text-right text-xs leading-normal text-text2">
        <InlineField
          brief={briefRecord}
          field={field}
          surface="sidebar"
          actorRole={actorRole}
          actorUserId={actorUserId}
          onUpdate={inlineUpdate}
        />
      </span>
    </div>
  );
  const inlineBlock = (field: BriefSectionField): ReactNode => (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold tracking-wider text-text4 uppercase">
        {field.label}
      </span>
      <InlineField
        brief={briefRecord}
        field={field}
        surface="sidebar"
        actorRole={actorRole}
        actorUserId={actorUserId}
        onUpdate={inlineUpdate}
      />
    </div>
  );
  const canInlineEdit = actorRole !== undefined && actorRole !== null && !demo;
  // The three Identity fields the sidebar now edits inline (Oct 15, user's named need):
  // Batch (text), Source (singleSelect), Version (text). Everything else in Identity stays
  // readonly for now — the full rewire is Fix B.
  const identityInlineFields = SHEET_GROUPS.identity.fields.filter((f) =>
    (['batch', 'source', 'version'] as const).includes(f.name as 'batch' | 'source' | 'version'),
  );
  const contentInlineFields = SHEET_GROUPS.content.fields.filter((f) =>
    (['scriptContent', 'briefText', 'music'] as const).includes(
      f.name as 'scriptContent' | 'briefText' | 'music',
    ),
  );

  /**
   * Oct 15 SCRIPTS_SIDEBAR follow-up: the sidebar's Scripts table reads the stored script content
   * as a static row — the live word count ticks whenever a change is saved on the brief page, not
   * as the sidebar viewer types. One row for the brief's own script when there is one; empty
   * array otherwise, which the shared table shows as "No scripts yet. Add one above.".
   */
  const sidebarScripts: readonly BriefScriptRow[] =
    detail.scriptContent === null || detail.scriptContent.trim() === ''
      ? []
      : [
          {
            id: 'sidebar-script-content',
            label: detail.scriptContent,
            kind: 'Script',
            href: null,
          },
        ];

  return (
    <Sheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        data-slot="creative-sheet-panel"
        aria-label={`Creative: ${item.briefName ?? item.name}`}
        className="w-full gap-0 p-0 sm:max-w-[460px]"
      >
        <SheetHeader className="px-5 pt-4 pr-14 pb-3.5">
          <SheetTitle
            className="font-mono text-[13px] leading-normal font-medium tracking-[-.01em] break-all text-text"
            data-slot="creative-sheet-panel-title"
          >
            {item.briefName ?? item.name}
          </SheetTitle>
          <SheetDescription className="sr-only">{item.name}</SheetDescription>
          <div className="mt-1.5 flex flex-wrap gap-1.5" data-slot="creative-sheet-panel-chips">
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

          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col">
              <Group heading={SHEET_GROUPS.identity.label}>
                <div data-slot="creative-sheet-identity">
                  {row('Concept', lookups?.concept ?? dash)}
                  {row('Angle', lookups?.angle ?? dash)}
                  {canInlineEdit
                    ? identityInlineFields
                        .filter((f) => f.name === 'batch')
                        .map((f) => <div key={f.name}>{inlineRow(f)}</div>)
                    : row('Batch', <span className="font-mono">{detail.batch ?? EM_DASH}</span>)}
                  {row('Type', item.briefType ?? dash)}
                  {canInlineEdit
                    ? identityInlineFields
                        .filter((f) => f.name === 'source')
                        .map((f) => <div key={f.name}>{inlineRow(f)}</div>)
                    : row('Source', detail.source)}
                  {row('Funnel', item.briefFunnel ?? dash)}
                  {canInlineEdit
                    ? identityInlineFields
                        .filter((f) => f.name === 'version')
                        .map((f) => <div key={f.name}>{inlineRow(f)}</div>)
                    : row('Version', <span className="font-mono">V{String(detail.version)}</span>)}
                  {row('Product', lookups?.internalProduct ?? dash)}
                </div>

                <DimensionsField
                  value={dimensions}
                  onChange={saveDimensions}
                  disabled={demo}
                  saveState={dimensionsState}
                />

                <div data-slot="creative-sheet-brief-lookups">
                  {row(
                    BRIEF_LOOKUP_LABELS.briefPlatform,
                    item.briefPlatform.length === 0 ? (
                      dash
                    ) : (
                      <span className="flex flex-wrap justify-end gap-1">
                        {item.briefPlatform.map((platform) => (
                          <StatusChip key={platform} tone="mute" label={platform} />
                        ))}
                      </span>
                    ),
                  )}
                  {row(
                    BRIEF_LOOKUP_LABELS.briefPerformance,
                    item.briefPerformance === null ? (
                      dash
                    ) : (
                      <StatusChip tone="info" label={item.briefPerformance} />
                    ),
                  )}
                  {row(
                    BRIEF_LOOKUP_LABELS.briefDesignFileUrl,
                    item.briefDesignFileUrl === null ? (
                      dash
                    ) : (
                      <a
                        href={item.briefDesignFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate font-mono text-xs text-accent underline-offset-2 hover:underline"
                      >
                        {item.briefDesignFileUrl}
                      </a>
                    ),
                  )}
                  <p className="pt-1 text-xs text-text4">
                    Read from the creative. Edit them on its own page.
                  </p>
                </div>
              </Group>

              <Group heading={SHEET_GROUPS.content.label}>
                <div className="flex flex-col gap-3" data-slot="creative-sheet-content">
                  {canInlineEdit
                    ? contentInlineFields
                        .filter((f) => f.name === 'scriptContent')
                        .map((f) => <div key={f.name}>{inlineBlock(f)}</div>)
                    : block('Script / Ad Content', detail.scriptContent ?? detail.adContent)}
                  {/*
                    Oct 15 SCRIPTS_SIDEBAR follow-up: the walkthrough found the sidebar's Content
                    section stopped at the prose block and the Assets section said "Script
                    breakdown — not uploaded" with no table at all. The brief's Scripts table
                    (Type / Script / B-roll / Instructions, with the live "N words" line under
                    every Script cell) now draws here too, through the component shared with
                    `brief-detail.tsx`. Read-only: the sidebar does not edit scripts — the brief
                    page does — so the only input is the ephemeral B-roll / Instructions field
                    the shared component already renders.
                   */}
                  <div data-slot="creative-sheet-scripts">
                    <BriefScriptsTable
                      scripts={sidebarScripts}
                      demo={demo}
                      emptyMessage={SIDEBAR_SCRIPTS_EMPTY_MESSAGE}
                    />
                  </div>
                  {block('Brief to Design', detail.briefToDesign)}
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
                  {/* Ticket 6 Content fields (migration 0069), read-only on the sidebar: the sidebar
                      is a quick-look surface, so a change goes through the brief page's own form.
                      Rendered through the shared `block` helper that every other prose field uses. */}
                  {canInlineEdit
                    ? contentInlineFields
                        .filter((f) => f.name === 'briefText')
                        .map((f) => <div key={f.name}>{inlineBlock(f)}</div>)
                    : block('Brief', detail.briefText)}
                  {canInlineEdit
                    ? contentInlineFields
                        .filter((f) => f.name === 'music')
                        .map((f) => <div key={f.name}>{inlineBlock(f)}</div>)
                    : block('Music', detail.music)}
                  {block(
                    'Voiceover type',
                    detail.voiceoverType === null
                      ? null
                      : (VOICEOVER_TYPE_OPTIONS.find(
                          (option) => option.key === detail.voiceoverType,
                        )?.label ?? detail.voiceoverType),
                  )}
                  {block('Voiceover script', detail.voiceoverScript)}
                </div>
              </Group>

              <Group heading={SHEET_GROUPS.assets.label}>
                <div className="flex flex-col gap-2" data-slot="creative-sheet-assets">
                  {files('Inspiration images', detail.inspirationImage, Image)}
                  {files('Script breakdown', detail.scriptAndBriefBreakdown, File)}
                  {files('Design file', detail.designFile, File)}
                </div>
              </Group>

              <Group heading={SHEET_GROUPS.qa.label}>
                <DisabledWrite active={demo} hint={DEMO_WRITE_HINT} className="w-full">
                  <div className="flex w-full flex-col">{QA_CHECKS.map(checkField)}</div>
                </DisabledWrite>
                <p
                  data-slot="creative-sheet-qa-gate"
                  data-open={gate.open ? 'true' : 'false'}
                  className={cn('text-[11px]', gate.open ? 'text-ok' : 'text-warn')}
                >
                  {gate.label}
                </p>
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
                <DisabledWrite active={demo} hint={DEMO_WRITE_HINT} className="w-full">
                  <div className="flex w-full flex-col">{checkField(SPELL_CHECK_FIELD)}</div>
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

              <Group heading={SHEET_GROUPS.approval.label}>
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
                    SHEET_DUE_DATE_LABEL,
                    detail.dueDate === null ? dash : formatSheetDate(detail.dueDate),
                  )}
                  {row('Priority', detail.priority ?? dash)}
                  {row('Client note', detail.clientStatusNote ?? dash)}
                </div>
              </Group>

              <Group heading={SHEET_GROUPS.activity.label}>
                <div data-slot="creative-sheet-meta">
                  {row('Created', formatSheetDate(item.createdAt))}
                  {row('Last modified', formatSheetDate(item.updatedAt))}
                  {row('Creator', detail.createdBy ?? dash)}
                  {row('Editor', detail.assignee ?? dash)}
                  {row('Updated by', detail.updatedBy ?? dash)}
                  {row('Name mode', <span className="font-mono">{detail.nameMode}</span>)}
                </div>
              </Group>
            </div>
          </div>

          <SheetFooter className="sticky bottom-0 flex-wrap items-center justify-end px-5 py-3">
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
                <Captions aria-hidden="true" className="size-3.5" />
                Focus Mode
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href={briefPath(item.id)} data-slot="creative-sheet-open-full">
                Open full page
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            </Button>
            {demo ? (
              <p className="mr-auto text-xs text-text3" data-slot="creative-sheet-demo-note">
                {DEMO_FOOTER_NOTICE}
              </p>
            ) : state !== null && !state.ok ? (
              <p className="mr-auto text-xs text-bad">{state.error}</p>
            ) : null}
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
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
