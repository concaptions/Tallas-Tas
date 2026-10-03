import { COLUMN_SEED } from '@tas/db';
import { describe, expect, it } from 'vitest';

import type { ResolvedColumnView } from '@/components/views/resolved-columns';

import {
  awarenessLabel,
  awarenessTone,
  personaPanelFrom,
  PERSONA_ANGLES_COLUMN,
  PERSONA_COLUMN_EDITORS,
  PERSONA_NAME_FALLBACK_LABEL,
} from './fields';

const resolved = (...entries: [string, string, number][]): ResolvedColumnView[] =>
  entries.map(([columnKey, displayLabel, displayOrder]) => ({
    columnKey,
    displayLabel,
    displayOrder,
  }));

describe('personaPanelFrom', () => {
  it('takes the label and the order from the resolver and the editor from the map', () => {
    const { fields } = personaPanelFrom(
      resolved(
        ['core_desires', 'Drivers for this persona', 4],
        ['name', 'Name', 1],
        ['stage_of_awareness', 'Problem-Solution Awareness Level', 6],
      ),
    );

    expect(fields.map((field) => [field.label, field.name, field.kind])).toEqual([
      ['Name', 'name', 'input'],
      ['Drivers for this persona', 'coreDesires', 'textarea'],
      ['Problem-Solution Awareness Level', 'stageOfAwareness', 'stage'],
    ]);
  });

  it('relabels without renaming: the same column_key under another brand’s name', () => {
    const desires = (label: string, order: number) =>
      personaPanelFrom(resolved(['name', 'Name', 1], ['core_desires', label, order])).fields.find(
        (field) => field.columnKey === 'core_desires',
      );
    const parent = desires('Core Desires (Cashvertising)', 5);
    const child = desires('Drivers for this persona', 4);

    expect(parent?.label).toBe('Core Desires (Cashvertising)');
    expect(child?.label).toBe('Drivers for this persona');
    // Both write the same Postgres column; only the displayed label differs.
    expect(parent?.name).toBe('coreDesires');
    expect(child?.name).toBe(parent?.name);
  });

  it('lifts the Angles junction out of the fields and reports its resolved label', () => {
    const layout = personaPanelFrom(
      resolved(['name', 'Name', 1], [PERSONA_ANGLES_COLUMN, 'Angles', 7]),
    );

    expect(layout.anglesLabel).toBe('Angles');
    expect(layout.fields.map((field) => field.columnKey)).toEqual(['name']);
  });

  it('has no Angles section when the brand does not resolve the junction', () => {
    expect(personaPanelFrom(resolved(['name', 'Name', 1])).anglesLabel).toBeNull();
  });

  it('reports a resolved column it cannot edit instead of dropping it silently', () => {
    const layout = personaPanelFrom(resolved(['name', 'Name', 1], ['product_id', 'Product', 9]));

    expect(layout.missing).toEqual(['product_id']);
    expect(layout.fields.map((field) => field.columnKey)).toEqual(['name']);
  });

  it('always offers the name field, because the action refuses to save without it', () => {
    // A brand that hid `name` would otherwise be handed a form that can never save.
    const layout = personaPanelFrom(resolved(['psychographic', 'Personality', 3]));

    expect(layout.fields[0]).toMatchObject({
      columnKey: 'name',
      label: PERSONA_NAME_FALLBACK_LABEL,
      required: true,
    });
    expect(layout.fields.filter((field) => field.columnKey === 'name')).toHaveLength(1);
  });

  it('marks only the name field required, and keeps the resolver’s label when it has one', () => {
    const { fields } = personaPanelFrom(
      resolved(['name', 'Persona Name', 1], ['passion', 'Passion', 5]),
    );

    expect(fields.map((field) => [field.label, field.required])).toEqual([
      ['Persona Name', true],
      ['Passion', false],
    ]);
  });

  it('orders by the integer, so 10 follows 2 rather than sorting as text', () => {
    const { fields } = personaPanelFrom(
      resolved(['stage_of_awareness', 'Stage', 10], ['psychographic', 'Personality', 2]),
    );

    // `name` is prepended by the guarantee above; the resolved two keep their integer order.
    expect(fields.map((field) => field.columnKey)).toEqual([
      'name',
      'psychographic',
      'stage_of_awareness',
    ]);
  });

  it('is a name-only form, not a crash, when the resolver returns nothing', () => {
    const layout = personaPanelFrom([]);

    expect(layout.fields.map((field) => field.columnKey)).toEqual(['name']);
    expect(layout.anglesLabel).toBeNull();
    expect(layout.missing).toEqual([]);
  });
});

describe('the persona editor map', () => {
  it('has an editor for every column the seed can make the resolver emit', () => {
    const seeded = COLUMN_SEED.flatMap((group) => group.rows)
      .filter(
        (row) =>
          row.tableKey === 'personas' &&
          row.isHidden !== true &&
          row.columnKey !== PERSONA_ANGLES_COLUMN,
      )
      .map((row) => row.columnKey);

    // The parent's fourteen stored fields plus Gratsi's child-added `passion`, on either base: a
    // brand that unhides a further parent column must get a working editor with no code change.
    expect([...new Set(seeded)].filter((key) => PERSONA_COLUMN_EDITORS[key] === undefined)).toEqual(
      [],
    );
  });

  it('has no editor for the Angles junction, which the LinkField owns', () => {
    expect(PERSONA_COLUMN_EDITORS[PERSONA_ANGLES_COLUMN]).toBeUndefined();
  });
});

describe('the awareness vocabulary', () => {
  it('labels and tones a stage from the pg enum, never a string literal', () => {
    expect(awarenessLabel('solution_aware')).toBe('Solution Aware');
    expect(awarenessTone('most_aware')).toBe('ok');
  });
});
