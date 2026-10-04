'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  insertAngle,
  syncAnglePersonas,
  syncAngleProducts,
  updateAngle,
  type AngleInput,
} from '@tas/db';
import { angleStatuses } from '@tas/db/schema';
import {
  isAngleFormat,
  validateAngleDraft,
  type AngleDraftField,
  type AngleFormatKey,
} from '@tas/domain/angles';
import { z } from 'zod';

import { withBrandScope } from '@/lib/angles-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
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
 * Type exists on the row but is out of scope for this page (it is set with the Concepts phase), so
 * neither action reads or writes it: an update patches only the columns below and leaves the rest
 * of the row exactly as it was. Status (Gratsi's client-approval track) is written as a key of
 * `angleStatuses`; Potential and Winning (the strategist's own assessment, a different axis) and
 * the two note columns are written as the panel's Assessment and Notes sections submit them.
 */

/**
 * The fields the panel can show a message under: the four the domain validator knows, plus the
 * ones this page writes that carry no rule. Derived from `AngleDraftField` so the two cannot drift.
 */
export type AngleFieldName =
  | AngleDraftField
  | 'personaId'
  | 'productId'
  | 'description'
  | 'painPoints'
  | 'usp'
  | 'status'
  | 'potential'
  | 'winning'
  | 'internalNotes'
  | 'clientNotes'
  | 'briefUrl'
  | 'exactScriptUrl';

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

/** A text column: trimmed, and empty means NULL. */
const text = z
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
 * The Status select, over the KEYS of `angleStatuses` from `@tas/db/schema` — the same tuple the
 * panel renders, so the enum cannot drift from the dropdown. The "Not set" option submits an empty
 * string, stored as NULL because the column is nullable; anything else outside the tuple is a
 * tampered submission and is rejected, as a format outside its vocabulary is.
 */
const status = z
  .union([z.literal(''), z.enum(angleStatuses.map((entry) => entry.key))], {
    error: 'That is not one of the angle statuses.',
  })
  .transform((value) => (value === '' ? null : value));

/**
 * The Winning checkbox. The panel's hidden input carries `"true"` or `"false"`; a form with no key
 * at all reads as not winning, which is the column's default, so a submission that predates the
 * control still parses. Anything else is a tampered submission and is rejected, as a format outside
 * its vocabulary is.
 */
const flag = z
  .union([z.literal(''), z.literal('true'), z.literal('false')], {
    error: 'Winning is either ticked or not.',
  })
  .transform((value) => value === 'true');

/**
 * Shape only. Every rule a strategist can break lives in `validateAngleDraft`, so `name` has no
 * `min` here and the link arrays are not checked for `http(s)` — that is step 3.
 */
/** A link field posts one hidden input per linked id (the LinkField); blanks are dropped. */
const links = z.array(z.string().trim()).transform((ids) => ids.filter((id) => id !== ''));

const angleSchema = z.object({
  name: z.string().trim(),
  personaId: links,
  productId: links,
  description: text,
  painPoints: text,
  usp: text,
  status,
  potential: text,
  winning: flag,
  formats: z.array(format),
  adInspoLinks: z.array(z.string().trim()),
  briefUrl: text,
  exactScriptUrl: text,
  internalNotes: text,
  clientNotes: text,
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
    personaId: many('personaId'),
    productId: many('productId'),
    description: single('description'),
    painPoints: single('painPoints'),
    usp: single('usp'),
    status: single('status'),
    potential: single('potential'),
    winning: single('winning'),
    formats: many('formats'),
    adInspoLinks: many('adInspoLinks'),
    briefUrl: single('briefUrl'),
    exactScriptUrl: single('exactScriptUrl'),
    internalNotes: single('internalNotes'),
    clientNotes: single('clientNotes'),
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

/**
 * The domain's messages, mapped to the form field names the UI uses. The domain validator keys
 * errors under `personaIds` (the draft's array field), but the form's hidden input is named
 * `personaId` (single-select, V0), so the UI's `fieldError('personaId')` needs the error under
 * that key.
 */
function failureFromDraft(
  fieldErrors: Readonly<Partial<Record<AngleDraftField, string>>>,
): AngleActionFailure {
  const mapped: Partial<Record<AngleFieldName, string>> = {};
  for (const [key, message] of Object.entries(fieldErrors)) {
    const uiKey = key === 'personaIds' ? 'personaId' : key === 'productIds' ? 'productId' : key;
    mapped[uiKey as AngleFieldName] = message;
  }
  return {
    ok: false,
    error: 'Some fields need attention before this can be saved.',
    fieldErrors: mapped,
  };
}

/** The columns this page writes. A blank ad-inspiration row is an empty input, never a stored ''. */
function toInput(values: AngleFormValues): AngleInput {
  return {
    name: values.name,
    description: values.description,
    painPoints: values.painPoints,
    usp: values.usp,
    status: values.status,
    potential: values.potential,
    winning: values.winning,
    formats: values.formats,
    adInspoLinks: values.adInspoLinks.filter((entry) => entry !== ''),
    briefUrl: values.briefUrl,
    exactScriptUrl: values.exactScriptUrl,
    internalNotes: values.internalNotes,
    clientNotes: values.clientNotes,
  };
}

/** Who is writing. Live mode only: in demo mode both actions have already returned. */
async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/** Shape (zod), then rules (the domain function). Either one failing ends the write. */
function parse(
  formData: FormData,
): { values: AngleInput; personaIds: string[]; productIds: string[] } | AngleActionFailure {
  const parsed = angleSchema.safeParse(fieldsOf(formData));
  if (!parsed.success) {
    return failureFrom(parsed.error);
  }

  const personaIds = parsed.data.personaId;
  const productIds = parsed.data.productId;

  const draft = validateAngleDraft({
    name: parsed.data.name,
    personaIds,
    productIds,
    formats: parsed.data.formats,
    adInspoLinks: parsed.data.adInspoLinks,
  });
  if (!draft.ok) {
    return failureFromDraft(draft.fieldErrors);
  }

  return { values: toInput(parsed.data), personaIds, productIds };
}

/** Creates an angle in the actor's brand. */
export async function createAngleAction(
  _previous: AngleActionResult | null,
  formData: FormData,
): Promise<AngleActionResult> {
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
    const created = await withBrandScope(async (db, brandId) => {
      const row = await insertAngle(db, brandId, parsed.values, actor);
      await Promise.all([
        syncAnglePersonas(db, row.id, parsed.personaIds),
        syncAngleProducts(db, row.id, parsed.productIds),
      ]);
      return row;
    });
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
    return { ok: false, error: DEMO_WRITE_REFUSAL };
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
    const saved = await withBrandScope(async (db, brandId) => {
      const row = await updateAngle(db, brandId, id, parsed.values, actor);
      if (row !== null) {
        await Promise.all([
          syncAnglePersonas(db, id, parsed.personaIds),
          syncAngleProducts(db, id, parsed.productIds),
        ]);
      }
      return row;
    });
    if (saved === null) {
      return { ok: false, error: 'That angle is no longer available.' };
    }
    revalidatePath(anglesPath);
    return { ok: true, id: saved.id, savedAt: Date.now() };
  } catch {
    return { ok: false, error: 'The angle could not be saved. Try again.' };
  }
}
