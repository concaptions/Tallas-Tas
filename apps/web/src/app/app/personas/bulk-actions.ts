'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { insertActivity, softDeletePersonas, type Db } from '@tas/db';
import { z } from 'zod';

import type { BulkDeleteResult } from '@/components/views';
import { currentActor } from '@/lib/actor';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { withBrandScope } from '@/lib/personas-source';
import { personasPath } from '@/lib/routes';

/**
 * The Personas grid's one bulk write (Ticket 8): Delete over a selection. The checklist every bulk
 * action on every page re-runs server-side, in order — a disabled button is a hint, not an
 * authorisation boundary:
 *
 * 1. DEMO MODE refuses first, before any validation, actor lookup or connection;
 * 2. the id list is validated with zod — empty means nothing happens;
 * 3. the session is checked, and the actor's brand is resolved by `withBrandScope`, so the soft
 *    delete in `@tas/db` only ever marks rows of the actor's own brand (another brand's id simply
 *    never resolves, and is absent from `deleted`);
 * 4. the delete is SOFT (`deleted_at`), never `DELETE FROM`, and each marked row is logged under
 *    the `persona` entity, the way the Creative Sheet logs its deletes;
 * 5. the page is revalidated and a typed result returned. Nothing throws to the client.
 *
 * Angles linked through `angle_personas` are deliberately untouched: they keep their reference to
 * the hidden row, which no longer resolves to a name (the delete confirm says so).
 */

const SESSION_EXPIRED = 'Your session has expired. Sign in again to save.';
const NO_BRAND = 'This workspace has no brand yet.';
const NOTHING_SELECTED = 'Select at least one persona first.';

/** The activity log's entity name for a persona row (Ticket 8 ruling 6). */
const PERSONA_ENTITY = 'persona';

const idList = z.array(z.string().trim().min(1)).min(1);

/** Delete over the selection: a SOFT delete of the brand's live rows, never `DELETE FROM`. */
export async function deletePersonasAction(ids: readonly string[]): Promise<BulkDeleteResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };
  const parsed = idList.safeParse(ids);
  if (!parsed.success) return { ok: false, error: NOTHING_SELECTED };
  try {
    const { userId } = await auth();
    if (userId === null) return { ok: false, error: SESSION_EXPIRED };
    const { fullName } = await currentActor();
    const actor = { id: userId, name: fullName };
    const outcome = await withBrandScope(async (db: Db, brandId: string) => {
      const deleted = await softDeletePersonas(db, brandId, parsed.data, actor.id);
      for (const id of deleted) {
        await insertActivity(
          db,
          brandId,
          PERSONA_ENTITY,
          id,
          [{ field: 'deletedAt', oldValue: null, newValue: new Date().toISOString() }],
          actor,
        );
      }
      return { ok: true as const, deleted };
    });
    if (outcome === null) return { ok: false, error: NO_BRAND };
    revalidatePath(personasPath);
    return outcome;
  } catch {
    return { ok: false, error: 'The personas could not be deleted. Try again.' };
  }
}
