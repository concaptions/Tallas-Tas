import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { CopyPanel } from './copy-panel';
import { pendingCopyOnCreated, pendingCopyOnPress } from './fields';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('./actions', () => ({ updateCopyAction: vi.fn() }));
vi.mock('@/lib/client-status-actions', () => ({ updateClientStatus: vi.fn() }));

/**
 * SMOKE-34 (item 5a, 2026-10-11): the copy panel showed its Status select AND, below it, a second
 * "Client status" badge + dropdown over the SAME `status` column — the shape SMOKE-27 removed from
 * concepts. The panel keeps one Status control and shows the stored Client Approval
 * (`client_approval_status`, the one client vocabulary) as a chip, the way the grid does.
 */
function markup(clientApprovalStatus: string | null): string {
  const item = {
    ...pendingCopyOnCreated(pendingCopyOnPress([], new Date('2026-10-11T09:00:00Z')), 'copy-1'),
    clientApprovalStatus,
  };
  return renderToStaticMarkup(
    <CopyPanel
      item={item}
      creatives={[]}
      concepts={[]}
      collections={[]}
      products={[]}
      copyTypes={[]}
      demo={false}
      onClose={() => undefined}
      onSaved={() => undefined}
    />,
  );
}

describe('CopyPanel — one Status control, Client Approval shown', () => {
  it('renders no second client-status section and no "Client status" dropdown', () => {
    const html = markup('approved');
    expect(html).not.toContain('data-slot="copy-client-status"');
    expect(html).not.toContain('data-slot="client-status-dropdown"');
    expect(html).not.toContain('Client status');
    expect(html).toContain('name="status"');
  });

  it('shows the stored Client Approval as a chip, and an unset one as unset', () => {
    expect(markup('approved')).toContain('data-slot="copy-client-approval"');
    expect(markup('approved')).toContain('Approved');
    expect(markup(null)).toContain('data-slot="copy-client-approval"');
  });
});
