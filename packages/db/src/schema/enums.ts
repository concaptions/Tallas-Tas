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

/**
 * Theme lifecycle (`themes.status`), Gratsi addition. Null until someone assigns a status, which is
 * why the column is nullable — most template themes never need one.
 */
export const themeStatuses = ['not_started', 'in_progress', 'done', 'archived'] as const;
export type ThemeStatus = (typeof themeStatuses)[number];

/**
 * Client-facing approval lifecycle of a concept (`concepts.approval_status`), Airtable v5.1: Draft
 * through Approved / Rejected / Revision Needed. Separate from the two-track internal/client status
 * already on concepts — this is the client-side gate.
 */
export const conceptApprovalStatuses = [
  'draft',
  'pending_client',
  'approved',
  'rejected',
  'revision_needed',
] as const;
export type ConceptApprovalStatus = (typeof conceptApprovalStatuses)[number];

/**
 * Production lifecycle of a concept (`concepts.production_status`), Airtable v5.1.
 */
export const conceptProductionStatuses = [
  'not_started',
  'scripting',
  'filming',
  'in_edit',
  'ready',
] as const;
export type ConceptProductionStatus = (typeof conceptProductionStatuses)[number];

/**
 * The language a creative brief is written in (`creative_briefs.language`), Gratsi addition.
 */
export const creativeLanguages = [
  'English',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Arabic',
] as const;
export type CreativeLanguage = (typeof creativeLanguages)[number];

/**
 * Funnel position on a copy row (`copywriting.funnel`), Airtable v5.1. Includes MOF and BOF which
 * the creative brief funnel vocabulary does not carry.
 */
export const copyFunnels = ['TOF', 'MOF', 'BOF', 'Retargeting'] as const;
export type CopyFunnel = (typeof copyFunnels)[number];

/**
 * Potential assessment for an angle (`angles.potential`), Airtable v5.1.
 */
export const anglePotentials = ['High', 'Medium', 'Low'] as const;
export type AnglePotential = (typeof anglePotentials)[number];

/**
 * The PRD §5.10 single-selects a Creative Brief carries: Source, Funnel, Type, Priority, Platform
 * and Performance, each in the order the PRD lists them and a dropdown renders them.
 *
 * Deliberately NOT `pgEnum`s, and the columns that store them are plain `text` — the same decision
 * `concepts.internal_status` documents. `packages/domain/src/creatives` is the single source of
 * these vocabularies (it also owns the funnel and format LETTERS of the §7 name formula and the §8
 * dimension defaults, neither of which is a storable value); a pg enum here would be a second copy
 * of a list that lives there, and every added Platform or Performance value would need a migration
 * to say something the database never enforces anyway. The `as const` tuples below are the storage
 * vocabulary the columns are `$type`d from, so a fixture or an insert cannot spell a value wrong,
 * and `packages/domain` copies them exactly as `angles/vocabulary.ts` copies `angleFormats` — the
 * dependency edge runs app → db and app → domain, never db → domain. `apps/web` asserts the two
 * equal.
 */

/** Who asked for the creative (`creative_briefs.source`), PRD §5.10. */
export const creativeSources = ['TAS', 'Client'] as const;
export type CreativeSource = (typeof creativeSources)[number];

/** Where the creative runs (`creative_briefs.funnel`); the first letter of the §7 name comes from it. */
export const creativeFunnels = ['TOF', 'Retargeting', 'All Funnels'] as const;
export type CreativeFunnel = (typeof creativeFunnels)[number];

/**
 * The asset itself (`creative_briefs.type`); the second letter of the §7 name comes from it, and §8
 * hangs the default dimension set off it. "Motion Image" is the PRD §5.10 spelling — `angleFormats`
 * calls the same thing "Motion Graphic", because that is the word a strategist uses when asking for
 * a format on an Angle. Two vocabularies, deliberately not merged: one is a request, one is a built
 * asset, and PRD §7's format letters (V/S/C/M) are defined over this one.
 */
export const creativeTypes = ['Video', 'Static', 'Carousel', 'Motion Image'] as const;
export type CreativeType = (typeof creativeTypes)[number];

/** Turnaround promise (`creative_briefs.priority`), PRD §5.10: 12h / 24h / 24h / 48h in this order. */
export const creativePriorities = [
  'Static High',
  'Static Average',
  'Video High',
  'Video Average',
] as const;
export type CreativePriority = (typeof creativePriorities)[number];

/** Where the finished ad is placed (`creative_briefs.platform`), PRD §5.10. */
export const creativePlatforms = ['Meta', 'Google', 'TikTok', 'YouTube', 'Website'] as const;
export type CreativePlatform = (typeof creativePlatforms)[number];

