'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { insertAngle, updateAngle, type AngleInput } from '@tas/db';
import {
  isAngleFormat,
  validateAngleDraft,
  type AngleDraftField,
  type AngleFormatKey,
} from '@tas/domain/angles';
import { z } from 'zod';

import { withBrandScope } from '@/lib/angles-source';
import { isDemoMode } from '@/lib/demo-mode';
import { anglesPath } from '@/lib/routes';

/**
 * The Angles route's two mutations (PRD §5.6). Both follow `personas/actions.ts` exactly:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup or connection — the demo
 *    deployment is unauthenticated, so a write must never reach a database;
 * 2. parse the submitted `FormData` with zod, which owns the *shape*: which keys exist, that a
 *    format is one of the four in the shared vocabulary, and that an empty text field is stored as
 *    NULL rather than as an empty string, so "unset" has one representation;
 * 3. run `validateAngleDraft` from `@tas/domain/angles`, which owns the *rules* — name, persona,
 *    at least one format, every non-blank ad-inspiration entry a real link. The panel calls the same
 *    function to disable its save, and a disabled button is a courtesy, not a guarantee, so the
 *    action re-runs it. No rule is restated here;
 * 4. write through the scoped `@tas/db` functions, which put `brand_id` on every statement;
 * 5. revalidate the page and return a typed result. Neither ever throws to the client.
 *
 * Type, Potential, Winning, Internal Notes and Client Notes exist on the row but are out of scope
 * for this page, so neither action reads or writes them: an update patches only the columns below
 * and leaves the rest of the row exactly as it was.
 */

/**
 * The fields the panel can show a message under: the four the domain validator knows, plus the four
 * this page writes that carry no rule. Derived from `AngleDraftField` so the two cannot drift.
 */
export type AngleFieldName = AngleDraftField | 'productId' | 'description' | 'painPoints' | 'usp';

export interface AngleActionSuccess {
  readonly ok: true;
  readonly id: string;
  /** Changes with every save, so the panel can react to two successful saves in a row. */
  readonly savedAt: number;
}

export interface AngleActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<AngleFieldName, string>>;
}

export type AngleActionResult = AngleActionSuccess | AngleActionFailure;

/** The message the panel shows when there is no database to write to. */
const DEMO_REFUSAL = 'Sign in required to save changes.';

/** A text column: trimmed, and empty means NULL. */
const text = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable();

/** A nullable link column: the `<select>`'s "None" option submits an empty string. */
const link = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable();

/**
 * One checked format. The vocabulary is `isAngleFormat` from `@tas/domain/angles` (which is the
 * `angleFormats` pg enum tuple), never a literal written here: a value outside it is a tampered
 * submission, not a strategist's mistake, so it is rejected rather than quietly dropped.
 */
const format = z
  .string()
  .refine(isAngleFormat, 'That is not one of the four formats.')
  .transform((value): AngleFormatKey => value);

/**
 * Shape only. Every rule a strategist can break lives in `validateAngleDraft`, so `name` has no
 * `min` here and the link arrays are not checked for `http(s)` — that is step 3.
 */
const angleSchema = z.object({
  name: z.string().trim(),
  personaId: link,
  productId: link,
  description: text,
  painPoints: text,
  usp: text,
  formats: z.array(format),
  adInspoLinks: z.array(z.string().trim()),
});

type AngleFormValues = z.infer<typeof angleSchema>;

/**
 * `FormData` to the schema's input. `formats` and `adInspoLinks` are repeated entries (a checkbox
 * group and one input per link row), so they are read with `getAll`; everything else is a single
 * value, and a missing key becomes `''` so the schema's "empty means NULL" branch runs.
 */
function fieldsOf(formData: FormData): Record<string, unknown> {
  const single = (key: string): string => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : '';
  };
  const many = (key: string): string[] =>
    formData.getAll(key).filter((value) => typeof value === 'string');

  return {
    name: single('name'),
    personaId: single('personaId'),
    productId: single('productId'),
    description: single('description'),
    painPoints: single('painPoints'),
    usp: single('usp'),
    formats: many('formats'),
    adInspoLinks: many('adInspoLinks'),
  };
}

function failureFrom(error: z.ZodError): AngleActionFailure {
  const fieldErrors: Partial<Record<AngleFieldName, string>> = {};
  for (const issue of error.issues) {
    const [first] = issue.path;
    if (typeof first === 'string') {
      fieldErrors[first as AngleFieldName] ??= issue.message;
    }
  }
  return { ok: false, error: 'Some fields need attention before this can be saved.', fieldErrors };
}

/** The domain's messages, in the same envelope zod's take. */
function failureFromDraft(
  fieldErrors: Readonly<Partial<Record<AngleDraftField, string>>>,
): AngleActionFailure {
  return { ok: false, error: 'Some fields need attention before this can be saved.', fieldErrors };
}

/** The columns this page writes. A blank ad-inspiration row is an empty input, never a stored ''. */
function toInput(values: AngleFormValues): AngleInput {
  return {
    name: values.name,
    personaId: values.personaId,
    productId: values.productId,
    description: values.description,
    painPoints: values.painPoints,
    usp: values.usp,
    formats: values.formats,
    adInspoLinks: values.adInspoLinks.filter((entry) => entry !== ''),
  };
}

/** Who is writing. Live mode only: in demo mode both actions have already returned. */
async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/** Shape (zod), then rules (the domain function). Either one failing ends the write. */
function parse(formData: FormData): { values: AngleInput } | AngleActionFailure {
  const parsed = angleSchema.safeParse(fieldsOf(formData));
  if (!parsed.success) {
    return failureFrom(parsed.error);
  }

  const draft = validateAngleDraft({
    name: parsed.data.name,
    personaId: parsed.data.personaId,
    formats: parsed.data.formats,
    adInspoLinks: parsed.data.adInspoLinks,
  });
  if (!draft.ok) {
    return failureFromDraft(draft.fieldErrors);
  }

  return { values: toInput(parsed.data) };
}

/** Creates an angle in the actor's brand. */
export async function createAngleAction(
  _previous: AngleActionResult | null,
  formData: FormData,
): Promise<AngleActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_REFUSAL };
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
      insertAngle(db, brandId, parsed.values, actor),
    );
    if (created === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    revalidatePath(anglesPath);
    return { ok: true, id: created.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The angle could not be saved. Try again.' };
  }
}

/** Patches one angle of the actor's brand; another brand's id simply never resolves. */
export async function updateAngleAction(
  _previous: AngleActionResult | null,
  formData: FormData,
): Promise<AngleActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This angle could not be identified.' };
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
      updateAngle(db, brandId, id, parsed.values, actor),
    );
    if (saved === null) {
      return { ok: false, error: 'That angle is no longer available.' };
    }
    revalidatePath(anglesPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The angle could not be saved. Try again.' };
  }
}
