import { describe, expect, it } from 'vitest';

import { brandRoles, type BrandRole } from '../roles';
import {
  DEMO_PROPAGATION_ACCESS_NOTE,
  INTERFACE_CONFIG_NOT_PERMITTED_NOTE,
  NAV_SECTION_KEYS,
  NO_WORKSPACE_NOTE,
  REMOVED_WORKSPACES,
  REMOVED_WORKSPACE_REDIRECTS,
  NO_WORKSPACE_TITLE,
  SECTION_NOT_PERMITTED_NOTE,
  SECTION_NOT_PERMITTED_TITLE,
  DEMO_TEAM_ACCESS_NOTE,
  DEMO_TEAM_ACTOR,
  PROPAGATION_ADMIN_NOTE,
  PROPAGATION_NOT_ADMIN_NOTE,
  TEAM_ACCESS_ROLES,
  canConfigureInterface,
  canSeeInternalWorkspace,
  canSeeNavSection,
  canSeePropagationPage,
  canSeeTeamPage,
  isRemovedWorkspace,
  navSectionsForRole,
  teamAccessNote,
} from './access';

/** The catalogue less the retired workspaces: what "every section" means since 2026-10-07. */
const LIVE_KEYS = NAV_SECTION_KEYS.filter((key) => !isRemovedWorkspace(key));

describe('canSeeTeamPage', () => {
  it('lets an agency admin in', () => {
    expect(canSeeTeamPage({ agencyRole: 'admin', brandRoles: [] })).toBe(true);
  });

  it('lets a CSM in, whatever their agency role', () => {
    expect(canSeeTeamPage({ agencyRole: 'member', brandRoles: ['csm'] })).toBe(true);
    expect(canSeeTeamPage({ agencyRole: null, brandRoles: ['csm'] })).toBe(true);
  });

  it('lets a CSM in when csm is one of several brand roles', () => {
    expect(canSeeTeamPage({ agencyRole: 'member', brandRoles: ['media_buyer', 'csm'] })).toBe(true);
  });

  it('refuses every other brand role held alone', () => {
    const refused = brandRoles.filter((role): role is BrandRole => role !== 'csm');
    for (const role of refused) {
      expect(canSeeTeamPage({ agencyRole: 'member', brandRoles: [role] })).toBe(false);
    }
    expect(refused).toEqual(['strategist', 'video_editor', 'designer', 'media_buyer', 'client']);
  });

  it('refuses a plain agency member with no brand roles', () => {
    expect(canSeeTeamPage({ agencyRole: 'member', brandRoles: [] })).toBe(false);
  });

  it('refuses a client, who must never see the agency roster', () => {
    expect(canSeeTeamPage({ agencyRole: null, brandRoles: ['client'] })).toBe(false);
  });

  it('denies by default when the actor is missing or empty', () => {
    expect(canSeeTeamPage(null)).toBe(false);
    expect(canSeeTeamPage(undefined)).toBe(false);
    expect(canSeeTeamPage({})).toBe(false);
    expect(canSeeTeamPage({ agencyRole: null, brandRoles: null })).toBe(false);
  });

  it('is pure: the same actor answers the same twice', () => {
    const actor = { agencyRole: 'member', brandRoles: ['csm'] } as const;
    expect(canSeeTeamPage(actor)).toBe(canSeeTeamPage(actor));
  });
});

describe('TEAM_ACCESS_ROLES', () => {
  it('is the admin agency role and the csm brand role, in note order', () => {
    expect(TEAM_ACCESS_ROLES).toEqual(['admin', 'csm']);
  });

  it('admits exactly the roles the guard admits', () => {
    const [agency, brand] = TEAM_ACCESS_ROLES;
    expect(canSeeTeamPage({ agencyRole: agency })).toBe(true);
    expect(canSeeTeamPage({ brandRoles: [brand] })).toBe(true);
  });
});

describe('teamAccessNote', () => {
  it('reads the ticket sentence, built from the role labels', () => {
    expect(teamAccessNote()).toBe('Admin and Client Success Managers only.');
  });

  it('names both roles the guard admits', () => {
    expect(teamAccessNote()).toContain('Admin');
    expect(teamAccessNote()).toContain('Client Success Manager');
  });
});

describe('demo mode', () => {
  it('stands the stub actor in for an admin', () => {
    expect(DEMO_TEAM_ACTOR.agencyRole).toBe('admin');
    expect(canSeeTeamPage(DEMO_TEAM_ACTOR)).toBe(true);
  });

  it('carries one sentence explaining why', () => {
    expect(DEMO_TEAM_ACCESS_NOTE).toBe(
      'Demo mode signs you in as an Admin, so the full roster shows.',
    );
  });
});

