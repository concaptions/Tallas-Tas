import type { CreativeDimensionFieldName } from './actions';

/**
 * The four Creative Dimensions fields and the presentation rules the table and the panel both read.
 * One module, so a label, a placeholder or the dash an unset value renders as cannot drift between
 * them.
 *
 * `CreativeDimensionFieldName` is re-exported from `actions.ts` rather than declared a second time
 * here: the actions own the union their zod schema validates, and two declarations would eventually
 * disagree. A type-only re-export is erased, so this module stays importable from a client
 * component.
 */
export type { CreativeDimensionFieldName };

export interface CreativeDimensionField {
  readonly name: CreativeDimensionFieldName;
  readonly label: string;
  readonly placeholder: string;
  readonly required: boolean;
}

/** The panel renders exactly these four, in this order, and nothing else is editable. */
export const CREATIVE_DIMENSION_FIELDS: readonly CreativeDimensionField[] = [
  {
    name: 'name',
    label: 'Name',
    placeholder: 'IG Story / Reel',
    required: true,
  },
  {
    name: 'dimensions',
    label: 'Dimensions',
    placeholder: '1080x1920',
    required: false,
  },
  {
    name: 'linkDescription',
    label: 'Link Description',
    placeholder: 'Story',
    required: false,
  },
  {
    name: 'creativeDesignId',
    label: 'Creative Design ID',
    placeholder: 'Linked creative brief id',
    required: false,
  },
];

/** The dash a null cell shows, so an optional field is never an empty gap. */
export const EM_DASH = '—';
export const NOT_SET = 'Not set';

/** The empty state and hint strings, stated once so the table and the panel agree. */
export const EMPTY_TABLE_TEXT = 'No creative dimensions yet. Start with the sizes you export to.';
export const EMPTY_SEARCH_TEXT_PREFIX = 'Nothing matches';
export const EMPTY_SEARCH_HINT = 'Try a name or a dimension like 1080x1920.';

/** What the count label reads, singular or plural, and whether it is filtered. */
export function countLabel(visible: number, total: number): string {
  if (visible === total) {
    return `${String(total)} ${total === 1 ? 'creative dimension' : 'creative dimensions'}`;
  }
  return `${String(visible)} of ${String(total)} creative dimensions`;
}

/** The filter reads what is on the row: its name, its dimensions and its link description. */
export function matchesQuery(
  row: { name: string; dimensions: string | null; linkDescription: string | null },
  query: string,
): boolean {
  return [row.name, row.dimensions ?? '', row.linkDescription ?? ''].some((value) =>
    value.toLowerCase().includes(query),
  );
}
