import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import type { Db } from './db';
import { logPropagationRun } from './propagation-runs';
import {
  aiCharacters,
  angles,
  brands,
  campaignsOffers,
  collections,
  competitiveResearch,
  concepts,
  copywriting,
  creativeBriefs,
  creativeDimensions,
  creators,
  customFieldSchemas,
  interfaceFields,
  interfacePages,
  personas,
  products,
  promotionRequests,
  type Brand,
  type NewPromotionRequest,
} from './schema';
import type { BrandedTable } from './tenancy';
import { withBrand } from './tenancy';

/**
 * Core propagation engine (PRD §5, §14.1; CLAUDE.md non-negotiable 1).
 *
 * Three operations:
 * 1. `createPromotionRequest` — a child brand submits a change for admin review
 * 2. `listChildBrands` — enumerate all non-archived children of a template
 * 3. `propagateInterfaceConfig` — push the template brand's interface config to all children
 *
 * The interface config propagation is the first concrete propagation path. The full engine (§4 of
 * the template-engine design doc) will register every per-brand table and propagate row-by-row with
 * `template_row_id` and `overridden_fields`. This module is the foundation: it proves the pattern
 * on the table pair that is already seeded by onboarding.
 */

type ManagedColumn =
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'createdBy'
  | 'updatedBy'
  | 'deletedAt'
  | 'reviewedBy'
  | 'reviewedAt'
  | 'reviewNote';

export type CreatePromotionInput = Omit<NewPromotionRequest, ManagedColumn>;

