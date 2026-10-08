import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { baseColumns, propagationColumns } from '../columns';
import { brands } from './brands';
import type {
  AngleFormat,
  ClientApprovalStatusKey,
  ConceptApprovalStatus,
  ConceptProductionStatus,
} from './enums';

/**
 * The value `internal_status` starts at: the FIRST entry of `INTERNAL_VIDEO_STATUS` in
 * `@tas/domain/state`, verbatim. A concept is briefed to a video editor before anything else exists,
 * so a fresh row is already "Sent to Video Editor".
 *
 * The literal is repeated here rather than imported because `@tas/db` does not depend on
 * `@tas/domain` — the edge runs the other way round everywhere else in this repo (see
 * `packages/domain/src/angles/vocabulary.ts`, which copies this package's storage vocabulary for
 * exactly the same reason). `apps/web` depends on both and is where the two are asserted equal.
 */
export const CONCEPT_INTERNAL_STATUS_DEFAULT = 'sent_to_video_editor';

/** The first entry of `CLIENT_STATUS` in `@tas/domain/state`; see the note above on the literal. */
export const CONCEPT_CLIENT_STATUS_DEFAULT = 'pending_for_approval';

/**
 * One Angle paired with one Theme (PRD §5.7). `name` is the auto-generated `Batch-Angle-Theme`
 * string (CLAUDE.md non-negotiable 6) and is never typed by hand; the formula itself belongs to
 * `packages/domain`. The angle and theme links live in the `concept_angles` and `concept_themes`
 * junction tables (`junction-tables.ts`), not as columns here, and both are optional — a concept
 * can be drafted before either is chosen.
 *
 * `formats` and `ad_inspo_links` are `jsonb` arrays, not pg enum arrays, exactly as on `angles`:
 * PRD §5.7 makes Formats a multi-select, so a row carries a set. `formats` shares the `angleFormats`
 * vocabulary (`enums.ts`), which is what a component imports; the column stores the chosen subset.
 * Both are NOT NULL defaulting to `[]`, so a reader never branches on null before mapping.
 *
 * `internal_status` and `client_status` are plain `text`, deliberately NOT pg enums. Their values
 * are the status KEYS of the two-track state machine in `packages/domain/src/state`, which is the
 * single source of truth for the vocabulary, the transitions, the labels and the client gate
 * (`isClientTrackOpen`). A pg enum would duplicate that list in the database and would need a
 * migration every time the machine gains a state, so the column stores the key as text and the
 * machine stays the only place the set of states is defined. Both are NOT NULL with the first key of
 * their track as the default, so a concept is never in "no status".
 */
export const concepts = pgTable(
  'concepts',
  {
    ...baseColumns(),
    ...propagationColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    name: text('name').notNull(),
    batch: text('batch'),
    category: text('category'),
    conceptStyle: text('concept_style'),
    formats: jsonb('formats').$type<AngleFormat[]>().notNull().default([]),
    adInspoLinks: jsonb('ad_inspo_links').$type<string[]>().notNull().default([]),
    hookExamples: text('hook_examples'),
    scriptIdea: text('script_idea'),
    // Gratsi carries these on the concept itself (all 102 live rows have a description and pain
    // points, 90 a USP); they are not inherited from the angle.
    description: text('description'),
    painPoints: text('pain_points'),
    usp: text('usp'),
    clientComments: text('client_comments'),
    approvalStatus: text('approval_status').$type<ConceptApprovalStatus>(),
    formatsToCreate: jsonb('formats_to_create').$type<string[]>().notNull().default([]),
    productionStatus: text('production_status').$type<ConceptProductionStatus>(),
    internalStatus: text('internal_status').notNull().default(CONCEPT_INTERNAL_STATUS_DEFAULT),
    clientStatus: text('client_status').notNull().default(CONCEPT_CLIENT_STATUS_DEFAULT),
    /**
     * When the client-status track last moved (Oct 5 Talal sync). Nullable: a row that was never
     * stepped out of its starting state has no recorded move-moment, and the client-facing track's
     * default is `pending_for_approval` on every concept. The timestamp is set by the shared
     * `updateClientStatus` server action; nothing else touches it.
     */
    clientStatusUpdatedAt: timestamp('client_status_updated_at', { withTimezone: true }),
    /**
     * The short reason the strategist typed when they moved the client-status track (Oct 5 Talal
     * sync). Nullable: a status change does not always carry a reason — the natural
     * `pending_for_approval` → `approved` edge typically does not. The paste's "disapproved" state
     * has no CLIENT_STATUS key (PRD §9: Pending for Approval → Approved / Revisions Needed →
     * Launched); `revisions_needed` is the one state that reads it, so the shared dropdown
     * requires a note only for that transition.
     */
    clientStatusNote: text('client_status_note'),
    clientApprovalStatus: text('client_approval_status').$type<ClientApprovalStatusKey>(),
    clientApprovalNote: text('client_approval_note'),
    clientApprovalStatusUpdatedAt: timestamp('client_approval_status_updated_at', {
      withTimezone: true,
    }),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('concepts_brand_id_idx').on(table.brandId),
    index('concepts_template_row_id_idx').on(table.templateRowId),
  ],
);

export type Concept = typeof concepts.$inferSelect;
export type NewConcept = typeof concepts.$inferInsert;
