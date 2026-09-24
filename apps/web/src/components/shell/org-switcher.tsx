'use client';

import { OrganizationSwitcher, useAuth, useOrganizationList } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { appPath } from '@/lib/routes';

/**
 * Selects the person's organization when there is exactly one and none is active.
 *
 * `ensureOrganization()` CREATES an organization for a user who has none, but it cannot SELECT one:
 * the active organization lives in the session, and Clerk only moves it from the client through
 * `setActive`. A user who already belonged to an organization — invited, or provisioned in the
 * Clerk dashboard — therefore arrived with `orgId: undefined` and stayed there forever, because
 * `ensureOrganization` returns early as soon as it sees a membership. That is the state in which
 * every agency-scoped read falls through to `soleAgencyId` and creating a brand refuses outright.
 *
 * Only the unambiguous case is automatic. With two or more memberships there is no honest choice to
 * make on the person's behalf — the same reason `actorAgencyId` throws `AmbiguousBrandError` rather
 * than taking the first row — so the switcher below is the answer instead.
 */
function useAutoSelectSoleOrganization(): void {
  const router = useRouter();
  const { isLoaded: authLoaded, orgId } = useAuth();
  const { isLoaded, setActive, userMemberships } = useOrganizationList({ userMemberships: true });
  const memberships = userMemberships.data;

  useEffect(() => {
    if (!authLoaded || !isLoaded) {
      return;
    }
    // A session that already carries an organization is left alone: re-selecting would fight the
    // person's own choice in the switcher. Client-side `useAuth` reports `null`, not `undefined`,
    // for "no active organization" — the server's `auth()` is the one that reports `undefined`.
    if (orgId !== null) {
      return;
    }
    if (memberships === undefined || memberships.length !== 1) {
      return;
    }
    const only = memberships[0];
    if (only === undefined) {
      return;
    }
    // `router.refresh()` is not optional. `setActive` updates the session on the CLIENT; every
    // server component on screen was already rendered with no `orgId`, so without a refresh the
    // page keeps showing the organization-less render until the next navigation — which is exactly
    // the "there is no active organization" state this hook just resolved.
    void (async () => {
      await setActive({ organization: only.organization.id });
      router.refresh();
    })();
  }, [authLoaded, isLoaded, setActive, orgId, memberships, router]);
}

/**
 * The organization picker. Clerk-only: it reads a `ClerkProvider`, which the root layout does not
 * render in demo mode, so every caller gates on `demo` before mounting it.
 *
 * `hidePersonal` is deliberate. This product is organization-tenanted end to end — an agency IS a
 * Clerk organization (D-003) — so a personal account is a scope in which nothing can be read or
 * written, and offering it as a choice is offering a broken state.
 */
export function OrgSwitcher() {
  useAutoSelectSoleOrganization();

  return (
    <div data-slot="org-switcher" className="flex shrink-0 items-center">
      <OrganizationSwitcher
        hidePersonal
        afterCreateOrganizationUrl={appPath}
        afterSelectOrganizationUrl={appPath}
        appearance={{
          elements: {
            rootBox: 'flex items-center',
            organizationSwitcherTrigger:
              'rounded-input border border-line bg-surface2 px-2 py-1 text-text2 hover:text-text',
          },
        }}
      />
    </div>
  );
}
