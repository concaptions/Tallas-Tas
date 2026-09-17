'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { getCreatorById, updateCreator, type CreatorInput, type CreatorListRow } from '@tas/db';
import { partnershipExpiresOn } from '@tas/domain/creators';
import {
  isCreatorAssetsStatus,
  isCreatorInternalStatus,
  isCreatorStatus,
  isPartnershipActivity,
  PARTNERSHIP_ACTIVITY_ACTIVE,
} from '@tas/domain/state';
import { z } from 'zod';

import { isDemoMode } from '@/lib/demo-mode';
import { ugcPath } from '@/lib/routes';
import { withBrandScope } from '@/lib/ugc-source';

/**
 * The UGC Management route's mutation (PRD §5.8 and §5.8.1). It follows `personas/actions.ts` and
 * `copywriting/actions.ts` exactly:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup or connection — the demo
 *    deployment is unauthenticated, so a write must never reach a database. The UI pairs that
 *    refusal with `DisabledWrite` + `disabledWriteClassName` from `@tas/ui`, so the control is
 *    visibly unavailable as well as refused;
 * 2. parse the submitted `FormData` with zod, which owns the SHAPE only: which keys exist, that an
 *    empty text field is stored as NULL rather than as an empty string, and that a key which was not
 *    submitted at all is `undefined` and means "leave that column exactly as it is". That last
 *    distinction is what lets the Creators tab save one status track without also having to carry
 *    hidden inputs for the other two and for every partnership field;
 * 3. run the vocabularies and the one cross-field rule through `@tas/domain` — the three status
 *    tracks and the activity vocabulary are `isCreatorStatus` / `isCreatorInternalStatus` /
 *    `isCreatorAssetsStatus` / `isPartnershipActivity`, and whether a partnership even HAS a window
 *    is `partnershipExpiresOn`. No status key, no label and no day arithmetic is written in this
 *    file (CLAUDE.md non-negotiables 2 and "every mutation goes through a domain function");
 * 4. write through the scoped `@tas/db` functions, which put `brand_id` on every statement, so
 *    another brand's creator id simply never resolves;
 * 5. revalidate the page and return a typed result. It never throws to the client.
 *
 * THE THREE TRACKS ARE INDEPENDENT. §5.8's internal creator status, client status and internal
 * assets status move on their own schedules and are submitted on their own; nothing here derives one
 * from another. The client-facing track is the only one a client interface ever renders
 * (non-negotiable 10), and it is stored in exactly the same way as the two internal ones.
 *
 * EXPIRY IS NEVER STORED. An activation date, a period and an extension are written; the date
 * permission lapses is computed by `@tas/domain/creators` wherever it is needed. The only thing this
 * action asks that function is whether the three inputs make a window at all, which is the rule
 * §5.8.1 cares about: a partnership marked Active that nobody can compute a lapse date for is the
 * exact failure the Slack reminder used to miss.
 */

/** Every field this action accepts, and the only keys a `fieldErrors` map can carry. */
export type UgcFieldName = keyof z.infer<typeof creatorSchema>;

export interface UgcActionSuccess {
  readonly ok: true;
  readonly id: string;
  /** Changes with every save, so the page can react to two successful saves in a row. */
  readonly savedAt: number;
}

export interface UgcActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<UgcFieldName, string>>;
}

export type UgcActionResult = UgcActionSuccess | UgcActionFailure;

/** The message the page shows when there is no database to write to; the tooltip's words. */
const DEMO_REFUSAL = 'Sign in required to save changes.';

const NEEDS_ATTENTION = 'Some fields need attention before this can be saved.';

/**
 * A submitted text value. Trimmed; empty means NULL; ABSENT means `undefined`, which every write
 * below reads as "do not touch this column".
 */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .optional();

/**
 * A submitted KEY of a closed vocabulary. Unlike a text column an empty submission stays `''`: it is
 * not a legal status and must be refused by the vocabulary check, not quietly read as "leave it
 * alone". Only an ABSENT key means that.
 */
const optionalKey = z.string().trim().optional();

/**
 * A boolean column. `'true'` / `'false'` and nothing else — a bare HTML checkbox submits `'on'` when
 * checked and NOTHING when unchecked, and "nothing" already means "unchanged" here, so the form
 * carries the value explicitly rather than letting an unticked box silently mean false.
 */
const optionalFlag = z
  .string()
  .trim()
  .refine((value) => value === 'true' || value === 'false', 'That is not a yes or a no.')
  .transform((value) => value === 'true')
  .optional();

/**
 * "Continue Working With?" (§5.8.1) is a THREE-state question — yes, no, and the state most rows sit
 * in: nobody has decided. An empty submission is that third state and is stored as NULL, which is
 * why this cannot be `optionalFlag`.
 */
const optionalTriState = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || value === 'true' || value === 'false',
    'That is not a yes, a no, or undecided.',
  )
  .transform((value) => (value === '' ? null : value === 'true'))
  .optional();

