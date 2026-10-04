import { describe, expect, it } from 'vitest';

import { DEMO_ACTOR } from '@/lib/demo-mode';

import { OrgSwitcher } from './org-switcher';
import { TopBar } from './top-bar';

/** Every element in the returned tree. No DOM: this app has no renderer. */
function* elements(node: unknown): Generator<{ type: unknown; props: Record<string, unknown> }> {
  if (Array.isArray(node)) {
    for (const child of node) {
      yield* elements(child);
    }
    return;
  }
  if (typeof node === 'object' && node !== null && 'props' in node) {
    const element = node as { type: unknown; props: Record<string, unknown> };
    yield element;
    yield* elements(element.props.children);
  }
}

function mounts(node: unknown, component: unknown): boolean {
  return [...elements(node)].some((element) => element.type === component);
}

const BRAND = {
  id: '11111111-1111-4111-8111-000000000001',
  name: 'Niagara',
  status: 'active',
  isTemplate: false,
};
const SCOPE = { active: BRAND, options: [BRAND] };

describe('TopBar', () => {
  it('mounts the organization switcher for a real session', () => {
    const tree = TopBar({ brands: SCOPE, actor: DEMO_ACTOR, demo: false });

    expect(mounts(tree, OrgSwitcher)).toBe(true);
  });

  /**
   * Not cosmetic. `OrgSwitcher` renders Clerk components, which read a `ClerkProvider` the root
   * layout does not render without a publishable key — mounting it in demo mode throws and takes
   * the whole shell down, on every page.
   */
  it('does not mount it in demo mode, where there is no ClerkProvider to read', () => {
    const tree = TopBar({ brands: SCOPE, actor: DEMO_ACTOR, demo: true });

    expect(mounts(tree, OrgSwitcher)).toBe(false);
  });

  /**
   * AI-13: the bar is a primary brand surface — the gradient utility, never a hex — and it pins
   * dark tokens on itself so its children stay light-on-dark over the saturated purple in BOTH
   * themes. Dropping either half regresses a different thing: the class loses the gradient, the
   * attribute loses light-mode legibility.
   */
  it('paints the brand gradient and pins dark tokens for legibility in both themes (AI-13)', () => {
    const header = [...elements(TopBar({ brands: SCOPE, actor: DEMO_ACTOR, demo: true }))].find(
      (element) => element.props['data-slot'] === 'shell-top-bar',
    );
    if (header === undefined) throw new Error('no shell-top-bar element');

    const className = header.props.className as string;
    expect(className).toContain('bg-brand-gradient');
    expect(className).not.toContain('bg-surface');
    expect(header.props['data-theme']).toBe('dark');
  });
});
