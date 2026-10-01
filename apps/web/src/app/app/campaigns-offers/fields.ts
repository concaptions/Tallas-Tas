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
