import { cn } from '../lib/cn';

export interface SoonChipProps {
  /** Overrides the default "SOON" wording; kept uppercase and monospace either way. */
  label?: string;
  className?: string;
}

/**
 * Marks a navigation section that is not built yet. Distinct from `StatusChip`, which carries a
 * semantic tone: this one has no tone, it is a shape on the surface (`--text3` on `--surface3`),
 * so a rail full of them stays quiet while still being legible.
 */
export function SoonChip({ label = 'SOON', className }: SoonChipProps) {
  return (
    <span
      data-slot="soon-chip"
      className={cn(
        'inline-flex items-center rounded-input bg-surface3 px-1.5 py-0.5 font-mono text-[10px] leading-none tracking-wide text-text3 uppercase',
        className,
      )}
    >
      {label}
    </span>
  );
}
