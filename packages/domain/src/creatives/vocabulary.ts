/**
 * The closed vocabularies a Creative Brief carries (PRD §5.10, §7, §8): Funnel, Type, Priority,
 * Version and Dimensions.
 *
 * `@tas/db` owns the storage vocabulary (`creativeFunnels` / `creativeTypes` / `creativePriorities`
 * in `packages/db/src/schema/enums.ts`, the `as const` tuples the columns are `$type`d from); this
 * module owns how those values are *presented* — the fixed render order, the human label, the SLA a
 * priority promises, the letter the §7 name takes from a funnel or a type, and the chip tone. The
 * keys are the stored values verbatim, exactly as `angles/vocabulary.ts` mirrors `angleFormats`, so
 * a row read out of the database indexes straight into these tables with no mapping layer and a
 * `<select>` is just `CREATIVE_TYPES.map(...)`. The dependency edge runs app → db and app → domain,
 * never db → domain, so `apps/web` is where the two copies are asserted equal.
 *
 * A component imports these constants and never writes `'Motion Image'`, `'Static High'`, `'9:16'`
 * or the letter `V` itself, exactly as it never writes a status string (CLAUDE.md non-negotiable 2
 * and ticket criterion 11).
 *
 * None of this is a state. Funnel, Type and Priority are kinds; the workflow states a brief moves
 * through live in `../state`, and the only thing here that touches the state machine is
 * `creativeTrack`, which answers WHICH of the two internal ladders a type is graded on.
 */

import type { ChipTone, CreativeTrack } from '../state/creative-status';

export interface CreativeFunnelEntry {
  /** The value stored in `creative_briefs.funnel`, verbatim. */
  readonly key: CreativeFunnelKey;
  readonly label: string;
  /** The FIRST character of the PRD §7 name. Read by `creativeName`, never retyped by a caller. */
  readonly letter: string;
}

export interface CreativeTypeEntry {
  /** The value stored in `creative_briefs.type`, verbatim. */
  readonly key: CreativeTypeKey;
  readonly label: string;
  /** The SECOND character of the PRD §7 name. */
  readonly letter: string;
  /** Which internal ladder in `../state` this type is graded on; see `creativeTrack`. */
  readonly track: CreativeTrack;
}

export interface CreativePriorityEntry {
  /** The value stored in `creative_briefs.priority`, verbatim. */
  readonly key: CreativePriorityKey;
  readonly label: string;
  /** The turnaround PRD §5.10 promises, in hours. The chip tone is derived from it. */
  readonly slaHours: number;
}

export interface CreativeDimensionEntry {
  /** The value stored in the `creative_briefs.dimensions` jsonb array, verbatim. */
  readonly key: CreativeDimensionKey;
  readonly label: string;
  /** The delivery size PRD §8 names for the ratio, for the second line of the dimensions grid. */
  readonly pixels: string;
}

/**
 * Where the creative runs (PRD §5.10). The order is the funnel's own order — a prospect meets TOF
 * first and Retargeting second — with `All Funnels` last because it is the "any of the above" case.
 */
export const CREATIVE_FUNNELS = [
  { key: 'TOF', label: 'TOF', letter: 'T' },
  { key: 'Retargeting', label: 'Retargeting', letter: 'R' },
  { key: 'All Funnels', label: 'All Funnels', letter: 'A' },
] as const satisfies readonly { key: string; label: string; letter: string }[];

export type CreativeFunnelKey = (typeof CREATIVE_FUNNELS)[number]['key'];

/**
 * The asset itself (PRD §5.10), in the order §7 lists the format letters: V, S, C, M.
 *
 * `Motion Image` is the §5.10 spelling and is deliberately NOT the same vocabulary as
 * `ANGLE_FORMATS`, which calls the neighbouring thing `Motion Graphic`: an angle names a format a
 * strategist is *asking for*, a brief names the asset that was *built*, and §7's letters are defined
 * over this list. `@tas/db` says the same thing at `creativeTypes`.
 *
 * `track` is the one place the two-track state machine is attached to a type. A carousel is a set of
 * stills and is graded on the static ladder; a motion image is cut like a video and is graded on the
 * video ladder. `schema/briefs.ts` notes that a column default cannot look at another column, so the
 * page moves a static brief to `sent_to_designer` — it reads the track from here rather than
 * branching on `'Static'` in a component.
 */
export const CREATIVE_TYPES = [
  { key: 'Video', label: 'Video', letter: 'V', track: 'video' },
  { key: 'Static', label: 'Static', letter: 'S', track: 'static' },
  { key: 'Carousel', label: 'Carousel', letter: 'C', track: 'static' },
  { key: 'Motion Image', label: 'Motion Image', letter: 'M', track: 'video' },
] as const satisfies readonly {
  key: string;
  label: string;
  letter: string;
  track: CreativeTrack;
}[];

