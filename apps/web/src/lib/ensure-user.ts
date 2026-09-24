import { auth, currentUser } from '@clerk/nextjs/server';
import { ensureAgencyUser, isAgencyUserProvisioned } from '@tas/db';
import { serverEnv } from '@tas/env';

import { isDemoMode } from './demo-mode';
import { requestConnection } from './request-db';

/**
 * First-run provisioning for a signed-in Clerk user (2D), the sibling of `ensureOrganization`.
 *
 * Without a `users` row and an agency `membership`, a real Clerk account is invisible to the parts
 * of the app that resolve the actor from the roster — `team-actor.ts` matches the session against
 * `clerk_user_id`, so the Team page and the promotion queue deny a user who was never provisioned.
 * This reads the Clerk profile and hands it to `ensureAgencyUser`, which creates the row idempotently
 * and — only when the active org maps to an agency — the membership. Clerk org membership is the
 * authorisation; a stranger with a Clerk account but no mapped org gets a user row and no tenant.
 *
 * Runs in the app shell layout after `auth.protect()`, in parallel with the rest of the layout's
 * reads (none of them needs its writes within the same request). The steady state is ONE query on
 * the request's shared connection — `isAgencyUserProvisioned` — and returns; the Clerk profile fetch
 * and the writes happen only for a user who is genuinely not provisioned yet. It used to fetch the
 * Clerk profile and open its own pool on every request, which put a Clerk API round trip and a full
 * Postgres handshake on every full page load.
 *
 * Wrapped in try/catch like `ensureOrganization`: provisioning is a convenience, not a gate, so a
 * database or Clerk hiccup lets the app load rather than taking the whole shell down.
 */
export async function ensureUser(): Promise<void> {
  try {
    if (isDemoMode()) {
      return;
    }
    const { userId, orgId, orgRole } = await auth();
    if (!userId) {
      return;
    }
    const databaseUrl = serverEnv().DATABASE_URL;
    if (databaseUrl === undefined) {
      return;
    }
    const { db } = requestConnection(databaseUrl);
    if (await isAgencyUserProvisioned(db, { clerkUserId: userId, clerkOrgId: orgId ?? null })) {
      return;
    }

    const profile = await currentUser();
    const email =
      profile?.primaryEmailAddress?.emailAddress ?? profile?.emailAddresses[0]?.emailAddress;
    if (email === undefined) {
      // `users.email` is NOT NULL and UNIQUE; without an email there is no row to write.
      return;
    }
    const fullName =
      [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') ||
      profile?.username ||
      email;

    await ensureAgencyUser(db, {
      clerkUserId: userId,
      email,
      fullName,
      clerkOrgId: orgId ?? null,
      isOrgAdmin: orgRole === 'org:admin',
    });
  } catch (error: unknown) {
    console.error('[ensureUser] Failed — the app will load without provisioning:', error);
  }
}
