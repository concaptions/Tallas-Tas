import type { ChipTone, StatusEntry } from '@tas/domain/state';

import { StatusChip } from './status-chip';

export interface ClientStatusBadgeProps {
  /**
   * The vocabulary this badge draws from. Shared across the four tables that carry a client-status
   * track: `CLIENT_STATUS` for concepts and briefs, `CREATOR_STATUS` for creators, `COPY_STATUS`
   * for copywriting. The whole list is passed in rather than a key alone so the badge resolves an
   * unknown value to its own label — the honest "a build has not seen this yet" state the status
   * machine's `chipTone` fallback is written for.
   */
  readonly vocabulary: readonly StatusEntry[];
  /** The stored status key. */
  readonly value: string;
  /** How to colour the chip, given the stored value. Each table's own tone function. */
  readonly toneFor: (value: string) => ChipTone;
  readonly className?: string;
  /** Forwarded to `StatusChip` (Bold §3.5): `ring` is the client-track marker. Bold call sites only. */
  readonly variant?: 'ring' | 'plain';
}

/**
 * The one client-status pill the four tables share (Oct 5 Talal sync, Agent 5). It is a thin
 * wrapper around `StatusChip` that walks the passed vocabulary for the label — a component
 * reading `concept.clientStatus` never maps the key itself and never picks a tone of its own,
 * exactly the same way the shipped `StatusChip` story and `TwoTrackApproval` do.
 */
export function ClientStatusBadge({
  vocabulary,
  value,
  toneFor,
  className,
  variant,
}: ClientStatusBadgeProps) {
  const entry = vocabulary.find((row) => row.key === value);
  const label = entry === undefined ? value : entry.label;
  return <StatusChip tone={toneFor(value)} label={label} className={className} variant={variant} />;
}
