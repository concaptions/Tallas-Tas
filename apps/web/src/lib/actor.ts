import { currentUser } from '@clerk/nextjs/server';

import { DEMO_ACTOR, isDemoMode, type DemoActor } from './demo-mode';

/** Two initials from a display name, or the first two characters of whatever there is. */
function initialsOf(name: string): string {
  const parts = name.split(/\s+/u).filter((part) => part.length > 0);
  const first = parts.at(0) ?? '';
  const last = parts.at(-1) ?? '';
  const letters = parts.length > 1 ? `${first.charAt(0)}${last.charAt(0)}` : first.slice(0, 2);
  return letters.toUpperCase();
}

/**
 * Who the shell says it is acting as. In DEMO MODE there is no identity provider, so no Clerk call
 * is made at all — `currentUser()` would throw without a `ClerkProvider` and middleware — and the
 * stub `DEMO_ACTOR` is returned instead.
 */
export async function currentActor(): Promise<DemoActor> {
  if (isDemoMode()) {
    return DEMO_ACTOR;
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const fullName = user?.fullName ?? (email === '' ? 'Signed-in user' : email);
  return { fullName, email, initials: initialsOf(fullName) || 'TAS' };
}
