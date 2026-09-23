import type { Db } from './db';
import { annotations, type Annotation, type NewAnnotation } from './schema';
import { withBrand } from './tenancy';

type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

export type AnnotationInput = Omit<NewAnnotation, ManagedColumn>;

export async function insertAnnotation(
  db: Db,
  brandId: string,
  values: AnnotationInput,
  actorId: string,
): Promise<Annotation> {
  const [row] = await withBrand(db, brandId)
    .insert(annotations, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('annotations insert returned no row');
  }
  return row;
}
