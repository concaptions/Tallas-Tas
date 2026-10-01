import type { EmailCampaignListRow, YoutubeCopyListRow } from '@tas/db';
import { copyStatusLabel, copyStatusTone, type ChipTone } from '@tas/domain/state';

import { emailCampaignsPath, youtubeCopywritingPath } from '@/lib/routes';

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
 * The two `*Links` functions at the bottom are the product's side of the Email Campaigns and YouTube
 * copy record links (the `email_campaign_products` and `youtube_copy_products` junctions). They
 * borrow the sibling modules' own presentation — the email status chip from `../email-campaigns/
 * fields` and the generated "Copy N" title from `../youtube-copywriting/fields` — rather than
 * restating either, so a record reads the same from both ends of its link.
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
