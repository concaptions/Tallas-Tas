import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { indexConceptsByAngle } from '@/app/app/angles/fields';

import { EmptyCell } from './grid-cells';
import {
  LinkedRecordsCell,
  linkedRecordsRenderer,
  linkedRecordsTitle,
  type LinkedRecordRef,
} from './linked-records-cell';

/**
 * The ONE read-only "linked records" grid cell (GRATSI-MATCH 2026-10-04): reverse links render as
 * the linked records' NAMES, never as bare counts and never as an editor. The angles case below is
 * the loader proof the QA plan asks for — a row's `Concepts` column carries the concept names that
 * `concept_angles` links, through the same index the page builds for its panel.
 */

const records: readonly LinkedRecordRef[] = [
  { id: 'a', label: 'TS1-B1-Good Taste-V1', href: '/app/concepts/a' },
  { id: 'b', label: 'TS2-B1-No Hangover-V2' },
];

describe('LinkedRecordsCell', () => {
  it('renders every linked record name, a real anchor where the record has a page', () => {
    const markup = renderToStaticMarkup(<LinkedRecordsCell records={records} mono />);
    expect(markup).toContain('TS1-B1-Good Taste-V1');
    expect(markup).toContain('TS2-B1-No Hangover-V2');
    expect(markup).toContain('href="/app/concepts/a"');
    // Generated names render in the mono face (CLAUDE.md UI governance).
    expect(markup).toContain('font-mono');
  });

  it('shows the dash for a row nothing links, like every other empty cell', () => {
    expect(renderToStaticMarkup(<LinkedRecordsCell records={[]} />)).toBe(
      renderToStaticMarkup(<EmptyCell />),
    );
  });

  it('collapses past three into +N and keeps the WHOLE list in the title', () => {
    const many: LinkedRecordRef[] = ['One', 'Two', 'Three', 'Four', 'Five'].map((label, index) => ({
      id: String(index),
      label,
    }));
    const markup = renderToStaticMarkup(<LinkedRecordsCell records={many} />);
    expect(markup).toContain('+2');
    expect(markup).not.toContain('>Four<');
    expect(linkedRecordsTitle(many)).toBe('One, Two, Three, Four, Five');
  });

  it('carries the concept NAMES onto an angle row, through the page’s own index', () => {
    // The reverse side of `concept_angles`, exactly as the angles page builds it for its panel.
    const byAngle = indexConceptsByAngle(
      [
        {
          id: 'c1',
          name: 'B1-Hydration-Morning',
          angleIds: ['angle-1'],
          internalStatus: 'approved',
        },
        { id: 'c2', name: 'B2-Hydration-Night', angleIds: ['angle-1'], internalStatus: 'approved' },
      ],
      'video',
    );
    const renderer = linkedRecordsRenderer(
      (row: { readonly id: string }) => byAngle[row.id] ?? [],
      { mono: true },
    );

    const markup = renderToStaticMarkup(<>{renderer.render({ id: 'angle-1' })}</>);
    expect(markup).toContain('B1-Hydration-Morning');
    expect(markup).toContain('B2-Hydration-Night');
    expect(renderer.sortValue?.({ id: 'angle-1' })).toBe(2);
    expect(renderer.cellTitle?.({ id: 'angle-1' })).toBe(
      'B1-Hydration-Morning, B2-Hydration-Night',
    );
    // An angle nothing links renders the dash, not a crash and not an empty string.
    expect(renderToStaticMarkup(<>{renderer.render({ id: 'angle-9' })}</>)).toBe(
      renderToStaticMarkup(<EmptyCell />),
    );
  });
});
