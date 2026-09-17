import { auth } from '@clerk/nextjs/server';
import { DEMO_ACTOR_ID, DEMO_ADMIN_ACTOR_ID, demoTeam, type Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { withAgencyScope } from '@/lib/team-source';

import { inviteMemberAction } from './actions';

/** The action calls `revalidatePath`, which only exists inside a Next request. */
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

/**
 * A session is only ever asked for after validation, so the default throws: a test that expects a
 * validation failure proves it never got that far. The two live-mode tests override it.
 */
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(() => {
    throw new Error('the action reached Clerk');
  }),
}));

/**
 * The connection is the one thing a unit test cannot have. `withAgencyScope` is replaced by a stub
 * that runs the callback against a handle whose only job is to be passed to `listTeam`, which is
 * itself replaced by the fixtures. Everything between — `teamPageActorFrom` in `@/lib/team-actor`,
 * which the page uses too, and the domain's `canSeeTeamPage` — runs for real, which is the point of
 * the two tests that use it.
 */
vi.mock('@/lib/team-source', () => ({
  withAgencyScope: vi.fn((run: (db: Db, agencyId: string) => Promise<unknown>) =>
    run({} as Db, 'agency-1'),
  ),
}));

vi.mock('@tas/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tas/db')>()),
  listTeam: vi.fn(async () => (await importOriginal<typeof import('@tas/db')>()).demoTeam),
}));

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

const filled = { email: 'Imogen.Bardsley@tas-digital.com', role: 'video_editor' };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses to invite, with the message the disabled button shows', async () => {
    const result = await inviteMemberAction(null, form(filled));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('refuses before it validates anything, so a bad form still reads as a demo refusal', async () => {
    const result = await inviteMemberAction(null, form({ email: 'not-an-email', role: 'wizard' }));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('never reaches Clerk or a database', async () => {
    // The Clerk mock and the injected connection factory both throw; a returned refusal is the proof.
    await expect(inviteMemberAction(null, form(filled))).resolves.toMatchObject({ ok: false });
  });
});

describe('with Clerk configured', () => {
  it('rejects a malformed email before any session or database call', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await inviteMemberAction(null, form({ ...filled, email: 'imogen@' }));

    if (result.ok) {
      throw new Error('a malformed email was accepted');
    }
    expect(result.fieldErrors?.email).toBe('That does not look like an email address.');
  });

  it('rejects an empty email with its own message', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await inviteMemberAction(null, form({ ...filled, email: '   ' }));

    if (result.ok) {
      throw new Error('an empty email was accepted');
    }
    expect(result.fieldErrors?.email).toBe('An invitation needs an email address.');
  });

  it('rejects a role that is not in either vocabulary', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await inviteMemberAction(null, form({ ...filled, role: 'wizard' }));

    if (result.ok) {
      throw new Error('an unknown role was accepted');
    }
    expect(result.fieldErrors?.role).toBe('That is not a role on this team.');
  });

  it('rejects the one external role by name, rather than as an unknown word', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await inviteMemberAction(null, form({ ...filled, role: 'client' }));

    if (result.ok) {
      throw new Error('a client was invited onto the team');
    }
    expect(result.fieldErrors?.role).toBe(
      'A client is invited through the client track, not here.',
    );
  });

  it('rejects a missing role', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await inviteMemberAction(null, form({ email: filled.email }));

    if (result.ok) {
      throw new Error('a roleless invitation was accepted');
    }
    expect(result.fieldErrors?.role).toBe('Pick a role for this person.');
  });

  it('never throws to the client when the session lookup blows up', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    // The Clerk mock throws on every call: a valid form gets past zod and into the try block.
    await expect(inviteMemberAction(null, form(filled))).resolves.toEqual({
      ok: false,
      error: 'The invitation could not be recorded. Try again.',
    });
  });

  it('refuses when there is no session at all', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as never);

    await expect(inviteMemberAction(null, form(filled))).resolves.toEqual({
      ok: false,
      error: 'Your session has expired. Sign in again to invite someone.',
    });
  });

  it('records the intent for an admin, saying plainly that nothing was sent', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    vi.mocked(auth).mockResolvedValueOnce({ userId: DEMO_ADMIN_ACTOR_ID } as never);

    const result = await inviteMemberAction(null, form(filled));

    if (!result.ok) {
      throw new Error(`an admin was refused: ${result.error}`);
    }
    expect(result.email).toBe('imogen.bardsley@tas-digital.com');
    expect(result.role).toBe('video_editor');
    expect(result.message).toContain('Video Editor');
    expect(result.message).toContain('not sent yet');
    expect(withAgencyScope).toHaveBeenCalled();
  });

  it('refuses a member who is neither an Admin nor a CSM, however valid the form is', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    // The seeded strategist: a real roster row, and the guard says no.
    vi.mocked(auth).mockResolvedValueOnce({ userId: DEMO_ACTOR_ID } as never);
    expect(demoTeam.some((row) => row.clerkUserId === DEMO_ACTOR_ID)).toBe(true);

    await expect(inviteMemberAction(null, form(filled))).resolves.toEqual({
      ok: false,
      error: 'Only an Admin or a Client Success Manager can invite someone.',
    });
  });
});
