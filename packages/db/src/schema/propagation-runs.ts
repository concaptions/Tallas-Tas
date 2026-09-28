import { index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';

/**
 * The propagation ledger (CLAUDE.md architecture: "Propagation is a background job that applies the
 * parent diff to every child, skipping overridden fields"). One row per propagation the engine ran:
 * a template row inserted/updated/soft-deleted into its children, a full content sweep, an interface
 * config push, or the initial seed of a new brand. The Run History tab on `/app/propagation` reads
 * this, and an admin auditing "did my template change reach every brand?" reads it too.
 *
 * `template_brand_id` is the SOURCE (the agency's parent template), not a child — a run fans one
 * parent row out to N children, so the child brand ids do not fit one column and the counts stand in
 * for them. `children_updated` + `skipped` reconcile against the child count at the time of the run:
 * a skip is a child whose row was locally overridden (protected) or absent.
 *
 * `brand_id` from the shared columns stays null: this is a template-level operational log, not a
 * per-brand content row, the same shape a global table takes. `created_by` carries the actor and
 * `created_at` is the moment of the run.
 */
export const propagationRuns = pgTable(
  'propagation_runs',
  {
    ...baseColumns(),
    templateBrandId: uuid('template_brand_id')
      .notNull()
      .references(() => brands.id),
    tableName: text('table_name').notNull(),
    trigger: text('trigger').$type<PropagationTrigger>().notNull(),
    /** The parent row fanned out, when the run was about one row; null for a sweep, seed or config. */
    templateRowId: uuid('template_row_id'),
    childrenUpdated: integer('children_updated').notNull().default(0),
    skipped: integer('skipped').notNull().default(0),
  },
  (table) => [
    index('propagation_runs_template_brand_id_idx').on(table.templateBrandId),
    index('propagation_runs_table_name_idx').on(table.tableName),
  ],
);

/** What kind of propagation a ledger row records. */
export type PropagationTrigger =
  'insert' | 'update' | 'soft_delete' | 'seed' | 'interface' | 'sweep';

export type PropagationRun = typeof propagationRuns.$inferSelect;
export type NewPropagationRun = typeof propagationRuns.$inferInsert;
