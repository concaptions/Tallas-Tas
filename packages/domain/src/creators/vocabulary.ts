/**
 * The two closed lists a creator record carries that are NOT statuses (PRD §5.8): the age bracket
 * and the platform the creator was sourced and is paid through.
 *
 * `@tas/db` owns the storage vocabulary (`creatorAgeBrackets` and `creatorPlatforms` in
 * `packages/db/src/schema/enums.ts`); this module owns how those values are *presented* — the fixed
 * render order and the human label — exactly as `THEME_CATEGORIES` sits over `themeCategories`. The
 * keys are the stored values verbatim, so a row read out of the database indexes straight into these
 * tables with no mapping layer, and a filter chip row is just `CREATOR_PLATFORMS.map(...)`.
 *
 * Neither list is a status: a bracket and a platform are facts about a person, not states of a
 * workflow, which is why nothing here participates in a state machine and nothing here has a tone.
 * Gender and ethnicity are deliberately absent — they are free text on the record because a closed
 * list of either would be wrong about somebody, and the UI renders whatever the row says.
 */

/**
 * The age brackets of PRD §5.8, ascending — the order they are offered in and the order they sort
 * in, which are the same order, so no component re-sorts them.
 *
 * Brackets rather than a date of birth on purpose: TAS never needs a creator's exact age, the brief
 * only ever says "someone in their thirties", and storing less is the right default for a person's
 * data.
 */
export const AGE_BRACKETS = [
  { key: '18-24', label: '18–24' },
  { key: '25-34', label: '25–34' },
  { key: '35-44', label: '35–44' },
  { key: '45-54', label: '45–54' },
  { key: '55-64', label: '55–64' },
  { key: '65+', label: '65+' },
] as const;

export type AgeBracketKey = (typeof AGE_BRACKETS)[number]['key'];

/**
 * Where a creator was sourced and is paid through (PRD §5.8), in the order the PRD lists them.
 *
 * The keys are the human strings themselves, not snake_case slugs, because that is what §5.8 writes
 * and what `creators.platform` stores — these are proper nouns (a company's name), and a
 * `direct_management` key would have been a slug invented purely to be un-slugged again for display.
 *
 * "Direct Management" is the one that is not a marketplace: the creator is managed by TAS directly,
 * which is why a whitelisting partnership (§5.8.1) is nearly always struck with one of those — a
 * marketplace booking buys the footage, not the creator's handle.
 */
export const CREATOR_PLATFORMS = [
  { key: 'Fiverr', label: 'Fiverr' },
  { key: 'Billo', label: 'Billo' },
  { key: 'Backstage', label: 'Backstage' },
  { key: 'Insense', label: 'Insense' },
  { key: 'Direct Management', label: 'Direct Management' },
] as const;

export type CreatorPlatformKey = (typeof CREATOR_PLATFORMS)[number]['key'];

/** Just the keys, for a validator or a `<select>` that needs the raw vocabulary. */
export const AGE_BRACKET_KEYS: readonly AgeBracketKey[] = AGE_BRACKETS.map((entry) => entry.key);
export const CREATOR_PLATFORM_KEYS: readonly CreatorPlatformKey[] = CREATOR_PLATFORMS.map(
  (entry) => entry.key,
);

export function isAgeBracket(value: string): value is AgeBracketKey {
  return AGE_BRACKET_KEYS.includes(value as AgeBracketKey);
}

export function isCreatorPlatform(value: string): value is CreatorPlatformKey {
  return CREATOR_PLATFORM_KEYS.includes(value as CreatorPlatformKey);
}

/**
 * The human labels. Total on purpose, exactly as `themeCategoryLabel` and `creatorStatusLabel` are,
 * and with one extra job here: both columns are NULLABLE (a creator is added the moment somebody has
 * a name, and the bracket and the platform are filled in over the booking), so the empty case is
 * normal rather than exceptional and renders as an em dash rather than a blank cell.
 *
 * `ageBracketLabel` is also where the hyphen becomes an en dash: `creators.age_bracket` stores
 * `'25-34'` with an ASCII hyphen, and a number range is typeset with an en dash.
 */
export const UNSET_LABEL = '—';

export function ageBracketLabel(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return UNSET_LABEL;
  }
  return AGE_BRACKETS.find((entry) => entry.key === value)?.label ?? value;
}

export function creatorPlatformLabel(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return UNSET_LABEL;
  }
  return CREATOR_PLATFORMS.find((entry) => entry.key === value)?.label ?? value;
}
