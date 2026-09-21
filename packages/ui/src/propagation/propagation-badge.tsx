'use client';

import { cn } from '../lib/cn';

interface PropagationBadgeProps {
  readonly templateRowId: string | null;
  readonly overriddenFields: string[];
  readonly className?: string;
}

export function PropagationBadge({
  templateRowId,
  overriddenFields,
  className,
}: PropagationBadgeProps) {
  if (templateRowId === null) return null;

  const hasOverrides = overriddenFields.length > 0;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-input px-1.5 py-0.5 font-mono text-[10px] leading-tight',
        hasOverrides ? 'bg-warn/10 text-warn' : 'bg-accent/10 text-accent',
        className,
      )}
      title={
        hasOverrides
          ? `Synced from template, ${String(overriddenFields.length)} field${overriddenFields.length === 1 ? '' : 's'} overridden: ${overriddenFields.join(', ')}`
          : 'Synced from template'
      }
    >
      {hasOverrides
        ? `${String(overriddenFields.length)} override${overriddenFields.length === 1 ? '' : 's'}`
        : 'synced'}
    </span>
  );
}