export async function createPromotionRequest(
  db: Db,
  input: CreatePromotionInput,
  actorId: string,
): Promise<typeof promotionRequests.$inferSelect> {
  const [row] = await db
    .insert(promotionRequests)
    .values({
      ...input,
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning();
  if (row === undefined) throw new Error('Promotion request insert returned no row');
  return row;
}

export async function resolveTemplateBrandId(db: Db, agencyId: string): Promise<string | null> {
  const [template] = await db
    .select({ id: brands.id })
    .from(brands)
    .where(
      and(eq(brands.agencyId, agencyId), eq(brands.isTemplate, true), isNull(brands.deletedAt)),
    )
    .limit(1);
  return template?.id ?? null;
}

export async function listChildBrands(db: Db, templateBrandId: string): Promise<Brand[]> {
  return db
    .select()
    .from(brands)
    .where(
      and(
        eq(brands.templateBrandId, templateBrandId),
        isNull(brands.deletedAt),
        eq(brands.status, 'active'),
      ),
    )
    .orderBy(asc(brands.name));
}

export interface PropagationResult {
  readonly childrenUpdated: number;
  readonly pagesPerChild: number;
  readonly fieldsPerChild: number;
}

/**
 * Copy the template brand's interface config (pages + fields) to every active child brand,
 * replacing their existing config. This is the "parent change lands in every child" path for
 * interface configuration.
 *
 * Current implementation: full replace (delete + reseed). The full engine will diff and skip
 * overridden fields; this version is correct for V0 where children have not yet diverged.
 */
export async function propagateInterfaceConfig(
  db: Db,
  templateBrandId: string,
  actorId: string,
): Promise<PropagationResult> {
  const templateScope = withBrand(db, templateBrandId);
  const templatePages = await templateScope
    .select(interfacePages)
    .orderBy(asc(interfacePages.position));
  const templateFields = await templateScope
    .select(interfaceFields)
    .orderBy(asc(interfaceFields.position));

  const children = await listChildBrands(db, templateBrandId);
  let childrenUpdated = 0;

  for (const child of children) {
    const scope = withBrand(db, child.id);

    const existingPages = await scope.select(interfacePages);
    const existingPageIds = existingPages.map((p) => p.id);
    for (const pageId of existingPageIds) {
      await scope.softDelete(interfaceFields, eq(interfaceFields.pageId, pageId));
    }
    await scope.softDelete(interfacePages);

    if (templatePages.length > 0) {
      const newPages = await scope
        .insert(
          interfacePages,
          templatePages.map((page) => ({
            pageKey: page.pageKey,
            label: page.label,
            enabled: page.enabled,
            position: page.position,
            createdBy: actorId,
            updatedBy: actorId,
          })),
        )
        .returning();

      if (templateFields.length > 0) {
        const pageKeyToNewId = new Map(newPages.map((p) => [p.pageKey, p.id]));
        const templatePageIdToKey = new Map(templatePages.map((p) => [p.id, p.pageKey]));

        const fieldValues = templateFields
          .map((field) => {
            const pageKey = templatePageIdToKey.get(field.pageId);
            if (pageKey === undefined) return null;
            const newPageId = pageKeyToNewId.get(pageKey);
            if (newPageId === undefined) return null;
            return {
              pageId: newPageId,
              fieldName: field.fieldName,
              label: field.label,
              visible: field.visible,
              clientEditable: field.clientEditable,
              position: field.position,
              createdBy: actorId,
              updatedBy: actorId,
            };
          })
          .filter((v): v is NonNullable<typeof v> => v !== null);

        if (fieldValues.length > 0) {
          await scope.insert(interfaceFields, fieldValues);
        }
      }
    }
    childrenUpdated++;
  }

  await logPropagationRun(
    db,
    {
      templateBrandId,
      tableName: 'interface_config',
      trigger: 'interface',
      childrenUpdated,
      skipped: 0,
    },
    actorId,
  );

  return {
    childrenUpdated,
    pagesPerChild: templatePages.length,
    fieldsPerChild: templateFields.length,
  };
}

/**
 * Registry of content tables that participate in template propagation (CLAUDE.md architecture).
 * Each entry maps a table name to its Drizzle table object. All these tables have propagation
 * columns: `template_row_id`, `overridden_fields`, `custom_fields`.
 */
export const PROPAGATION_TABLES: Record<string, BrandedTable> = {
  products,
  personas,
  angles,
  concepts,
  creative_briefs: creativeBriefs,
  copywriting,
  creators,
  campaigns_offers: campaignsOffers,
  collections,
  creative_dimensions: creativeDimensions,
  ai_characters: aiCharacters,
  competitive_research: competitiveResearch,
};

/**
 * Columns that are managed by the system and must NEVER be copied during propagation.
 * These are set by the engine or the scope, not by the template data.
 */
const MANAGED_PROPAGATION_COLUMNS = new Set([
  'id',
  'brand_id',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
  'deleted_at',
  'template_row_id',
  'overridden_fields',
  'legacy_airtable_id',
]);

export interface ContentPropagationResult {
  readonly childrenUpdated: number;
  readonly tablesProcessed: string[];
  readonly rowsCopied: number;
}

/**
 * Seed content data from the template brand into a SINGLE child brand. Called during onboarding
 * when a new brand is created. Copies all live rows from every content table, setting
 * `template_row_id` to the template row's ID so changes can be tracked.
 *
 * Also copies custom field schemas from the template.
 */
export async function seedContentFromTemplate(
  db: Db,
  templateBrandId: string,
  childBrandId: string,
  actorId: string,
): Promise<ContentPropagationResult> {
  const templateScope = withBrand(db, templateBrandId);
  const childScope = withBrand(db, childBrandId);
  let totalRowsCopied = 0;
  const tablesProcessed: string[] = [];

  const templateFieldSchemas = await templateScope.select(customFieldSchemas);
  if (templateFieldSchemas.length > 0) {
    await childScope.insert(
      customFieldSchemas,
      templateFieldSchemas.map((s) => ({
        tableName: s.tableName,
        fieldKey: s.fieldKey,
        fieldType: s.fieldType,
        fieldLabel: s.fieldLabel,
        options: s.options,
        sortOrder: s.sortOrder,
        createdBy: actorId,
        updatedBy: actorId,
      })),
    );
  }

  for (const [tableName, table] of Object.entries(PROPAGATION_TABLES)) {
    const templateRows = await templateScope.select(table);
    if (templateRows.length === 0) continue;

    const columns = getTableColumns(table);
    const copyableColumns = columns.filter((col) => !MANAGED_PROPAGATION_COLUMNS.has(col));

    const childValues = templateRows.map((row) => {
      const value: Record<string, unknown> = {};
      for (const col of copyableColumns) {
        value[snakeToCamel(col)] = (row as Record<string, unknown>)[snakeToCamel(col)];
      }
      value.templateRowId = (row as Record<string, unknown>).id;
      value.overriddenFields = [];
      value.createdBy = actorId;
      value.updatedBy = actorId;
      return value;
    });

    await childScope.insert(table, childValues);
    totalRowsCopied += childValues.length;
    tablesProcessed.push(tableName);
  }

  await logPropagationRun(
    db,
    {
      templateBrandId,
      tableName: 'all',
      trigger: 'seed',
      childrenUpdated: 1,
      skipped: 0,
    },
    actorId,
  );

  return {
    childrenUpdated: 1,
    tablesProcessed,
    rowsCopied: totalRowsCopied,
  };
}

/**
 * Propagate a single template row's changes to all child brands. When a template row is updated,
 * this pushes the non-overridden fields to every child row that has `template_row_id` matching
 * the template row's ID.
 *
 * For new rows (insert trigger), creates a copy in each child brand.
 * For updates, patches only fields the child hasn't overridden.
 * For soft deletes, soft-deletes the child rows.
 */
export async function propagateTemplateRow(
  db: Db,
  templateBrandId: string,
  tableName: string,
  templateRowId: string,
  trigger: 'insert' | 'update' | 'soft_delete',
  actorId: string,
): Promise<{ childrenUpdated: number; skipped: number }> {
  const table = PROPAGATION_TABLES[tableName];
  if (!table) throw new Error(`Table ${tableName} is not in the propagation registry`);

  // Every path out of this function records one ledger row, so the Run History tab shows the parent
  // row that fanned out and how many children took it — a no-op run (no children, no template row)
  // is logged too, because "the propagation ran and reached nobody" is itself worth seeing.
  const finish = async (result: {
    childrenUpdated: number;
    skipped: number;
  }): Promise<{ childrenUpdated: number; skipped: number }> => {
    await logPropagationRun(
      db,
      { templateBrandId, tableName, trigger, templateRowId, ...result },
      actorId,
    );
    return result;
  };

  const children = await listChildBrands(db, templateBrandId);
  if (children.length === 0) return finish({ childrenUpdated: 0, skipped: 0 });

  if (trigger === 'soft_delete') {
    let updated = 0;
    for (const child of children) {
      const rows = await withBrand(db, child.id)
        .softDelete(
          table,
          eq(
            (table as unknown as Record<string, unknown>).templateRowId as ReturnType<typeof sql>,
            templateRowId,
          ),
        )
        .returning();
      updated += rows.length;
    }
    return finish({ childrenUpdated: updated, skipped: children.length - updated });
  }

  const templateScope = withBrand(db, templateBrandId);
  const [templateRow] = await templateScope
    .select(
      table,
      eq((table as unknown as Record<string, unknown>).id as ReturnType<typeof sql>, templateRowId),
    )
    .limit(1);
  if (!templateRow) return finish({ childrenUpdated: 0, skipped: children.length });

  const columns = getTableColumns(table);
  const copyableColumns = columns.filter((col) => !MANAGED_PROPAGATION_COLUMNS.has(col));

  let updated = 0;
  let skipped = 0;

  for (const child of children) {
    const childScope = withBrand(db, child.id);

    if (trigger === 'insert') {
      const value: Record<string, unknown> = {};
      for (const col of copyableColumns) {
        value[snakeToCamel(col)] = (templateRow as Record<string, unknown>)[snakeToCamel(col)];
      }
      value.templateRowId = templateRowId;
      value.overriddenFields = [];
      value.createdBy = actorId;
      value.updatedBy = actorId;
      await childScope.insert(table, value);
      updated++;
    } else {
      const templateRowIdCol = (table as unknown as Record<string, unknown>)
        .templateRowId as ReturnType<typeof sql>;
      const childRows = await childScope.select(table, eq(templateRowIdCol, templateRowId));

      if (childRows.length === 0) {
        skipped++;
        continue;
      }

      for (const childRow of childRows) {
        const overridden = new Set(
          (childRow as Record<string, unknown>).overriddenFields as string[],
        );

        if (copyableColumns.every((col) => overridden.has(col))) {
          skipped++;
          continue;
        }

        const updates: Record<string, unknown> = {};
        for (const col of copyableColumns) {
          if (!overridden.has(col)) {
            updates[snakeToCamel(col)] = (templateRow as Record<string, unknown>)[
              snakeToCamel(col)
            ];
          }
        }
        updates.updatedBy = actorId;

        await childScope.update(
          table,
          updates,
          eq(
            (table as unknown as Record<string, unknown>).id as ReturnType<typeof sql>,
            (childRow as Record<string, unknown>).id as string,
          ),
        );
        updated++;
      }
    }
  }

  return finish({ childrenUpdated: updated, skipped });
}

/**
 * Propagate ALL content from the template brand to all child brands. Used for a full
 * re-propagation sweep (admin action). Processes every table, every row.
 */
export async function propagateAllContent(
  db: Db,
  templateBrandId: string,
  actorId: string,
): Promise<ContentPropagationResult> {
  const children = await listChildBrands(db, templateBrandId);
  if (children.length === 0) {
    return { childrenUpdated: 0, tablesProcessed: [], rowsCopied: 0 };
  }

  const templateScope = withBrand(db, templateBrandId);
  let totalRowsCopied = 0;
  const tablesProcessed: string[] = [];

  for (const [tableName, table] of Object.entries(PROPAGATION_TABLES)) {
    const templateRows = await templateScope.select(table);
    if (templateRows.length === 0) continue;

    const columns = getTableColumns(table);
    const copyableColumns = columns.filter((col) => !MANAGED_PROPAGATION_COLUMNS.has(col));
    const templateRowIds = new Set(
      templateRows.map((r) => (r as Record<string, unknown>).id as string),
    );

    for (const child of children) {
      const childScope = withBrand(db, child.id);
      const existingChildRows = await childScope.select(table);
      const childRowsByTemplateId = new Map<string, Record<string, unknown>>();
      for (const row of existingChildRows) {
        const trid = (row as Record<string, unknown>).templateRowId as string | null;
        if (trid) childRowsByTemplateId.set(trid, row);
      }

      for (const templateRow of templateRows) {
        const tRowId = (templateRow as Record<string, unknown>).id as string;
        const existingChild = childRowsByTemplateId.get(tRowId);

        if (!existingChild) {
          const value: Record<string, unknown> = {};
          for (const col of copyableColumns) {
            value[snakeToCamel(col)] = (templateRow as Record<string, unknown>)[snakeToCamel(col)];
          }
          value.templateRowId = tRowId;
          value.overriddenFields = [];
          value.createdBy = actorId;
          value.updatedBy = actorId;
          await childScope.insert(table, value);
          totalRowsCopied++;
        } else {
          const overridden = new Set(existingChild.overriddenFields as string[]);
          const updates: Record<string, unknown> = {};
          let hasUpdate = false;
          for (const col of copyableColumns) {
            if (!overridden.has(col)) {
              const newVal = (templateRow as Record<string, unknown>)[snakeToCamel(col)];
              if (newVal !== existingChild[snakeToCamel(col)]) {
                updates[snakeToCamel(col)] = newVal;
                hasUpdate = true;
              }
            }
          }
          if (hasUpdate) {
            updates.updatedBy = actorId;
            await childScope.update(
              table,
              updates,
              eq(
                (table as unknown as Record<string, unknown>).id as ReturnType<typeof sql>,
                existingChild.id as string,
              ),
            );
            totalRowsCopied++;
          }
        }
      }

      for (const childRow of existingChildRows) {
        const trid = (childRow as Record<string, unknown>).templateRowId as string | null;
        if (trid && !templateRowIds.has(trid)) {
          await childScope.softDelete(
            table,
            eq(
              (table as unknown as Record<string, unknown>).id as ReturnType<typeof sql>,
              (childRow as Record<string, unknown>).id as string,
            ),
          );
        }
      }
    }

    tablesProcessed.push(tableName);
  }

  await logPropagationRun(
    db,
    {
      templateBrandId,
      tableName: 'all',
      trigger: 'sweep',
      childrenUpdated: children.length,
      skipped: 0,
    },
    actorId,
  );

  return {
    childrenUpdated: children.length,
    tablesProcessed,
    rowsCopied: totalRowsCopied,
  };
}

function getTableColumns(table: BrandedTable): string[] {
  // Drizzle stores column definitions under Symbol.for('drizzle:Columns'); each value has a `.name`
  // property with the SQL column name. Fall back to Object.keys of the table for safety.
  const sym = Symbol.for('drizzle:Columns');
  const raw = (table as never)[sym] as Record<string, { name: string }> | undefined;
  if (raw && typeof raw === 'object') {
    return Object.values(raw).map((col) => col.name);
  }
  return [];
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}
