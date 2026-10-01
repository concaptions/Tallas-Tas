import { copyStatusLabel, copyStatusTone, type ChipTone } from '@tas/domain/state';
import type { CollectionListRow, EmailCampaignListRow, YoutubeCopyListRow } from '@tas/db';

import { emailCampaignsPath, youtubeCopywritingPath } from '@/lib/routes';

import { statusView } from '../email-campaigns/fields';
import {
  copyNumberLabel,
  SELECTION_PARAM as YOUTUBE_COPY_PARAM,
} from '../youtube-copywriting/fields';
import type { CollectionFieldName } from './actions';

/**
 * Field metadata and presentation helpers for the Collections table and panel. One module, so a
 * label, a placeholder or the dash an unset value renders as cannot drift between the table, the
 * panel and the Server Actions — the same shape `products/fields.ts` uses.
 *
 * `CollectionFieldName` is re-exported from `actions.ts` rather than declared a second time: the
 * actions own the union their zod schema validates, and a type-only re-export is erased at build
 * time, so this module stays importable from a client component.
 */
export type { CollectionFieldName };

export interface CollectionField {
  readonly name: CollectionFieldName;
  readonly label: string;
  readonly placeholder: string;
  /** Collections need only a name (CLAUDE.md §5 mirrors: statics can exist without a concept). */
  readonly required: boolean;
}

/** The panel renders exactly these, in this order. Relation fields take a uuid, not a name. */
export const COLLECTION_FIELDS: readonly CollectionField[] = [
  {
    name: 'name',
    label: 'Collection Name',
    placeholder: 'BFCM 2026 Collection',
    required: true,
  },
  {
    name: 'url',
    label: 'URL',
    placeholder: 'https://niagarasleep.com/collections/bfcm',
    required: false,
  },
  {
    name: 'campaignId',
    label: 'Campaign',
    placeholder: 'None',
    required: false,
  },
  {
    name: 'angleId',
    label: 'Angle ID',
    placeholder: 'Angle UUID',
    required: false,
  },
  {
    name: 'productId',
    label: 'Product ID',
    placeholder: 'Product UUID',
    required: false,
  },
  {
    name: 'creativeDesignNote',
    label: 'Creative Design Note',
    placeholder: 'High-energy reels with before/after footage',
    required: false,
  },
  {
    name: 'copywritingId',
    label: 'Copywriting ID',
    placeholder: 'Copywriting UUID',
    required: false,
  },
  {
    name: 'creativeDesign2Id',
    label: 'Creative Design 2 ID',
    placeholder: 'Creative brief UUID',
    required: false,
  },
];

/** The dash a null cell shows, so an optional relation or note is never an empty gap. */
export const EM_DASH = '—';
export const NOT_SET = 'Not set';

/** What the empty state says when there are no collections at all versus a search with no hits. */
export const NO_COLLECTIONS_HINT =
  'No collections yet. Group the campaign, angle and product a set of creatives is built around.';
export const NO_MATCHES_HINT_PREFIX = 'Nothing matches';

/** Why Upload CSV is inert: the import phase for this table has not shipped yet. */
export const UPLOAD_SOON_HINT = 'Bulk upload arrives with the CSV import phase.';

/**
 * The host of a link, for a table cell. A collection URL is long enough to break a compact column
 * on a phone, so the cell shows the host and carries the full URL in its `title`. A value that is
 * not a parseable URL is returned untouched — the strategist typed it, and the panel is where it
 * gets corrected.
 */
export function hostLabel(value: string | null): string | null {
  if (value === null || value.trim() === '') {
    return null;
  }
  try {
    return new URL(value).host.replace(/^www\./, '');
  } catch {
    return value;
  }
}

/**
 * Whether a collection matches a search term. Matches on the collection's own name and URL plus the
 * resolved relation names, never on raw ids — a strategist searches "BFCM" or "Reset Bundle", not a
 * uuid.
 */
