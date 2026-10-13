import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Button, buttonVariants } from './button';

/**
 * AI-13: the primary CTA carries the signature purple gradient. `.bg-brand-gradient` is the
 * utility the token layer names for `--accent-gradient` (tokens.css); these tests pin WHERE it is
 * allowed to appear — the default variant, and only there — and that the states around it stay
 * sane: a token fallback colour underneath, a hover that is visible OVER a background-image (a
 * `bg-accent/90` hover only repaints the colour hidden under the gradient, so it must be gone),
 * and the shared disabled treatment.
 */
describe('buttonVariants · the brand-gradient CTA (AI-13)', () => {
  /**
   * B1.V2: the ink is `--on-accent` (white in both palettes), never `text-bg`, which is white in
   * light mode and near-black on purple in dark mode — the opposite of every board.
   */
  it('paints the default variant with the gradient over the accent fallback, ink on `text-on-accent`', () => {
    const classes = buttonVariants();

    expect(classes).toContain('bg-brand-gradient');
    expect(classes).toContain('bg-accent');
    expect(classes).toContain('text-on-accent');
    expect(classes).not.toContain('text-bg');
  });

  it('inks the destructive variant with the same token', () => {
    const classes = buttonVariants({ variant: 'destructive' });

    expect(classes).toContain('bg-bad');
    expect(classes).toContain('text-on-accent');
    expect(classes).not.toContain('text-bg');
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
    for (const variant of [
      'destructive',
      'success',
      'outline',
      'secondary',
      'ghost',
      'link',
    ] as const) {
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

/**
 * B1.V1 (must): the enabled Approve button on board 1 — a solid `--ok` fill, `--ok` border, 600
 * weight, near-black ink. The ink is the `--on-ok` token: `--ok` is not re-themed, so its ink must
 * stay dark in BOTH palettes, which `text-bg` (white in light) cannot do.
 */
describe('buttonVariants · the success variant (B1.V1)', () => {
  it('fills with --ok, borders with --ok, inks with --on-ok, and weighs 600', () => {
    const classes = buttonVariants({ variant: 'success' });

    expect(classes).toContain('bg-ok');
    expect(classes).toContain('border-ok');
    expect(classes).toContain('text-on-ok');
    expect(classes).toContain('font-semibold');
    expect(classes).toContain('hover:opacity-90');
    expect(classes).toContain('focus-visible:ring-ok/20');
    expect(classes).not.toContain('text-bg');
    expect(classes).not.toContain('text-ok');
  });

  it('renders every filled variant without a colour literal', () => {
    const html = renderToStaticMarkup(
      <>
        <Button>Submit to Client</Button>
        <Button variant="success">Approve</Button>
        <Button variant="destructive">Delete</Button>
      </>,
    );

    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
    expect(html).toContain('text-on-ok');
    expect(html).toContain('text-on-accent');
  });
});
