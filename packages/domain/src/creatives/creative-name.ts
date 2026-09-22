/**
 * The creative naming formula (PRD §7, CLAUDE.md non-negotiable 4): auto-generated, never typed by a
 * user.
 *
 *     {FUNNEL}{FORMAT}{NUMBER}-{BATCH}-{CONCEPT NAME}-V{VERSION}-({PRODUCT})
 *     TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2
 *     AV1-B1-Less Pressure Means Less Pain-Educational Content-V1   ← PRD §7's own example
 *
 * This is the ONLY place that string is built. The detail page renders the live preview from here
 * (the Version dropdown in ticket criterion 7 changes the name with no round trip because this
 * function is pure), the Server Action re-computes it from here before it writes, and `seed()` /
 * the demo fixtures use the same formula — `packages/db/src/demo-data.ts` keeps a two-line copy
 * solely because `@tas/db` does not depend on `@tas/domain`, and `apps/web` asserts the two equal,
 * exactly the arrangement `conceptName` already documents.
 *
 * Pure: it reads a handful of strings and numbers and returns one string. No lookup, no database,
 * and — importantly — no throw. The page calls it on every change of a half-filled form, so an
 * incomplete draft has to return something renderable rather than an exception.
 */

import {
  creativeFunnelEntry,
  creativeTypeEntry,
  type CreativeFunnelKey,
  type CreativeTypeKey,
} from './vocabulary';

/** The one separator, exported so nothing re-types the hyphen when it splits a name back apart. */
export const CREATIVE_NAME_SEPARATOR = '-';

/**
 * What stands in the CONCEPT NAME segment when a brief has no parent concept (PRD §8: "a Creative
 * Brief must be able to exist WITHOUT a parent concept"; CLAUDE.md non-negotiable 5).
 *
 * A standalone static still needs a name and the name still has to have that segment, so the slug
 * fills it rather than the formula collapsing a hyphen or throwing. The same literal is
 * `STANDALONE_CONCEPT_SLUG` in `packages/db/src/demo-data.ts`, for the dependency-edge reason above;
 * the list page renders the matching "Standalone" chip from this constant too, so the cell and the
 * name can never disagree.
 */
export const STANDALONE_CONCEPT_SLUG = 'Standalone';

/**
 * What stands in for a part that has not been chosen yet. A single `?` for the three segments that
 * are a code or a number, and the formula's own word for the batch — so an untouched draft previews
 * as `???-Batch-Standalone-V?` and each choice replaces one position in place, without the name
 * losing a segment or a hyphen.
 */
export const CREATIVE_NAME_PLACEHOLDER = {
  funnel: '?',
  format: '?',
  number: '?',
  batch: 'Batch',
  version: '?',
} as const;

/** The parts of the name that must be chosen before it is a real name, in the order they appear. */
export const CREATIVE_NAME_PARTS = ['funnel', 'format', 'number', 'batch', 'version'] as const;

export type CreativeNamePart = (typeof CREATIVE_NAME_PARTS)[number];

/**
 * The formula's inputs.
 *
 * `conceptName` and `product` are deliberately NOT in `CREATIVE_NAME_PARTS`: a missing concept is
 * the standalone case, not an unfinished draft, and the product suffix is optional in §7 ("if
 * needed") — it disambiguates a creative whose concept does not already name the product, which in
 * practice is the standalone static.
 *
 * Every field is optional and nullable: a `<select>`'s "not chosen" is `null` while a freshly
 * mounted field is `undefined`, and both mean the same thing here.
 */
export interface CreativeNameInput {
  /** PRD §7: "optionally prefixed with source." A `creativeSources` key (e.g. `'TAS'`). */
  readonly source?: string | null;
  /** A `CREATIVE_FUNNELS` key; supplies the first letter. */
  readonly funnel?: string | null;
  /** A `CREATIVE_TYPES` key; supplies the second letter. §7 calls it the FORMAT. */
  readonly format?: string | null;
  /** The per-brand, per-funnel-and-format NUMBER; see `nextSequence`. */
  readonly number?: number | null;
  readonly batch?: string | null;
  /** The concept's `Angle-Theme` segment — `conceptNameSegment`, not the concept's whole name. */
  readonly conceptName?: string | null;
  readonly version?: number | null;
  /** The optional §7 suffix. Blank and absent are the same thing: no suffix. */
  readonly product?: string | null;
}

/** A text part counts as chosen only once it has non-whitespace in it. */
function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/** A number part counts as chosen only as a finite, positive integer. `0` is not a §7 number. */
function counter(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return Number.isInteger(value) && value > 0 ? value : null;
}

/** The chosen value of each part, or `null`; one place so the formula and the checks agree. */
function parts(input: CreativeNameInput): Readonly<Record<CreativeNamePart, string | null>> {
  return {
    funnel: creativeFunnelEntry(text(input.funnel) ?? '')?.letter ?? null,
    format: creativeTypeEntry(text(input.format) ?? '')?.letter ?? null,
    number: counter(input.number)?.toString() ?? null,
    batch: text(input.batch),
    version: counter(input.version)?.toString() ?? null,
  };
}

/**
 * The parts that are still blank, in name order. Empty when the name is complete.
 *
 * A funnel or a type this build does not know counts as blank: the name takes a LETTER from those
 * vocabularies, and there is no letter for a value that is not in them.
 */
