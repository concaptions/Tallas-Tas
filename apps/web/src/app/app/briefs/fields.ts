import {
  CREATIVE_NAME_SEPARATOR,
  CREATIVE_VERSIONS,
  STANDALONE_CONCEPT_SLUG,
  creativeDimensionEntry,
  creativeTypeLabel,
  creativeVersionLabel,
  dimensionsFor,
  priorityTone,
  prioritySlaLabel,
  creativePriorityLabel,
  type CreativeDimensionEntry,
} from '@tas/domain/creatives';
import type { InspoLinkKind } from '@tas/domain/angles';
import {
  chipTone,
  internalStatusFor,
  internalTransitionsFor,
  type ChipTone,
  type CreativeTrack,
  type InternalStatusKey,
} from '@tas/domain/state';

import type { BriefFieldName, BriefQaCheck } from './actions';

/**
 * How the Creative Briefs route presents what it stores (PRD §5.10). One module, so the list, the
 * detail page and the `/design-system` preview cannot drift: the column order, the labels, the em
 * dash, the QA checklist's three labels and the status-to-chip mapping are each stated exactly once.
 *
 * Nothing here invents a vocabulary. Type, Priority, Version and the delivery ratios come from
 * `@tas/domain/creatives`, every status label and chip tone from `@tas/domain/state`, and the
 * inspiration providers from `@tas/domain/angles`. No component writes `'Motion Image'`,
 * `'Static High'`, `'9:16'` or `'approved'`.
 *
 * `@tas/db` is deliberately absent: the workspace and the detail form are client components, and a
 * runtime import of that package would drag the database driver into the browser bundle. Everything
 * a client needs is handed down from `page.tsx` as plain data.
 */
export type { BriefFieldName, BriefQaCheck };
export { STANDALONE_CONCEPT_SLUG };

/** The dash an empty field shows, so a blank cell is never just a gap. */
export const EM_DASH = '—';

/** What the demo footer says instead of offering a save. */
export const DEMO_FOOTER_NOTICE = 'Demo mode — changes are not saved';

/**
 * The quiet line under the generated name. A creative name is built by the §7 formula from the
 * fields below it (CLAUDE.md non-negotiable 4), so the page has to say so rather than leave a
 * reader hunting for an input that was deliberately never built.
 */
export const NAME_GENERATED_NOTE =
  'Generated from the funnel, type, number, batch, concept and version below. This name is never typed.';

/** The copy button's two states. It confirms in place rather than opening a toast (criterion 4). */
export const COPY_LABEL = 'Copy';
export const COPIED_LABEL = 'Copied';

/** The one sentence the left column shows in place of a concept card (PRD §8). */
export const STANDALONE_NOTE =
  'No parent concept. A static can be briefed on its own, so this one carries its own batch and product.';

/** The URL parameter the search lives in, the same `?q=` every other list page uses. */
export const SEARCH_PARAM = 'q';

/** The list's six columns, in the one order the ticket fixes. */
export const BRIEF_COLUMNS = [
  'Name',
  'Concept',
  'Type',
  'Priority',
  'Assignee',
  'Internal Status',
] as const;

/** One status, ready to render: the stored key, its label and the chip tone it carries. */
export interface BriefStatusView {
  readonly key: InternalStatusKey;
  readonly label: string;
  readonly tone: ChipTone;
}

/**
 * The view of one stored internal status on its own track. Total on purpose: a key this build's
 * track does not list renders its own value in the muted tone rather than an empty cell.
 */
export function internalStatusView(track: CreativeTrack, key: InternalStatusKey): BriefStatusView {
  const entry = internalStatusFor(track).find((step) => step.key === key);
  return entry === undefined
    ? { key, label: key, tone: 'mute' }
    : { key: entry.key, label: entry.label, tone: chipTone(entry.label) };
}

/** A priority as its chip: the label, the tone the clock earns it, and the SLA it promises. */
export interface BriefPriorityView {
  readonly label: string;
  readonly tone: ChipTone;
  /** `12h`, or `null` for a brief nobody has prioritised yet. */
  readonly sla: string | null;
}

export function priorityView(priority: string | null): BriefPriorityView | null {
  if (priority === null) {
    return null;
  }
  return {
    label: creativePriorityLabel(priority),
    tone: priorityTone(priority),
    sla: prioritySlaLabel(priority),
  };
}

