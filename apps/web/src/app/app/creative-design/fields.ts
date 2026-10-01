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
  CLIENT_STATUS,
  chipTone,
  internalStatusFor,
  internalTransitionsFor,
  type ChipTone,
  type CreativeTrack,
  type InternalStatusKey,
} from '@tas/domain/state';
import type {
  ClientAssetFolderListRow,
  CreativeModuleListRow,
  CreativeReportListRow,
  CreativeSheetItemListRow,
} from '@tas/db';

import { differenceCpaView, formatCurrency } from '@/app/app/creative-reporting/fields';
import {
  SELECTION_PARAM as SHEET_SELECTION_PARAM,
  internalStatusView as sheetInternalStatusView,
  statusView as sheetStatusView,
  type SheetStatusView,
} from '@/app/app/creative-sheet/fields';
import {
  clientAssetsPath,
  creativeModulesPath,
  creativeReportingPath,
  creativeSheetPath,
} from '@/lib/routes';

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
 * `@tas/db` is imported for its TYPES only: the workspace and the detail form are client components,
 * and a runtime import of that package would drag the database driver into the browser bundle. A
 * type-only import is erased. Everything a client needs is handed down from `page.tsx` as plain data.
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

/** The client-facing status as its chip — the board sidebar's Client Status line (P2B-3). */
export interface BriefClientStatusView {
  readonly key: string;
  readonly label: string;
  readonly tone: ChipTone;
}

/**
 * The view of one stored client status. Total the same way `internalStatusView` is: an unknown key
 * renders its own value muted rather than an empty cell.
 */
