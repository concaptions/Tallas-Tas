/**
 * What a concept INHERITS from the angle it is paired with (PRD §5.7: "everything derivable from
 * the Angle must auto-fill", and the requirement note underneath it — half of this is manual in
 * Airtable today because the automation broke).
 *
 * Five fields: Description (the hypothesis), Pain Points, USP, Persona and Product. They are the
 * angle's, not the concept's: the concept has no column for any of them, the detail page renders
 * them read-only under the label "from Angle", and choosing a different angle replaces all five at
 * once. This function is the one list of which fields those are, so the page and the Server Action
 * cannot disagree about what is editable — a field that appears here is a field nothing may write.
 *
 * Pure and total: it reads an angle (or no angle at all) and returns five entries. The input is
 * structural rather than `@tas/db`'s `AngleListRow`, because `@tas/domain` does not depend on
 * `@tas/db`; a row from the database and a half-filled draft both satisfy it.
 */

/** The angle side of the pairing, reduced to the five fields a concept reads off it. */
export interface InheritedAngle {
  readonly description: string | null;
  readonly painPoints: string | null;
  readonly usp: string | null;
  /** The angle's persona, already resolved to a name — a concept shows the name, never the id. */
  readonly personaName: string | null;
  /** Nullable on the angle itself: an angle need not name a product (PRD §5.6). */
  readonly productName: string | null;
  /**
   * EVERY persona and product linked to the angle (Sprint 9, LINK-02): the read-only lookups the
   * concept shows, never copied onto it. Optional so a caller that resolved only the first name
   * still types; when given, the lists are what the two link rows read.
   */
  readonly personaNames?: readonly string[];
  readonly productNames?: readonly string[];
}

export type InheritedFieldKey =
  'description' | 'painPoints' | 'usp' | 'personaName' | 'productName';

export interface InheritedField {
  readonly key: InheritedFieldKey;
  /** The field's own label. The "from Angle" caption belongs to the section, not to each row. */
  readonly label: string;
  /** The angle's value, or `null` — which the page renders as the em dash from `fields.ts`. */
  readonly value: string | null;
}

/**
 * The five fields in the one order the UI renders them in: the three text fields the strategist
 * reads as prose first (hypothesis, then the pain it names, then the claim that answers it), then
 * the two links that say who it is for and what it sells.
 */
export const INHERITED_ANGLE_FIELDS = [
  { key: 'description', label: 'Description' },
  { key: 'painPoints', label: 'Pain Points' },
  { key: 'usp', label: 'USP' },
  { key: 'personaName', label: 'Persona' },
  { key: 'productName', label: 'Product' },
] as const satisfies readonly { key: InheritedFieldKey; label: string }[];

/** Just the keys, for a caller that needs to ask "is this field inherited?" of a field name. */
export const INHERITED_ANGLE_FIELD_KEYS: readonly InheritedFieldKey[] = INHERITED_ANGLE_FIELDS.map(
  (field) => field.key,
);

/** True for a field the concept reads off its angle, i.e. a field no form may make editable. */
export function isInheritedFromAngle(field: string): field is InheritedFieldKey {
  return INHERITED_ANGLE_FIELD_KEYS.includes(field as InheritedFieldKey);
}

/**
 * The five inherited fields for an angle, always all five and always in `INHERITED_ANGLE_FIELDS`
 * order.
 *
 * `null` for the angle — no angle chosen yet, or a link pointing at an angle that has since been
 * soft-deleted — yields the same five entries with `null` values rather than an empty list, so the
 * section keeps its shape while the strategist is still choosing and every row falls back to the em
 * dash. A blank or whitespace-only value is normalised to `null` for the same reason: an empty
 * string would render as a row that looks filled in and says nothing.
 */
export function inheritedFromAngle(angle: InheritedAngle | null): readonly InheritedField[] {
  return INHERITED_ANGLE_FIELDS.map((field) => {
    if (field.key === 'personaName') {
      return {
        key: field.key,
        label: field.label,
        value: joined(angle?.personaNames, angle?.personaName),
      };
    }
    if (field.key === 'productName') {
      return {
        key: field.key,
        label: field.label,
        value: joined(angle?.productNames, angle?.productName),
      };
    }
    const raw = angle?.[field.key] ?? null;
    const value = raw === null || raw.trim() === '' ? null : raw;
    return { key: field.key, label: field.label, value };
  });
}

/**
 * One read-only link row: every linked name, comma-joined, in the angle's own order; the single
 * resolved name when no list was given; `null` for the em dash when there is nothing linked.
 */
function joined(
  names: readonly string[] | undefined,
  first: string | null | undefined,
): string | null {
  const list = (names ?? []).map((name) => name.trim()).filter((name) => name !== '');
  if (list.length > 0) return list.join(', ');
  const fallback = first?.trim() ?? '';
  return fallback === '' ? null : fallback;
}
