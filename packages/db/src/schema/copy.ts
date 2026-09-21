import { index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';
import { creativeBriefs } from './briefs';
import type { CopyCta } from './enums';

/**
 * The value `status` starts at: the FIRST entry of `COPY_STATUS` in `@tas/domain/state`, verbatim —
 * a fresh copy row is waiting on the client before anything else can happen to it.
 *
 * The literal is repeated here rather than imported for the reason `schema/briefs.ts` gives:
 * `@tas/db` does not depend on `@tas/domain`, the edge runs the other way everywhere in this repo,
 * and `apps/web` is where the two are asserted equal.
 */
export const COPY_STATUS_DEFAULT = 'pending_for_client_review';

/** The first entry of `copyCtas`; a dropdown always has a value selected, so the column is NOT NULL. */
export const COPY_CTA_DEFAULT: CopyCta = 'Shop Now';

/**
 * Ad copy, written separately but tied to the creative (PRD §5.11). "Keep this table lean" — so this
 * is deliberately the shortest branded table in the schema, and two Airtable columns are DROPPED
 * rather than carried over:
 *
 *   - **Funnel** is not here. It belongs to the creative, not to the words: `creative_briefs.funnel`
 *     already carries it and is the first letter of the PRD §7 name. A second copy on this table
 *     could disagree with it, and there is no rule that could say which one won.
 *   - **Copy Type** is not here either. PRD §5.11 is explicit that it goes; the four copy fields
 *     below (primary / headline / link description / CTA) ARE the type, spelled out.
 *
 * Neither is a "later" — adding either back needs a PRD change, not a migration.
 *
 * `creative_brief_id` is NULLABLE, and that is the ordinary case, not a degraded one: copy is drafted
 * before it is attached to anything, and PRD §5.11's link to the Creative "is the connection that
 * matters" precisely because it is a connection a row can be missing. Every read here therefore
 * reaches the creative's name through a join that returns null rather than through a column.
 *
 * `copy_number` is the auto-generated Copy # (CLAUDE.md non-negotiable 6): the integer is stored, the
 * TITLE is the pure `copyTitle` in `packages/domain/src/copy` applied to it, and no user types
 * either. It is the row's own column rather than a `count(*)`, for the reason `creative_briefs.
 * sequence` documents: a row keeps the number it was given even after an earlier row is soft-deleted,
 * which a count would silently reuse.
 *
 * The three text fields carry PRD §5.11's character guidance — primary copy ~125, headline ~40, link
 * description ~27 — as GUIDANCE: it is helper text under each field in the panel and a property of
 * every fixture, never a database constraint. Meta itself truncates rather than rejects, and a column
 * that threw on the 126th character would lose a strategist's draft mid-edit.
 *
 * `status` is plain `text` carrying a KEY of `COPY_STATUS` in `@tas/domain/state`, the arrangement
 * `schema/briefs.ts` documents at length: the domain owns the set of states and their labels, this
 * column only stores which one the row is in. `client_comment` is what the client wrote back when
 * they moved the row to `edited_by_client`; null on every other row.
 */
export const copywriting = pgTable(
  'copywriting',
  {
    ...baseColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    creativeBriefId: uuid('creative_brief_id').references(() => creativeBriefs.id),
    copyNumber: integer('copy_number').notNull().default(1),
    primaryCopy: text('primary_copy'),
    headline: text('headline'),
    linkDescription: text('link_description'),
    cta: text('cta').$type<CopyCta>().notNull().default(COPY_CTA_DEFAULT),
    status: text('status').notNull().default(COPY_STATUS_DEFAULT),
    clientComment: text('client_comment'),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('copywriting_brand_id_idx').on(table.brandId),
    index('copywriting_creative_brief_id_idx').on(table.creativeBriefId),
  ],
);

export type Copy = typeof copywriting.$inferSelect;
export type NewCopy = typeof copywriting.$inferInsert;
