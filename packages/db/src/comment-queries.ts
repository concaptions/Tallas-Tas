import type { Db } from './db';
import { comments, type Comment, type NewComment } from './schema';
import { withBrand } from './tenancy';

type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

export type CommentInput = Omit<NewComment, ManagedColumn>;

export async function insertComment(
  db: Db,
  brandId: string,
  values: CommentInput,
  actorId: string,
): Promise<Comment> {
  const [row] = await withBrand(db, brandId)
    .insert(comments, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('comments insert returned no row');
  }
  return row;
}
