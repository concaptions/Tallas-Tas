import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  sheetVariants,
} from './sheet';

/**
 * The Sheet (Oct 12 scope 2): a real dialog — role, accessible name, close control — pinned to an
 * edge. The right edge is the default because the Brief row sidebar is the one caller today.
 */
describe('Sheet', () => {
  it('renders an open sheet as a dialog named by its title, pinned to the right by default', () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>TV01-B3-CasualHangouts-V2-GratsiRED</SheetTitle>
            <SheetDescription>Every field of the creative.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );

    const dialog = screen.getByRole('dialog', { name: 'TV01-B3-CasualHangouts-V2-GratsiRED' });
    expect(dialog.getAttribute('data-slot')).toBe('sheet-content');
    expect(dialog.getAttribute('data-side')).toBe('right');
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('places each side on its own edge, from the token layer only', () => {
    expect(sheetVariants({ side: 'right' })).toContain('right-0');
    expect(sheetVariants({ side: 'left' })).toContain('left-0');
    expect(sheetVariants({ side: 'top' })).toContain('top-0');
    expect(sheetVariants({ side: 'bottom' })).toContain('bottom-0');
    expect(sheetVariants()).toContain('bg-surface');
    expect(sheetVariants()).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  /**
   * B2.V2: the board's sheet casts a long LEFTWARD shadow onto the dimmed grid (`--shadow-sheet`),
   * which Tailwind's downward `shadow-lg` cannot express. The edge sheets keep `shadow-lg`.
   */
  it('casts the sheet shadow from the side edges and the plain one from top and bottom', () => {
    expect(sheetVariants({ side: 'right' })).toContain('shadow-sheet');
    expect(sheetVariants({ side: 'left' })).toContain('shadow-sheet');
    expect(sheetVariants({ side: 'right' })).not.toContain('shadow-lg');
    expect(sheetVariants({ side: 'top' })).toContain('shadow-lg');
    expect(sheetVariants({ side: 'bottom' })).toContain('shadow-lg');
    expect(sheetVariants({ side: 'top' })).not.toContain('shadow-sheet');
  });

  it('holds no colour literal in the rendered dialog', () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>TV01-B3-CasualHangouts-V2-GratsiRED</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );

    expect(document.body.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });
});
