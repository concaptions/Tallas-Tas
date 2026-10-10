'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  listMergedPages,
  listTeam,
  setBrandPageOrder,
  setBrandPageVisibility,
  softDeleteCustomPage,
  type Db,
} from '@tas/db';
import { canConfigureInterface, movePage } from '@tas/domain';
import { z } from 'zod';

import { resolveLiveAgencyId } from '@/lib/data-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { withInterfacePagesScope } from '@/lib/interface-config-pages-source';
import { interfaceConfigPath } from '@/lib/routes';
import { teamPageActorFrom } from '@/lib/team-actor';

/**
 * Server Actions for the Interface Config "Pages" section (Scope A, B4): every page of the brand —
 * standard tab, custom view, module page — shown or hidden, moved a step, or reset to the template.
 * Admin + CSM (Talal, answer 3: a CSM may toggle per brand; only an Admin may PUSH, which is
 * `custom-page-propagation-actions.ts`). Each action refuses in demo mode before anything is read,
 * resolves the actor's brand once through `withInterfacePagesScope`, and writes through the
 * `@tas/db` page writers; the move rule itself is `movePage` in `@tas/domain`. These replace the
 * three `interface_tab_visibility` actions: a tab is a page row since migration 0063.
 */

export interface PageActionSuccess {
  readonly ok: true;
  readonly savedAt: number;
}

export interface PageActionFailure {
  readonly ok: false;
  readonly error: string;
}

export type PageActionResult = PageActionSuccess | PageActionFailure;

const NOT_PERMITTED_REFUSAL =
  'Only an agency Admin or a Client Success Manager can change which pages the client interface shows.';

function failure(error: string): PageActionFailure {
  return { ok: false, error };
}

function success(): PageActionSuccess {
  return { ok: true, savedAt: Date.now() };
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

const slug = z.string().min(1).max(80);
const visibilitySchema = z.object({ slug, isVisible: z.boolean() });
const moveSchema = z.object({ slug, direction: z.enum(['up', 'down']) });
const resetSchema = z.object({ slug });

function entry(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

type Outcome = { readonly refusal: string | null };

async function run(
  actor: string,
  body: (db: Db, brandId: string) => Promise<string | null>,
  failed: string,
): Promise<PageActionResult> {
  try {
    const outcome = await withInterfacePagesScope<Outcome>(async (db, brandId) => {
      const refusal = await configRefusal(db, actor);
      if (refusal !== null) return { refusal };
      return { refusal: await body(db, brandId) };
    });
    if (outcome === null) return failure('This workspace has no brand yet.');
    if (outcome.refusal !== null) return failure(outcome.refusal);
    revalidatePath(interfaceConfigPath);
    return success();
  } catch {
    return failure(failed);
  }
}

/** Show or hide one page for the actor's brand. */
export async function setPageVisibilityAction(
  _previous: PageActionResult | null,
  formData: FormData,
): Promise<PageActionResult> {
  if (isDemoMode()) return failure(DEMO_WRITE_REFUSAL);
  const parsed = visibilitySchema.safeParse({
    slug: entry(formData, 'slug'),
    isVisible: entry(formData, 'isVisible') === 'true',
  });
  if (!parsed.success) return failure('Could not read the page change.');
  const actor = await actorId();
  if (actor === null) return failure('Your session has expired. Sign in again to save.');
  return run(
    actor,
    async (db, brandId) => {
      const page = (await listMergedPages(db, brandId)).find(
        (row) => row.slug === parsed.data.slug,
      );
      if (page === undefined) return 'That page is no longer available.';
      await setBrandPageVisibility(db, brandId, page, parsed.data.isVisible, actor);
      return null;
    },
    'The page visibility could not be saved. Try again.',
  );
}

/** Move one page a step up or down in the brand's order; every page is renumbered densely. */
export async function reorderPageAction(
  _previous: PageActionResult | null,
  formData: FormData,
): Promise<PageActionResult> {
  if (isDemoMode()) return failure(DEMO_WRITE_REFUSAL);
  const parsed = moveSchema.safeParse({
    slug: entry(formData, 'slug'),
    direction: entry(formData, 'direction'),
  });
  if (!parsed.success) return failure('Could not read the reorder request.');
  const actor = await actorId();
  if (actor === null) return failure('Your session has expired. Sign in again to save.');
  return run(
    actor,
    async (db, brandId) => {
      const pages = await listMergedPages(db, brandId);
      if (!pages.some((row) => row.slug === parsed.data.slug)) {
        return 'That page is no longer available.';
      }
      const order = movePage(pages, parsed.data.slug, parsed.data.direction);
      await setBrandPageOrder(db, brandId, pages, order, actor);
      return null;
    },
    'The page order could not be saved. Try again.',
  );
}

/** Drop the brand's own row for a template page, so the template's visibility and order apply again. */
export async function resetPageAction(
  _previous: PageActionResult | null,
  formData: FormData,
): Promise<PageActionResult> {
  if (isDemoMode()) return failure(DEMO_WRITE_REFUSAL);
  const parsed = resetSchema.safeParse({ slug: entry(formData, 'slug') });
  if (!parsed.success) return failure('Could not read the reset request.');
  const actor = await actorId();
  if (actor === null) return failure('Your session has expired. Sign in again to save.');
  return run(
    actor,
    async (db, brandId) => {
      const page = (await listMergedPages(db, brandId)).find(
        (row) => row.slug === parsed.data.slug,
      );
      if (page === undefined || page.brandId !== brandId || page.templateRowId === null) {
        return 'This page has no brand override to reset.';
      }
      await softDeleteCustomPage(db, page.id, brandId, actor);
      return null;
    },
    'The page could not be reset. Try again.',
  );
}
