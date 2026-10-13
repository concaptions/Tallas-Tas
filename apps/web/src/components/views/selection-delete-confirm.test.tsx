import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SelectionDeleteConfirm } from './selection-delete-confirm';

const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgb\(/;

function confirm(count: number, disabled = false) {
  return renderToStaticMarkup(
    <SelectionDeleteConfirm
      count={count}
      noun="creative"
      detail="They leave the sheet, the queues and the portal; nothing is erased."
      disabled={disabled}
      onConfirm={() => undefined}
      onCancel={() => undefined}
    />,
  );
}

describe('SelectionDeleteConfirm (B3.A31)', () => {
  it('asks once, counted and pluralised, with the confirming button in its slot', () => {
    const two = confirm(2);
    expect(two).toContain('data-slot="selection-delete-confirm"');
    expect(two).toContain('data-slot="selection-delete-confirm-yes"');
    expect(two.replace(/<!--.*?-->/g, '')).toContain('Delete 2 creatives? They leave the sheet');
    expect(confirm(1).replace(/<!--.*?-->/g, '')).toContain('Delete 1 creative? They leave');
  });

  it('holds the confirming button in demo mode or while a write runs, Cancel stays live', () => {
    const held = confirm(3, true);
    expect(held).toMatch(/data-slot="selection-delete-confirm-yes"[^>]*disabled=""/);
    expect(held).toMatch(/<button[^>]*>Cancel<\/button>/);
    expect(held).not.toMatch(/<button[^>]*disabled=""[^>]*>Cancel<\/button>/);
  });

  it('holds no colour literal', () => {
    expect(confirm(2)).not.toMatch(COLOUR_LITERAL);
  });
});
