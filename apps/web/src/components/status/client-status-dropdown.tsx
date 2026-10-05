'use client';

import { useState, useTransition } from 'react';
import {
  Button,
  disabledWriteClassName,
  DisabledWrite,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@tas/ui';
import { CLIENT_STATUS, COPY_STATUS, CREATOR_STATUS, type StatusEntry } from '@tas/domain/state';

import {
  clientStatusRequiresNote,
  updateClientStatus,
  type ClientStatusTableKey,
  type UpdateClientStatusResult,
} from '@/lib/client-status-actions';

/**
 * The one client-status dropdown the four tables share (Oct 5 Talal sync, Agent 5).
 *
 * One <Select> over the right vocabulary (`VOCABULARIES` picks it from `tableKey`), one
 * <Textarea> that only appears when the chosen key requires one (currently
 * `revisions_needed` / `disapproved` — see `clientStatusRequiresNote`), and a Save button that
 * dispatches to the shared `updateClientStatus` server action. The component NEVER writes a
 * status key of its own and NEVER picks a vocabulary of its own: it reads both from
 * `@tas/domain/state` through `VOCABULARIES`.
 *
 * Demo mode and no-session cases are handled by the server action; the dropdown's `disabled`
 * prop just mutes the control.
 */

const VOCABULARIES: Record<ClientStatusTableKey, readonly StatusEntry[]> = {
  concepts: CLIENT_STATUS,
  creative_briefs: CLIENT_STATUS,
  creators: CREATOR_STATUS,
  copywriting: COPY_STATUS,
};

export interface ClientStatusDropdownProps {
  readonly tableKey: ClientStatusTableKey;
  readonly recordId: string;
  readonly currentStatus: string;
  /** The note already stored, so the Textarea opens with its context when visible. */
  readonly currentNote?: string | null;
  /** `true` in demo mode: the dropdown mounts, but Save is disabled with the demo-write tooltip. */
  readonly disabled?: boolean;
  /**
   * Called when a status change saves. The caller refreshes its row; the server action already
   * revalidates the matching paths.
   */
  readonly onStatusChange?: (next: UpdateClientStatusResult) => void;
}

/**
 * The textarea shown only for note-required states. Rendered as a separate component so the
 * conditional does not force a re-render of the Select on every keystroke.
 */
function NoteField({
  tableKey,
  status,
  value,
  onChange,
}: {
  readonly tableKey: ClientStatusTableKey;
  readonly status: string;
  readonly value: string;
  readonly onChange: (next: string) => void;
}) {
  const required = clientStatusRequiresNote(tableKey, status);
  if (!required) {
    return null;
  }
  const id = `client-status-note-${tableKey}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Reason</Label>
      <Textarea
        id={id}
        name="client_status_note"
        placeholder="A short note on why — the client sees this."
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        rows={2}
        aria-required="true"
      />
    </div>
  );
}

export function ClientStatusDropdown({
  tableKey,
  recordId,
  currentStatus,
  currentNote,
  disabled,
  onStatusChange,
}: ClientStatusDropdownProps) {
  const vocabulary = VOCABULARIES[tableKey];
  const [status, setStatus] = useState<string>(currentStatus);
  const [note, setNote] = useState<string>(currentNote ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const changed =
    status !== currentStatus ||
    (clientStatusRequiresNote(tableKey, status) && note !== (currentNote ?? ''));
  const noteBlocking = clientStatusRequiresNote(tableKey, status) && note.trim() === '';

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateClientStatus({
        tableKey,
        recordId,
        newStatus: status,
        note: clientStatusRequiresNote(tableKey, status) ? note : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onStatusChange?.(result);
    });
  };

  const selectId = `client-status-${tableKey}`;

  return (
    <div
      data-slot="client-status-dropdown"
      data-table-key={tableKey}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={selectId}>Client status</Label>
        <Select value={status} onValueChange={setStatus} disabled={disabled || pending}>
          <SelectTrigger id={selectId} className="w-full" aria-label="Client status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {vocabulary.map((entry) => (
              <SelectItem key={entry.key} value={entry.key}>
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <NoteField tableKey={tableKey} status={status} value={note} onChange={setNote} />
      {error === null ? null : (
        <p className="text-xs text-bad" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        {disabled === true ? (
          <DisabledWrite>
            <Button
              size="sm"
              disabled
              className={disabledWriteClassName}
              aria-label="Save client status"
            >
              Save
            </Button>
          </DisabledWrite>
        ) : (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!changed || pending || noteBlocking}
            aria-label="Save client status"
          >
            {pending ? 'Saving…' : 'Save'}
          </Button>
        )}
      </div>
    </div>
  );
}
