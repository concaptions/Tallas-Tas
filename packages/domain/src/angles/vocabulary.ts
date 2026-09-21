/**
 * The two multi-select vocabularies an angle carries (PRD §5.6): Formats to create, and Type.
 *
 * `@tas/db` owns the storage vocabulary (`angleFormats` / `angleTypes`, a pg enum plus its tuple);
 * this module owns how those values are *presented* — the fixed render order, the human label and,
 * for Type, the chip tone. The keys are the stored values verbatim, so a row read out of the
 * database indexes straight into these tables with no mapping layer in between.
 *
 * A component imports `ANGLE_FORMATS` / `ANGLE_TYPES` and never writes `'Static'` or `'Emotional'`
 * itself, exactly as it never writes a status string.
 */

import type { ChipTone } from '../state/creative-status';

export interface AngleFormatEntry {
  /** The value stored in `angles.formats`, verbatim. */
  readonly key: AngleFormatKey;
  readonly label: string;
}

export interface AngleTypeEntry {
  /** The value stored in `angles.type`, verbatim. */
  readonly key: AngleTypeKey;
  readonly label: string;
  /** The `StatusChip` tone this type renders with. Never chosen locally by a component. */
  readonly tone: ChipTone;
}

/**
 * The four formats, in the one order the UI is allowed to render them in (PRD §5.6 lists them
 * Static / Video / Carousel / Motion Graphic, and the table column follows that order regardless of
 * the order the strategist ticked the boxes in).
 */
export const ANGLE_FORMATS = [
  { key: 'Static', label: 'Static' },
  { key: 'Video', label: 'Video' },
  { key: 'Carousel', label: 'Carousel' },
  { key: 'Motion Graphic', label: 'Motion Graphic' },
] as const satisfies readonly { key: string; label: string }[];

export type AngleFormatKey = (typeof ANGLE_FORMATS)[number]['key'];

/**
 * What the hypothesis leans on. Tones are deliberately spread across the palette so four chips in a
 * row stay distinguishable: `Critical` is the only one that reads as a caution, because a critical
 * angle is the one a client is most likely to push back on.
 */
export const ANGLE_TYPES = [
  { key: 'Emotional', label: 'Emotional', tone: 'accent' },
  { key: 'Functional', label: 'Functional', tone: 'info' },
  { key: 'Identity', label: 'Identity', tone: 'ok' },
  { key: 'Critical', label: 'Critical', tone: 'warn' },
] as const satisfies readonly { key: string; label: string; tone: ChipTone }[];

export type AngleTypeKey = (typeof ANGLE_TYPES)[number]['key'];

export interface AnglePotentialEntry {
  readonly key: AnglePotentialKey;
  readonly label: string;
  readonly tone: ChipTone;
}

export const ANGLE_POTENTIALS = [
  { key: 'High', label: 'High', tone: 'ok' },
  { key: 'Medium', label: 'Medium', tone: 'accent' },
  { key: 'Low', label: 'Low', tone: 'warn' },
] as const satisfies readonly { key: string; label: string; tone: ChipTone }[];

export type AnglePotentialKey = (typeof ANGLE_POTENTIALS)[number]['key'];

/** Just the keys, for a validator or a `<select>` that needs the raw vocabulary. */
export const ANGLE_FORMAT_KEYS: readonly AngleFormatKey[] = ANGLE_FORMATS.map((entry) => entry.key);
export const ANGLE_TYPE_KEYS: readonly AngleTypeKey[] = ANGLE_TYPES.map((entry) => entry.key);
export const ANGLE_POTENTIAL_KEYS: readonly AnglePotentialKey[] = ANGLE_POTENTIALS.map(
  (entry) => entry.key,
);

export function isAngleFormat(value: string): value is AngleFormatKey {
  return ANGLE_FORMAT_KEYS.includes(value as AngleFormatKey);
}

export function isAngleType(value: string): value is AngleTypeKey {
  return ANGLE_TYPE_KEYS.includes(value as AngleTypeKey);
}

export function isAnglePotential(value: string): value is AnglePotentialKey {
  return ANGLE_POTENTIAL_KEYS.includes(value as AnglePotentialKey);
}

export function anglePotentialLabel(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return ANGLE_POTENTIALS.find((entry) => entry.key === value)?.label ?? value;
}

export function anglePotentialTone(value: string | null | undefined): ChipTone {
  if (value === null || value === undefined || value === '') {
    return 'mute';
  }
  return ANGLE_POTENTIALS.find((entry) => entry.key === value)?.tone ?? 'mute';
}

/** The entry for a stored value, or `undefined` for a value this build does not know. */
export function angleFormatEntry(value: string): AngleFormatEntry | undefined {
  return ANGLE_FORMATS.find((entry) => entry.key === value);
}

export function angleTypeEntry(value: string): AngleTypeEntry | undefined {
  return ANGLE_TYPES.find((entry) => entry.key === value);
}

/**
 * The selected formats as renderable entries, always in `ANGLE_FORMATS` order and never with a
 * duplicate, whatever order (or repetition) the stored array happens to carry. An unknown stored
 * value is dropped rather than rendered raw: the chip row is a closed vocabulary.
 */
export function angleFormatEntries(selected: readonly string[]): readonly AngleFormatEntry[] {
  return ANGLE_FORMATS.filter((entry) => selected.includes(entry.key));
}

/** Same contract as `angleFormatEntries`, for the Type multi-select. */
export function angleTypeEntries(selected: readonly string[]): readonly AngleTypeEntry[] {
  return ANGLE_TYPES.filter((entry) => selected.includes(entry.key));
}
