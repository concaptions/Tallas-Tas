import { and, asc, eq, isNull } from 'drizzle-orm';

import type { Db } from './db';
import {
  brands,
  interfaceFields,
  interfacePages,
  promotionRequests,
  type Brand,
  type NewPromotionRequest,
} from './schema';
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

  return {
    childrenUpdated,
    pagesPerChild: templatePages.length,
    fieldsPerChild: templateFields.length,
  };
}
