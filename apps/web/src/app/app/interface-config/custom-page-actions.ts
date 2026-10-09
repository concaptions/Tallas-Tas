'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  insertCustomPage,
  listTeam,
  softDeleteCustomPage,
  updateCustomPage,
  type Db,
} from '@tas/db';
import {
  CUSTOM_PAGE_SOURCE_TABLE_KEYS,
  canConfigureInterface,
  filterOpNeedsValue,
  type CustomPageFilterConfig,
} from '@tas/domain';
import { z } from 'zod';

import { resolveLiveAgencyId } from '@/lib/data-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { withInterfacePagesScope } from '@/lib/interface-config-pages-source';
import { interfaceConfigPath } from '@/lib/routes';
import { teamPageActorFrom } from '@/lib/team-actor';

/**
 * Server Actions for the Custom Interface Pages admin section (Oct 6/7 Agent 4).
 *
 * Four actions: create, update, soft-delete, and push-to-template-children (the propagation
 * request, in `./propagation-actions.ts`). All refuse in demo mode BEFORE anything is parsed; all
 * re-check `canConfigureInterface` inside the scope that writes.
 *
 * The slug is normalised to `kebab-case` by the client UI; the schema here only validates the
 * shape (lowercase, alnum + dash). The schema's filter parse is a DISCRIMINATED UNION on `op`, so
 * a parse of `{op: 'is_empty', value: 'x'}` fails without the component having to branch.
 */

export interface CustomPageActionSuccess {
  readonly ok: true;
  readonly id?: string;
  readonly savedAt: number;
}

export interface CustomPageActionFailure {
  readonly ok: false;
  readonly error: string;
}

export type CustomPageActionResult = CustomPageActionSuccess | CustomPageActionFailure;

const NOT_PERMITTED_REFUSAL =
  'Only an agency Admin or a Client Success Manager can change which pages and tabs the client interface shows.';

function failure(error: string): CustomPageActionFailure {
  return { ok: false, error };
}

function success(id?: string): CustomPageActionSuccess {
  return { ok: true, id, savedAt: Date.now() };
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

function entry(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

// kebab-case: lowercase + digits + dashes, no leading / trailing / double dash.
const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const columnConfigSchema = z
  .array(
    z.object({
      columnKey: z.string().min(1).max(128),
      displayLabel: z.string().min(1).max(128),
      displayOrder: z.number().int().min(0).max(999),
    }),
  )
  .max(64);

/**
 * At least one column pick: `column_config = []` is "every resolver column" to the client route,
 * internal fields included (non-negotiable 10). `@tas/db` refuses it too; this is the message.
 */
const columnPicksSchema = columnConfigSchema.min(
  1,
  'Pick at least one column: an empty set would show the client every column of the table.',
);

const filterConfigSchema = z.union([
  z.object({}).strict(),
  z.object({
    column: z.string().min(1).max(128),
    op: z.enum(['is', 'is_not', 'contains']),
    value: z.string().min(1).max(512),
  }),
  z.object({
    column: z.string().min(1).max(128),
    op: z.enum(['is_empty', 'is_not_empty']),
  }),
]);

const createSchema = z.object({
  slug: z.string().min(1).max(80).regex(slugRegex, 'Slug must be kebab-case.'),
  title: z.string().min(1).max(120),
  sourceTableKey: z.enum(CUSTOM_PAGE_SOURCE_TABLE_KEYS),
  filterConfig: filterConfigSchema,
  columnConfig: columnPicksSchema,
  isVisible: z.boolean(),
});

const updateSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(120).optional(),
  slug: z.string().min(1).max(80).regex(slugRegex, 'Slug must be kebab-case.').optional(),
  sourceTableKey: z.enum(CUSTOM_PAGE_SOURCE_TABLE_KEYS).optional(),
  filterConfig: filterConfigSchema.optional(),
  columnConfig: columnPicksSchema.optional(),
  isVisible: z.boolean().optional(),
});

const deleteSchema = z.object({ id: z.uuid() });

/**
 * Parse FormData for a create/update: the simple scalar fields come from flat entries, and the
 * two jsonb fields arrive as a JSON string. A caller writes the JSON string with `JSON.stringify`
 * on the client; the schema here validates it after `JSON.parse`.
 */
