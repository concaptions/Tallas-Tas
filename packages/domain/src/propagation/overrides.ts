/**
 * Override tracking (CLAUDE.md architecture: "`overridden_fields` jsonb listing locally edited
 * fields"; the propagation engine "skips these fields when pushing template updates").
 *
 * A child row is seeded from the parent template with `overridden_fields = []`. When a brand edits
 * that child row locally, every field they change has to be recorded here, so the next propagation
 * of the parent row leaves the local edit alone. This is the ONE place that set is maintained, and
 * it is a pure function: it is given the fields an edit touched and returns the new set.
 *
 * The set is NOT inferred by the propagation engine from a value comparison, and deliberately so: a
 * later change to the PARENT also makes the child's stored value differ from the template's, and the
 * engine could not tell that apart from a local edit — it would wrongly protect a field the parent
 * meant to push. Only the edit site knows which fields the brand actually changed, so the edit site
 * is where this runs.
 *
 * A field that an edit sets BACK to the template's current value is removed from the set rather than
 * added: it is in sync again, so propagation should resume owning it. The caller supplies that
 * judgement through `matchesTemplate`, because only the write path has both values in hand.
 */

export interface ComputeOverridesInput {
  /** The child row's current `overridden_fields`. */
  readonly current: readonly string[];
  /** The field names this edit changed on the child row. */
  readonly edited: readonly string[];
  /**
   * Optional: whether an edited field's NEW value equals the template row's current value. A field
   * for which this returns true is dropped from the set (back in sync); every other edited field is
   * added. Omitted entirely, every edited field is treated as a divergence and added.
   */
  readonly matchesTemplate?: (field: string) => boolean;
}

/**
 * The child row's new `overridden_fields`: its current set, plus every edited field that diverges
 * from the template, minus every edited field the caller reports back in sync. Sorted and
 * deduplicated so the stored array is stable and two equal sets compare equal.
 */
export function computeOverrides(input: ComputeOverridesInput): string[] {
  const next = new Set(input.current);
  for (const field of input.edited) {
    if (input.matchesTemplate?.(field) === true) {
      next.delete(field);
    } else {
      next.add(field);
    }
  }
  return [...next].sort();
}

/** Whether a child row carries any local override — the badge and the Overrides view read this. */
export function hasOverrides(overriddenFields: readonly string[]): boolean {
  return overriddenFields.length > 0;
}
