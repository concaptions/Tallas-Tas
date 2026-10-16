import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CLIENT_STATUS, chipTone } from '@tas/domain/state';

import { ClientStatusBadge } from './client-status-badge';

const toneFor = (value: string) =>
  chipTone(CLIENT_STATUS.find((row) => row.key === value)?.label ?? value);

describe('ClientStatusBadge', () => {
  it('resolves the label from the passed vocabulary', () => {
    render(
      <ClientStatusBadge
        vocabulary={CLIENT_STATUS}
        value="pending_for_approval"
        toneFor={toneFor}
      />,
    );
    const chip = screen.getByText('Pending for Approval');
    expect(chip.dataset['tone']).toBe('info');
    // No variant passed → no attribute: the default badge is byte-identical to pre-commit-3.
    expect(chip.dataset['variant']).toBeUndefined();
  });

  it('forwards the Bold ring variant — the client-track marker — to the chip', () => {
    render(
      <ClientStatusBadge
        vocabulary={CLIENT_STATUS}
        value="approved"
        toneFor={toneFor}
        variant="ring"
      />,
    );
    expect(screen.getByText('Approved').dataset['variant']).toBe('ring');
  });
});