/** How many whole days a window runs for (30/60/90). Empty means NULL: no window was ever agreed. */
const optionalDays = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^\d+$/u.test(value),
    'That needs to be a whole number of days.',
  )
  .transform((value) => (value === '' ? null : Number.parseInt(value, 10)))
  .optional();

/**
 * The extension, which is the same count of days with one difference: the column is NOT NULL
 * DEFAULT 0, so an empty submission is ZERO rather than NULL. That is what keeps the expiry
 * arithmetic total — "no extension" adds no days instead of making the lapse date unknowable.
 */
const optionalExtension = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^\d+$/u.test(value),
    'That needs to be a whole number of days.',
  )
  .transform((value) => (value === '' ? 0 : Number.parseInt(value, 10)))
  .optional();

/**
 * Whole US DOLLARS, not cents (`schema/creators.ts` says why the column is an integer). Empty means
 * NULL — an unagreed price, which is not the same as a price of zero.
 */
const optionalDollars = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^\d+$/u.test(value),
    'That needs to be a whole dollar amount.',
  )
  .transform((value) => (value === '' ? null : Number.parseInt(value, 10)))
  .optional();

/** The activation instant, submitted as an ISO date. Empty means NULL: never whitelisted. */
const optionalDate = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || !Number.isNaN(Date.parse(value)),
    'That is not a date this form can read.',
  )
  .transform((value) => (value === '' ? null : new Date(value)))
  .optional();

/**
 * Shape only. The three status tracks and the activity are keys here and are checked against
 * `@tas/domain/state` further down, the same way `briefs/actions.ts` checks a status against its
 * track rather than with a `z.enum` over one of them.
 */
const creatorSchema = z.object({
  internalCreatorStatus: optionalKey,
  clientStatus: optionalKey,
  internalAssetsStatus: optionalKey,
  clientNote: optionalText,
  instagramUsername: optionalText,
  forPartnershipAds: optionalFlag,
  partnershipActivity: optionalKey,
  partnershipActivatedAt: optionalDate,
  partnershipPeriodDays: optionalDays,
  continueWorkingWith: optionalTriState,
  extensionDays: optionalExtension,
  partnershipPricePer30Days: optionalDollars,
  partnershipNotes: optionalText,
  facebookProfileUrl: optionalText,
});

type CreatorFormValues = z.infer<typeof creatorSchema>;

/** The submitted keys, in one place: the schema's own, so the two can never drift apart. */
const FIELD_NAMES = Object.keys(creatorSchema.shape) as UgcFieldName[];

/**
 * `FormData` to the schema's input. A key the form did not submit is left out entirely rather than
 * turned into `''`, so `undefined` survives into `CreatorFormValues` and means "unchanged".
 */
function fieldsOf(formData: FormData): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const key of FIELD_NAMES) {
    if (formData.has(key)) {
      const value = formData.get(key);
      fields[key] = typeof value === 'string' ? value : '';
    }
  }
  return fields;
}

function fieldFailure(fieldErrors: Partial<Record<UgcFieldName, string>>): UgcActionFailure {
  return { ok: false, error: NEEDS_ATTENTION, fieldErrors };
}

function failureFrom(error: z.ZodError): UgcActionFailure {
  const fieldErrors: Partial<Record<UgcFieldName, string>> = {};
  for (const issue of error.issues) {
    const [first] = issue.path;
    if (typeof first === 'string') {
      fieldErrors[first as UgcFieldName] ??= issue.message;
    }
  }
  return fieldFailure(fieldErrors);
}

function parse(formData: FormData): { values: CreatorFormValues } | UgcActionFailure {
  const parsed = creatorSchema.safeParse(fieldsOf(formData));
  return parsed.success ? { values: parsed.data } : failureFrom(parsed.error);
}

/**
 * What the row will hold once this write lands: the submitted values over the ones already there.
 * A key the form did not send keeps the row's own value, which is what makes a one-field save safe.
 */
function draftFrom(values: CreatorFormValues, current: CreatorListRow): Partial<CreatorInput> {
  const keep = <T>(submitted: T | undefined, existing: T): T =>
    submitted === undefined ? existing : submitted;

  return {
    internalCreatorStatus: keep(values.internalCreatorStatus, current.internalCreatorStatus),
    clientStatus: keep(values.clientStatus, current.clientStatus),
    internalAssetsStatus: keep(values.internalAssetsStatus, current.internalAssetsStatus),
    clientNote: keep(values.clientNote, current.clientNote),
    instagramUsername: keep(values.instagramUsername, current.instagramUsername),
    forPartnershipAds: keep(values.forPartnershipAds, current.forPartnershipAds),
    partnershipActivity: keep(values.partnershipActivity, current.partnershipActivity),
    partnershipActivatedAt: keep(values.partnershipActivatedAt, current.partnershipActivatedAt),
    partnershipPeriodDays: keep(values.partnershipPeriodDays, current.partnershipPeriodDays),
    continueWorkingWith: keep(values.continueWorkingWith, current.continueWorkingWith),
    extensionDays: keep(values.extensionDays, current.extensionDays),
    partnershipPricePer30Days: keep(
      values.partnershipPricePer30Days,
      current.partnershipPricePer30Days,
    ),
    partnershipNotes: keep(values.partnershipNotes, current.partnershipNotes),
    facebookProfileUrl: keep(values.facebookProfileUrl, current.facebookProfileUrl),
  };
}

