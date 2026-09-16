/**
 * The concept naming formula (PRD §7, CLAUDE.md non-negotiable 6): `Batch-Angle-Theme`, e.g.
 * `B2-I Want To Play With My Kid-Problem/Solution`.
 *
 * This is the ONLY place that string is built. The detail page renders the live preview from here,
 * the Server Action re-computes it from here before it writes, and `seed()` / the demo fixtures use
 * the same formula — because a name the user never types is a name nothing may reconstruct by hand
 * (`packages/db/src/demo-data.ts` keeps a two-line copy solely because `@tas/db` does not depend on
 * `@tas/domain`, and `apps/web` asserts the two equal).
 *
 * Pure: it reads three strings and returns one. No lookup, no database, and — importantly — no
 * throw. The page calls it on every keystroke of a half-filled form, so an incomplete draft has to
 * return something renderable rather than an exception.
 */

/** The one separator, exported so nothing re-types the hyphen when it splits a name back apart. */
export const CONCEPT_NAME_SEPARATOR = '-';

/**
 * What stands in for a part the strategist has not chosen yet.
 *
 * The placeholders are the formula's own words, so an untouched draft previews exactly
 * `Batch-Angle-Theme` — the PRD's statement of the rule — and each choice replaces one segment in
 * place. That is what "shows what is still needed" means here: the preview never hides a missing
 * part behind a silently shorter name, and the strategist can read off which of the three is still
 * blank without a second message next to the field.
 */
export const CONCEPT_NAME_PLACEHOLDER = {
  batch: 'Batch',
  angleName: 'Angle',
  themeName: 'Theme',
} as const satisfies Record<ConceptNamePart, string>;

/** The three inputs to the name, in the order they appear in it. */
export const CONCEPT_NAME_PARTS = ['batch', 'angleName', 'themeName'] as const;

export type ConceptNamePart = (typeof CONCEPT_NAME_PARTS)[number];

/**
 * A draft's three name inputs. Every one is optional and nullable: the detail page starts with all
 * three empty, and a `<select>`'s "not chosen" is `null` while a freshly mounted field is
 * `undefined`. Both mean the same thing here.
 */
export type ConceptNameInput = {
  readonly [Part in ConceptNamePart]?: string | null;
};

/** A part counts as chosen only once it has non-whitespace text in it. */
function chosen(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/**
 * The parts that are still blank, in name order. Empty when the name is complete.
 *
 * The page uses it to say what is missing and the validator uses it to refuse a save; neither
 * re-derives "blank" from the placeholder text, which would misfire the moment a strategist names
 * a theme `Theme`.
 */
export function missingConceptNameParts(input: ConceptNameInput): readonly ConceptNamePart[] {
  return CONCEPT_NAME_PARTS.filter((part) => chosen(input[part]) === null);
}

/** True when all three parts are chosen, i.e. when `conceptName` returns a real name. */
export function isConceptNameComplete(input: ConceptNameInput): boolean {
  return missingConceptNameParts(input).length === 0;
}

/**
 * `Batch-Angle-Theme`.
 *
 * Every part is trimmed, so a pasted theme name with a trailing space cannot produce a name that
 * differs invisibly from the same concept created a minute earlier. Nothing else is normalised: the
 * angle and theme names go in exactly as their owners wrote them, punctuation and all, which is why
 * `Problem/Solution` survives and why a name is not a slug.
 *
 * A missing part becomes its placeholder rather than an empty segment, so the preview keeps all
 * three positions and the hyphens never collapse. Callers that need to know whether they are
 * looking at a real name or a preview ask `isConceptNameComplete`; a write path asks
 * `validateConceptDraft`, which refuses long before this function is asked for a string.
 */
export function conceptName(input: ConceptNameInput): string {
  return CONCEPT_NAME_PARTS.map(
    (part) => chosen(input[part]) ?? CONCEPT_NAME_PLACEHOLDER[part],
  ).join(CONCEPT_NAME_SEPARATOR);
}
