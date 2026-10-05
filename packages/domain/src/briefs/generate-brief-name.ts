/**
 * The NEW-brief auto-naming formula (Oct 5 sprint, Agent 3). One place that string is built, so the
 * create form's live preview and the Server Action's write cannot disagree. Pure: it reads a handful
 * of strings and a number and returns one string. Never a lookup, never a throw.
 *
 *     Source-Funnel-TypeInitial-Number-Concept-Batch
 *     TAS-TOF-V001-Summer Sale-Batch 1
 *     TAS-RTG-S042-Holiday Push-Batch 3
 *
 * This is the formula the orchestrator asked for in this sprint, and it is distinct from the PRD §7
 * `creativeName` already in `../creatives/creative-name.ts`. §7 names existing fixtures and governs
 * the UPDATE path's rebuild; this one is wired into CREATE only and uses the brand-wide `briefNumber`
 * counter rather than the per-funnel-and-type `sequence`. The two coexist and must not be collapsed.
 *
 * EMPTY SEGMENTS COLLAPSE. `("TAS","TOF","Video",1,"","")` is `"TAS-TOF-V001"` — a concept and a
 * batch that are not chosen yet become no segment at all, so the name never carries a dangling
 * hyphen or a double-hyphen gap. The paste's own illustrative `"TAS-TOF-V001--Batch 1"` was
 * inconsistent with its "no double dashes" rule, and the collapse reading is the one applied here.
 *
 * SOURCE DEFAULTS TO `"TAS"`. The CREATE action supplies the brand's source, but a user editing the
 * form may blank the field — the default keeps the head stable so the preview never shrinks to just
 * the funnel-type-number.
 */

/** The separator between name segments. One place so nothing re-types the hyphen. */
export const BRIEF_NAME_SEPARATOR = '-';

/** The source segment every brief carries when nothing else is specified. */
export const BRIEF_NAME_DEFAULT_SOURCE = 'TAS';

/** The width `number` is zero-padded to in the head segment (`V001`, `S042`, `C100`). */
export const BRIEF_NAME_NUMBER_WIDTH = 3;

/**
 * The arguments `generateBriefName` reads. `source` and `concept` and `batch` are nullable so a
 * freshly mounted form (where the user has not picked them yet) can call the function without a
 * cast, and the formula collapses them when empty. `number` is the brand-wide `briefNumber` counter
 * the write path allocates `FOR UPDATE` in one transaction.
 */
export interface GenerateBriefNameArgs {
  readonly source?: string | null;
  readonly funnel: string;
  readonly creativeType: string;
  readonly number: number;
  readonly concept?: string | null;
  readonly batch?: string | null;
}

/** Non-whitespace or `null`. One place so the empty-string and the `null` branches agree. */
function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/**
 * Funnel → three-letter abbreviation (Oct 6 fix, Agent 3 flagged edge #2). The CREATIVE_FUNNELS
 * vocabulary stores full names (`"Top of Funnel"`, `"Retargeting"`, `"All Funnels"`), so without
 * this map the name read `"TAS-Retargeting-V001-..."` instead of the paste's intended
 * `"TAS-RTG-V001-..."`. Idempotent: already-abbreviated values pass through, so a form that
 * stored `"RTG"` directly keeps writing it.
 *
 * Lookup is case-insensitive — the Funnel select is bound to the stored key, but a hand-typed
 * value in a preview or a legacy form submission is matched too.
 *
 * Unknown funnel: the first three characters uppercased. `"Awareness"` → `"AWA"`; `"Prospecting"`
 * → `"PRO"`. The formula never carries the full word, so a vocabulary change elsewhere cannot
 * silently blow up the printed name's shape.
 */
const FUNNEL_ABBREVIATIONS: Readonly<Record<string, string>> = {
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
 * The funnel segment, as the brief name writes it. See `FUNNEL_ABBREVIATIONS` for the mapping
 * contract — the fallback is the first three characters uppercased, so the output always matches
 * the three-letter head the rest of the formula expects.
 */
export function funnelAbbreviation(funnel: string): string {
  const trimmed = funnel.trim();
  if (trimmed === '') return '';
  const known = FUNNEL_ABBREVIATIONS[trimmed.toLowerCase()];
  if (known !== undefined) return known;
  return trimmed.slice(0, 3).toUpperCase();
}

/**
 * The first letter of `creativeType`, uppercased: `Video → V`, `Static → S`, `Carousel → C`,
 * `Motion Image → M`. One letter is enough because the vocabulary is four, and the name formula
 * trades verbosity for the compact `V001` head the paste's examples show. An empty type contributes
 * no letter, which is the formula's own collapse — the head then reads e.g. `TOF-001`.
 */
function typeInitial(creativeType: string): string {
  const trimmed = creativeType.trim();
  const first = trimmed.charAt(0);
  return first === '' ? '' : first.toUpperCase();
}

/**
 * The zero-padded number, as the head's third component. `padStart` keeps 4-digit numbers at
 * 4 digits rather than truncating — `briefNumber` is unbounded, and a brand with more than 999
 * briefs still names them without collision. Non-finite or non-positive values are stored as `'0'`
 * padded (`'000'`), which is the honest reading of an invalid allocation; the write path never
 * passes one, so this branch is a preview-time safeguard.
 */
function number3(value: number): string {
  const integer = Number.isInteger(value) && value > 0 ? value : 0;
  return String(integer).padStart(BRIEF_NAME_NUMBER_WIDTH, '0');
}

/**
 * The CREATE-path brief name. See the module header for the formula and the collapse rules.
 */
export function generateBriefName(args: GenerateBriefNameArgs): string {
  const source = text(args.source) ?? BRIEF_NAME_DEFAULT_SOURCE;
  // Agent 3's shipped segment emitted the raw stored key — a real retargeting brief read as
  // `TAS-Retargeting-V001-...`, not the paste's `TAS-RTG-V001-...` (Oct 6 fix).
  const funnel = funnelAbbreviation(text(args.funnel) ?? '');
  const initial = typeInitial(args.creativeType);
  const padded = number3(args.number);
  const concept = text(args.concept);
  const batch = text(args.batch);

  const head = `${initial}${padded}`;

  const segments = [
    source,
    ...(funnel === '' ? [] : [funnel]),
    head,
    ...(concept === null ? [] : [concept]),
    ...(batch === null ? [] : [batch]),
  ];
  return segments.join(BRIEF_NAME_SEPARATOR);
}
