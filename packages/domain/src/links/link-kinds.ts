/**
 * Two-way links (Sprint 9, LINK-01). Every link between two tables is ONE junction table, and a
 * link kind names one direction of reading or writing it: `concept-angles` is "the angles of a
 * concept", `angle-concepts` is "the concepts of an angle", and both write `concept_angles`. The
 * registry is pure data; `@tas/db`'s `syncLinks` dispatches on it and the shared `LinkField`
 * component takes a kind, so a link edited from either side lands in the same rows and the other
 * side reads it back on its next render. Nothing is copied onto a record.
 */
export type LinkTable = 'concept' | 'angle' | 'creator' | 'product' | 'persona';

export type LinkJunction =
  'concept_angles' | 'creator_concepts' | 'creator_products' | 'angle_products' | 'angle_personas';

export interface LinkKindEntry {
  readonly kind: LinkKind;
  readonly junction: LinkJunction;
  /** The table the source id belongs to (the record the field sits on). */
  readonly source: LinkTable;
  /** The table the selected ids belong to (the options the field offers). */
  readonly target: LinkTable;
  /** The field's label on the source record's form. */
  readonly label: string;
}

export const LINK_KINDS = [
  'concept-angles',
  'angle-concepts',
  'concept-creators',
  'creator-concepts',
  'creator-products',
  'product-creators',
  'angle-products',
  'product-angles',
  'angle-personas',
  'persona-angles',
] as const;

export type LinkKind = (typeof LINK_KINDS)[number];

export const LINK_REGISTRY: Readonly<Record<LinkKind, LinkKindEntry>> = {
  'concept-angles': {
    kind: 'concept-angles',
    junction: 'concept_angles',
    source: 'concept',
    target: 'angle',
    label: 'Angles',
  },
  'angle-concepts': {
    kind: 'angle-concepts',
    junction: 'concept_angles',
    source: 'angle',
    target: 'concept',
    label: 'Concepts',
  },
  'concept-creators': {
    kind: 'concept-creators',
    junction: 'creator_concepts',
    source: 'concept',
    target: 'creator',
    label: 'Creators',
  },
  'creator-concepts': {
    kind: 'creator-concepts',
    junction: 'creator_concepts',
    source: 'creator',
    target: 'concept',
    label: 'Concepts',
  },
  /**
   * `creator_products` — the product a creator is booked for (PRD §5.1 / §5.6). It was the odd one
   * out: the creator panel wrote it through a row of toggle buttons of its own and the product panel
   * said "Link one from the creator's panel", so the same junction had one editable end and one
   * sentence pointing at it. It is the same control on both sides now.
   */
  'creator-products': {
    kind: 'creator-products',
    junction: 'creator_products',
    source: 'creator',
    target: 'product',
    label: 'Products',
  },
  'product-creators': {
    kind: 'product-creators',
    junction: 'creator_products',
    source: 'product',
    target: 'creator',
    label: 'Creators',
  },
  'angle-products': {
    kind: 'angle-products',
    junction: 'angle_products',
    source: 'angle',
    target: 'product',
    label: 'Products',
  },
  'product-angles': {
    kind: 'product-angles',
    junction: 'angle_products',
    source: 'product',
    target: 'angle',
    label: 'Angles',
  },
  'angle-personas': {
    kind: 'angle-personas',
    junction: 'angle_personas',
    source: 'angle',
    target: 'persona',
    label: 'Personas',
  },
  'persona-angles': {
    kind: 'persona-angles',
    junction: 'angle_personas',
    source: 'persona',
    target: 'angle',
    label: 'Angles',
  },
};

export function isLinkKind(value: string): value is LinkKind {
  return (LINK_KINDS as readonly string[]).includes(value);
}

/** The same junction read from the other side: `concept-angles` ↔ `angle-concepts`. */
export function inverseLinkKind(kind: LinkKind): LinkKind {
  const entry = LINK_REGISTRY[kind];
  const inverse = LINK_KINDS.find(
    (candidate) =>
      candidate !== kind &&
      LINK_REGISTRY[candidate].junction === entry.junction &&
      LINK_REGISTRY[candidate].source === entry.target,
  );
  if (inverse === undefined) throw new Error(`link kind ${kind} has no inverse`);
  return inverse;
}

/**
 * The ids a link write ends with: de-duplicated, blanks dropped, order kept. A pure function so the
 * action, the component's optimistic state and the test all agree on what "the same selection" is.
 */
export function normaliseLinkIds(ids: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    if (id === '' || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
