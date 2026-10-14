/**
 * Ticket 3 — Brief auto-naming for new entries (Oct 14 sprint). The CREATE formula a new brief's
 * name is built from when `name_mode = 'auto'`:
 *
 *     {Source}_{Funnel}_{Type[0]}_{Number}_{Concept}_{Batch}
 *     TAS_TOF_V_001_summer-sale_Batch 1
 *     Client_RTG_S_042_holiday-push_Batch 3
 *
 * `_` is the segment separator, chosen so the slugified concept (which uses `-` as its own word
 * separator) can never collide with the top-level join. The slug lowercases, maps every non-
 * alphanumeric character to `-`, collapses runs of hyphens, trims the ends and truncates to the
 * 40-character limit with a trailing `…` when the input exceeds it. The source segment defaults
 * to `TAS` when a form sends it blank; the funnel is normalised to the three-letter code vocabulary
 * (`TOF`, `MOF`, `BOF`, `RTG`, `ALL`); the type contributes its first letter uppercased.
 *
 * Pure: this is a function of its arguments and nothing else — no clock, no database, no module
 * state. The write path calls it inside the `createBrief` transaction after the brand's
 * `brief_number` is allocated under the advisory lock, and the "New creative" dialog calls the
 * same function on the client to render the live preview, so the two can never disagree.
 *
 * EMPTY SEGMENTS COLLAPSE. A missing concept (standalone brief) and a missing batch (a brief whose
 * concept has no batch) both drop their segment entirely rather than leaving a bare separator; the
 * head keeps `source_funnel_type_number` as a stable minimum, so a preview that has not been filled
 * in yet never shows a dangling separator.
 */

/** The separator the top-level formula joins segments with. One place so nothing re-types it. */
export const BRIEF_AUTO_NAME_SEPARATOR = '_';

/** The source segment every auto-named brief carries when the form sent nothing. */
export const BRIEF_AUTO_NAME_DEFAULT_SOURCE = 'TAS';

/** The width `number` is zero-padded to (`001`, `042`, `100`, `1000`). */
export const BRIEF_AUTO_NAME_NUMBER_WIDTH = 3;

/** The concept slug's maximum length; longer input is truncated with `…`. */
export const BRIEF_AUTO_NAME_CONCEPT_MAX = 40;

/** The three sources the form offers; see `creativeSources` in the schema. */
export const BRIEF_AUTO_NAME_SOURCES = ['TAS', 'Client', 'Agency'] as const satisfies readonly [
  string,
  string,
  string,
];

export type BriefAutoNameSource = (typeof BRIEF_AUTO_NAME_SOURCES)[number];

/** Non-whitespace or `null`, so an empty string and an unset value take the same code path. */
function textOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/**
 * The arguments `buildBriefName` reads. Each optional field collapses out of the output when it is
 * null or whitespace-only, so a preview rendered before the user has picked a concept and a batch
 * reads as `source_funnel_type_number` rather than dangling two separators at the tail.
 */
export interface BuildBriefNameArgs {
  readonly source?: string | null;
  readonly funnel: string;
  readonly type: string;
  readonly number: number;
  readonly conceptName?: string | null;
  readonly conceptBatch?: string | null;
}

/**
 * Funnel → three-letter code. The code vocabulary of the formula is a stable superset of the
 * `CREATIVE_FUNNELS` keys the schema stores — `TOF` already matches, and `Retargeting` and `All
 * Funnels` abbreviate to `RTG` and `ALL`. `MOF` and `BOF` are kept because the copy track and the
 * ticket both name them even though no creative-track funnel key spells them in full today, so a
 * stored key the schema may later add (or a hand-typed preview value) still prints a three-letter
 * code rather than the full word. Idempotent: a value that is already a code passes through.
 *
 * Case-insensitive, and an unknown input falls through to the first three characters uppercased so
 * the output always matches the expected head shape of the formula.
 */
