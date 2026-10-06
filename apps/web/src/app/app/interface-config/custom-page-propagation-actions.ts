'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  listLivePropagationTargets,
  listTeam,
  propagateCustomInterfacePageToChildren,
  resolveTemplateBrandFromAny,
  type Db,
} from '@tas/db';
import { canConfigureInterface } from '@tas/domain';
import { z } from 'zod';

import { resolveLiveAgencyId } from '@/lib/data-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { withInterfacePagesScope } from '@/lib/interface-config-pages-source';
import { interfaceConfigPath } from '@/lib/routes';
import { propagationPath } from '@/lib/routes';
import { teamPageActorFrom } from '@/lib/team-actor';

/**
 * "Push to all clients" — the propagation submit for a template-scoped custom interface page. The
 * admin UI calls this when the operator wants a template page to appear in every child brand's
 * portal.
 *
 * V0 shortcut: this action BYPASSES the promotion-request table (which is designed to carry a
 * child-raised request an Admin reviews) and instead calls `propagateCustomInterfacePageToChildren`
 * directly, because the propagation flow for interface pages is template → child, not child →
 * template. The gated review surface for interface-page propagations is a V1 follow-up tracked in
 * the overnight report. Access is still gated by `canConfigureInterface` here, which admits only
 * Admin + CSM.
 */

export interface CustomPagePromotionActionSuccess {
  readonly ok: true;
  readonly childrenUpdated: number;
  readonly savedAt: number;
}

export interface CustomPagePromotionActionFailure {
  readonly ok: false;
  readonly error: string;
}

export type CustomPagePromotionActionResult =
  CustomPagePromotionActionSuccess | CustomPagePromotionActionFailure;

const NOT_PERMITTED_REFUSAL =
  'Only an agency Admin or a Client Success Manager can push a page to every client.';

function failure(error: string): CustomPagePromotionActionFailure {
  return { ok: false, error };
}

function success(childrenUpdated: number): CustomPagePromotionActionSuccess {
  return { ok: true, childrenUpdated, savedAt: Date.now() };
}

async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

async function configRefusal(db: Db, clerkUserId: string): Promise<string | null> {
  const agencyId = await resolveLiveAgencyId(db);
  if (agencyId === null) return 'This workspace has no agency yet.';
  const team = await listTeam(db, agencyId);
  const actor = teamPageActorFrom(team.find((row) => row.clerkUserId === clerkUserId));
  return canConfigureInterface(actor) ? null : NOT_PERMITTED_REFUSAL;
}

const requestSchema = z.object({ id: z.uuid() });

function entry(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

export async function requestCustomPagePromotionAction(
  _previous: CustomPagePromotionActionResult | null,
  formData: FormData,
): Promise<CustomPagePromotionActionResult> {
  if (isDemoMode()) return failure(DEMO_WRITE_REFUSAL);
  const parsed = requestSchema.safeParse({ id: entry(formData, 'id') });
  if (!parsed.success) return failure('Could not read the request.');
  try {
    const actor = await actorId();
    if (actor === null) return failure('Your session has expired. Sign in again to save.');
    const outcome = await withInterfacePagesScope(async (db, brandId) => {
      const refusal = await configRefusal(db, actor);
      if (refusal !== null) return { refusal, childrenUpdated: 0 };
      // The push targets the TEMPLATE page (brand_id IS NULL). Resolve the template brand of the
      // actor's agency via their currently selected brand, then list the live child brands under
      // it — a child brand with `is_inherited = false` on this slug is kept untouched by the
      // propagation helper, so a customised child is honoured.
      const templateBrandId = await resolveTemplateBrandFromAny(db, brandId);
      if (templateBrandId === null) {
        return { refusal: 'No template brand for this agency.', childrenUpdated: 0 };
      }
      const children = await listLivePropagationTargets(db, templateBrandId);
      const result = await propagateCustomInterfacePageToChildren(
        db,
        parsed.data.id,
        children.map((c) => c.id),
        actor,
      );
      if (!result.applied) {
        return { refusal: result.reason ?? 'This page could not be pushed.', childrenUpdated: 0 };
      }
      return { refusal: null, childrenUpdated: result.childrenUpdated };
    });
    if (outcome === null) return failure('This workspace has no brand yet.');
    if (outcome.refusal !== null) return failure(outcome.refusal);
    revalidatePath(interfaceConfigPath);
    revalidatePath(propagationPath);
    return success(outcome.childrenUpdated);
  } catch {
    return failure('The push to clients could not run. Try again.');
  }
}