/**
 * The four vocabularies, checked against `@tas/domain/state` and against nothing else, for the keys
 * that were actually SUBMITTED. A key the form left out keeps whatever the row already holds and is
 * not re-judged here — it was legal when it was written and nothing in this request touched it.
 *
 * This runs before the actor lookup and before a connection, like the demo refusal, because an
 * unknown status is a tampered submission rather than a state of the database: there is nothing a
 * row could say that would make it acceptable.
 */
function checkVocabularies(values: CreatorFormValues): UgcActionFailure | null {
  const fieldErrors: Partial<Record<UgcFieldName, string>> = {};
  const { internalCreatorStatus, clientStatus, internalAssetsStatus, partnershipActivity } = values;

  if (internalCreatorStatus !== undefined && !isCreatorInternalStatus(internalCreatorStatus)) {
    fieldErrors.internalCreatorStatus = 'That is not one of the internal creator statuses.';
  }
  if (clientStatus !== undefined && !isCreatorStatus(clientStatus)) {
    fieldErrors.clientStatus = 'That is not one of the client statuses.';
  }
  if (internalAssetsStatus !== undefined && !isCreatorAssetsStatus(internalAssetsStatus)) {
    fieldErrors.internalAssetsStatus = 'That is not one of the assets statuses.';
  }
  if (partnershipActivity !== undefined && !isPartnershipActivity(partnershipActivity)) {
    fieldErrors.partnershipActivity = 'That is not one of the three partnership activities.';
  }

  return Object.keys(fieldErrors).length > 0 ? fieldFailure(fieldErrors) : null;
}

/**
 * The one cross-field rule, asked of the domain: a partnership the team has marked ACTIVE must have
 * a window — an activation date and a period — because "active until when?" is the whole of §5.8.1.
 * `partnershipExpiresOn` answers that from the MERGED row, so the action never restates the
 * arithmetic and a row saved as Active is always a row the countdown, the highlight and the 25-day
 * reminder can read. Every other activity (Not Active, Ended) needs nothing.
 *
 * Merged, so it can only run inside the scope: a form that submits the activity alone must be judged
 * against the dates the row already carries, not against the half of it the form happened to send.
 */
function checkWindow(draft: Partial<CreatorInput>): UgcActionFailure | null {
  const fieldErrors: Partial<Record<UgcFieldName, string>> = {};

  if (
    draft.partnershipActivity === PARTNERSHIP_ACTIVITY_ACTIVE &&
    partnershipExpiresOn({
      activatedAt: draft.partnershipActivatedAt ?? null,
      periodDays: draft.partnershipPeriodDays ?? null,
      extensionDays: draft.extensionDays ?? 0,
    }) === null
  ) {
    fieldErrors.partnershipActivatedAt =
      'An active partnership needs an activation date and a period, or it can never be shown to expire.';
  }

  return Object.keys(fieldErrors).length > 0 ? fieldFailure(fieldErrors) : null;
}

/** Who is writing. Live mode only: in demo mode the action has already returned. */
async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/**
 * Patches one creator of the actor's brand: any of the three status tracks, the client's note and
 * any of the §5.8.1 partnership fields, in one write.
 *
 * The rules run against the row MERGED with the submission, inside the scope, because "leave that
 * column as it is" can only be resolved against the stored row — a save of the client status must
 * not be judged, or rewritten, as though it had cleared the partnership it never sent.
 */
export async function updateCreatorAction(
  _previous: UgcActionResult | null,
  formData: FormData,
): Promise<UgcActionResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_REFUSAL };
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'This creator could not be identified.' };
  }

  const parsed = parse(formData);
  if ('ok' in parsed) {
    return parsed;
  }
  const { values } = parsed;

  const unknownKey = checkVocabularies(values);
  if (unknownKey !== null) {
    return unknownKey;
  }

  try {
    const actor = await actorId();
    if (actor === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }

    const outcome = await withBrandScope(async (db, brandId) => {
      const current = await getCreatorById(db, brandId, id);
      if (current === null) {
        return { ok: false as const, error: 'That creator is no longer available.' };
      }

      const draft = draftFrom(values, current);
      const refusal = checkWindow(draft);
      if (refusal !== null) {
        return refusal;
      }

      const saved = await updateCreator(db, brandId, id, draft, actor);
      return saved === null
        ? { ok: false as const, error: 'That creator is no longer available.' }
        : { ok: true as const, id: saved.id, savedAt: Date.now() };
    });

    if (outcome === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    if (outcome.ok) {
      revalidatePath(ugcPath);
    }
    return outcome;
  } catch {
    return { ok: false, error: 'The creator could not be saved. Try again.' };
  }
}
