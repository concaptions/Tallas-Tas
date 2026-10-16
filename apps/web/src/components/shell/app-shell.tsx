import type { ViewerRole } from '@tas/domain';
import type { ReactNode } from 'react';

import { uiScope } from '@/lib/ui-scope';

import type { BrandScope } from '@/lib/data-source';
import type { DemoActor } from '@/lib/demo-mode';

import { BoldShell } from './bold/bold-shell';
import { DemoBanner } from './demo-banner';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';

export interface AppShellProps {
  readonly brands: BrandScope;
  readonly actor: DemoActor;
  readonly demo: boolean;
  readonly role: ViewerRole | null;
  readonly children: ReactNode;
}

/**
 * The one place the shell chooses its chrome (redesign commit 2). The branch reads the SAME signal
 * commit 1 stamps the token scope with — `uiScope(brands.active)`, i.e. `BrandSummary.isTemplate` —
 * so the Bold rail and top bar appear exactly where the Bold tokens do: the template brand, and
 * nowhere else. Every child brand (Gratsi, Niagara, Mattress Central, Funky Painting) takes the
 * `else` branch, which is the pre-commit-2 layout JSX moved here verbatim — `app-shell.test.tsx`
 * holds its rendered markup byte-identical to that original composition.
 */
export function AppShell({ brands, actor, demo, role, children }: AppShellProps) {
  const scope = uiScope(brands.active);

  if (scope !== undefined) {
    return (
      <div
        data-slot="app-shell"
        data-ui={scope}
        className="min-h-screen overflow-x-hidden bg-bg"
      >
        <BoldShell
          brands={brands}
          actor={actor}
          demo={demo}
          role={role}
          banner={demo ? <DemoBanner /> : null}
        >
          {children}
        </BoldShell>
      </div>
    );
  }

  return (
    // `data-ui="bold"` scopes the Bold token set (redesign commit 1) to the template brand only;
    // for a child brand `uiScope` returns undefined and React omits the attribute entirely.
    <div
      data-slot="app-shell"
      data-ui={uiScope(brands.active)}
      className="flex min-h-screen flex-col overflow-x-hidden bg-bg"
    >
      <TopBar brands={brands} actor={actor} demo={demo} />
      {demo ? <DemoBanner /> : null}
      <div className="flex flex-1 items-stretch">
        <Sidebar role={role} isTemplate={brands.active?.isTemplate ?? false} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {/* Full-width content (P2D, client feedback Sep 28): tables stretch to fill wide screens
              instead of sitting inside a narrow centred column. */}
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
