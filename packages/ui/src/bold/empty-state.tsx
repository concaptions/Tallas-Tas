import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface BoldEmptyStateProps {
  readonly title: string;
  readonly description?: string;
  /** The one way forward, when there is one — a Button, usually. */
  readonly action?: ReactNode;
  readonly className?: string;
}

/**
 * Bold empty state (redesign commit 3b, spec §3.13): the centred heading + line + optional action
 * a Bold page renders where its collection is empty. Presentational only.
 */
export function BoldEmptyState({ title, description, action, className }: BoldEmptyStateProps) {
  return (
    <div
      data-slot="bold-empty-state"
      className={cn(
        'flex flex-col items-center gap-2 rounded-card border border-dashed border-line2 bg-surface px-6 py-14 text-center',
        className,
      )}
    >
      <h2 className="text-lg font-bold text-text">{title}</h2>
      {description === undefined ? null : (
        <p className="max-w-sm text-sm text-text2">{description}</p>
      )}
      {action === undefined ? null : <div className="mt-2">{action}</div>}
    </div>
  );
}
