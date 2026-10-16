import type { ViewerRole } from '@tas/domain';
import type { ReactNode } from 'react';

import type { BrandScope } from '@/lib/data-source';
import type { DemoActor } from '@/lib/demo-mode';

import { TopBar } from '../top-bar';
import { BoldSidebar } from './bold-sidebar';

export interface BoldShellProps {
  readonly brands: BrandScope;
  readonly actor: DemoActor;
  readonly demo: boolean;
  readonly role: ViewerRole | null;
  /** The demo strip, passed as a rendered slot so this module stays free of server imports. */
  readonly banner?: ReactNode;
  readonly children: ReactNode;
}

/**
 * The Bold shell frame (redesign commit 2): the 264px rail column plus the content column (spec
 * §1.4 "App grid"). `AppShell` mounts it for the template brand only.
 *
 * INTERIM, until commit 2b: the content column keeps the LEGACY `TopBar`, so nothing the top bar
 * does (brand/org switching, theme toggle, account menu) is dropped while the Bold top bar is its
 * own ≤300-LOC commit. 2b swaps it for `BoldTopBar` and brings the ≤900px overlay nav + hamburger;
 * until then the rail is desktop-only. The client portal needs no handling here: it lives outside
 * `/app`, so neither shell — legacy or Bold — ever wraps it.
 */
export function BoldShell({ brands, actor, demo, role, banner, children }: BoldShellProps) {
  return (
    <div
      data-slot="bold-shell"
      className="grid min-h-screen grid-cols-1 min-[901px]:grid-cols-[264px_minmax(0,1fr)]"
    >
      <BoldSidebar
        role={role}
        isTemplate={brands.active?.isTemplate ?? false}
        brands={brands.options}
        activeBrandId={brands.active?.id ?? null}
        actor={actor}
        demo={demo}
      />
      <div className="flex min-w-0 flex-col">
        <TopBar brands={brands} actor={actor} demo={demo} />
        {banner}
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1440px] px-4 pt-7 pb-24 sm:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
