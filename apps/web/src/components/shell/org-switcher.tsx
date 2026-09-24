'use client';

import {
  OrganizationList,
  OrganizationSwitcher,
  useAuth,
  useOrganizationList,
} from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { appPath } from '@/lib/routes';

/**
 * Selects the person's organization when there is exactly one and none is active.
 *
 * `ensureOrganization()` CREATES an organization for a user who has none, but it cannot SELECT one:
 * the active organization lives in the session, and Clerk only moves it from the client through
 * `setActive`. A user who already belonged to an organization — invited, or created in the Clerk
 * dashboard — therefore arrived with no active organization and stayed that way, because
 * `ensureOrganization` returns early as soon as it sees a membership. That is the state in which
 * `createBrandAction` refuses and every agency-scoped read falls through to `soleAgencyId`.
 *
 * Only the unambiguous case is automatic. With two or more memberships there is no honest choice to
 * make on the person's behalf — the same refusal to guess that makes `actorAgencyId` throw
 * `AmbiguousBrandError` rather than take the first row — so a picker is rendered instead.
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
    // person's own choice. Client-side `useAuth` reports `null` for "none active"; the server's
    // `auth()` reports `undefined` for the same state.
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
    // server component on screen was already rendered with no organization, so without a refresh
    // the page keeps that render until the next navigation — which is the very state this resolves.
    void (async () => {
      await setActive({ organization: only.organization.id });
      router.refresh();
    })();
  }, [authLoaded, isLoaded, setActive, orgId, memberships, router]);
}

/**
 * The shell's organization control, for the top bar.
 *
 * `hidePersonal` is deliberately NOT passed. Its documented behaviour is the inverse of its name
 * (`@clerk/shared`: "@default true … Setting this to `false` will hide the personal account entry"),
 * and passing it suppressed the personal entry — which left the trigger with nothing at all to draw
 * for a user who has no active organization, so the control rendered blank. Showing the personal
 * entry is the lesser problem by far: it is the affordance the person clicks to reach the list and
 * pick or create a real organization. Scope safety does not depend on this widget — it is enforced
 * in the data layer by `resolveLiveAgencyId` / `withBrand`, which read the session, not the menu.
 */
export function OrgSwitcher() {
  useAutoSelectSoleOrganization();

  return (
    <div data-slot="org-switcher" className="flex shrink-0 items-center">
      <OrganizationSwitcher
        afterCreateOrganizationUrl={appPath}
        afterSelectOrganizationUrl={appPath}
        appearance={{ elements: { rootBox: 'flex items-center' } }}
      />
    </div>
  );
}

/**
 * The full picker, for a page that cannot proceed until an organization is active.
 *
 * `OrganizationList` rather than `OrganizationSwitcher`: a switcher is built to switch BETWEEN
 * organizations and draws itself from the active one, so it is the wrong control precisely when
 * there is none. The list renders memberships, pending invitations, suggestions and a create form,
 * which is the whole set of ways out of this state.
 *
 * The zero-membership line matters more than it looks. If the organization exists in the Clerk
 * dashboard but this account was never added to it, NO widget can select it — the membership has to
 * be granted in Clerk first — and without saying so the person reads an empty list as a broken page.
 */
export function OrgPicker() {
  useAutoSelectSoleOrganization();

  const { isLoaded, userMemberships } = useOrganizationList({ userMemberships: true });
  const memberships = userMemberships.data;
  const hasNone = isLoaded && memberships !== undefined && memberships.length === 0;

  return (
    <div data-slot="org-picker" className="flex flex-col gap-3">
      {hasNone ? (
        <p className="text-xs text-text3">
          This account is not a member of any organization yet. Create one below — or, if the
          organization already exists in Clerk, add this account to it there first, then reload.
        </p>
      ) : null}
      <OrganizationList afterCreateOrganizationUrl={appPath} afterSelectOrganizationUrl={appPath} />
    </div>
  );
}
