'use client';

import { RowContextMenu } from './row-context-menu';
import { SelectionBar } from './selection-bar';
import { SelectionDeleteConfirm } from './selection-delete-confirm';
import { SelectionStatusPicker } from './selection-status-picker';
import type { GridSelectionState } from './use-grid-selection';

export interface GridSelectionOverlayProps<Row> {
  readonly state: GridSelectionState<Row>;
  /** The same noun the hook was given, for the bar's count line and the confirm's question. */
  readonly noun: string;
  /** Irregular plural (`copy` → `copies`); defaults to `${noun}s`. */
  readonly plural?: string;
  /** Overrides the hook's `remove.detail` in the confirm line; the hook's wins when omitted. */
  readonly deleteDetail?: string;
}

/**
 * Everything a multi-selected grid floats over itself (Ticket 8), rendered from
 * `useGridSelection`'s state exactly as the Creative Sheet renders it: the right-click menu while
 * one is up, and the selection bar with the Delete confirm in the notice line or the inline
 * Change-status picker beside the actions. Mount it once, after the page's panel.
 */
export function GridSelectionOverlay<Row>({
  state,
  noun,
  plural,
  deleteDetail,
}: GridSelectionOverlayProps<Row>) {
  const disabled = state.demo || state.busy;
  return (
    <>
      {state.contextMenu === null ? null : (
        <RowContextMenu
          position={state.contextMenu.position}
          items={state.contextItems}
          label={state.rowLabel(state.contextMenu.row)}
          onClose={state.closeContextMenu}
        />
      )}
      <SelectionBar
        count={state.selected.size}
        noun={noun}
        plural={plural}
        actions={state.selectionActions}
        onClear={state.clearSelection}
        notice={
          state.confirmDelete ? (
            <SelectionDeleteConfirm
              count={state.selected.size}
              noun={noun}
              plural={plural}
              detail={deleteDetail ?? state.deleteDetail}
              disabled={disabled}
              onConfirm={state.onConfirmDelete}
              onCancel={state.onCancelDelete}
            />
          ) : (
            state.notice
          )
        }
      >
        {state.statusPicker === null ? null : (
          <SelectionStatusPicker
            tracks={state.statusTracks}
            track={state.statusPicker.track}
            value={state.statusPicker.value}
            disabled={disabled}
            onTrackChange={state.onStatusTrackChange}
            onValueChange={state.onStatusValueChange}
            onApply={state.onApplyStatus}
          />
        )}
      </SelectionBar>
    </>
  );
}