export type CreativeTypeKey = (typeof CREATIVE_TYPES)[number]['key'];

/**
 * The turnaround promise (PRD §5.10), in the order the PRD writes it — 12h, 24h, 24h, 48h, tightest
 * first, which is also the order a queue should read.
 *
 * The hours are the point of the vocabulary: `Static High` and `Video High` are not the same
 * promise, so a page that rendered "High" alone would be telling a designer something false.
 */
export const CREATIVE_PRIORITIES = [
  { key: 'Static High', label: 'Static High', slaHours: 12 },
  { key: 'Static Average', label: 'Static Average', slaHours: 24 },
  { key: 'Video High', label: 'Video High', slaHours: 24 },
  { key: 'Video Average', label: 'Video Average', slaHours: 48 },
] as const satisfies readonly { key: string; label: string; slaHours: number }[];

export type CreativePriorityKey = (typeof CREATIVE_PRIORITIES)[number]['key'];

/**
 * The delivery ratios (PRD §8). `1:1 (1080x1080)` is the PRD's own parenthetical; the other two
 * sizes are the same 1080 short edge, which is what makes the set one export rather than three.
 */
export const CREATIVE_DIMENSIONS = [
  { key: '4:5', label: '4:5', pixels: '1080x1350' },
  { key: '1:1', label: '1:1', pixels: '1080x1080' },
  { key: '9:16', label: '9:16', pixels: '1080x1920' },
] as const satisfies readonly { key: string; label: string; pixels: string }[];

export type CreativeDimensionKey = (typeof CREATIVE_DIMENSIONS)[number]['key'];

/**
 * PRD §8's default dimension set per type: "4:5 or 1:1 (1080x1080) … plus 9:16" for video, "1:1 and
 * 9:16" for statics. A carousel is a set of stills and takes the static set; a motion image is cut
 * like a video and takes the video set — the same split `track` makes, for the same reason.
 *
 * These are the defaults a fresh brief starts from; `creative_briefs.dimensions` is editable per row
 * and a brief that has been edited renders its own array, not this one.
 */
export const DIMENSION_PRESETS = {
  Video: ['4:5', '1:1', '9:16'],
  Static: ['1:1', '9:16'],
  Carousel: ['1:1', '9:16'],
  'Motion Image': ['4:5', '1:1', '9:16'],
} as const satisfies Record<CreativeTypeKey, readonly CreativeDimensionKey[]>;

/**
 * The Version dropdown (PRD §7: "Version is picked from a dropdown and written into the name
 * automatically"; ticket criterion 7: V1…V6). Written out rather than generated so the type is a
 * union of six literals and an out-of-range version is a compile error in a caller.
 */
export const CREATIVE_VERSIONS = [1, 2, 3, 4, 5, 6] as const satisfies readonly number[];

export type CreativeVersion = (typeof CREATIVE_VERSIONS)[number];

/** Just the keys, for a validator or a `<select>` that needs the raw vocabulary. */
export const CREATIVE_FUNNEL_KEYS: readonly CreativeFunnelKey[] = CREATIVE_FUNNELS.map(
  (entry) => entry.key,
);
export const CREATIVE_TYPE_KEYS: readonly CreativeTypeKey[] = CREATIVE_TYPES.map(
  (entry) => entry.key,
);
export const CREATIVE_PRIORITY_KEYS: readonly CreativePriorityKey[] = CREATIVE_PRIORITIES.map(
  (entry) => entry.key,
);
export const CREATIVE_DIMENSION_KEYS: readonly CreativeDimensionKey[] = CREATIVE_DIMENSIONS.map(
  (entry) => entry.key,
);

export function isCreativeFunnel(value: string): value is CreativeFunnelKey {
  return CREATIVE_FUNNEL_KEYS.includes(value as CreativeFunnelKey);
}

export function isCreativeType(value: string): value is CreativeTypeKey {
  return CREATIVE_TYPE_KEYS.includes(value as CreativeTypeKey);
}

export function isCreativePriority(value: string): value is CreativePriorityKey {
  return CREATIVE_PRIORITY_KEYS.includes(value as CreativePriorityKey);
}

export function isCreativeDimension(value: string): value is CreativeDimensionKey {
  return CREATIVE_DIMENSION_KEYS.includes(value as CreativeDimensionKey);
}

