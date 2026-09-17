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

/**
 * THE HUMAN LABELS (PRD §11's own table).
 *
 * Two maps rather than one, because the two vocabularies are two different things: `agencyRoles`
 * are the Clerk organisation roles on the TAS org, `brandRoles` are per-brand memberships, and a
 * single merged map would lose which column a key came from. `ROLE_LABELS` in `./team` is the
 * merged view for the callers (the Team table) that genuinely hold one role of either kind.
 *
 * Keyed as `Record<AgencyRole, string>` / `Record<BrandRole, string>` rather than a looser index
 * signature, so adding a role to either tuple above fails the build here until it has a label.
 * `member` is the Clerk default for anyone in the org who is not an admin, and it is reachable on
 * the Team page: it is what a person with no brand assignment falls back to.
 */
export const AGENCY_ROLE_LABELS: Readonly<Record<AgencyRole, string>> = {
  admin: 'Admin',
  member: 'Member',
};

/** PRD §11 verbatim: CSM is a Client Success Manager, strategist is a Creative Strategist. */
export const BRAND_ROLE_LABELS: Readonly<Record<BrandRole, string>> = {
  csm: 'Client Success Manager',
  strategist: 'Creative Strategist',
  video_editor: 'Video Editor',
  designer: 'Designer',
  media_buyer: 'Media Buyer',
  client: 'Client',
};

/**
 * Any role a person can hold: an agency role or a brand role. The Team page's `role` column is this
 * union, because one row can be an agency `admin` and another a brand `csm`.
 *
 * Named `Role` and not `TeamRole` on purpose: `@tas/db` exports a `TeamRole` of exactly this shape
 * for its row type, and two identically-named types imported into one component is the kind of
 * ambiguity that ends in a wrong import. They are structurally the same union.
 */
export type Role = AgencyRole | BrandRole;

function isAgencyRole(role: string): role is AgencyRole {
  return (agencyRoles as readonly string[]).includes(role);
}

function isBrandRole(role: string): role is BrandRole {
  return (brandRoles as readonly string[]).includes(role);
}

/**
 * The label for a role key, from whichever of the two maps owns it. This is the ONLY way a role
 * reaches a screen: no component writes 'Client Success Manager', and no component writes 'csm'
 * either (CLAUDE.md non-negotiable 2 applied to the role vocabulary).
 *
 * Total on `string` rather than only on `Role`, because the value arrives from a `text` column and
 * a row written before a role was renamed must render as *something*. An unknown key is echoed back
 * unchanged — visibly odd in the UI, which is the point — rather than throwing inside a render.
 */
export function roleLabel(role: string): string {
  if (isAgencyRole(role)) {
    return AGENCY_ROLE_LABELS[role];
  }
  if (isBrandRole(role)) {
    return BRAND_ROLE_LABELS[role];
  }
  return role;
}
