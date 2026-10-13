import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { booleanGroupLabel, statusGroupHeader } from './grid-cells';

const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgb\(/;

describe('statusGroupHeader (B6.V15)', () => {
  it('is the StatusChip toned by chipTone(label), the one tone source', () => {
    const approved = renderToStaticMarkup(<>{statusGroupHeader('Approved')}</>);
    expect(approved).toMatch(/data-slot="status-chip"[^>]*data-tone="ok"[^>]*>Approved</);
    const revisions = renderToStaticMarkup(<>{statusGroupHeader('Revisions Needed')}</>);
    expect(revisions).toContain('data-tone="warn"');
    expect(approved).not.toMatch(COLOUR_LITERAL);
  });
});

describe('booleanGroupLabel (GAP-5)', () => {
  it('reads the two spellings a boolean reaches the grid in as Yes, anything else as No', () => {
    expect(booleanGroupLabel('1')).toBe('Yes');
    expect(booleanGroupLabel('true')).toBe('Yes');
    expect(booleanGroupLabel('0')).toBe('No');
    expect(booleanGroupLabel('false')).toBe('No');
  });
});
