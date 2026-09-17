import { DEMO_MODE_NOTICE } from '@/lib/demo-mode';

/**
 * States plainly that the visitor is looking at fixtures.
 *
 * Every colour here is a Tailwind semantic class over the token layer (CLAUDE.md "UI governance"
 * rule 1). The tint and the rule are the `info` token at an opacity modifier — Tailwind 4 compiles
 * `bg-info/12` to a `color-mix` on `var(--info)` itself, so the banner still follows the theme
 * switch and no second colour, and no inline style, enters the component.
 */
export function DemoBanner() {
  return (
    <div
      role="status"
      data-slot="demo-banner"
      className="border-b border-info/30 bg-info/12 px-4 py-2 text-center text-xs text-info sm:px-6"
    >
      {DEMO_MODE_NOTICE}
    </div>
  );
}
