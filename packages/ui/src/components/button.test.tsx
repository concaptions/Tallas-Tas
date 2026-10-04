import { describe, expect, it } from 'vitest';

import { buttonVariants } from './button';

/**
 * AI-13: the primary CTA carries the signature purple gradient. `.bg-brand-gradient` is the
 * utility the token layer names for `--accent-gradient` (tokens.css); these tests pin WHERE it is
 * allowed to appear — the default variant, and only there — and that the states around it stay
 * sane: a token fallback colour underneath, a hover that is visible OVER a background-image (a
 * `bg-accent/90` hover only repaints the colour hidden under the gradient, so it must be gone),
 * and the shared disabled treatment.
 */
describe('buttonVariants · the brand-gradient CTA (AI-13)', () => {
  it('paints the default variant with the gradient over the accent fallback, text on `text-bg`', () => {
    const classes = buttonVariants();

    expect(classes).toContain('bg-brand-gradient');
    expect(classes).toContain('bg-accent');
    expect(classes).toContain('text-bg');
  });

  it('hovers by opacity — a colour hover under a background-image would be invisible', () => {
    const classes = buttonVariants();

    expect(classes).toContain('hover:opacity-90');
    expect(classes).not.toContain('hover:bg-accent/90');
  });

  it('keeps the shared disabled treatment, which still reads over a gradient', () => {
    expect(buttonVariants()).toContain('disabled:opacity-50');
  });

  it('leaves every other variant gradient-free: the gradient marks THE primary action alone', () => {
    for (const variant of ['destructive', 'outline', 'secondary', 'ghost', 'link'] as const) {
      expect(buttonVariants({ variant }), variant).not.toContain('bg-brand-gradient');
    }
  });

  it('never rounds a button full: the radius stays rounded-input in every size', () => {
    for (const size of ['default', 'sm', 'lg', 'icon'] as const) {
      const classes = buttonVariants({ size });
      expect(classes, size).toContain('rounded-input');
      expect(classes, size).not.toContain('rounded-full');
    }
  });
});