/** How the ad did once live (`creative_briefs.performance`), PRD §5.10; null until it has run. */
export const creativePerformances = ['Winning', 'High Potential to Iterate', 'Losing'] as const;
export type CreativePerformance = (typeof creativePerformances)[number];

/**
 * The call to action a copy row offers (`copywriting.cta`), PRD §5.11, in the order the PRD lists
 * them and the panel's dropdown renders them.
 *
 * Declared here with its `pgEnum` exactly as `angleFormats` is, so a component imports `copyCtas`
 * instead of re-typing six string literals (CLAUDE.md non-negotiable 2 in spirit: one vocabulary,
 * one place). The `copywriting.cta` COLUMN is plain `text` `$type`d from this union rather than the
 * enum itself, the same decision `creativeSources` documents: the storage vocabulary is asserted in
 * TypeScript, and adding a seventh CTA should not need a migration to say something the database
 * never enforces for the other single-selects either.
 */
export const copyCtas = [
  'Shop Now',
  'Learn More',
  'Sign Up',
  'Get Offer',
  'Subscribe',
  'Book Now',
  'Download',
  'Contact Us',
  'Get Directions',
  'Visit Us',
] as const;
export type CopyCta = (typeof copyCtas)[number];
export const copyCtaEnum = pgEnum('copy_cta', copyCtas);

/**
 * The age band a creator is booked in (`creators.age_bracket`), PRD §5.8, in ascending order.
 *
 * A BAND rather than a birth date on purpose: the agency never learns a creator's age, it books
 * against the bracket a casting brief asks for, and a date of birth would be personal data the
 * product has no use for. Same arrangement as `creativeSources` — an `as const` tuple the column is
 * `$type`d from rather than a `pgEnum`, so adding a band is a vocabulary change and not a migration.
 */
export const creatorAgeBrackets = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as const;
export type CreatorAgeBracket = (typeof creatorAgeBrackets)[number];

/**
 * Where a creator was sourced and is paid through (`creators.platform`), PRD §5.8, in the order the
 * PRD lists them. "Direct Management" is the one that is not a marketplace: the creator is managed
 * by TAS directly, which is why a partnership (§5.8.1) is usually struck with one of those.
 */
export const creatorPlatforms = [
  'Fiverr',
  'Billo',
  'Backstage',
  'Insense',
  'Direct Management',
] as const;
export type CreatorPlatform = (typeof creatorPlatforms)[number];

/**
 * The five pages of the client interface (`interface_pages.page_key`), PRD §10, in the order §10
 * lists them and the client's tab strip renders them: Concepts, Creatives, Copywriting, UGC
 * Management, Partnership Ads Tracking.
 *
 * A KEY, not the label: `ugc` and `partnership` are what the row stores and what a component
 * branches on, while the label a client reads ("UGC Management") is a column of the row, so a brand
 * can rename a tab without changing what the page IS. Same arrangement as `creativeSources` — an
 * `as const` tuple the column is `$type`d from rather than a `pgEnum`, because `packages/domain`
 * owns the interface defaults (`defaultInterfaceConfig`) and a second copy in Postgres would need a
 * migration to say something the database never enforces for the other single-selects either. The
 * dependency edge runs app → db and app → domain, never db → domain; `apps/web` asserts the two equal.
 */
export const interfacePageKeys = [
  'concepts',
  'creatives',
  'copywriting',
  'ugc',
  'partnership',
] as const;
export type InterfacePageKey = (typeof interfacePageKeys)[number];

