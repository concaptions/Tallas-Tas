import { describe, expect, it } from 'vitest';

import { brandRoles, type BrandRole } from '../roles';
import {
  DEMO_PROPAGATION_ACCESS_NOTE,
  DEMO_TEAM_ACCESS_NOTE,
  DEMO_TEAM_ACTOR,
  PROPAGATION_ADMIN_NOTE,
  PROPAGATION_NOT_ADMIN_NOTE,
  TEAM_ACCESS_ROLES,
  canSeePropagationPage,
  canSeeTeamPage,
  teamAccessNote,
} from './access';

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
