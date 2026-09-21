'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { applyApprovedPromotion, listTeam, setPromotionRequestStatus } from '@tas/db';
import { canReviewPromotion, promotionStatusLabel, type PromotionStatusKey } from '@tas/domain';
import { z } from 'zod';

import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { withAgencyScope } from '@/lib/propagation-source';
import { propagationPath } from '@/lib/routes';
import { teamPageActorFrom } from '@/lib/team-actor';

/**
 * The Propagation route's two mutations (PRD §5: "request comes in to the ADMIN dashboard to approve
 * everything"). They follow the house pattern of `notifications/actions.ts` and `team/actions.ts`
 * exactly:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup, env read or connection —
 *    the demo deployment is unauthenticated, so a write must never reach a database;
 * 2. validate the submission with zod, with the two owners kept apart: ZOD owns the SHAPE (a uuid,
 *    and a note within a sane length) and `@tas/domain` owns the VOCABULARY (`PromotionStatusKey`,
 *    so neither action writes a status word this repo does not recognise);
 * 3. re-check AUTHORISATION on the server through the domain's `canReviewPromotion` — the same pure
 *    predicate `page.tsx` renders from, over the same `teamPageActorFrom` mapping the Team page uses
 *    — and only then write through the agency-scoped `setPromotionRequestStatus` in `@tas/db`;
 * 4. revalidate the page and return a typed result. Neither ever throws to the client.
 *
 * WHY STEP 3 EXISTS EVEN THOUGH THE PAGE ALREADY GUARDS (ticket criterion 3, "admin only is
 * enforced, not just written"). A disabled button is not a guard: a Server Action is a public HTTP
 * endpoint, and a non-admin who is signed in can post to it without ever loading the page that hid
 * the control. PRD §5 makes approval an ADMIN act because a promotion writes into the TEMPLATE and
 * every brand inherits the result, so the write path asks the question again, itself, on the server.
 * It asks it through `@tas/domain`: no `role === 'admin'` is written here, and the page and the
 * action cannot drift because `canReviewPromotion` and `canSeePropagationPage` are one function.
 *
 * WHY ONE SCOPE AND NOT TWO. Both the roster read (who is asking) and the update (what they settled)
 * run inside a single `withAgencyScope`, so the decision is made and written against the same
 * agency, on the same connection, and there is no window where a second resolve could disagree with
 * the first. The agency scope is also what makes another agency's request unreachable: it simply
 * never resolves, and comes back `null`.
 *
 * WHY A REJECTION NEEDS A NOTE AND AN APPROVAL DOES NOT. Rejecting is the end of the road for the
 * requester — the change stays in their brand and never reaches the template — so the person who
 * raised it is owed a reason, and `review_note` is the column that carries it. An approval speaks
 * for itself: the proposed value is now the template's, which is the answer.
 *
 * WHAT THESE ACTIONS DELIBERATELY CANNOT DO (ticket "out of scope"): apply a promotion to other
 * brands, target particular brands, edit the proposed value, create a request, or undo a decision.
 * There is no third action, and neither of these two takes a value, a brand list or a table name —
 * the only thing a submission carries is WHICH request and, for a rejection, WHY.
 */

export interface PromotionActionSuccess {
  readonly ok: true;
  /** The request settled, so the table can reconcile one row without re-reading the page. */
  readonly requestId: string;
  readonly status: PromotionStatusKey;
  /** `Approved` / `Rejected`, from `@tas/domain` — the page composes no status word of its own. */
  readonly statusLabel: string;
  /** Changes with every decision, so the page can react to two settlements in a row. */
  readonly settledAt: number;
}

export interface PromotionActionFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<PromotionFieldName, string>>;
}

export type PromotionActionResult = PromotionActionSuccess | PromotionActionFailure;

/** The only two things a submission carries, named once so the row and the action agree. */
export type PromotionFieldName = 'request' | 'note';

/**
 * The two decisions, pinned to the domain vocabulary at COMPILE time. `satisfies` is what makes a
 * rename in `PROMOTION_STATUS` a build error here instead of a string that quietly stops matching —
 * the ticket's "no magic strings" rule with a compiler behind it rather than a convention.
 */
const APPROVED = 'approved' satisfies PromotionStatusKey;
const REJECTED = 'rejected' satisfies PromotionStatusKey;

/** How long a review note may be. Long enough for a paragraph, short enough not to be a document. */
const NOTE_LIMIT = 500;

/** Which request. The id is a uuid on every row, so a tampered value fails before anything opens. */
const requestField = z.uuid({ error: 'That request could not be identified.' });

const approveSchema = z.object({
  request: requestField,
  /** An approval may carry a note and usually does not; an empty box means "no note", not an error. */
  note: z
    .string()
    .trim()
    .max(NOTE_LIMIT, { error: `Keep the note under ${String(NOTE_LIMIT)} characters.` })
    .optional(),
});

