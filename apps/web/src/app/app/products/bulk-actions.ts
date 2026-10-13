'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { insertActivity, softDeleteProducts, type Db } from '@tas/db';
import { z } from 'zod';

import type { BulkDeleteResult } from '@/components/views';
import { currentActor } from '@/lib/actor';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { withBrandScope } from '@/lib/products-source';
import { productsPath } from '@/lib/routes';

/**
 * The Products grid's one bulk write (Ticket 8): Delete over a selection. The checklist every bulk
 * action on every page re-runs server-side, in order — a disabled button is a hint, not an
 * authorisation boundary:
 *
 * 1. DEMO MODE refuses first, before any validation, actor lookup or connection;
 * 2. the id list is validated with zod — empty means nothing happens;
 * 3. the session is checked, and the actor's brand is resolved by `withBrandScope`, so the soft
 *    delete in `@tas/db` only ever marks rows of the actor's own brand (another brand's id simply
 *    never resolves, and is absent from `deleted`);
 * 4. the delete is SOFT (`deleted_at`), never `DELETE FROM`, and each marked row is logged under
 *    the `product` entity, the way the Creative Sheet logs its deletes;
 * 5. the page is revalidated and a typed result returned. Nothing throws to the client.
 *
 * Briefs (`creative_briefs.product_id`) and copywriting (`copywriting.product_id`) linked to a
 * deleted product are deliberately untouched: they keep their reference to the hidden row, which no
 * longer resolves to a name (the delete confirm says so).
 */

const SESSION_EXPIRED = 'Your session has expired. Sign in again to save.';
const NO_BRAND = 'This workspace has no brand yet.';
const NOTHING_SELECTED = 'Select at least one product first.';

/** The activity log's entity name for a product row (Ticket 8 ruling 6). */
const PRODUCT_ENTITY = 'product';

const idList = z.array(z.string().trim().min(1)).min(1);

/** Delete over the selection: a SOFT delete of the brand's live rows, never `DELETE FROM`. */
export async function deleteProductsAction(ids: readonly string[]): Promise<BulkDeleteResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };
  const parsed = idList.safeParse(ids);
  if (!parsed.success) return { ok: false, error: NOTHING_SELECTED };
  try {
    const { userId } = await auth();
    if (userId === null) return { ok: false, error: SESSION_EXPIRED };
    const { fullName } = await currentActor();
    const actor = { id: userId, name: fullName };
    const outcome = await withBrandScope(async (db: Db, brandId: string) => {
      const deleted = await softDeleteProducts(db, brandId, parsed.data, actor.id);
      for (const id of deleted) {
        await insertActivity(
          db,
          brandId,
          PRODUCT_ENTITY,
          id,
          [{ field: 'deletedAt', oldValue: null, newValue: new Date().toISOString() }],
          actor,
        );
      }
      return { ok: true as const, deleted };
    });
    if (outcome === null) return { ok: false, error: NO_BRAND };
    revalidatePath(productsPath);
    return outcome;
  } catch {
    return { ok: false, error: 'The products could not be deleted. Try again.' };
  }
}
