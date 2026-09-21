import { eq } from 'drizzle-orm';

import type { Db } from './db';
import { customFieldSchemas, type CustomFieldSchema, type NewCustomFieldSchema } from './schema';
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
