'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { insertAiCharacter, updateAiCharacter, type AiCharacterInput } from '@tas/db';
import { z } from 'zod';

import { withBrandScope } from '@/lib/ai-characters-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { aiCharactersPath } from '@/lib/routes';

import { AI_CHARACTER_STATUSES, type AiCharacterFieldName } from './fields';

/**
 * The AI Characters route's two mutations. Both:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup or connection — the demo
 *    deployment is unauthenticated, so a write must never reach a database;
 * 2. validate the twelve fields with zod (an empty text field is stored as NULL, never as an empty
 *    string, so "unset" has one representation);
 * 3. write through the scoped `@tas/db` functions, which put `brand_id` on every statement;
 * 4. revalidate the page and return a typed result. Neither ever throws to the client.
 *
 * Shaped exactly like `personas/actions.ts` and `campaigns/actions.ts`.
 */
export interface AiCharacterActionSuccess {
  readonly ok: true;
  readonly id: string;
  /** Changes with every save, so the panel can react to two successful saves in a row. */
  readonly savedAt: number;
}

export interface AiCharacterActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<AiCharacterFieldName, string>>;
}

export type AiCharacterActionResult = AiCharacterActionSuccess | AiCharacterActionFailure;

/** A text column: trimmed, and empty means NULL. */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable();

/** `status` is free text in the schema, but only these three values are ever written from the UI. */
const optionalStatus = z
  .union([z.enum(AI_CHARACTER_STATUSES), z.literal('')])
  .nullish()
  .transform((value) => (value === '' || value === undefined ? null : value));

/** The twelve fields. `name` is the only required one; a character is filled over several sittings. */
const aiCharacterSchema = z.object({
  name: z.string().trim().min(1, 'An AI character needs a name.'),
  status: optionalStatus,
  attachments: optionalText,
  basicInfo: optionalText,
  toneOfVoice: optionalText,
  voiceLink: optionalText,
  personalityTraits: optionalText,
  appearance: optionalText,
  traitsAndHabits: optionalText,
  hobbiesAndLifestyle: optionalText,
  workAndBackground: optionalText,
  whyPromotesBrand: optionalText,
});

/** `FormData` entries are `FormDataEntryValue | null`; zod sees strings, or nothing. */
function fieldsOf(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(
    [...formData.entries()]
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => [key, typeof value === 'string' ? value : '']),
  );
}

function failureFrom(error: z.ZodError): AiCharacterActionFailure {
  const fieldErrors: Partial<Record<AiCharacterFieldName, string>> = {};
  for (const issue of error.issues) {
    const [first] = issue.path;
    if (typeof first === 'string') {
      fieldErrors[first as AiCharacterFieldName] ??= issue.message;
    }
  }
  return { ok: false, error: 'Some fields need attention before this can be saved.', fieldErrors };
}

/** Who is writing. Live mode only: in demo mode both actions have already returned. */
async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

function parse(formData: FormData): { values: AiCharacterInput } | AiCharacterActionFailure {
  const parsed = aiCharacterSchema.safeParse(fieldsOf(formData));
  return parsed.success ? { values: parsed.data } : failureFrom(parsed.error);
}

/** Creates an AI character in the actor's brand. */
export async function createAiCharacterAction(
  _previous: AiCharacterActionResult | null,
  formData: FormData,
): Promise<AiCharacterActionResult> {
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
      insertAiCharacter(db, brandId, parsed.values, actor),
    );
    if (created === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    revalidatePath(aiCharactersPath);
    return { ok: true, id: created.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The AI character could not be saved. Try again.' };
  }
}

/** Patches one AI character of the actor's brand; another brand's id simply never resolves. */
export async function updateAiCharacterAction(
  _previous: AiCharacterActionResult | null,
  formData: FormData,
): Promise<AiCharacterActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This AI character could not be identified.' };
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
      updateAiCharacter(db, brandId, id, parsed.values, actor),
    );
    if (saved === null) {
      return { ok: false, error: 'That AI character is no longer available.' };
    }
    revalidatePath(aiCharactersPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The AI character could not be saved. Try again.' };
  }
}
