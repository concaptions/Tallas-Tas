// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEMO_ACTOR } from '@/lib/demo-mode';

import { navGroupsForView } from '../nav';
import { BoldShell } from './bold-shell';
import { BoldSidebar } from './bold-sidebar';

import type { BrandScope, BrandSummary } from '@/lib/data-source';

vi.mock('next/navigation', () => ({ usePathname: () => '/app' }));

const TEMPLATE: BrandSummary = {
  id: '11111111-1111-4111-8111-000000000000',
  name: 'TAS Template',
  status: 'active',
  isTemplate: true,
};
const SCOPE: BrandScope = { active: TEMPLATE, options: [TEMPLATE] };

const shell = (
  <BoldShell brands={SCOPE} actor={DEMO_ACTOR} demo role="admin">
    <p>page</p>
  </BoldShell>
);

const noop = () => undefined;

function renderRail(brands: readonly BrandSummary[] = [TEMPLATE]) {
  return render(
    <BoldSidebar
      role="admin"
      isTemplate
      brands={brands}
      activeBrandId={TEMPLATE.id}
      actor={DEMO_ACTOR}
      demo
      open={false}
      onClose={noop}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe('BoldShell overlay nav (commit 2b)', () => {
  it('opens from the hamburger, then closes on Escape', () => {
    const { container, getByLabelText } = render(shell);
    const sidebar = () => container.querySelector('[data-slot="bold-sidebar"]');
    const scrim = () => container.querySelector('[data-slot="bold-nav-scrim"]');

    // Closed: the rail carries the hidden class (desktop re-shows it via min-[901px]:flex).
    expect(sidebar()?.className).toContain('hidden');
    expect(scrim()).toBeNull();

    fireEvent.click(getByLabelText('Open navigation'));
    expect(sidebar()?.className).not.toContain('hidden');
    expect(scrim()).not.toBeNull();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(sidebar()?.className).toContain('hidden');
    expect(scrim()).toBeNull();
  });

  it('closes on a scrim click — the outside-click', () => {
    const { container, getByLabelText } = render(shell);
    fireEvent.click(getByLabelText('Open navigation'));

    const scrim = container.querySelector('[data-slot="bold-nav-scrim"]');
    if (scrim === null) throw new Error('no scrim while open');
    fireEvent.click(scrim);

    expect(container.querySelector('[data-slot="bold-nav-scrim"]')).toBeNull();
    expect(container.querySelector('[data-slot="bold-sidebar"]')?.className).toContain('hidden');
  });
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
