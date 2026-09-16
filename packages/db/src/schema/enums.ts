import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Every enum the schema uses, defined once (tenancy first, then the Phase 3 product enums). The
 * `as const` arrays are the single list; the pg enums and the TypeScript unions below derive from
 * them, so `packages/domain` imports the union (or the array, to iterate) instead of retyping the
 * values. PRD §11.
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

/**
 * Stage of market awareness (`personas.stage_of_awareness`), Breakthrough Advertising's five stages
 * in their canonical order, coldest first. PRD §5.4.
 */
export const awarenessStages = [
  'unaware',
  'problem_aware',
  'solution_aware',
  'product_aware',
  'most_aware',
] as const;
export type AwarenessStage = (typeof awarenessStages)[number];
export const awarenessStageEnum = pgEnum('awareness_stage', awarenessStages);

/**
 * The formats a strategist asks an angle to be built in (`angles.formats`), PRD §5.6, in the fixed
 * order the page renders them. The column itself is `jsonb` because Type and Formats are
 * multi-selects and a row carries a set, not a value; this enum is the shared vocabulary that
 * vocabulary is drawn from, so a component imports `angleFormats` instead of writing a string
 * literal, exactly as `awarenessStages` is imported for the single-select.
 */
export const angleFormats = ['Static', 'Video', 'Carousel', 'Motion Graphic'] as const;
export type AngleFormat = (typeof angleFormats)[number];
export const angleFormatEnum = pgEnum('angle_format', angleFormats);

/**
 * The multi-select PRD §5.6 calls Type (`angles.type`): what the hypothesis leans on. Same
 * arrangement as `angleFormats` — a `jsonb` set of values, this enum naming them once.
 */
export const angleTypes = ['Emotional', 'Functional', 'Identity', 'Critical'] as const;
export type AngleType = (typeof angleTypes)[number];
export const angleTypeEnum = pgEnum('angle_type', angleTypes);

/**
 * The three kinds of theme the GLOBAL library holds (`themes.category`), PRD §5.5 — Frameworks
 * (the *how* of the argument), Production styles (the *how* of the shoot) and Seasonal / timely
 * hooks — in the order the PRD lists them and the page's filter chips render them. Same arrangement
 * as `angleFormats`: one `as const` tuple, a pg enum derived from it and the union derived from it,
 * so the Themes page imports `themeCategories` to label its chips instead of writing a string
 * literal. A single-select, so unlike `angleFormats` the column is the enum itself, not `jsonb`.
 */
export const themeCategories = ['Framework', 'Production Style', 'Seasonal'] as const;
export type ThemeCategory = (typeof themeCategories)[number];
export const themeCategoryEnum = pgEnum('theme_category', themeCategories);
