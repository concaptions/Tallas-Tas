'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { getActiveBrandRole, updateCreatorPerformanceRating } from '@tas/db';
import { parseRating, rateCreatorForBrand, type CreatorRatedEvent } from '@tas/domain/creators';
import { z } from 'zod';

import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { ugcPath } from '@/lib/routes';
import { withBrandScope } from '@/lib/ugc-source';

import type { CreatorActionFailure, CreatorActionResult } from './actions';
import { RATING_ADMIN_ONLY_NOTE, RATING_REQUIRED_HINT } from './fields';

const ratingSchema = z.object({
  id: z.string().trim().min(1),
  rating: z.string().trim(),
  note: z.string().optional(),
});

/**
 * Rates one creator for the working brand (Oct 8 Talal ask), in the shape `updateCreatorAction`
 * takes so the panel mounts it with `useActionState` too. The RULE lives in the domain:
 * `rateCreatorForBrand` refuses a rating off the 1–5 scale, a note past `RATING_NOTE_MAX` and a
 * missing actor, and its `RangeError` message is what the widget shows. The WRITE is the
 * brand-scoped `updateCreatorPerformanceRating`; the registry roll-up is the database trigger's.
 *
 * Only an agency admin may rate. The check is `getActiveBrandRole`, the SAME helper
 * `loadViewerRole` answers the page with — the page decides whether to show the form from it, and
 * the action decides whether to honour the form from it, so the two can never disagree. It answers
 * `admin` for an `admin` agency membership and never for a brand assignment alone.
 */
export async function rateCreatorAction(
  _previous: CreatorActionResult | null,
  formData: FormData,
): Promise<CreatorActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const parsed = ratingSchema.safeParse({
    id: formData.get('id'),
    rating: formData.get('rating'),
    note: formData.get('note') ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: RATING_REQUIRED_HINT };
  }

  const { userId } = await auth();
  if (userId === null) {
    return { ok: false, error: 'Your session has expired. Sign in again to save.' };
  }

  const event = ratedEvent(parsed.data, userId);
  if ('ok' in event) {
    return event;
  }

  try {
    const result = await withBrandScope(async (db, brandId): Promise<CreatorActionResult> => {
      const role = await getActiveBrandRole(db, brandId, userId);
      if (role !== 'admin') {
        return { ok: false, error: RATING_ADMIN_ONLY_NOTE };
      }
      const row = await updateCreatorPerformanceRating(
        db,
        brandId,
        event.creatorId,
        event.rating,
        event.note,
        event.actorUserId,
        event.ratedAt,
      );
      if (row === null) {
        return { ok: false, error: 'That creator is no longer available.' };
      }
      return { ok: true, id: row.id, savedAt: Date.now() };
    });
    if (result === null) {
      return { ok: false, error: 'No brand is selected for this workspace.' };
    }
    if (result.ok) revalidatePath(ugcPath);
    return result;
  } catch {
    return { ok: false, error: 'The rating could not be saved. Try again.' };
  }
}

/** The domain's verdict on the submitted fields: the event to write, or the `RangeError` as a failure. */
function ratedEvent(
  fields: z.infer<typeof ratingSchema>,
  userId: string,
): CreatorRatedEvent | CreatorActionFailure {
  try {
    return rateCreatorForBrand(
      fields.id,
      parseRating(fields.rating) ?? Number.NaN,
      fields.note,
      userId,
    );
  } catch (error: unknown) {
    if (error instanceof RangeError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