const FUNNEL_CODES: Readonly<Record<string, string>> = {
  'top of funnel': 'TOF',
  tof: 'TOF',
  'middle of funnel': 'MOF',
  'mid funnel': 'MOF',
  mof: 'MOF',
  'bottom of funnel': 'BOF',
  bof: 'BOF',
  retargeting: 'RTG',
  rtg: 'RTG',
  'all funnels': 'ALL',
  all: 'ALL',
};

/**
 * The funnel segment of the brief name, in the code vocabulary (`TOF`, `MOF`, `BOF`, `RTG`, `ALL`).
 * Reuses the funnel key — the schema stores keys the UI picks from — rather than a hand-typed
 * label, and never returns a word longer than three characters.
 */
export function normaliseFunnelForName(funnel: string): string {
  const trimmed = funnel.trim();
  if (trimmed === '') return '';
  const known = FUNNEL_CODES[trimmed.toLowerCase()];
  if (known !== undefined) return known;
  return trimmed.slice(0, 3).toUpperCase();
}

/**
 * The first letter of the creative type, uppercased: `Video → V`, `Static → S`, `Carousel → C`,
 * `Motion Image → M`. The vocabulary is exactly those four, so the return type is the matching
 * union of literals; an unknown input (never produced by the schema, defensive for preview
 * callers) falls back to `V` so the head keeps its one-letter shape.
 */
export function typeInitial(type: string): 'V' | 'S' | 'C' | 'M' {
  const trimmed = type.trim();
  const first = trimmed.charAt(0).toUpperCase();
  return first === 'S' || first === 'C' || first === 'M' ? first : 'V';
}

/**
 * The concept slug: lowercase every character, replace every run of non-alphanumeric characters
 * with a single hyphen, trim leading and trailing hyphens, then truncate to `maxLength` with a
 * trailing `…` when the input exceeds it (counted as one character). An input whose slug collapses
 * to the empty string (all punctuation, all hyphens, only whitespace) returns `""` and the
 * formula drops the segment.
 *
 * Hyphen collisions: `"---"` → `""`; `"a---b"` → `"a-b"`; `"Hello, world!"` → `"hello-world"`.
 */
export function normaliseConceptSlug(
  name: string | null | undefined,
  maxLength: number = BRIEF_AUTO_NAME_CONCEPT_MAX,
): string {
  if (name === null || name === undefined) return '';
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug === '') return '';
  if (maxLength <= 0) return '';
  if (slug.length <= maxLength) return slug;
  // One ellipsis character counts toward the limit; truncate so slug + `…` has `maxLength` chars.
  return `${slug.slice(0, maxLength - 1).replace(/-+$/, '')}…`;
}

/**
 * The zero-padded number, as the head's number segment. A non-positive or non-integer input clamps
 * to `0` padded to `001`-shape zeros; a value above the padded width keeps its full digits, so a
 * brand with more than 999 briefs still names them without collision.
 */
function paddedNumber(value: number): string {
  const integer = Number.isInteger(value) && value > 0 ? value : 0;
  return String(integer).padStart(BRIEF_AUTO_NAME_NUMBER_WIDTH, '0');
}

/**
 * The CREATE formula. See the module header for the shape, the separator and the collapse rules.
 */
export function buildBriefName(args: BuildBriefNameArgs): string {
  const source = textOrNull(args.source) ?? BRIEF_AUTO_NAME_DEFAULT_SOURCE;
  const funnel = normaliseFunnelForName(args.funnel);
  const letter = typeInitial(args.type);
  const padded = paddedNumber(args.number);
  const conceptSlug = normaliseConceptSlug(textOrNull(args.conceptName));
  const batch = textOrNull(args.conceptBatch);

  const segments: string[] = [source];
  if (funnel !== '') segments.push(funnel);
  segments.push(letter, padded);
  if (conceptSlug !== '') segments.push(conceptSlug);
  if (batch !== null) segments.push(batch);
  return segments.join(BRIEF_AUTO_NAME_SEPARATOR);
}
