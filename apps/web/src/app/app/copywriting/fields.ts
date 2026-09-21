import {
  COPY_CTAS,
  COPY_FIELD_LABELS,
  COPY_FUNNELS,
  COPY_LIMITS,
  copyLength,
  copyLimitFor,
  overBy,
  type CopyDraftField,
  type CopyLimitField,
} from '@tas/domain/copy';
import { COPY_STATUS, type ChipTone } from '@tas/domain/state';

/**
 * How the Copywriting route presents what it stores (PRD §5.11). One module, so the table, the
 * detail panel and the `/design-system` preview cannot drift: the column order, the four copy
 * fields, the character guidance, the em dash and the empty-state sentences are each stated once.
 *
 * Nothing here invents a vocabulary. The CTA options are `COPY_CTAS`, the status options are
 * `COPY_STATUS`, the field labels and the ~125 / ~40 / ~27 guidance are `COPY_FIELD_LABELS` and
 * `COPY_LIMITS`, and the counter measures with `copyLength` / `overBy` — all from `@tas/domain`.
 * No component writes `'Shop Now'`, `'approved'`, `'Primary Copy'` or `125`.
 *
 * `@tas/db` is deliberately absent: the workspace and the panel are client components and a runtime
 * import of that package would drag the database driver into the browser bundle. Everything a
 * client needs is handed down from `page.tsx` as plain data.
 */

/** The URL parameter the search lives in, the same `?q=` every other list page uses. */
export const SEARCH_PARAM = 'q';

/** The URL parameter the open row lives in, so a refresh reopens the panel and the link is shareable. */
export const SELECTION_PARAM = 'copy';

/**
 * The list's four columns, in the one order the ticket fixes. No fifth column, ever.
 *
 * The first cell stacks two values — the auto-generated Copy # in `font-mono` and, under it, the
 * row's Headline — so the header names both rather than only the one. Splitting them would be the
 * fifth column PRD §5.11 rules out ("keep this table lean"), and leaving the second line unnamed
 * left the most-read words on the page label-less.
 */
export const COPY_COLUMNS = [
  'Copy title / Headline',
  'Linked Creative',
  'Concept',
  'Funnel',
  'Status',
  'Updated',
] as const;

/** The dash a null cell shows, so an unattached row is never just a gap. */
export const EM_DASH = '—';

/** What the demo footer says instead of offering a save. */
export const DEMO_FOOTER_NOTICE = 'Demo mode — changes are not saved';

/**
 * One copy row as the route renders it: everything the table and the panel show, and nothing else.
 * Built on the server so the client components never import `@tas/db` and never resolve a status,
 * a title or a timestamp themselves.
 */
export interface CopyItem {
  readonly id: string;
  /** `copyTitle(copyNumber)` — auto-generated, never typed, rendered in `font-mono`. */
  readonly title: string;
  readonly headline: string | null;
  readonly primaryCopy: string | null;
  readonly linkDescription: string | null;
  readonly cta: string;
  readonly status: string;
  readonly statusLabel: string;
  readonly statusTone: ChipTone;
  /** `null` is the ordinary unattached case (CLAUDE.md non-negotiable 5), not a degraded row. */
  readonly creativeBriefId: string | null;
  readonly creativeName: string | null;
  readonly conceptId: string | null;
  readonly conceptName: string | null;
  /** `briefPath(creativeBriefId)`, or `null` when there is no creative to link to. */
  readonly creativeHref: string | null;
  /** A `COPY_FUNNELS` key, or `null` when not yet assigned. */
  readonly funnel: string | null;
  /** Whether this copy has been used in a live ad. */
  readonly used: boolean;
  /** Whether this copy is a proven winner. */
  readonly winning: boolean;
  /** Meta's ad quality rating (1–10), or `null` when not yet scored. */
  readonly metaRating: number | null;
  /** AI-generated spelling feedback, read-only. */
  readonly spellingFeedback: string | null;
  /** The client writes this, we never do. Read-only wherever it appears. */
  readonly clientComment: string | null;
  readonly updatedLabel: string;
  readonly updatedTitle: string;
}

/** One option of the panel's Linked Creative select: a brief's id and its generated §7 name. */
export interface CreativeChoice {
  readonly id: string;
  readonly name: string;
}

/**
 * The value the "No creative" option carries. A `Select` item cannot hold the empty string, and a
 * copy row's `creative_brief_id` is a uuid or nothing, so this sentinel can never collide with a
 * real brief id. The hidden input submits `''` for it and the action stores NULL.
 */
export const NO_CREATIVE_VALUE = 'none';

/** What that option reads as (ticket criterion 7). */
export const NO_CREATIVE_LABEL = 'No creative';

/** One option of the panel's Concept select. */
export interface ConceptChoice {
  readonly id: string;
  readonly name: string;
}

export const NO_CONCEPT_VALUE = 'none';
export const NO_CONCEPT_LABEL = 'No concept';

/** The four copy fields of ticket criterion 6, and how each one is rendered. */
export interface CopyField {
  readonly name: CopyDraftField;
  readonly label: string;
  /** `textarea` is copy the writer types; `cta` is the closed-vocabulary select. */
  readonly kind: 'textarea' | 'cta';
  /** The field's character guidance, or `null` for the CTA, which carries none. */
  readonly limit: CopyLimitField | null;
  /** Helper text under the label, in `text-text3`. */
  readonly hint: string;
}

/** The PRD's guidance sentence for a limited field. The number is the domain's, never retyped. */
function guidance(field: CopyLimitField): string {
  return `~${String(COPY_LIMITS[field])} characters — Meta cuts it short past that, it is not rejected.`;
}

