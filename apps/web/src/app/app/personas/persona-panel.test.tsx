// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { demoPersonas } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PersonaPanel } from './persona-panel';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

/**
 * The Ticket 9 part-2 wiring: the persona panel rides the shared `RecordSheet`, so this file pins
 * the shell's record counter and prev/next buttons, and the keyboard walk. Form behaviour is
 * covered by the e2e and the action tests, not re-covered here.
 */
const [persona] = demoPersonas;
if (persona === undefined) {
  throw new Error('demoPersonas is empty');
}
const COLUMNS = [{ columnKey: 'name', displayLabel: 'Name', displayOrder: 1 }] as const;

/** The sheet renders into a portal, so queries go through document.body. */
const findSlot = (slot: string): Element | null =>
  document.body.querySelector(`[data-slot="${slot}"]`);

afterEach(() => {
  cleanup();
});

describe('PersonaPanel inside RecordSheet (Ticket 9 part 2)', () => {
  it('renders the sheet shell with counter and both prev/next buttons', () => {
    render(
      <PersonaPanel
        persona={persona}
        columns={COLUMNS}
        demo
        nav={{ prevId: 'a', nextId: 'c', counter: '2 / 3' }}
        onNavigate={() => undefined}
        onClose={() => undefined}
        onSaved={() => undefined}
      />,
    );
    expect(findSlot('record-sheet')).not.toBeNull();
    expect(findSlot('record-sheet-counter')?.textContent).toBe('2 / 3');
    expect(findSlot('record-sheet-prev')).not.toBeNull();
    expect(findSlot('record-sheet-next')).not.toBeNull();
    expect(findSlot('persona-panel-title')?.textContent).toBe(persona.name);
  });

  it('ArrowRight on the sheet body calls onNavigate with the next id', () => {
    const onNavigate = vi.fn();
    render(
      <PersonaPanel
        persona={persona}
        columns={COLUMNS}
        demo
        nav={{ prevId: 'a', nextId: 'c', counter: '2 / 3' }}
        onNavigate={onNavigate}
        onClose={() => undefined}
        onSaved={() => undefined}
      />,
    );
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onNavigate).toHaveBeenCalledWith('c');
  });
});
