import {
  anglesPath,
  appPath,
  briefsPath,
  clientQueuePath,
  conceptsPath,
  copywritingPath,
  designSystemPath,
  interfaceConfigPath,
  internalQueuePath,
  notificationsPath,
  personasPath,
  productsPath,
  teamPath,
  themesPath,
  ugcPath,
} from '@/lib/routes';

import type { IconName } from './icons';

/**
 * Every product section, grouped the way the sidebar lists them. A section with no `href` is not
 * built yet: the sidebar renders it muted, `aria-disabled` and marked with a `SoonChip`, so the
 * shell states the whole product without pretending a page exists.
 *
 * Shipping a section means giving it an `href` here in the same commit as its page.
 */
export interface NavSection {
  readonly key: string;
  readonly label: string;
  readonly icon: IconName;
  /** Present only for a section that is actually reachable. */
  readonly href?: string;
}

export interface NavGroup {
  readonly key: string;
  /** Rendered as a quiet heading above the group; the first group is unlabelled. */
  readonly label?: string;
  readonly sections: readonly NavSection[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    key: 'workspace',
    sections: [
      { key: 'overview', label: 'Overview', icon: 'overview', href: appPath },
      { key: 'products', label: 'Products', icon: 'products', href: productsPath },
      { key: 'personas', label: 'Personas', icon: 'personas', href: personasPath },
      { key: 'angles', label: 'Angles', icon: 'angles', href: anglesPath },
      { key: 'themes', label: 'Themes', icon: 'themes', href: themesPath },
      { key: 'concepts', label: 'Concepts', icon: 'concepts', href: conceptsPath },
      { key: 'briefs', label: 'Creative Briefs', icon: 'briefs', href: briefsPath },
      { key: 'copywriting', label: 'Copywriting', icon: 'copywriting', href: copywritingPath },
      { key: 'ugc', label: 'UGC Management', icon: 'ugc', href: ugcPath },
    ],
  },
  {
    key: 'approvals',
    label: 'Approvals',
    sections: [
      {
        key: 'internal-queue',
        label: 'Internal Queue',
        icon: 'queue-internal',
        href: internalQueuePath,
      },
      {
        key: 'client-queue',
        label: 'Client Queue',
        icon: 'queue-client',
        href: clientQueuePath,
      },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    sections: [
      { key: 'team', label: 'Team', icon: 'team', href: teamPath },
      {
        key: 'interface-config',
        label: 'Interface Config',
        icon: 'interface',
        href: interfaceConfigPath,
      },
      {
        key: 'notifications',
        label: 'Notifications',
        icon: 'notifications',
        href: notificationsPath,
      },
      { key: 'propagation', label: 'Propagation', icon: 'propagation' },
    ],
  },
  {
    key: 'dev',
    label: 'Reference',
    sections: [
      {
        key: 'design-system',
        label: 'Design System',
        icon: 'design-system',
        href: designSystemPath,
      },
    ],
  },
];

/** Every section, flattened, in sidebar order. */
export const NAV_SECTIONS: readonly NavSection[] = NAV_GROUPS.flatMap((group) => group.sections);

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

/** Sections still waiting for a page. Empty means every section has shipped. */
export function pendingSections(): readonly NavSection[] {
  return NAV_SECTIONS.filter((section) => section.href === undefined);
}
