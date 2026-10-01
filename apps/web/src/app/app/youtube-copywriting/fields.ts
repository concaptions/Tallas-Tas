import type {
  LinkedCampaign,
  LinkedCollection,
  LinkedCopyType,
  LinkedProduct,
  YoutubeCopyListRow,
} from '@tas/db';
import {
  youtubeCopyCtas,
  youtubeCopyFunnels,
  type YoutubeCopyCtasKey,
  type YoutubeCopyFunnelsKey,
} from '@tas/db/schema';
import { isCopyNumber } from '@tas/domain/copy';
import { COPY_STATUS, copyStatusLabel, copyStatusTone, type ChipTone } from '@tas/domain/state';

import { absoluteTime, relativeTime } from '@/lib/relative-time';
import type { CampaignOption, LinkOption } from '@/lib/youtube-copywriting-source';

/**
 * How the YouTube Copywriting route presents what it stores (Airtable `tblVR1UmkbDoDzJ7z`). One
 * module, so the grid, the panel, the Server Actions and the `/design-system` story cannot drift:
 * the field vocabulary, the 90-character rule, the em dash and the count sentence are each stated
 * once.
 *
 * Nothing here invents a vocabulary. Status options are `COPY_STATUS` (`@tas/domain/state`), the
 * CTA and Funnel options are the `youtubeCopyCtas` / `youtubeCopyFunnels` tuples the columns are
 * typed from (`@tas/db/schema`, the same import `personas/fields.ts` makes for `awarenessStages`),
 * and the Copy # title reads the stored integer through the domain's `isCopyNumber`. The `@tas/db`
 * and source imports are type-only, so this module stays importable from a client component
 * without the database driver.
 */
export type { CampaignOption, LinkOption };

/** The URL parameter the search lives in, the same `?q=` every other list page uses. */
export const SEARCH_PARAM = 'q';

/** The URL parameter the open row lives in, so a refresh reopens the panel and the link is shareable. */
export const SELECTION_PARAM = 'youtube-copy';

/** The selection value that means "the panel is open on a row that does not exist yet". */
export const NEW_YOUTUBE_COPY = 'new';

/** The dash a null cell shows, so an unset value is never just a gap. */
export const EM_DASH = '—';
export const NOT_SET = 'Not set';

/** What the demo footer says instead of offering a save. */
export const DEMO_FOOTER_NOTICE = 'Demo mode — changes are not saved';

/** Airtable's "Descriptions (90 caractères max)": the panel's `maxLength` and the action's `max`. */
export const DESCRIPTIONS_MAX = 90;
export const DESCRIPTIONS_LIMIT_MESSAGE = 'Descriptions are limited to 90 characters';

/** Airtable's "Meta Rating" is a five-star rating; zero is "rated, no stars". */
export const META_RATING_MIN = 0;
export const META_RATING_MAX = 5;
export const META_RATING_MESSAGE = 'Meta rating is a whole number from 0 to 5.';

/** How much of a description the grid cell shows before the ellipsis; the full text is its title. */
export const DESCRIPTIONS_PREVIEW = 56;

/** The value a "none" option carries: a `Select` item cannot hold the empty string. */
export const NONE_VALUE = 'none';
export const NO_CTA_LABEL = 'No CTA';
export const NO_FUNNEL_LABEL = 'No funnel';

/**
 * The Airtable primary field, "Copy 3": the auto-generated title of a row (CLAUDE.md non-negotiable
 * 6), rendered in `font-mono` and never typed. Total: a number that is not a copy number renders as
 * `Copy ?`, so an in-flight row still has a heading.
 */
export function copyNumberLabel(copyNumber: number | null | undefined): string {
  return `Copy ${isCopyNumber(copyNumber) ? String(copyNumber) : '?'}`;
}

/** A grid preview of a long text: cut at `max` with an ellipsis, or returned whole when it fits. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(max - 1, 0)).trimEnd()}…`;
}

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

/** The stored CTA keys, in vocabulary order: what the action's `z.enum` accepts. */
export const CTA_KEYS: readonly YoutubeCopyCtasKey[] = youtubeCopyCtas.map((entry) => entry.key);

/** The stored funnel keys, in vocabulary order. */
export const FUNNEL_KEYS: readonly YoutubeCopyFunnelsKey[] = youtubeCopyFunnels.map(
  (entry) => entry.key,
);

/** The CTA dropdown's options, in the vocabulary's order. */
export const CTA_OPTIONS: readonly SelectOption[] = youtubeCopyCtas.map((entry) => ({
  value: entry.key,
  label: entry.label,
}));

/** The Funnel dropdown's options, in the vocabulary's order. */
export const FUNNEL_OPTIONS: readonly SelectOption[] = youtubeCopyFunnels.map((entry) => ({
  value: entry.key,
  label: entry.label,
}));

/** The Status dropdown's options, in the PRD's order: the entry state, then the four outcomes. */
export const STATUS_OPTIONS: readonly SelectOption[] = COPY_STATUS.map((entry) => ({
  value: entry.key,
  label: entry.label,
}));

