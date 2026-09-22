import { check, index, pgTable, real, text, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { baseColumns } from '../columns';
import { brands } from './brands';

/**
 * Frame-level annotations on a creative or copywriting record (PRD §10, Sprint 6): a pin at an
 * (x, y) position on an image or a pin at a timestamp in a video, authored by anyone with brand
 * access — internal team or client. `recordType` + `recordId` are polymorphic: the same table
 * holds annotations on creative_briefs, copywriting and any future record type a page renders.
 *
 * Two kinds, enforced by check constraints:
 *  - `video_timestamp`: requires `timestamp_seconds`, x/y must be null.
 *  - `image_xy`: requires x AND y (normalised 0–1), timestamp must be null.
 */
export const annotations = pgTable(
  'annotations',
  {
    ...baseColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    recordType: text('record_type').notNull(),
    recordId: uuid('record_id').notNull(),
    authorId: text('author_id').notNull(),
    authorName: text('author_name').notNull(),
    kind: text('kind').$type<'video_timestamp' | 'image_xy'>().notNull(),
    timestampSeconds: real('timestamp_seconds'),
    x: real('x'),
    y: real('y'),
    body: text('body').notNull(),
  },
  (table) => [
    index('annotations_brand_record_idx').on(table.brandId, table.recordType, table.recordId),
    check(
      'annotations_video_timestamp_check',
      sql`${table.kind} != 'video_timestamp' OR ${table.timestampSeconds} IS NOT NULL`,
    ),
    check(
      'annotations_image_xy_check',
      sql`${table.kind} != 'image_xy' OR (${table.x} IS NOT NULL AND ${table.y} IS NOT NULL)`,
    ),
  ],
);

export type Annotation = typeof annotations.$inferSelect;
export type NewAnnotation = typeof annotations.$inferInsert;