function readJson(formData: FormData, key: string): unknown {
  const raw = entry(formData, key);
  if (raw === undefined || raw === '') return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Reject a filter with an op that needs a value but has none, before Postgres sees it. */
function filterValid(filter: CustomPageFilterConfig): boolean {
  if (!('op' in filter)) return true;
  if (!filterOpNeedsValue(filter.op)) return true;
  return 'value' in filter && filter.value.length > 0;
}

export async function createCustomPageAction(
  _previous: CustomPageActionResult | null,
  formData: FormData,
): Promise<CustomPageActionResult> {
  if (isDemoMode()) return failure(DEMO_WRITE_REFUSAL);
  const raw = {
    slug: entry(formData, 'slug'),
    title: entry(formData, 'title'),
    sourceTableKey: entry(formData, 'sourceTableKey'),
    filterConfig: readJson(formData, 'filterConfig') ?? {},
    columnConfig: readJson(formData, 'columnConfig') ?? [],
    isVisible: entry(formData, 'isVisible') === 'true',
  };
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return failure('Could not read the page.');
  if (!filterValid(parsed.data.filterConfig)) {
    return failure('A filter with the chosen operator needs a value.');
  }

  // `CUSTOM_PAGE_FILTER_OPS` is the single source of the op union; a drift would fail the build
  // through the discriminated-union zod schema above, not through a runtime read.

  try {
    const actor = await actorId();
    if (actor === null) return failure('Your session has expired. Sign in again to save.');
    const outcome = await withInterfacePagesScope(async (db, brandId) => {
      const refusal = await configRefusal(db, actor);
      if (refusal !== null) return { refusal };
      try {
        const row = await insertCustomPage(db, {
          brandId,
          slug: parsed.data.slug,
          title: parsed.data.title,
          sourceTableKey: parsed.data.sourceTableKey,
          filterConfig: parsed.data.filterConfig,
          columnConfig: parsed.data.columnConfig,
          sortOrder: 100, // appended; the admin UI's reorder arrows adjust later
          isVisible: parsed.data.isVisible,
          isInherited: false, // a user-created page is not inheriting anything
          createdBy: actor,
          updatedBy: actor,
        });
        return { refusal: null, id: row.id };
      } catch (error) {
        if (error instanceof Error && error.message.includes('unique')) {
          return { refusal: 'A page with this slug already exists.' };
        }
        throw error;
      }
    });
    if (outcome === null) return failure('This workspace has no brand yet.');
    if (outcome.refusal !== null) return failure(outcome.refusal);
    revalidatePath(interfaceConfigPath);
    return success(outcome.id);
  } catch {
    return failure('The page could not be saved. Try again.');
  }
}

export async function updateCustomPageAction(
  _previous: CustomPageActionResult | null,
  formData: FormData,
): Promise<CustomPageActionResult> {
  if (isDemoMode()) return failure(DEMO_WRITE_REFUSAL);
  const rawFilter = readJson(formData, 'filterConfig');
  const rawColumns = readJson(formData, 'columnConfig');
  const raw: Record<string, unknown> = {
    id: entry(formData, 'id'),
    title: entry(formData, 'title'),
    slug: entry(formData, 'slug'),
    sourceTableKey: entry(formData, 'sourceTableKey'),
    isVisible:
      entry(formData, 'isVisible') === undefined
        ? undefined
        : entry(formData, 'isVisible') === 'true',
  };
  if (rawFilter !== undefined) raw.filterConfig = rawFilter;
  if (rawColumns !== undefined) raw.columnConfig = rawColumns;
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return failure('Could not read the page update.');
  if (parsed.data.filterConfig && !filterValid(parsed.data.filterConfig)) {
    return failure('A filter with the chosen operator needs a value.');
  }
  try {
    const actor = await actorId();
    if (actor === null) return failure('Your session has expired. Sign in again to save.');
    const outcome = await withInterfacePagesScope(async (db, brandId) => {
      const refusal = await configRefusal(db, actor);
      if (refusal !== null) return { refusal };
      const row = await updateCustomPage(db, parsed.data.id, brandId, {
        title: parsed.data.title,
        slug: parsed.data.slug,
        sourceTableKey: parsed.data.sourceTableKey,
        filterConfig: parsed.data.filterConfig,
        columnConfig: parsed.data.columnConfig,
        isVisible: parsed.data.isVisible,
        isInherited: false,
        updatedBy: actor,
      });
      if (row === null) return { refusal: 'This page is no longer available.' };
      return { refusal: null, id: row.id };
    });
    if (outcome === null) return failure('This workspace has no brand yet.');
    if (outcome.refusal !== null) return failure(outcome.refusal);
    revalidatePath(interfaceConfigPath);
    return success(outcome.id);
  } catch {
    return failure('The page could not be saved. Try again.');
  }
}

export async function deleteCustomPageAction(
  _previous: CustomPageActionResult | null,
  formData: FormData,
): Promise<CustomPageActionResult> {
  if (isDemoMode()) return failure(DEMO_WRITE_REFUSAL);
  const parsed = deleteSchema.safeParse({ id: entry(formData, 'id') });
  if (!parsed.success) return failure('Could not read the delete request.');
  try {
    const actor = await actorId();
    if (actor === null) return failure('Your session has expired. Sign in again to save.');
    const outcome = await withInterfacePagesScope(async (db, brandId) => {
      const refusal = await configRefusal(db, actor);
      if (refusal !== null) return { refusal };
      const ok = await softDeleteCustomPage(db, parsed.data.id, brandId, actor);
      if (!ok) return { refusal: 'This page is no longer available.' };
      return { refusal: null };
    });
    if (outcome === null) return failure('This workspace has no brand yet.');
    if (outcome.refusal !== null) return failure(outcome.refusal);
    revalidatePath(interfaceConfigPath);
    return success();
  } catch {
    return failure('The page could not be deleted. Try again.');
  }
}
