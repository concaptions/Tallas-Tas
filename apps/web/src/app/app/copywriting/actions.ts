'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  getBriefById,
  getCopyById,
  insertCopy,
  listCopy,
  updateCopy,
  type CopyInput,
  type CopyListRow,
  type Db,
} from '@tas/db';
import {
  COPY_CTA_INITIAL,
  isCopyCta,
  nextCopyNumber,
  validateCopyDraft,
  type CopyDraft,
  type CopyDraftField,
  type CopyDraftValidation,
} from '@tas/domain/copy';
import { COPY_STATUS_INITIAL } from '@tas/domain/state';
import { z } from 'zod';

import { withBrandScope } from '@/lib/copy-source';
import { isDemoMode } from '@/lib/demo-mode';
import { copywritingPath } from '@/lib/routes';

/**
 * The Copywriting route's two mutations (PRD §5.11). Both follow `personas/actions.ts` and
 * `briefs/actions.ts` exactly:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup or connection — the demo
 *    deployment is unauthenticated, so a write must never reach a database;
 * 2. parse the submitted `FormData` with zod, which owns the SHAPE only: which keys exist, that an
 *    empty text field is stored as NULL rather than as an empty string, and — the one thing that is
 *    particular to this form — that a key which was not submitted at all is `undefined` and means
 *    "leave that column exactly as it is", which is different from a key submitted empty;
 * 3. run every RULE through `validateCopyDraft` in `@tas/domain/copy`, the same function the panel
 *    disables its save with. The panel's disabled button is a courtesy, not a guarantee, so the
 *    rules are re-run here against the values that are actually about to be written — and no rule is
 *    restated in this file: not the required headline, not the CTA vocabulary, not the status
 *    vocabulary, and not the character guidance (which is deliberately NOT a rule: PRD §5.11's
 *    ~125 / ~40 / ~27 are tildes, Meta truncates past them rather than rejecting, so an over-long
 *    field is a warning the panel renders and never a refused save);
 * 4. write through the scoped `@tas/db` functions, which put `brand_id` on every statement;
 * 5. revalidate the page and return a typed result. Neither ever throws to the client.
 *
 * THE COPY # IS NEVER SUBMITTED. `copywriting.copy_number` is auto-generated (CLAUDE.md
 * non-negotiable 4): `createCopyAction` computes it with `nextCopyNumber` from `@tas/domain/copy`
 * over the numbers the brand already has, inside the scope, and no action reads a `copyNumber` field
 * from the form. The TITLE is never stored at all — it is `copyTitle` applied to that integer when
 * the table renders.
 *
 * THE UNATTACHED ROW IS ORDINARY, NOT DEGRADED. `creativeBriefId` may be null (CLAUDE.md
 * non-negotiable 5): the panel's "No creative" option submits an empty value and it is stored as
 * NULL. When an id IS submitted it is resolved INSIDE the scope, so a brief belonging to another
 * brand — or to a soft-deleted row — simply never resolves and copy cannot be attached to a creative
 * that is not really there.
 *
 * CLIENT'S COMMENT IS OUT OF SCOPE (ticket). No schema key here reads it, so `client_comment` is
 * never written by either action and a row that carries one keeps it through every save.
 */

/** The fields the panel can show a message under: the domain's draft fields, one vocabulary. */
export type CopyFieldName = CopyDraftField;

export interface CopyActionSuccess {
  readonly ok: true;
  readonly id: string;
  /** Changes with every save, so the panel can react to two successful saves in a row. */
  readonly savedAt: number;
  /**
   * The non-blocking character warnings the write went ahead with, so the panel can keep showing
   * "13 characters over the ~125 guide" on a row that saved. Empty on a save inside every guide.
   */
  readonly warnings: CopyDraftValidation['fieldWarnings'];
}

export interface CopyActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<CopyFieldName, string>>;
}

export type CopyActionResult = CopyActionSuccess | CopyActionFailure;

/** The message the panel shows when there is no database to write to; the tooltip's words. */
const DEMO_REFUSAL = 'Sign in required to save changes.';

const NEEDS_ATTENTION = 'Some fields need attention before this can be saved.';

/**
 * A submitted text value. Trimmed; empty means NULL; ABSENT means `undefined`, which every write
 * below reads as "do not touch this column". That distinction is what lets the panel save the four
 * copy fields without also having to carry a hidden input for the status it does not edit.
 */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .optional();

