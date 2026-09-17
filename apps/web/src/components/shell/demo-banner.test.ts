import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { DemoBanner } from './demo-banner';

/** Only what this test reads; the element is a `ReactElement<any>` until it is given a shape. */
interface BannerProps {
  readonly className: string;
  readonly style?: unknown;
  readonly role?: string;
}

/**
 * The banner is a single element, so the element itself is the contract and no DOM is needed:
 * `DemoBanner()` returns it and its props are what the page gets.
 *
 * What this guards is CLAUDE.md "UI governance" rule 1. The banner used to set its colour with an
 * inline `style` holding `var(--info)` and two `color-mix()` calls, which `no-hex.test.ts` cannot
 * see — an inline style carrying a token var has no hex in it — and which no utility class can
 * override. Colour now arrives as Tailwind semantic classes, and a regression to a style object
 * fails here.
 */
describe('DemoBanner', () => {
  const element = DemoBanner() as ReactElement<BannerProps>;
  const { className, style, role } = element.props;

  it('sets no inline style: colour comes from the token layer', () => {
    expect(style).toBeUndefined();
  });

  it('takes tint, rule and text from the info token through semantic classes', () => {
    expect(className.split(' ')).toEqual(
      expect.arrayContaining(['text-info', 'bg-info/12', 'border-info/30']),
    );
  });

  it('names no colour of its own', () => {
    expect(className).not.toMatch(/#[0-9a-fA-F]{3}|rgb\(|color-mix\(|var\(/);
  });

  it('is a status region, so a screen reader announces the demo state', () => {
    expect(role).toBe('status');
  });
});
