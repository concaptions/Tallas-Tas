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
  | 'triggerWords'
  | 'passion';

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

/**
 * THE Personas fields, as the Gratsi base defines them (`docs/decisions/gratsi-display-spec-2026-10-02.md`).
 *
 * The Airtable Gratsi base `appllDG4OmkK2Hdnn` is the source of truth for what this page shows, so
 * the label is GRATSI'S field name and the `name` is our column — a relabelling in the UI only; no
 * column was renamed in the database. Seven fields, in the base's own order.
 *
 * `PERSONA_HIDDEN_FIELDS` below lists the columns this page deliberately does NOT show, because the
 * Gratsi base has no field for them. They are not deprecated and nothing was dropped: Niagara Sleep
 * Solutions populates every one of them on all three of its personas, so the data stays and stays
 * readable through its own brand's surfaces. Per-brand visibility belongs in the `column_definitions`
 * table (docs/audits/inheritance-plan-2026-10-02.md), not in this hard-coded list — which is why this
 * constant is temporary scaffolding, not the destination.
 */
export const PERSONA_FIELD_GROUPS: readonly PersonaFieldGroup[] = [
  {
    heading: 'Persona',
    fields: [
      { name: 'name', label: 'Name', kind: 'input' },
      { name: 'demographic', label: 'Description [Age Status Salary]', kind: 'textarea' },
      { name: 'psychographic', label: 'Personality', kind: 'textarea' },
      { name: 'coreDesires', label: 'Drivers for this persona', kind: 'textarea' },
      { name: 'passion', label: 'Passion', kind: 'textarea' },
      { name: 'stageOfAwareness', label: 'Problem-Solution Awareness Level', kind: 'stage' },
    ],
  },
];

/**
 * Columns the Personas page hides because the Gratsi base defines no field for them. Kept in the
 * database with their data (see the schema comment on `personas`), and listed here rather than
 * silently omitted so the next reader can tell a deliberate omission from an oversight.
 */
export const PERSONA_HIDDEN_FIELDS: readonly string[] = [
  'dayInTheLife',
  'emotionalTriggers',
  'painPoints',
  'successFactors',
  'perceivedBarriers',
  'buyingTriggers',
  'problemChallenge',
  'successTransformation',
  'triggerWords',
  'productId',
];

/** Every field, flattened; the Server Actions' zod schema is built from this list. */
export const PERSONA_FIELDS: readonly PersonaField[] = PERSONA_FIELD_GROUPS.flatMap(
  (group) => group.fields,
);

/** The human label and chip tone of each of Breakthrough Advertising's five stages. */
const STAGE_PRESENTATION: Record<AwarenessStage, { label: string; tone: ChipTone }> = {
  unaware: { label: 'Unaware', tone: 'mute' },
  unaware_to_problem_aware: { label: 'Unaware → Problem Aware', tone: 'warn' },
  problem_aware: { label: 'Problem Aware', tone: 'warn' },
  problem_aware_to_solution_aware: { label: 'Problem Aware → Solution Aware', tone: 'info' },
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
