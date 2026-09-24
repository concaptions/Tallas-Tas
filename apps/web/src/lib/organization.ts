/**
 * The one message `createBrandAction` returns when the session carries no ACTIVE Clerk
 * Organization, and the predicate the wizard reads it back with.
 *
 * Clerk reports `orgId: undefined` for two different people: one who belongs to no organization at
 * all, and one who belongs to several with none selected. Neither is something a form field can
 * fix, so the wizard answers this particular refusal with an organization picker instead of a
 * validation message (D-003: the organization is the agency's tenant discriminator, so no brand can
 * be created until one is active).
 *
 * The constant lives here rather than in `actions.ts` because that module is `'use server'`, where
 * every export must be an async function — a shared string cannot live in it. Comparing against it
 * is what keeps the wizard from matching on a magic string.
 */
export const NO_ACTIVE_ORGANIZATION_MESSAGE =
  'No active organization. Choose one below, then submit again.';

/** Just enough of an action error for the predicate; the wizard's own type is structurally wider. */
export interface OrganizationErrorLike {
  readonly message: string;
}

/** True when the action refused for want of an active organization, and only then. */
export function needsOrganization(errors: readonly OrganizationErrorLike[]): boolean {
  return errors.some((error) => error.message === NO_ACTIVE_ORGANIZATION_MESSAGE);
}
