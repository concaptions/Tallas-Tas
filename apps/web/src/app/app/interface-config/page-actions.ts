'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { auth } from '@clerk/nextjs/server';
import {
  brandTabColumns,
  insertActivity,
  isClientVisibleColumn,
  listMergedPages,
  listTeam,
  reattachBrandTabColumns,
  setBrandPageOrder,
  setBrandPageOverrides,
  setBrandPageVisibility,
  setBrandTabColumns,
  softDeleteCustomPage,
  type Db,
} from '@tas/db';
import {
  STANDARD_PAGE_SOURCE_TABLE,
  canConfigureInterface,
  isStandardPageSlug,
  movePage,
} from '@tas/domain';
import { z } from 'zod';

import { resolveLiveAgencyId } from '@/lib/data-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { withInterfacePagesScope } from '@/lib/interface-config-pages-source';
import { interfaceConfigPath } from '@/lib/routes';
import { teamPageActorFrom } from '@/lib/team-actor';

import {
  editPageSchema,
  filterValid,
  firstInternalColumn,
  readJsonEntry,
  tabColumnWrites,
} from './page-schema';

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

/**
 * A trace of the action in Postgres (SMOKE-29, open): the save sometimes answered a 503 from
 * Vercel's layer while the write persisted, and nothing here could see it. One `activity_log` row at
 * START and one at OK or FAILED, carrying the request's `x-vercel-id`, keyed on the brand under
 * `interface_config` (no record page lists that entity), so the next 503 can be read against
 * whether the function finished. Best effort: a trace that cannot be written never fails the save.
 */
async function trace(
  db: Db,
  brandId: string,
  actor: string,
  label: string,
  requestId: string,
  stage: 'start' | 'ok' | `failed: ${string}`,
): Promise<void> {
  try {
    await insertActivity(
      db,
      brandId,
      'interface_config',
      brandId,
      [{ field: label, oldValue: requestId, newValue: stage }],
      { id: actor, name: null },
    );
  } catch {
    // The trace is diagnostic only.
  }
}

async function requestId(): Promise<string> {
  try {
    return (await headers()).get('x-vercel-id') ?? 'no-x-vercel-id';
  } catch {
    return 'no-request';
  }
}

async function run(
  actor: string,
  body: (db: Db, brandId: string) => Promise<string | null>,
  failed: string,
  /** When given, the action is traced to Postgres under this label (see `trace`). */
  label?: string,
): Promise<PageActionResult> {
  try {
    const outcome = await withInterfacePagesScope<Outcome>(async (db, brandId) => {
      const refusal = await configRefusal(db, actor);
      if (refusal !== null) return { refusal };
      if (label === undefined) return { refusal: await body(db, brandId) };
      const id = await requestId();
      await trace(db, brandId, actor, label, id, 'start');
      try {
        const result = { refusal: await body(db, brandId) };
        await trace(
          db,
          brandId,
          actor,
          label,
          id,
          result.refusal === null ? 'ok' : `failed: ${result.refusal}`,
        );
        return result;
      } catch (error) {
        await trace(
          db,
          brandId,
          actor,
          label,
          id,
          `failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
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
    `page_visibility:${parsed.data.slug}`,
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
      // A standard tab's columns are the brand's column definitions (Part A2): Reset reattaches
      // the tab's client-visible columns to the template too, through Column Admin's own path.
      if (page.pageKind === 'standard' && isStandardPageSlug(page.slug)) {
        await reattachBrandTabColumns(db, brandId, STANDARD_PAGE_SOURCE_TABLE[page.slug], actor);
      }
      return null;
    },
    'The page could not be reset. Try again.',
  );
}

/**
 * The Edit dialog's save (2026-10-12): title, visibility and — for a custom or module page — the
 * filter and the column picks, for THIS brand only. A standard tab or a template page gets the
 * brand's override row (the template never changes; Reset restores it); the brand's own custom
 * page is updated in place. Same admin/CSM rule and brand scope as every action here: the tenant
 * is the scope's, never the form's. The schema is the one "Add custom page" uses (`page-schema`).
 */
export async function editPageAction(
  _previous: PageActionResult | null,
  formData: FormData,
): Promise<PageActionResult> {
  if (isDemoMode()) return failure(DEMO_WRITE_REFUSAL);
  const raw: Record<string, unknown> = {
    slug: entry(formData, 'slug'),
    title: entry(formData, 'title'),
    isVisible: entry(formData, 'isVisible') === 'true',
  };
  const filterConfig = readJsonEntry(formData, 'filterConfig');
  const columnConfig = readJsonEntry(formData, 'columnConfig');
  if (filterConfig !== undefined) raw.filterConfig = filterConfig;
  if (columnConfig !== undefined) raw.columnConfig = columnConfig;
  const parsed = editPageSchema.safeParse(raw);
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? 'Could not read the page edit.');
  }
  if (parsed.data.filterConfig !== undefined && !filterValid(parsed.data.filterConfig)) {
    return failure('A filter with the chosen operator needs a value.');
  }
  const actor = await actorId();
  if (actor === null) return failure('Your session has expired. Sign in again to save.');
  return run(
    actor,
    async (db, brandId) => {
      const page = (await listMergedPages(db, brandId)).find(
        (row) => row.slug === parsed.data.slug,
      );
      if (page === undefined) return 'That page is no longer available.';
      const internal = firstInternalColumn(parsed.data.columnConfig, (key) =>
        isClientVisibleColumn(page.sourceTableKey, key),
      );
      if (internal !== null) {
        return `“${internal}” is an internal column and cannot be shown to a client.`;
      }
      if (page.pageKind === 'standard' && isStandardPageSlug(page.slug)) {
        // A standard tab (Part A2): the picks are the brand's column definition rows — label,
        // order, hidden — written through the writer Column Admin uses; the page row keeps only
        // the title and visibility, so `column_config` stays the template's '[]'.
        if (parsed.data.columnConfig !== undefined) {
          const tableKey = STANDARD_PAGE_SOURCE_TABLE[page.slug];
          await setBrandTabColumns(
            db,
            brandId,
            tableKey,
            tabColumnWrites(await brandTabColumns(db, brandId, tableKey), parsed.data.columnConfig),
            actor,
          );
        }
        await setBrandPageOverrides(
          db,
          brandId,
          page,
          { title: parsed.data.title, isVisible: parsed.data.isVisible },
          actor,
        );
        return null;
      }
      await setBrandPageOverrides(
        db,
        brandId,
        page,
        {
          title: parsed.data.title,
          isVisible: parsed.data.isVisible,
          filterConfig: parsed.data.filterConfig,
          columnConfig: parsed.data.columnConfig,
        },
        actor,
      );
      return null;
    },
    'The page could not be saved. Try again.',
    `page_edit:${parsed.data.slug}`,
  );
}
