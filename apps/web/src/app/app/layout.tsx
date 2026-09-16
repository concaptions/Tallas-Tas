import { auth } from '@clerk/nextjs/server';
import type { ReactNode } from 'react';

import { DemoBanner } from '@/components/shell/demo-banner';
import { Sidebar } from '@/components/shell/sidebar';
import { TopBar } from '@/components/shell/top-bar';
import { currentActor } from '@/lib/actor';
import { currentBrand } from '@/lib/data-source';
import { isDemoMode } from '@/lib/demo-mode';

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
  const [brand, actor] = await Promise.all([currentBrand(), currentActor()]);

  return (
    <div data-slot="app-shell" className="flex min-h-screen flex-col overflow-x-hidden bg-bg">
      <TopBar brand={brand} actor={actor} demo={demo} />
      {demo ? <DemoBanner /> : null}
      <div className="flex flex-1 items-stretch">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
