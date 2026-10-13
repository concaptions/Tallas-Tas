'use client';

import type { ReactNode } from 'react';
import {
  BRIEF_QA_CHECK_LABELS,
  BRIEF_QA_CHECKS,
  chipTone,
  CLIENT_STATUS,
  CLIENT_TRACK_STEPS,
  EDITOR_STAGES,
  INTERNAL_STATUS,
  isClientTrackOpen,
  qaGateReason,
  QA_RESET,
  requiredQaChecks,
  type ChipTone,
  type StatusEntry,
} from '@tas/domain/state';
import { CREATIVE_TYPES, creativeTrack } from '@tas/domain/creatives';
import {
  CLIENT_TRACK_LOCKED_NOTE,
  StatusChip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tas/ui';
import { LockOpen } from '@tas/ui/icons';

/**
 * Board 6, "Status vocabulary — the only legal keys", drawn LIVE from `@tas/domain/state`
 * (B6.V17). No status string is typed here: every row is an entry of `INTERNAL_STATUS` or
 * `CLIENT_STATUS`, every tone is `chipTone(entry.label)`, the gate row is the one
 * `isClientTrackOpen` accepts, and the QA matrix is `requiredQaChecks` over `CREATIVE_TYPES`. The
 * board predates the Oct 12 consolidation (Ticket 5, migration 0067), which retired its two
 * per-track internal ladders; this page shows the one list that replaced them and nothing that
 * was retired, so nobody copies a key from a drawing (`docs/sprint-oct12-ui-gap.md`, board 6).
 */

/** Board 6's six rules in its order; the labels that resolve to each are computed, never listed. */
const TONE_ORDER: readonly ChipTone[] = ['ok', 'accent', 'bad', 'warn', 'info', 'mute'];

/** Token classes per tone, for the swatch and the tone word (the chip itself is `StatusChip`). */
const SWATCH_CLASS: Readonly<Record<ChipTone, string>> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  bad: 'bg-bad',
  info: 'bg-info',
  accent: 'bg-accent',
  mute: 'bg-text3',
};

const INK_CLASS: Readonly<Record<ChipTone, string>> = {
  ok: 'text-ok',
  warn: 'text-warn',
  bad: 'text-bad',
  info: 'text-info',
  accent: 'text-accent',
  mute: 'text-text3',
};

function TrackCard({
  title,
  source,
  children,
}: {
  readonly title: string;
  readonly source: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
      <div className="border-b border-line bg-surface2 px-3 py-2.5">
        <span className="text-xs font-semibold text-text2">{title}</span>
        <span className="mt-0.5 block font-mono text-[9.5px] text-text4">{source}</span>
      </div>
      <div className="flex flex-col py-1.5" data-slot="status-vocabulary-rows">
        {children}
      </div>
    </div>
  );
}

/** One vocabulary row: the step number, the chip in its tone, the stored key. */
function VocabularyRow({
  index,
  entry,
  gate = false,
}: {
  readonly index: string;
  readonly entry: StatusEntry;
  readonly gate?: boolean;
}) {
  return (
    <div
      data-slot="status-vocabulary-row"
      data-key={entry.key}
      data-gate={gate ? 'true' : undefined}
      className={`flex items-center gap-2 px-3 py-1 ${gate ? 'bg-ok/8' : ''}`}
      title={entry.description}
    >
      <span className="w-3 shrink-0 text-right font-mono text-[9.5px] text-text4">{index}</span>
      <StatusChip tone={chipTone(entry.label)} label={entry.label} />
      <span className="ml-auto truncate font-mono text-[10px] text-text3">{entry.key}</span>
    </div>
  );
}

/** The client rows in `CLIENT_STATUS` order, the branches gathered into one dashed block. */
function clientRows(): ReactNode[] {
  const stepNumber = (key: string): string => {
    const at = CLIENT_TRACK_STEPS.findIndex((step) => step.key === key);
    return at === -1 ? '—' : String(at + 1);
  };
  const branches = CLIENT_STATUS.filter((entry) => stepNumber(entry.key) === '—');
  const nodes: ReactNode[] = [];
  let branchesDrawn = false;
  for (const entry of CLIENT_STATUS) {
    const index = stepNumber(entry.key);
    if (index !== '—') {
      nodes.push(<VocabularyRow key={entry.key} index={index} entry={entry} />);
      continue;
    }
    if (branchesDrawn) continue;
    branchesDrawn = true;
    nodes.push(
      <div
        key="branches"
        data-slot="status-vocabulary-branches"
        className="mx-2 mt-1 mb-1.5 rounded-input border border-dashed border-line2 bg-surface2 px-1 py-1"
      >
        {branches.map((branch) => (
          <VocabularyRow key={branch.key} index="—" entry={branch} />
        ))}
        <p className="px-3 pt-1 pb-0.5 text-[10px] leading-relaxed text-text4">
          Branches off the client decision; named by the header chip, never a step.
        </p>
      </div>,
    );
  }
  return nodes;
}

/**
 * The two tracks as numbered ladders in flow order, the stored key beside every chip, the gate
 * row washed in `--ok`, the client branches set apart and the locked note the client bar shows.
 */
