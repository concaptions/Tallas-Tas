'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  insertCreativeSheetItem,
  updateCreativeSheetItem,
  type CreativeSheetItemInput,
} from '@tas/db';
import {
  creativeSheetInternalStatuses,
  creativeSheetStatuses,
  creativeSheetWinning,
} from '@tas/db/schema';
import { z } from 'zod';

import { withBrandScope } from '@/lib/creative-sheet-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { creativeSheetPath } from '@/lib/routes';

/**
 * The Creative Sheet route's mutations (Airtable `tblGC0TxnHI7lKaNQ`). All three follow
 * `products/actions.ts` exactly:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup or connection;
 * 2. validate with zod: the three selects accept only the KEYS of the `@tas/db` vocabularies (an
 *    empty value is stored as NULL, never as an empty string), the six checkboxes coerce from the
 *    panel's hidden `'true'` / `''` inputs, and the QA checklist is one `http(s)` URL per line;
 * 3. write through the scoped `@tas/db` functions, which put `brand_id` on every statement;
 * 4. revalidate the page and return a typed result. None of them ever throws to the client.
 *
 * The row's NAME is never submitted: it is the Airtable formula over `created_at` and the brief's
 * name, computed by the query layer (CLAUDE.md non-negotiable 6). `spelling_feedback` is not
 * submitted either — it is what the AI check wrote, and the panel shows it read-only.
 */

/** The six Airtable checkboxes, each a NOT NULL boolean column. */
export type CreativeSheetCheck =
  | 'qaVideoEditor'
  | 'qaDesigner'
  | 'qaStrategist'
  | 'used'
  | 'deniedRevisionsNeeded'
  | 'spellCheckRequested';

/** Every writable column the panel submits. `fields.ts` labels these; nothing else is editable. */
export type CreativeSheetFieldName =
  | 'briefId'
  | 'internalStatus'
  | 'status'
  | 'winning'
  | 'clientComments'
  | 'qaChecklistDoc'
  | CreativeSheetCheck;

/** The two fields the Kanban board can regroup by, and so the two a card drag may change. */
export type CreativeSheetKanbanField = 'internalStatus' | 'status';

export interface CreativeSheetActionSuccess {
  readonly ok: true;
  readonly id: string;
  /** Changes with every save, so the panel can react to two successful saves in a row. */
  readonly savedAt: number;
}

export interface CreativeSheetActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<CreativeSheetFieldName, string>>;
}

export type CreativeSheetActionResult = CreativeSheetActionSuccess | CreativeSheetActionFailure;

/** An `http(s)` URL, or a message a strategist can act on. */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** A select over one vocabulary's KEYS: the empty option is NULL, anything else must be a key. */
function optionalKey<K extends string>(entries: readonly { readonly key: K }[]) {
  return z
    .union([z.literal(''), z.enum(entries.map((entry) => entry.key))])
    .transform((value) => (value === '' ? null : value));
}

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value));

/** The brief picker's hidden input: empty means "no brief", which the column allows. */
const optionalUuid = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .refine(
    (value) => value === null || z.uuid().safeParse(value).success,
    'Pick a brief from the list.',
  );

/** The QA checklist textarea: one link per line, blank lines ignored, every line a real URL. */
const urlLines = z
  .string()
  .transform((text) =>
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== ''),
  )
  .refine(
    (lines) => lines.every(isHttpUrl),
    'Each QA checklist line must be a full link, starting with https://',
  );

/** The panel's hidden `'true'` / `''` inputs; anything but `'true'` is unticked. */
const checkbox = z
  .string()
  .optional()
  .transform((value) => value === 'true');

const sheetItemSchema = z.object({
  briefId: optionalUuid,
  internalStatus: optionalKey(creativeSheetInternalStatuses),
  status: optionalKey(creativeSheetStatuses),
  winning: optionalKey(creativeSheetWinning),
  clientComments: optionalText,
  qaChecklistDoc: urlLines,
  qaVideoEditor: checkbox,
  qaDesigner: checkbox,
  qaStrategist: checkbox,
  used: checkbox,
  deniedRevisionsNeeded: checkbox,
  spellCheckRequested: checkbox,
});

