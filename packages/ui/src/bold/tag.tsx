import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface BoldTagProps {
  readonly children: ReactNode;
  /** An optional leading 18px-grid glyph (lucide, per the shell's icon language). */
  readonly icon?: ReactNode;
  readonly className?: string;
}

/**
 * The Bold tag (redesign commit 3, spec §3.6): the 26px outlined pill the cards hang metadata on —
 * angle tags, product tags, refs. Bold-only: no legacy surface renders it, so it needs no scoping;
 * it still styles exclusively through tokens, so it is theme-correct wherever it mounts.
 * Presentational and inert — anything interactive stays a Button.
 */
export function BoldTag({ children, icon, className }: BoldTagProps) {
  return (
    <span
      data-slot="bold-tag"
      className={cn(
        'inline-flex h-[26px] items-center gap-1.5 rounded-[99px] border border-line2 bg-surface px-2.5 text-xs font-medium whitespace-nowrap text-text2',
        '[&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-text3',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
