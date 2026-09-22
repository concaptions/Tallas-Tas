import { and, eq, isNull } from 'drizzle-orm';

import type { Db } from './db';
import {
  brands,
  customFieldSchemas,
  type CustomFieldSchema,
  type NewCustomFieldSchema,
} from './schema';
import { withBrand } from './tenancy';

export type CustomFieldSchemaListRow = CustomFieldSchema;
export type CustomFieldSchemaInput = Omit<
  NewCustomFieldSchema,
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

export async function listCustomFieldSchemas(
  db: Db,
  brandId: string,
  tableName?: string,
): Promise<CustomFieldSchemaListRow[]> {
  const scope = withBrand(db, brandId);
  const where = tableName ? eq(customFieldSchemas.tableName, tableName) : undefined;
  return scope.select(customFieldSchemas, where).orderBy(customFieldSchemas.sortOrder);
}

export async function insertCustomFieldSchema(
  db: Db,
  brandId: string,
  input: CustomFieldSchemaInput,
  actorId: string,
): Promise<CustomFieldSchema> {
  const scope = withBrand(db, brandId);
  const rows = await scope
    .insert(customFieldSchemas, { ...input, createdBy: actorId, updatedBy: actorId })
    .returning();
  const row = rows[0];
  if (row === undefined) throw new Error('Custom field schema insert returned no row');
  return row;
}

export async function updateCustomFieldSchema(
  db: Db,
  brandId: string,
  id: string,
  updates: Partial<
    Pick<NewCustomFieldSchema, 'fieldLabel' | 'fieldType' | 'options' | 'sortOrder'>
  >,
  actorId: string,
): Promise<CustomFieldSchema | undefined> {
  const [row] = await withBrand(db, brandId)
    .update(customFieldSchemas, { ...updates, updatedBy: actorId }, eq(customFieldSchemas.id, id))
    .returning();
  return row;
}

/**
 * Returns the custom field schemas that apply to a brand: either the brand's own schemas (if it is
 * the template) or the template brand's schemas (if it is a child). This is how a child brand
 * discovers which custom fields its content tables should render, without needing its own copy of
 * every schema row.
 */
export async function listApplicableFieldSchemas(
  db: Db,
  brandId: string,
  tableName?: string,
): Promise<CustomFieldSchemaListRow[]> {
  const [brand] = await db
    .select({ templateBrandId: brands.templateBrandId })
    .from(brands)
    .where(and(eq(brands.id, brandId), isNull(brands.deletedAt)))
    .limit(1);
  const resolveBrandId = brand?.templateBrandId ?? brandId;
  return listCustomFieldSchemas(db, resolveBrandId, tableName);
}

export interface PropagateCustomFieldResult {
  readonly childrenUpdated: number;
}

export async function propagateCustomFieldSchema(
  db: Db,
  templateBrandId: string,
  schemaId: string,
  actorId: string,
  childBrandIds: string[],
): Promise<PropagateCustomFieldResult> {
  const scope = withBrand(db, templateBrandId);
  const [schema] = await scope
    .select(customFieldSchemas, eq(customFieldSchemas.id, schemaId))
    .limit(1);
  if (schema === undefined || schema.deletedAt !== null) {
    return { childrenUpdated: 0 };
  }

  let childrenUpdated = 0;
  for (const childBrandId of childBrandIds) {
    const childScope = withBrand(db, childBrandId);
    const existing = await childScope
      .select(
        customFieldSchemas,
        and(
          eq(customFieldSchemas.tableName, schema.tableName),
          eq(customFieldSchemas.fieldKey, schema.fieldKey),
        ),
      )
      .limit(1);
    if (existing.length > 0) continue;

    await childScope.insert(customFieldSchemas, {
      tableName: schema.tableName,
      fieldKey: schema.fieldKey,
      fieldType: schema.fieldType,
      fieldLabel: schema.fieldLabel,
      options: schema.options,
      sortOrder: schema.sortOrder,
      createdBy: actorId,
      updatedBy: actorId,
    });
    childrenUpdated++;
  }

  return { childrenUpdated };
}

export async function softDeleteCustomFieldSchema(
  db: Db,
  brandId: string,
  id: string,
): Promise<boolean> {
  const rows = await withBrand(db, brandId)
    .softDelete(customFieldSchemas, eq(customFieldSchemas.id, id))
    .returning();
  return rows.length > 0;
}
