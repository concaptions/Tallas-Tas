import type { CreatorListRow, EmailCampaignListRow, YoutubeCopyListRow } from '@tas/db';
import {
  copyStatusLabel,
  copyStatusTone,
  creatorInternalStatusLabel,
  creatorInternalStatusTone,
  type ChipTone,
  type CreativeTrack,
  type InternalStatusKey,
} from '@tas/domain/state';

import { briefPath, emailCampaignsPath, ugcPath, youtubeCopywritingPath } from '@/lib/routes';

import { internalStatusView as briefInternalStatusView } from '../creative-design/fields';
import { statusView as emailCampaignStatusView } from '../email-campaigns/fields';
import {
  copyNumberLabel,
  SELECTION_PARAM as YOUTUBE_COPY_PARAM,
} from '../youtube-copywriting/fields';
import type { ProductFieldName } from './actions';

/**
 * The three writable PRD §5.1 product fields and the presentation rules the table, the panel and the
 * Server Actions all read. One module, so a label, a placeholder, the dash an unset value renders as
 * or the way a long URL is shortened cannot drift between them.
 *
 * `ProductFieldName` is re-exported from `actions.ts` rather than declared a second time here: the
 * actions own the union their zod schema validates, and two declarations would eventually disagree.
 * A type-only re-export is erased, so this module stays importable from a client component.
 *
 * The four `*Links` functions at the bottom are the product's side of its record links: the Email
 * Campaigns and YouTube copy junctions (`email_campaign_products`, `youtube_copy_products`), the
 * briefs whose `creative_briefs.product_id` is the product, and the creators booked for it through
 * `creator_products`. They borrow the sibling modules' own presentation — the email status chip from
 * `../email-campaigns/fields`, the generated "Copy N" title from `../youtube-copywriting/fields`,
 * the brief's internal status on its own track from `../creative-design/fields` — rather than
 * restating any of it, so a record reads the same from both ends of its link.
 */
export type { ProductFieldName };

export interface ProductField {
  readonly name: ProductFieldName;
  readonly label: string;
  readonly placeholder: string;
  /** PRD §5.1: a product needs a name and a landing page link; the collection link is optional. */
  readonly required: boolean;
}

/** The panel renders exactly these three, in this order, and nothing else is editable. */
export const PRODUCT_FIELDS: readonly ProductField[] = [
  {
    name: 'name',
    label: 'Product Name',
    placeholder: 'Niagara Deep Sleep Weighted Blanket',
    required: true,
  },
  {
    name: 'link',
    label: 'Landing Page URL',
    placeholder: 'https://niagarasleep.example/products/deep-sleep-weighted-blanket',
    required: true,
  },
  {
    name: 'collectionLink',
    label: 'Collection Link',
    placeholder: 'https://niagarasleep.example/collections/sleep-essentials',
    required: false,
  },
];

/** The dash a null cell shows, so an optional collection link is never an empty gap. */
export const EM_DASH = '—';
export const NOT_SET = 'Not set';

/**
 * The host of a link, for a table cell. A landing page URL is long enough to break a four-column
 * layout on a phone, so the cell shows the host and carries the full URL in its `title`. A value
 * that is not a parseable URL is returned untouched rather than hidden — the strategist typed it,
 * and the panel is where it gets corrected.
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
 * The linked-concepts chip. This is a COUNT, not a status: the Products table has no status of its
 * own (ticket criterion 11) and must not invent one, so nothing here comes from `@tas/domain/state`
 * except the tone union the shared `StatusChip` takes. Zero is rendered, never blanked.
 */
