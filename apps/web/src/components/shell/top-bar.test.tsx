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

const BRAND = { id: '11111111-1111-4111-8111-000000000001', name: 'Niagara', status: 'active' };

describe('TopBar', () => {
  it('mounts the organization switcher for a real session', () => {
    const tree = TopBar({ brand: BRAND, actor: DEMO_ACTOR, demo: false });

    expect(mounts(tree, OrgSwitcher)).toBe(true);
  });

  /**
   * Not cosmetic. `OrgSwitcher` renders Clerk components, which read a `ClerkProvider` the root
   * layout does not render without a publishable key — mounting it in demo mode throws and takes
   * the whole shell down, on every page.
   */
  it('does not mount it in demo mode, where there is no ClerkProvider to read', () => {
    const tree = TopBar({ brand: BRAND, actor: DEMO_ACTOR, demo: true });

    expect(mounts(tree, OrgSwitcher)).toBe(false);
  });
});
