'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  PROPAGATION_TABLES,
  listChildBrands,
  listTeam,
  reattachColumn,
  resolveColumns,
  resolveTemplateBrandId,
  upsertColumnDefinition,
  type Db,
} from '@tas/db';
import { canSeePropagationPage } from '@tas/domain';
import { z } from 'zod';

import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { withAgencyScope } from '@/lib/propagation-source';
import { teamPageActorFrom } from '@/lib/team-actor';

import { columnAdminPath } from './fields';

/**
 * Column Admin's two mutations. Both write through `@tas/db` — `upsertColumnDefinition` and
 * `reattachColumn` — and neither touches a Drizzle table directly.
 *
 * TWO ENDPOINTS, NOT SIX. Restore, relabel, hide, reorder and detach are all the same statement:
 * this base's full definition of one column, upserted. `saveColumnsAction` therefore takes the rows
 * as they should END UP, and writes them inside ONE `db.transaction`, which is what makes a reorder
 * atomic: a failure between the two writes of a swap would otherwise leave two columns sharing a
 * `display_order` (and a renumber half applied). `reattachColumnAction` is separate because it is
 * the one write that REMOVES a definition rather than replacing it.
 *
 * NO KEY IS INVENTED HERE. A `column_definitions` row for a key the table does not store is a
 * column the grid adapter has to drop, so every submitted key is checked against what the resolver
 * ALREADY returns for this base, plus — on a brand — the parent template's set, which is how a
 * column this brand hid comes back. Anything else is refused, whether it came from the page or from
 * a hand-made POST; declaring a genuinely new field is `/app/propagation`'s custom-field path.
 * `source` is forced to `parent` for any key the parent defines, because a child's override of a
 * parent column carries `parent` (see `schema/column-definitions.ts`) and a `custom` row for it
 * could never be detached or reattached again.
 *
 * THE ROLE IS CHECKED HERE AS WELL AS ON THE PAGE, with the same `canSeePropagationPage` from
 * `@tas/domain` the page asks (agency Admin, and nobody else — the owner's rule: only admins change
 * column structure). A page-level gate alone is not a gate: a hidden control is still a reachable
 * endpoint, so the rule is asked again inside the scope that writes, exactly as
 * `propagation/custom-field-actions.ts` does.
 *
 * THE BASE IS PROVEN BEFORE IT IS WRITTEN. `baseId` arrives from the client, so it is checked
 * against the agency's own template and children; a uuid from another agency is simply not in that
 * list and the write never happens.
 *
 * Demo mode is refused before validation, before Clerk and before any connection.
 */
export interface ColumnActionSuccess {
  readonly ok: true;
  /** How many column definitions the submission actually wrote. */
  readonly written: number;
  /** Changes with every save, so the page can react to two saves in a row. */
  readonly savedAt: number;
}

export interface ColumnActionFailure {
  readonly ok: false;
  readonly error: string;
}

export type ColumnActionResult = ColumnActionSuccess | ColumnActionFailure;

const TABLE_KEYS = Object.keys(PROPAGATION_TABLES);

const NOT_ADMIN_REFUSAL = 'Only an agency Admin can change column structure.';

const columnWriteSchema = z.object({
  columnKey: z
    .string()
    .trim()
    .min(1, 'A column key is required.')
    .max(64, 'Keep the key under 64 characters.')
    .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, numbers and underscores.'),
  displayLabel: z
    .string()
    .trim()
    .min(1, 'A label is required.')
    .max(120, 'Keep the label under 120 characters.'),
  displayOrder: z.number().int().min(1).max(9999),
  isHidden: z.boolean(),
  isDetached: z.boolean(),
  fieldType: z.string().trim().max(64).nullable(),
  source: z.enum(['parent', 'custom']),
});

const tableKeySchema = z.string().refine((value) => TABLE_KEYS.includes(value), 'Unknown table.');

const savePayloadSchema = z.object({
  baseId: z.uuid({ error: 'That base could not be identified.' }),
  tableKey: tableKeySchema,
  columns: z.array(columnWriteSchema).min(1).max(100),
});

const reattachPayloadSchema = z.object({
  baseId: z.uuid({ error: 'That base could not be identified.' }),
  tableKey: tableKeySchema,
  columnKey: z.string().trim().min(1).max(64),
});

function failure(error: string): ColumnActionFailure {
  return { ok: false, error };
}

/** What the guarded body is told about the base it is allowed to write. */
interface ColumnAdminContext {
  readonly userId: string;
  readonly isTemplateBase: boolean;
  /** This agency's parent base, so a save can read the master set a restore comes from. */
  readonly templateBaseId: string;
}

