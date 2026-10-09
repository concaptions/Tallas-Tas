'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  insertCreativeModule,
  syncCreativeModuleAngles,
  syncCreativeModuleDesigns,
  updateCreativeModule,
  type CreativeModuleInput,
} from '@tas/db';
import { z } from 'zod';

import { withBrandScope } from '@/lib/creative-modules-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { assertWorkspaceLive } from '@/lib/removed-workspaces';
import { creativeModulesPath } from '@/lib/routes';

/**
 * The Creative Modules route's two mutations (Airtable "(Internal) Creative Modules", audit §2.4).
 * Both follow `products/actions.ts` exactly, with the junction step from `ugc/actions.ts`:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup or connection — the demo
 *    deployment is unauthenticated, so a write must never reach a database;
 * 2. validate with zod: a module needs a name, the Foreplay link is optional (empty is stored as
 *    NULL, never as an empty string, so "unset" has one representation and the grid can render the
 *    em dash from `fields.ts`), and the two link pickers arrive as repeated `angleIds` / `briefIds`
 *    hidden inputs;
 * 3. write through the scoped `@tas/db` functions, which put `brand_id` on every statement, then
 *    replace both junctions with the posted ids through the sync helpers;
 * 4. revalidate the page and return a typed result. Neither ever throws to the client.
 */

/** The two typed module columns. `fields.ts` labels these; the links are pickers, not fields. */
export type CreativeModuleFieldName = 'moduleName' | 'foreplayLink';

export interface CreativeModuleActionSuccess {
  readonly ok: true;
  readonly id: string;
  /** Changes with every save, so the panel can react to two successful saves in a row. */
  readonly savedAt: number;
}

export interface CreativeModuleActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<CreativeModuleFieldName, string>>;
}

export type CreativeModuleActionResult = CreativeModuleActionSuccess | CreativeModuleActionFailure;

/** An `http(s)` URL, or a message a strategist can act on. Anything else is not a board link. */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** The optional Foreplay link: empty means NULL, a value must still be a real link. */
const optionalLink = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .refine(
    (value) => value === null || isHttpUrl(value),
    'Enter a full link, starting with https://',
  );

const moduleSchema = z.object({
  moduleName: z.string().trim().min(1, 'A module needs a name.'),
  foreplayLink: optionalLink,
  angleIds: z.array(z.string().min(1)),
  briefIds: z.array(z.string().min(1)),
});

type ParsedModule = z.infer<typeof moduleSchema>;

/** `FormData` entries are `FormDataEntryValue | null`; zod sees strings, or nothing. */
function fieldsOf(formData: FormData): Record<string, unknown> {
  const single = (key: string): string => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : '';
  };
  const many = (key: string): string[] =>
    formData.getAll(key).filter((value): value is string => typeof value === 'string');
  return {
    moduleName: single('moduleName'),
    foreplayLink: single('foreplayLink'),
    angleIds: many('angleIds'),
    briefIds: many('briefIds'),
  };
}

function failureFrom(error: z.ZodError): CreativeModuleActionFailure {
  const fieldErrors: Partial<Record<CreativeModuleFieldName, string>> = {};
  for (const issue of error.issues) {
    const [first] = issue.path;
    if (first === 'moduleName' || first === 'foreplayLink') {
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

function parse(formData: FormData): { parsed: ParsedModule } | CreativeModuleActionFailure {
  const result = moduleSchema.safeParse(fieldsOf(formData));
  return result.success ? { parsed: result.data } : failureFrom(result.error);
}

function valuesOf(parsed: ParsedModule): CreativeModuleInput {
  return { moduleName: parsed.moduleName, foreplayLink: parsed.foreplayLink };
}

/** Creates a module in the actor's brand and links the posted angles and designs to it. */
export async function createCreativeModuleAction(
  _previous: CreativeModuleActionResult | null,
  formData: FormData,
): Promise<CreativeModuleActionResult> {
  // Retired for every brand (Talal 2026-10-07): refuse before demo mode, validation or any write.
  const retired = assertWorkspaceLive('creative-modules');
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
      const row = await insertCreativeModule(db, brandId, valuesOf(parsed), actor);
      await syncCreativeModuleAngles(db, row.id, parsed.angleIds);
      await syncCreativeModuleDesigns(db, row.id, parsed.briefIds);
      return row;
    });
    if (created === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    revalidatePath(creativeModulesPath);
    return { ok: true, id: created.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The module could not be saved. Try again.' };
  }
}

/** Patches one module of the actor's brand and replaces its links; another brand's id never resolves. */
export async function updateCreativeModuleAction(
  _previous: CreativeModuleActionResult | null,
  formData: FormData,
): Promise<CreativeModuleActionResult> {
  // Retired for every brand (Talal 2026-10-07): refuse before demo mode, validation or any write.
  const retired = assertWorkspaceLive('creative-modules');
  if (retired) return retired;

  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This module could not be identified.' };
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
      const row = await updateCreativeModule(db, brandId, id, valuesOf(parsed), actor);
      if (row === null) return null;
      await syncCreativeModuleAngles(db, row.id, parsed.angleIds);
      await syncCreativeModuleDesigns(db, row.id, parsed.briefIds);
      return row;
    });
    if (saved === null) {
      return { ok: false, error: 'That module is no longer available.' };
    }
    revalidatePath(creativeModulesPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The module could not be saved. Try again.' };
  }
}
