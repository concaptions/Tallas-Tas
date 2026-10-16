'use client';

import { useEffect } from 'react';
import { Check } from 'lucide-react';

import { cn } from '../lib/cn';

import type { ReactNode } from 'react';

/** The artifact's dwell time (spec §3.11). */
export const BOLD_TOAST_DURATION_MS = 3200;

export interface BoldToastProps {
  /** Controlled: the surface owns the flag; the toast calls `onDismiss` when its time is up. */
  readonly open: boolean;
  readonly onDismiss: () => void;
  readonly children: ReactNode;
  /** Override for tests; the product keeps the 3.2s default. */
  readonly durationMs?: number;
  readonly className?: string;
}

/**
 * Bold toast (redesign commit 3b, spec §3.11): the fixed top-right dark indigo card with the green
 * check, self-dismissing after 3.2s. Bold surfaces mount it from commit 4 on; the legacy
 * `role="status"` notice lines are untouched (their Bold paint is the scoped skin in bold.css).
 * Controlled on purpose — no module state, no imperative bus: the surface that did the work owns
 * the flag, which keeps the component honest about where a message came from.
 */
export function BoldToast({
  open,
  onDismiss,
  children,
  durationMs = BOLD_TOAST_DURATION_MS,
  className,
}: BoldToastProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const timer = setTimeout(onDismiss, durationMs);
    return () => {
      clearTimeout(timer);
    };
  }, [open, onDismiss, durationMs]);

  if (!open) {
    return null;
  }
  return (
    <div
      role="status"
      data-slot="bold-toast"
      className={cn(
        'fixed top-5 right-5 z-50 flex items-center gap-2.5 rounded-[14px] bg-side-bg px-4 py-3 text-sm font-medium text-side-ink shadow-toast',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-[99px] bg-ok-soft text-ok"
      >
        <Check className="size-3.5" strokeWidth={2.4} />
      </span>
      {children}
    </div>
  );
}