/**
 * A submitted KEY of a closed vocabulary. Trimmed, and — unlike a text column — an empty submission
 * stays the empty string rather than becoming `null`: "" is not a legal CTA or status and must be
 * refused by `validateCopyDraft`, not quietly read as "leave it alone". Only an ABSENT key means
 * that.
 */
const optionalKey = z.string().trim().optional();

/**
 * Shape only. Every rule is `validateCopyDraft`'s. `copyNumber` is absent on purpose — it is
 * generated, never submitted — and so is `clientComment`, which the client writes, not us.
 */
const copySchema = z.object({
  creativeBriefId: optionalText,
  primaryCopy: optionalText,
  headline: optionalText,
  linkDescription: optionalText,
  cta: optionalKey,
  status: optionalKey,
});

type CopyFormValues = z.infer<typeof copySchema>;

/**
 * `FormData` to the schema's input. A key the form did not submit is left out entirely rather than
 * turned into `''`, so `undefined` survives into `CopyFormValues` and means "unchanged".
 */
function fieldsOf(formData: FormData): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const key of [
    'creativeBriefId',
    'primaryCopy',
    'headline',
    'linkDescription',
    'cta',
    'status',
  ]) {
    if (formData.has(key)) {
      const value = formData.get(key);
      fields[key] = typeof value === 'string' ? value : '';
    }
  }
  return fields;
}

function fieldFailure(fieldErrors: Partial<Record<CopyFieldName, string>>): CopyActionFailure {
  return { ok: false, error: NEEDS_ATTENTION, fieldErrors };
}

function failureFrom(error: z.ZodError): CopyActionFailure {
  const fieldErrors: Partial<Record<CopyFieldName, string>> = {};
  for (const issue of error.issues) {
    const [first] = issue.path;
    if (typeof first === 'string') {
      fieldErrors[first as CopyFieldName] ??= issue.message;
    }
  }
  return fieldFailure(fieldErrors);
}

function parse(formData: FormData): { values: CopyFormValues } | CopyActionFailure {
  const parsed = copySchema.safeParse(fieldsOf(formData));
  return parsed.success ? { values: parsed.data } : failureFrom(parsed.error);
}

/**
 * What the row will hold once this write lands: the submitted values over the ones already there.
 * `current` is null for a create, where "already there" is the column defaults — the first entry of
 * `COPY_STATUS` and of `COPY_CTAS`, both taken from the domain rather than typed here.
 *
 * This is the draft `validateCopyDraft` is asked about, which is the point: the rules are checked
 * against the row as it will be, not against the half of it the form happened to send.
 */
function draftFrom(values: CopyFormValues, current: CopyListRow | null): CopyDraft {
  const keep = <T>(submitted: T | undefined, existing: T): T =>
    submitted === undefined ? existing : submitted;

  return {
    creativeBriefId: keep(values.creativeBriefId, current?.creativeBriefId ?? null),
    primaryCopy: keep(values.primaryCopy, current?.primaryCopy ?? null),
    headline: keep(values.headline, current?.headline ?? null),
    linkDescription: keep(values.linkDescription, current?.linkDescription ?? null),
    cta: keep(values.cta, current?.cta ?? COPY_CTA_INITIAL),
    status: keep(values.status, current?.status ?? COPY_STATUS_INITIAL),
  };
}

/** A draft that passed every rule, as the columns, plus the warnings the write goes ahead with. */
interface CheckedCopy {
  readonly values: Omit<CopyInput, 'copyNumber'>;
  readonly validation: CopyDraftValidation;
}

/**
 * The one gate: `validateCopyDraft` decides, and its `fieldErrors` are the messages. Nothing is
 * decided here.
 *
 * `isCopyCta` is asked again only to NARROW: `CopyDraft.cta` is a `string`, the column's type is
 * `@tas/db`'s `CopyCta`, and the checked union is `@tas/domain`'s `CopyCtaKey` — the same six
 * strings declared once on each side of a dependency edge that deliberately does not exist. A draft
 * that satisfies the validator always satisfies the guard, so the second half of the condition is
 * unreachable rather than a second rule.
 */