/**
 * The guard both actions run inside: a session, the admin rule, and a base that belongs to this
 * agency. Everything it refuses, it refuses before `run` is called.
 */
async function withColumnAdmin(
  baseId: string,
  run: (db: Db, context: ColumnAdminContext) => Promise<ColumnActionResult>,
): Promise<ColumnActionResult> {
  const { userId } = await auth();
  if (userId === null) {
    return failure('Your session has expired. Sign in again.');
  }

  const result = await withAgencyScope(async (db, agencyId) => {
    const team = await listTeam(db, agencyId);
    const actor = teamPageActorFrom(team.find((row) => row.clerkUserId === userId));
    if (!canSeePropagationPage(actor)) {
      return failure(NOT_ADMIN_REFUSAL);
    }
    const templateBaseId = await resolveTemplateBrandId(db, agencyId);
    if (templateBaseId === null) {
      return failure('No template brand found for this agency.');
    }
    const children = await listChildBrands(db, templateBaseId);
    const known = baseId === templateBaseId || children.some((child) => child.id === baseId);
    if (!known) {
      return failure('That base is not part of this workspace.');
    }
    return run(db, { userId, isTemplateBase: baseId === templateBaseId, templateBaseId });
  });

  return result ?? failure('This workspace has no agency yet.');
}

/** `FormData` entries are `FormDataEntryValue | null`; a payload is a string, or nothing. */
function payload(formData: FormData): unknown {
  const raw = formData.get('payload');
  if (typeof raw !== 'string') return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * Restore, relabel, hide, reorder or detach — one or more columns of one table on one base, written
 * as the rows they should become, in one transaction.
 *
 * `source` is forced to `parent` on the template base, where every column IS the master set, and on
 * a child for any key the parent defines. Only a key the parent does not have keeps the submitted
 * value, which is the one case where `custom` is the truth.
 */
export async function saveColumnsAction(
  _previous: ColumnActionResult | null,
  formData: FormData,
): Promise<ColumnActionResult> {
  if (isDemoMode()) return failure(DEMO_WRITE_REFUSAL);

  const parsed = savePayloadSchema.safeParse(payload(formData));
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? 'That change could not be read.');
  }
  const { baseId, tableKey, columns } = parsed.data;

  try {
    return await withColumnAdmin(baseId, async (db, context) => {
      const { userId, isTemplateBase, templateBaseId } = context;
      const own = await resolveColumns(db, baseId, tableKey);
      const parent = isTemplateBase ? own : await resolveColumns(db, templateBaseId, tableKey);
      const parentKeys = new Set(parent.map((column) => column.columnKey));
      const known = new Set([...own.map((column) => column.columnKey), ...parentKeys]);
      const unknown = columns.find((column) => !known.has(column.columnKey));
      if (unknown !== undefined) {
        return failure(
          `“${unknown.columnKey}” is not a column of this table. Declare a new field on the ` +
            'Propagation page first.',
        );
      }
      await db.transaction(async (tx) => {
        for (const column of columns) {
          const source =
            isTemplateBase || parentKeys.has(column.columnKey) ? 'parent' : column.source;
          await upsertColumnDefinition(tx, baseId, { ...column, tableKey, source }, userId);
        }
      });
      revalidatePath(columnAdminPath);
      return { ok: true, written: columns.length, savedAt: Date.now() };
    });
  } catch {
    return failure('The column could not be saved. Try again.');
  }
}

/**
 * Drop this base's own definition of one column so the next read inherits the parent verbatim. The
 * custom label and position are lost, which the workspace warns about before it submits.
 */
export async function reattachColumnAction(
  _previous: ColumnActionResult | null,
  formData: FormData,
): Promise<ColumnActionResult> {
  if (isDemoMode()) return failure(DEMO_WRITE_REFUSAL);

  const parsed = reattachPayloadSchema.safeParse(payload(formData));
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? 'That change could not be read.');
  }
  const { baseId, tableKey, columnKey } = parsed.data;

  try {
    return await withColumnAdmin(baseId, async (db, { userId, isTemplateBase }) => {
      if (isTemplateBase) {
        return failure('The parent template has no definition to reattach.');
      }
      await reattachColumn(db, baseId, tableKey, columnKey, userId);
      revalidatePath(columnAdminPath);
      return { ok: true, written: 1, savedAt: Date.now() };
    });
  } catch {
    return failure('The column could not be reattached. Try again.');
  }
}
