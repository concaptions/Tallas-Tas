import { DEMO_ACTOR_ID, DEMO_ADMIN_ACTOR_ID, demoTeam, type TeamListRow } from '@tas/db';
import { canSeeTeamPage } from '@tas/domain';
import { describe, expect, it, vi } from 'vitest';

import { currentTeamActor, teamPageActorFrom } from './team-actor';

/**
 * Demo mode must never reach Clerk, so the default throws: a demo-mode test that passes proves the
 * session was never asked for. The live-mode tests inject their own `session`.
 */
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(() => {
    throw new Error('the page reached Clerk');
  }),
}));

const demoMode = (value: boolean) => () => value;
const session = (userId: string | null) => () => Promise.resolve({ userId });

function row(clerkUserId: string): TeamListRow {
  const found = demoTeam.find((member) => member.clerkUserId === clerkUserId);
  if (found === undefined) {
    throw new Error(`no fixture for ${clerkUserId}`);
  }
  return found;
}

describe('teamPageActorFrom', () => {
  it('splits an admin row into the agency role, with no brand roles', () => {
    expect(teamPageActorFrom(row(DEMO_ADMIN_ACTOR_ID))).toEqual({
      agencyRole: 'admin',
      brandRoles: [],
    });
  });

  it('puts a brand role on the brand side and leaves the agency side null', () => {
    expect(teamPageActorFrom(row(DEMO_ACTOR_ID))).toEqual({
      agencyRole: null,
      brandRoles: ['strategist'],
    });
  });

  it('keeps both roles of a two-hat row', () => {
    expect(teamPageActorFrom(row('user_seed_csm'))).toEqual({
      agencyRole: null,
      brandRoles: ['csm', 'media_buyer'],
    });
  });

  it('is null for somebody who is not on the roster at all', () => {
    expect(teamPageActorFrom(undefined)).toBeNull();
  });

  it('feeds the guard: the admin and the CSM are in, the strategist is out', () => {
    expect(canSeeTeamPage(teamPageActorFrom(row(DEMO_ADMIN_ACTOR_ID)))).toBe(true);
    expect(canSeeTeamPage(teamPageActorFrom(row('user_seed_csm')))).toBe(true);
    expect(canSeeTeamPage(teamPageActorFrom(row(DEMO_ACTOR_ID)))).toBe(false);
    expect(canSeeTeamPage(teamPageActorFrom(undefined))).toBe(false);
  });
});

describe('currentTeamActor', () => {
  it('stands the stub actor in for an admin in demo mode, without asking Clerk', async () => {
    const asked = vi.fn(() => Promise.resolve({ userId: 'never' }));

    const actor = await currentTeamActor(demoTeam, { demoMode: demoMode(true), session: asked });

    expect(actor).toEqual({ agencyRole: 'admin', brandRoles: [] });
    expect(canSeeTeamPage(actor)).toBe(true);
    expect(asked).not.toHaveBeenCalled();
  });

  it('resolves the live actor from the session against the rows already read', async () => {
    const actor = await currentTeamActor(demoTeam, {
      demoMode: demoMode(false),
      session: session(DEMO_ADMIN_ACTOR_ID),
    });

    expect(actor).toEqual({ agencyRole: 'admin', brandRoles: [] });
    expect(canSeeTeamPage(actor)).toBe(true);
  });

  it('denies a signed-in strategist, who is on the roster but not on this page', async () => {
    const actor = await currentTeamActor(demoTeam, {
      demoMode: demoMode(false),
      session: session(DEMO_ACTOR_ID),
    });

    expect(canSeeTeamPage(actor)).toBe(false);
  });

  it('is null with no session, and null for an account that holds no roster row', async () => {
    expect(
      await currentTeamActor(demoTeam, { demoMode: demoMode(false), session: session(null) }),
    ).toBeNull();
    expect(
      await currentTeamActor(demoTeam, {
        demoMode: demoMode(false),
        session: session('user_not_on_this_team'),
      }),
    ).toBeNull();
  });
});