describe('canSeePropagationPage', () => {
  it('lets an agency admin in, and nobody else', () => {
    expect(canSeePropagationPage({ agencyRole: 'admin', brandRoles: [] })).toBe(true);
    expect(canSeePropagationPage({ agencyRole: 'member', brandRoles: [] })).toBe(false);
  });

  it('is strictly narrower than canSeeTeamPage: a CSM sees the roster, not the queue', () => {
    const csm = { agencyRole: 'member', brandRoles: ['csm'] } as const;
    expect(canSeeTeamPage(csm)).toBe(true);
    expect(canSeePropagationPage(csm)).toBe(false);
  });

  it('refuses every brand role held alone', () => {
    for (const role of brandRoles) {
      expect(canSeePropagationPage({ agencyRole: null, brandRoles: [role] })).toBe(false);
    }
  });

  it('denies by default when the actor is missing or empty', () => {
    expect(canSeePropagationPage(null)).toBe(false);
    expect(canSeePropagationPage(undefined)).toBe(false);
    expect(canSeePropagationPage({})).toBe(false);
    expect(canSeePropagationPage({ agencyRole: null, brandRoles: null })).toBe(false);
  });

  it('admits the demo stub actor, which stands in for an admin', () => {
    expect(canSeePropagationPage(DEMO_TEAM_ACTOR)).toBe(true);
  });
});

describe('the propagation notes', () => {
  it('say the page is admin only, what a request is and who settles it', () => {
    expect(PROPAGATION_ADMIN_NOTE).toContain('admin only');
    expect(PROPAGATION_ADMIN_NOTE).toContain('request promotion to the template');
    expect(PROPAGATION_ADMIN_NOTE).toContain('approves or rejects it here');
    expect(PROPAGATION_ADMIN_NOTE).toContain('nothing is promoted automatically');
  });

  it('say in demo mode that the check is stubbed rather than skipped', () => {
    expect(DEMO_PROPAGATION_ACCESS_NOTE).toContain('Admin');
    expect(DEMO_PROPAGATION_ACCESS_NOTE).toContain('stubbed');
    expect(DEMO_PROPAGATION_ACCESS_NOTE).toContain('not skipped');
  });

  it('name the role that can act when the guard refuses', () => {
    expect(PROPAGATION_NOT_ADMIN_NOTE).toContain('Admin');
  });

  it('are plain sentences with no markup', () => {
    for (const note of [
      PROPAGATION_ADMIN_NOTE,
      DEMO_PROPAGATION_ACCESS_NOTE,
      PROPAGATION_NOT_ADMIN_NOTE,
    ]) {
      expect(note).not.toContain('<');
      expect(note.trim()).toBe(note);
      expect(note.endsWith('.')).toBe(true);
    }
  });
});

/**
 * AI-57. One case per role, because the whole point of the rule is that the roles DIFFER: a test
 * that only checked "an editor sees fewer sections" would pass with the client seeing everything.
 */
