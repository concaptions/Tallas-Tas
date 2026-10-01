import { copyTitle } from '@tas/domain/copy';
import {
  copyStatusLabel,
  copyStatusTone,
  type ChipTone,
  type CreativeTrack,
  type InternalStatusKey,
} from '@tas/domain/state';
import type {
  CollectionListRow,
  CopyListRow,
  EmailCampaignListRow,
  YoutubeCopyListRow,
} from '@tas/db';

import {
  briefPath,
  conceptPath,
  emailCampaignsPath,
  metaCopywritingPath,
  youtubeCopywritingPath,
} from '@/lib/routes';

import { internalStatusView as conceptInternalStatusView } from '../concepts/fields';
import { internalStatusView as briefInternalStatusView } from '../creative-design/fields';
import { statusView } from '../email-campaigns/fields';
import { SELECTION_PARAM as META_COPY_PARAM } from '../meta-copywriting/fields';
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
/**
 * A brief's collection is `creative_briefs.collection_id`, which no form sets yet (the brief detail
 * reads it, the import writes it), so this sentence names no panel to go to.
 */
export const NO_CREATIVE_DESIGNS_HINT = 'No creative design is briefed on this collection yet.';
/**
 * A concept's collections are the `concept_collections` junction, which no form sets yet (the
 * import writes it), so this sentence names no panel to go to either.
 */
export const NO_CONCEPTS_HINT = 'No concept is built on this collection yet.';
/** The Meta copy IS the Copywriting ID field of this panel, so the link is made right here. */
export const NO_META_COPY_HINT =
  'No Meta copy is linked to this collection yet. Set the Copywriting ID above.';

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

/**
 * The minimum a brief row has to carry to be listed on a collection: the FK that makes it a reverse
 * link, the generated §7 name, and its internal status already narrowed to a key of its own track
 * by `loadBriefs` (`BriefRow` in `@/lib/briefs-source`). Structural, so nothing is re-narrowed here
 * and the fixtures a test builds need no more than these five fields.
 */
export interface CreativeDesignSource {
  readonly id: string;
  readonly name: string;
  readonly collectionId: string | null;
  readonly track: CreativeTrack;
  readonly internalStatus: InternalStatusKey;
}

/**
 * `creative_briefs.collection_id`, inverted: every brief briefed on a collection, keyed by the
 * collection's id and in the rows' order (newest edit first). The label is the brief's
 * auto-generated name (non-negotiable 6; the panel renders it in `font-mono`), the link is the
 * brief's own detail route, and the chip is the Creative Design module's `internalStatusView` on
 * the brief's track, so a static and a video read their status exactly as they do on their page.
 * A brief with no collection is in no list.
 */
export function indexCreativeDesignsByCollection(
  rows: readonly CreativeDesignSource[],
): ReadonlyMap<string, readonly LinkedRecord[]> {
  const index = new Map<string, LinkedRecord[]>();
  for (const row of rows) {
    if (row.collectionId === null) continue;
    const status = briefInternalStatusView(row.track, row.internalStatus);
    push(index, row.collectionId, {
      id: row.id,
      label: row.name,
      href: briefPath(row.id),
      chip: { label: status.label, tone: status.tone },
    });
  }
  return index;
}

/**
 * The minimum a concept row has to carry to be listed on a collection: the junction ids that make
 * it a reverse link, the generated Batch-Angle-Theme name, and its internal status already narrowed
 * to a key by `loadConcepts` (`ConceptRow` in `@/lib/concepts-source`). Structural, so nothing is
 * re-narrowed here and the fixtures a test builds need no more than these four fields.
 */
export interface ConceptSource {
  readonly id: string;
  readonly name: string;
  readonly collectionIds: readonly string[];
  readonly internalStatus: InternalStatusKey;
}

/**
 * The `concept_collections` junction, inverted: every concept linked to a collection, keyed by the
 * collection's id and in the rows' order (newest edit first). The label is the concept's generated
 * Batch-Angle-Theme name (non-negotiable 6; the panel renders it in `font-mono`), the link is the
 * concept's own detail route, and the chip is the Concepts module's `internalStatusView` on the
 * track concepts run on. The track is a parameter rather than an import because `CONCEPT_TRACK`
 * lives in `@/lib/concepts-source` next to `@tas/db`, which this client-importable module must not
 * reach; the page reads it once and hands it in, exactly as the Concepts page does.
 */
export function indexConceptsByCollection(
  rows: readonly ConceptSource[],
  track: CreativeTrack,
): ReadonlyMap<string, readonly LinkedRecord[]> {
  const index = new Map<string, LinkedRecord[]>();
  for (const row of rows) {
    const status = conceptInternalStatusView(track, row.internalStatus);
    const record: LinkedRecord = {
      id: row.id,
      label: row.name,
      href: conceptPath(row.id),
      chip: { label: status.label, tone: status.tone },
    };
    for (const collectionId of row.collectionIds) {
      push(index, collectionId, record);
    }
  }
  return index;
}

/**
 * The Meta Copywriting row `collections.copywriting_id` points at, as one read-only record, or
 * `null` when the collection has none — or when the id resolves to no row of the brand, which the
 * scoped `listCopy` makes the same outcome as no link at all. The label is the auto-generated
 * `copyTitle` (non-negotiable 6, rendered in `font-mono`), the link opens the Meta Copywriting
 * panel by its own parameter, and the chip is the shared `COPY_STATUS` label and tone.
 */
export function metaCopyLink(
  copywritingId: string | null,
  rows: readonly CopyListRow[],
): LinkedRecord | null {
  if (copywritingId === null) return null;
  const row = rows.find((candidate) => candidate.id === copywritingId);
  if (row === undefined) return null;
  return {
    id: row.id,
    label: copyTitle(row.copyNumber),
    href: `${metaCopywritingPath}?${META_COPY_PARAM}=${row.id}`,
    chip: { label: copyStatusLabel(row.status), tone: copyStatusTone(row.status) },
  };
}