export function missingCreativeNameParts(input: CreativeNameInput): readonly CreativeNamePart[] {
  const chosen = parts(input);
  return CREATIVE_NAME_PARTS.filter((part) => chosen[part] === null);
}

/** True when every required part is chosen, i.e. when `creativeName` returns a real name. */
export function isCreativeNameComplete(input: CreativeNameInput): boolean {
  return missingCreativeNameParts(input).length === 0;
}

/**
 * PRD §7's creative name.
 *
 * The concept segment is `STANDALONE_CONCEPT_SLUG` when there is no concept — the §8 case the whole
 * nullable link exists for — and the product suffix is appended only when a product is given. Every
 * part is trimmed, so a pasted trailing space cannot produce a name that differs invisibly from the
 * same creative named a minute earlier; nothing else is normalised, which is why `POV: X vs Y`
 * survives intact and why a name is not a slug.
 *
 * A missing required part becomes its placeholder rather than an empty segment, so the preview keeps
 * every position and the hyphens never collapse. Callers that need to know whether they are looking
 * at a real name or a preview ask `isCreativeNameComplete`.
 */
export function creativeName(input: CreativeNameInput): string {
  const chosen = parts(input);
  const head = CREATIVE_NAME_PARTS.slice(0, 3)
    .map((part) => chosen[part] ?? CREATIVE_NAME_PLACEHOLDER[part])
    .join('');
  const batch = chosen.batch ?? CREATIVE_NAME_PLACEHOLDER.batch;
  const concept = text(input.conceptName) ?? STANDALONE_CONCEPT_SLUG;
  const version = `V${chosen.version ?? CREATIVE_NAME_PLACEHOLDER.version}`;
  const product = text(input.product);
  const source = text(input.source);

  const segments = [
    ...(source === null ? [] : [source]),
    head,
    batch,
    concept,
    version,
    ...(product === null ? [] : [product]),
  ];
  return segments.join(CREATIVE_NAME_SEPARATOR);
}

/**
 * The CONCEPT NAME segment of a creative name: the concept's own generated `Batch-Angle-Theme` name
 * with its batch prefix removed, because the batch is already the segment before it.
 *
 * PRD §7's second example — `AV1-B1-Less Pressure Means Less Pain-Educational Content-V1` — is
 * exactly this: the batch once, then the Angle-Theme pairing. A concept whose name does not start
 * with its batch (an older row, or one renamed by hand before the formula existed) is used whole
 * rather than truncated at a guess.
 */
export function conceptNameSegment(concept: {
  readonly name?: string | null;
  readonly batch?: string | null;
}): string | null {
  const name = text(concept.name);
  if (name === null) {
    return null;
  }
  const batch = text(concept.batch);
  const prefix = batch === null ? null : `${batch}${CREATIVE_NAME_SEPARATOR}`;
  return prefix !== null && name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

/**
 * The name of a brief built on a concept, in one call: the §7 formula with the concept's
 * `Angle-Theme` segment and the concept's batch already pulled out of the row.
 *
 * Passing `concept: null` is the standalone case and is not an error — the slug fills the segment
 * and the caller's own `batch` is used, because a standalone brief has no concept to copy one from.
 */
export function creativeNameForConcept(
  concept: { readonly name?: string | null; readonly batch?: string | null } | null,
  spec: Omit<CreativeNameInput, 'conceptName' | 'batch'> & { readonly batch?: string | null },
): string {
  return creativeName({
    ...spec,
    source: spec.source,
    batch: spec.batch ?? concept?.batch ?? null,
    conceptName: concept === null ? null : conceptNameSegment(concept),
  });
}

/** The NUMBER the first brief of a funnel-and-format pair gets. §7 counts from one, not from zero. */
export const CREATIVE_SEQUENCE_START = 1;

/**
 * A row `nextSequence` can count. Shaped to match `BriefListRow` from `@tas/db` field for field, so
 * the page and the Server Action hand it the rows they already have rather than mapping first.
 */
export interface CreativeSequenceRow {
  readonly funnel: string;
  readonly type: string;
  readonly sequence: number;
}

/**
 * The next NUMBER for a funnel-and-format pair (PRD §7: "the number increments per combination"
 * within the brand).
 *
 * It is `max + 1`, not `count + 1`: a row keeps the number it was given even after an earlier brief
 * is soft-deleted, and a `count` would silently hand the same number out twice — the reason
 * `schema/briefs.ts` stores `sequence` as its own column instead of deriving it. A gap left by a
 * deleted row therefore stays a gap, which is the correct answer for a name that is already printed
 * on a file somewhere.
 *
 * `existing` is the whole brand's briefs; the filtering is done here so no caller writes the pair
 * comparison itself. Rows with a sequence that is not a positive integer are ignored rather than
 * poisoning the maximum.
 */
export function nextSequence(
  existing: readonly CreativeSequenceRow[],
  funnel: CreativeFunnelKey,
  format: CreativeTypeKey,
): number {
  const used = existing
    .filter((row) => row.funnel === funnel && row.type === format)
    .map((row) => counter(row.sequence))
    .filter((value): value is number => value !== null);

  return used.length === 0 ? CREATIVE_SEQUENCE_START : Math.max(...used) + 1;
}
