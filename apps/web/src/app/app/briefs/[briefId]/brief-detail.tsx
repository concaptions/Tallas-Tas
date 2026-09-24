'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CREATIVE_SOURCES, creativeNameForConcept } from '@tas/domain/creatives';
import type { ClientStatusKey, CreativeTrack, InternalStatusKey } from '@tas/domain/state';
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
  TwoTrackApproval,
} from '@tas/ui';

import { briefPath, briefsPath } from '@/lib/routes';

import {
  duplicateBriefAction,
  updateBriefAction,
  type BriefActionResult,
  type BriefFieldName,
} from '../actions';
import { runSpellCheckAction, type SpellCheckActionResult } from '../spell-check-action';
import {
  BRIEF_HEADINGS,
  BRIEF_PROSE_FIELDS,
  DEMO_FOOTER_NOTICE,
  EM_DASH,
  NO_SPELLING_NOTE,
  STANDALONE_CONCEPT_SLUG,
  STANDALONE_NOTE,
  VERSION_OPTIONS,
  advanceLabel,
  briefDimensions,
  creativeTypeLabel,
  nextInternalStatus,
  priorityView,
  productSuffixOf,
} from '../fields';
import { BriefName } from './brief-name';
import { DimensionsGrid } from './dimensions-grid';
import { InspirationList } from './inspiration-list';
import { QaChecklist } from './qa-checklist';

/** The parent concept, as the left column's context card wants it. `null` is PRD §8's standalone. */
export interface BriefConceptCard {
  readonly id: string;
  /** The concept's own generated `Batch-Angle-Theme` name. */
  readonly name: string;
  readonly batch: string | null;
  readonly angleName: string | null;
  readonly productName: string | null;
  readonly href: string;
}

/** The columns this page shows and submits. `name` is here to be READ, never to be edited. */
export interface BriefValues {
  readonly id: string;
  readonly name: string;
  readonly source: string;
  readonly conceptId: string | null;
  readonly batch: string | null;
  readonly funnel: string;
  readonly type: string;
  readonly sequence: number;
  readonly version: number;
  readonly priority: string | null;
  readonly assignee: string | null;
  readonly briefToDesign: string | null;
  readonly scriptContent: string | null;
  readonly elementsTested: string | null;
  readonly inspoLinks: readonly string[];
  readonly dimensions: readonly string[];
  readonly spellingFeedback: string | null;
  readonly angleId: string | null;
  readonly productId: string | null;
  readonly spellingFeedback2: string | null;
  readonly clickForAiSpellChecker: boolean;
  readonly adContent: string | null;
  readonly inspiration: string | null;
  readonly inspirationImage: readonly string[] | null;
  readonly qaChecklistDoc: readonly string[] | null;
  readonly designFile: readonly string[] | null;
  readonly scriptAndBriefBreakdown: readonly string[] | null;
  readonly language: string | null;
  readonly offer: string | null;
  readonly qaVideoEditor: boolean;
  readonly qaDesigner: boolean;
  readonly qaStrategist: boolean;
}

interface BriefDetailProps {
  readonly brief: BriefValues;
  readonly concept: BriefConceptCard | null;
  /** Which internal ladder this brief is graded on, carried on the row by `briefs-source`. */
  readonly track: CreativeTrack;
  readonly internal: InternalStatusKey;
  readonly client: ClientStatusKey;
  readonly demo: boolean;
}

/** The form every write on this page submits to, named so the rail's button can reach it. */
const FORM_ID = 'brief-form';

/**
 * The Creative Brief detail page (PRD §5.10, ticket criteria 4, 6–12).
 *
 * THREE COLUMNS, because a brief is read by three people at once: the left is what the creative IS
 * (its concept, who owns it, its type, version, priority and delivery ratios), the centre is what
 * gets MADE (the three prose sections and the inspiration behind them), and the right is where it
 * HAS GOT TO (the two-track rail, the QA ticks and the spelling pass). They are 30/45/25 side by
 * side on a wide screen, drop the rail under the other two at the shell's md breakpoint — where
 * three columns would squeeze the stepper past reading — and stack to one column below it, so a
 * phone reads them in that same order.
 *
 * THE NAME IS NOT A FIELD. `BriefName` renders `creativeNameForConcept` from
 * `@tas/domain/creatives` — the one place the §7 string is built — and the Version dropdown
 * re-renders it with NO ROUND TRIP, because the formula is pure and runs in the browser. There is
 * no input holding the name, and `updateBriefAction` ignores anything a form claims it is called:
 * it re-derives the name from the concept row it reads itself.
 *
 * ONE FORM, TWO SUBMITS. Everything the action needs is in `#brief-form`, including hidden inputs
 * for the columns this page shows but does not edit — a save must not silently blank a field it
 * never offered. The rail's "advance" button sits outside that form in the right column and reaches
 * it with the HTML `form` attribute, carrying the next status as its own `name`/`value` pair; the
 * plain Save submits no status at all, which the action reads as "leave it where it is". Neither
 * button names a status literal: the next step comes from the state machine's transition table.
 *
 * DEMO MODE disables every write — Save, the status advance, the three QA ticks and "Re-run AI
 * check" — through `DisabledWrite` + `disabledWriteClassName`, each with the reason on hover. The
 * Version dropdown is the deliberate exception, exactly as the Concepts pairing is: moving it
 * changes nothing but the string in the browser, and watching the formula work is the one thing the
 * demo deployment exists to show.
 */
