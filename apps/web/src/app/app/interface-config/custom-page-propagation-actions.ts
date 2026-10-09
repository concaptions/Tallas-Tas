'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  createPromotionRequest,
  listTeam,
  listTemplateCustomPages,
  resolveTemplateBrandFromAny,
  type Db,
} from '@tas/db';
import { canReviewPromotion, PAGE_PUSH_FIELD, PAGE_PUSH_TABLE } from '@tas/domain';
import { z } from 'zod';

import { resolveLiveAgencyId } from '@/lib/data-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { withInterfacePagesScope } from '@/lib/interface-config-pages-source';
import { interfaceConfigPath, propagationPath } from '@/lib/routes';
import { teamPageActorFrom } from '@/lib/team-actor';

/**
 * "Push to all clients" — opens a REVIEW REQUEST for a template-scoped custom interface page
 * (B3, 2026-10-10). Until now this action propagated directly, skipping the review PRD §5 puts in
 * front of every template → child change; it now writes a `promotion_requests` row
 * (`table_name = custom_interface_pages`, `row_id` = the template page, `field_name = push`,
 * the page's slug and title as the proposed value) and an agency Admin approves it on
 * `/app/propagation`, where `applyApprovedPromotion` runs the one page propagation under a
 * `propagation_runs` row. Admin only (Talal, design question 3): a CSM may toggle a page per brand
 * but may not push one.
 */

export interface CustomPagePromotionActionSuccess {
  readonly ok: true;
  readonly requestId: string;
  readonly savedAt: number;
}

export interface CustomPagePromotionActionFailure {
  readonly ok: false;
  readonly error: string;
}

export type CustomPagePromotionActionResult =
  CustomPagePromotionActionSuccess | CustomPagePromotionActionFailure;

const NOT_PERMITTED_REFUSAL = 'Only an agency Admin can push a page to every client.';

function failure(error: string): CustomPagePromotionActionFailure {
  return { ok: false, error };
}

async function pushRefusal(db: Db, clerkUserId: string): Promise<string | null> {
  const agencyId = await resolveLiveAgencyId(db);
  if (agencyId === null) return 'This workspace has no agency yet.';
  const team = await listTeam(db, agencyId);
  const actor = teamPageActorFrom(team.find((row) => row.clerkUserId === clerkUserId));
  return canReviewPromotion(actor) ? null : NOT_PERMITTED_REFUSAL;
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
    const { userId } = await auth();
    if (userId === null) return failure('Your session has expired. Sign in again to save.');
    const outcome = await withInterfacePagesScope(async (db, brandId) => {
      const refusal = await pushRefusal(db, userId);
      if (refusal !== null) return { refusal, requestId: null };
      const templateBrandId = await resolveTemplateBrandFromAny(db, brandId);
      if (templateBrandId === null) {
        return { refusal: 'No template brand for this agency.', requestId: null };
      }
      const page = (await listTemplateCustomPages(db)).find((row) => row.id === parsed.data.id);
      if (page === undefined) {
        return { refusal: 'That template page is no longer available.', requestId: null };
      }
      const request = await createPromotionRequest(
        db,
        {
          brandId: templateBrandId,
          tableName: PAGE_PUSH_TABLE,
          rowId: page.id,
          fieldName: PAGE_PUSH_FIELD,
          currentValue: 'template',
          proposedValue: JSON.stringify({ slug: page.slug, title: page.title }),
          requestedBy: userId,
        },
        userId,
      );
      return { refusal: null, requestId: request.id };
    });
    if (outcome === null) return failure('This workspace has no brand yet.');
    if (outcome.refusal !== null) return failure(outcome.refusal);
    revalidatePath(interfaceConfigPath);
    revalidatePath(propagationPath);
    return { ok: true, requestId: outcome.requestId, savedAt: Date.now() };
  } catch {
    return failure('The push request could not be opened. Try again.');
  }
}
