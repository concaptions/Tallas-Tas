import { copyStatusLabel, copyStatusTone, type ChipTone } from '@tas/domain/state';

import { emailCampaignsPath, emailFlowsPath, youtubeCopywritingPath } from '@/lib/routes';

import {
  copyNumberLabel,
  SELECTION_PARAM as YOUTUBE_COPY_SELECTION_PARAM,
} from '../youtube-copywriting/fields';
import type { CampaignFieldName } from './actions';

export type { CampaignFieldName };

export interface CampaignField {
  readonly name: CampaignFieldName;
  readonly label: string;
  readonly placeholder: string;
  readonly required: boolean;
  readonly type?: 'text' | 'date' | 'checkbox' | 'select' | 'textarea';
}

export interface CampaignFieldGroup {
  readonly heading: string;
  readonly fields: readonly CampaignField[];
}

export const CAMPAIGN_FIELD_GROUPS: readonly CampaignFieldGroup[] = [
  {
    heading: 'Name Components',
    fields: [
      { name: 'holiday', label: 'Holiday', placeholder: 'BFCM', required: false },
      {
        name: 'discountOffer',
        label: 'Discount Offer',
        placeholder: '20%OFF',
        required: false,
      },
      { name: 'code', label: 'Code', placeholder: 'BFCM26', required: false },
    ],
  },
  {
    heading: 'Campaign Details',
    fields: [
      {
        name: 'officialDate',
        label: 'Official Date',
        placeholder: '2026-11-27',
        required: false,
        type: 'date',
      },
      { name: 'country', label: 'Country', placeholder: 'US', required: false },
      {
        name: 'description',
        label: 'Description',
        placeholder: 'Campaign details and goals',
        required: false,
        type: 'textarea',
      },
    ],
  },
  {
    heading: 'Status',
    fields: [
      {
        name: 'confirmedByClient',
        label: 'Confirmed by Client',
        placeholder: '',
        required: false,
        type: 'checkbox',
      },
      {
        name: 'launched',
        label: 'Launched',
        placeholder: '',
        required: false,
        type: 'checkbox',
      },
    ],
  },
  {
    heading: 'Ads Schedule',
    fields: [
      {
        name: 'adsLaunchDate',
        label: 'Ads Launch Date',
        placeholder: '2026-11-20',
        required: false,
        type: 'date',
      },
      {
        name: 'adsEndDate',
        label: 'Ads End Date',
        placeholder: '2026-12-02',
        required: false,
        type: 'date',
      },
    ],
  },
  {
    heading: 'Linked Product',
    fields: [
      {
        name: 'productId',
        label: 'Product',
        placeholder: '',
        required: false,
        type: 'select',
      },
    ],
  },
];

export const EM_DASH = '—';
export const NOT_SET = 'Not set';

export function countLabel(total: number, visible: number): string {
  const noun = total === 1 ? 'campaign' : 'campaigns';
  return total === visible
    ? `${String(total)} ${noun}`
    : `${String(visible)} of ${String(total)} ${noun}`;
}

export function matchesCampaignSearch(
  campaign: { name: string; holiday: string | null; code: string | null; country: string | null },
  query: string,
): boolean {
  return [campaign.name, campaign.holiday ?? '', campaign.code ?? '', campaign.country ?? ''].some(
    (v) => v.toLowerCase().includes(query),
  );
}

