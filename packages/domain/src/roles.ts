/**
 * Role and brand-status vocabularies (PRD §4, §6). Every route guard, seed script and UI label reads
 * these constants; a role written as a string literal anywhere else is a defect.
 */

/** Clerk organisation roles on the agency org. */
export const agencyRoles = ['admin', 'member'] as const;
export type AgencyRole = (typeof agencyRoles)[number];

/** Per-brand memberships. `client` is the only externally visible role. */
export const brandRoles = [
  'csm',
  'strategist',
  'video_editor',
  'designer',
  'media_buyer',
  'client',
] as const;
export type BrandRole = (typeof brandRoles)[number];

/** Everything except `client`: the roles allowed to see internal statuses, budgets and costs. */
export type InternalBrandRole = Exclude<BrandRole, 'client'>;
export const internalBrandRoles: readonly InternalBrandRole[] = brandRoles.filter(
  (role): role is InternalBrandRole => role !== 'client',
);

export const brandStatuses = ['active', 'paused', 'archived'] as const;
export type BrandStatus = (typeof brandStatuses)[number];

export function isInternalBrandRole(role: BrandRole): role is InternalBrandRole {
  return role !== 'client';
}
