import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Every enum the tenancy tables use, defined once. The `as const` arrays are the single list; the pg
 * enums and the TypeScript unions below derive from them, so `packages/domain` imports the union (or
 * the array, to iterate) instead of retyping the values. PRD §11.
 */

/** Agency-level role (`memberships.role`): admin sees every brand, member sees assigned brands. */
export const agencyRoles = ['admin', 'member'] as const;
export type AgencyRole = (typeof agencyRoles)[number];
export const agencyRoleEnum = pgEnum('agency_role', agencyRoles);

/** Per-brand role (`brand_assignments.role`), the PRD §11 table minus Admin (an agency role). */
export const brandRoles = [
  'csm',
  'strategist',
  'video_editor',
  'designer',
  'media_buyer',
  'client',
] as const;
export type BrandRole = (typeof brandRoles)[number];
export const brandRoleEnum = pgEnum('brand_role', brandRoles);

/** Lifecycle of a brand (`brands.status`). */
export const brandStatuses = ['active', 'paused', 'archived'] as const;
export type BrandStatus = (typeof brandStatuses)[number];
export const brandStatusEnum = pgEnum('brand_status', brandStatuses);