describe('canSeeNavSection / navSectionsForRole', () => {
  it('gives an agency admin every live section (PRD §11: everything, all brands)', () => {
    expect(navSectionsForRole('admin')).toEqual(LIVE_KEYS);
    for (const key of LIVE_KEYS) {
      expect(canSeeNavSection('admin', key), key).toBe(true);
    }
  });

  it('gives a client nothing internal (PRD §11: their own brand interface only)', () => {
    expect(navSectionsForRole('client')).toEqual([]);
    for (const key of NAV_SECTION_KEYS) {
      expect(canSeeNavSection('client', key), key).toBe(false);
    }
  });

  it('confines a video editor and a designer to the creative-design work', () => {
    for (const role of ['video_editor', 'designer'] as const) {
      // `briefs`, `client-assets` and `creative-dimensions` are in the editor's job description
      // (`EDITOR_SECTIONS`) but retired for every brand, so they are cut out here.
      expect(navSectionsForRole(role), role).toEqual([
        'overview',
        'creative-sheet',
        'assets',
        'upload-links',
        'notifications',
      ]);
      // Their own work, yes; somebody else's desk, no.
      expect(canSeeNavSection(role, 'creative-sheet')).toBe(true);
      expect(canSeeNavSection(role, 'assets')).toBe(true);
      expect(canSeeNavSection(role, 'personas')).toBe(false);
      expect(canSeeNavSection(role, 'angles')).toBe(false);
      expect(canSeeNavSection(role, 'themes')).toBe(false);
      expect(canSeeNavSection(role, 'concepts')).toBe(false);
      expect(canSeeNavSection(role, 'performance')).toBe(false);
      expect(canSeeNavSection(role, 'team')).toBe(false);
      expect(canSeeNavSection(role, 'internal-queue')).toBe(false);
      expect(canSeeNavSection(role, 'client-queue')).toBe(false);
    }
  });

  it('keeps the breadth a CSM, a strategist and a media buyer have today, less the admin pages', () => {
    for (const role of ['csm', 'strategist', 'media_buyer'] as const) {
      const sections = navSectionsForRole(role);
      // Every live section except the five the Admin keeps.
      expect(sections.length, role).toBe(LIVE_KEYS.length - 5);
      expect(canSeeNavSection(role, 'propagation'), role).toBe(false);
      expect(canSeeNavSection(role, 'column-admin'), role).toBe(false);
      expect(canSeeNavSection(role, 'interface-config'), role).toBe(false);
      expect(canSeeNavSection(role, 'onboard'), role).toBe(false);
      expect(canSeeNavSection(role, 'onboarding-forms'), role).toBe(false);
      // The strategy, production, copy, reporting and queue modules that are still live stay.
      for (const key of [
        'personas',
        'concepts',
        'creative-sheet',
        'copywriting',
        'ad-spy',
        'internal-queue',
      ] as const) {
        expect(canSeeNavSection(role, key), `${role}/${key}`).toBe(true);
      }
    }
  });

  /**
   * The nav filter and the three routes that ALREADY refuse a non-admin must agree. All three call
   * `canSeePropagationPage`, so a role this rule lets near them would be offered a link to a page
   * that says no.
   */
  it('never offers an admin-only page to somebody the existing route guard refuses', () => {
    for (const role of brandRoles) {
      const actor = { agencyRole: null, brandRoles: [role] };
      for (const key of ['propagation', 'column-admin', 'interface-config'] as const) {
        if (!canSeePropagationPage(actor)) {
          expect(canSeeNavSection(role, key), `${role}/${key}`).toBe(false);
        }
      }
    }
  });

  it('denies by default on an unresolved role and on an unknown key', () => {
    expect(canSeeNavSection(null, 'creative-sheet')).toBe(false);
    expect(canSeeNavSection(undefined, 'creative-sheet')).toBe(false);
    expect(navSectionsForRole(null)).toEqual([]);
    expect(navSectionsForRole(undefined)).toEqual([]);
    for (const role of ['admin', ...brandRoles] as const) {
      expect(canSeeNavSection(role, 'nonsense'), role).toBe(false);
      expect(canSeeNavSection(role, ''), role).toBe(false);
    }
  });

  it('answers for every role in both vocabularies, and keys are unique', () => {
    for (const role of ['admin', 'member', ...brandRoles] as const) {
      expect(() => navSectionsForRole(role), role).not.toThrow();
    }
    // `member` is the Clerk default for somebody with no brand assignment: not in the table, so it
    // gets nothing rather than everything.
    expect(navSectionsForRole('member')).toEqual([]);
    expect(new Set(NAV_SECTION_KEYS).size).toBe(NAV_SECTION_KEYS.length);
  });

  it('answers whether a role belongs in the internal workspace at all', () => {
    for (const role of [
      'admin',
      'csm',
      'strategist',
      'media_buyer',
      'video_editor',
      'designer',
    ] as const) {
      expect(canSeeInternalWorkspace(role), role).toBe(true);
    }
    // A client's product is `/client/<brand>`; a member has no assignment yet; null is unresolved.
    expect(canSeeInternalWorkspace('client')).toBe(false);
    expect(canSeeInternalWorkspace('member')).toBe(false);
    expect(canSeeInternalWorkspace(null)).toBe(false);
    expect(canSeeInternalWorkspace(undefined)).toBe(false);
  });

  it('refusal strings are plain sentences with no markup', () => {
    for (const note of [
      SECTION_NOT_PERMITTED_TITLE,
      SECTION_NOT_PERMITTED_NOTE,
      NO_WORKSPACE_TITLE,
      NO_WORKSPACE_NOTE,
    ]) {
      expect(note).not.toContain('<');
      expect(note.trim()).toBe(note);
      expect(note.endsWith('.')).toBe(true);
    }
  });
});

/**
 * The Oct 7 template cleanup (Talal): fifteen workspaces hidden for every brand behind ONE list.
 * Nothing is deleted — the keys stay in `NAV_SECTION_KEYS` so the nav's catalogue, the route guards
 * and `activeSectionKey` keep their types — but no role can see them, and every one has somewhere
 * to redirect to.
 */
