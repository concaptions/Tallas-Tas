import type { CSSProperties, ReactNode } from 'react';
import type { StepState } from '@tas/domain/state';

import { cn } from '../lib/cn';

export interface StepRowProps {
  label: string;
  tip?: string;
  state: StepState;
  isLast?: boolean;
  /** Side badge for a non-linear state (On Hold). Never a step of its own in the stepper. */
  badge?: ReactNode;
  className?: string;
}

/**
 * One row of a linear stepper: done steps carry a `--text3` dot, the current step an `--accent` dot
 * with a 3px `--accent-soft` halo, upcoming steps a hollow `--line2` ring. The connector is drawn on
 * every row but the last.
 */
const dotStyle: Record<StepState, CSSProperties> = {
  done: { backgroundColor: 'var(--text3)' },
  now: { backgroundColor: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft)' },
  next: { backgroundColor: 'transparent', border: '1px solid var(--line2)' },
};

const labelClass: Record<StepState, string> = {
  done: 'text-text3',
  now: 'text-text font-medium',
  next: 'text-text4',
};

export function StepRow({ label, tip, state, isLast = false, badge, className }: StepRowProps) {
  return (
    <div data-slot="step-row" data-state={state} className={cn('flex gap-3', className)}>
      <div className="flex flex-col items-center" aria-hidden="true">
        <span
          data-slot="step-row-dot"
          className="mt-1.5 size-2 shrink-0 rounded-full"
          style={dotStyle[state]}
        />
        {isLast ? null : (
          <span
            data-slot="step-row-connector"
            className="mt-1.5 w-px flex-1 bg-line2"
            style={{ minHeight: '14px' }}
          />
        )}
      </div>
      <div className={cn('min-w-0 flex-1', isLast ? 'pb-0' : 'pb-3')}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('text-[13px] leading-5', labelClass[state])}>{label}</span>
          {badge}
        </div>
        {tip === undefined ? null : (
          <p className="mt-0.5 text-[11px] leading-snug text-text4">{tip}</p>
        )}
      </div>
    </div>
  );
}