/**
 * The eight things PRD §12 sends a Slack DM about, in the order §12's bullet list writes them and
 * the Notifications table renders them: brief assigned, revisions requested internally, ad
 * submitted, client approved, client requested revisions, creative ready to launch, creator status
 * changed, partnership permission expiring in 5 days.
 *
 * ONE TUPLE, THREE THINGS. A row of `notification_settings` stores only its `trigger_key` and its
 * two switches; the human LABEL and the RECIPIENT that key means are vocabulary, not per-brand data,
 * so they live here beside the key instead of being duplicated into every brand's rows and into a
 * component. A component never writes 'brief_assigned' or 'Media Buyer': it reads
 * `notificationTriggers` (or the joined label `listNotificationSettings` hands it), exactly as the
 * Angles page reads `angleFormats` instead of typing 'Carousel'.
 *
 * RECIPIENTS ARE §11 ROLES, not names and not a new vocabulary: `recipients` holds `BrandRole`
 * values, so routing derives from the brand assignment made at onboarding (§12: "routing comes from
 * the team assignment made at onboarding — filled once, never rebuilt by hand") and this table never
 * names a person. `recipientLabel` is the short reading of that list for the Recipient column
 * ("Media Buyer", "CSM + Strategist"); it is a rendering of `recipients` and never disagrees with it.
 *
 * §12's "UGC manager" is the one bullet with no §11 role behind it: PRD §11's table has Admin, CSM,
 * Creative Strategist, Video Editor / Designer, Media Buyer and Client, and the person who runs the
 * creator roster in this agency is the Creative Strategist who books it. So `creator_status_changed`
 * ROUTES to `strategist` rather than inventing a role the rest of the platform cannot assign — and
 * it is LABELLED "UGC Manager (Strategist)", because the Recipient column has two things to be
 * honest about at once. §12 names the UGC manager, so the page must show that bullet's recipient
 * rather than silently renaming it; and the DM resolves through the brand's team assignment, where
 * the only role that can hold it today is the strategist. Dropping either half would mislead: "UGC
 * Manager" alone sends a CSM to the Team page looking for a role that cannot be assigned, and
 * "Strategist" alone hides a §12 requirement. It is the one label with a parenthetical because it
 * is the one bullet with this problem. The day §11 gains a UGC manager, this row's `recipients`
 * becomes that role and the parenthetical goes; nothing else changes.
 *
 * The `pgEnum` beside the tuple is the same arrangement as `copyCtas` / `copyCtaEnum`: the
 * vocabulary is declared to Postgres, while `notification_settings.trigger_key` is plain `text`
 * `$type`d from the union, so a trigger renamed in a later PRD revision is a vocabulary change and a
 * stored row whose key has gone stops matching the tuple instead of failing an insert.
 */
export const notificationTriggers = [
  {
    key: 'brief_assigned',
    label: 'Brief assigned to an editor or designer',
    recipients: ['video_editor', 'designer'],
    recipientLabel: 'Video Editor / Designer',
  },
  {
    key: 'internal_revisions_requested',
    label: 'Revisions requested internally',
    recipients: ['video_editor', 'designer'],
    recipientLabel: 'Video Editor / Designer',
  },
  {
    key: 'ad_submitted',
    label: 'Ad submitted',
    recipients: ['strategist', 'csm'],
    recipientLabel: 'Strategist + CSM',
  },
  {
    key: 'client_approved',
    label: 'Client approved a concept, creative, copy or creator',
    recipients: ['csm', 'strategist'],
    recipientLabel: 'CSM + Strategist',
  },
  {
    key: 'client_requested_revisions',
    label: 'Client requested revisions',
    recipients: ['csm', 'strategist'],
    recipientLabel: 'CSM + Strategist',
  },
  {
    key: 'creative_ready_to_launch',
    label: 'Creative approved internally and ready to launch',
    recipients: ['media_buyer'],
    recipientLabel: 'Media Buyer',
  },
  {
    key: 'creator_status_changed',
    label: 'Creator status changed',
    recipients: ['strategist'],
    recipientLabel: 'UGC Manager (Strategist)',
  },
  {
    key: 'partnership_expiring',
    label: 'Partnership permission expiring in 5 days',
    recipients: ['media_buyer', 'csm'],
    recipientLabel: 'Media Buyer + CSM',
  },
] as const satisfies readonly {
  key: string;
  label: string;
  recipients: readonly BrandRole[];
  recipientLabel: string;
}[];

/** One §12 trigger: its stored key, its label, the §11 roles it DMs and how they read in a cell. */
export type NotificationTrigger = (typeof notificationTriggers)[number];

/** What `notification_settings.trigger_key` stores; the tuple above is the only place it is written. */
export type NotificationTriggerKey = NotificationTrigger['key'];

/**
 * The keys alone, in §12 order — what a `pgEnum` and an ordering assertion need. Derived from the
 * tuple rather than typed a second time, with the one assertion `pgEnum`'s non-empty tuple signature
 * requires: `map` widens the eight literals to an array, and the tuple above is what guarantees the
 * first element exists.
 */
export const notificationTriggerKeys = notificationTriggers.map(
  (trigger) => trigger.key,
) as unknown as [NotificationTriggerKey, ...NotificationTriggerKey[]];

export const notificationTriggerEnum = pgEnum('notification_trigger', notificationTriggerKeys);

/** The two channels §12 offers per trigger: the Slack DM it is about, and email as the extra. */
export const notificationChannels = ['slack', 'email'] as const;
export type NotificationChannel = (typeof notificationChannels)[number];
