import { describe, expect, it } from 'vitest';

import {
  inverseLinkKind,
  isLinkKind,
  LINK_KINDS,
  LINK_REGISTRY,
  normaliseLinkIds,
} from './link-kinds';

describe('link kinds', () => {
  it('every kind has an inverse on the same junction, and the inverse of the inverse is itself', () => {
    for (const kind of LINK_KINDS) {
      const inverse = inverseLinkKind(kind);
      expect(inverse).not.toBe(kind);
      expect(LINK_REGISTRY[inverse].junction).toBe(LINK_REGISTRY[kind].junction);
      expect(LINK_REGISTRY[inverse].source).toBe(LINK_REGISTRY[kind].target);
      expect(inverseLinkKind(inverse)).toBe(kind);
    }
  });

  it('names the five junctions the product links through, each from both sides', () => {
    const junctions = new Set(LINK_KINDS.map((kind) => LINK_REGISTRY[kind].junction));
    expect([...junctions].sort()).toEqual([
      'angle_personas',
      'angle_products',
      'concept_angles',
      'creator_concepts',
      'creator_products',
    ]);
    expect(LINK_KINDS).toHaveLength(10);
  });

  /**
   * A junction is only two-way if BOTH of its sides are registered, which is what makes one
   * `LinkField` on each panel write the same rows. `creator_products` was the counter-example: the
   * junction existed and only the creator end could edit it. The loop asserts the property for every
   * junction rather than for a list, so a one-sided kind cannot be added quietly.
   */
  it('registers both ends of every junction, each reading the other side', () => {
    const junctions = new Set(LINK_KINDS.map((kind) => LINK_REGISTRY[kind].junction));
    for (const junction of junctions) {
      const sides = LINK_KINDS.filter((kind) => LINK_REGISTRY[kind].junction === junction);
      expect(sides, junction).toHaveLength(2);
      const [first, second] = sides.map((kind) => LINK_REGISTRY[kind]);
      expect(first?.source).toBe(second?.target);
      expect(first?.target).toBe(second?.source);
    }
  });

  it('guards a string and normalises an id list', () => {
    expect(isLinkKind('concept-angles')).toBe(true);
    expect(isLinkKind('concept-themes')).toBe(false);
    expect(normaliseLinkIds([' a ', 'b', 'a', '', 'b'])).toEqual(['a', 'b']);
  });
});
