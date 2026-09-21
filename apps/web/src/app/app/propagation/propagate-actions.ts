'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  listTeam,
  propagateAllContent,
  propagateInterfaceConfig,
  resolveTemplateBrandId,
  type ContentPropagationResult,
  type PropagationResult,
} from '@tas/db';
import { canReviewPromotion } from '@tas/domain';

import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { withAgencyScope } from '@/lib/propagation-source';
import { propagationPath } from '@/lib/routes';
import { teamPageActorFrom } from '@/lib/team-actor';

export interface PropagateActionSuccess {
  readonly ok: true;
  readonly content: ContentPropagationResult;
  readonly interface: PropagationResult;
  readonly propagatedAt: number;
}

export interface PropagateActionFailure {
  readonly ok: false;
  readonly error: string;
}

export type PropagateActionResult = PropagateActionSuccess | PropagateActionFailure;

export async function propagateAllAction(
  _previous: PropagateActionResult | null, // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<PropagateActionResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };

  try {
    const { userId } = await auth();
    if (userId === null) {
      return { ok: false, error: 'Your session has expired. Sign in again.' };
    }

    const result = await withAgencyScope(async (db, agencyId) => {
      const team = await listTeam(db, agencyId);
      const actor = teamPageActorFrom(team.find((row) => row.clerkUserId === userId));
      if (!canReviewPromotion(actor)) {
        return { ok: false as const, error: 'Only an agency Admin can propagate changes.' };
      }

      const templateBrandId = await resolveTemplateBrandId(db, agencyId);
      if (templateBrandId === null) {
        return { ok: false as const, error: 'No template brand found for this agency.' };
      }

      const contentResult = await propagateAllContent(db, templateBrandId, userId);
      const interfaceResult = await propagateInterfaceConfig(db, templateBrandId, userId);

      revalidatePath(propagationPath);
      return {
        ok: true as const,
        content: contentResult,
        interface: interfaceResult,
        propagatedAt: Date.now(),
      };
    });

    return result ?? { ok: false, error: 'This workspace has no agency yet.' };
  } catch {
    return { ok: false, error: 'Propagation failed. Try again.' };
  }
}
