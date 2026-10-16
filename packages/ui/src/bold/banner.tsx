import type { CSSProperties, ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface BoldBannerProps {
  readonly children: ReactNode;
  /** The leading glyph, boxed in the translucent icon tile. */
  readonly icon?: ReactNode;
  /** A trailing control, e.g. the banner's one action. */
  readonly action?: ReactNode;
  readonly className?: string;
}

/** The indigo→accent wash, via tokens so both scopes and themes hold (no literal here). */
const BANNER_GRADIENT: CSSProperties = {
  background: 'linear-gradient(135deg, var(--side-bg) 0%, var(--accent) 140%)',
};

/**
 * Bold banner (redesign commit 3b, spec §3.12): the gradient notice strip — the Themes page's
 * global-library note is its first mount. Presentational; the page supplies content and action.
 */
export function BoldBanner({ children, icon, action, className }: BoldBannerProps) {
  return (
    <div
      data-slot="bold-banner"
      style={BANNER_GRADIENT}
      className={cn(
        'flex items-center gap-3 rounded-card px-4 py-3 text-sm text-side-ink',
        className,
      )}
    >
      {icon === undefined ? null : (
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-side-active [&_svg]:size-4.5"
        >
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}
