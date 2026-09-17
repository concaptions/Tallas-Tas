export * from './role-labels';
export * from './access';
export * from './last-active';
// The two source label maps and `roleLabel` itself live in `../roles`, beside the `agencyRoles` /
// `brandRoles` tuples they are keyed on, because every route guard and seed script in the repo reads
// that file. Re-exported here so the Team page can take its whole vocabulary — labels, tones, the
// access rule, the last-active phrase — from one import.
export { AGENCY_ROLE_LABELS, BRAND_ROLE_LABELS, roleLabel } from '../roles';
export type { AgencyRole, BrandRole, Role } from '../roles';
