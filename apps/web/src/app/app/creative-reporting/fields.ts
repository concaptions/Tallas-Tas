import type { CreativeReportListRow } from '@tas/db';
import type { ChipTone } from '@tas/domain/state';

import { absoluteTime, relativeTime } from '@/lib/relative-time';

import type { CreativeReportFieldName } from './actions';

/**
 * The Creative Reporting vocabulary (Airtable "Creative Reporting", `tblgW4bwDSSeqihlr`; audit §2
 * row 14 and §14): the eleven stored columns plus the platform's brief link, grouped as the panel
 * shows them, and the presentation rules the grid, the panel and the Server Actions all read. One
 * module, so a label, a unit, a chip tone or the dash an unset value renders as cannot drift.
 *
 * The base's formula "Difference CPA" is not a field here: the query layer computes it and
 * `differenceCpaView` only decides how the number reads — ok at or under target, bad over it.
 *
 * `CreativeReportFieldName` is re-exported from `actions.ts` rather than declared a second time: the
 * actions own the union their zod schema validates. A type-only re-export is erased, so this module
 * stays importable from a client component.
 */
export type { CreativeReportFieldName };

export type CreativeReportFieldKind =
  | 'text'
  | 'textarea'
  | 'url'
  /** One `https://` URL per line; stored as a string array, the shape every attachment column uses. */
  | 'urlList'
  /** A single Select over the brand's briefs; stores the brief id. */
  | 'brief'
  /** A number input. `scale` is the column's decimal places and the input's step. */
  | 'number';

export interface CreativeReportField {
  readonly name: CreativeReportFieldName;
  readonly label: string;
  readonly placeholder: string;
  readonly required: boolean;
  readonly kind: CreativeReportFieldKind;
  /** Number fields only: decimal places (the column scale, and the input's `step`). */
  readonly scale?: number;
  /** Number fields only: the unit shown beside the input. */
  readonly unit?: string;
}

export interface CreativeReportFieldGroup {
  readonly heading: string;
  readonly fields: readonly CreativeReportField[];
}

/** The panel renders exactly these groups, in this order. */
export const CREATIVE_REPORT_FIELD_GROUPS: readonly CreativeReportFieldGroup[] = [
  {
    heading: 'Report',
    fields: [
      {
        name: 'nameAngleOffer',
        label: 'Name + Angle + Offer',
        placeholder: 'Body Clock V1 — Shift Worker — 90-Night Trial',
        required: true,
        kind: 'text',
      },
      { name: 'briefId', label: 'Creative', placeholder: '', required: false, kind: 'brief' },
      {
        name: 'notes',
        label: 'Notes',
        placeholder: 'What the numbers say and what to do about it',
        required: false,
        kind: 'textarea',
      },
    ],
  },
  {
    heading: 'Ad',
    fields: [
      {
        name: 'adDesign',
        label: 'Ad Design',
        placeholder: 'One file URL per line',
        required: false,
        kind: 'urlList',
      },
      {
        name: 'adLink',
        label: 'Ad Link',
        placeholder: 'https://www.facebook.com/ads/library/?id=…',
        required: false,
        kind: 'url',
      },
    ],
  },
  {
    heading: 'Engagement',
    fields: [
      {
        name: 'ctr',
        label: 'CTR',
        placeholder: '4.12',
        required: false,
        kind: 'number',
        scale: 2,
        unit: '%',
      },
      {
        name: 'thumbStopRate',
        label: 'Thumb-Stop Rate',
        placeholder: '31.50',
        required: false,
        kind: 'number',
        scale: 2,
        unit: '%',
      },
      {
        name: 'results',
        label: 'Results',
        placeholder: '184',
        required: false,
        kind: 'number',
        scale: 1,
      },
    ],
  },
  {
    heading: 'Cost & return',
    fields: [
      {
        name: 'cpa',
        label: 'CPA',
        placeholder: '24.50',
        required: false,
        kind: 'number',
        scale: 2,
        unit: 'USD',
      },
      {
        name: 'targetCpa',
        label: 'Target CPA',
        placeholder: '22.00',
        required: false,
        kind: 'number',
        scale: 2,
        unit: 'USD',
      },
      {
        name: 'roas',
        label: 'ROAS',
        placeholder: '3.40',
        required: false,
        kind: 'number',
        scale: 2,
        unit: 'x',
      },
      {
        name: 'targetRoas',
        label: 'Target ROAS',
        placeholder: '3.0',
        required: false,
        kind: 'number',
        scale: 1,
        unit: 'x',
      },
    ],
  },
];

/** Every stored field, flattened; the Server Actions read the form by this list. */
export const CREATIVE_REPORT_FIELDS: readonly CreativeReportField[] =
  CREATIVE_REPORT_FIELD_GROUPS.flatMap((group) => group.fields);

