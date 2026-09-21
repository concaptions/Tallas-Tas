import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';

export const onboardingFormStatuses = ['draft', 'published', 'closed'] as const;
export type OnboardingFormStatus = (typeof onboardingFormStatuses)[number];

export const onboardingForms = pgTable(
  'onboarding_forms',
  {
    ...baseColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').$type<OnboardingFormStatus>().notNull().default('draft'),
    fieldsJson: text('fields_json').notNull().default('[]'),
    submissionsCount: text('submissions_count').notNull().default('0'),
    shareToken: text('share_token').notNull().unique(),
  },
  (table) => [index('onboarding_forms_brand_id_idx').on(table.brandId)],
);

export type OnboardingForm = typeof onboardingForms.$inferSelect;
export type NewOnboardingForm = typeof onboardingForms.$inferInsert;