/** The label for a stored CTA key. Total: an unknown key renders itself rather than a blank cell. */
export function ctaLabel(value: string | null): string | null {
  if (value === null) return null;
  return youtubeCopyCtas.find((entry) => entry.key === value)?.label ?? value;
}

/** The label for a stored funnel key, total in the same way. */
export function funnelLabel(value: string | null): string | null {
  if (value === null) return null;
  return youtubeCopyFunnels.find((entry) => entry.key === value)?.label ?? value;
}

/** "4 / 5" for a rating, or null when the row has not been rated. */
export function metaRatingLabel(value: number | null): string | null {
  return value === null ? null : `${String(value)} / ${String(META_RATING_MAX)}`;
}

/** The Yes/No chip a checkbox column renders: `ok` when set, muted otherwise. */
export function booleanChip(value: boolean): { readonly label: string; readonly tone: ChipTone } {
  return value ? { label: 'Yes', tone: 'ok' } : { label: 'No', tone: 'mute' };
}

/** How the header counts what is on screen. Singular at one, never "1 copy rows". */
export function countLabel(total: number, visible: number): string {
  const noun = total === 1 ? 'copy row' : 'copy rows';
  return visible === total
    ? `${String(total)} ${noun}`
    : `${String(visible)} of ${String(total)} ${noun}`;
}

/** The chip label of a campaign option: the Campaign Code, as Airtable's link field is named. */
export function campaignChipLabel(option: {
  readonly name: string;
  readonly code: string | null;
}): string {
  return option.code ?? option.name;
}

/**
 * One row as the route renders it: everything the grid and the panel show, and nothing else. Built
 * on the server (or by the story over the fixtures) so the client components never import `@tas/db`
 * and never resolve a status, a title or a timestamp themselves.
 */
export interface YoutubeCopyItem {
  readonly id: string;
  readonly copyNumber: number;
  /** `copyNumberLabel(copyNumber)` — auto-generated, never typed, rendered in `font-mono`. */
  readonly title: string;
  readonly status: string;
  readonly statusLabel: string;
  readonly statusTone: ChipTone;
  readonly angle: string | null;
  readonly descriptions: string | null;
  readonly headline: string | null;
  readonly newsFeed: string | null;
  readonly cta: string | null;
  readonly ctaLabel: string | null;
  readonly funnel: string | null;
  readonly funnelLabel: string | null;
  readonly clientComment: string | null;
  readonly used: boolean;
  readonly winning: boolean;
  readonly metaRating: number | null;
  readonly linkedCollections: readonly LinkedCollection[];
  readonly linkedProducts: readonly LinkedProduct[];
  readonly linkedCampaigns: readonly LinkedCampaign[];
  readonly linkedCopyTypes: readonly LinkedCopyType[];
  readonly updatedLabel: string;
  readonly updatedTitle: string;
}

/** The row to its item, with one `now` so the server and the story format the same string. */
export function toYoutubeCopyItem(row: YoutubeCopyListRow, now: Date): YoutubeCopyItem {
  return {
    id: row.id,
    copyNumber: row.copyNumber,
    title: copyNumberLabel(row.copyNumber),
    status: row.status,
    statusLabel: copyStatusLabel(row.status),
    statusTone: copyStatusTone(row.status),
    angle: row.angle,
    descriptions: row.descriptions,
    headline: row.headline,
    newsFeed: row.newsFeed,
    cta: row.cta,
    ctaLabel: ctaLabel(row.cta),
    funnel: row.funnel,
    funnelLabel: funnelLabel(row.funnel),
    clientComment: row.clientComment,
    used: row.used,
    winning: row.winning,
    metaRating: row.metaRating,
    linkedCollections: row.linkedCollections,
    linkedProducts: row.linkedProducts,
    linkedCampaigns: row.linkedCampaigns,
    linkedCopyTypes: row.linkedCopyTypes,
    updatedLabel: relativeTime(row.updatedAt, now),
    updatedTitle: absoluteTime(row.updatedAt),
  };
}

/**
 * The search reads everything the grid shows plus the words the row is made of: the generated
 * title, the copy fields, the angle, the status, CTA and funnel LABELS and the linked names.
 * `query` arrives lowercased and trimmed.
 */
export function matchesQuery(item: YoutubeCopyItem, query: string): boolean {
  if (query === '') return true;
  return [
    item.title,
    item.headline ?? '',
    item.descriptions ?? '',
    item.angle ?? '',
    item.newsFeed ?? '',
    item.statusLabel,
    item.ctaLabel ?? '',
    item.funnelLabel ?? '',
    ...item.linkedCollections.map((link) => link.name),
    ...item.linkedProducts.map((link) => link.name),
    ...item.linkedCampaigns.map((link) => link.code ?? link.name),
    ...item.linkedCopyTypes.map((link) => link.name),
  ].some((value) => value.toLowerCase().includes(query));
}

/** The two kanban groupings `table-views.ts` declares for this table. */
export type KanbanGroup = 'status' | 'funnel';

