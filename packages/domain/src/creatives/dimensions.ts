/**
 * The bridge between the two spellings a stored dimension can have (PRD §8).
 *
 * `creative_briefs.dimensions` and, since migration 0059, `creative_sheet_items.dimensions` are
 * `jsonb string[]` columns. A brief created on the platform stores the §8 KEYS (`'4:5' | '1:1' |
 * '9:16'`, `CREATIVE_DIMENSIONS` in `./vocabulary`). A brief the Airtable importer landed stores the
 * NAMES of the `(Internal) Creative Dimensions` records the brief linked to — `'IG Story / Reel'`,
 * `'IG Feed Post'`, … — because that is what the Gratsi base calls a placement, and the importer
 * passes a name it cannot resolve through verbatim rather than dropping data (`airtable-import.ts`,
 * `resolveDimensions`). Both spellings are therefore live in production at once, and a validator
 * that accepts only the keys refuses to save a brief it did not create (the Oct 2026 "values show
 * but select does not fire" bug: `updateBriefAction` re-posted the imported names and failed).
 *
 * This module is the ONE place the names are read. `normalizeCreativeDimension` turns a name into
 * its key where the mapping is unambiguous and leaves anything else alone, trimmed;
 * `isKnownOrLegacyDimension` is the validator the Server Actions use instead of `isCreativeDimension`.
 * The legacy table is derived from the fixtures that mirror the live base (`demoCreativeDimensions`
 * in `@tas/db`: name, pixel size and link description) and from the §8 pixel sizes themselves.
 * A name not in the table is a legacy value this build does not know; it is kept as it is so the
 * row keeps saying what Airtable said, and the grid renders it as text.
 */

import {
  CREATIVE_DIMENSIONS,
  isCreativeDimension,
  type CreativeDimensionEntry,
  type CreativeDimensionKey,
} from './vocabulary';

/**
 * The Airtable placement names (and the pixel strings the same records carry in their `Dimensions`
 * field) that name exactly one §8 ratio. Compared case-insensitively after trimming, so `'ig feed
 * post'` and `'IG Feed Post '` are the same record. A name is listed only when the live record's
 * pixel size settles the ratio; a name that could mean two ratios is deliberately absent.
 */
const LEGACY_DIMENSION_NAMES: Readonly<Record<string, CreativeDimensionKey>> = {
  // 1080x1920 — the vertical placements.
  'ig story / reel': '9:16',
  'ig story': '9:16',
  'ig reel': '9:16',
  'fb / meta reel': '9:16',
  'facebook reels': '9:16',
  'facebook reel': '9:16',
  story: '9:16',
  stories: '9:16',
  reel: '9:16',
  reels: '9:16',
  vertical: '9:16',
  // 1080x1080 — the square feed placements.
  'ig feed post': '1:1',
  'facebook feed square': '1:1',
  'feed square': '1:1',
  feed: '1:1',
  square: '1:1',
  // 1080x1350 — the portrait feed placement.
  portrait: '4:5',
  'feed portrait': '4:5',
  // The pixel sizes the `(Internal) Creative Dimensions` records spell out, and §8's own.
  ...Object.fromEntries(CREATIVE_DIMENSIONS.map((entry) => [entry.pixels, entry.key])),
  '1080 x 1920': '9:16',
  '1080 x 1080': '1:1',
  '1080 x 1350': '4:5',
};

/** The longest value a legacy name may be before it is a paragraph and not a placement. */
const MAX_LEGACY_LENGTH = 80;

/** One Dimensions `<select>` option: the stored value and what the option reads. */
export interface DimensionOption {
  readonly key: string;
  readonly label: string;
  /** The §8 pixel size for a known ratio; `null` for a legacy name the build cannot size. */
  readonly pixels: string | null;
}

/** The three §8 ratios as dropdown options, in `CREATIVE_DIMENSIONS` order. */
export const DIMENSION_OPTIONS: readonly DimensionOption[] = CREATIVE_DIMENSIONS.map(
  (entry: CreativeDimensionEntry): DimensionOption => ({
    key: entry.key,
    label: `${entry.label} · ${entry.pixels}`,
    pixels: entry.pixels,
  }),
);

/**
 * A stored dimension as the platform spells it: a §8 key when `value` is a key or a legacy name
 * this build can place, otherwise `value` trimmed. Total and idempotent — a key normalises to
 * itself, and normalising twice is normalising once — so a caller may run every value through it.
 */
