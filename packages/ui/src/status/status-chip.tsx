import type { CSSProperties } from 'react';
import type { ChipTone } from '@tas/domain/state';

import { cn } from '../lib/cn';

export interface StatusChipProps {
  tone: ChipTone;
  label: string;
  className?: string;
}

/**
 * The one status pill in the product. No other component re-implements it (design handoff,
 * "Shared primitives"). Every tone resolves to a token variable, so the chip follows the theme.
 */
const toneVariable: Record<ChipTone, string> = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  bad: 'var(--bad)',
  info: 'var(--info)',
  accent: 'var(--accent)',
  mute: 'var(--text3)',
};

export function StatusChip({ tone, label, className }: StatusChipProps) {
  const colour = toneVariable[tone];
  const style: CSSProperties = {
    fontSize: '10.5px',
    letterSpacing: '.03em',
    borderColor: colour,
    color: colour,
    backgroundColor: `color-mix(in srgb, ${colour} 13%, transparent)`,
  };

  return (
    <span
      data-slot="status-chip"
      data-tone={tone}
      className={cn(
        'inline-flex items-center rounded-input border px-1.5 py-0.5 font-mono leading-none whitespace-nowrap uppercase',
        className,
      )}
      style={style}
    >
      {label}
    </span>
  );
}
