'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  insertClientAssetFolder,
  syncFolderBriefs,
  updateClientAssetFolder,
  type ClientAssetFolderInput,
} from '@tas/db';
import { z } from 'zod';

import { withBrandScope } from '@/lib/client-assets-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { assertWorkspaceLive } from '@/lib/removed-workspaces';
import { clientAssetsPath } from '@/lib/routes';

/**
 * The Client Assets route's two mutations (Airtable "Client Assets Organisation", audit §2.9). Both
 * follow `products/actions.ts` exactly, with the junction step from `ugc/actions.ts`:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup or connection — the demo
 *    deployment is unauthenticated, so a write must never reach a database;
 * 2. validate with zod: a folder needs a name, the description and the location are optional
 *    (empty is stored as NULL, never as an empty string, so "unset" has one representation and the
 *    grid can render the em dash from `fields.ts`), a location must be a real link, and the design
 *    picker arrives as repeated `briefIds` hidden inputs;
 * 3. write through the scoped `@tas/db` functions, which put `brand_id` on every statement, then
 *    replace the junction with the posted ids through `syncFolderBriefs`;
 * 4. revalidate the page and return a typed result. Neither ever throws to the client.
 */

/** The three typed folder columns. `fields.ts` labels these; the link is a picker, not a field. */
export type ClientAssetFolderFieldName = 'name' | 'description' | 'locationUrl';

export interface ClientAssetFolderActionSuccess {
  readonly ok: true;
  readonly id: string;
  /** Changes with every save, so the panel can react to two successful saves in a row. */
  readonly savedAt: number;
}

export interface ClientAssetFolderActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<ClientAssetFolderFieldName, string>>;
}

export type ClientAssetFolderActionResult =
  ClientAssetFolderActionSuccess | ClientAssetFolderActionFailure;

/** An `http(s)` URL, or a message a strategist can act on. Anything else is not a folder location. */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Optional free text: empty means NULL. */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable();

/** The optional location: empty means NULL, a value must still be a real link. */
const optionalLink = optionalText.refine(
  (value) => value === null || isHttpUrl(value),
  'Enter a full link, starting with https://',
);

const folderSchema = z.object({
  name: z.string().trim().min(1, 'A folder needs a name.'),
  description: optionalText,
  locationUrl: optionalLink,
  briefIds: z.array(z.string().min(1)),
});

type ParsedFolder = z.infer<typeof folderSchema>;

/** `FormData` entries are `FormDataEntryValue | null`; zod sees strings, or nothing. */
function fieldsOf(formData: FormData): Record<string, unknown> {
  const single = (key: string): string => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : '';
  };
  const many = (key: string): string[] =>
    formData.getAll(key).filter((value): value is string => typeof value === 'string');
  return {
    name: single('name'),
    description: single('description'),
    locationUrl: single('locationUrl'),
    briefIds: many('briefIds'),
  };
}

function failureFrom(error: z.ZodError): ClientAssetFolderActionFailure {
  const fieldErrors: Partial<Record<ClientAssetFolderFieldName, string>> = {};
  for (const issue of error.issues) {
    const [first] = issue.path;
    if (first === 'name' || first === 'description' || first === 'locationUrl') {
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

function parse(formData: FormData): { parsed: ParsedFolder } | ClientAssetFolderActionFailure {
  const result = folderSchema.safeParse(fieldsOf(formData));
  return result.success ? { parsed: result.data } : failureFrom(result.error);
}

function valuesOf(parsed: ParsedFolder): ClientAssetFolderInput {
  return {
    name: parsed.name,
    description: parsed.description,
    locationUrl: parsed.locationUrl,
  };
}

/** Creates a folder in the actor's brand and links the posted designs to it. */
export async function createClientAssetFolderAction(
  _previous: ClientAssetFolderActionResult | null,
  formData: FormData,
): Promise<ClientAssetFolderActionResult> {
  // Retired for every brand (Talal 2026-10-07): refuse before demo mode, validation or any write.
  const retired = assertWorkspaceLive('client-assets');
  if (retired) return retired;

  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const outcome = parse(formData);
  if ('ok' in outcome) {
    return outcome;
  }
  const { parsed } = outcome;

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }
    const created = await withBrandScope(async (db, brandId) => {
      const row = await insertClientAssetFolder(db, brandId, valuesOf(parsed), actor);
      await syncFolderBriefs(db, row.id, parsed.briefIds);
      return row;
    });
    if (created === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    revalidatePath(clientAssetsPath);
    return { ok: true, id: created.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The folder could not be saved. Try again.' };
  }
}

/** Patches one folder of the actor's brand and replaces its links; another brand's id never resolves. */
export async function updateClientAssetFolderAction(
  _previous: ClientAssetFolderActionResult | null,
  formData: FormData,
): Promise<ClientAssetFolderActionResult> {
  // Retired for every brand (Talal 2026-10-07): refuse before demo mode, validation or any write.
  const retired = assertWorkspaceLive('client-assets');
  if (retired) return retired;

  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This folder could not be identified.' };
  }

  const outcome = parse(formData);
  if ('ok' in outcome) {
    return outcome;
  }
  const { parsed } = outcome;

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }
    const saved = await withBrandScope(async (db, brandId) => {
      const row = await updateClientAssetFolder(db, brandId, id, valuesOf(parsed), actor);
      if (row === null) return null;
      await syncFolderBriefs(db, row.id, parsed.briefIds);
      return row;
    });
    if (saved === null) {
      return { ok: false, error: 'That folder is no longer available.' };
    }
    revalidatePath(clientAssetsPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The folder could not be saved. Try again.' };
  }
}
