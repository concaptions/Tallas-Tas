'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { awarenessStages, insertPersona, updatePersona, type PersonaInput } from '@tas/db';
import { z } from 'zod';

import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { withBrandScope } from '@/lib/personas-source';
import { personasPath } from '@/lib/routes';

import type { PersonaFieldName } from './fields';

/**
 * The Personas route's two mutations. Both:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup or connection — the demo
 *    deployment is unauthenticated, so a write must never reach a database;
 * 2. validate the fourteen PRD §5.4 fields with zod (an empty text field is stored as NULL, never
 *    as an empty string, so "unset" has one representation);
 * 3. write through the scoped `@tas/db` functions, which put `brand_id` on every statement;
 * 4. revalidate the page and return a typed result. Neither ever throws to the client.
 */
export interface PersonaActionSuccess {
  readonly ok: true;
  readonly id: string;
  /** Changes with every save, so the panel can react to two successful saves in a row. */
  readonly savedAt: number;
}

export interface PersonaActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<PersonaFieldName, string>>;
}

export type PersonaActionResult = PersonaActionSuccess | PersonaActionFailure;

/** A text column: trimmed, and empty means NULL. */
const text = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable();

/** The fourteen fields. `name` is the only required one; a persona is filled over several sittings. */
const personaSchema = z.object({
  name: z.string().trim().min(1, 'A persona needs a name.'),
  dayInTheLife: text,
  demographic: text,
  psychographic: text,
  coreDesires: text,
  successFactors: text,
  successTransformation: text,
  painPoints: text,
  perceivedBarriers: text,
  problemChallenge: text,
  stageOfAwareness: z
    .union([z.enum(awarenessStages), z.literal('')])
    .nullish()
    .transform((value) => (value === '' || value === undefined ? null : value)),
  buyingTriggers: text,
  emotionalTriggers: text,
  triggerWords: text,
});

/** `FormData` entries are `FormDataEntryValue | null`; zod sees strings, or nothing. */
function fieldsOf(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(
    [...formData.entries()]
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => [key, typeof value === 'string' ? value : '']),
  );
}

function failureFrom(error: z.ZodError): PersonaActionFailure {
  const fieldErrors: Partial<Record<PersonaFieldName, string>> = {};
  for (const issue of error.issues) {
    const [first] = issue.path;
    if (typeof first === 'string') {
      fieldErrors[first as PersonaFieldName] ??= issue.message;
    }
  }
  return { ok: false, error: 'Some fields need attention before this can be saved.', fieldErrors };
}

/** Who is writing. Live mode only: in demo mode both actions have already returned. */
async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

function parse(formData: FormData): { values: PersonaInput } | PersonaActionFailure {
  const parsed = personaSchema.safeParse(fieldsOf(formData));
  return parsed.success ? { values: parsed.data } : failureFrom(parsed.error);
}

/** Creates a persona in the actor's brand. */
export async function createPersonaAction(
  _previous: PersonaActionResult | null,
  formData: FormData,
): Promise<PersonaActionResult> {
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
      insertPersona(db, brandId, parsed.values, actor),
    );
    if (created === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    revalidatePath(personasPath);
    return { ok: true, id: created.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The persona could not be saved. Try again.' };
  }
}

/** Patches one persona of the actor's brand; another brand's id simply never resolves. */
export async function updatePersonaAction(
  _previous: PersonaActionResult | null,
  formData: FormData,
): Promise<PersonaActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This persona could not be identified.' };
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
      updatePersona(db, brandId, id, parsed.values, actor),
    );
    if (saved === null) {
      return { ok: false, error: 'That persona is no longer available.' };
    }
    revalidatePath(personasPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The persona could not be saved. Try again.' };
  }
}