/**
 * Primary Copy, Headline, News Feed / Link Description, CTA — exactly these four, in this order.
 * Client's Comment is not here on purpose: the client writes it, so the panel shows it read-only
 * outside this descriptor and no save ever submits it.
 */
export const COPY_FIELDS = [
  {
    name: 'primaryCopy',
    label: COPY_FIELD_LABELS.primaryCopy,
    kind: 'textarea',
    limit: 'primaryCopy',
    hint: guidance('primaryCopy'),
  },
  {
    name: 'headline',
    label: COPY_FIELD_LABELS.headline,
    kind: 'textarea',
    limit: 'headline',
    hint: guidance('headline'),
  },
  {
    name: 'linkDescription',
    label: COPY_FIELD_LABELS.linkDescription,
    kind: 'textarea',
    limit: 'linkDescription',
    hint: guidance('linkDescription'),
  },
  {
    name: 'cta',
    label: 'CTA',
    kind: 'cta',
    limit: null,
    hint: 'The button Meta renders on the ad. One of six, never typed.',
  },
] as const satisfies readonly CopyField[];

/** The CTA dropdown's options, in the domain's render order. */
export const CTA_OPTIONS: readonly { value: string; label: string }[] = COPY_CTAS.map((entry) => ({
  value: entry.key,
  label: entry.label,
}));

/** The Status dropdown's options, in the PRD's order: the entry state, then the four outcomes. */
export const STATUS_OPTIONS: readonly { value: string; label: string; description: string }[] =
  COPY_STATUS.map((entry) => ({
    value: entry.key,
    label: entry.label,
    description: entry.description,
  }));

/** The Funnel dropdown's options, in the domain's render order. */
export const FUNNEL_OPTIONS: readonly { value: string; label: string }[] = COPY_FUNNELS.map(
  (entry) => ({
    value: entry.key,
    label: entry.label,
  }),
);

/** The sentinel value the "No funnel" option carries, matching the NO_CREATIVE_VALUE pattern. */
export const NO_FUNNEL_VALUE = 'none';

/** What the "No funnel" option reads as. */
export const NO_FUNNEL_LABEL = 'No funnel';

/** The two headings above the panel's selects, stated once so the E2E assertion agrees with them. */
export const COPY_HEADINGS = {
  copy: 'Copy',
  creative: 'Creative & Status',
  details: 'Details',
  clientComment: "Client's Comment",
} as const;

/** The one sentence under the read-only client comment, so nobody hunts for the missing input. */
export const CLIENT_COMMENT_NOTE =
  'Written by the client in their approval interface. Read-only here.';

/** How the header counts what is on screen. Singular at one, never "1 copies". */
export function copyCountLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'copy row' : 'copy rows'}`;
}

/** The count line while the search narrows the list, so "4 copy rows" never contradicts 1 row. */
export function filteredCopyCountLabel(visible: number, total: number): string {
  return `${String(Math.max(Math.floor(visible), 0))} of ${copyCountLabel(total)}`;
}

/**
 * The search reads everything the table shows plus the words the row is actually made of: the
 * generated title, the headline, the primary copy, the linked creative's name and the status LABEL
 * — so "approved" finds the row whose chip says Approved without this module writing that string,
 * and a half-remembered phrase finds the copy it belongs to. `query` arrives lowercased and trimmed.
 */
export function matchesQuery(item: CopyItem, query: string): boolean {
  if (query === '') {
    return true;
  }
  return [
    item.title,
    item.headline ?? '',
    item.primaryCopy ?? '',
    item.linkDescription ?? '',
    item.cta,
    item.creativeName ?? NO_CREATIVE_LABEL,
    item.funnel ?? '',
    item.statusLabel,
  ].some((value) => value.toLowerCase().includes(query));
}

/**
 * The empty state's two sentences, which say different things and must never be collapsed into one.
 * A brand with no copy at all is offered the primary action; a search that matches nothing is
 * offered its way back, because "New copy" would answer a question nobody asked.
 */
export const NO_COPY_NOTE =
  'No copy written yet. A copy row is a headline plus the three pieces of text around it.';

export const NO_MATCH_NOTE = 'No copy matches this search. Clear it to see every row.';

/**
 * Why "New copy" is inert outside demo mode too: creating a row is explicitly out of this ticket's
 * scope, so there is no create action for the button to submit to. One ships with the CSV upload
 * ticket; an exported Server Action nothing submits to would be dead code until then.
 */
export const NEW_COPY_SOON_HINT = 'Creating a copy row ships with the CSV upload ticket';

/** How a character counter reads: used of the guide. */
export function counterLabel(text: string | null, field: CopyLimitField): string {
  return `${String(copyLength(text))} of ${String(copyLimitFor(field))}`;
}

/**
 * What colour that counter is. Muted while there is room, `warn` exactly AT the guide — the last
 * character that still fits — and `bad` past it. Never a block: `validateCopyDraft` keeps `ok` true
 * for an over-long field, because the PRD's numbers are tildes.
 */
export type CounterTone = 'muted' | 'warn' | 'bad';

export function counterTone(text: string | null, field: CopyLimitField): CounterTone {
  const limit = copyLimitFor(field);
  if (overBy(text, limit) > 0) {
    return 'bad';
  }
  return copyLength(text) === limit ? 'warn' : 'muted';
}

/** The token class each counter tone renders in. No hex, no literal colour anywhere. */
export const COUNTER_TONE_CLASS: Record<CounterTone, string> = {
  muted: 'text-text3',
  warn: 'text-warn',
  bad: 'text-bad',
};
