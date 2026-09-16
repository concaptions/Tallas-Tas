import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

/** Why a write control is inert when the app runs without an identity provider. */
export const DEMO_WRITE_HINT = 'Sign in required to save changes';

/**
 * The disabled look for a write action. Without it a disabled primary button keeps its accent
 * fill and reads as clickable; this puts it on a muted surface with a `--text3` label instead.
 * Pass it to a `Button`'s `className` alongside `disabled`.
 */
export const disabledWriteClassName =
  'disabled:border-line disabled:bg-surface3 disabled:text-text3 disabled:opacity-100 disabled:shadow-none';

export interface DisabledWriteProps {
  /** Tooltip text; the default explains demo mode. */
  hint?: string;
  /** Set false to render the child untouched, so a caller can keep one code path. */
  active?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a disabled control so it can still explain itself. A disabled `button` receives no pointer
 * events, so its own `title` never opens: the tooltip has to live on an enabled element around it.
 */
export function DisabledWrite({
  hint = DEMO_WRITE_HINT,
  active = true,
  children,
  className,
}: DisabledWriteProps) {
  if (!active) {
    return <>{children}</>;
  }

  return (
    <span
      data-slot="disabled-write"
      title={hint}
      aria-label={hint}
      className={cn('inline-flex cursor-not-allowed', className)}
    >
      {children}
    </span>
  );
}