/** `FormData` entries are `FormDataEntryValue | null`; zod sees strings, or nothing. */
function fieldsOf(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(
    [...formData.entries()]
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => [key, typeof value === 'string' ? value : '']),
  );
}

function failureFrom(error: z.ZodError): CreativeSheetActionFailure {
  const fieldErrors: Partial<Record<CreativeSheetFieldName, string>> = {};
  for (const issue of error.issues) {
    const [first] = issue.path;
    if (typeof first === 'string') {
      fieldErrors[first as CreativeSheetFieldName] ??= issue.message;
    }
  }
  return { ok: false, error: 'Some fields need attention before this can be saved.', fieldErrors };
}

/** Who is writing. Live mode only: in demo mode every action has already returned. */
async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

function parse(
  formData: FormData,
): { values: CreativeSheetItemInput } | CreativeSheetActionFailure {
  const parsed = sheetItemSchema.safeParse(fieldsOf(formData));
  if (!parsed.success) return failureFrom(parsed.error);
  const { qaChecklistDoc, ...rest } = parsed.data;
  // An empty checklist is NULL, so "no document" has one representation and the grid can dash it.
  return {
    values: { ...rest, qaChecklistDoc: qaChecklistDoc.length === 0 ? null : qaChecklistDoc },
  };
}

const SAVE_FAILED = 'The sheet row could not be saved. Try again.';
const SESSION_EXPIRED = 'Your session has expired. Sign in again to save.';

/** Creates a sheet row in the actor's brand. */
export async function createCreativeSheetItemAction(
  _previous: CreativeSheetActionResult | null,
  formData: FormData,
): Promise<CreativeSheetActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const parsed = parse(formData);
  if ('ok' in parsed) {
    return parsed;
  }

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: SESSION_EXPIRED };
    }
    const created = await withBrandScope((db, brandId) =>
      insertCreativeSheetItem(db, brandId, parsed.values, actor),
    );
    if (created === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    revalidatePath(creativeSheetPath);
    return { ok: true, id: created.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
}

/** Patches one sheet row of the actor's brand; another brand's id simply never resolves. */
export async function updateCreativeSheetItemAction(
  _previous: CreativeSheetActionResult | null,
  formData: FormData,
): Promise<CreativeSheetActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This sheet row could not be identified.' };
  }

  const parsed = parse(formData);
  if ('ok' in parsed) {
    return parsed;
  }

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: SESSION_EXPIRED };
    }
    const saved = await withBrandScope((db, brandId) =>
      updateCreativeSheetItem(db, brandId, id, parsed.values, actor),
    );
    if (saved === null) {
      return { ok: false, error: 'That sheet row is no longer available.' };
    }
    revalidatePath(creativeSheetPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
}

/** A Kanban card drop: `id`, the `field` the board is grouped by and the column's `value`. */
const moveSchema = z.discriminatedUnion('field', [
  z.object({
    field: z.literal('internalStatus'),
    value: optionalKey(creativeSheetInternalStatuses),
  }),
  z.object({ field: z.literal('status'), value: optionalKey(creativeSheetStatuses) }),
]);

/**
 * Moves one row to another Kanban column: a single-field patch of `internal_status` or `status`,
 * through the same scoped update the panel uses. The board passes the column's KEY, or `''` for
 * the "Not set" column, which stores NULL.
 */
export async function moveCreativeSheetItemAction(
  _previous: CreativeSheetActionResult | null,
  formData: FormData,
): Promise<CreativeSheetActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This sheet row could not be identified.' };
  }

  const parsed = moveSchema.safeParse({
    field: formData.get('field'),
    value: typeof formData.get('value') === 'string' ? formData.get('value') : '',
  });
  if (!parsed.success) {
    return { ok: false, error: 'That column is not a status this sheet knows.' };
  }
  const patch: Partial<CreativeSheetItemInput> =
    parsed.data.field === 'internalStatus'
      ? { internalStatus: parsed.data.value }
      : { status: parsed.data.value };

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: SESSION_EXPIRED };
    }
    const saved = await withBrandScope((db, brandId) =>
      updateCreativeSheetItem(db, brandId, id, patch, actor),
    );
    if (saved === null) {
      return { ok: false, error: 'That sheet row is no longer available.' };
    }
    revalidatePath(creativeSheetPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
}
