import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';

export const uploadLinks = pgTable(
  'upload_links',
  {
    ...baseColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    token: text('token').notNull().unique(),
    label: text('label').notNull(),
    recipientName: text('recipient_name'),
    recipientEmail: text('recipient_email'),
    maxUploads: text('max_uploads'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    uploadsUsed: text('uploads_used').notNull().default('0'),
    notes: text('notes'),
  },
  (table) => [
    index('upload_links_brand_id_idx').on(table.brandId),
    index('upload_links_token_idx').on(table.token),
  ],
);

export type UploadLink = typeof uploadLinks.$inferSelect;
export type NewUploadLink = typeof uploadLinks.$inferInsert;
