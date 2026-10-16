import type { CSSProperties } from 'react';
import type { ChipTone } from '@tas/domain/state';

import { cn } from '../lib/cn';

export interface StatusChipProps {
  tone: ChipTone;
  label: string;
  className?: string;
  /**
   * The Bold dot treatment (redesign commit 3, spec §3.5). The default chip carries a filled
   * leading dot UNDER THE BOLD SCOPE ONLY — a scoped `::before` in `styles/bold.css`, no DOM of its
   * own — `ring` outlines that dot (the client-track marker) and `plain` removes it. Only Bold call
   * sites pass this; `undefined` emits no attribute, so the default output stays byte-identical to
   * the pre-Bold chip (`status-chip.test.tsx` pins it) and child brands render exactly as before.
   */
  variant?: 'ring' | 'plain';
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

export function StatusChip({ tone, label, className, variant }: StatusChipProps) {
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
      data-variant={variant}
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