function check(draft: CopyDraft): CheckedCopy | CopyActionFailure {
  const validation = validateCopyDraft(draft);
  if (!validation.ok || !isCopyCta(draft.cta)) {
    return fieldFailure(validation.fieldErrors);
  }
  return {
    validation,
    values: {
      creativeBriefId: draft.creativeBriefId,
      primaryCopy: draft.primaryCopy,
      headline: draft.headline,
      linkDescription: draft.linkDescription,
      cta: draft.cta,
      status: draft.status,
    },
  };
}

/** Who is writing. Live mode only: in demo mode both actions have already returned. */
async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/**
 * The submitted creative, resolved in the scope. `null` in is the "No creative" option and needs no
 * lookup; an id that does not resolve is another brand's, or a soft-deleted brief's, and is refused
 * rather than stored.
 */
async function creativeRefusal(
  db: Db,
  brandId: string,
  creativeBriefId: string | null,
): Promise<CopyActionFailure | null> {
  if (creativeBriefId === null) {
    return null;
  }
  const brief = await getBriefById(db, brandId, creativeBriefId);
  return brief === null
    ? fieldFailure({ creativeBriefId: 'That creative is no longer available.' })
    : null;
}

function success(id: string, validation: CopyDraftValidation): CopyActionSuccess {
  return { ok: true, id, savedAt: Date.now(), warnings: validation.fieldWarnings };
}

/**
 * Creates a copy row in the actor's brand.
 *
 * The Copy # comes from `nextCopyNumber` over the brand's existing rows, read inside the scope, so
 * it is one past the highest number the brand has ever used and never re-uses a soft-deleted row's.
 */
export async function createCopyAction(
  _previous: CopyActionResult | null,
  formData: FormData,
): Promise<CopyActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_REFUSAL };
  }

  const parsed = parse(formData);
  if ('ok' in parsed) {
    return parsed;
  }

  // A create has no row to merge with, so the whole draft is known here — before the actor lookup
  // and before a connection, exactly as the demo refusal is.
  const draft = draftFrom(parsed.values, null);
  const checked = check(draft);
  if ('ok' in checked) {
    return checked;
  }

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }

    const outcome = await withBrandScope(async (db, brandId) => {
      const refusal = await creativeRefusal(db, brandId, draft.creativeBriefId);
      if (refusal !== null) {
        return refusal;
      }
      const existing = await listCopy(db, brandId);
      const created = await insertCopy(
        db,
        brandId,
        {
          ...checked.values,
          copyNumber: nextCopyNumber(existing.map((row) => row.copyNumber)),
        },
        actor,
      );
      return success(created.id, checked.validation);
    });

    if (outcome === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    if (outcome.ok) {
      revalidatePath(copywritingPath);
    }
    return outcome;
  } catch {
    return { ok: false, error: 'The copy could not be saved. Try again.' };
  }
}

/**
 * Patches one copy row of the actor's brand; another brand's id simply never resolves.
 *
 * The rules run against the row MERGED with the submission, inside the scope, because "leave that
 * column as it is" can only be resolved against the stored row — a save of the four copy fields must
 * not be judged, or rewritten, as though it had cleared the status it never sent. The Copy # is the
 * row's own and is never rebuilt: a copy keeps the number it was given.
 */
export async function updateCopyAction(
  _previous: CopyActionResult | null,
  formData: FormData,
): Promise<CopyActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This copy could not be identified.' };
  }

  const parsed = parse(formData);
  if ('ok' in parsed) {
    return parsed;
  }
  const { values } = parsed;

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }

    const outcome = await withBrandScope(async (db, brandId) => {
      const current = await getCopyById(db, brandId, id);
      if (current === null) {
        return { ok: false as const, error: 'That copy is no longer available.' };
      }

      const draft = draftFrom(values, current);
      const checked = check(draft);
      if ('ok' in checked) {
        return checked;
      }

      const refusal = await creativeRefusal(db, brandId, draft.creativeBriefId);
      if (refusal !== null) {
        return refusal;
      }

      const saved = await updateCopy(db, brandId, id, checked.values, actor);
      return saved === null
        ? { ok: false as const, error: 'That copy is no longer available.' }
        : success(saved.id, checked.validation);
    });

    if (outcome === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    if (outcome.ok) {
      revalidatePath(copywritingPath);
    }
    return outcome;
  } catch {
    return { ok: false, error: 'The copy could not be saved. Try again.' };
  }
}
