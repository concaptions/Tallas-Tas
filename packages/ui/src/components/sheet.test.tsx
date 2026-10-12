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
});
