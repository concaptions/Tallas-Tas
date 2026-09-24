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
 * On a real switch it `revalidatePath`s the `/app` layout AND `redirect`s to `/app`. The redirect is
 * what makes the switch actually land: a form-action `revalidatePath` alone leaves the client
 * router free to serve the current segment from its cache, so the page could keep showing the old
 * brand until the next navigation. A server redirect forces a fresh server render of `/app`, which
 * re-reads the cookie through `loadBrandScope`/`resolveLiveBrand` and resolves the new brand. It
 * also lands the switcher on the new brand's Overview, which is where a media buyer expects to be
 * after changing workspace. `redirect` throws `NEXT_REDIRECT`, so it is called AFTER the `finally`
 * that closes the pool — never inside the `try`, where the `finally` is fine but a `catch` would
 * swallow it — and only on the success path, so a rejected switch does not navigate.
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
