'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { ViewerRole } from '@tas/domain';
import type { ReactNode } from 'react';

import type { BrandScope } from '@/lib/data-source';
import type { DemoActor } from '@/lib/demo-mode';

import { BoldSidebar } from './bold-sidebar';
import { BoldTopBar } from './bold-top-bar';

export interface BoldShellProps {
  readonly brands: BrandScope;
  readonly actor: DemoActor;
  readonly demo: boolean;
  readonly role: ViewerRole | null;
  /** The demo strip, passed as a rendered slot so this client module never imports server code. */
  readonly banner?: ReactNode;
  readonly children: ReactNode;
}

/**
 * The Bold shell frame (redesign commits 2 + 2b): the 264px rail column plus the content column
 * (spec §1.4 "App grid"). `AppShell` mounts it for the template brand only; its single piece of
 * state is the ≤900px overlay nav, opened by the top bar's hamburger and closed by Escape, a scrim
 * click (the outside-click), or following any nav link. The client portal needs no handling here:
 * it lives outside `/app`, so neither shell — legacy or Bold — ever wraps it.
 */
export function BoldShell({ brands, actor, demo, role, banner, children }: BoldShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();

  // Navigating closes the overlay even when the change came from outside a nav link's own
  // onClick (browser back, a link inside the page).
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!navOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNavOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [navOpen]);

  return (
    <div
      data-slot="bold-shell"
      className="grid min-h-screen grid-cols-1 min-[901px]:grid-cols-[264px_minmax(0,1fr)]"
    >
      {navOpen ? (
        <div
          data-slot="bold-nav-scrim"
          aria-hidden="true"
          onClick={() => {
            setNavOpen(false);
          }}
          className="fixed inset-0 z-40 bg-scrim min-[901px]:hidden"
        />
      ) : null}
      <BoldSidebar
        role={role}
        isTemplate={brands.active?.isTemplate ?? false}
        brands={brands.options}
        activeBrandId={brands.active?.id ?? null}
        actor={actor}
        demo={demo}
        open={navOpen}
        onClose={() => {
          setNavOpen(false);
        }}
      />
      <div className="flex min-w-0 flex-col">
        <BoldTopBar
          actor={actor}
          demo={demo}
          onMenuOpen={() => {
            setNavOpen(true);
          }}
        />
        {banner}
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1440px] px-4 pt-7 pb-24 sm:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
