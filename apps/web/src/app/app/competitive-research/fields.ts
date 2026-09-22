import type { ChipTone } from '@tas/domain/state';

import type { CompetitiveResearchFieldName } from './actions';

/**
 * The seven Competitive Research fields (Airtable parity: Name, Type, Website, Insta, FB Page,
 * Meta Ads Library, Analysis) and the presentation rules the table, the panel and the Server Actions
 * all read. One module, so a label, a placeholder or the dash an unset value renders as cannot drift
 * between them — the same discipline `products/fields.ts` and `personas/fields.ts` use.
 *
 * `CompetitiveResearchFieldName` is re-exported from `actions.ts` rather than declared a second time
 * here: the actions own the union their zod schema validates, and two declarations would eventually
 * disagree. A type-only re-export is erased, so this module stays importable from a client component.
 */
export type { CompetitiveResearchFieldName };

export interface CompetitiveResearchField {
  readonly name: CompetitiveResearchFieldName;
  readonly label: string;
  readonly placeholder: string;
  readonly kind: 'input' | 'select' | 'textarea';
  readonly required: boolean;
}

export interface CompetitiveResearchFieldGroup {
  readonly heading: string;
  readonly fields: readonly CompetitiveResearchField[];
}

/** `type` is presented as a select, but the column is plain text — free entry stays possible. */
export const COMPETITIVE_RESEARCH_TYPE_OPTIONS: readonly string[] = [
  'Direct Competitor',
  'Indirect Competitor',
  'Aspirational Competitor',
  'Adjacent Market',
];

/** The two headings the panel renders, in this order, and nothing else is editable. */
export const COMPETITIVE_RESEARCH_FIELD_GROUPS: readonly CompetitiveResearchFieldGroup[] = [
  {
    heading: 'Competitor',
    fields: [
      { name: 'name', label: 'Name', placeholder: 'Casper Sleep', kind: 'input', required: true },
      { name: 'type', label: 'Type', placeholder: 'Not set', kind: 'select', required: false },
      {
        name: 'website',
        label: 'Website',
        placeholder: 'https://casper.com',
        kind: 'input',
        required: false,
      },
      {
        name: 'instagram',
        label: 'Instagram',
        placeholder: '@casper',
        kind: 'input',
        required: false,
      },
      {
        name: 'facebookPage',
        label: 'Facebook Page',
        placeholder: 'https://facebook.com/casper',
        kind: 'input',
        required: false,
      },
    ],
  },
  {
    heading: 'Research',
    fields: [
      {
        name: 'metaAdsLibrary',
        label: 'Meta Ads Library',
        placeholder: 'What their active ads look like — format, volume, angle.',
        kind: 'textarea',
        required: false,
      },
      {
        name: 'analysis',
        label: 'Analysis',
        placeholder: 'What we take from this — the opening it leaves us.',
        kind: 'textarea',
        required: false,
      },
    ],
  },
];

/** Every field, flattened; the Server Actions' zod schema is built from this list. */
export const COMPETITIVE_RESEARCH_FIELDS: readonly CompetitiveResearchField[] =
  COMPETITIVE_RESEARCH_FIELD_GROUPS.flatMap((group) => group.fields);

/** The columns the table renders, in order. The workspace maps this list; it does not hardcode it. */
export interface CompetitiveResearchColumn {
  readonly key: 'name' | 'type' | 'website' | 'instagram' | 'updated';
  readonly label: string;
}

export const COMPETITIVE_RESEARCH_COLUMNS: readonly CompetitiveResearchColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'website', label: 'Website' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'updated', label: 'Updated' },
];

/** The dash a null cell shows, so an unset field is never a blank gap. */
export const EM_DASH = '—';
export const NOT_SET = 'Not set';

/** Copy for the two shapes the table's empty state can take. */
export const EMPTY_NO_ROWS = 'No competitors yet. Start with the brand you get compared to most.';
export const EMPTY_NO_MATCH_PREFIX = 'Nothing matches';
export const EMPTY_NO_MATCH_HINT = 'Try a competitor name, a type or a domain.';

/** Why Upload CSV is inert outside demo mode: the import phase has not shipped yet. */
export const UPLOAD_SOON_HINT = 'Bulk upload arrives with the CSV import phase.';

/** What the demo footer says instead of offering a save. */
export const DEMO_FOOTER_NOTICE = 'Demo mode — changes are not saved';

/**
 * The host of a link, for a table cell. A website URL is long enough to break a narrow column, so
 * the cell shows the host and carries the full URL in its `title`. A value that is not a parseable
 * URL is returned untouched rather than hidden — the strategist typed it, and the panel is where it
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

/** The tone a competitor `type` chip takes. Direct competitors read as the most urgent to watch. */
export function typeTone(type: string | null): ChipTone {
  if (type === 'Direct Competitor') return 'warn';
  if (type === 'Indirect Competitor') return 'info';
  return 'mute';
}

/**
 * The search/filter helper: matches a row's name, type, website, Instagram handle or Facebook page
 * against a lowercased query. Shared by the workspace so the table and any future CSV export agree
 * on what "search" means.
 */
export function matchesQuery(
  row: {
    readonly name: string;
    readonly type: string | null;
    readonly website: string | null;
    readonly instagram: string | null;
    readonly facebookPage: string | null;
  },
  query: string,
): boolean {
  if (query === '') return true;
  const haystack = [row.name, row.type, row.website, row.instagram, row.facebookPage]
    .filter((value): value is string => value !== null)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

/** The row count the header shows, whether or not a filter has narrowed the table. */
export function countLabel(visible: number, total: number): string {
  if (visible === total) {
    return `${String(total)} ${total === 1 ? 'competitor' : 'competitors'}`;
  }
  return `${String(visible)} of ${String(total)} competitors`;
}