export function conceptCountLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'concept' : 'concepts'}`;
}

export function conceptCountTone(count: number): ChipTone {
  return count > 0 ? 'info' : 'mute';
}

/**
 * One record another module links to this product, as the panel's read-only lists render it. Plain
 * data on purpose: the page builds these on the server from the junction rows, and the client panel
 * only maps them to a link and a chip. `href` opens the record on its own page with its panel open;
 * `chip` is the record's status as the shared `StatusChip` shows it, absent when the record has none.
 */
export interface LinkedRecord {
  readonly id: string;
  readonly label: string;
  readonly href?: string;
  readonly chip?: { readonly label: string; readonly tone: ChipTone };
}

/**
 * The query parameter the Email Campaigns page opens a row from (`params.emailCampaign` in
 * `../email-campaigns/page.tsx`); the module keeps it as a private union, so it is named here.
 */
const EMAIL_CAMPAIGN_PARAM = 'emailCampaign';

/**
 * The email campaigns that promote this product — the other side of the `email_campaign_products`
 * junction, read off each campaign's `productIds`. In the rows' order, which is newest edit first
 * as the source returns them. The chip is the Email Campaigns module's own `statusView`, so the
 * status reads here exactly as it reads there; a campaign with no status gets no chip, never a
 * blank one.
 */
export function emailCampaignLinks(
  productId: string,
  rows: readonly EmailCampaignListRow[],
): LinkedRecord[] {
  return rows
    .filter((row) => row.productIds.includes(productId))
    .map((row) => {
      const status = emailCampaignStatusView(row.status);
      const record: LinkedRecord = {
        id: row.id,
        label: row.name,
        href: `${emailCampaignsPath}?${EMAIL_CAMPAIGN_PARAM}=${encodeURIComponent(row.id)}`,
      };
      return status === null
        ? record
        : { ...record, chip: { label: status.label, tone: status.tone } };
    });
}

/**
 * The YouTube copy written for this product — the other side of the `youtube_copy_products`
 * junction, read off each row's `linkedProducts`. The label is the generated "Copy N" title from
 * the YouTube module's `copyNumberLabel` (never typed; the panel renders it in `font-mono`), and the
 * chip is the row's `COPY_STATUS` entry from `@tas/domain/state`. Same order rule as the campaigns.
 */
export function youtubeCopyLinks(
  productId: string,
  rows: readonly YoutubeCopyListRow[],
): LinkedRecord[] {
  return rows
    .filter((row) => row.linkedProducts.some((product) => product.id === productId))
    .map((row) => ({
      id: row.id,
      label: copyNumberLabel(row.copyNumber),
      href: `${youtubeCopywritingPath}?${YOUTUBE_COPY_PARAM}=${encodeURIComponent(row.id)}`,
      chip: { label: copyStatusLabel(row.status), tone: copyStatusTone(row.status) },
    }));
}

/**
 * The minimum a brief row has to carry to be listed on a product: the FK that makes it a reverse
 * link, the generated §7 name, and its internal status already narrowed to a key of its own track
 * by `loadBriefs` (`BriefRow` in `@/lib/briefs-source`). Structural, so nothing is re-narrowed here
 * and the fixtures a test builds need no more than these five fields.
 */
export interface CreativeDesignSource {
  readonly id: string;
  readonly name: string;
  readonly productId: string | null;
  readonly track: CreativeTrack;
  readonly internalStatus: InternalStatusKey;
}

/**
 * The creative designs briefed on this product — the reverse of `creative_briefs.product_id`, in
 * the rows' order (newest edit first, as `loadBriefs` returns them). The label is the brief's
 * auto-generated name (non-negotiable 6; the panel renders it in `font-mono`), the link is the
 * brief's own detail route, and the chip is the Creative Design module's `internalStatusView` on
 * the brief's track, so a static and a video read their status exactly as they do on their page.
 */
export function creativeDesignLinks(
  productId: string,
  rows: readonly CreativeDesignSource[],
): LinkedRecord[] {
  return rows
    .filter((row) => row.productId === productId)
    .map((row) => {
      const status = briefInternalStatusView(row.track, row.internalStatus);
      return {
        id: row.id,
        label: row.name,
        href: briefPath(row.id),
        chip: { label: status.label, tone: status.tone },
      };
    });
}

/**
 * The query parameter the UGC page opens a creator from (`params.creator` in `../ugc/page.tsx`);
 * the module keeps it as a literal in its workspace, so it is named here.
 */
const CREATOR_PARAM = 'creator';

/**
 * The creators booked for this product — the other side of the `creator_products` junction, read
 * off each creator's `productIds`, which `listCreators` fills from that junction. In the rows'
 * order. The chip is the creator's INTERNAL track (the first of the three PRD §5.8 tracks, the one
 * the UGC card leads with), labelled and toned by `@tas/domain/state`: this panel is team-only, so
 * the team's own review is the status that matters here.
 */
export function creatorLinks(productId: string, rows: readonly CreatorListRow[]): LinkedRecord[] {
  return rows
    .filter((row) => row.productIds.includes(productId))
    .map((row) => ({
      id: row.id,
      label: row.name,
      href: creatorHref(row.id),
      chip: creatorChip(row),
    }));
}

/** Where a creator lives: the UGC page with its panel open on that row. */
function creatorHref(id: string): string {
  return `${ugcPath}?${CREATOR_PARAM}=${encodeURIComponent(id)}`;
}

function creatorChip(row: CreatorListRow): { label: string; tone: ChipTone } {
  return {
    label: creatorInternalStatusLabel(row.internalCreatorStatus),
    tone: creatorInternalStatusTone(row.internalCreatorStatus),
  };
}

/** One creator as the Creators link field offers it: the name, its route and its own status. */
export interface CreatorOption {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  readonly chip: { readonly label: string; readonly tone: ChipTone };
}

/**
 * EVERY creator of the brand, as the Creators link field's options — a picker has to offer the ones
 * this product has NOT booked yet, which `creatorLinks` by definition leaves out. Each option
 * carries the same route and the same internal-track chip, so a booked creator reads in the field
 * exactly as it read in the read-only list the field replaced.
 */
export function creatorOptions(rows: readonly CreatorListRow[]): CreatorOption[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    href: creatorHref(row.id),
    chip: creatorChip(row),
  }));
}
