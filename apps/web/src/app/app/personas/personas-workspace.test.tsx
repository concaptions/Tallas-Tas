import { renderToStaticMarkup } from 'react-dom/server';
import { COLUMN_SEED, demoPersonas } from '@tas/db';
import { describe, expect, it } from 'vitest';

import { gridColumnsFrom } from '@/components/views/resolved-columns';
import { EmptyCell } from '@/components/views/grid-cells';

import { awarenessLabel, PERSONA_ANGLES_COLUMN, PERSONA_COLUMN_EDITORS } from './fields';
import { PERSONA_RENDERERS, type PersonaItem } from './personas-workspace';

/** Every Personas column the seed can make the resolver emit, parent set and Gratsi's departures. */
const seededColumns: readonly string[] = [
  ...new Set(
    COLUMN_SEED.flatMap((group) => group.rows)
      .filter((row) => row.tableKey === 'personas' && row.isHidden !== true)
      .map((row) => row.columnKey),
  ),
];

const [fixture] = demoPersonas;
if (fixture === undefined) {
  throw new Error('the demo fixtures are empty');
}
/** The narrowed row, bound once: a hoisted function below cannot see the guard above. */
const first = fixture;
const item: PersonaItem = { persona: first, updatedLabel: '', updatedTitle: '' };

/** The dash cell, as markup. A cell that contains this drew nothing from the row. */
const EMPTY_CELL = renderToStaticMarkup(<EmptyCell />);

function markupOf(columnKey: string): string {
  const renderer = PERSONA_RENDERERS[columnKey];
  if (renderer === undefined) {
    throw new Error(`no renderer for ${columnKey}`);
  }
  return renderToStaticMarkup(<>{renderer.render(item)}</>);
}

/** The cell's visible text: tags removed and React's five text escapes undone. */
function textOf(markup: string): string {
  return markup
    .replace(/<[^>]*>/gu, '')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

/**
 * What each seeded column must SHOW for the first fixture, derived from the fixture itself rather
 * than retyped — so this is the row's own stored value, not a string that happens to match.
 *
 * It THROWS for a column the fixture has no value for: a seeded column added later with nothing
 * behind it must fail here loudly instead of being silently excused, which is how the assertion
 * below stays falsifiable.
 */
function expectedText(columnKey: string): string {
  if (columnKey === PERSONA_ANGLES_COLUMN) {
    const names = first.angleNames.join(', ');
    if (names === '') throw new Error('the fixture has no linked angles');
    return names;
  }
  const editor = PERSONA_COLUMN_EDITORS[columnKey];
  if (editor === undefined) {
    throw new Error(`no editor maps ${columnKey} to a field of the row`);
  }
  if (editor.kind === 'stage') {
    // The chip's label, from the awareness vocabulary — never the raw enum value.
    if (first.stageOfAwareness === null) throw new Error('the fixture has no awareness stage');
    return awarenessLabel(first.stageOfAwareness);
  }
  const stored = first[editor.name];
  if (typeof stored !== 'string' || stored.trim() === '') {
    throw new Error(`the fixture stores nothing for ${columnKey}`);
  }
  return stored;
}

describe('PERSONA_RENDERERS', () => {
  it('draws every column the seed can resolve, on either base', () => {
    const { missing } = gridColumnsFrom(
      seededColumns.map((columnKey, index) => ({
        columnKey,
        displayLabel: columnKey,
        displayOrder: index,
      })),
      PERSONA_RENDERERS,
    );

    // A column with no renderer is reported rather than dropped, so this is the assertion that
    // keeps the page honest as further brands unhide further parent columns.
    expect(missing).toEqual([]);
  });

  it('puts the fixture’s own stored value in every seeded cell, and no dash in any of them', () => {
    expect(seededColumns).toHaveLength(16);

    for (const columnKey of seededColumns) {
      expect(PERSONA_RENDERERS[columnKey]).toBeDefined();
      const markup = markupOf(columnKey);

      expect(textOf(markup)).toContain(expectedText(columnKey));
      // Not "contains no em dash": the fixture's own NAME contains one. What a populated column
      // must never render is the EmptyCell, which is what a dropped or mismapped value looks like.
      expect(markup).not.toContain(EMPTY_CELL);
    }
  });

  it('renders the awareness stage through the shared chip, with its vocabulary label', () => {
    const markup = markupOf('stage_of_awareness');

    expect(markup).toContain('data-slot="status-chip"');
    expect(textOf(markup)).toBe(expectedText('stage_of_awareness'));
  });

  it('draws the dash, not an empty cell, for a column the row has no value in', () => {
    const blank: PersonaItem = {
      persona: { ...first, coreDesires: null, angleNames: [] },
      updatedLabel: '',
      updatedTitle: '',
    };

    for (const columnKey of ['core_desires', PERSONA_ANGLES_COLUMN]) {
      const renderer = PERSONA_RENDERERS[columnKey];
      expect(renderToStaticMarkup(<>{renderer?.render(blank)}</>)).toBe(EMPTY_CELL);
    }
  });

  it('supplies no header of its own — labels and order are the resolver’s', () => {
    const { columns } = gridColumnsFrom(
      [{ columnKey: 'core_desires', displayLabel: 'Drivers for this persona', displayOrder: 1 }],
      PERSONA_RENDERERS,
    );

    expect(columns.map((column) => column.header)).toEqual(['Drivers for this persona']);
  });

  it('sorts the name, the awareness stage and the linked angles', () => {
    expect(PERSONA_RENDERERS['name']?.sortValue?.(item)).toBe(first.name);
    expect(PERSONA_RENDERERS['stage_of_awareness']?.sortValue?.(item)).toBe(first.stageOfAwareness);
    expect(PERSONA_RENDERERS['angle_personas']?.sortValue?.(item)).toBe(first.angleNames.length);
  });
});
