import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { duplicateShortcut, RowContextMenu } from './row-context-menu';

const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgb\(/;

const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const LINUX =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/131.0';

describe('duplicateShortcut (B3.A19)', () => {
  it('spells the command glyph on Apple platforms and Ctrl elsewhere', () => {
    expect(duplicateShortcut(MAC)).toBe('⌘D');
    expect(duplicateShortcut('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('⌘D');
    expect(duplicateShortcut(WINDOWS)).toBe('Ctrl+D');
    expect(duplicateShortcut(LINUX)).toBe('Ctrl+D');
    expect(duplicateShortcut('')).toBe('Ctrl+D');
  });
});

describe('RowContextMenu', () => {
  const markup = renderToStaticMarkup(
    <RowContextMenu
      position={{ x: 40, y: 60 }}
      label="TV01-B3-CasualHangouts-V2"
      onClose={() => undefined}
      items={[
        {
          label: 'Duplicate',
          shortcut: 'Ctrl+D',
          onSelect: () => undefined,
          slot: 'context-duplicate',
        },
        { label: 'Delete', tone: 'bad', divider: true, onSelect: () => undefined },
      ]}
    />,
  );

  it('floats on the board shadow token, keeps its slots and the shortcut hint', () => {
    expect(markup).toContain('data-slot="row-context-menu"');
    expect(markup).toContain('aria-label="Actions for TV01-B3-CasualHangouts-V2"');
    expect(markup).toContain('data-slot="context-duplicate"');
    expect(markup).toContain('Ctrl+D');
    // B3.V2: the floating surface's shadow is the token, not Tailwind's black `shadow-lg`.
    expect(markup).toContain('shadow-float');
    expect(markup).not.toContain('shadow-lg');
  });

  it('holds no colour literal', () => {
    expect(markup).not.toMatch(COLOUR_LITERAL);
  });
});
