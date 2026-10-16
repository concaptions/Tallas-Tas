import type { CSSProperties } from 'react';

import { cn } from '../lib/cn';

/** The four creative aspect ratios the product names (spec §3.10). */
export type ArGlyphRatio = '9:16' | '4:5' | '1:1' | '16:9';

/**
 * Each ratio as a mini-rectangle, longest edge pinned to 14px so the glyphs line up on a row.
 * Exported for the dimension picker (commit 4), which sizes its toggle buttons off the same table.
 */
export const AR_GLYPH_BOX: Record<ArGlyphRatio, { readonly w: number; readonly h: number }> = {
  '9:16': { w: 8, h: 14 },
  '4:5': { w: 11, h: 14 },
  '1:1': { w: 12, h: 12 },
  '16:9': { w: 14, h: 8 },
};

export interface ArGlyphProps {
  readonly ratio: ArGlyphRatio;
  readonly className?: string;
}

/**
 * The aspect-ratio glyph `.ar` (redesign commit 3, spec §3.10): a bordered mini-rect beside the
 * mono ratio label. Bold-only and purely presentational; the drawer's dimension picker and the
 * grid's dims cell mount it in commits 4–5. The rect inherits `currentColor`, so a toned parent
 * re-paints frame and label together.
 */
export function ArGlyph({ ratio, className }: ArGlyphProps) {
  const box = AR_GLYPH_BOX[ratio];
  const style: CSSProperties = { width: `${String(box.w)}px`, height: `${String(box.h)}px` };
  return (
    <span
      data-slot="ar-glyph"
      className={cn('inline-flex items-center gap-1.5 font-mono text-[11px] text-text3', className)}
    >
      <span
        aria-hidden="true"
        className="shrink-0 rounded-[3px] border border-current"
        style={style}
      />
      {ratio}
    </span>
  );
}
