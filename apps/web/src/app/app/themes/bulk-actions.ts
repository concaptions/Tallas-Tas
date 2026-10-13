'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { updateTheme } from '@tas/db';
import { z } from 'zod';

import type { BulkFailure } from '@/components/views';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { themesPath } from '@/lib/routes';
import { withGlobalScope } from '@/lib/themes-source';

/**
 * The Themes grid's one bulk write (Ticket 8, PRD §5.5): Archive (n) on the Active tab, Restore (n)
 * on the Archived tab, both through this action. Shaped exactly like the Creative Sheet's
 * `review-actions.ts`: refuse in DEMO MODE before anything else, zod over the id list and the flag,
 * the session, then the write — the same `withGlobalScope` + `updateTheme` toggle the panel's
 * Archive button makes (`toggleThemeActiveAction`), run per id so a bulk flip is exactly as strict
 * as a single one. It never throws to the client.
 *
 * NO DELETE AND NO BRAND, ON PURPOSE. Themes are the GLOBAL library (CLAUDE.md non-negotiable 3):
 * a soft delete here would remove the theme from every brand's library at once, so the lead's
 * Ticket 8 ruling withholds Delete entirely — archiving is the bulk off-switch, and it is
 * reversible from the Archived tab. And because the table carries no `brand_id`, there is no
 * `withBrandScope` and no `insertActivity` (the activity log is per-brand); the honest `changed`
 * list in the result is the record of what moved.
 */

const SESSION_EXPIRED = 'Your session has expired. Sign in again to save.';
const NOTHING_SELECTED = 'Select at least one theme first.';
const INVALID_REQUEST = 'Invalid request.';

const idList = z.array(z.string().trim().min(1)).min(1);

/** The target state: `true` restores, `false` archives. A tampered non-boolean is refused. */
const activeFlag = z.boolean();

export interface ThemesBulkSuccess {
  readonly ok: true;
  /** The rows the toggle actually flipped; an unknown or soft-deleted id is simply absent. */
  readonly changed: readonly string[];
  /** The bar's outcome line, e.g. "2 themes archived." */
  readonly notice: string;
}

export type ThemesBulkResult = ThemesBulkSuccess | BulkFailure;

/**
 * Archive (`isActive: false`) or Restore (`isActive: true`) the selected themes in the global
 * library — for every brand at once, which is what the GLOBAL badge on the page means. An id that
 * resolves nothing (soft-deleted since the page loaded, or made up) flips nothing and is left out
 * of `changed`; the notice counts only the rows that actually moved.
 */
export async function archiveThemesAction(
  ids: readonly string[],
  isActive: boolean,
): Promise<ThemesBulkResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };
  const parsedIds = idList.safeParse(ids);
  if (!parsedIds.success) return { ok: false, error: NOTHING_SELECTED };
  const parsedFlag = activeFlag.safeParse(isActive);
  if (!parsedFlag.success) return { ok: false, error: INVALID_REQUEST };
  try {
    const { userId } = await auth();
    if (userId === null) return { ok: false, error: SESSION_EXPIRED };
    const changed = await withGlobalScope(async (db) => {
      const flipped: string[] = [];
      for (const id of parsedIds.data) {
        const row = await updateTheme(db, id, { isActive: parsedFlag.data }, userId);
        if (row !== null) flipped.push(row.id);
      }
      return flipped;
    });
    revalidatePath(themesPath);
    const count = changed.length;
    const notice = `${String(count)} ${count === 1 ? 'theme' : 'themes'} ${parsedFlag.data ? 'restored' : 'archived'}.`;
    return { ok: true, changed, notice };
  } catch {
    return { ok: false, error: 'The themes could not be saved. Try again.' };
  }
}
