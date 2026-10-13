// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RecordSheet } from './record-sheet';

afterEach(() => {
  cleanup();
});

const BASE_NAV = { prevId: 'a', nextId: 'c', counter: '2 / 3' } as const;

/** The Sheet renders into a portal, so queries go through document.body, not the render container. */
const find = (slot: string): Element | null => document.body.querySelector(`[data-slot="${slot}"]`);

describe('RecordSheet header', () => {
  it('renders the counter and both navigation buttons when nav is given', () => {
    render(
      <RecordSheet
        open
        onClose={() => undefined}
        nav={BASE_NAV}
        onNavigate={() => undefined}
        title="Record B"
      >
        <div data-testid="body" />
      </RecordSheet>,
    );
    const counter = find('record-sheet-counter');
    expect(counter?.textContent).toBe('2 / 3');
    const prev = find('record-sheet-prev') as HTMLButtonElement | null;
    const next = find('record-sheet-next') as HTMLButtonElement | null;
    expect(prev).not.toBeNull();
    expect(next).not.toBeNull();
    expect(prev?.disabled).toBe(false);
    expect(next?.disabled).toBe(false);
    expect(find('record-sheet-body')).not.toBeNull();
  });

  it('clicking prev / next calls onNavigate with the right id', () => {
    const onNavigate = vi.fn();
    render(
      <RecordSheet
        open
        onClose={() => undefined}
        nav={BASE_NAV}
        onNavigate={onNavigate}
        title="Record B"
      >
        <div />
      </RecordSheet>,
    );
    fireEvent.click(find('record-sheet-prev') as Element);
    fireEvent.click(find('record-sheet-next') as Element);
    expect(onNavigate).toHaveBeenNthCalledWith(1, 'a');
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'c');
  });

  it('disables prev when prevId is null, next when nextId is null', () => {
    render(
      <RecordSheet
        open
        onClose={() => undefined}
        nav={{ prevId: null, nextId: null, counter: '1 / 1' }}
        onNavigate={() => undefined}
        title="Only"
      >
        <div />
      </RecordSheet>,
    );
    const prev = find('record-sheet-prev') as HTMLButtonElement;
    const next = find('record-sheet-next') as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(true);
  });

  it('omits the whole nav row when nav is undefined', () => {
    render(
      <RecordSheet open onClose={() => undefined} title="Form">
        <div />
      </RecordSheet>,
    );
    expect(find('record-sheet-counter')).toBeNull();
    expect(find('record-sheet-prev')).toBeNull();
  });
});

describe('RecordSheet keyboard', () => {
  it('ArrowRight on the body walks to nextId', () => {
    const onNavigate = vi.fn();
    render(
      <RecordSheet
        open
        onClose={() => undefined}
        nav={BASE_NAV}
        onNavigate={onNavigate}
        title="Record B"
      >
        <div data-testid="body" />
      </RecordSheet>,
    );
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onNavigate).toHaveBeenCalledWith('c');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onNavigate).toHaveBeenCalledWith('a');
  });

  it('ArrowRight inside a text input is ignored', () => {
    const onNavigate = vi.fn();
    render(
      <RecordSheet
        open
        onClose={() => undefined}
        nav={BASE_NAV}
        onNavigate={onNavigate}
        title="Record B"
      >
        <input data-testid="editor" />
      </RecordSheet>,
    );
    const input = document.body.querySelector('[data-testid="editor"]') as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('ArrowRight on a [role=combobox] is ignored', () => {
    const onNavigate = vi.fn();
    render(
      <RecordSheet
        open
        onClose={() => undefined}
        nav={BASE_NAV}
        onNavigate={onNavigate}
        title="Record B"
      >
        <button role="combobox" data-testid="combo" />
      </RecordSheet>,
    );
    const combo = document.body.querySelector('[data-testid="combo"]') as HTMLButtonElement;
    combo.focus();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('Escape calls onClose through the sheet overlay', () => {
    const onClose = vi.fn();
    render(
      <RecordSheet open onClose={onClose} title="Record B">
        <div />
      </RecordSheet>,
    );
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
