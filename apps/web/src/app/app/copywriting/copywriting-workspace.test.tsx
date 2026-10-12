import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { CopywritingWorkspace } from './copywriting-workspace';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('./actions', () => ({
  createCopyAction: vi.fn(),
  updateCopyAction: vi.fn(),
  updateCopyClientApproval: vi.fn(),
}));

/**
 * "New copy" is live in live mode (SMOKE-11): the empty workspace an Admin opens on Gratsi shows an
 * ENABLED button, not a disabled one whose reason only a hover could read. Demo mode still disables
 * it with the standard reason.
 */
function render(demo: boolean): string {
  return renderToStaticMarkup(
    <CopywritingWorkspace
      columns={[]}
      items={[]}
      creatives={[]}
      concepts={[]}
      products={[]}
      copyTypes={[]}
      demo={demo}
      initialSelection={null}
      initialSearch=""
      userViews={{ userId: null, views: [] }}
    />,
  );
}

const button = (markup: string) => /<button[^>]*data-slot="new-copy"[^>]*>/.exec(markup)?.[0] ?? '';
/** The `disabled` ATTRIBUTE — the class string carries Tailwind `disabled:` variants on purpose. */
const isDisabled = (tag: string) => /\sdisabled(=""|\s|>)/.test(tag);

describe('CopywritingWorkspace — New copy', () => {
  it('is enabled on an empty live workspace', () => {
    const tag = button(render(false));
    expect(tag).not.toBe('');
    expect(isDisabled(tag)).toBe(false);
  });

  it('is disabled in demo mode, with the standard reason', () => {
    const tag = button(render(true));
    expect(isDisabled(tag)).toBe(true);
  });
});

/**
 * Item 5a (2026-10-11): the Copywriting grid has the same Group menu Concepts and UGC have, over
 * its resolved columns — so "Group: Client Approval" is on offer once the column resolves. Before
 * this the page mounted a bare view switcher with no Group menu at all.
 */
describe('CopywritingWorkspace — Group menu', () => {
  it('mounts the Group menu over the resolved columns, Client Approval among them', () => {
    const markup = renderToStaticMarkup(
      <CopywritingWorkspace
        columns={[
          { columnKey: 'copy_number', displayLabel: 'Copy #', displayOrder: 0 },
          { columnKey: 'client_approval_status', displayLabel: 'Client Approval', displayOrder: 1 },
        ]}
        items={[]}
        creatives={[]}
        concepts={[]}
        products={[]}
        copyTypes={[]}
        demo={false}
        initialSelection={null}
        initialSearch=""
        userViews={{ userId: null, views: [] }}
      />,
    );
    expect(markup).toContain('data-slot="grid-group"');
    expect(markup).toContain('Client Approval');
  });
});
