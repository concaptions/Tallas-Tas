import {
  ANGLE_FORMATS,
  ANGLE_TYPES,
  angleFormatEntries,
  angleTypeEntries,
  type AngleFormatEntry,
  type AngleTypeEntry,
  type InspoLinkKind,
} from '@tas/domain/angles';
import type { ChipTone } from '@tas/domain/state';

import type { AngleFieldName } from './actions';

/**
 * How the Angles route presents what it stores (PRD §5.6). One module, so the table, the panel and
 * the `/design-system` preview cannot drift: the label a strategist reads, the tone each chip
 * carries, how many format chips fit on a row before they collapse, and how a long linked name is
 * shortened are all stated exactly once.
 *
 * Nothing here invents a vocabulary. `ANGLE_FORMATS` and `ANGLE_TYPES` come from
 * `@tas/domain/angles` (which mirrors the `angleFormats` / `angleTypes` pg enums verbatim), so no
 * component writes `'Static'` or `'Emotional'`, exactly as no component writes a status string.
 * `AngleFieldName` is re-exported from `actions.ts` rather than declared a second time: the actions
 * own the union their zod schema validates. A type-only re-export is erased, so this module stays
 * importable from a client component.
 *
 * `@tas/db` is deliberately absent: the panel is a client component, and a runtime import of that
 * package would drag the database driver into the browser bundle.
 */
export type { AngleFieldName };
export { ANGLE_FORMATS, ANGLE_TYPES, angleFormatEntries, angleTypeEntries };
export type { AngleFormatEntry, AngleTypeEntry };

/** The dash an unlinked row or an empty array shows, so a blank cell is never just a gap. */
export const EM_DASH = '—';
export const NOT_SET = 'Not set';

/** The "None" option of a nullable dropdown. Its value is `''`, which the action stores as NULL. */
export const NONE_OPTION_LABEL = 'None';

/** The `<select>` value that means "no link". Empty, never the string `'none'`. */
export const NONE_VALUE = '';

/** The tone each linked table chip carries. Stated once so the table and the preview agree. */
export const PERSONA_CHIP_TONE: ChipTone = 'info';
export const PRODUCT_CHIP_TONE: ChipTone = 'mute';
export const FORMAT_CHIP_TONE: ChipTone = 'accent';

/**
 * How many format chips a table row shows before the rest collapse into `+N`. Three is what fits
 * beside four other columns on a phone without the row wrapping to a second line.
 */
export const MAX_ROW_FORMATS = 3;

export interface FormatChipRow {
  readonly shown: readonly AngleFormatEntry[];
  /** How many selected formats are not shown; `0` when they all fit. */
  readonly overflow: number;
}

/**
 * The format chips of one table row: always in `ANGLE_FORMATS` order, never more than
 * `MAX_ROW_FORMATS` of them, with the remainder counted rather than dropped.
 */
export function formatChipRow(formats: readonly string[]): FormatChipRow {
  const entries = angleFormatEntries(formats);
  return {
    shown: entries.slice(0, MAX_ROW_FORMATS),
    overflow: Math.max(entries.length - MAX_ROW_FORMATS, 0),
  };
}

/** The `+N` chip's label. Separate from the count so the table never builds a string inline. */
export function overflowLabel(overflow: number): string {
  return `+${String(overflow)}`;
}

/**
 * The chip form of a linked row's name. The seeded personas are written as
 * `Denise — peri-menopausal, awake at 3am with night sweats`: the half before the em dash is the
 * name, and the half after it is the research. A chip shows the first half and the cell carries the
 * whole string in its `title`, so nothing is lost and no row is 60 characters wide.
 */
export function chipLabel(value: string): string {
  const [head] = value.split(` ${EM_DASH} `);
  const trimmed = (head ?? value).trim();
  return trimmed === '' ? value.trim() : trimmed;
}

/** The short source name on an ad-inspiration card. `parseInspoLink` owns which kind a URL is. */
const INSPO_SOURCE_LABELS: Record<InspoLinkKind, string> = {
  'meta-ad-library': 'Meta',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  other: 'Link',
};

export function inspoSourceLabel(kind: InspoLinkKind): string {
  return INSPO_SOURCE_LABELS[kind];
}

export interface AngleFieldGroup {
  readonly heading: string;
  /** The prose fields of the group; `Targeting` and `Inspiration` render their own controls. */
  readonly fields: readonly { name: AngleFieldName; label: string; hint?: string }[];
}

/**
 * The panel's six headings, in this order, and the prose field each text group owns.
 *
 * `Identity` is not in PRD §5.6's field list as a group — it exists because an angle cannot be
 * created without a name, and the name is the one field the header cannot double as an input for.
 * `Targeting` and `Inspiration` carry no prose field: their controls are the two dropdowns, the two
 * toggle rows and the link editor, all of which the panel renders itself.
 */
export const ANGLE_FIELD_GROUPS: readonly AngleFieldGroup[] = [
  {
    heading: 'Identity',
    fields: [{ name: 'name', label: 'Angle Name' }],
  },
  {
    heading: 'Hypothesis',
    fields: [
      {
        name: 'description',
        label: 'Description',
        hint: 'What you believe is true about this persona, and why an ad built on it should work.',
      },
    ],
  },
  {
    heading: 'Pain Points',
    fields: [{ name: 'painPoints', label: 'Pain Points' }],
  },
  {
    heading: 'USP',
    fields: [{ name: 'usp', label: 'USP' }],
  },
  { heading: 'Targeting', fields: [] },
  { heading: 'Inspiration', fields: [] },
];

/** Just the headings, for the panel's section list and for the E2E assertion. */
export const ANGLE_GROUP_HEADINGS: readonly string[] = ANGLE_FIELD_GROUPS.map(
  (group) => group.heading,
);

/** Why the Type toggles are inert on this page: Type is read-only until the Concepts phase. */
export const TYPE_SOON_HINT = 'Type is set with the Concepts phase; this page does not write it.';
