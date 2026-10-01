'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  insertSmCampaignFeedTask,
  updateSmCampaignFeedTask,
  type SmCampaignFeedTaskInput,
} from '@tas/db';
import { z } from 'zod';

import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { smCampaignFeedPath } from '@/lib/routes';
import { withBrandScope } from '@/lib/sm-campaign-feed-source';

import {
  parseDateTimeLocalValue,
  PLATFORM_OPTIONS,
  STATUS_OPTIONS,
  type SmTaskFieldName,
} from './fields';

/**
 * The SM Campaign Feed's mutations (Airtable `tblLRajTW55XEhVhk`). All three follow
 * `products/actions.ts` exactly:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup or connection — the demo
 *    deployment is unauthenticated, so a write must never reach a database;
 * 2. validate with zod: a task needs a name; platform and status must be keys of the `@tas/db/schema`
 *    vocabularies or empty; the due moment is a `datetime-local` value read as UTC or empty; notes are
 *    free text. Empty is stored as NULL, never as an empty string, so "unset" has one representation
 *    and the grid can render the em dash from `fields.ts`;
 * 3. write through the scoped `@tas/db` functions, which put `brand_id` on every statement;
 * 4. revalidate the page and return a typed result. None of them ever throws to the client.
 *
 * `moveSmCampaignFeedTaskAction` is the Kanban drop: one field, one key, same validation, same scope.
 */

export interface SmTaskActionSuccess {
  readonly ok: true;
  readonly id: string;
  /** Changes with every save, so the panel can react to two successful saves in a row. */
  readonly savedAt: number;
}

export interface SmTaskActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<SmTaskFieldName, string>>;
}

export type SmTaskActionResult = SmTaskActionSuccess | SmTaskActionFailure;

const PLATFORM_KEYS = PLATFORM_OPTIONS.map((option) => option.value);
const STATUS_KEYS = STATUS_OPTIONS.map((option) => option.value);

const DUE_DATE_MESSAGE = 'Enter a date and time, or leave the due date empty.';

/** A select's key from the vocabulary, or empty, which is stored as NULL. */
function optionalChoice<Key extends string>(keys: readonly Key[], message: string) {
  return z
    .union([z.literal(''), z.enum(keys)], { error: message })
    .transform((value) => (value === '' ? null : value));
}

/** The `datetime-local` input's text: empty means NULL, anything else must be a real moment. */
const optionalDueDate = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === '') {
      return null;
    }
    const parsed = parseDateTimeLocalValue(value);
    if (parsed === null) {
      ctx.addIssue({ code: 'custom', message: DUE_DATE_MESSAGE });
      return z.NEVER;
    }
    return parsed;
  });

const taskSchema = z.object({
  taskName: z.string().trim().min(1, 'A task needs a name.'),
  platform: optionalChoice(PLATFORM_KEYS, 'Pick a platform from the list.'),
  dueDate: optionalDueDate,
  status: optionalChoice(STATUS_KEYS, 'Pick a status from the list.'),
  notes: z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : value)),
});

/** A Kanban drop: which field the board is grouped by, and the lane the card landed in. */
const moveSchema = z.discriminatedUnion('field', [
  z.object({
    id: z.string().min(1),
    field: z.literal('status'),
    value: optionalChoice(STATUS_KEYS, 'Pick a status from the list.'),
  }),
  z.object({
    id: z.string().min(1),
    field: z.literal('platform'),
    value: optionalChoice(PLATFORM_KEYS, 'Pick a platform from the list.'),
  }),
]);

export interface SmTaskMoveInput {
  readonly id: string;
  readonly field: string;
  readonly value: string;
}

/** `FormData` entries are `FormDataEntryValue | null`; zod sees strings, or nothing. */
function fieldsOf(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(
    [...formData.entries()]
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => [key, typeof value === 'string' ? value : '']),
  );
}

function failureFrom(error: z.ZodError): SmTaskActionFailure {
  const fieldErrors: Partial<Record<SmTaskFieldName, string>> = {};
  for (const issue of error.issues) {
    const [first] = issue.path;
    if (typeof first === 'string') {
      fieldErrors[first as SmTaskFieldName] ??= issue.message;
    }
  }
  return { ok: false, error: 'Some fields need attention before this can be saved.', fieldErrors };
}

/** Who is writing. Live mode only: in demo mode every action has already returned. */
async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

function parse(formData: FormData): { values: SmCampaignFeedTaskInput } | SmTaskActionFailure {
  const parsed = taskSchema.safeParse(fieldsOf(formData));
  return parsed.success ? { values: parsed.data } : failureFrom(parsed.error);
}

const SESSION_EXPIRED = 'Your session has expired. Sign in again to save.';
const SAVE_FAILED = 'The task could not be saved. Try again.';

/** Creates a task in the actor's brand. */
export async function createSmCampaignFeedTaskAction(
  _previous: SmTaskActionResult | null,
  formData: FormData,
): Promise<SmTaskActionResult> {
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
      insertSmCampaignFeedTask(db, brandId, parsed.values, actor),
    );
    if (created === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    revalidatePath(smCampaignFeedPath);
    return { ok: true, id: created.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
}

/** Patches one task of the actor's brand; another brand's id simply never resolves. */
export async function updateSmCampaignFeedTaskAction(
  _previous: SmTaskActionResult | null,
  formData: FormData,
): Promise<SmTaskActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This task could not be identified.' };
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
      updateSmCampaignFeedTask(db, brandId, id, parsed.values, actor),
    );
    if (saved === null) {
      return { ok: false, error: 'That task is no longer available.' };
    }
    revalidatePath(smCampaignFeedPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
}

/** A Kanban drop: moves one task of the actor's brand to the lane's key on the board's group field. */
export async function moveSmCampaignFeedTaskAction(
  input: SmTaskMoveInput,
): Promise<SmTaskActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'That lane is not one this board knows.' };
  }
  const { id } = parsed.data;
  const patch: Partial<SmCampaignFeedTaskInput> =
    parsed.data.field === 'status'
      ? { status: parsed.data.value }
      : { platform: parsed.data.value };

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: SESSION_EXPIRED };
    }
    const saved = await withBrandScope((db, brandId) =>
      updateSmCampaignFeedTask(db, brandId, id, patch, actor),
    );
    if (saved === null) {
      return { ok: false, error: 'That task is no longer available.' };
    }
    revalidatePath(smCampaignFeedPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
}
