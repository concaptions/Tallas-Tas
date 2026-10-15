'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { applyDimensionChange, dimensionsFor, type DimensionChange } from '@tas/domain/creatives';
import {
  canSubmitToClient,
  editorStageLabel,
  editorStageOf,
  editorStageTone,
  internalMoveNeedsQa,
  qaGateReason,
} from '@tas/domain/state';
import type {
  ChipTone,
  ClientStatusKey,
  CreativeTrack,
  InternalStatusKey,
} from '@tas/domain/state';
import {
  Button,
  ClientStatusBadge,
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
  Input,
} from '@tas/ui';
import { CLIENT_STATUS, chipTone } from '@tas/domain/state';

import { ClientStatusDropdown } from '@/components/status/client-status-dropdown';
import { BriefScriptsTable, type BriefScriptRow } from '@/components/briefs/scripts-table';

import type { BriefActivityItem } from '@/lib/briefs-source';
import { copywritingPath, creativeSheetPath } from '@/lib/routes';

import {
  changeBriefDimensionAction,
  updateBriefAction,
  type BriefActionResult,
  type BriefFieldName,
} from '../actions';
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
  briefDimensionKeys,
  briefDimensions,
  clientSaveRefusal,
  creativeTypeLabel,
  nextInternalStatus,
  performanceView,
  priorityView,
  productSuffixOf,
  unlistedPerformance,
  type BriefLinkedRecord,
  type BriefLinkedRecords,
} from '../fields';
import { BriefActivity } from './brief-activity';
import { BriefName } from './brief-name';
import { DimensionsGrid } from './dimensions-grid';
import { BriefDimensionsPicker, type DimensionsSaveState } from './dimensions-picker';
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
  /** `creative_briefs.name`, shown VERBATIM — never recomputed on display (migration 0060). */
  readonly name: string;
  /** Who owns the name: `auto` follows its concept's renames, `manual` is never rewritten. */
  readonly nameMode: 'auto' | 'manual';
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
  /** `YYYY-MM-DD` or empty, as the date input wants it (EDIT-02). */
  readonly dueDate: string;
  readonly briefToDesign: string | null;
  readonly scriptContent: string | null;
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
  /**
   * The short reason the strategist typed on the last `revisions_needed` move (Oct 5 Talal
   * sync). Null everywhere else: the dropdown opens with it as its default context.
   */
  readonly clientStatusNote: string | null;
}

