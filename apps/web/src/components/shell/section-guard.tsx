import {
  SECTION_NOT_PERMITTED_NOTE,
  SECTION_NOT_PERMITTED_TITLE,
  canSeeNavSection,
  type NavSectionKey,
} from '@tas/domain';
import type { ReactNode } from 'react';

import { viewerRole } from '@/lib/viewer-role';

/**
 * THE ROUTE-LEVEL HALF OF THE ROLE FILTER (AI-57 / AI-65, PRD §11).
 *
 * Filtering the sidebar hides a link; it does not close a route. `/app/personas` stays one typed
 * URL away from a video editor whose rail never mentioned it, so every section the rail hides is
 * also guarded here, on the server, before the page runs.
 *
 * WHY A SEGMENT LAYOUT AND NOT A LINE IN EACH PAGE. A `layout.tsx` wraps its whole segment, so one
 * file covers `/app/personas` AND `/app/personas/[personaId]` — the detail routes come for free,
 * which is exactly where a per-page guard tends to be forgotten. And the stop is total: `children`
 * is an element this component chooses whether to render, so a refused page's own function is never
 * invoked, no query runs and nothing reaches the client. No page in this app defines
 * `generateMetadata`, so there is no second entry point that could run behind the refusal.
 *
 * It refuses in words rather than with `notFound()` because the two guards already in the repo do
 * (`team/page.tsx`, `propagation/page.tsx`): a reader who hits a section outside their role needs to
 * know it is a role decision and who can change it, not to wonder whether they mistyped a URL. The
 * refusal names no section and lists no data.
 */
function NotPermitted() {
  return (
    <div className="flex flex-col gap-8">
      <section
        data-slot="section-not-permitted"
        className="flex flex-col gap-2 rounded-card border border-line bg-surface2 p-6"
      >
        <p className="text-sm font-medium text-text">{SECTION_NOT_PERMITTED_TITLE}</p>
        <p className="text-sm text-text3">{SECTION_NOT_PERMITTED_NOTE}</p>
      </section>
    </div>
  );
}

/**
 * The default export a section's `layout.tsx` is: `export default sectionGuard('personas')`.
 *
 * `section` is typed `NavSectionKey`, so a misspelled key fails the build rather than quietly
 * guarding nothing — and `canSeeNavSection` denies an unknown key anyway, so the two failure modes
 * both close. The decision itself is `@tas/domain`'s; this component only asks and renders.
 */
export function sectionGuard(section: NavSectionKey) {
  return async function GuardedSection({ children }: Readonly<{ children: ReactNode }>) {
    if (!canSeeNavSection(await viewerRole(), section)) {
      return <NotPermitted />;
    }
    return children;
  };
}
