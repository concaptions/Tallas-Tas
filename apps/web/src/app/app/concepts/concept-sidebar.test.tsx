// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadConceptColumns, loadConcepts } from '@/lib/concepts-source';
import { conceptPath } from '@/lib/routes';

import { ConceptsWorkspace } from './concepts-workspace';
import {
  EMPTY_CONCEPT_RECORD,
  clientStatusView,
  internalStatusView,
  type ConceptItem,
} from './fields';

/**
 * The Concepts read-only sidebar (Ticket 9, part 3): a row click opens the shared `RecordSheet`
 * with the brand's grid columns under `ReadOnlyFields`, the counter and the two chevrons wired to
 * the grid-visible order. The portal renders to document.body, so the queries go through it.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('./bulk-actions', () => ({
  deleteConceptsAction: vi.fn(),
  bulkMoveConceptsAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

async function mount() {
  const demoMode = () => true;
  const [{ rows }, { columns }] = await Promise.all([
    loadConcepts({ demoMode }),
    loadConceptColumns({ demoMode }),
  ]);
  const items: ConceptItem[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    batch: row.batch,
    angleName: row.angleName,
    personaName: row.personaName,
    productName: row.productName,
    themeName: row.themeName,
    href: conceptPath(row.id),
    ...EMPTY_CONCEPT_RECORD,
    status: internalStatusView(row.internalStatus),
    clientStatus: clientStatusView(row.clientStatus),
  }));
  const utils = render(
    <ConceptsWorkspace
      columns={columns}
      items={items}
      demo
      initialView="table"
      initialSearch=""
      userViews={{ userId: null, views: [] }}
    />,
  );
  return { ...utils, items };
}

const slot = (name: string): Element | null => document.body.querySelector(`[data-slot="${name}"]`);

describe('Concepts sidebar (Ticket 9, part 3)', () => {
  it('a row click opens the shared record sheet with the counter and both chevrons', async () => {
    const { container } = await mount();
    const row = container.querySelector('[data-slot="concept-row"]');
    if (row === null) throw new Error('no concept row');

    fireEvent.click(row);

    expect(slot('record-sheet')).not.toBeNull();
    expect(slot('record-sheet-counter')?.textContent).toMatch(/1 \/ \d+/);
    expect(slot('record-sheet-prev')).not.toBeNull();
    expect(slot('record-sheet-next')).not.toBeNull();
    expect(slot('concept-panel-name')?.getAttribute('href')).toBe(
      (row as HTMLElement).getAttribute('data-concept-id') === null
        ? null
        : conceptPath((row as HTMLElement).getAttribute('data-concept-id') ?? ''),
    );
  });

  it('clicking the next chevron advances the counter', async () => {
    const { container } = await mount();
    const rows = container.querySelectorAll('[data-slot="concept-row"]');
    if (rows.length < 2) throw new Error('expected at least two fixture rows');
    fireEvent.click(rows[0] as Element);

    const counter = slot('record-sheet-counter');
    const first = counter?.textContent ?? '';
    expect(first.startsWith('1 /')).toBe(true);

    const next = slot('record-sheet-next') as HTMLButtonElement | null;
    if (next === null) throw new Error('no next chevron');
    fireEvent.click(next);

    const second = slot('record-sheet-counter')?.textContent ?? '';
    expect(second.startsWith('2 /')).toBe(true);
  });
});
