import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { CustomPagesSection } from './custom-pages-section';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('./custom-page-actions', () => ({
  createCustomPageAction: vi.fn(),
  updateCustomPageAction: vi.fn(),
  deleteCustomPageAction: vi.fn(),
}));
vi.mock('./custom-page-propagation-actions', () => ({
  requestCustomPagePromotionAction: vi.fn(),
}));

/**
 * "Add custom page" did nothing (2026-10-12): `DialogTrigger asChild` wrapped `DisabledWrite`,
 * which accepts only its own four props and, when inactive, renders `<>{children}</>` — so the
 * `onClick` / `aria-*` / `data-state` Radix merges onto its child never reached the button. The
 * trigger attributes on the rendered button are the proof the handler is attached.
 */
function section(disabled: boolean): string {
  return renderToStaticMarkup(
    <CustomPagesSection
      brandId="brand-1"
      templatePages={[]}
      brandPages={[]}
      resolverColumnsByTable={{
        creative_briefs: [],
        concepts: [],
        copywriting: [],
        creators: [],
        collections: [],
        products: [],
      }}
      demo={false}
      disabled={disabled}
    />,
  );
}

const addButton = (markup: string) =>
  /<button[^>]*data-slot="add-custom-page"[^>]*>/.exec(markup)?.[0] ?? '';

describe('CustomPagesSection — "Add custom page"', () => {
  it('is a live dialog trigger for an admin: the Radix trigger attributes are on the button', () => {
    const tag = addButton(section(false));
    expect(tag).not.toBe('');
    expect(tag).toContain('aria-haspopup="dialog"');
    expect(tag).toContain('data-state="closed"');
    expect(tag).not.toMatch(/\sdisabled(=""|\s|>)/);
  });

  it('stays a disabled, explained control for a role that may not configure', () => {
    const tag = addButton(section(true));
    expect(tag).toMatch(/\sdisabled(=""|\s|>)/);
    expect(section(true)).toContain('data-slot="disabled-write"');
  });
});