/** True for a version the dropdown offers; `6.5` and `7` are both out. */
export function isCreativeVersion(value: number): value is CreativeVersion {
  return (CREATIVE_VERSIONS as readonly number[]).includes(value);
}

/** The entry for a stored value, or `undefined` for a value this build does not know. */
export function creativeFunnelEntry(value: string): CreativeFunnelEntry | undefined {
  return CREATIVE_FUNNELS.find((entry) => entry.key === value);
}

export function creativeTypeEntry(value: string): CreativeTypeEntry | undefined {
  return CREATIVE_TYPES.find((entry) => entry.key === value);
}

export function creativePriorityEntry(value: string): CreativePriorityEntry | undefined {
  return CREATIVE_PRIORITIES.find((entry) => entry.key === value);
}

export function creativeDimensionEntry(value: string): CreativeDimensionEntry | undefined {
  return CREATIVE_DIMENSIONS.find((entry) => entry.key === value);
}

/**
 * The human label for a stored value. Total on purpose, exactly as `conceptCategoryLabel` is: a row
 * written by a newer build renders its own value back rather than an empty cell, so the page never
 * shows a blank where a label belongs.
 */
export function creativeFunnelLabel(value: string): string {
  return creativeFunnelEntry(value)?.label ?? value;
}

export function creativeTypeLabel(value: string): string {
  return creativeTypeEntry(value)?.label ?? value;
}

export function creativePriorityLabel(value: string): string {
  return creativePriorityEntry(value)?.label ?? value;
}

/** `V2`. The one place the leading `V` is written, so the dropdown and the name agree by construction. */
export function creativeVersionLabel(version: number): string {
  return `V${String(version)}`;
}

/**
 * The SLA a priority promises, in hours, or `null` for a brief that has not been prioritised —
 * `creative_briefs.priority` is nullable, and "no priority yet" is not "no deadline of zero".
 */
export function prioritySlaHours(priority: string | null | undefined): number | null {
  if (priority === null || priority === undefined) {
    return null;
  }
  return creativePriorityEntry(priority)?.slaHours ?? null;
}

/**
 * `12h`. The chip's second line, built here so no component divides or suffixes hours itself.
 * `null` for an unprioritised brief, which the page renders as the empty em dash from `fields.ts`.
 */
export function prioritySlaLabel(priority: string | null | undefined): string | null {
  const hours = prioritySlaHours(priority);
  return hours === null ? null : `${String(hours)}h`;
}

/**
 * The `StatusChip` tone for a priority — derived from the CLOCK, not from the word.
 *
 * `Static Average` and `Video High` are both 24h: they are the same promise to whoever has to
 * deliver, so they get the same chip, and a designer scanning the list reads urgency rather than
 * having to hold "high for a video is average for a static" in their head. `mute` is the resting
 * tone a brief with no priority also takes, so an unprioritised row never shouts.
 */
export function priorityTone(priority: string | null | undefined): ChipTone {
  const hours = prioritySlaHours(priority);
  if (hours === null) {
    return 'mute';
  }
  if (hours <= 12) {
    return 'bad';
  }
  if (hours <= 24) {
    return 'warn';
  }
  return 'mute';
}

/**
 * Which internal ladder in `../state` a brief of this type is graded on, so a page calls
 * `internalStatusFor(creativeTrack(brief.type))` and nothing anywhere branches on `'Static'`.
 *
 * Total: a type this build does not know falls back to `video`, the track whose first state is the
 * `BRIEF_INTERNAL_STATUS_DEFAULT` the column already carries, so an unknown type renders a stepper
 * rather than crashing the rail.
 */
export function creativeTrack(type: string): CreativeTrack {
  return creativeTypeEntry(type)?.track ?? 'video';
}

/**
 * PRD §8's default dimensions for a type, in `CREATIVE_DIMENSIONS` order. An unknown type takes the
 * video set, which is the superset — a grid that shows one ratio too many is recoverable, a grid
 * that shows none is not.
 */
export function dimensionsFor(type: string): readonly CreativeDimensionKey[] {
  return isCreativeType(type) ? DIMENSION_PRESETS[type] : DIMENSION_PRESETS.Video;
}

/**
 * A stored `dimensions` array as renderable entries, always in `CREATIVE_DIMENSIONS` order and never
 * with a duplicate, whatever order (or repetition) the row happens to carry. An unknown ratio is
 * dropped rather than rendered raw, exactly as `angleFormatEntries` drops an unknown format: the
 * grid is a closed vocabulary.
 */
export function dimensionEntries(selected: readonly string[]): readonly CreativeDimensionEntry[] {
  return CREATIVE_DIMENSIONS.filter((entry) => selected.includes(entry.key));
}
