import { auth, clerkClient } from '@clerk/nextjs/server';

/**
 * First-run provisioning (P5-001): when a signed-in user has no active Clerk Organization, create
 * one and set it as active. The org becomes the tenant discriminator for every subsequent query.
 *
 * This runs in the app shell layout AFTER `auth.protect()`, so it is never reached in demo mode.
 * It is idempotent: a user who already has an active org passes through without any Backend API call.
 *
 * Wrapped in try/catch: if the Clerk Backend API rejects the call (403, missing permissions, plan
 * limits), the app still loads — the org can be created manually in the Clerk dashboard.
 */
export async function ensureOrganization(): Promise<void> {
  try {
    const session = await auth();
    if (session.orgId) {
      return;
    }
    if (!session.userId) {
      return;
    }

    const client = await clerkClient();
    const existingOrgs = await client.users.getOrganizationMembershipList({
      userId: session.userId,
    });
    if (existingOrgs.totalCount > 0) {
      // The person already belongs to an organization but has not SELECTED one. Nothing here can
      // fix that: the active organization lives in the session and Clerk only moves it from the
      // client, through `setActive`. `components/shell/org-switcher.tsx` does it there — silently
      // when there is exactly one membership, and through the switcher when there are several.
      return;
    }

    await client.organizations.createOrganization({
      name: 'TAS Digital',
      slug: `tas-digital-${session.userId.slice(-6)}`,
      createdBy: session.userId,
    });
  } catch (error: unknown) {
    console.error('[ensureOrganization] Failed — the app will load without an org:', error);
  }
}
