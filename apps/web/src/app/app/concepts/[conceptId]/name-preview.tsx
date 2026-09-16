'use client';

import {
  CONCEPT_NAME_PLACEHOLDER,
  conceptName,
  missingConceptNameParts,
  type ConceptNameInput,
} from '@tas/domain/concepts';

import { NAME_GENERATED_NOTE } from '../fields';

interface NamePreviewProps {
  readonly draft: ConceptNameInput;
}

/**
 * The live auto-name (PRD §7, ticket criterion 6).
 *
 * `Batch-Angle-Theme`, built by `conceptName` from `@tas/domain/concepts` — the ONE place that
 * string is assembled. The Server Action re-computes it from the same function before it writes, so
 * what a strategist reads here and what lands in `concepts.name` cannot disagree.
 *
 * There is no input. The name is not a field that happens to be disabled: it does not exist as a
 * field at all, which is why this renders a heading and the page says so in one quiet line
 * underneath. Every part is a dropdown above it, and changing one re-renders this with no round
 * trip, because the formula is pure and runs in the browser.
 *
 * `font-mono` because it is auto-generated system output (design handoff, "Typography and shape").
 * The parts still missing are named underneath rather than left for the reader to spot among the
 * placeholders — `Theme` is also a perfectly good theme name, so "blank" is answered by
 * `missingConceptNameParts`, never by comparing the preview to the placeholder text.
 */
export function NamePreview({ draft }: NamePreviewProps) {
  const missing = missingConceptNameParts(draft);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Concept name</p>
      <h1
        data-slot="concept-name-preview"
        className="font-mono text-xl leading-snug break-words text-text sm:text-2xl"
      >
        {conceptName(draft)}
      </h1>
      <p data-slot="concept-name-note" className="text-xs text-text3">
        {NAME_GENERATED_NOTE}
      </p>
      {missing.length === 0 ? null : (
        <p data-slot="concept-name-missing" className="text-xs text-text4">
          Still to choose: {missing.map((part) => CONCEPT_NAME_PLACEHOLDER[part]).join(', ')}.
        </p>
      )}
    </div>
  );
}
