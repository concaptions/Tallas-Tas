import {
  NAV_SECTION_KEYS,
  REMOVED_WORKSPACES,
  isRemovedWorkspace,
  navSectionsForRole,
} from '@tas/domain';
import { describe, expect, it } from 'vitest';

import {
  NAV_GROUPS,
  NAV_SECTIONS,
  activeSectionKey,
  navGroupsForRole,
  navGroupsForView,
  TEMPLATE_HIDDEN_SECTION_KEYS,
  pendingSections,
} from './nav';

describe('NAV_SECTIONS', () => {
  it('lists every module in sidebar order (regrouped 2026-10-01 for Airtable parity)', () => {
    expect(NAV_SECTIONS.map((section) => section.label)).toEqual([
      'Overview',
      'Products',
      'Collections',
      'Personas',
      'Angles',
      'Themes',
      'Concepts',
      'Creative Modules',
      'AI Characters',
      'Competitive Research',
      'Creative Design',
      'Creative Sheet',
      'UGC Management',
      'Client Assets',
      'Asset Library',
      'Copywriting',
      'YouTube Copywriting',
      'Campaigns & Offers',
      'Email Campaigns',
      'Email Flows',
      'SM Campaign Feed',
      'Performance',
      'Creative Reporting',
      'Ad Spy',
      'Creator Ranking',
      'Copy Types',
      'Creative Dimensions',
      'Internal Queue',
      'Client Queue',
      'Team',
      'Interface Config',
      'Notifications',
      'Upload Links',
      'Propagation',
      'Column Admin',
      'Onboarding Forms',
      'Add Brand',
      'Design System',
    ]);
  });

  it('groups them, leaving the first group unlabelled', () => {
    expect(NAV_GROUPS.map((group) => group.label)).toEqual([
      undefined,
      'Strategy',
      'Production',
      'Copy',
      'Campaigns',
      'Reporting',
      'Settings / Lookups',
      'Approvals',
      'Settings',
      'Reference',
    ]);
  });

  it('keys are unique, so the sidebar never renders a duplicate', () => {
    const keys = NAV_SECTIONS.map((section) => section.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  /**
   * Not `every(section => section.href === undefined)`: that is true BY CONSTRUCTION —
   * `pendingSections` filters on exactly that predicate — so it passed with half the sidebar
   * unbuilt and would pass again on the day a section loses its href. Every section is built, so
   * the assertion that guards the run is that the list is EMPTY. A new section added to `nav.ts`
   * without an href fails here, which is the reminder to ship its page or accept a `SoonChip`.
   */
  it('has no section left waiting for a page', () => {
    expect(pendingSections()).toEqual([]);
  });

  it('gives an href only to the sections that are built', () => {
    const linked = NAV_SECTIONS.filter((section) => section.href !== undefined);

    expect(linked.map((section) => [section.label, section.href])).toEqual([
      ['Overview', '/app'],
      ['Products', '/app/products'],
      ['Collections', '/app/collections'],
      ['Personas', '/app/personas'],
      ['Angles', '/app/angles'],
      ['Themes', '/app/themes'],
      ['Concepts', '/app/concepts'],
      ['Creative Modules', '/app/creative-modules'],
      ['AI Characters', '/app/ai-characters'],
      ['Competitive Research', '/app/competitive-research'],
      ['Creative Design', '/app/creative-design'],
      ['Creative Sheet', '/app/creative-sheet'],
      ['UGC Management', '/app/ugc'],
      ['Client Assets', '/app/client-assets'],
      ['Asset Library', '/app/assets'],
      ['Copywriting', '/app/copywriting'],
      ['YouTube Copywriting', '/app/youtube-copywriting'],
      ['Campaigns & Offers', '/app/campaigns-offers'],
      ['Email Campaigns', '/app/email-campaigns'],
      ['Email Flows', '/app/email-flows'],
      ['SM Campaign Feed', '/app/sm-campaign-feed'],
      ['Performance', '/app/performance'],
      ['Creative Reporting', '/app/creative-reporting'],
      ['Ad Spy', '/app/ad-spy'],
      ['Creator Ranking', '/app/creator-ranking'],
      ['Copy Types', '/app/copy-types'],
      ['Creative Dimensions', '/app/creative-dimensions'],
      ['Internal Queue', '/app/queue/internal'],
      ['Client Queue', '/app/queue/client'],
      ['Team', '/app/team'],
      ['Interface Config', '/app/interface-config'],
      ['Notifications', '/app/notifications'],
      ['Upload Links', '/app/upload-links'],
      ['Propagation', '/app/propagation'],
      ['Column Admin', '/app/column-admin'],
      ['Onboarding Forms', '/app/onboarding-forms'],
      ['Add Brand', '/app/onboard'],
      ['Design System', '/design-system'],
    ]);
  });
});

describe('activeSectionKey', () => {
  it.each([
    ['/app', 'overview'],
    ['/app/products', 'products'],
    ['/app/products/22222222-2222-4222-8222-000000000001', 'products'],
    ['/app/personas', 'personas'],
    ['/app/personas/33333333-3333-4333-8333-000000000001', 'personas'],
    ['/app/angles', 'angles'],
    ['/app/angles/55555555-5555-4555-8555-000000000001', 'angles'],
    ['/app/themes', 'themes'],
    ['/app/themes/44444444-4444-4444-8444-000000000003', 'themes'],
    ['/app/concepts', 'concepts'],
    ['/app/concepts/66666666-6666-4666-8666-000000000001', 'concepts'],
    ['/app/concepts/new', 'concepts'],
    ['/app/creative-design', 'briefs'],
    // The brief detail page lights the Creative Sheet: its list is retired (2026-10-09).
    ['/app/creative-design/77777777-7777-4777-8777-000000000001', 'creative-sheet'],
    ['/app/copywriting', 'copywriting'],
    ['/app/youtube-copywriting', 'youtube-copywriting'],
    ['/app/email-campaigns', 'email-campaigns'],
    ['/app/ugc', 'ugc'],
    ['/app/ugc/88888888-8888-4888-8888-000000000001', 'ugc'],
    ['/app/assets', 'assets'],
    ['/app/performance', 'performance'],
    ['/app/ad-spy', 'ad-spy'],
    ['/app/creator-ranking', 'creator-ranking'],
    ['/app/upload-links', 'upload-links'],
    ['/app/collections', 'collections'],
    ['/app/creative-dimensions', 'creative-dimensions'],
    ['/app/ai-characters', 'ai-characters'],
    ['/app/competitive-research', 'competitive-research'],
    ['/app/campaigns-offers', 'campaigns'],
    ['/app/onboarding-forms', 'onboarding-forms'],
    ['/app/queue/internal', 'internal-queue'],
    ['/app/queue/client', 'client-queue'],
    ['/app/team', 'team'],
    ['/app/interface-config', 'interface-config'],
    ['/app/notifications', 'notifications'],
    ['/app/propagation', 'propagation'],
    ['/app/column-admin', 'column-admin'],
    ['/app/onboard', 'onboard'],
    ['/design-system', 'design-system'],
  ])('marks %s as %s', (pathname, key) => {
    expect(activeSectionKey(pathname)).toBe(key);
  });

  it('marks nothing on an unknown path', () => {
    expect(activeSectionKey('/sign-in')).toBeNull();
  });
});

/**
 * AI-57. The sidebar lists only what the viewer's role includes, and the decision is
 * `@tas/domain`'s. These tests hold the two sides together: the nav's section keys and the domain's
 * access table must name the SAME sections, or a section added to one silently has no rule in the
 * other.
 */
describe('navGroupsForRole', () => {
  // The integrity gate is that the nav and the domain name the SAME SET of sections — a key in
  // one with no partner in the other has either no access rule (if nav-only) or no sidebar entry
  // (if domain-only). Order used to be strict here (the sidebar iterated NAV_SECTIONS directly),
  // but the Oct 6/7 Upload Links relocation moves one key from the Production group to the
  // Settings group, so the flat sidebar order diverges from the domain's `NAV_SECTION_KEYS`
  // listing by one position. The sidebar's own order is still enforced by the "lists every
  // module in sidebar order" assertion above.
  it('nav keys and the domain access table name the same set', () => {
    expect([...NAV_SECTIONS.map((section) => section.key)].sort()).toEqual(
      [...NAV_SECTION_KEYS].sort(),
    );
  });

  it('gives an admin the whole LIVE catalogue: every group less the retired workspaces, and no emptied group', () => {
    const groups = navGroupsForRole('admin');
    expect(groups).toEqual(
      NAV_GROUPS.map((group) => ({
        ...group,
        sections: group.sections.filter((section) => !isRemovedWorkspace(section.key)),
      })).filter((group) => group.sections.length > 0),
    );
    // Campaigns and Settings / Lookups held nothing but retired workspaces, so the headings go too;
    // Copy keeps Copywriting and Reporting keeps Ad Spy, each now a one-section group.
    expect(groups.map((group) => group.key)).toEqual([
      'home',
      'strategy',
      'production',
      'copy',
      'reporting',
      'approvals',
      'settings',
      'dev',
    ]);
    expect(groups.find((group) => group.key === 'copy')?.sections.map((s) => s.key)).toEqual([
      'copywriting',
    ]);
    expect(groups.find((group) => group.key === 'reporting')?.sections.map((s) => s.key)).toEqual([
      'ad-spy',
    ]);
  });

  it('gives a video editor and a designer only their own sections, and drops empty groups', () => {
    for (const role of ['video_editor', 'designer'] as const) {
      const groups = navGroupsForRole(role);
      const keys = groups.flatMap((group) => group.sections.map((section) => section.key));

      // Set equality, not list equality. The Oct 6/7 relocation of Upload Links from the
      // Production group to the Settings group makes the sidebar's traversal order diverge from
      // `navSectionsForRole`'s domain order by one position (upload-links sits after
      // `notifications` in the sidebar, after `assets` in `EDITOR_SECTIONS`). The integrity gate
      // is still that the two name the SAME sections — the sidebar's own order has its own
      // explicit assertion above.
      expect([...keys].sort(), role).toEqual([...navSectionsForRole(role)].sort());
      // No heading without sections under it, and no group left behind by the filter.
      for (const group of groups) {
        expect(group.sections.length, group.key).toBeGreaterThan(0);
      }
      expect(
        groups.map((group) => group.key),
        role,
      ).toEqual(['home', 'production', 'settings']);
      // Production is the Creative Sheet and the Asset Library: Creative Design's list and Client
      // Assets were retired for every brand (Oct 7), and so was the Lookups group's one editor
      // section, Creative Dimensions.
      expect(
        groups.find((group) => group.key === 'production')?.sections.map((s) => s.key),
      ).toEqual(['creative-sheet', 'assets']);
      // Strategy, Copy, Campaigns, Reporting, Lookups and Reference vanish entirely: every section
      // in them is somebody else's desk or retired, so the heading goes with them.
      for (const gone of [
        'strategy',
        'copy',
        'campaigns-group',
        'reporting',
        'lookups',
        'dev',
      ] as const) {
        expect(
          groups.some((group) => group.key === gone),
          `${role}/${gone}`,
        ).toBe(false);
      }
      // Settings survives with the viewer's own notification preference AND Upload Links —
      // the two Settings-group sections an editor's role lets them open (access.ts
      // `EDITOR_SECTIONS` includes `upload-links`, "how a finished file comes back in").
      expect(groups.find((group) => group.key === 'settings')?.sections.map((s) => s.key)).toEqual([
        'notifications',
        'upload-links',
      ]);
    }
  });

  it('gives a client nothing, and an unresolved role nothing', () => {
    expect(navGroupsForRole('client')).toEqual([]);
    expect(navGroupsForRole(null)).toEqual([]);
    expect(navGroupsForRole(undefined)).toEqual([]);
  });

  it("never invents a section: every role's list is a subset of the catalogue", () => {
    const all = new Set(NAV_SECTIONS.map((section) => section.key));
    for (const role of [
      'admin',
      'csm',
      'strategist',
      'media_buyer',
      'video_editor',
      'designer',
      'client',
    ] as const) {
      for (const group of navGroupsForRole(role)) {
        for (const section of group.sections) {
          expect(all.has(section.key), `${role}/${section.key}`).toBe(true);
        }
      }
    }
  });

  it('leaves NAV_GROUPS itself untouched \u2014 the filter is a read, not a mutation', () => {
    const before = JSON.stringify(NAV_GROUPS);
    navGroupsForRole('video_editor');
    navGroupsForRole('client');
    expect(JSON.stringify(NAV_GROUPS)).toBe(before);
  });
});

describe('navGroupsForView · the template brand hides a set of sections (Oct 5 Talal sync)', () => {
  const KEYS = TEMPLATE_HIDDEN_SECTION_KEYS;

  // On 2026-10-06/07 Upload Links was relocated to the Settings group (docs/decisions.md), so it
  // left this template-only hide set — no brand lists it as a top-level nav section any more, and
  // the one management surface lives under Settings for every brand that imports its role.
  it('is derived from REMOVED_WORKSPACES plus the two queues, so the two lists cannot drift', () => {
    expect([...KEYS].sort()).toEqual(
      [...REMOVED_WORKSPACES, 'internal-queue', 'client-queue'].sort(),
    );
  });

  it('names the seventeen keys the decision covers, no more and no fewer', () => {
    expect([...KEYS].sort()).toEqual(
      [
        'ai-characters',
        'briefs',
        'campaigns',
        'client-assets',
        'client-queue',
        'competitive-research',
        'copy-types',
        'creative-dimensions',
        'creative-modules',
        'creative-reporting',
        'creator-ranking',
        'email-campaigns',
        'email-flows',
        'internal-queue',
        'performance',
        'sm-campaign-feed',
        'youtube-copywriting',
      ].sort(),
    );
  });

  it('upload-links left the template hide after the Oct 6/7 relocation to Settings', () => {
    expect(KEYS.has('upload-links')).toBe(false);
  });

  it('every hidden key resolves to a real section (no typo stays silent)', () => {
    const all = new Set(NAV_SECTIONS.map((section) => section.key));
    for (const key of KEYS) {
      expect(all.has(key), key).toBe(true);
    }
  });

  it("does not touch the regular 'copywriting' tab — only its label is renamed", () => {
    expect(KEYS.has('copywriting')).toBe(false);
  });

  it('on the template brand, every hidden key is dropped from an admin view', () => {
    const groups = navGroupsForView('admin', true);
    const seen = new Set(groups.flatMap((group) => group.sections.map((section) => section.key)));
    for (const key of KEYS) {
      expect(seen.has(key), `template admin still sees ${key}`).toBe(false);
    }
    // And every other admin section is still there — the hide is additive to the role filter.
    for (const section of NAV_SECTIONS) {
      if (KEYS.has(section.key)) continue;
      expect(seen.has(section.key), `template admin lost ${section.key}`).toBe(true);
    }
  });

  it('on a CHILD brand, nothing is hidden — Gratsi, Niagara and demo see the role view unchanged', () => {
    expect(navGroupsForView('admin', false)).toEqual(navGroupsForRole('admin'));
    for (const role of ['csm', 'strategist', 'video_editor', 'designer', 'media_buyer'] as const) {
      expect(navGroupsForView(role, false)).toEqual(navGroupsForRole(role));
    }
  });

  it('an empty group vanishes on the template too — Approvals goes with its two queues', () => {
    const groups = navGroupsForView('admin', true);
    // The `approvals` group is the two queues, both template-hidden, so the heading drops out of an
    // admin's view on the template — the same shape the role filter uses. (Lookups and Campaigns
    // are already gone on every brand: see the REMOVED_WORKSPACES block below.)
    expect(groups.some((group) => group.key === 'approvals')).toBe(false);
    expect(groups.some((group) => group.key === 'lookups')).toBe(false);
    expect(navGroupsForView('admin', false).some((group) => group.key === 'approvals')).toBe(true);
  });

  /**
   * Oct 6/7 Upload Links relocation. The management surface sits inside the Settings group now;
   * no brand's sidebar lists it as a top-level nav section, and no brand's sidebar hides it from
   * a role that can open it. Covers template AND child brands, every role whose access rule
   * includes `upload-links`.
   */
  it('upload-links lives inside the Settings group, never in Production, on every brand and role that may open it', () => {
    for (const isTemplate of [false, true] as const) {
      for (const role of [
        'admin',
        'csm',
        'strategist',
        'media_buyer',
        'video_editor',
        'designer',
      ] as const) {
        const groups = navGroupsForView(role, isTemplate);
        const settings = groups.find((group) => group.key === 'settings');
        const production = groups.find((group) => group.key === 'production');
        const label = `${role}/${isTemplate ? 'template' : 'child'}`;
        expect(
          settings?.sections.map((section) => section.key),
          `${label} settings`,
        ).toContain('upload-links');
        expect(
          production?.sections.map((section) => section.key) ?? [],
          `${label} production`,
        ).not.toContain('upload-links');
      }
    }
  });

  it('leaves TEMPLATE_HIDDEN_SECTION_KEYS and NAV_GROUPS untouched — reads, never mutations', () => {
    const beforeKeys = [...KEYS].sort().join(',');
    const beforeGroups = JSON.stringify(NAV_GROUPS);
    navGroupsForView('admin', true);
    navGroupsForView('video_editor', false);
    expect([...KEYS].sort().join(',')).toBe(beforeKeys);
    expect(JSON.stringify(NAV_GROUPS)).toBe(beforeGroups);
  });
});

/**
 * The Oct 7 Talal template cleanup: fifteen workspaces hidden FOR EVERY BRAND through one list in
 * `@tas/domain` (`REMOVED_WORKSPACES`). The nav keeps their entries — the catalogue, the typing and
 * `activeSectionKey` are untouched, which is what the tests at the top of this file still assert —
 * and the hide happens where every other visibility decision does, in `canSeeNavSection`.
 */
describe('REMOVED_WORKSPACES · hidden on every brand, for every role', () => {
  const ROLES = [
    'admin',
    'csm',
    'strategist',
    'media_buyer',
    'video_editor',
    'designer',
    'client',
    'member',
  ] as const;

  it('every retired key is still a catalogue entry with an href, so an old URL still resolves to its section', () => {
    const byKey = new Map(NAV_SECTIONS.map((section) => [section.key, section]));
    for (const key of REMOVED_WORKSPACES) {
      expect(byKey.get(key)?.href, key).toBeDefined();
    }
    expect(activeSectionKey('/app/creative-design')).toBe('briefs');
    expect(activeSectionKey('/app/performance')).toBe('performance');
  });

  it('never reaches a sidebar: no role, on the template or on a child brand', () => {
    for (const role of ROLES) {
      for (const isTemplate of [false, true] as const) {
        const seen = new Set(
          navGroupsForView(role, isTemplate).flatMap((group) =>
            group.sections.map((section) => section.key),
          ),
        );
        for (const key of REMOVED_WORKSPACES) {
          expect(seen.has(key), `${role}/${isTemplate ? 'template' : 'child'}/${key}`).toBe(false);
        }
      }
    }
  });

  it('a group left with nothing but retired workspaces vanishes for every role', () => {
    for (const role of ROLES) {
      const keys = navGroupsForRole(role).map((group) => group.key);
      expect(keys, role).not.toContain('campaigns-group');
      expect(keys, role).not.toContain('lookups');
      for (const group of navGroupsForRole(role)) {
        expect(group.sections.length, `${role}/${group.key}`).toBeGreaterThan(0);
      }
    }
  });

  it('the kept workspaces are still offered to the roles that may open them', () => {
    const admin = new Set(
      navGroupsForRole('admin').flatMap((group) => group.sections.map((section) => section.key)),
    );
    for (const kept of [
      'copywriting',
      'ad-spy',
      'upload-links',
      'internal-queue',
      'client-queue',
      'creative-sheet',
      'assets',
      'ugc',
    ] as const) {
      expect(admin.has(kept), kept).toBe(true);
    }
  });
});