export function formatDate(value: string | null): string {
  if (value === null) return EM_DASH;
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

// ── The other side of the campaign links (Airtable module parity, phase 2) ─────────────────────
//
// Email Campaigns, Email Flows and YouTube Copywriting each pick their campaigns from THEIR panel
// (`email_campaign_campaigns`, `email_flow_campaigns`, `youtube_copy_campaigns`). The campaign
// panel reads those junctions back the other way round, read-only, so a campaign can name what
// runs on it — the Airtable inverse fields "Email Campaigns", "Email Flows" and "COPY". The rows
// arrive through the sibling modules' sources (demo-aware), `page.tsx` inverts them with
// `indexByCampaign`, and the panel renders plain `LinkedRecord`s. Nothing here reads a database.

/** One record linked to a campaign from the other side of a junction, as the panel renders it. */
export interface LinkedRecord {
  readonly id: string;
  /** What the row is called on its own page: a typed name, or a generated title (`Copy 3 · …`). */
  readonly label: string;
  /** The other module's page, opened on this row. */
  readonly href?: string;
  /** A status beside the label, labelled and toned by `@tas/domain/state` before it reaches the UI. */
  readonly chip?: { readonly tone: ChipTone; readonly label: string };
}

/**
 * The URL parameters the sibling pages keep their open row in. Each is the key that module's
 * `syncUrl` writes; the YouTube one is exported by that module, the two email ones are literals
 * there, restated here so the campaign panel can deep-link into each page.
 */
export const EMAIL_CAMPAIGN_SELECTION_PARAM = 'emailCampaign';
export const EMAIL_FLOW_SELECTION_PARAM = 'email-flow';

export function emailCampaignHref(id: string): string {
  return `${emailCampaignsPath}?${EMAIL_CAMPAIGN_SELECTION_PARAM}=${encodeURIComponent(id)}`;
}

export function emailFlowHref(id: string): string {
  return `${emailFlowsPath}?${EMAIL_FLOW_SELECTION_PARAM}=${encodeURIComponent(id)}`;
}

export function youtubeCopyHref(id: string): string {
  return `${youtubeCopywritingPath}?${YOUTUBE_COPY_SELECTION_PARAM}=${encodeURIComponent(id)}`;
}

/**
 * `Copy 3 · Two Sleepers. One Bed.` — the generated title (`copyNumberLabel`, the one place it is
 * built) and the headline, or the title alone when the copy has no headline yet. Rendered in
 * `font-mono` because the title is system output.
 */
export function youtubeCopyLinkLabel(copyNumber: number, headline: string | null): string {
  const title = copyNumberLabel(copyNumber);
  const trimmed = headline?.trim() ?? '';
  return trimmed === '' ? title : `${title} · ${trimmed}`;
}

export function emailCampaignLink(row: {
  readonly id: string;
  readonly name: string;
}): LinkedRecord {
  return { id: row.id, label: row.name, href: emailCampaignHref(row.id) };
}

export function emailFlowLink(row: {
  readonly id: string;
  readonly flowName: string;
}): LinkedRecord {
  return { id: row.id, label: row.flowName, href: emailFlowHref(row.id) };
}

export function youtubeCopyLink(row: {
  readonly id: string;
  readonly copyNumber: number;
  readonly headline: string | null;
  readonly status: string;
}): LinkedRecord {
  return {
    id: row.id,
    label: youtubeCopyLinkLabel(row.copyNumber, row.headline),
    href: youtubeCopyHref(row.id),
    chip: { tone: copyStatusTone(row.status), label: copyStatusLabel(row.status) },
  };
}

/**
 * A many-to-many read from the far side: rows that each carry the campaign ids they link to,
 * inverted into `campaignId -> links` so the panel can list what points at the open campaign. Row
 * order is kept (every source arrives newest edit first), a campaign id repeated within one row
 * yields one link, and a campaign nothing links to has no key — the caller's `?? []` is the empty
 * state.
 */
export function indexByCampaign<Row>(
  rows: readonly Row[],
  campaignIdsOf: (row: Row) => readonly string[],
  toLink: (row: Row) => LinkedRecord,
): Record<string, LinkedRecord[]> {
  const index: Record<string, LinkedRecord[]> = {};
  for (const row of rows) {
    const campaignIds = new Set(campaignIdsOf(row));
    if (campaignIds.size === 0) continue;
    const link = toLink(row);
    for (const campaignId of campaignIds) {
      (index[campaignId] ??= []).push(link);
    }
  }
  return index;
}
