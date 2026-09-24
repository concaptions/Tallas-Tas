'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createAutoDb } from '@tas/db';
import { serverEnv } from '@tas/env';

import { writeActiveBrandId } from '@/lib/active-brand';
import { isBrandSelectable } from '@/lib/data-source';
import { isDemoMode } from '@/lib/demo-mode';
import { appPath } from '@/lib/routes';

/**
 * Switches the working brand to `brandId` — the switcher's one mutation.
 *
 * The brand id comes from the client, so it is proven before it is trusted: `isBrandSelectable`
 * resolves the actor's agency from the SESSION and checks the id is one of that agency's live
 * brands. An id for another agency's brand, a template, a deleted brand, or a value the caller made
 * up is silently ignored — the cookie is not written and the workspace stays where it was. This is
 * the write half of the same gate `resolveLiveBrand` applies on read, so the two cannot disagree.
 *
 * Demo mode has no session and one brand, so there is nothing to switch and nothing to persist; it
 * returns before touching a cookie or a connection.
 *
 * On a real switch it `revalidatePath`s the `/app` layout AND `redirect`s to `/app`: the redirect
 * forces a fresh server render of `/app`, which re-reads the cookie through
 * `loadBrandScope`/`resolveLiveBrand`, and lands the user on the new brand's Overview — a page from
 * another brand would otherwise stay on screen showing ids that no longer belong to the workspace.
 * Invoked from the switcher's `onSelect` inside `startTransition`, this path was verified end to end
 * against a production Next build: the layout and page re-render on the new brand, repeatedly,
 * without a reload. (The original switching bug was NOT here — the action was never reached,
 * because a `<form>` inside a Radix menu item is unmounted before it can submit; see
 * `brand-switcher.tsx`.) `redirect` throws `NEXT_REDIRECT`, so it is called AFTER the `finally`
 * that closes the pool — never inside the `try`, where a `catch` would swallow it — and only on the
 * success path, so a rejected switch does not navigate.
 */
export async function selectBrandAction(brandId: string): Promise<void> {
  if (isDemoMode()) {
    return;
  }
  const databaseUrl = serverEnv().DATABASE_URL;
  if (databaseUrl === undefined) {
    return;
  }

  const db = createAutoDb(databaseUrl);
  try {
    if (!(await isBrandSelectable(db, brandId))) {
      return;
    }
    await writeActiveBrandId(brandId);
  } finally {
    await db.$client.end();
  }

  // Reached only when the brand was selectable and the cookie was written: the guard above returns
  // early otherwise, and the `finally` still closes the pool on that path. So the switch succeeded,
  // and the redirect is unconditional here.
  revalidatePath(appPath, 'layout');
  redirect(appPath);
}
