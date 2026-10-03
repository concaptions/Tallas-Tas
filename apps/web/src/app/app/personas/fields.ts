import { awarenessStages, type AwarenessStage } from '@tas/db/schema';
import type { ChipTone } from '@tas/domain/state';

import { orderColumns, type ResolvedColumnView } from '@/components/views/resolved-columns';

/**
 * The Personas page's field vocabulary, and the awareness stage's presentation.
 *
 * WHICH columns this page shows, in WHAT order and under WHICH labels is no longer decided here: it
 * comes from `resolveColumns(db, brandId, 'personas')` (`packages/db/src/column-definitions.ts`) —
 * the parent template's master set, as each brand departs from it — so a relabel or a reorder is an
 * edit to `column_definitions` and never an edit to this file. The hand-narrowed
 * `PERSONA_FIELD_GROUPS` / `PERSONA_HIDDEN_FIELDS` that used to live here were scaffolding for
 * exactly one brand and are gone.
 *
 * What stays is the part that cannot be expressed as data:
 *
 * - `PERSONA_COLUMN_EDITORS` — the Postgres column (`core_desires`, the resolver's `column_key`)
 *   mapped to the camelCase field the form posts under and `PersonaListRow` carries (`coreDesires`),
 *   plus whether it is edited as a line, a paragraph or the awareness Select.
 * - the awareness vocabulary's labels and chip tones, keyed off `awarenessStages` from
 *   `@tas/db/schema` (the pg enum), never a string literal.
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

/** `input` is one line, `textarea` is strategist prose, `stage` is the awareness Select. */
export type PersonaFieldKind = 'input' | 'textarea' | 'stage';

export interface PersonaFieldEditor {
  readonly name: PersonaFieldName;
  readonly kind: PersonaFieldKind;
}

/** The record's own column: NOT NULL in Postgres and `min(1)` in the action's schema. */
export const PERSONA_NAME_COLUMN = 'name';

/** What the name field is labelled when the resolver returns no row for it at all. */
export const PERSONA_NAME_FALLBACK_LABEL = 'Name';

/** The two-way Angles link. Its `column_key` is the junction table, not a stored column. */
export const PERSONA_ANGLES_COLUMN = 'angle_personas';

const NAME_EDITOR: PersonaFieldEditor = { name: 'name', kind: 'input' };

/**
 * Every persona column this page knows how to EDIT, keyed by the resolver's `column_key`.
 *
 * Wider than any one brand displays, on purpose: a brand whose parent row is visible for
 * `trigger_words` must get a working editor for it without a code change, which is the whole point
 * of resolving the column set at read time. A `column_key` absent from here is reported as missing
 * (see `personaPanelFrom`), never silently dropped.
 */
export const PERSONA_COLUMN_EDITORS: Readonly<Record<string, PersonaFieldEditor>> = {
  name: NAME_EDITOR,
  day_in_the_life: { name: 'dayInTheLife', kind: 'textarea' },
  demographic: { name: 'demographic', kind: 'textarea' },
  psychographic: { name: 'psychographic', kind: 'textarea' },
  core_desires: { name: 'coreDesires', kind: 'textarea' },
  passion: { name: 'passion', kind: 'textarea' },
  emotional_triggers: { name: 'emotionalTriggers', kind: 'textarea' },
  pain_points: { name: 'painPoints', kind: 'textarea' },
  success_factors: { name: 'successFactors', kind: 'textarea' },
  perceived_barriers: { name: 'perceivedBarriers', kind: 'textarea' },
  stage_of_awareness: { name: 'stageOfAwareness', kind: 'stage' },
  buying_triggers: { name: 'buyingTriggers', kind: 'textarea' },
  problem_challenge: { name: 'problemChallenge', kind: 'textarea' },
  success_transformation: { name: 'successTransformation', kind: 'textarea' },
  trigger_words: { name: 'triggerWords', kind: 'textarea' },
};

/** One editable field of the panel: the resolver's label, the form field, the editor to draw. */
export interface PersonaPanelField {
  readonly columnKey: string;
  readonly label: string;
  readonly name: PersonaFieldName;
  readonly kind: PersonaFieldKind;
  /** True for the one field the action refuses to save empty, so the label can say so. */
  readonly required: boolean;
}

export interface PersonaPanelLayout {
  readonly fields: readonly PersonaPanelField[];
  /** The resolved label of the two-way Angles link, or null when this brand does not show it. */
  readonly anglesLabel: string | null;
  /** Resolved column keys with no editor here. Surfaced by the panel, never dropped in silence. */
  readonly missing: readonly string[];
}

/**
 * THE panel's field list, from the resolved columns. The grid's equivalent is `gridColumnsFrom`;
 * this is the same join for an editing form — label and order as data, editor as code.
 *
 * ORDER IS NOT DEFINED HERE. It comes from `orderColumns`, the one comparator the grid adapter uses
 * too, so the panel's field order and the grid's header order cannot drift and the next table to
 * copy this page inherits the helper rather than a second copy of the sort.
 *
 * `angle_personas` is lifted out because it is a junction, not a column: it is edited by the
 * two-way `LinkField`, which writes rows the moment it changes rather than posting with the form.
 *
 * The `name` field is ALWAYS offered, even when the resolver does not return it. `personas.name` is
 * NOT NULL and the action's zod schema requires it, so a brand that hid the column would otherwise
 * be handed a form that can never save; under those conditions a missing control is the bug, not a
 * faithful rendering of the configuration.
 */
export function personaPanelFrom(resolved: readonly ResolvedColumnView[]): PersonaPanelLayout {
  const ordered = orderColumns(resolved);
  const fields: PersonaPanelField[] = [];
  const missing: string[] = [];
  let anglesLabel: string | null = null;

  for (const column of ordered) {
    if (column.columnKey === PERSONA_ANGLES_COLUMN) {
      anglesLabel = column.displayLabel;
      continue;
    }
    const editor = PERSONA_COLUMN_EDITORS[column.columnKey];
    if (editor === undefined) {
      missing.push(column.columnKey);
      continue;
    }
    fields.push({
      columnKey: column.columnKey,
      label: column.displayLabel,
      required: column.columnKey === PERSONA_NAME_COLUMN,
      ...editor,
    });
  }

  if (!fields.some((field) => field.columnKey === PERSONA_NAME_COLUMN)) {
    fields.unshift({
      columnKey: PERSONA_NAME_COLUMN,
      label: PERSONA_NAME_FALLBACK_LABEL,
      required: true,
      ...NAME_EDITOR,
    });
  }

  return { fields, anglesLabel, missing };
}

/** The human label and chip tone of each of Breakthrough Advertising's stages. */
const STAGE_PRESENTATION: Record<AwarenessStage, { label: string; tone: ChipTone }> = {
  unaware: { label: 'Unaware', tone: 'mute' },
  unaware_to_problem_aware: { label: 'Unaware → Problem Aware', tone: 'warn' },
  problem_aware: { label: 'Problem Aware', tone: 'warn' },
  problem_aware_to_solution_aware: { label: 'Problem Aware → Solution Aware', tone: 'info' },
  solution_aware: { label: 'Solution Aware', tone: 'info' },
  product_aware: { label: 'Product Aware', tone: 'info' },
  most_aware: { label: 'Most Aware', tone: 'ok' },
};

/** The stages in their canonical order, coldest first, ready for the Select and the chip. */
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

/** The placeholder an unset field shows, so an empty value reads as unset and not as a gap. */
export const NOT_SET = 'Not set';
