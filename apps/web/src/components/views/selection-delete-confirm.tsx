'use client';

import { Button } from '@tas/ui';

export interface SelectionDeleteConfirmProps {
  readonly count: number;
  /** Singular noun, e.g. `creative` → "Delete 2 creatives?". */
  readonly noun: string;
  /** Irregular plural (Ticket 8): `copy` pluralises to "copys" without it — pass `copies`. */
  readonly plural?: string;
  /** What the delete means for these records, after the question. */
  readonly detail: string;
  /** Demo mode or a write in flight: the confirming button is held. */
  readonly disabled?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * The one-line confirmation the selection bar shows under itself before a bulk delete
 * (B3.A31; decision 6 keeps the delete soft). Presentational: the page runs the write.
 */
export function SelectionDeleteConfirm({
  count,
  noun,
  plural,
  detail,
  disabled = false,
  onConfirm,
  onCancel,
}: SelectionDeleteConfirmProps) {
  return (
    <span className="flex items-center gap-2" data-slot="selection-delete-confirm">
      Delete {String(count)} {count === 1 ? noun : (plural ?? `${noun}s`)}? {detail}
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={disabled}
        data-slot="selection-delete-confirm-yes"
        onClick={onConfirm}
      >
        Delete
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </span>
  );
}
