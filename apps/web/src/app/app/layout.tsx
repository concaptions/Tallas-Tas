import { auth } from '@clerk/nextjs/server';
import type { ReactNode } from 'react';

import { DemoBanner } from '@/components/shell/demo-banner';
import { Sidebar } from '@/components/shell/sidebar';
import { TopBar } from '@/components/shell/top-bar';
import { currentActor } from '@/lib/actor';
import { loadActiveRole, loadBrandScope } from '@/lib/data-source';
import { isDemoMode } from '@/lib/demo-mode';
import { ensureOrganization } from '@/lib/ensure-organization';
import { ensureUser } from '@/lib/ensure-user';

/**
 * The product shell: top bar, demo strip, left rail, page slot.
 *
 * Every colour is a token class or a `var(--token)`; the shell owns chrome only, so a page renders
 * its own heading and content into `<main>` and never repeats the frame. Down to 390px the rail
 * collapses to icons and `min-w-0` on the content column keeps a wide table from pushing the page
 * sideways: the shell never scrolls horizontally.
 */
export default async function AppShellLayout({ children }: Readonly<{ children: ReactNode }>) {
  const demo = isDemoMode();
  // Second line of defence behind the middleware, and it covers every page under /app. Guarded:
  // without a ClerkProvider and Clerk middleware `auth()` throws, so in demo mode it is never called.
  if (!demo) {
    await auth.protect();
  }
  // Everything after the auth gate runs at once. None of it needs another's result within this
  // request: `ensureOrganization` creating an org does not make it the session's active org, so
  // `ensureUser` and `loadBrandScope` read the same `orgId` whether it ran first or not, and brand
  // scope resolves from the org's agency, never from the membership `ensureUser` may write. Run in
  // series these were four round-trip chains back to back on every full load; now the layout costs
  // the slowest one. `ensureUser` provisions the roster row the Team and Propagation guards read (2D).
  // `loadActiveRole` joins the same tick: the rail is filtered by role (action item 57), and the
  // role resolves from the active brand and the Clerk user exactly as it does for the Overview, so
  // the rail and the dashboard cannot disagree about who is looking. The brand scope behind it is
  // memoised per request in `data-source.ts`, so the shell's call costs one membership read on top
  // of the Overview's, not a second scope resolution; in demo mode it answers `admin` without a
  // connection.
  const [, , brands, actor, role] = await Promise.all([
    demo ? undefined : ensureOrganization(),
    demo ? undefined : ensureUser(),
    loadBrandScope(),
    currentActor(),
    loadActiveRole(),
  ]);

  return (
    <div data-slot="app-shell" className="flex min-h-screen flex-col overflow-x-hidden bg-bg">
      <TopBar brands={brands} actor={actor} demo={demo} />
      {demo ? <DemoBanner /> : null}
      <div className="flex flex-1 items-stretch">
        <Sidebar role={role} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {/* Full-width content (P2D, client feedback Sep 28): tables stretch to fill wide screens
              instead of sitting inside a narrow centred column. */}
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
