// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { GridSelectionOverlay } from './grid-selection-overlay';
import type { GridSelectionState } from './use-grid-selection';

/** A hex colour, a hex-with-alpha or an `rgb(` call — a colour literal in a component is a token-layer defect. */
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgb\(/;

interface Row {
  readonly id: string;
  readonly name: string;
}

const ROW_B: Row = { id: 'b', name: 'Beta' };

const noop = () => undefined;

function stubState(overrides: Partial<GridSelectionState<Row>> = {}): GridSelectionState<Row> {
  return {
    selected: new Set(['a', 'b']),
    gridProps: {
      selection: { selected: new Set(), onToggle: noop, onToggleAll: noop },
      onRowContextMenu: noop,
      contextRowId: null,
    },
    contextMenu: null,
    contextItems: [],
    selectionActions: [
      { label: 'Delete (2)', tone: 'bad', slot: 'selection-delete', onSelect: noop },
    ],
    statusTracks: [
      { key: 'status', label: 'Status', options: [{ key: 'approved', label: 'Approved' }] },
    ],
    statusPicker: null,
    onStatusTrackChange: noop,
    onStatusValueChange: noop,
    onApplyStatus: noop,
    confirmDelete: false,
    deleteDetail: 'Linked records keep their reference and go nameless.',
    onConfirmDelete: noop,
    onCancelDelete: noop,
    notice: null,
    busy: false,
    demo: false,
    rowLabel: (row: Row) => row.name,
    clearSelection: noop,
    closeContextMenu: noop,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe('GridSelectionOverlay', () => {
  it('draws the bar over a selection, pluralised through the plural prop', () => {
    const { container } = render(
      <GridSelectionOverlay state={stubState()} noun="copy" plural="copies" />,
    );
    const html = container.innerHTML;
    expect(html).toContain('data-slot="selection-bar"');
    expect(html).toContain('copies selected');
    expect(html).not.toContain('copys');
    expect(html).not.toContain('data-slot="row-context-menu"');
    expect(html).not.toContain('data-slot="selection-status-picker"');
    expect(html).not.toContain('data-slot="selection-delete-confirm"');
  });

  it('mounts the context menu while one is up, labelled with the row name', () => {
    const { container } = render(
      <GridSelectionOverlay
        state={stubState({
          contextMenu: { row: ROW_B, position: { x: 12, y: 12 } },
          contextItems: [{ label: 'Open', slot: 'context-open', onSelect: noop }],
        })}
        noun="angle"
      />,
    );
    const menu = container.querySelector('[data-slot="row-context-menu"]');
    expect(menu).not.toBe(null);
    expect(menu?.getAttribute('aria-label')).toBe('Actions for Beta');
    expect(container.innerHTML).toContain('data-slot="context-open"');
  });

  it('puts the delete confirm in the notice line, with the hook detail unless overridden', () => {
    const { container } = render(
      <GridSelectionOverlay
        state={stubState({ confirmDelete: true, notice: 'stale notice' })}
        noun="angle"
      />,
    );
    const html = container.innerHTML;
    expect(html).toContain('data-slot="selection-delete-confirm"');
    expect(html).toContain('Linked records keep their reference and go nameless.');
    expect(html).not.toContain('stale notice');

    const overridden = render(
      <GridSelectionOverlay
        state={stubState({ confirmDelete: true })}
        noun="angle"
        deleteDetail="It leaves every brand's library."
      />,
    );
    expect(overridden.container.innerHTML).toContain("It leaves every brand's library.");
  });

  it('opens the status picker inline, held while demo or busy, and keeps the notice line (B3.A29)', () => {
    const { container } = render(
      <GridSelectionOverlay
        state={stubState({ statusPicker: { track: 'status', value: '' }, demo: true })}
        noun="angle"
      />,
    );
    const html = container.innerHTML;
    expect(html).toContain('data-slot="selection-status-picker"');
    expect(html).toMatch(/data-slot="selection-status-apply"[^>]*disabled/);

    const cleared = render(
      <GridSelectionOverlay
        state={stubState({ selected: new Set(), notice: '2 angles deleted.' })}
        noun="angle"
      />,
    );
    expect(cleared.container.innerHTML).toContain('data-slot="selection-notice"');
    expect(cleared.container.innerHTML).toContain('2 angles deleted.');
    expect(cleared.container.innerHTML).not.toContain('data-slot="selection-bar"');
  });

  it('holds no colour literal in any state', () => {
    const { container } = render(
      <GridSelectionOverlay
        state={stubState({
          contextMenu: { row: ROW_B, position: { x: 1, y: 1 } },
          contextItems: [{ label: 'Open', slot: 'context-open', onSelect: noop }],
          statusPicker: { track: 'status', value: 'approved' },
          notice: 'Link copied.',
        })}
        noun="angle"
      />,
    );
    expect(container.innerHTML).not.toMatch(COLOUR_LITERAL);
  });
});
