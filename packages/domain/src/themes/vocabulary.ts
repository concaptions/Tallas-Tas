/**
 * The three kinds of theme the GLOBAL library holds (PRD §5.5): Frameworks, Production styles and
 * Seasonal hooks.
 *
 * `@tas/db` owns the storage vocabulary (`themeCategories`, a tuple plus its `theme_category`
 * pgEnum); this module owns how those values are *presented* — the fixed render order, the human
 * label and the chip tone. The keys are the stored values verbatim, exactly as `ANGLE_FORMATS` /
 * `ANGLE_TYPES` do it, so a row read out of the database indexes straight into this table with no
 * mapping layer in between and the filter chip row is just `THEME_CATEGORIES.map(...)`.
 *
 * A component imports `THEME_CATEGORIES` and never writes `'Production Style'` itself, exactly as
 * it never writes a status string. Themes have no workflow status: a category is a kind, not a
 * state, which is why nothing here participates in the state machine.
 */

import type { ChipTone } from '../state/creative-status';

export interface ThemeStatusEntry {
  readonly key: ThemeStatusKey;
  readonly label: string;
  readonly tone: ChipTone;
}

export const THEME_STATUSES = [
  { key: 'not_started', label: 'Not Started', tone: 'mute' },
  { key: 'in_progress', label: 'In Progress', tone: 'accent' },
  { key: 'done', label: 'Done', tone: 'ok' },
  { key: 'archived', label: 'Archived', tone: 'warn' },
] as const satisfies readonly { key: string; label: string; tone: ChipTone }[];

export type ThemeStatusKey = (typeof THEME_STATUSES)[number]['key'];

export const THEME_STATUS_KEYS: readonly ThemeStatusKey[] = THEME_STATUSES.map(
  (entry) => entry.key,
);

export function isThemeStatus(value: string): value is ThemeStatusKey {
  return THEME_STATUS_KEYS.includes(value as ThemeStatusKey);
}

export function themeStatusEntry(value: string): ThemeStatusEntry | undefined {
  return THEME_STATUSES.find((entry) => entry.key === value);
}

export function themeStatusLabel(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return themeStatusEntry(value)?.label ?? value;
}

export function themeStatusTone(value: string | null | undefined): ChipTone {
  if (value === null || value === undefined || value === '') {
    return 'mute';
  }
  return themeStatusEntry(value)?.tone ?? 'mute';
}

export interface ThemeCategoryEntry {
  /** The value stored in `themes.category`, verbatim. */
  readonly key: ThemeCategoryKey;
  readonly label: string;
  /** The `StatusChip` tone this category renders with. Never chosen locally by a component. */
  readonly tone: ChipTone;
}

/**
 * The three categories, in the one order the UI is allowed to render them in (the PRD lists them
 * Frameworks / Production styles / Seasonal, and the filter chip row follows that order).
 *
 * Tones are spread across the palette so three chips in a grid stay distinguishable, and they are
 * deliberately *kinds*, not judgements: `Seasonal` is `warn` because a seasonal hook is the one
 * with an expiry date on it, not because anything is wrong with it.
 */
export const THEME_CATEGORIES = [
  { key: 'Framework', label: 'Framework', tone: 'accent' },
  { key: 'Production Style', label: 'Production Style', tone: 'info' },
  { key: 'Seasonal', label: 'Seasonal', tone: 'warn' },
] as const satisfies readonly { key: string; label: string; tone: ChipTone }[];

export type ThemeCategoryKey = (typeof THEME_CATEGORIES)[number]['key'];

/** Just the keys, for a validator or a `<select>` that needs the raw vocabulary. */
export const THEME_CATEGORY_KEYS: readonly ThemeCategoryKey[] = THEME_CATEGORIES.map(
  (entry) => entry.key,
);

export function isThemeCategory(value: string): value is ThemeCategoryKey {
  return THEME_CATEGORY_KEYS.includes(value as ThemeCategoryKey);
}

/** The entry for a stored value, or `undefined` for a value this build does not know. */
export function themeCategoryEntry(value: string): ThemeCategoryEntry | undefined {
  return THEME_CATEGORIES.find((entry) => entry.key === value);
}

/**
 * The human label for a stored category. Total on purpose: a row written by a newer build (or a
 * `?category=` a visitor typed) renders its own value back rather than an empty chip, so the page
 * never shows a blank where a label belongs.
 */
export function themeCategoryLabel(value: string): string {
  return themeCategoryEntry(value)?.label ?? value;
}

/**
 * The chip tone for a stored category. Total for the same reason as `themeCategoryLabel`: an
 * unknown value falls back to `mute`, the palette's "no opinion" tone, so an unrecognised category
 * is quiet rather than accidentally shouting in `bad`.
 */
export function themeCategoryTone(value: string): ChipTone {
  return themeCategoryEntry(value)?.tone ?? 'mute';
}