/**
 * One brief as the list renders it: everything the table shows, and nothing else. Built on the
 * server so the client component never imports `@tas/db` and never resolves a status itself.
 */
export interface BriefItem {
  readonly id: string;
  readonly name: string;
  /** The parent concept's generated name, or `null` — the ordinary PRD §8 standalone case. */
  readonly conceptName: string | null;
  readonly type: string;
  readonly typeLabel: string;
  readonly priority: BriefPriorityView | null;
  readonly assignee: string | null;
  readonly status: BriefStatusView;
  /** `briefPath(id)` — a real route segment, because the detail is a page and not a panel. */
  readonly href: string;
}

/** How the header counts what is on screen. Singular at one, never "1 briefs". */
export function briefCountLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'brief' : 'briefs'}`;
}

/** The count line while the search is narrowing the list, so "6 briefs" never contradicts 1 row. */
export function filteredBriefCountLabel(visible: number, total: number): string {
  return `${String(Math.max(Math.floor(visible), 0))} of ${briefCountLabel(total)}`;
}

/**
 * The search reads everything the table shows: the generated name, the concept, the type label, the
 * priority, the assignee and the internal status LABEL — so "revisions" finds the row whose chip
 * says `Images Revisions` without this module ever writing that string, and "standalone" finds the
 * brief with no concept because that cell renders the slug. `query` arrives lowercased and trimmed.
 */
export function matchesQuery(item: BriefItem, query: string): boolean {
  if (query === '') {
    return true;
  }
  return [
    item.name,
    item.conceptName ?? STANDALONE_CONCEPT_SLUG,
    item.typeLabel,
    item.priority?.label ?? '',
    item.assignee ?? '',
    item.status.label,
  ].some((value) => value.toLowerCase().includes(query));
}

/**
 * The empty state's two sentences, which say different things and must never be collapsed into one.
 * A brand with nothing in it is offered the primary action; a search that matches nothing is
 * offered its way back, because "New brief" would answer a question nobody asked.
 */
export const NO_BRIEFS_NOTE =
  'No creative briefs yet. One brief is one creative asset, and its name writes itself.';

export const NO_MATCH_NOTE = 'No brief matches this search. Clear it to see every creative.';

/**
 * Why "New brief" is inert outside demo mode too: `createBriefAction` exists and is tested, but the
 * create FORM is not part of this ticket, so the button would have nothing to submit.
 */
export const NEW_BRIEF_SOON_HINT = 'The create form ships with the CSV upload ticket';

/** Why "Re-run AI check" is inert outside demo mode: there is no Server Action behind it yet. */
export const RERUN_SOON_HINT = 'The spelling check runs as a background job in a later ticket';

/** The three QA checkboxes of ticket criterion 10, in the order the checklist lists them. */
export const BRIEF_QA_CHECKS = ['qaVideoEditor', 'qaDesigner', 'qaStrategist'] as const;

/** Their labels, the table `actions.ts` could not export from a `'use server'` module. */
export const BRIEF_QA_LABELS: Record<BriefQaCheck, string> = {
  qaVideoEditor: 'Video Editor QA',
  qaDesigner: 'Graphic Designer QA',
  qaStrategist: 'Creative Strategist QA',
};

/** The detail page's headings, each stated once so the page and the E2E assertion agree. */
export const BRIEF_HEADINGS = {
  concept: 'Concept',
  assignee: 'Assignee',
  type: 'Type',
  version: 'Version',
  priority: 'Priority',
  dimensions: 'Dimensions',
  briefToDesign: 'Brief to Design',
  scriptContent: 'Script or Ad Content',
  elementsTested: 'Elements we are Testing',
  adContent: 'Ad Content',
  inspiration: 'Inspiration',
  inspirationNotes: 'Inspiration Notes',
  offer: 'Offer',
  language: 'Language',
  spellingFeedback2: 'Spelling Feedback 2',
  designFile: 'Design File',
  qaChecklistDoc: 'QA Checklist Doc',
  inspirationImage: 'Inspiration Image',
  scriptAndBriefBreakdown: 'Script & Brief Breakdown',
  approval: 'Approval',
  qa: 'QA checklist',
  spelling: 'Spelling Feedback',
} as const;

/** The three prose sections of the centre column, in order, with what each one is for. */
export const BRIEF_PROSE_FIELDS = [
  {
    name: 'briefToDesign',
    label: BRIEF_HEADINGS.briefToDesign,
    hint: 'What the designer or editor builds, shot by shot.',
  },
  {
    name: 'scriptContent',
    label: BRIEF_HEADINGS.scriptContent,
    hint: 'The words on screen and the words spoken, in order.',
  },
  {
    name: 'elementsTested',
    label: BRIEF_HEADINGS.elementsTested,
    hint: 'The hypothesis this creative exists to settle.',
  },
  {
    name: 'adContent',
    label: BRIEF_HEADINGS.adContent,
    hint: 'The ad content prose for this creative.',
  },
  {
    name: 'inspiration',
    label: BRIEF_HEADINGS.inspirationNotes,
    hint: 'Inspiration notes for this creative.',
  },
] as const satisfies readonly { name: BriefFieldName; label: string; hint: string }[];

/** The empty state of the Inspiration section, so an empty array is never a blank panel. */
export const NO_INSPIRATION_NOTE = 'No inspiration saved on this brief yet.';

/** The empty state of the Spelling Feedback panel. */
export const NO_SPELLING_NOTE = 'The AI check has not run on this brief yet.';

/** The short source name on an inspiration card. `inspirationLink` owns which provider a URL is. */
const INSPIRATION_SOURCE_LABELS: Record<InspoLinkKind, string> = {
  'meta-ad-library': 'Meta Ad Library',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  other: 'Link',
};

export function inspirationSourceLabel(kind: InspoLinkKind): string {
  return INSPIRATION_SOURCE_LABELS[kind];
}

/** The version dropdown's options, V1…V6, labelled by the domain so nothing retypes the `V`. */
export const VERSION_OPTIONS: readonly { key: string; label: string }[] = CREATIVE_VERSIONS.map(
  (version) => ({ key: String(version), label: creativeVersionLabel(version) }),
);

/**
 * The ratios a brief delivers in: its own stored array when it has one, and PRD §8's defaults for
 * its type when it does not. A row written before the defaults existed therefore still shows a grid
 * rather than an empty box, and an edited row shows what it was edited to.
 */
export function briefDimensions(
  stored: readonly string[],
  type: string,
): readonly CreativeDimensionEntry[] {
  const keys = stored.length === 0 ? dimensionsFor(type) : stored;
  return keys
    .map((key) => creativeDimensionEntry(key))
    .filter((entry): entry is CreativeDimensionEntry => entry !== undefined);
}

/**
 * The next step on this brief's own internal ladder, or `null` at the end of it.
 *
 * Read from the state machine's transition table, never from a list written here. `on_hold` is
 * skipped on purpose: it is the non-linear branch the handoff renders as a side badge, so it is not
 * what "advance" means, and the button offers the linear next step the stepper can draw.
 */
export function nextInternalStatus(
  track: CreativeTrack,
  current: InternalStatusKey,
): BriefStatusView | null {
  const allowed = internalTransitionsFor(track)[current] ?? [];
  const next = internalStatusFor(track).find((entry) => allowed.includes(entry.key));
  return next === undefined ? null : internalStatusView(track, next.key);
}

/** What the advance button says, so the label and the step it moves to cannot disagree. */
export function advanceLabel(next: BriefStatusView): string {
  return `Advance to ${next.label}`;
}

/**
 * The optional PRD §7 product suffix of a generated name, or `null` when it carries none.
 *
 * There is no `product` column: §7's suffix lives only inside the name, because it disambiguates a
 * creative whose concept does not already name the product — in practice the standalone static.
 * A save re-computes the whole name from its parts, so the suffix has to be readable back out of
 * the one place it is stored, or the next save would silently drop it.
 *
 * The version segment is the anchor: everything after the LAST `V<number>` segment is the suffix.
 * Anchoring on the version rather than on a hyphen count is what keeps `POV: X vs Y` and every
 * other hyphenated concept name intact.
 */
export function productSuffixOf(name: string, version: number): string | null {
  const segments = name.split(CREATIVE_NAME_SEPARATOR);
  const marker = creativeVersionLabel(version);
  const at = segments.lastIndexOf(marker);
  if (at === -1 || at === segments.length - 1) {
    return null;
  }
  const suffix = segments.slice(at + 1).join(CREATIVE_NAME_SEPARATOR);
  return suffix.trim() === '' ? null : suffix;
}

/** The type's human label, re-exported so a component never reaches past this module. */
export { creativeTypeLabel };
