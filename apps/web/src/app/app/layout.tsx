import { auth } from '@clerk/nextjs/server';
import { NO_WORKSPACE_NOTE, NO_WORKSPACE_TITLE, canSeeInternalWorkspace } from '@tas/domain';
import type { ReactNode } from 'react';

import { DemoBanner } from '@/components/shell/demo-banner';
import { Sidebar } from '@/components/shell/sidebar';
import { TopBar } from '@/components/shell/top-bar';
import { currentActor } from '@/lib/actor';
import { loadBrandScope } from '@/lib/data-source';
import { isDemoMode } from '@/lib/demo-mode';
import { ensureOrganization } from '@/lib/ensure-organization';
import { ensureUser } from '@/lib/ensure-user';
import { viewerRole } from '@/lib/viewer-role';

/**
 * The product shell: top bar, demo strip, left rail, page slot.
 *
 * Every colour is a token class or a `var(--token)`; the shell owns chrome only, so a page renders
 * its own heading and content into `<main>` and never repeats the frame. Down to 390px the rail
 * collapses to icons and `min-w-0` on the content column keeps a wide table from pushing the page
 * sideways: the shell never scrolls horizontally.
 *
 * THE VIEWER'S ROLE IS RESOLVED HERE, ONCE PER REQUEST, and handed to the `Sidebar` so the rail
 * lists only the sections that role includes (AI-57, PRD §11). It is resolved on the server because
 * a client component cannot be trusted to establish who it is rendering for, and it is resolved in
 * the layout because every page under `/app` shares this rail. The filter is presentation only —
 * what actually closes a hidden route is the `sectionGuard` in each section's own segment layout,
 * since a sidebar that merely omits a link leaves the URL working.
 */
/**
 * What `/app` shows somebody it is not for (AI-65). NO SHELL AROUND IT: no top bar, so no brand
 * list, no switcher, no section rail. A client who follows an internal link must not learn the
 * agency's brand roster from the refusal (CLAUDE.md non-negotiable 10).
 */
function NoWorkspace() {
  return (
    <div
      data-slot="no-workspace"
      className="flex min-h-screen items-center justify-center bg-bg px-4 py-6"
    >
      <section className="flex max-w-prose flex-col gap-2 rounded-card border border-line bg-surface2 p-6">
        <p className="text-sm font-medium text-text">{NO_WORKSPACE_TITLE}</p>
        <p className="text-sm text-text3">{NO_WORKSPACE_NOTE}</p>
      </section>
    </div>
  );
}

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
  // `viewerRole()` joins the same parallel batch for the same reason: the sidebar needs it on the
  // first paint and it depends on nothing else in this list. It is request-cached, so the guard on
  // whichever section is being opened reuses this one query rather than issuing a second (AI-57).
  const [, , brands, actor, role] = await Promise.all([
    demo ? undefined : ensureOrganization(),
    demo ? undefined : ensureUser(),
    loadBrandScope(),
    currentActor(),
    viewerRole(),
  ]);

  // `/app` IS THE TEAM'S PRODUCT, AND THIS IS THE ONE CHECK THAT SAYS SO (AI-65). PRD §11 gives a
  // client "their own brand's interface only" — not a narrower `/app`, none of it — so the refusal
  // belongs in the shell every route under here already passes through rather than in 47 pages.
  // `children` is withheld, so the page's own function is never invoked and none of its queries run;
  // the reads above already happened, and nothing from them is rendered.
  if (!canSeeInternalWorkspace(role)) {
    return <NoWorkspace />;
  }

  return (
    <div data-slot="app-shell" className="flex min-h-screen flex-col overflow-x-hidden bg-bg">
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
