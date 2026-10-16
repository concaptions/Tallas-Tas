// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEMO_ACTOR } from '@/lib/demo-mode';

import { navGroupsForView } from '../nav';
import { BoldSidebar } from './bold-sidebar';

import type { BrandSummary } from '@/lib/data-source';

vi.mock('next/navigation', () => ({ usePathname: () => '/app' }));

const TEMPLATE: BrandSummary = {
  id: '11111111-1111-4111-8111-000000000000',
  name: 'TAS Template',
  status: 'active',
  isTemplate: true,
};

function renderRail(brands: readonly BrandSummary[] = [TEMPLATE]) {
  return render(
    <BoldSidebar
      role="admin"
      isTemplate
      brands={brands}
      activeBrandId={TEMPLATE.id}
      actor={DEMO_ACTOR}
      demo
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe('BoldSidebar nav model', () => {
  /**
   * The rail does not fork the nav: its groups and sections are `navGroupsForView`, the exact call
   * the legacy sidebar makes, in the same order — asserted against the function itself rather than
   * a copied list, so a nav change never needs this test edited.
   */
  it('renders the shared nav model: every group label and section label, in order', () => {
    const { container } = renderRail();

    const expected = navGroupsForView('admin', true);
    expect(expected.length).toBeGreaterThan(1);

    const lists = [...container.querySelectorAll('nav[aria-label="Sections"] ul')];
    expect(lists.map((list) => list.getAttribute('aria-label'))).toEqual(
      expected.map((group) => group.label ?? null),
    );
    for (const [index, group] of expected.entries()) {
      const labels = [...(lists[index]?.querySelectorAll('li a, li div') ?? [])].map((item) =>
        item.getAttribute('title'),
      );
      expect(labels.map((title) => title?.replace(' — not available yet', ''))).toEqual(
        group.sections.map((section) => section.label),
      );
    }
  });

  it('marks the active section as the white pill on side tokens, never a hex', () => {
    const { container } = renderRail();

    const active = container.querySelector('a[aria-current="page"]');
    if (active === null) throw new Error('no active nav item on /app');
    expect(active.getAttribute('title')).toBe('Overview');
    expect(active.className).toContain('bg-side-ink');
    expect(active.className).toContain('text-side-bg');
  });

  it('reuses the brand switcher as the rail card: same menu logic, restyled trigger', () => {
    const { container, getByText } = renderRail([
      TEMPLATE,
      { ...TEMPLATE, id: 'child', name: 'Gratsi', isTemplate: false },
    ]);

    const trigger = container.querySelector('[data-slot="brand-switcher"]');
    if (trigger === null) throw new Error('no brand switcher in the rail');
    expect(trigger.className).toContain('bg-side-ink/8');
    expect(getByText('2 brands')).toBeTruthy();
  });
});