export function normalizeCreativeDimension(value: string): string {
  const trimmed = value.trim();
  if (isCreativeDimension(trimmed)) {
    return trimmed;
  }
  return LEGACY_DIMENSION_NAMES[trimmed.toLowerCase()] ?? trimmed;
}

/** `21:9`, `4:5`, `16 : 9` — the shape of a RATIO, the platform's own closed vocabulary. */
const RATIO_SHAPE = /^\d+\s*:\s*\d+$/;

/**
 * The validator for a submitted dimension: a §8 key, a legacy name that normalises to one, or an
 * imported placement name this build does not know but a row already carries.
 *
 * Two vocabularies meet here and are held to different rules. A RATIO is the platform's own and is
 * closed: `21:9` is refused exactly as `isCreativeDimension` refused it, because this build cannot
 * deliver it and nothing imported ever spells a placement that way. A NAME is Airtable's and is
 * open: the importer passes a `(Internal) Creative Dimensions` name through verbatim, so any
 * non-empty, single-line value of placement length is accepted and kept. What is refused of a name
 * is the empty string, whitespace, a line break and a paragraph, which are never a placement.
 */
export function isKnownOrLegacyDimension(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.length > MAX_LEGACY_LENGTH) {
    return false;
  }
  if (/[\r\n\t]/.test(trimmed)) {
    return false;
  }
  if (RATIO_SHAPE.test(trimmed)) {
    return isCreativeDimension(trimmed);
  }
  return true;
}

/** True when the value normalises to one of the three §8 keys. */
export function isLegacyDimensionName(value: string): boolean {
  const trimmed = value.trim();
  return !isCreativeDimension(trimmed) && isCreativeDimension(normalizeCreativeDimension(trimmed));
}

/**
 * A stored array, normalised and deduplicated, keys first in `CREATIVE_DIMENSIONS` order and then
 * every legacy name in the order the row carried them — so `['9:16', 'IG Feed Post', '1:1']` becomes
 * `['1:1', '9:16']` and `['Billboard', '4:5']` becomes `['4:5', 'Billboard']`.
 */
export function normalizeCreativeDimensions(values: readonly string[]): string[] {
  const normalised = new Set(values.map(normalizeCreativeDimension).filter((v) => v !== ''));
  const keys = CREATIVE_DIMENSIONS.map((entry) => entry.key).filter((key) => normalised.has(key));
  const legacy = [...normalised].filter((value) => !isCreativeDimension(value));
  return [...keys, ...legacy];
}

/**
 * The options a Dimensions dropdown offers for a row: the three §8 ratios plus every legacy name
 * the row already carries (normalised), so an imported value stays visible and re-selectable
 * rather than vanishing because this build has no entry for it.
 */
export function dimensionOptionsFor(stored: readonly string[]): readonly DimensionOption[] {
  const legacy = normalizeCreativeDimensions(stored)
    .filter((value) => !isCreativeDimension(value))
    .map((value): DimensionOption => ({ key: value, label: value, pixels: null }));
  return [...DIMENSION_OPTIONS, ...legacy];
}

/** One tick on a Dimensions picker: add or remove ONE value, in either spelling. */
export interface DimensionChange {
  readonly op: 'add' | 'remove';
  readonly key: string;
}

/**
 * The stored array after one tick, merged on the server: `stored` normalised — or the §8
 * `defaults` for the type when the row carries nothing, the same reading the page gives an empty
 * row — plus or minus the one value. A picker that posted its whole selection instead would
 * replace three stored ratios with the one it could read (the 2026-10-10 smoke test, on an
 * imported brief whose placement names the picker did not recognise); a change can only ever
 * touch the value it names, and a legacy name this build cannot place rides through untouched.
 */
export function applyDimensionChange(
  stored: readonly string[],
  defaults: readonly string[],
  change: DimensionChange,
): string[] {
  const base = normalizeCreativeDimensions(stored.length === 0 ? defaults : stored);
  const key = normalizeCreativeDimension(change.key);
  return change.op === 'add'
    ? normalizeCreativeDimensions([...base, key])
    : base.filter((value) => value !== key);
}

/** The label a grid cell or a chip shows for one stored value: the key itself, or the legacy name. */
export function creativeDimensionDisplay(value: string): string {
  return normalizeCreativeDimension(value);
}
