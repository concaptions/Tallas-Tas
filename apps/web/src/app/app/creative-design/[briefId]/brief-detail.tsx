'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { creativeNameForConcept } from '@tas/domain/creatives';
import type {
  ChipTone,
  ClientStatusKey,
  CreativeTrack,
  InternalStatusKey,
} from '@tas/domain/state';
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

import { briefsPath, copywritingPath } from '@/lib/routes';

import { updateBriefAction, type BriefActionResult, type BriefFieldName } from '../actions';
import { runSpellCheckAction, type SpellCheckActionResult } from '../spell-check-action';
import {
  BRIEF_HEADINGS,
  BRIEF_LINK_SECTIONS,
  BRIEF_PROSE_FIELDS,
  DEMO_FOOTER_NOTICE,
  EM_DASH,
  NOT_GRADED_LABEL,
  NO_SPELLING_2_NOTE,
  NO_SPELLING_NOTE,
  PERFORMANCE_OPTIONS,
  STANDALONE_CONCEPT_SLUG,
  STANDALONE_NOTE,
  VERSION_OPTIONS,
  advanceLabel,
  briefDimensions,
  creativeTypeLabel,
  nextInternalStatus,
  performanceView,
  priorityView,
  productSuffixOf,
  unlistedPerformance,
  type BriefLinkedRecord,
  type BriefLinkedRecords,
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
  readonly designFileUrl: string | null;
  readonly platform: readonly string[];
  readonly batch: string | null;
  readonly funnel: string;
  readonly type: string;
  readonly sequence: number;
  readonly version: number;
  readonly priority: string | null;
  /** How the ad did once live (PRD §5.10), one of `creativePerformances`; null until it has run. */
  readonly performance: string | null;
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

/** A value no uuid can be, so the Select can offer "Standalone" without an empty item value. */
const STANDALONE_VALUE = 'standalone';

/**
 * A value no Performance grade is, so the Select can offer "Not graded yet" without an empty item
 * value — the same device as `STANDALONE_VALUE`. The hidden input submits `''` for it, which the
 * action stores as NULL.
 */
const NOT_GRADED_VALUE = 'not-graded';

interface BriefDetailProps {
  readonly brief: BriefValues;
  readonly concept: BriefConceptCard | null;
  /** Every concept of the brand, for moving this brief between concepts (TASK 5). */
  readonly conceptOptions: readonly { readonly id: string; readonly name: string }[];
  /**
   * The brief's OWN angle and product — `angle_id` and `product_id`, which the live import writes
   * directly on the row — resolved to names on the server; null when the link is absent or no
   * longer live. They win over the concept-inherited pair in the facts list.
   */
  readonly angleName: string | null;
  readonly productName: string | null;
  /** The linked collection's and asset's names, resolved on the server; null when unlinked. */
  readonly collectionName: string | null;
  readonly assetName: string | null;
  /** The Meta Copywriting rows tied to this brief, precomputed views (TABLE 7 parity). */
  readonly copyLinks: readonly {
    readonly id: string;
    readonly label: string;
    readonly statusLabel: string;
    readonly statusTone: ChipTone;
  }[];
  /**
   * The rows of the four counterpart tables that point at this brief (module parity, phase 2),
   * indexed by the junction on the server and read-only here: the rail lists what cites this
   * creative and links out to it; editing a link belongs to the counterpart's own panel.
   */
  readonly linked: BriefLinkedRecords;
  /** Which internal ladder this brief is graded on, carried on the row by `briefs-source`. */
  readonly track: CreativeTrack;
  readonly internal: InternalStatusKey;
  readonly client: ClientStatusKey;
  readonly demo: boolean;
}

/** The form every write on this page submits to, named so the rail's button can reach it. */
const FORM_ID = 'brief-form';

const LINK_CARD_CLASS =
  'flex min-w-0 flex-col gap-1 rounded-card border border-line bg-surface2 px-3 py-2 transition-colors hover:border-accent-line hover:bg-surface3';

/**
 * One linked record in the rail: its label (`font-mono` when it is a computed name), the quiet
 * detail line, and its chips — each a `StatusChip`, never a local pill. A record with a page of its
 * own is a link to that page opened on its panel; one without renders the same card inert.
 */
function LinkedRecordCard({ record }: { readonly record: BriefLinkedRecord }) {
  const body = (
    <>
      <span
        data-slot="brief-link-label"
        className={
          record.mono ? 'font-mono text-xs break-all text-text' : 'text-xs break-words text-text2'
        }
      >
        {record.label}
      </span>
      {record.detail === null ? null : (
        <span data-slot="brief-link-detail" className="font-mono text-[11px] text-text3">
          {record.detail}
        </span>
      )}
      {record.chips.length === 0 ? null : (
        <span className="flex flex-wrap gap-1.5">
          {/* Two chips can carry one word (an internal and a client "Approved"), so the key is positional. */}
          {record.chips.map((chip, index) => (
            <StatusChip
              key={`${String(index)}-${chip.label}`}
              tone={chip.tone}
              label={chip.label}
            />
          ))}
        </span>
      )}
    </>
  );
  return record.href === null ? (
    <div data-slot="brief-link" data-link-id={record.id} className={LINK_CARD_CLASS}>
      {body}
    </div>
  ) : (
    <Link
      href={record.href}
      data-slot="brief-link"
      data-link-id={record.id}
      className={LINK_CARD_CLASS}
    >
      {body}
    </Link>
  );
}

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
 * THE CONCEPT CARD IS LABELLED. The card still shows the concept's own `Batch-Angle-Theme` name,
 * and under it a definition list names Batch, Angle and Product (PRD §5.10: "Concept (link) →
 * auto-fills Batch, Angle, Persona, Product"). Angle and Product read the brief's OWN `angle_id`
 * and `product_id` first — the live import writes them straight on the row — and fall back to the
 * pair inherited through the concept, then to the em dash. The list renders in BOTH branches,
 * because a standalone brief still carries its own batch and may carry its own angle and product.
 *
 * PERFORMANCE IS THE SECOND SELECT. `creative_briefs.performance` is graded after launch (PRD
 * §5.10) and is null until then, so the dropdown offers the schema's three grades plus "Not graded
 * yet" through the same sentinel device the concept select uses, and shows the chosen grade as a
 * chip beside it. It is saved through the one form like everything else — except a stored grade
 * the three do not name (the column is plain `text`, and the importer writes the Gratsi choice
 * unmapped): that one is offered as an extra item so the trigger is not blank, and while it is
 * still the choice the hidden input is withheld, so the action leaves the grade alone instead of
 * refusing every save of the brief over a field nobody touched.
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
export function BriefDetail({
  brief,
  concept,
  conceptOptions,
  angleName,
  productName,
  collectionName,
  assetName,
  copyLinks,
  linked,
  track,
  internal,
  client,
  demo,
}: BriefDetailProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<BriefActionResult | null, FormData>(
    updateBriefAction,
    null,
  );
  const [spellState, spellAction, spellPending] = useActionState<
    SpellCheckActionResult | null,
    FormData
  >(runSpellCheckAction, null);
  const [conceptChoice, setConceptChoice] = useState(brief.conceptId ?? STANDALONE_VALUE);
  const [version, setVersion] = useState(String(brief.version));
  const [performanceChoice, setPerformanceChoice] = useState(brief.performance ?? NOT_GRADED_VALUE);

  useEffect(() => {
    if (state !== null && state.ok) {
      router.refresh();
    }
  }, [state, router]);

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
    source: brief.source,
    funnel: brief.funnel,
    format: brief.type,
    number: brief.sequence,
    version: Number(version),
    batch: brief.batch,
    product,
  });

  const priority = priorityView(brief.priority);
  const performance = performanceView(
    performanceChoice === NOT_GRADED_VALUE ? null : performanceChoice,
  );
  /**
   * The stored grade when the three do not name it — an unmapped Gratsi choice — and whether it is
   * still what the select shows. While it is, the form carries no `performance` key at all, so the
   * action keeps the grade; the key comes back the moment the user picks a listed one.
   */
  const legacyPerformance = unlistedPerformance(brief.performance);
  const keepsLegacyPerformance =
    legacyPerformance !== null && performanceChoice === legacyPerformance.key;
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

  /**
   * One inherited fact under the concept card, as a `<dt>`/`<dd>` pair: the same label style as
   * `fact`, the value in `font-mono` when it is system output (a batch id) and plain when it is a
   * name a strategist typed (an angle, a product).
   */
  const conceptFact = (heading: string, value: string | null, slot: string, mono: boolean) => (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-[11px] tracking-wide text-text3 uppercase">{heading}</dt>
      <dd
        data-slot={slot}
        className={
          value === null
            ? 'text-sm text-text4'
            : mono
              ? 'font-mono text-xs break-words text-text2'
              : 'text-sm break-words text-text2'
        }
      >
        {value ?? EM_DASH}
      </dd>
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
        <BriefName name={name} />
      </div>

      <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] xl:grid-cols-[minmax(0,30fr)_minmax(0,45fr)_minmax(0,25fr)]">
        <form id={FORM_ID} action={formAction} className="contents">
          <input type="hidden" name="id" value={brief.id} />
          <input
            type="hidden"
            name="conceptId"
            value={conceptChoice === STANDALONE_VALUE ? '' : conceptChoice}
          />
          <input type="hidden" name="funnel" value={brief.funnel} />
          <input type="hidden" name="type" value={brief.type} />
          <input type="hidden" name="batch" value={brief.batch ?? ''} />
          <input type="hidden" name="product" value={product ?? ''} />
          <input type="hidden" name="priority" value={brief.priority ?? ''} />
          {keepsLegacyPerformance ? null : (
            <input
              type="hidden"
              name="performance"
              value={performanceChoice === NOT_GRADED_VALUE ? '' : performanceChoice}
            />
          )}
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
            <div className="flex min-w-0 flex-col gap-2">
              <Label
                htmlFor="brief-field-concept"
                className="text-[11px] tracking-wide text-text3 uppercase"
              >
                {BRIEF_HEADINGS.concept}
              </Label>
              <Select value={conceptChoice} onValueChange={setConceptChoice} disabled={demo}>
                <SelectTrigger
                  id="brief-field-concept"
                  className="w-full"
                  aria-label={BRIEF_HEADINGS.concept}
                  data-slot="brief-concept-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STANDALONE_VALUE}>{STANDALONE_CONCEPT_SLUG}</SelectItem>
                  {conceptOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      <span className="font-mono text-xs">{option.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {concept === null ? (
              <div className="flex flex-col gap-2" data-slot="brief-concept-standalone">
                <StatusChip tone="mute" label={STANDALONE_CONCEPT_SLUG} className="self-start" />
                <p className="text-xs leading-relaxed text-text3">{STANDALONE_NOTE}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
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

            {/*
              Batch, Angle and Product, each under its own label. Batch comes from the concept or,
              standalone, from the row. Angle and Product read the brief's OWN links first (the
              import writes `angle_id` / `product_id` on the row), then the pair inherited through
              the concept — which follows the concept's first angle and that angle's first product,
              so it can name the wrong one of several — and show the em dash when neither is set,
              rather than disappearing.
            */}
            <dl data-slot="brief-concept-facts" className="grid min-w-0 grid-cols-3 gap-3">
              {conceptFact(
                BRIEF_HEADINGS.batch,
                concept?.batch ?? brief.batch,
                'brief-batch',
                true,
              )}
              {conceptFact(
                BRIEF_HEADINGS.angle,
                angleName ?? concept?.angleName ?? null,
                'brief-angle',
                false,
              )}
              {conceptFact(
                BRIEF_HEADINGS.product,
                productName ?? concept?.productName ?? null,
                'brief-product',
                false,
              )}
            </dl>

            {fact(BRIEF_HEADINGS.assignee, brief.assignee, 'brief-assignee')}
            {fact(BRIEF_HEADINGS.type, creativeTypeLabel(brief.type), 'brief-type')}
            {fact(BRIEF_HEADINGS.source, brief.source, 'brief-source')}
            {fact(BRIEF_HEADINGS.funnel, brief.funnel, 'brief-funnel')}

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
              <Label
                htmlFor="brief-field-performance"
                className="text-[11px] tracking-wide text-text3 uppercase"
              >
                {BRIEF_HEADINGS.performance}
              </Label>
              <div className="flex items-center gap-2">
                <Select
                  value={performanceChoice}
                  onValueChange={setPerformanceChoice}
                  disabled={demo}
                >
                  <SelectTrigger
                    id="brief-field-performance"
                    className="w-full"
                    aria-label={BRIEF_HEADINGS.performance}
                    data-slot="brief-performance-select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NOT_GRADED_VALUE}>{NOT_GRADED_LABEL}</SelectItem>
                    {PERFORMANCE_OPTIONS.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label}
                      </SelectItem>
                    ))}
                    {/* The stored grade outside the three, in its own words, so the trigger is never blank. */}
                    {legacyPerformance === null ? null : (
                      <SelectItem
                        value={legacyPerformance.key}
                        data-slot="brief-performance-legacy"
                      >
                        <span className="text-text3">{legacyPerformance.label}</span>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {performance === null ? null : (
                  <span className="flex items-center" data-slot="brief-performance">
                    <StatusChip tone={performance.tone} label={performance.label} />
                  </span>
                )}
              </div>
              {fieldError('performance') === undefined ? null : (
                <p className="text-xs text-bad">{fieldError('performance')}</p>
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

            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] tracking-wide text-text3 uppercase">
                {BRIEF_HEADINGS.designLinkUrl}
              </span>
              {brief.designFileUrl === null ? (
                <span data-slot="brief-design-link" className="text-sm text-text4">
                  {EM_DASH}
                </span>
              ) : (
                <a
                  href={brief.designFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  data-slot="brief-design-link"
                  className="text-sm break-all text-accent underline-offset-2 hover:underline"
                >
                  {brief.designFileUrl}
                </a>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] tracking-wide text-text3 uppercase">
                {BRIEF_HEADINGS.platform}
              </span>
              <span className="flex flex-wrap gap-1.5" data-slot="brief-platform">
                {brief.platform.length === 0 ? (
                  <span className="text-sm text-text4">{EM_DASH}</span>
                ) : (
                  brief.platform.map((platform) => (
                    <StatusChip key={platform} tone="mute" label={platform} />
                  ))
                )}
              </span>
            </div>

            {fact(BRIEF_HEADINGS.collection, collectionName, 'brief-collection')}
            {fact(BRIEF_HEADINGS.asset, assetName, 'brief-asset')}
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

          {/*
            The second spelling pass (`creative_briefs.spelling_feedback_2`), under its own heading
            so it is never read as a continuation of the first. Read-only like its sibling, and the
            heading stays when the column is empty, with the empty state saying so.
          */}
          <section
            data-slot="brief-spelling-2"
            className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4"
          >
            <h3 className="text-[11px] font-medium tracking-wide text-text3 uppercase">
              {BRIEF_HEADINGS.spellingFeedback2}
            </h3>
            {brief.spellingFeedback2 === null ? (
              <p data-slot="brief-spelling-2-empty" className="text-xs text-text4">
                {NO_SPELLING_2_NOTE}
              </p>
            ) : (
              <p
                data-slot="brief-spelling-text-2"
                className="text-xs leading-relaxed break-words text-text2"
              >
                {brief.spellingFeedback2}
              </p>
            )}
          </section>

          {/*
            What points AT this brief (module parity, phase 2): the sheet row that names it, the
            modules that group it, the asset folders that feed it, the reports filed on it. Four
            sections from one table, each with its own data-slot and its own empty sentence, so
            "nothing links here" is said rather than left as a blank card.
          */}
          {BRIEF_LINK_SECTIONS.map((section) => {
            const records = linked[section.kind];
            return (
              <section
                key={section.kind}
                data-slot={section.slot}
                className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4"
              >
                <h3 className="text-[11px] font-medium tracking-wide text-text3 uppercase">
                  {section.heading}
                </h3>
                {records.length === 0 ? (
                  <p
                    data-slot={`${section.slot}-empty`}
                    className="text-xs leading-relaxed text-text3"
                  >
                    {section.empty}
                  </p>
                ) : (
                  <ol data-slot={`${section.slot}-list`} className="flex flex-col gap-1.5">
                    {records.map((record) => (
                      <li key={record.id}>
                        <LinkedRecordCard record={record} />
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            );
          })}
        </aside>
      </div>

      {/*
        The brief's history (P2B-4). Nothing records edits yet — there is no audit/activity table in
        `packages/db/src/schema` — so this ships as the real container with its empty state rather
        than a placeholder that would have to be thrown away: when the audit trail lands it appends
        `<li>` rows into this same scrollable list and the empty state simply stops rendering.
      */}
      <section className="flex flex-col gap-2" data-slot="brief-copywriting">
        <h2 className="text-sm font-medium text-text2">{BRIEF_HEADINGS.metaCopywriting}</h2>
        {copyLinks.length === 0 ? (
          <p className="text-xs leading-relaxed text-text3" data-slot="brief-copywriting-empty">
            No copywriting is tied to this creative yet.
          </p>
        ) : (
          <ol className="flex flex-col gap-1.5" data-slot="brief-copywriting-list">
            {copyLinks.map((copy) => (
              <li key={copy.id}>
                <Link
                  href={`${copywritingPath}?copy=${copy.id}`}
                  data-slot="brief-copy-link"
                  data-copy-id={copy.id}
                  className="flex min-w-0 flex-col gap-1 rounded-card border border-line bg-surface2 px-3 py-2 transition-colors hover:border-accent-line hover:bg-surface3"
                >
                  <span className="text-xs break-words text-text2">{copy.label}</span>
                  <StatusChip
                    tone={copy.statusTone}
                    label={copy.statusLabel}
                    className="self-start"
                  />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section
        data-slot="brief-activity"
        aria-labelledby="brief-activity-heading"
        className="flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface p-4"
      >
        <h2 id="brief-activity-heading" className="text-sm font-medium text-text2">
          Activity
        </h2>
        <ol
          data-slot="brief-activity-list"
          className="flex max-h-64 flex-col gap-2 overflow-y-auto"
        >
          <li
            data-slot="brief-activity-empty"
            className="flex flex-col items-center gap-1 py-8 text-center"
          >
            <span aria-hidden className="text-2xl">
              🕓
            </span>
            <p className="text-sm text-text2">Activity tracking coming soon</p>
            <p className="text-xs text-text3">
              Edits, status changes and comments will appear here once the audit trail ships.
            </p>
          </li>
        </ol>
      </section>
    </div>
  );
}
