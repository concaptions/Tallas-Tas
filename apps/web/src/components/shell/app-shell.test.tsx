// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DEMO_ACTOR } from '@/lib/demo-mode';
import { uiScope } from '@/lib/ui-scope';

import { AppShell } from './app-shell';
import { DemoBanner } from './demo-banner';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';

import type { BrandScope } from '@/lib/data-source';

vi.mock('next/navigation', () => ({ usePathname: () => '/app' }));

const TEMPLATE = {
  id: '11111111-1111-4111-8111-000000000000',
  name: 'TAS Template',
  status: 'active',
  isTemplate: true,
};
const CHILD = {
  id: '11111111-1111-4111-8111-000000000001',
  name: 'Gratsi',
  status: 'active',
  isTemplate: false,
};

const scopeOf = (active: typeof CHILD): BrandScope => ({
  active,
  options: [TEMPLATE, CHILD],
});

/**
 * The commit-2 rollout constraint (bold-redesign-spec.md): the Bold shell appears exactly where the
 * Bold tokens do — the template brand — and a child brand's chrome is BYTE-IDENTICAL to what the
 * layout rendered before the branch existed. Demo mode in these renders: `demo` avoids mounting the
 * Clerk-backed `OrgSwitcher`, which cannot render without a ClerkProvider; the branch under test
 * does not read `demo` at all.
 */
describe('AppShell', () => {
  it('mounts the Bold shell for the template brand, under the data-ui="bold" scope', () => {
    const markup = renderToStaticMarkup(
      <AppShell brands={scopeOf(TEMPLATE)} actor={DEMO_ACTOR} demo role="admin">
        <p>page</p>
      </AppShell>,
    );

    expect(markup).toContain('data-ui="bold"');
    expect(markup).toContain('data-slot="bold-shell"');
    expect(markup).toContain('data-slot="bold-sidebar"');
    expect(markup).toContain('data-slot="bold-top-bar"');
    // The legacy chrome is NOT also mounted behind it (commit 2b replaced the interim TopBar).
    expect(markup).not.toContain('data-slot="shell-top-bar"');
    expect(markup).not.toContain('data-slot="shell-sidebar"');
  });

  it('keeps every child brand on the legacy shell, with no Bold chrome and no scope', () => {
    const markup = renderToStaticMarkup(
      <AppShell brands={scopeOf(CHILD)} actor={DEMO_ACTOR} demo role="admin">
        <p>page</p>
      </AppShell>,
    );

    expect(markup).toContain('data-slot="shell-top-bar"');
    expect(markup).toContain('data-slot="shell-sidebar"');
    expect(markup).not.toContain('data-ui');
    expect(markup).not.toContain('data-slot="bold');
  });

  /**
   * Byte-identical, literally: the reference tree below is the layout's pre-commit-2 JSX, copied
   * verbatim from `app/app/layout.tsx` as it stood at b775fe9. If a refactor of the legacy branch
   * changes one byte of a child brand's markup, this fails.
   */
  it('renders a child brand byte-identical to the pre-branch layout composition', () => {
    const brands = scopeOf(CHILD);
    // Computed, not the literal `true`: the reference JSX below keeps the layout's own
    // `demo ? <DemoBanner /> : null` shape verbatim without tripping no-unnecessary-condition.
    const demo = !CHILD.isTemplate;
    const role = 'csm' as const;
    const children = <p>page</p>;

    const reference = renderToStaticMarkup(
      <div
        data-slot="app-shell"
        data-ui={uiScope(brands.active)}
        className="flex min-h-screen flex-col overflow-x-hidden bg-bg"
      >
        <TopBar brands={brands} actor={DEMO_ACTOR} demo={demo} />
        {demo ? <DemoBanner /> : null}
        <div className="flex flex-1 items-stretch">
          <Sidebar role={role} isTemplate={brands.active?.isTemplate ?? false} />
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="w-full">{children}</div>
          </main>
        </div>
      </div>,
    );

    const actual = renderToStaticMarkup(
      <AppShell brands={brands} actor={DEMO_ACTOR} demo={demo} role={role}>
        {children}
      </AppShell>,
    );

    expect(actual).toBe(reference);
  });
});