/** Every column of a grouping, in vocabulary order, empties kept; a null funnel has its own column. */
export function kanbanColumnsFor(group: KanbanGroup): readonly SelectOption[] {
  return group === 'status'
    ? STATUS_OPTIONS
    : [...FUNNEL_OPTIONS, { value: '', label: NO_FUNNEL_LABEL }];
}

/** The column an item sits in for a grouping; the empty string is the "No funnel" column. */
export function kanbanValueOf(item: YoutubeCopyItem, group: KanbanGroup): string {
  return group === 'status' ? item.status : (item.funnel ?? '');
}

/** The stored columns the panel edits, by control. `copyNumber` is absent on purpose: it is generated. */
export type YoutubeCopyTextField =
  'angle' | 'headline' | 'newsFeed' | 'descriptions' | 'clientComment';
export type YoutubeCopySelectField = 'cta' | 'funnel' | 'status';
export type YoutubeCopyFlagField = 'used' | 'winning';
export type YoutubeCopyFieldName =
  YoutubeCopyTextField | YoutubeCopySelectField | YoutubeCopyFlagField | 'metaRating';

export type YoutubeCopyGroup = 'copy' | 'targeting' | 'performance' | 'client';

interface FieldBase {
  readonly label: string;
  readonly group: YoutubeCopyGroup;
  /** Helper text under the control, in `text-text3`, or null. */
  readonly hint: string | null;
}

/** One panel field. The union ties each control kind to the columns it may write, so nothing casts. */
export type YoutubeCopyField =
  | (FieldBase & { readonly kind: 'text' | 'textarea'; readonly name: YoutubeCopyTextField })
  | (FieldBase & { readonly kind: 'select'; readonly name: YoutubeCopySelectField })
  | (FieldBase & { readonly kind: 'checkbox'; readonly name: YoutubeCopyFlagField })
  | (FieldBase & { readonly kind: 'rating'; readonly name: 'metaRating' });

/** Every stored field but the generated number, grouped as the panel renders them. */
export const YOUTUBE_COPY_FIELDS = [
  {
    name: 'angle',
    label: 'Angle',
    kind: 'text',
    group: 'copy',
    hint: 'Loose text, as in Airtable — not a link to the Angles table.',
  },
  { name: 'headline', label: 'Headline', kind: 'text', group: 'copy', hint: null },
  {
    name: 'descriptions',
    label: 'Descriptions',
    kind: 'textarea',
    group: 'copy',
    hint: `YouTube shows at most ${String(DESCRIPTIONS_MAX)} characters; the field stops there.`,
  },
  { name: 'newsFeed', label: 'News Feed', kind: 'text', group: 'copy', hint: null },
  {
    name: 'cta',
    label: 'CTA',
    kind: 'select',
    group: 'targeting',
    hint: 'The button YouTube renders on the ad. One of six, never typed.',
  },
  {
    name: 'funnel',
    label: 'Funnel',
    kind: 'select',
    group: 'targeting',
    hint: 'Wider than Meta copy: MOF & BOF, POST PURCHASE and ALL FUNNELS exist here.',
  },
  { name: 'status', label: 'Status', kind: 'select', group: 'targeting', hint: null },
  { name: 'used', label: 'Used', kind: 'checkbox', group: 'performance', hint: null },
  { name: 'winning', label: 'Winning', kind: 'checkbox', group: 'performance', hint: null },
  {
    name: 'metaRating',
    label: 'Meta Rating',
    kind: 'rating',
    group: 'performance',
    hint: `${String(META_RATING_MIN)} to ${String(META_RATING_MAX)}, as the Airtable star rating.`,
  },
  {
    name: 'clientComment',
    label: "Client's Comment",
    kind: 'textarea',
    group: 'client',
    hint: 'What the client wrote back in their approval interface.',
  },
] as const satisfies readonly YoutubeCopyField[];

/** The panel's section headings, stated once so the E2E assertion agrees with them. */
export const YOUTUBE_COPY_HEADINGS: Readonly<Record<YoutubeCopyGroup | 'links', string>> = {
  copy: 'Copy',
  targeting: 'CTA, funnel & status',
  performance: 'Performance',
  client: "Client's Comment",
  links: 'Linked records',
};

/** The options a select field offers, and what its "none" row reads as (null: no such row). */
export function selectOptionsFor(name: YoutubeCopySelectField): {
  readonly options: readonly SelectOption[];
  readonly noneLabel: string | null;
} {
  switch (name) {
    case 'cta':
      return { options: CTA_OPTIONS, noneLabel: NO_CTA_LABEL };
    case 'funnel':
      return { options: FUNNEL_OPTIONS, noneLabel: NO_FUNNEL_LABEL };
    case 'status':
      return { options: STATUS_OPTIONS, noneLabel: null };
  }
}

/**
 * The empty state's two sentences, which say different things: a brand with no copy at all is
 * offered the primary action; a search that matches nothing is offered its way back.
 */
export const NO_COPY_NOTE =
  'No YouTube copy yet. Start with the headline of the pre-roll you are cutting.';
export const NO_MATCH_NOTE = 'No copy matches this search. Clear it to see every row.';
