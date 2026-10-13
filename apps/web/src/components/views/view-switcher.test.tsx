import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ViewSwitcher } from './view-switcher';

// The preference save is a Server Action; it is never reached from a markup test.
vi.mock('@/lib/view-preference-actions', () => ({ saveViewPreferenceAction: vi.fn() }));

const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgb\(/;

describe('ViewSwitcher', () => {
  const markup = renderToStaticMarkup(
    <ViewSwitcher
      tableKey="creative-sheet"
      supportedViews={['grid', 'kanban', 'focus']}
      activeView="grid"
      onViewChange={() => undefined}
      kanbanGroupByField={null}
    />,
  );

  it('draws a lucide glyph before every tab label (B1.V24)', () => {
    expect(markup.match(/<svg/g)).toHaveLength(3);
    expect(markup).toMatch(/<svg[^>]*class="[^"]*size-3\.5/);
    expect(markup).toMatch(/<svg[^>]*stroke-width="1\.8"/);
    expect(markup).toMatch(/<svg[^>]*aria-hidden="true"/);
    for (const label of ['Grid', 'Kanban', 'Focus Mode']) {
      expect(markup).toContain(`</svg>${label}</button>`);
    }
  });

  it('wears the boards’ pill: bordered list on the card radius, small tabs; keeps the tab slots', () => {
    expect(markup).toMatch(/data-slot="tabs-list"[^>]*class="[^"]*border border-line/);
    expect(markup).toMatch(/data-slot="tabs-list"[^>]*class="[^"]*rounded-card/);
    expect(markup).toMatch(/data-slot="tabs-trigger"[^>]*class="[^"]*text-xs/);
    expect(markup.match(/data-slot="tabs-trigger"/g)).toHaveLength(3);
    expect(markup).not.toContain('rounded-full');
  });

  it('renders nothing for a table with one view', () => {
    expect(
      renderToStaticMarkup(
        <ViewSwitcher
          tableKey="themes"
          supportedViews={['grid']}
          activeView="grid"
          onViewChange={() => undefined}
          kanbanGroupByField={null}
        />,
      ),
    ).toBe('');
  });

  it('holds no colour literal', () => {
    expect(markup).not.toMatch(COLOUR_LITERAL);
  });
});
