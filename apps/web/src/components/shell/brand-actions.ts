'use server';

import { revalidatePath } from 'next/cache';

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
 * returns before touching a cookie or a connection. `revalidatePath` rebuilds the `/app` layout so
 * the top bar and every scoped read below it pick up the new brand on the same interaction.
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

  revalidatePath(appPath, 'layout');
}
