import { appPath, designSystemPath, personasPath } from '@/lib/routes';

import type { IconName } from './icons';

/**
 * Every product section of the PRD, in the order the sidebar lists them. A section with no `href`
 * is not built yet: the sidebar renders it muted, `aria-disabled`, marked "soon" and not clickable,
 * so the shell states the whole product without pretending a page exists.
 */
export interface NavSection {
  readonly key: string;
  readonly label: string;
  readonly icon: IconName;
  /** Present only for a section that is actually reachable. */
  readonly href?: string;
}

export const NAV_SECTIONS: readonly NavSection[] = [
  { key: 'overview', label: 'Overview', icon: 'overview', href: appPath },
  { key: 'products', label: 'Products', icon: 'products' },
  { key: 'personas', label: 'Personas', icon: 'personas', href: personasPath },
  { key: 'angles', label: 'Angles', icon: 'angles' },
  { key: 'themes', label: 'Themes', icon: 'themes' },
  { key: 'concepts', label: 'Concepts', icon: 'concepts' },
  { key: 'briefs', label: 'Creative Briefs', icon: 'briefs' },
  { key: 'copywriting', label: 'Copywriting', icon: 'copywriting' },
  { key: 'ugc', label: 'UGC Management', icon: 'ugc' },
  { key: 'client', label: 'Client Interface', icon: 'client' },
  { key: 'design-system', label: 'Design System', icon: 'design-system', href: designSystemPath },
  { key: 'admin', label: 'Admin', icon: 'admin' },
];

/**
 * The active section is the one whose `href` is the longest prefix of `pathname`, so `/app/personas`
 * lights Personas and not Overview even though both are prefixes of it.
 */
export function activeSectionKey(pathname: string): string | null {
  let active: NavSection | null = null;
  for (const section of NAV_SECTIONS) {
    const href = section.href;
    if (href === undefined) {
      continue;
    }
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (matches && (active?.href === undefined || href.length > active.href.length)) {
      active = section;
    }
  }
  return active?.key ?? null;
}