const rejectSchema = z.object({
  request: requestField,
  note: z
    .string({ error: 'A rejection needs a reason.' })
    .trim()
    .min(1, { error: 'A rejection needs a reason.' })
    .max(NOTE_LIMIT, { error: `Keep the reason under ${String(NOTE_LIMIT)} characters.` }),
});

function failure(
  error: string,
  fieldErrors?: Partial<Record<PromotionFieldName, string>>,
): PromotionActionFailure {
  return fieldErrors === undefined ? { ok: false, error } : { ok: false, error, fieldErrors };
}

/** Turns zod's issues into one message per control, in the shape the row renders. */
function failureFrom(error: z.ZodError, headline: string): PromotionActionFailure {
  const fieldErrors: Partial<Record<PromotionFieldName, string>> = {};
  for (const issue of error.issues) {
    const [first] = issue.path;
    if (first === 'request' || first === 'note') {
      fieldErrors[first] ??= issue.message;
    }
  }
  return failure(headline, fieldErrors);
}

/** `FormData` entries are `FormDataEntryValue | null`; zod sees strings, or nothing. */
function entry(formData: FormData, key: PromotionFieldName): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

/**
 * The one write both actions share: session, authorisation, update, revalidate. Live mode only —
 * the callers refuse in demo mode before they reach it.
 *
 * `reviewNote` is `null` rather than `''` when nobody left one, because the column is nullable and
 * "no note" is an absence, not an empty string somebody typed.
 */
async function settle(
  requestId: string,
  status: PromotionStatusKey,
  reviewNote: string | null,
): Promise<PromotionActionResult> {
  try {
    const { userId } = await auth();
    if (userId === null) {
      return failure('Your session has expired. Sign in again to review this request.');
    }

    /**
     * Two sentinels rather than `null`, because `withAgencyScope` already spends `null` on "this
     * workspace has no agency yet". A callback that also answered `null` for "no such request"
     * would make three different outcomes indistinguishable at the call site, and the visitor would
     * read the wrong sentence for two of them.
     */
    const settled = await withAgencyScope(async (db, agencyId) => {
      const team = await listTeam(db, agencyId);
      const actor = teamPageActorFrom(team.find((row) => row.clerkUserId === userId));
      if (!canReviewPromotion(actor)) {
        return 'forbidden' as const;
      }
      const row = await setPromotionRequestStatus(
        db,
        agencyId,
        requestId,
        status,
        userId,
        reviewNote,
      );
      if (row === null) return 'missing' as const;

      if (status === APPROVED) {
        await applyApprovedPromotion(db, agencyId, row.id, userId);
      }

      return row;
    });

    if (settled === null) {
      return failure('This workspace has no agency yet.');
    }
    if (settled === 'forbidden') {
      return failure('Only an agency Admin can approve or reject a promotion request.');
    }
    if (settled === 'missing') {
      return failure('That request is no longer waiting for a decision.');
    }

    revalidatePath(propagationPath);
    return {
      ok: true,
      requestId: settled.id,
      status,
      statusLabel: promotionStatusLabel(status),
      settledAt: Date.now(),
    };
  } catch {
    return failure('That decision could not be saved. Try again.');
  }
}

/**
 * Approves one pending request: the proposed value becomes the template's answer for that field.
 *
 * Shaped for `useActionState`: `(previous, formData)`.
 */
export async function approvePromotionAction(
  _previous: PromotionActionResult | null,
  formData: FormData,
): Promise<PromotionActionResult> {
  if (isDemoMode()) {
    return failure(DEMO_WRITE_REFUSAL);
  }

  const parsed = approveSchema.safeParse({
    request: entry(formData, 'request'),
    note: entry(formData, 'note'),
  });
  if (!parsed.success) {
    return failureFrom(parsed.error, 'That approval could not be read.');
  }

  const { request, note } = parsed.data;
  return settle(request, APPROVED, note === undefined || note === '' ? null : note);
}

/**
 * Rejects one pending request, with the reason the requester is owed. The change stays in the brand
 * that made it; nothing reaches the template.
 *
 * Shaped for `useActionState`: `(previous, formData)`.
 */
export async function rejectPromotionAction(
  _previous: PromotionActionResult | null,
  formData: FormData,
): Promise<PromotionActionResult> {
  if (isDemoMode()) {
    return failure(DEMO_WRITE_REFUSAL);
  }

  const parsed = rejectSchema.safeParse({
    request: entry(formData, 'request'),
    note: entry(formData, 'note'),
  });
  if (!parsed.success) {
    return failureFrom(parsed.error, 'That rejection could not be read.');
  }

  const { request, note } = parsed.data;
  return settle(request, REJECTED, note);
}
