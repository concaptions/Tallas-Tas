import { auth, clerkClient } from '@clerk/nextjs/server';

/**
 * First-run provisioning (P5-001): when a signed-in user has no active Clerk Organization, create
 * one and set it as active. The org becomes the tenant discriminator for every subsequent query.
 *
 * This runs in the app shell layout AFTER `auth.protect()`, so it is never reached in demo mode.
 * It is idempotent: a user who already has an active org passes through without any Backend API call.
 */
export async function ensureOrganization(): Promise<void> {
  const session = await auth.protect();
  if (session.orgId !== undefined) {
    return;
  }

  const client = await clerkClient();
  const existingOrgs = await client.users.getOrganizationMembershipList({
    userId: session.userId,
  });
  if (existingOrgs.totalCount > 0) {
    return;
  }

  const org = await client.organizations.createOrganization({
    name: 'TAS Digital',
    slug: 'tas-digital',
    createdBy: session.userId,
  });

  await client.organizations.updateOrganizationMembership({
    organizationId: org.id,
    userId: session.userId,
    role: 'org:admin',
  });
}
