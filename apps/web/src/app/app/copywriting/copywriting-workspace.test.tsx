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
      collections={[]}
      products={[]}
      copyTypes={[]}
      demo={demo}
      initialSelection={null}
      initialSearch=""
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
