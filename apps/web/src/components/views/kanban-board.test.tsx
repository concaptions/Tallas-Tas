import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { KanbanBoard, type KanbanItem } from './kanban-board';

const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgb\(/;

const items: readonly KanbanItem[] = [
  { id: 'a', name: 'TV01-B3-CasualHangouts-V1', groupValue: 'draft', chipLabel: 'Draft' },
  { id: 'b', name: 'TV01-B3-CasualHangouts-V2', groupValue: 'draft', accentTone: 'ok' },
  { id: 'c', name: 'TS02-B3-CasualHangouts-V1', groupValue: 'approved', chipLabel: 'Approved' },
];

describe('KanbanBoard column header (B6.V13, B6.V14)', () => {
  const markup = renderToStaticMarkup(
    <KanbanBoard
      items={items}
      columns={['draft', 'approved']}
      columnLabels={{ draft: 'Draft', approved: 'Approved' }}
      onMove={() => undefined}
      demo
    />,
  );

  it('counts each column as bare mono text, never a pill, under a 600 heading', () => {
    expect(markup).toMatch(
      /<span class="font-mono text-\[10px\] text-text3" data-slot="column-count">2<\/span>/,
    );
    expect(markup).toMatch(
      /<span class="font-mono text-\[10px\] text-text3" data-slot="column-count">1<\/span>/,
    );
    expect(markup).not.toContain('rounded-full');
    expect(markup).toMatch(/<span class="text-xs font-semibold text-text2">Draft<\/span>/);
    expect(markup).toContain('data-slot="kanban-board"');
    expect(markup.match(/data-slot="kanban-card"/g)).toHaveLength(3);
  });

  it('holds no colour literal', () => {
    expect(markup).not.toMatch(COLOUR_LITERAL);
  });
});
