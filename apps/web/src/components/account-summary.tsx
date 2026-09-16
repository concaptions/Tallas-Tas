'use client';

import { useOrganization, useUser } from '@clerk/nextjs';

/**
 * Reads the signed-in user and the active organisation from Clerk's client session: no Backend API
 * call per page view, and the values follow the OrganizationSwitcher without a server round trip.
 */
export function AccountSummary() {
  const { isLoaded: userLoaded, user } = useUser();
  const { isLoaded: organizationLoaded, organization } = useOrganization();

  if (!userLoaded || !organizationLoaded) {
    return <p className="text-sm text-muted-foreground">Loading your account…</p>;
  }

  const userName = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'Unknown user';

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted-foreground">Signed in as</dt>
      <dd data-testid="user-name">{userName}</dd>
      <dt className="text-muted-foreground">Organisation</dt>
      <dd data-testid="organisation-name">{organization?.name ?? 'No organisation selected'}</dd>
    </dl>
  );
}
