import {
  aiCharactersPath,
  anglesPath,
  appPath,
  adSpyPath,
  assetsPath,
  campaignsOffersPath,
  clientAssetsPath,
  collectionsPath,
  competitiveResearchPath,
  creativeDesignPath,
  creativeDimensionsPath,
  creativeModulesPath,
  creativeSheetPath,
  creatorRankingPath,
  metaCopywritingPath,
  performancePath,
  clientQueuePath,
  conceptsPath,
  designSystemPath,
  interfaceConfigPath,
  internalQueuePath,
  notificationsPath,
  onboardPath,
  onboardingFormsPath,
  personasPath,
  productsPath,
  propagationPath,
  teamPath,
  themesPath,
  ugcPath,
  uploadLinksPath,
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
  /** A friendly emoji shown in place of the icon for the content sections (P2D, client feedback
   *  Sep 28: "emojis are more friendly"). Sections without one keep their lucide icon. */
  readonly emoji?: string;
  /** Present only for a section that is actually reachable. */
  readonly href?: string;
}

export interface NavGroup {
  readonly key: string;
  /** Rendered as a quiet heading above the group; the first group is unlabelled. */
  readonly label?: string;
  readonly sections: readonly NavSection[];
}

/**
 * HIDDEN MODULES (template-base alignment, 2026-10-02). Six sections were removed from this list
 * when the Airtable TEMPLATE base `appnaSGAgOUbJ0f9m` became the source of truth and turned out to
 * have no table for them: Copy Types, YouTube Copywriting, Email Campaigns, Email Flows, Creative
 * Reporting and SM Campaign Feed.
 *
 * Hidden, NOT dropped. The Postgres tables, their query functions, their demo fixtures and their
 * page components are all still in the repo; only the sidebar entry is gone and each route
 * `redirect`s (307) to `/app` — temporary, because the hide is reversible. Un-hiding one is a
 * section here plus its `page.tsx`. `docs/decisions/data-loss-blockers-2026-10-02.md` says why
 * nothing was deleted and what each table holds.
 *
 * `creative-modules` is deliberately still listed: whether the template base's "Themes" table
 * feeds `themes` or `creative_modules` is an open product question (same document, last section).
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    key: 'home',
    sections: [
      { key: 'overview', label: 'Overview', icon: 'overview', emoji: '🏠', href: appPath },
    ],
  },
  {
    key: 'strategy',
    label: 'Strategy',
    sections: [
      { key: 'products', label: 'Products', icon: 'products', emoji: '📦', href: productsPath },
      {
        key: 'collections',
        label: 'Collections',
        icon: 'collections',
        emoji: '🗃️',
        href: collectionsPath,
      },
      { key: 'personas', label: 'Personas', icon: 'personas', emoji: '🎭', href: personasPath },
      { key: 'angles', label: 'Angles', icon: 'angles', emoji: '🎯', href: anglesPath },
      { key: 'themes', label: 'Themes', icon: 'themes', emoji: '🎨', href: themesPath },
      { key: 'concepts', label: 'Concepts', icon: 'concepts', emoji: '💡', href: conceptsPath },
      {
        key: 'creative-modules',
        label: 'Creative Modules',
        icon: 'concepts',
        emoji: '🧩',
        href: creativeModulesPath,
      },
      {
        key: 'ai-characters',
        label: 'AI Characters',
        icon: 'ai-characters',
        emoji: '🤖',
        href: aiCharactersPath,
      },
      {
        key: 'competitive-research',
        label: 'Competitive Research',
        icon: 'competitive-research',
        emoji: '🔍',
        href: competitiveResearchPath,
      },
    ],
  },
  {
    key: 'production',
    label: 'Production',
    sections: [
      {
        key: 'briefs',
        label: 'Creative Design',
        icon: 'briefs',
        emoji: '📋',
        href: creativeDesignPath,
      },
      {
        key: 'creative-sheet',
        label: 'Creative Sheet',
        icon: 'briefs',
        emoji: '📑',
        href: creativeSheetPath,
      },
      { key: 'ugc', label: 'UGC Management', icon: 'ugc', emoji: '🎬', href: ugcPath },
      {
        key: 'client-assets',
        label: 'Client Assets',
        icon: 'assets',
        emoji: '📁',
        href: clientAssetsPath,
      },
      { key: 'assets', label: 'Asset Library', icon: 'assets', emoji: '🗂️', href: assetsPath },
      {
        key: 'upload-links',
        label: 'Upload Links',
        icon: 'upload-links',
        emoji: '🔗',
        href: uploadLinksPath,
      },
    ],
  },
  {
    key: 'copy',
    label: 'Copy',
    sections: [
      {
        key: 'copywriting',
        label: 'Meta Copywriting',
        icon: 'copywriting',
        emoji: '✍️',
        href: metaCopywritingPath,
      },
    ],
  },
  {
    key: 'campaigns-group',
    label: 'Campaigns',
    sections: [
      {
        key: 'campaigns',
        label: 'Campaigns & Offers',
        icon: 'campaigns',
        emoji: '🏷️',
        href: campaignsOffersPath,
      },
    ],
  },
  {
    key: 'reporting',
    label: 'Reporting',
    sections: [
      {
        key: 'performance',
        label: 'Performance',
        icon: 'performance',
        emoji: '📈',
        href: performancePath,
      },
      { key: 'ad-spy', label: 'Ad Spy', icon: 'ad-spy', emoji: '🕵️', href: adSpyPath },
      {
        key: 'creator-ranking',
        label: 'Creator Ranking',
        icon: 'creator-ranking',
        emoji: '🏆',
        href: creatorRankingPath,
      },
    ],
  },
  {
    key: 'lookups',
    label: 'Settings / Lookups',
    sections: [
      {
        key: 'creative-dimensions',
        label: 'Creative Dimensions',
        icon: 'creative-dimensions',
        emoji: '📐',
        href: creativeDimensionsPath,
      },
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
      { key: 'client-queue', label: 'Client Queue', icon: 'queue-client', href: clientQueuePath },
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
      { key: 'propagation', label: 'Propagation', icon: 'propagation', href: propagationPath },
      {
        key: 'onboarding-forms',
        label: 'Onboarding Forms',
        icon: 'onboarding-forms',
        href: onboardingFormsPath,
      },
      { key: 'onboard', label: 'Add Brand', icon: 'building', href: onboardPath },
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
