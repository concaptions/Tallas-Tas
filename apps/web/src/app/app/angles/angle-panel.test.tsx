// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { demoAngles } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AnglePanel } from './angle-panel';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

/**
 * The Ticket 9 part-2 wiring: the angle panel rides the shared `RecordSheet`, so this file pins
 * the shell's record counter and prev/next buttons, and the keyboard walk. Form behaviour (the
 * six field groups, the formats toggles, the ad-inspo editor, the status select) is covered by
 * the e2e and the domain's validator tests.
 */
const [angle] = demoAngles;
if (angle === undefined) {
  throw new Error('demoAngles is empty');
}

/** The sheet renders into a portal, so queries go through document.body. */
const findSlot = (slot: string): Element | null =>
  document.body.querySelector(`[data-slot="${slot}"]`);

afterEach(() => {
  cleanup();
});

describe('AnglePanel inside RecordSheet (Ticket 9 part 2)', () => {
  it('renders the sheet shell with counter and both prev/next buttons', () => {
    render(
      <AnglePanel
        angle={angle}
        personas={[]}
        products={[]}
        creativeModules={[]}
        concepts={[]}
        creativeDesigns={[]}
        demo
        nav={{ prevId: 'a', nextId: 'c', counter: '2 / 5' }}
        onNavigate={() => undefined}
        onClose={() => undefined}
        onSaved={() => undefined}
      />,
    );
    expect(findSlot('record-sheet')).not.toBeNull();
    expect(findSlot('record-sheet-counter')?.textContent).toBe('2 / 5');
    expect(findSlot('record-sheet-prev')).not.toBeNull();
    expect(findSlot('record-sheet-next')).not.toBeNull();
    expect(findSlot('angle-panel-title')?.textContent).toBe(angle.name);
  });

  it('ArrowRight on the sheet body calls onNavigate with the next id', () => {
    const onNavigate = vi.fn();
    render(
      <AnglePanel
        angle={angle}
        personas={[]}
        products={[]}
        creativeModules={[]}
        concepts={[]}
        creativeDesigns={[]}
        demo
        nav={{ prevId: 'a', nextId: 'c', counter: '2 / 5' }}
        onNavigate={onNavigate}
        onClose={() => undefined}
        onSaved={() => undefined}
      />,
    );
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onNavigate).toHaveBeenCalledWith('c');
  });
});