export function matchesSearch(row: CollectionListRow, query: string): boolean {
  const haystack = [
    row.name,
    row.url ?? '',
    row.campaignName ?? '',
    row.angleName ?? '',
    row.productName ?? '',
  ];
  return haystack.some((value) => value.toLowerCase().includes(query));
}

/** The header/count line: "N collections" or "M of N collections" once a search narrows the list. */
export function countLabel(visible: number, total: number): string {
  if (visible === total) {
    return `${String(total)} ${total === 1 ? 'collection' : 'collections'}`;
  }
  return `${String(visible)} of ${String(total)} collections`;
}

/** Tone for a relation chip when a table cell wants to signal "linked" vs "not linked". */
export function relationTone(value: string | null): ChipTone {
  return value !== null ? 'info' : 'mute';
}

/**
 * One record that links TO a collection, as the panel's read-only "Linked work" lists render it:
 * what to call it, where it lives, and the status chip beside it. Plain data — the page builds
 * these on the server from the counterpart rows, the panel only renders them.
 */
export interface LinkedRecord {
  readonly id: string;
  readonly label: string;
  /** The counterpart's own page with its panel open on this record. */
  readonly href?: string;
  readonly chip?: { readonly label: string; readonly tone: ChipTone };
}

/** The parameter the Email Campaigns workspace reads its open row from (`?emailCampaign=`). */
const EMAIL_CAMPAIGN_PARAM = 'emailCampaign';

/** What each empty linked-work list says; the second sentence names where the link is made. */
export const NO_EMAIL_CAMPAIGNS_HINT =
  'No email campaign promotes this collection yet. Link one from the campaign’s panel.';
export const NO_YOUTUBE_COPY_HINT =
  'No YouTube copy is written for this collection yet. Link one from the copy’s panel.';

function push(
  index: Map<string, LinkedRecord[]>,
  collectionId: string,
  record: LinkedRecord,
): void {
  const existing = index.get(collectionId);
  if (existing === undefined) {
    index.set(collectionId, [record]);
  } else {
    existing.push(record);
  }
}

/**
 * The `email_campaign_collections` junction, inverted: every email campaign that links to a
 * collection, keyed by the collection's id and in the order the rows arrive (newest edit first).
 * The chip is the campaign's workflow status in the Email Campaigns route's own tones, so the two
 * pages never disagree about a colour.
 */
export function indexEmailCampaignsByCollection(
  rows: readonly EmailCampaignListRow[],
): ReadonlyMap<string, readonly LinkedRecord[]> {
  const index = new Map<string, LinkedRecord[]>();
  for (const row of rows) {
    const status = statusView(row.status);
    const record: LinkedRecord = {
      id: row.id,
      label: row.name,
      href: `${emailCampaignsPath}?${EMAIL_CAMPAIGN_PARAM}=${row.id}`,
      ...(status === null ? {} : { chip: { label: status.label, tone: status.tone } }),
    };
    for (const collectionId of row.collectionIds) {
      push(index, collectionId, record);
    }
  }
  return index;
}

/**
 * The `youtube_copy_collections` junction, inverted the same way. The label is the auto-generated
 * "Copy N" title (non-negotiable 6), so the panel renders it in `font-mono`, and the chip is the
 * shared `COPY_STATUS` label and tone.
 */
export function indexYoutubeCopyByCollection(
  rows: readonly YoutubeCopyListRow[],
): ReadonlyMap<string, readonly LinkedRecord[]> {
  const index = new Map<string, LinkedRecord[]>();
  for (const row of rows) {
    const record: LinkedRecord = {
      id: row.id,
      label: copyNumberLabel(row.copyNumber),
      href: `${youtubeCopywritingPath}?${YOUTUBE_COPY_PARAM}=${row.id}`,
      chip: { label: copyStatusLabel(row.status), tone: copyStatusTone(row.status) },
    };
    for (const { id: collectionId } of row.linkedCollections) {
      push(index, collectionId, record);
    }
  }
  return index;
}