describe('REMOVED_WORKSPACES (Oct 7 Talal template cleanup)', () => {
  it('names the fifteen retired workspaces, each a real section key, none twice', () => {
    expect([...REMOVED_WORKSPACES].sort()).toEqual(
      [
        'ai-characters',
        'briefs',
        'campaigns',
        'client-assets',
        'competitive-research',
        'copy-types',
        'creative-dimensions',
        'creative-modules',
        'creative-reporting',
        'creator-ranking',
        'email-campaigns',
        'email-flows',
        'performance',
        'sm-campaign-feed',
        'youtube-copywriting',
      ].sort(),
    );
    expect(new Set(REMOVED_WORKSPACES).size).toBe(REMOVED_WORKSPACES.length);
    for (const key of REMOVED_WORKSPACES) {
      expect(NAV_SECTION_KEYS).toContain(key);
    }
  });

  it('keeps the workspaces Talal kept: Copywriting, Ad Spy, Upload Links, the queues, the Creative Sheet', () => {
    for (const kept of [
      'copywriting',
      'ad-spy',
      'upload-links',
      'internal-queue',
      'client-queue',
      'creative-sheet',
      'assets',
      'overview',
    ] as const) {
      expect(isRemovedWorkspace(kept), kept).toBe(false);
    }
  });

  it('is invisible to EVERY role, the Admin included, and absent from every role list', () => {
    for (const role of ['admin', 'member', ...brandRoles] as const) {
      for (const key of REMOVED_WORKSPACES) {
        expect(canSeeNavSection(role, key), `${role}/${key}`).toBe(false);
        expect(navSectionsForRole(role), `${role}/${key}`).not.toContain(key);
      }
    }
  });

  it('leaves every live section exactly where it was for every role', () => {
    // The admin's list is the catalogue minus the retired keys, in catalogue order — nothing else
    // moved, so an unrelated section cannot have been lost in the cut.
    expect(navSectionsForRole('admin')).toEqual(
      NAV_SECTION_KEYS.filter((key) => !isRemovedWorkspace(key)),
    );
    for (const role of ['csm', 'strategist', 'media_buyer'] as const) {
      expect(navSectionsForRole(role), role).toEqual(
        navSectionsForRole('admin').filter(
          (key) =>
            ![
              'propagation',
              'column-admin',
              'interface-config',
              'onboarding-forms',
              'onboard',
            ].includes(key),
        ),
      );
    }
  });

  it('maps every retired key to a redirect target, and only the three that have a successor page leave the Overview', () => {
    expect(Object.keys(REMOVED_WORKSPACE_REDIRECTS).sort()).toEqual([...REMOVED_WORKSPACES].sort());
    expect(REMOVED_WORKSPACE_REDIRECTS.briefs).toBe('creative-sheet');
    expect(REMOVED_WORKSPACE_REDIRECTS['client-assets']).toBe('assets');
    expect(REMOVED_WORKSPACE_REDIRECTS['youtube-copywriting']).toBe('copywriting');
    for (const key of REMOVED_WORKSPACES) {
      if (key === 'briefs' || key === 'client-assets' || key === 'youtube-copywriting') continue;
      expect(REMOVED_WORKSPACE_REDIRECTS[key], key).toBe('overview');
    }
    // A target is always a LIVE section, never another retired one — no redirect chains.
    for (const target of Object.values(REMOVED_WORKSPACE_REDIRECTS)) {
      expect(isRemovedWorkspace(target), target).toBe(false);
      expect(canSeeNavSection('admin', target), target).toBe(true);
    }
  });

  it('isRemovedWorkspace takes any string and is a type guard over the list', () => {
    expect(isRemovedWorkspace('briefs')).toBe(true);
    expect(isRemovedWorkspace('nonsense')).toBe(false);
    expect(isRemovedWorkspace('')).toBe(false);
  });
});

describe('canConfigureInterface', () => {
  it('lets an agency admin in', () => {
    expect(canConfigureInterface({ agencyRole: 'admin', brandRoles: [] })).toBe(true);
  });

  it('lets a CSM in, whatever their agency role', () => {
    expect(canConfigureInterface({ agencyRole: 'member', brandRoles: ['csm'] })).toBe(true);
    expect(canConfigureInterface({ agencyRole: null, brandRoles: ['csm'] })).toBe(true);
  });

  it('refuses every other brand role held alone', () => {
    const refused = brandRoles.filter((role): role is BrandRole => role !== 'csm');
    for (const role of refused) {
      expect(canConfigureInterface({ agencyRole: 'member', brandRoles: [role] }), role).toBe(false);
    }
  });

  it('denies by default', () => {
    expect(canConfigureInterface(null)).toBe(false);
    expect(canConfigureInterface(undefined)).toBe(false);
    expect(canConfigureInterface({})).toBe(false);
  });

  it('refusal note is a plain sentence', () => {
    expect(INTERFACE_CONFIG_NOT_PERMITTED_NOTE).not.toContain('<');
    expect(INTERFACE_CONFIG_NOT_PERMITTED_NOTE.endsWith('.')).toBe(true);
  });
});
