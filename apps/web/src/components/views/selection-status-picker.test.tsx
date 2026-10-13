import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SelectionStatusPicker, type SelectionStatusTrack } from './selection-status-picker';

const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgb\(/;

const tracks: readonly SelectionStatusTrack[] = [
  {
    key: 'internalStatus',
    label: 'Internal Status',
    options: [
      { key: 'draft', label: 'Draft' },
      { key: 'approved', label: 'Approved' },
    ],
  },
  {
    key: 'status',
    label: 'Client Approval',
    options: [{ key: 'pending_for_approval', label: 'Pending for Approval' }],
  },
];

function picker(track: string, value: string) {
  return renderToStaticMarkup(
    <SelectionStatusPicker
      tracks={tracks}
      track={track}
      value={value}
      onTrackChange={() => undefined}
      onValueChange={() => undefined}
      onApply={() => undefined}
    />,
  );
}

describe('SelectionStatusPicker (B3.A31)', () => {
  it('keeps the bar’s slots: picker, value select and Apply', () => {
    const markup = picker('internalStatus', '');
    expect(markup).toContain('data-slot="selection-status-picker"');
    expect(markup).toContain('data-slot="selection-status-value"');
    expect(markup).toContain('data-slot="selection-status-apply"');
    expect(markup).toContain('aria-label="Track"');
    expect(markup).toContain('aria-label="New status"');
  });

  it('lists the chosen track’s statuses only, and holds Apply until one is picked', () => {
    const internal = picker('internalStatus', '');
    expect(internal).toContain('<option value="approved">Approved</option>');
    expect(internal).not.toContain('Pending for Approval</option>');
    expect(internal).toMatch(/data-slot="selection-status-apply"[^>]*disabled=""/);

    const client = picker('status', 'pending_for_approval');
    expect(client).toContain('<option value="pending_for_approval"');
    expect(client).not.toContain('>Approved</option>');
    expect(client).not.toMatch(/data-slot="selection-status-apply"[^>]*disabled=""/);
  });

  it('holds no colour literal', () => {
    expect(picker('status', '')).not.toMatch(COLOUR_LITERAL);
  });
});
