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

  it('names the four junctions the product links through, each from both sides', () => {
    const junctions = new Set(LINK_KINDS.map((kind) => LINK_REGISTRY[kind].junction));
    expect([...junctions].sort()).toEqual([
      'angle_personas',
      'angle_products',
      'concept_angles',
      'creator_concepts',
    ]);
    expect(LINK_KINDS).toHaveLength(8);
  });

  it('guards a string and normalises an id list', () => {
    expect(isLinkKind('concept-angles')).toBe(true);
    expect(isLinkKind('concept-themes')).toBe(false);
    expect(normaliseLinkIds([' a ', 'b', 'a', '', 'b'])).toEqual(['a', 'b']);
  });
});