export function BriefDetail({ brief, concept, track, internal, client, demo }: BriefDetailProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<BriefActionResult | null, FormData>(
    updateBriefAction,
    null,
  );
  const [spellState, spellAction, spellPending] = useActionState<
    SpellCheckActionResult | null,
    FormData
  >(runSpellCheckAction, null);
  const [version, setVersion] = useState(String(brief.version));
  const [sourceValue, setSourceValue] = useState<string>(brief.source);
  const [dupState, dupAction, dupPending] = useActionState<BriefActionResult | null, FormData>(
    duplicateBriefAction,
    null,
  );

  useEffect(() => {
    if (state !== null && state.ok) {
      router.refresh();
    }
  }, [state, router]);

  useEffect(() => {
    if (dupState !== null && dupState.ok) {
      router.push(briefPath(dupState.id));
    }
  }, [dupState, router]);

  /**
   * The §7 product suffix, read back out of the stored name — the only place it lives, because it
   * is part of the name rather than a column. Without it a save of a standalone brief would drop
   * the suffix the next time the name was rebuilt.
   */
  const product = useMemo(
    () => (concept === null ? productSuffixOf(brief.name, brief.version) : null),
    [concept, brief.name, brief.version],
  );

  const name = creativeNameForConcept(concept === null ? null : concept, {
    source: sourceValue,
    funnel: brief.funnel,
    format: brief.type,
    number: brief.sequence,
    version: Number(version),
    batch: brief.batch,
    product,
  });

  const priority = priorityView(brief.priority);
  const dimensions = briefDimensions(brief.dimensions, brief.type);
  const next = nextInternalStatus(track, internal);

  const fieldError = (field: BriefFieldName): string | undefined =>
    state !== null && !state.ok ? state.fieldErrors?.[field] : undefined;

  /** One read-only fact of the left column: a label above, the stored value or the em dash below. */
  const fact = (heading: string, value: string | null, slot: string) => (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] tracking-wide text-text3 uppercase">{heading}</span>
      <span
        data-slot={slot}
        className={value === null ? 'text-sm text-text4' : 'text-sm break-words text-text2'}
      >
        {value ?? EM_DASH}
      </span>
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href={briefsPath}
          data-slot="brief-back"
          className="self-start rounded-input text-xs text-text3 underline-offset-2 hover:text-text2 hover:underline"
        >
          ← All creative briefs
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <BriefName name={name} />
          <form action={dupAction} className="shrink-0">
            <input type="hidden" name="id" value={brief.id} />
            <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={demo || dupPending}
                data-slot="brief-duplicate"
                className={disabledWriteClassName}
              >
                {dupPending ? 'Duplicating…' : 'Duplicate'}
              </Button>
            </DisabledWrite>
          </form>
        </div>
      </div>

      <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] xl:grid-cols-[minmax(0,30fr)_minmax(0,45fr)_minmax(0,25fr)]">
        <form id={FORM_ID} action={formAction} className="contents">
          <input type="hidden" name="id" value={brief.id} />
          <input type="hidden" name="conceptId" value={brief.conceptId ?? ''} />
          <input type="hidden" name="funnel" value={brief.funnel} />
          <input type="hidden" name="type" value={brief.type} />
          <input type="hidden" name="batch" value={brief.batch ?? ''} />
          <input type="hidden" name="product" value={product ?? ''} />
          <input type="hidden" name="priority" value={brief.priority ?? ''} />
          <input type="hidden" name="assignee" value={brief.assignee ?? ''} />
          {brief.inspoLinks.map((url, index) => (
            <input key={`link-${String(index)}`} type="hidden" name="inspoLinks" value={url} />
          ))}
          {dimensions.map((entry) => (
            <input key={entry.key} type="hidden" name="dimensions" value={entry.key} />
          ))}
          <input type="hidden" name="angleId" value={brief.angleId ?? ''} />
          <input type="hidden" name="productId" value={brief.productId ?? ''} />
          <input type="hidden" name="offer" value={brief.offer ?? ''} />
          <input type="hidden" name="language" value={brief.language ?? ''} />
          <input type="hidden" name="spellingFeedback2" value={brief.spellingFeedback2 ?? ''} />

          <section data-slot="brief-left" className="flex min-w-0 flex-col gap-5">
            {concept === null ? (
              <div className="flex flex-col gap-2" data-slot="brief-concept-standalone">
                <span className="text-[11px] tracking-wide text-text3 uppercase">
                  {BRIEF_HEADINGS.concept}
                </span>
                <StatusChip tone="mute" label={STANDALONE_CONCEPT_SLUG} className="self-start" />
                <p className="text-xs leading-relaxed text-text3">{STANDALONE_NOTE}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <span className="text-[11px] tracking-wide text-text3 uppercase">
                  {BRIEF_HEADINGS.concept}
                </span>
                <Link
                  href={concept.href}
                  data-slot="brief-concept"
                  data-concept-id={concept.id}
                  className="flex min-w-0 flex-col gap-1.5 rounded-card border border-line bg-surface2 px-3 py-2.5 transition-colors hover:border-accent-line hover:bg-surface3"
                >
                  <span className="font-mono text-xs break-words text-text">{concept.name}</span>
                  <span className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-text3">
                    {concept.batch === null ? null : <span>{concept.batch}</span>}
                    {concept.angleName === null ? null : <span>· {concept.angleName}</span>}
                    {concept.productName === null ? null : <span>· {concept.productName}</span>}
                  </span>
                </Link>
              </div>
            )}

            {fact(BRIEF_HEADINGS.assignee, brief.assignee, 'brief-assignee')}
            {fact(BRIEF_HEADINGS.type, creativeTypeLabel(brief.type), 'brief-type')}

            <div className="flex min-w-0 flex-col gap-1.5">
              <Label
                htmlFor="brief-field-source"
                className="text-[11px] tracking-wide text-text3 uppercase"
              >
                Source
              </Label>
              <Select value={sourceValue} onValueChange={setSourceValue} disabled={demo}>
                <SelectTrigger
                  id="brief-field-source"
                  className="w-full"
                  aria-label="Source"
                  data-slot="brief-source"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREATIVE_SOURCES.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="source" value={sourceValue} />
              {fieldError('source') === undefined ? null : (
                <p className="text-xs text-bad">{fieldError('source')}</p>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              <Label
                htmlFor="brief-field-version"
                className="text-[11px] tracking-wide text-text3 uppercase"
              >
                {BRIEF_HEADINGS.version}
              </Label>
              <Select value={version} onValueChange={setVersion}>
                <SelectTrigger
                  id="brief-field-version"
                  className="w-full"
                  aria-label={BRIEF_HEADINGS.version}
                  data-slot="brief-version"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VERSION_OPTIONS.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="version" value={version} />
              {fieldError('version') === undefined ? null : (
                <p className="text-xs text-bad">{fieldError('version')}</p>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] tracking-wide text-text3 uppercase">
                {BRIEF_HEADINGS.priority}
              </span>
              {priority === null ? (
                <span className="text-sm text-text4">{EM_DASH}</span>
              ) : (
                <span className="flex flex-wrap items-center gap-2" data-slot="brief-priority">
                  <StatusChip tone={priority.tone} label={priority.label} />
                  {priority.sla === null ? null : (
                    <span className="font-mono text-[11px] text-text3">{priority.sla}</span>
                  )}
                </span>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] tracking-wide text-text3 uppercase">
                {BRIEF_HEADINGS.dimensions}
              </span>
              <DimensionsGrid entries={dimensions} />
            </div>

            {fact(BRIEF_HEADINGS.language, brief.language, 'brief-language')}
            {fact(BRIEF_HEADINGS.offer, brief.offer, 'brief-offer')}
            {fact(
              BRIEF_HEADINGS.inspirationImage,
              brief.inspirationImage === null || brief.inspirationImage.length === 0
                ? null
                : `${String(brief.inspirationImage.length)} attachment(s)`,
              'brief-inspiration-image',
            )}
            {fact(
              BRIEF_HEADINGS.qaChecklistDoc,
              brief.qaChecklistDoc === null || brief.qaChecklistDoc.length === 0
                ? null
                : `${String(brief.qaChecklistDoc.length)} attachment(s)`,
              'brief-qa-checklist-doc',
            )}
            {fact(
              BRIEF_HEADINGS.designFile,
              brief.designFile === null || brief.designFile.length === 0
                ? null
                : `${String(brief.designFile.length)} attachment(s)`,
              'brief-design-file',
            )}
            {fact(
              BRIEF_HEADINGS.scriptAndBriefBreakdown,
              brief.scriptAndBriefBreakdown === null || brief.scriptAndBriefBreakdown.length === 0
                ? null
                : `${String(brief.scriptAndBriefBreakdown.length)} attachment(s)`,
              'brief-script-and-brief-breakdown',
            )}
          </section>

          <section data-slot="brief-centre" className="flex min-w-0 flex-col gap-5">
            {BRIEF_PROSE_FIELDS.map((field) => (
              <div key={field.name} className="flex min-w-0 flex-col gap-1.5">
                <Label
                  htmlFor={`brief-field-${field.name}`}
                  className="text-[11px] tracking-wide text-text3 uppercase"
                >
                  {field.label}
                </Label>
                <p className="text-xs text-text3">{field.hint}</p>
                <Textarea
                  id={`brief-field-${field.name}`}
                  name={field.name}
                  readOnly={demo}
                  placeholder={EM_DASH}
                  defaultValue={brief[field.name] ?? ''}
                  data-slot={`brief-${field.name}`}
                  className="min-h-32 leading-relaxed"
                />
                {fieldError(field.name) === undefined ? null : (
                  <p className="text-xs text-bad">{fieldError(field.name)}</p>
                )}
              </div>
            ))}

            <div className="flex min-w-0 flex-col gap-2" data-slot="brief-inspiration">
              <span className="text-[11px] tracking-wide text-text3 uppercase">
                {BRIEF_HEADINGS.inspiration}
              </span>
              <InspirationList urls={brief.inspoLinks} />
            </div>

            <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
              {demo ? (
                <p className="mr-auto text-xs text-text3" data-slot="brief-demo-note">
                  {DEMO_FOOTER_NOTICE}
                </p>
              ) : state !== null && !state.ok ? (
                <p className="mr-auto text-xs text-bad">{state.error}</p>
              ) : null}
              <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
                <Button
                  type="submit"
                  size="sm"
                  disabled={demo || pending}
                  data-slot="brief-save"
                  className={disabledWriteClassName}
                >
                  {pending ? 'Saving…' : 'Save brief'}
                </Button>
              </DisabledWrite>
            </footer>
          </section>
        </form>

        <aside
          data-slot="brief-right"
          className="flex min-w-0 flex-col gap-3 md:col-span-2 xl:col-span-1"
        >
          <h2 className="text-sm font-medium text-text2">{BRIEF_HEADINGS.approval}</h2>
          <div data-slot="brief-rail">
            <TwoTrackApproval
              track={track}
              internal={internal}
              client={client}
              clientOnly={false}
            />
          </div>

          {next === null ? null : (
            <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
              <Button
                type="submit"
                form={FORM_ID}
                name="internalStatus"
                value={next.key}
                size="sm"
                variant="secondary"
                disabled={demo || pending}
                data-slot="brief-advance"
                className={disabledWriteClassName}
              >
                {advanceLabel(next)}
              </Button>
            </DisabledWrite>
          )}

          <QaChecklist
            briefId={brief.id}
            checks={{
              qaVideoEditor: brief.qaVideoEditor,
              qaDesigner: brief.qaDesigner,
              qaStrategist: brief.qaStrategist,
            }}
            demo={demo}
          />

          <section
            data-slot="brief-spelling"
            className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4"
          >
            <h3 className="text-[11px] font-medium tracking-wide text-text3 uppercase">
              {BRIEF_HEADINGS.spelling}
            </h3>
            {spellState?.ok && spellState.feedback ? (
              <p
                data-slot="brief-spelling-text"
                className="text-xs leading-relaxed break-words text-text2"
              >
                {spellState.feedback}
              </p>
            ) : brief.spellingFeedback === null ? (
              <p data-slot="brief-spelling-empty" className="text-xs text-text4">
                {NO_SPELLING_NOTE}
              </p>
            ) : (
              <p
                data-slot="brief-spelling-text"
                className="text-xs leading-relaxed break-words text-text2"
              >
                {brief.spellingFeedback}
              </p>
            )}
            {brief.spellingFeedback2 === null ? null : (
              <p
                data-slot="brief-spelling-text-2"
                className="text-xs leading-relaxed break-words text-text2"
              >
                {brief.spellingFeedback2}
              </p>
            )}
            {spellState !== null && !spellState.ok ? (
              <p className="text-xs text-bad">{spellState.error}</p>
            ) : null}
            <form action={spellAction}>
              <input type="hidden" name="id" value={brief.id} />
              <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={demo || spellPending}
                  data-slot="brief-spelling-rerun"
                  className={disabledWriteClassName}
                >
                  {spellPending ? 'Checking…' : 'Run AI spell check'}
                </Button>
              </DisabledWrite>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
