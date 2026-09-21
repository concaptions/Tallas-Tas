import { awarenessStages, type AwarenessStage } from '@tas/db/schema';
import type { ChipTone } from '@tas/domain/state';

/**
 * The fourteen PRD §5.4 persona fields, grouped as the design handoff groups them, and the awareness
 * stage's presentation. One module, so the panel, the table and the Server Actions cannot drift:
 * the labels a strategist reads, the column each one writes and the tone of the chip are stated once.
 *
 * `stage_of_awareness` values come from `awarenessStages` in `@tas/db` (the pg enum), never a string
 * literal, exactly as status values come from `@tas/domain/state`.
 */
export type PersonaFieldName =
  | 'name'
  | 'dayInTheLife'
  | 'demographic'
  | 'psychographic'
  | 'coreDesires'
  | 'successFactors'
  | 'successTransformation'
  | 'painPoints'
  | 'perceivedBarriers'
  | 'problemChallenge'
  | 'stageOfAwareness'
  | 'buyingTriggers'
  | 'emotionalTriggers'
  | 'triggerWords';

export interface PersonaField {
  readonly name: PersonaFieldName;
  readonly label: string;
  /** `input` is one line, `textarea` is strategist prose, `stage` is the awareness Select. */
  readonly kind: 'input' | 'textarea' | 'stage';
}

export interface PersonaFieldGroup {
  readonly heading: string;
  readonly fields: readonly PersonaField[];
}

/** The five headings, in this order. The panel renders exactly these and nothing else. */
export const PERSONA_FIELD_GROUPS: readonly PersonaFieldGroup[] = [
  {
    heading: 'Identity',
    fields: [
      { name: 'name', label: 'Persona Name', kind: 'input' },
      { name: 'dayInTheLife', label: 'A Day in the Life', kind: 'textarea' },
      { name: 'demographic', label: 'Demographic', kind: 'textarea' },
      { name: 'psychographic', label: 'Psychographic', kind: 'textarea' },
    ],
  },
  {
    heading: 'Desires',
    fields: [
      { name: 'coreDesires', label: 'Core Desires', kind: 'textarea' },
      { name: 'successFactors', label: 'Success Factors', kind: 'textarea' },
      { name: 'successTransformation', label: 'Success/Transformation', kind: 'textarea' },
    ],
  },
  {
    heading: 'Barriers',
    fields: [
      { name: 'painPoints', label: 'Pain Points', kind: 'textarea' },
      { name: 'perceivedBarriers', label: 'Perceived Barriers', kind: 'textarea' },
      { name: 'problemChallenge', label: 'Problem/Challenge', kind: 'textarea' },
    ],
  },
  {
    heading: 'Buying Behaviour',
    fields: [
      { name: 'stageOfAwareness', label: 'Stage of Market Awareness', kind: 'stage' },
      { name: 'buyingTriggers', label: 'Buying Triggers', kind: 'textarea' },
      { name: 'emotionalTriggers', label: 'Emotional Triggers', kind: 'textarea' },
    ],
  },
  {
    heading: 'Language',
    fields: [{ name: 'triggerWords', label: 'Trigger Words', kind: 'input' }],
  },
];

/** Every field, flattened; the Server Actions' zod schema is built from this list. */
export const PERSONA_FIELDS: readonly PersonaField[] = PERSONA_FIELD_GROUPS.flatMap(
  (group) => group.fields,
);

/** The human label and chip tone of each of Breakthrough Advertising's five stages. */
const STAGE_PRESENTATION: Record<AwarenessStage, { label: string; tone: ChipTone }> = {
  unaware: { label: 'Unaware', tone: 'mute' },
  problem_aware: { label: 'Problem Aware', tone: 'warn' },
  solution_aware: { label: 'Solution Aware', tone: 'info' },
  product_aware: { label: 'Product Aware', tone: 'info' },
  most_aware: { label: 'Most Aware', tone: 'ok' },
};

/** The five stages in their canonical order, coldest first, ready for the Select and the chip. */
export const AWARENESS_OPTIONS: readonly {
  value: AwarenessStage;
  label: string;
  tone: ChipTone;
}[] = awarenessStages.map((value) => ({ value, ...STAGE_PRESENTATION[value] }));

export function awarenessLabel(stage: AwarenessStage): string {
  return STAGE_PRESENTATION[stage].label;
}

export function awarenessTone(stage: AwarenessStage): ChipTone {
  return STAGE_PRESENTATION[stage].tone;
}

/** The dash a null cell or an unset field shows, so an empty value is never a blank gap. */
export const EM_DASH = '—';
export const NOT_SET = 'Not set';
