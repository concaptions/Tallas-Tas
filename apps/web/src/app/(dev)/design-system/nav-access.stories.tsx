import {
  NO_WORKSPACE_NOTE,
  NO_WORKSPACE_TITLE,
  SECTION_NOT_PERMITTED_NOTE,
  SECTION_NOT_PERMITTED_TITLE,
  brandRoles,
  navSectionsForRole,
  roleLabel,
  type ViewerRole,
} from '@tas/domain';

import { NAV_SECTIONS } from '@/components/shell/nav';

/**
 * WHAT EACH ROLE'S SIDEBAR CONTAINS (AI-57/AI-65, UI governance rule 4).
 *
 * The rail itself is a client component that reads `usePathname`, so showing the live `Sidebar`
 * here would show whichever route the design system is on. What matters is the DECISION, so this
 * story renders the decision: one row per role, the sections `navSectionsForRole` returns, by their
 * nav labels. The counts are auto-generated system output and therefore `font-mono`.
 *
 * Read it as the role matrix a reviewer can check against PRD §11 without signing in six times.
 */
const ROLES: readonly ViewerRole[] = ['admin', ...brandRoles];

function labelOf(key: string): string {
  return NAV_SECTIONS.find((section) => section.key === key)?.label ?? key;
}

export function NavAccessMatrixStory() {
  return (
    <div data-slot="nav-access-matrix" className="flex flex-col gap-3">
      {ROLES.map((role) => {
        const keys = navSectionsForRole(role);
        return (
          <div
            key={role}
            className="flex flex-col gap-1.5 rounded-card border border-line bg-surface2 p-4"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-text">{roleLabel(role)}</span>
              <span className="font-mono text-[11px] text-text3">
                {keys.length} / {NAV_SECTIONS.length} sections
              </span>
            </div>
            <p className="text-sm text-text2">
              {keys.length === 0
                ? 'No internal section. Their product is their own brand interface.'
                : keys.map(labelOf).join(' · ')}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The two refusals, as a reader meets them: the per-section one a segment layout renders in place
 * of the page, and the whole-workspace one the shell renders with no top bar at all. Neither names
 * a section or a brand — a refusal that lists the product is a leak with good manners.
 */
export function NavAccessRefusalsStory() {
  return (
    <div className="flex flex-col gap-3">
      <section
        data-slot="section-not-permitted"
        className="flex flex-col gap-2 rounded-card border border-line bg-surface2 p-6"
      >
        <p className="text-sm font-medium text-text">{SECTION_NOT_PERMITTED_TITLE}</p>
        <p className="text-sm text-text3">{SECTION_NOT_PERMITTED_NOTE}</p>
      </section>
      <section
        data-slot="no-workspace"
        className="flex flex-col gap-2 rounded-card border border-line bg-surface2 p-6"
      >
        <p className="text-sm font-medium text-text">{NO_WORKSPACE_TITLE}</p>
        <p className="text-sm text-text3">{NO_WORKSPACE_NOTE}</p>
      </section>
    </div>
  );
}
