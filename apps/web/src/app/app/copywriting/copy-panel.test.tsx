// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CopyPanel } from './copy-panel';
import { pendingCopyOnCreated, pendingCopyOnPress } from './fields';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('./actions', () => ({ updateCopyAction: vi.fn() }));
vi.mock('@/lib/client-status-actions', () => ({ updateClientStatus: vi.fn() }));

afterEach(() => {
  cleanup();
});

/**
 * SMOKE-34 (item 5a, 2026-10-11): the copy panel showed its Status select AND, below it, a second
 * "Client status" badge + dropdown over the SAME `status` column — the shape SMOKE-27 removed from
 * concepts. The panel keeps one Status control and shows the stored Client Approval
 * (`client_approval_status`, the one client vocabulary) as a chip, the way the grid does. The
 * shell is now the shared `RecordSheet` (Ticket 9, part 3), which portals its content to the
 * document body, so this is a jsdom render over the body — `renderToStaticMarkup` would return
 * empty for a Radix Dialog portal.
 */
function body(clientApprovalStatus: string | null): string {
  const item = {
    ...pendingCopyOnCreated(pendingCopyOnPress([], new Date('2026-10-11T09:00:00Z')), 'copy-1'),
    clientApprovalStatus,
  };
  render(
    <CopyPanel
      item={item}
      creatives={[]}
      concepts={[]}
      products={[]}
      copyTypes={[]}
      demo={false}
      onClose={() => undefined}
      onSaved={() => undefined}
    />,
  );
  return document.body.innerHTML;
}

describe('CopyPanel — one Status control, Client Approval shown', () => {
  it('renders no second client-status section and no "Client status" dropdown', () => {
    const html = body('approved');
    expect(html).not.toContain('data-slot="copy-client-status"');
    expect(html).not.toContain('data-slot="client-status-dropdown"');
    expect(html).not.toContain('Client status');
    expect(html).toContain('name="status"');
  });

  it('shows the stored Client Approval as a chip, and an unset one as unset', () => {
    expect(body('approved')).toContain('data-slot="copy-client-approval"');
    expect(body('approved')).toContain('Approved');
    expect(body(null)).toContain('data-slot="copy-client-approval"');
  });
});