export function StatusVocabularyStory() {
  return (
    <div className="grid gap-3 md:grid-cols-2" data-slot="status-vocabulary">
      <TrackCard title="Internal — both tracks" source="INTERNAL_STATUS">
        {INTERNAL_STATUS.map((entry, index) => (
          <VocabularyRow
            key={entry.key}
            index={String(index + 1)}
            entry={entry}
            gate={isClientTrackOpen(entry.key)}
          />
        ))}
        <p className="px-3 pt-2 pb-1 text-[10px] leading-relaxed text-text4">
          One list for the video and static tracks since the Oct 12 consolidation (migration 0067),
          which retired the per-track keys. The track decides who builds the creative and which QA
          ticks it needs, never its status words.{' '}
          <span className="font-mono">{EDITOR_STAGES.map((stage) => stage.key).join(' / ')}</span>{' '}
          are editor-stage keys, not statuses.
        </p>
      </TrackCard>
      <TrackCard title="Client" source="CLIENT_STATUS">
        {clientRows()}
        <p className="mx-2 mt-1 flex items-center gap-2 rounded-input border border-dashed border-ok/40 bg-surface2 px-3 py-2 text-[10px] leading-relaxed text-text3">
          <LockOpen aria-hidden="true" className="size-3.5 shrink-0 text-ok" />
          {CLIENT_TRACK_LOCKED_NOTE}
        </p>
      </TrackCard>
    </div>
  );
}

/** Board 6's `chipTone` table, computed: every live label grouped by the tone it resolves to. */
export function ChipToneMapStory() {
  const labels = [...new Set([...INTERNAL_STATUS, ...CLIENT_STATUS].map((entry) => entry.label))];
  const rows = TONE_ORDER.map((tone) => ({
    tone,
    labels: labels.filter((label) => chipTone(label) === tone),
  })).filter((row) => row.labels.length > 0);
  return (
    <div
      className="flex max-w-md flex-col overflow-hidden rounded-card border border-line bg-surface"
      data-slot="chip-tone-map"
    >
      <div className="border-b border-line bg-surface2 px-3 py-2.5">
        <span className="text-xs font-semibold text-text2">chipTone — keyed on the label</span>
        <span className="mt-0.5 block font-mono text-[9.5px] text-text4">
          chipTone(label) from @tas/domain/state
        </span>
      </div>
      <div className="flex flex-col py-1.5">
        {rows.map(({ tone, labels: toneLabels }) => (
          <div
            key={tone}
            data-slot="chip-tone-row"
            data-tone={tone}
            className="flex items-center gap-2.5 px-3 py-1.5"
          >
            <span
              aria-hidden="true"
              className={`size-2 shrink-0 rounded-full ${SWATCH_CLASS[tone]}`}
            />
            <span className="font-mono text-[10.5px] text-text2">{toneLabels.join(' · ')}</span>
            <span
              className={`ml-auto font-mono text-[9.5px] tracking-[.07em] uppercase ${INK_CLASS[tone]}`}
            >
              {tone}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Board 4 §3, live: which QA ticks each creative type requires, from `creativeTrack` and
 * `requiredQaChecks`, with the sentence an untouched brief's gate would show. The board's third
 * row ("null · anything else → strategist only") does not occur in the product: an unknown type
 * takes the video track on purpose, the superset gate (B4.A3 / B4.V10).
 */
export function QaGateMatrixStory() {
  return (
    <div className="rounded-card border border-line bg-surface" data-slot="qa-gate-matrix">
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead className="text-[10px] font-semibold tracking-widest text-text4 uppercase">
              Brief type
            </TableHead>
            <TableHead className="text-[10px] font-semibold tracking-widest text-text4 uppercase">
              Track
            </TableHead>
            {BRIEF_QA_CHECKS.map((check) => (
              <TableHead
                key={check}
                className="font-mono text-[10px] font-semibold tracking-wide text-text4"
              >
                {check}
              </TableHead>
            ))}
            <TableHead className="text-[10px] font-semibold tracking-widest text-text4 uppercase">
              Gate sentence before any tick
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {CREATIVE_TYPES.map((type) => {
            const track = creativeTrack(type.key);
            const required = requiredQaChecks(track);
            return (
              <TableRow key={type.key} data-slot="qa-gate-matrix-row" data-track={track}>
                <TableCell className="font-mono text-text">{type.key}</TableCell>
                <TableCell className="font-mono text-text3">{track}</TableCell>
                {BRIEF_QA_CHECKS.map((check) => (
                  <TableCell key={check} className="font-mono">
                    {required.includes(check) ? (
                      <StatusChip tone="accent" label="required" />
                    ) : (
                      <span className="text-text4">—</span>
                    )}
                  </TableCell>
                ))}
                <TableCell className="font-mono text-[11px] whitespace-normal text-text3">
                  {qaGateReason(track, QA_RESET)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="border-t border-line px-3 py-2 text-[10px] text-text4">
        The ticks in checklist order: {Object.values(BRIEF_QA_CHECK_LABELS).join(' · ')}. Focus Mode
        shows only the required ones; the brief page and the sidebar show all three with the other
        track’s tick struck through.
      </p>
    </div>
  );
}
