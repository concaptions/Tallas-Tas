'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { listTeam } from '@tas/db';
import {
  agencyRoles,
  brandRoles,
  canSeeTeamPage,
  internalBrandRoles,
  isInternalBrandRole,
  roleLabel,
  type AgencyRole,
  type BrandRole,
} from '@tas/domain';
import { z } from 'zod';

import { isDemoMode } from '@/lib/demo-mode';
import { teamPath } from '@/lib/routes';
import { teamPageActorFrom } from '@/lib/team-actor';
import { withAgencyScope } from '@/lib/team-source';

/**
 * The Team route's one mutation (PRD §11: "Each person gets their own account").
 *
 * WHAT IT DOES AND DOES NOT DO, said plainly rather than implied. Sending an actual invitation is
 * OUT OF SCOPE for this ticket: there is no `invitations` table, no Clerk organisation-invitation
 * call and no mail transport anywhere in the repo. The contract of this action is therefore to
 * RECORD THE INTENT — refuse in demo mode, validate the email and the role, re-check on the server
 * that the caller is allowed to invite at all, and answer with a typed receipt naming exactly what
 * was accepted and saying that nothing was sent. It writes no row. A UI that claimed otherwise
 * would be lying to the user, and the ticket (`docs/tickets/in-progress/team.md`, criterion 8 and
 * the note below it) says so in the same words.
 *
 * Like every other action in the app it:
 *
 * 1. refuses immediately in DEMO MODE, before any validation, actor lookup or connection — the demo
 *    deployment is unauthenticated, so a write must never reach a database;
 * 2. validates with zod (the email is trimmed and lower-cased, the role must be one of the
 *    vocabularies in `@tas/domain`, never a free string);
 * 3. re-checks authorisation through the domain's `canSeeTeamPage`, the same pure function
 *    `page.tsx` renders from, over the same `teamPageActorFrom` mapping in `@/lib/team-actor` —
 *    the page's guard protects a view, this one protects the write, and neither writes
 *    `role === 'admin'` by hand;
 * 4. returns a typed result and never throws to the client.
 */
export interface InviteMemberSuccess {
  readonly ok: true;
  /** Normalised: trimmed and lower-cased, the form exactly as it was accepted. */
  readonly email: string;
  readonly role: InvitableRole;
  /** Changes with every submission, so a panel can react to two in a row. */
  readonly recordedAt: number;
  /** The honest confirmation copy: the intent, and the fact that no mail went out. */
  readonly message: string;
}

export interface InviteMemberFailure {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Partial<Record<InviteFieldName, string>>;
}

export type InviteMemberResult = InviteMemberSuccess | InviteMemberFailure;

/** The two form controls, named once so the panel and the action cannot disagree. */
export type InviteFieldName = 'email' | 'role';

/**
 * The roles a person can be invited as: every agency role, plus every INTERNAL brand role.
 *
 * `client` is deliberately absent and is rejected by name below. A client is not staff — PRD §11
 * makes them the one externally visible role, and they reach the platform through the client track,
 * not through the agency roster. Derived from the domain tuples rather than typed out, so a role
 * added to either vocabulary is invitable (or, for a new external role, has to be excluded here) on
 * the next build instead of silently falling through validation.
 */
export type InvitableRole = AgencyRole | Exclude<BrandRole, 'client'>;

const [firstAgencyRole, ...otherAgencyRoles] = agencyRoles;
const invitableRoles = [firstAgencyRole, ...otherAgencyRoles, ...internalBrandRoles] as const;

/**
 * The externally visible brand roles — `client`, today — derived through the domain's
 * `isInternalBrandRole` rather than typed as a literal, so the refusal below names whatever PRD §11
 * calls the outside world. They earn their own message because "client" is a plausible thing for an
 * admin to type, and "that is not a role on this team" would be a confusing answer to it.
 */
const externalRoles: readonly string[] = brandRoles.filter((role) => !isInternalBrandRole(role));

/** The message the button shows when there is no session to write with. Criterion 8's tooltip. */
const DEMO_REFUSAL = 'Sign in required to save changes.';

const inviteSchema = z.object({
  email: z
    .string({ error: 'An invitation needs an email address.' })
    .trim()
    .toLowerCase()
    .min(1, { error: 'An invitation needs an email address.' })
    .pipe(z.email({ error: 'That does not look like an email address.' })),
  role: z
    .string({ error: 'Pick a role for this person.' })
    .trim()
    .min(1, { error: 'Pick a role for this person.' })
    .refine((value) => !externalRoles.includes(value), {
      error: 'A client is invited through the client track, not here.',
    })
    .pipe(z.enum(invitableRoles, { error: 'That is not a role on this team.' })),
});

/** `FormData` entries are `FormDataEntryValue | null`; zod sees strings, or nothing. */
function fieldsOf(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, typeof value === 'string' ? value : '']),
  );
}

function failureFrom(error: z.ZodError): InviteMemberFailure {
  const fieldErrors: Partial<Record<InviteFieldName, string>> = {};
  for (const issue of error.issues) {
    const [first] = issue.path;
    if (first === 'email' || first === 'role') {
      fieldErrors[first] ??= issue.message;
    }
  }
  return { ok: false, error: 'Some fields need attention before this can be sent.', fieldErrors };
}

/**
 * Records the intent to invite somebody to the agency. Never sends mail; see the module comment.
 *
 * Shaped for `useActionState`: `(previous, formData)`.
 */
export async function inviteMemberAction(
  _previous: InviteMemberResult | null,
  formData: FormData,
): Promise<InviteMemberResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_REFUSAL };
  }

  const parsed = inviteSchema.safeParse(fieldsOf(formData));
  if (!parsed.success) {
    return failureFrom(parsed.error);
  }
  const { email, role } = parsed.data;

  try {
    const { userId } = await auth();
    if (userId === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to invite someone.' };
    }

    const allowed = await withAgencyScope(async (db, agencyId) => {
      const team = await listTeam(db, agencyId);
      return canSeeTeamPage(teamPageActorFrom(team.find((row) => row.clerkUserId === userId)));
    });
    if (allowed === null) {
      return { ok: false, error: 'This workspace has no agency yet.' };
    }
    if (!allowed) {
      return { ok: false, error: 'Only an Admin or a Client Success Manager can invite someone.' };
    }

    revalidatePath(teamPath);
    return {
      ok: true,
      email,
      role,
      recordedAt: Date.now(),
      message: `Noted: ${email} as ${roleLabel(role)}. Invitations are not sent yet, so nothing has left the app.`,
    };
  } catch {
    return { ok: false, error: 'The invitation could not be recorded. Try again.' };
  }
}
