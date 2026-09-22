import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns, propagationColumns } from '../columns';
import { brands } from './brands';

/**
 * AI Characters / Personas: character profiles used for AI-generated content.
 * Branded, propagation-enabled.
 *
 * 12 Airtable fields: Name, Attachments (stored as JSON URLs), Status (single-select),
 * Basic Info, Tone of Voice, Voice Link/Eleven Labs, Personality Traits, Appearance,
 * Traits & Habits, Hobbies & Lifestyle, Work & Background, Why promotes this brand.
 * All long text fields are stored as `text` (unlimited length in Postgres).
 */
export const aiCharacters = pgTable(
  'ai_characters',
  {
    ...baseColumns(),
    ...propagationColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    name: text('name').notNull(),
    attachments: text('attachments'),
    status: text('status'),
    basicInfo: text('basic_info'),
    toneOfVoice: text('tone_of_voice'),
    voiceLink: text('voice_link'),
    personalityTraits: text('personality_traits'),
    appearance: text('appearance'),
    traitsAndHabits: text('traits_and_habits'),
    hobbiesAndLifestyle: text('hobbies_and_lifestyle'),
    workAndBackground: text('work_and_background'),
    whyPromotesBrand: text('why_promotes_brand'),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('ai_characters_brand_id_idx').on(table.brandId),
    index('ai_characters_template_row_id_idx').on(table.templateRowId),
  ],
);

export type AiCharacter = typeof aiCharacters.$inferSelect;
export type NewAiCharacter = typeof aiCharacters.$inferInsert;