// Scripts table shape and the `countWords` helper are shared with the brief sidebar
// (`creative-sheet-panel.tsx`): `BriefScriptRow` lives in `@/components/briefs/scripts-table`
// and the helper in `@tas/domain/briefs/word-count`. Oct 12 QA item 33 shipped them inline on
// this page; the Oct 15 SCRIPTS_SIDEBAR follow-up lifted both so the sidebar can draw the same
// table under its Content section.

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
  /**
   * Every persona of the angle the facts list names, comma-joined on the server (AI-54); null when
   * there is no angle to follow or it links no persona. A brief has no persona column: the chain is
   * brief → angle → `angle_personas`, resolved by `briefPersonaName` through the domain's own
   * `inheritedFromAngle`.
   */
  readonly personaName: string | null;
  /** The linked asset's name, resolved on the server; null when unlinked. */
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
  /**
   * Which QA checks this brief needs (video editor vs designer), carried on the row by
   * `briefs-source`; the status list is shared by both tracks (Oct 12 client sync, Ticket 5).
   */
  readonly track: CreativeTrack;
  readonly internal: InternalStatusKey;
  readonly client: ClientStatusKey;
  /** The brief's activity log, newest first (EDIT-03). */
  readonly activity?: readonly BriefActivityItem[];
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
 * THE NAME IS NOT A FIELD. `BriefName` renders `creative_briefs.name` VERBATIM. It used to run the
 * §7 formula over the row at render time, which showed an imported or hand-typed (`manual`) brief
 * under a name it never had — the Creative Sheet said `SMOKETEST-DELETE-ME-20261010`, this page
 * said `TAS-TV2-Batch-Standalone-V1` (smoke test, 2026-10-10). The formula runs at CREATE time
 * only (`createBriefAction`), and a concept rename cascades through `renameBrief` to `auto` rows;
 * nothing on the display path builds a name. There is no input holding it, and `updateBriefAction`
 * never overwrites it.
 *
 * THE CONCEPT CARD IS LABELLED. The card still shows the concept's own `Batch-Angle-Theme` name,
 * and under it a definition list names ALL FOUR fields PRD §5.10 says a concept link auto-fills —
 * Batch, Angle, Persona and Product. Angle and Product read the brief's OWN `angle_id` and
 * `product_id` first — the live import writes them straight on the row — and fall back to the pair
 * inherited through the concept, then to the em dash. Persona is not a column on either the brief or
 * the concept: it hangs off the ANGLE, so it is resolved from whichever angle the Angle fact above
 * it names, through `inheritedFromAngle` in `@tas/domain/concepts` (AI-54). The list renders in BOTH
 * branches, because a standalone brief still carries its own batch and may carry its own angle.
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
  personaName,
  assetName,
  copyLinks,
  linked,
  track,
  internal,
  client,
  demo,
  activity = [],
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
  /**
   * Oct 12 ask (QA item 33): the Scripts table shows a live word count under each Script cell,
   * and the only live source is the actual Script textarea the strategist is typing in — the
   * centre prose column's `scriptContent`. React re-renders when state changes, so the Textarea
   * is lifted to controlled state here; the Scripts table reads the same state and renders
   * `countWords(scriptContentValue)` as "N words" (singular tolerated for parity with the ask).
   */
  const [scriptContentValue, setScriptContentValue] = useState(brief.scriptContent ?? '');
  /**
   * The Dimensions picker SAVES ON TICK (smoke test, 2026-10-10: it set React state and nothing
   * reached the server until "Save brief"). Seeded by `briefDimensionKeys` — the stored array
   * normalised, so an imported brief's placement names tick their ratios, or PRD §8's defaults
   * for the type when the row carries nothing. A tick applies the ONE change optimistically with
   * the same domain rule the server merges with, dispatches `changeBriefDimensionAction`, and
   * adopts the array the server wrote (or puts the previous one back on a refusal). The hidden
   * inputs below are rendered from this state, so a later "Save brief" re-posts what was saved.
   */
  const [dimensionKeys, setDimensionKeys] = useState<readonly string[]>(() =>
    briefDimensionKeys(brief.dimensions, brief.type),
  );
  const [dimensionsState, setDimensionsState] = useState<DimensionsSaveState>({ status: 'idle' });
  const toggleDimension = (key: string) => {
    const previous = dimensionKeys;
    const change: DimensionChange = { op: previous.includes(key) ? 'remove' : 'add', key };
    setDimensionKeys(applyDimensionChange(previous, dimensionsFor(brief.type), change));
    setDimensionsState({ status: 'pending' });
    void changeBriefDimensionAction(brief.id, change).then((result) => {
      if (result.ok) {
        setDimensionKeys(result.dimensions);
        setDimensionsState({ status: 'saved' });
        router.refresh();
      } else {
        setDimensionKeys(previous);
        setDimensionsState({ status: 'error', error: result.error });
      }
    });
  };

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
  const dimensions = briefDimensions(dimensionKeys, brief.type);
  const next = nextInternalStatus(internal);
  const stage = editorStageOf(internal);
  /**
   * The QA gate on this page (Oct 12 scope 4), from the row's stored ticks: Advance to Approved
   * opens the client track, and a client resubmission puts the creative back in front of the
   * client; neither may run until every tick the type requires is set. The checklist's own writes
   * land on the row and this page re-reads them on the next render; the Server Actions re-run the
   * gate regardless, so this is the hint, not the boundary.
   */
  const ticks = {
    qaVideoEditor: brief.qaVideoEditor,
    qaDesigner: brief.qaDesigner,
    qaStrategist: brief.qaStrategist,
  };
  const qaReason = canSubmitToClient(track, ticks) ? null : qaGateReason(track, ticks);
  const advanceGated =
    next !== null && qaReason !== null && internalMoveNeedsQa(internal, next.key);
  // Both gates, in order, for the client Save (B4.A22): the dropdown holds Save with the reason.
  const clientRefusalFor = (candidate: string): string | null =>
    clientSaveRefusal({ internal, client, candidate, qaReason });

  // The Scripts table (EDIT-04): the brief's own script, then every Meta Copywriting row written
  // for it — the rows under the details an editor reads before cutting.
  // Oct 12 ask (QA item 33): read the Script row's label from the controlled scriptContentValue
  // state so the word count beneath it stays in step with the centre column's live Textarea.
  const scripts: readonly BriefScriptRow[] = [
    ...(scriptContentValue.trim() === ''
      ? []
      : [
          {
            id: 'script-content',
            label: scriptContentValue,
            kind: 'Script',
            href: null,
          },
        ]),
    ...copyLinks.map((copy) => ({
      id: copy.id,
      label: copy.label,
      kind: 'Copywriting',
      href: `${copywritingPath}?copy=${encodeURIComponent(copy.id)}`,
    })),
  ];

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
          href={creativeSheetPath}
          data-slot="brief-back"
          className="self-start rounded-input text-xs text-text3 underline-offset-2 hover:text-text2 hover:underline"
        >
          ← Creative Sheet
        </Link>
        <BriefName name={brief.name} mode={brief.nameMode} />
        {/* The editor board's stage this brief sits in, colour-coded by stage (Sprint 10); off the
            board once approved. */}
        <span className="flex items-center gap-2" data-slot="brief-stage" data-stage={stage ?? ''}>
          <span className="text-[11px] tracking-wide text-text3 uppercase">
            {BRIEF_HEADINGS.stage}
          </span>
          <StatusChip
            tone={editorStageTone(stage)}
            label={stage === null ? 'Off the editor board' : editorStageLabel(stage)}
          />
        </span>
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
          {dimensionKeys.map((key) => (
            <input key={key} type="hidden" name="dimensions" value={key} />
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
              Batch, Angle, Persona and Product, each under its own label — the four fields PRD
              §5.10 names (AI-54). Batch comes from the concept or, standalone, from the row. Angle
              and Product read the brief's OWN links first (the import writes `angle_id` /
              `product_id` on the row), then the pair inherited through the concept — which follows
              the concept's first angle and that angle's first product, so it can name the wrong one
              of several. Persona follows the same angle and lists EVERY persona linked to it, since
              `angle_personas` is a junction and there is no "first" to prefer. All four show the em
              dash when nothing is set, rather than disappearing.
            */}
            <dl data-slot="brief-concept-facts" className="grid min-w-0 grid-cols-2 gap-3">
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
              {conceptFact(BRIEF_HEADINGS.persona, personaName, 'brief-persona', false)}
              {conceptFact(
                BRIEF_HEADINGS.product,
                productName ?? concept?.productName ?? null,
                'brief-product',
                false,
              )}
            </dl>

            {fact(BRIEF_HEADINGS.assignee, brief.assignee, 'brief-assignee')}
            {fact(BRIEF_HEADINGS.type, creativeTypeLabel(brief.type), 'brief-type')}
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label
                htmlFor="brief-field-dueDate"
                className="text-[11px] tracking-wide text-text3 uppercase"
              >
                {BRIEF_HEADINGS.dueDate}
              </Label>
              <Input
                id="brief-field-dueDate"
                name="dueDate"
                type="date"
                readOnly={demo}
                defaultValue={brief.dueDate}
                data-slot="brief-dueDate"
                className="font-mono"
              />
              {fieldError('dueDate') === undefined ? null : (
                <p className="text-xs text-bad">{fieldError('dueDate')}</p>
              )}
            </div>
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
              {/* The grid shows the current selection; the picker CHANGES it, one saved tick at a time. */}
              <BriefDimensionsPicker
                selected={dimensionKeys}
                disabled={demo}
                saveState={dimensionsState}
                onToggle={toggleDimension}
              />
              {fieldError('dimensions') === undefined ? null : (
                <p className="text-xs text-bad">{fieldError('dimensions')}</p>
              )}
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

            {fact(BRIEF_HEADINGS.asset, assetName, 'brief-asset')}
          </section>

          <section data-slot="brief-centre" className="flex min-w-0 flex-col gap-5">
            {BRIEF_PROSE_FIELDS.map((field) => {
              // Oct 12 ask (QA item 33): scriptContent is lifted to controlled state so the
              // Scripts table's word count re-renders live as the strategist types. Every other
              // prose field stays uncontrolled (defaultValue) — nothing else reads them live.
              const isScript = field.name === 'scriptContent';
              return (
                <div key={field.name} className="flex min-w-0 flex-col gap-1.5">
                  <Label
                    htmlFor={`brief-field-${field.name}`}
                    className="text-[11px] tracking-wide text-text3 uppercase"
                  >
                    {field.label}
                  </Label>
                  <p className="text-xs text-text3">{field.hint}</p>
                  {isScript ? (
                    <Textarea
                      id={`brief-field-${field.name}`}
                      name={field.name}
                      readOnly={demo}
                      placeholder={EM_DASH}
                      value={scriptContentValue}
                      onChange={(event) => {
                        setScriptContentValue(event.target.value);
                      }}
                      data-slot={`brief-${field.name}`}
                      className="min-h-32 leading-relaxed"
                    />
                  ) : (
                    <Textarea
                      id={`brief-field-${field.name}`}
                      name={field.name}
                      readOnly={demo}
                      placeholder={EM_DASH}
                      defaultValue={brief[field.name] ?? ''}
                      data-slot={`brief-${field.name}`}
                      className="min-h-32 leading-relaxed"
                    />
                  )}
                  {fieldError(field.name) === undefined ? null : (
                    <p className="text-xs text-bad">{fieldError(field.name)}</p>
                  )}
                </div>
              );
            })}

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
                  {pending ? 'Saving…' : 'Save creative'}
                </Button>
              </DisabledWrite>
            </footer>
          </section>
          <section
            data-slot="brief-scripts"
            className="flex min-w-0 flex-col gap-2 md:col-span-2 xl:col-span-2"
          >
            <h2 className="text-sm font-medium text-text2">{BRIEF_HEADINGS.scripts}</h2>
            <BriefScriptsTable scripts={scripts} demo={demo} />
          </section>
        </form>

        <aside
          data-slot="brief-right"
          className="flex min-w-0 flex-col gap-3 md:col-span-2 xl:col-span-1"
        >
          <h2 className="text-sm font-medium text-text2">{BRIEF_HEADINGS.approval}</h2>
          <div data-slot="brief-rail">
            <TwoTrackApproval internal={internal} client={client} clientOnly={false} />
          </div>

          {/*
            Oct 5 client-status workflow (Agent 5): the shared badge + dropdown mount in the
            detail view, below the two-track rail. The reason Textarea is gated to
            `revisions_needed` by the shared action; concepts/briefs have no `disapproved` on
            CLIENT_STATUS (PRD §9) so the single branch is enough here.
          */}
          <section
            className="flex flex-col gap-2 border-t border-line pt-3"
            data-slot="brief-client-status"
          >
            <h2 className="text-sm font-medium text-text2">Client status workflow</h2>
            <ClientStatusBadge
              vocabulary={CLIENT_STATUS}
              value={client}
              toneFor={(value) =>
                chipTone(CLIENT_STATUS.find((entry) => entry.key === value)?.label ?? '')
              }
            />
            <ClientStatusDropdown
              tableKey="creative_briefs"
              recordId={brief.id}
              currentStatus={client}
              currentNote={brief.clientStatusNote ?? null}
              disabled={demo}
              refusalFor={clientRefusalFor}
            />
          </section>

          {next === null ? null : (
            <DisabledWrite
              active={demo || advanceGated}
              hint={demo ? DEMO_WRITE_HINT : (qaReason ?? '')}
              popover
            >
              <Button
                type="submit"
                form={FORM_ID}
                name="internalStatus"
                value={next.key}
                size="sm"
                variant="secondary"
                disabled={demo || pending || advanceGated}
                data-slot="brief-advance"
                data-gated={advanceGated ? 'true' : undefined}
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
            track={track}
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

      <BriefActivity items={activity} />
    </div>
  );
}