/** The dash a null cell shows, so an unset value is never an empty gap. */
export const EM_DASH = '—';
export const NOT_SET = 'Not set';

/**
 * CTR is stored as a FRACTION (`0.0412`), the Airtable API's shape for a percent field, but a media
 * buyer reads and types a PERCENT (`4.12`). These two are the only conversion between the two,
 * used by the panel's input and by the Server Action's parser.
 */
export function ctrToPercentText(ctr: string | null): string {
  if (ctr === null) return '';
  const value = Number(ctr) * 100;
  return Number.isFinite(value) ? (Math.round(value * 100) / 100).toString() : '';
}

/** A typed percent (`4.12`) as the stored fraction at the column's scale (`0.0412`). */
export function percentTextToCtr(percent: string): string | null {
  const trimmed = percent.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  return (value / 100).toFixed(4);
}

/** A `numeric` column at a fixed number of decimals, or the dash. */
export function formatNumber(value: string | null, digits: number): string {
  if (value === null) return EM_DASH;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : value;
}

/** A stored CTR fraction as a percent, two places: `0.0412` → `4.12%`. */
export function formatCtr(ctr: string | null): string {
  if (ctr === null) return EM_DASH;
  const parsed = Number(ctr);
  return Number.isFinite(parsed) ? `${(parsed * 100).toFixed(2)}%` : ctr;
}

/** A rate the base keeps as a plain number (thumb-stop), shown as a percent with two places. */
export function formatRate(value: string | null): string {
  return value === null ? EM_DASH : `${formatNumber(value, 2)}%`;
}

/** A currency column: `24.5` → `$24.50`. */
export function formatCurrency(value: string | null): string {
  return value === null ? EM_DASH : `$${formatNumber(value, 2)}`;
}

/** A return multiple: `3.4` → `3.40x`; the target keeps the base's single decimal. */
export function formatRoas(value: string | null, digits = 2): string {
  return value === null ? EM_DASH : `${formatNumber(value, digits)}x`;
}

/** The difference formula as a chip: label with its sign, ok at or under target, bad over it. */
export interface DifferenceCpaView {
  readonly label: string;
  readonly tone: ChipTone;
}

export function differenceCpaView(difference: number | null): DifferenceCpaView | null {
  if (difference === null) return null;
  const magnitude = `$${Math.abs(difference).toFixed(2)}`;
  const label = difference > 0 ? `+${magnitude}` : difference < 0 ? `−${magnitude}` : magnitude;
  return { label, tone: difference <= 0 ? 'ok' : 'bad' };
}

/** The host of a link, for a grid cell; the full URL goes in the cell's `title`. */
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

/** A stored URL list as the textarea shows it: one URL per line. */
export function urlListText(list: readonly string[] | null): string {
  return list === null ? '' : list.join('\n');
}

export function countLabel(total: number, visible: number): string {
  const noun = total === 1 ? 'report' : 'reports';
  return total === visible
    ? `${String(total)} ${noun}`
    : `${String(visible)} of ${String(total)} ${noun}`;
}

/** The search reads what the grid shows: the name, the brief, the notes and the ad link. */
export function matchesCreativeReportSearch(
  row: Pick<CreativeReportListRow, 'nameAngleOffer' | 'briefName' | 'notes' | 'adLink'>,
  query: string,
): boolean {
  return [row.nameAngleOffer, row.briefName ?? '', row.notes ?? '', row.adLink ?? ''].some(
    (value) => value.toLowerCase().includes(query),
  );
}

/** One grid row: the record plus the strings the server formats once, so the client never does. */
export interface CreativeReportItem {
  readonly row: CreativeReportListRow;
  readonly updatedLabel: string;
  readonly updatedTitle: string;
  /** The ad link's host, or null when unset; the full URL is the cell's `title`. */
  readonly adLinkHost: string | null;
  readonly ctrLabel: string;
  readonly thumbStopLabel: string;
  readonly resultsLabel: string;
  readonly cpaLabel: string;
  readonly targetCpaLabel: string;
  readonly roasLabel: string;
  readonly targetRoasLabel: string;
  readonly differenceCpa: DifferenceCpaView | null;
}

export function toCreativeReportItem(row: CreativeReportListRow, now: Date): CreativeReportItem {
  return {
    row,
    updatedLabel: relativeTime(row.updatedAt, now),
    updatedTitle: absoluteTime(row.updatedAt),
    adLinkHost: hostLabel(row.adLink),
    ctrLabel: formatCtr(row.ctr),
    thumbStopLabel: formatRate(row.thumbStopRate),
    resultsLabel: formatNumber(row.results, 0),
    cpaLabel: formatCurrency(row.cpa),
    targetCpaLabel: formatCurrency(row.targetCpa),
    roasLabel: formatRoas(row.roas),
    targetRoasLabel: formatRoas(row.targetRoas, 1),
    differenceCpa: differenceCpaView(row.differenceCpa),
  };
}
