'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { insertCopyType, updateCopyType, type CopyTypeInput } from '@tas/db';
import { z } from 'zod';

import { withBrandScope } from '@/lib/copy-types-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { copyTypesPath } from '@/lib/routes';

/**
 * The Copy Types route's two mutations (Airtable "(Internal) Copy Type", gap audit 2026-10-01
 * §2.13). Both follow `products/actions.ts` exactly:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup or connection — the demo
 *    deployment is unauthenticated, so a write must never reach a database;
 * 2. validate with zod: a copy type needs a name, and the description is optional (empty is stored
 *    as NULL, never as an empty string, so "unset" has one representation and the grid can render
 *    the em dash from `fields.ts`);
 * 3. write through the scoped `@tas/db` functions, which put `brand_id` on every statement;
 * 4. revalidate the page and return a typed result. Neither ever throws to the client.
 *
 * The two record links are not written here: they are owned by the copy tables (a copy is tagged
 * with a type from the copy's own panel), and this page only reads them back.
 */

/** The two writable copy-type columns. `fields.ts` labels these; nothing else is editable. */
export type CopyTypeFieldName = 'name' | 'description';

export interface CopyTypeActionSuccess {
  readonly ok: true;
  readonly id: string;
  /** Changes with every save, so the panel can react to two successful saves in a row. */
  readonly savedAt: number;
}

export interface CopyTypeActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<CopyTypeFieldName, string>>;
}

export type CopyTypeActionResult = CopyTypeActionSuccess | CopyTypeActionFailure;

/** The optional description: empty means NULL. */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable();

const copyTypeSchema = z.object({
  name: z.string().trim().min(1, 'A copy type needs a name.'),
  description: optionalText,
});

/** `FormData` entries are `FormDataEntryValue | null`; zod sees strings, or nothing. */
function fieldsOf(formData: FormData): Record<string, unknown> {
  const single = (key: string): string => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : '';
  };
  return { name: single('name'), description: single('description') };
}

function failureFrom(error: z.ZodError): CopyTypeActionFailure {
  const fieldErrors: Partial<Record<CopyTypeFieldName, string>> = {};
  for (const issue of error.issues) {
    const [first] = issue.path;
    if (first === 'name' || first === 'description') {
      fieldErrors[first] ??= issue.message;
    }
  }
  return { ok: false, error: 'Some fields need attention before this can be saved.', fieldErrors };
}

/** Who is writing. Live mode only: in demo mode both actions have already returned. */
async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

function parse(formData: FormData): { values: CopyTypeInput } | CopyTypeActionFailure {
  const parsed = copyTypeSchema.safeParse(fieldsOf(formData));
  return parsed.success ? { values: parsed.data } : failureFrom(parsed.error);
}

/** Creates a copy type in the actor's brand. */
export async function createCopyTypeAction(
  _previous: CopyTypeActionResult | null,
  formData: FormData,
): Promise<CopyTypeActionResult> {
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
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }
    const created = await withBrandScope((db, brandId) =>
      insertCopyType(db, brandId, parsed.values, actor),
    );
    if (created === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    revalidatePath(copyTypesPath);
    return { ok: true, id: created.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The copy type could not be saved. Try again.' };
  }
}

/** Patches one copy type of the actor's brand; another brand's id simply never resolves. */
export async function updateCopyTypeAction(
  _previous: CopyTypeActionResult | null,
  formData: FormData,
): Promise<CopyTypeActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This copy type could not be identified.' };
  }

  const parsed = parse(formData);
  if ('ok' in parsed) {
    return parsed;
  }

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }
    const saved = await withBrandScope((db, brandId) =>
      updateCopyType(db, brandId, id, parsed.values, actor),
    );
    if (saved === null) {
      return { ok: false, error: 'That copy type is no longer available.' };
    }
    revalidatePath(copyTypesPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The copy type could not be saved. Try again.' };
  }
}
