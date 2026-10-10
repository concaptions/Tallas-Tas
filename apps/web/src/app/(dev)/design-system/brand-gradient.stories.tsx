import { BrandLockup, BrandRule } from '@/components/shell/brand-mark';

/**
 * The brand gradient (CLAUDE.md UI governance rule 4), in both palettes.
 *
 * `--accent-gradient` is the one token the Palette section above cannot show: its swatches are
 * `backgroundColor`, and a gradient is a `background-image`. It was also the one token with no call
 * site anywhere in the product (AI-13), which is exactly the kind of gap this page exists to make
 * visible — so each column shows the token itself and then the two shell pieces that render it,
 * imported from `components/shell/brand-mark`, never redrawn here.
 *
 * The frame around them is the top bar's own chrome (56px, `bg-surface`, `border-line`) so the
 * contrast that matters is the contrast you see: the wordmark stays `text-text` on `bg-surface`,
 * and the gradient carries no glyph in either theme because the dark palette's gradient is a pair
 * of light purples and the light palette's a pair of dark ones — opposite ink, no single token.
 */
function GradientColumn({ theme }: { theme: 'dark' | 'light' }) {
  return (
    <div
      data-theme={theme}
      className="flex-1 rounded-card border border-line bg-bg p-4 text-text"
      data-slot="brand-gradient-column"
    >
      <h3 className="mb-3 font-mono text-xs tracking-wide text-text3 uppercase">
        purple {theme}
        {theme === 'dark' ? ' (default)' : ' (data-theme="light")'}
      </h3>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="bg-brand-gradient h-9 w-24 shrink-0 rounded-input border border-line2" />
          <span className="font-mono text-[11px] text-text2">--accent-gradient</span>
        </div>
        <div className="relative flex h-14 items-center gap-2 overflow-hidden rounded-input border border-line bg-surface px-3">
          <span className="text-sm font-semibold tracking-tight text-text">
            <BrandLockup />
          </span>
          <BrandRule />
        </div>
      </div>
    </div>
  );
}

export function BrandGradientStory() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <GradientColumn theme="dark" />
      <GradientColumn theme="light" />
    </div>
  );
}
