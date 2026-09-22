'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  insertCreativeDimension,
  updateCreativeDimension,
  type CreativeDimensionInput,
} from '@tas/db';
import { z } from 'zod';

import { withBrandScope } from '@/lib/creative-dimensions-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { creativeDimensionsPath } from '@/lib/routes';

/**
 * The Creative Dimensions route's two mutations, shaped exactly like Products and Personas:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup or connection — the demo
 *    deployment is unauthenticated, so a write must never reach a database;
 * 2. validate the four fields with zod (an empty text field is stored as NULL, never as an empty
 *    string, so "unset" has one representation);
 * 3. write through the scoped `@tas/db` functions, which put `brand_id` on every statement;
 * 4. revalidate the page and return a typed result. Neither ever throws to the client.
 */
export type CreativeDimensionFieldName =
  'name' | 'dimensions' | 'linkDescription' | 'creativeDesignId';

export interface CreativeDimensionActionSuccess {
  readonly ok: true;
  readonly id: string;
  /** Changes with every save, so the panel can react to two successful saves in a row. */
  readonly savedAt: number;
}

export interface CreativeDimensionActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<CreativeDimensionFieldName, string>>;
}

export type CreativeDimensionActionResult =
  CreativeDimensionActionSuccess | CreativeDimensionActionFailure;

/** A text column: trimmed, and empty means NULL. */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

const optionalUuid = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

/** The four fields. `name` is the only required one. */
const creativeDimensionSchema = z.object({
  name: z.string().trim().min(1, 'A creative dimension needs a name.'),
  dimensions: optionalText,
  linkDescription: optionalText,
  creativeDesignId: optionalUuid,
});

/** `FormData` entries are `FormDataEntryValue | null`; zod sees strings, or nothing. */
function fieldsOf(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(
    [...formData.entries()]
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => [key, typeof value === 'string' ? value : '']),
  );
}

function failureFrom(error: z.ZodError): CreativeDimensionActionFailure {
  const fieldErrors: Partial<Record<CreativeDimensionFieldName, string>> = {};
  for (const issue of error.issues) {
    const [first] = issue.path;
    if (typeof first === 'string') {
      fieldErrors[first as CreativeDimensionFieldName] ??= issue.message;
    }
  }
  return { ok: false, error: 'Some fields need attention before this can be saved.', fieldErrors };
}

/** Who is writing. Live mode only: in demo mode both actions have already returned. */
async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

function parse(
  formData: FormData,
): { values: CreativeDimensionInput } | CreativeDimensionActionFailure {
  const parsed = creativeDimensionSchema.safeParse(fieldsOf(formData));
  if (!parsed.success) return failureFrom(parsed.error);
  return {
    values: {
      name: parsed.data.name,
      dimensions: parsed.data.dimensions ?? null,
      linkDescription: parsed.data.linkDescription ?? null,
      creativeDesignId: parsed.data.creativeDesignId ?? null,
      legacyAirtableId: null,
    },
  };
}

/** Creates a creative dimension in the actor's brand. */
export async function createCreativeDimensionAction(
  _previous: CreativeDimensionActionResult | null,
  formData: FormData,
): Promise<CreativeDimensionActionResult> {
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
      insertCreativeDimension(db, brandId, parsed.values, actor),
    );
    if (created === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    revalidatePath(creativeDimensionsPath);
    return { ok: true, id: created.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The creative dimension could not be saved. Try again.' };
  }
}

/** Patches one creative dimension of the actor's brand; another brand's id simply never resolves. */
export async function updateCreativeDimensionAction(
  _previous: CreativeDimensionActionResult | null,
  formData: FormData,
): Promise<CreativeDimensionActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This creative dimension could not be identified.' };
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
      updateCreativeDimension(db, brandId, id, parsed.values, actor),
    );
    if (saved === null) {
      return { ok: false, error: 'That creative dimension is no longer available.' };
    }
    revalidatePath(creativeDimensionsPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The creative dimension could not be saved. Try again.' };
  }
}
