import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AR_GLYPH_BOX, ArGlyph, type ArGlyphRatio } from './ar-glyph';

describe('ArGlyph', () => {
  const ratios = Object.keys(AR_GLYPH_BOX) as ArGlyphRatio[];

  it('covers the four ratios the product names', () => {
    expect(ratios).toEqual(['9:16', '4:5', '1:1', '16:9']);
  });

  for (const ratio of ratios) {
    it(`draws ${ratio} as a mini-rect of the right proportion beside the mono label`, () => {
      render(<ArGlyph ratio={ratio} />);
      const glyph = screen.getByText(ratio);
      expect(glyph.className).toContain('font-mono');
      const rect = glyph.firstElementChild as HTMLElement;
      expect(rect.getAttribute('aria-hidden')).toBe('true');
      const box = AR_GLYPH_BOX[ratio];
      expect(rect.style.width).toBe(`${String(box.w)}px`);
      expect(rect.style.height).toBe(`${String(box.h)}px`);
      // Longest edge pinned to 14px keeps the glyphs aligned on a row.
      expect(Math.max(box.w, box.h)).toBeLessThanOrEqual(14);
    });
  }
});