export function clientStatusView(key: string): BriefClientStatusView {
  const entry = CLIENT_STATUS.find((step) => step.key === key);
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
 * The raw fields the update action needs to rebuild FormData on a Kanban drag. Every field that
 * `fieldsOf()` in `actions.ts` reads is here so the drag handler can construct valid FormData
 * without a server round-trip to re-fetch the brief. Kept as plain strings (the FormData shape)
 * so the client never parses or validates — the action does that.
 */
export interface BriefFormSnapshot {
  readonly conceptId: string;
  readonly funnel: string;
  readonly type: string;
  readonly version: string;
  readonly batch: string;
  readonly product: string;
  readonly priority: string;
  readonly assignee: string;
  readonly briefToDesign: string;
  readonly scriptContent: string;
  readonly elementsTested: string;
  readonly adContent: string;
  readonly inspiration: string;
  readonly offer: string;
  readonly language: string;
  readonly spellingFeedback2: string;
  readonly angleId: string;
  readonly productId: string;
  readonly inspoLinks: readonly string[];
  readonly dimensions: readonly string[];
  readonly internalStatus: string;
  readonly clientStatus: string;
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
  /** The client-facing track, for the board sidebar's quick read (P2B-3). */
  readonly clientStatus: BriefClientStatusView;
  /** Funnel and Source as the sidebar shows them; Source is stored display-ready ("TAS"/"Client"). */
  readonly funnelLabel: string;
  readonly sourceLabel: string;
  /** `briefPath(id)` — a real route segment, because the detail is a page and not a panel. */
  readonly href: string;
  /** Raw Kanban-groupable field values, keyed by column name. */
  readonly kanbanFields: Record<string, string>;
  /** First image URL from designFile or inspirationImage, for Gallery view. */
  readonly galleryImageUrl: string | null;
  /** All raw fields the update action needs, so Kanban drag can build FormData without re-fetching. */
  readonly formSnapshot: BriefFormSnapshot;
  /** How many rows of each counterpart table point at this brief — the panel's one-line read. */
  readonly linkCounts: BriefLinkCounts;
}

// ── Two-way links (module parity, phase 2) ──────────────────────────────────────────────────────

/**
 * The four tables that point AT a brief, each read back the other way here so the brief shows what
 * cites it. The links are one-directional in the schema — `creative_sheet_items.brief_id`,
 * `creative_module_designs`, `brief_asset_folders`, `creative_reporting.brief_id` — and the brief
 * never stores the inverse: these are computed from the counterpart rows on the server, by the
 * functions below, and handed down as plain data.
 */
export type BriefLinkKind = 'sheetItems' | 'modules' | 'folders' | 'reports';

/** One chip on a linked record: a sheet status, a CPA difference. */
export interface BriefLinkChip {
  readonly label: string;
  readonly tone: ChipTone;
}

/** One row of another table that points at this brief, as the rail's card renders it. */
export interface BriefLinkedRecord {
  readonly id: string;
  readonly label: string;
  /** True when the label is generated system output (a computed name), so it renders in `font-mono`. */
  readonly mono: boolean;
  /** The counterpart page, opened on this row's panel; `null` when the row has no page of its own. */
  readonly href: string | null;
  /** A quiet second line under the label, e.g. a report's CPA against its target. */
  readonly detail: string | null;
  readonly chips: readonly BriefLinkChip[];
}

export type BriefLinkedRecords = Readonly<Record<BriefLinkKind, readonly BriefLinkedRecord[]>>;
export type BriefLinkCounts = Readonly<Record<BriefLinkKind, number>>;

/** The counterpart rows, as each module's `load…` function returns them (fixtures or database). */
export interface BriefLinkSources {
  readonly sheetItems: readonly CreativeSheetItemListRow[];
  readonly modules: readonly CreativeModuleListRow[];
  readonly folders: readonly ClientAssetFolderListRow[];
  readonly reports: readonly CreativeReportListRow[];
}

/** One rail section: its data-slot, heading, empty-state sentence and the noun the count line uses. */
export interface BriefLinkSection {
  readonly kind: BriefLinkKind;
  readonly slot: string;
  readonly heading: string;
  readonly empty: string;
  readonly noun: readonly [singular: string, plural: string];
}

/** The rail's four link sections, in the order they render and the count line reads. */
export const BRIEF_LINK_SECTIONS: readonly BriefLinkSection[] = [
  {
    kind: 'sheetItems',
    slot: 'brief-creative-sheet',
    heading: 'Creative Sheet',
    empty: 'No sheet row names this creative yet. One appears when the month’s sheet links it.',
    noun: ['sheet row', 'sheet rows'],
  },
  {
    kind: 'modules',
    slot: 'brief-creative-modules',
    heading: 'Creative Modules',
    empty: 'No module groups this creative yet. Link it from the module’s panel.',
    noun: ['module', 'modules'],
  },
  {
    kind: 'folders',
    slot: 'brief-client-assets',
    heading: 'Client Asset folders',
    empty: 'No client asset folder feeds this creative yet. Link it from the folder’s panel.',
    noun: ['asset folder', 'asset folders'],
  },
  {
    kind: 'reports',
    slot: 'brief-creative-reports',
    heading: 'Creative Reports',
    empty: 'No report has been filed for this creative yet.',
    noun: ['report', 'reports'],
  },
];

export const NO_BRIEF_LINKS: BriefLinkCounts = {
  sheetItems: 0,
  modules: 0,
  folders: 0,
  reports: 0,
};

/**
 * Each counterpart page opened on one row. The Creative Sheet exports its selection parameter; the
 * other three read theirs inline (`params.module`, `params.folder`, `params.creativeReport` in
 * their `page.tsx`), so those three names are stated here, once, beside the page they belong to.
 */
function sheetItemHref(id: string): string {
  return `${creativeSheetPath}?${SHEET_SELECTION_PARAM}=${encodeURIComponent(id)}`;
}
function moduleHref(id: string): string {
  return `${creativeModulesPath}?module=${encodeURIComponent(id)}`;
}
function folderHref(id: string): string {
  return `${clientAssetsPath}?folder=${encodeURIComponent(id)}`;
}
function reportHref(id: string): string {
  return `${creativeReportingPath}?creativeReport=${encodeURIComponent(id)}`;
}

/** A report's one-line read, both sides formatted by the reporting module's own currency rule. */
export function cpaVsTargetLabel(cpa: string | null, targetCpa: string | null): string {
  return `CPA ${formatCurrency(cpa)} vs target ${formatCurrency(targetCpa)}`;
}

/**
 * Every row of the four counterpart tables that points at `briefId`, in the order each source
 * returns them, each already carrying its href, its chips and its detail line. Statuses and the
 * CPA difference are read through the counterpart module's own view functions, so a sheet chip on
 * this page and on the Creative Sheet cannot disagree.
 */
export function briefLinkedRecords(briefId: string, sources: BriefLinkSources): BriefLinkedRecords {
  return {
    sheetItems: sources.sheetItems
      .filter((row) => row.briefId === briefId)
      .map((row) => ({
        id: row.id,
        label: row.name,
        mono: true,
        href: sheetItemHref(row.id),
        detail: null,
        chips: [sheetInternalStatusView(row.internalStatus), sheetStatusView(row.status)]
          .filter((view): view is SheetStatusView => view !== null)
          .map((view) => ({ label: view.label, tone: view.tone })),
      })),
    modules: sources.modules
      .filter((row) => row.briefIds.includes(briefId))
      .map((row) => ({
        id: row.id,
        label: row.moduleName,
        mono: false,
        href: moduleHref(row.id),
        detail: null,
        chips: [],
      })),
    folders: sources.folders
      .filter((row) => row.briefIds.includes(briefId))
      .map((row) => ({
        id: row.id,
        label: row.name,
        mono: false,
        href: folderHref(row.id),
        detail: null,
        chips: [],
      })),
    reports: sources.reports
      .filter((row) => row.briefId === briefId)
      .map((row) => {
        const difference = differenceCpaView(row.differenceCpa);
        return {
          id: row.id,
          label: row.nameAngleOffer,
          mono: false,
          href: reportHref(row.id),
          detail: cpaVsTargetLabel(row.cpa, row.targetCpa),
          chips: difference === null ? [] : [difference],
        };
      }),
  };
}

/**
 * `briefId -> counts`, every brief any counterpart row points at, in one pass per source — so the
 * list page costs four reads for N briefs rather than four per brief. A brief nobody cites is absent;
 * the caller reads `NO_BRIEF_LINKS` for it.
 */
export function indexBriefLinkCounts(
  sources: BriefLinkSources,
): ReadonlyMap<string, BriefLinkCounts> {
  const index = new Map<string, Record<BriefLinkKind, number>>();
  const bump = (briefId: string, kind: BriefLinkKind): void => {
    const counts = index.get(briefId) ?? { ...NO_BRIEF_LINKS };
    counts[kind] += 1;
    index.set(briefId, counts);
  };
  for (const row of sources.sheetItems) {
    if (row.briefId !== null) bump(row.briefId, 'sheetItems');
  }
  for (const row of sources.modules) {
    for (const briefId of row.briefIds) bump(briefId, 'modules');
  }
  for (const row of sources.folders) {
    for (const briefId of row.briefIds) bump(briefId, 'folders');
  }
  for (const row of sources.reports) {
    if (row.briefId !== null) bump(row.briefId, 'reports');
  }
  return index;
}

/** The panel's count line: `1 sheet row · 2 modules · 0 asset folders · 1 report`. Never "1 rows". */
export function linkCountLabel(counts: BriefLinkCounts): string {
  return BRIEF_LINK_SECTIONS.map((section) => {
    const count = counts[section.kind];
    return `${String(count)} ${count === 1 ? section.noun[0] : section.noun[1]}`;
  }).join(' · ');
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
  source: 'Source',
  funnel: 'Funnel',
  platform: 'Platform',
  designLinkUrl: 'Design Link URL',
  collection: 'Collection',
  asset: 'Assets',
  metaCopywriting: 'Meta Copywriting',
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
