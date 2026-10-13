import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  AirtableGridEmptyStory,
  AirtableGridSelectionStory,
  AirtableGridStory,
} from './airtable-grid.stories';

/**
 * The grid stories rendered as the server page renders them: the three row states board 3
 * draws sit in one grid (B3.V5 / B3.V29), the status cell is the one pill, and no story names a
 * colour outside the token layer.
 */
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgb\(/;

describe('AirtableGridSelectionStory', () => {
  const html = renderToStaticMarkup(<AirtableGridSelectionStory />);

  it('shows the ticked, the open and the context-menu row at once', () => {
    expect(html).toContain('data-checked="true"');
    expect(html).toContain('data-state="selected"');
    expect(html).toContain('data-context="open"');
    expect(html.match(/data-checked="true"/g)).toHaveLength(1);
    expect(html.match(/data-slot="row-select"/g)).toHaveLength(3);
  });

  it('leaves the header box indeterminate while one of three rows is ticked', () => {
    expect(html).toMatch(/data-slot="select-all"[^>]*data-state="some"/);
    expect(html).toContain('lucide-minus');
  });

  it('uses the token layer only', () => {
    expect(html).not.toMatch(COLOUR_LITERAL);
  });
});

describe('AirtableGridStory and AirtableGridEmptyStory', () => {
  it('draw the status cell as StatusChip and name no colour literal', () => {
    const html = renderToStaticMarkup(<AirtableGridStory />);
    expect(html.match(/data-slot="status-chip"/g)).toHaveLength(3);
    expect(html).not.toMatch(COLOUR_LITERAL);
    expect(renderToStaticMarkup(<AirtableGridEmptyStory />)).not.toMatch(COLOUR_LITERAL);
  });
});
