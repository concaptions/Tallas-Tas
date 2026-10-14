// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Oct 14 follow-up #1 (`docs/sprint-oct12.md`): the shared `ClientStatusDropdown` on
 * `creative_briefs` routes its two review-ending transitions through the Ticket 10 gated server
 * actions — `approveBriefAction` for `approved`, `requestChangesAction` for `revisions_needed`.
 * The direct `updateClientStatus` path only checks the QA gate; neither the role gate nor the
 * one-comment-per-submission gate rode along with it before this fix, so a brief could reach
 * `approved` from this dropdown without the assignee check that `canApproveBrief` enforces, and
 * `revisions_needed` could ship without the written note the reviewer owes.
 *
 * The three cases below stub both server actions and the shared setter, mount the dropdown with
 * each next status as a `rerender` of `currentStatus` so the Save button becomes enabled under
 * jsdom (the Radix Select trigger is not keyboard-interactive here), then click Save. The two
 * review-ending transitions hit the gated action, bypass `updateClientStatus`, and surface the
 * refusal in the dropdown's `role="alert"` line; the other keys stay on the direct setter.
 */

const approveMock = vi.fn();
const requestChangesMock = vi.fn();
const updateClientStatusMock = vi.fn();

vi.mock('@/app/app/creative-sheet/review-actions', () => ({
  approveBriefAction: (id: string): Promise<unknown> => approveMock(id) as Promise<unknown>,
  requestChangesAction: (id: string): Promise<unknown> =>
    requestChangesMock(id) as Promise<unknown>,
}));
vi.mock('@/lib/client-status-actions', () => ({
  updateClientStatus: (args: unknown): Promise<unknown> =>
    updateClientStatusMock(args) as Promise<unknown>,
}));

// Replace Radix Select with a plain native <select> so jsdom can change its value without the
// floating listbox and keyboard choreography. Every other @tas/ui export (Button, Textarea,
// Label, DisabledWrite, …) comes through unchanged.
vi.mock('@tas/ui', async () => {
  const actual = await vi.importActual<typeof import('@tas/ui')>('@tas/ui');
  type SelectProps = {
    readonly value?: string;
    readonly onValueChange?: (next: string) => void;
    readonly disabled?: boolean;
    readonly children?: React.ReactNode;
  };
  const Select = ({ value, onValueChange, disabled, children }: SelectProps) => {
    return (
      <select
        aria-label="Client status"
        value={value ?? ''}
        disabled={disabled ?? false}
        onChange={(event) => {
          onValueChange?.(event.target.value);
        }}
      >
        {children}
      </select>
    );
  };
  const Pass = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const SelectItem = ({ value, children }: { value: string; children?: React.ReactNode }) => (
    <option value={value}>{children}</option>
  );
  return {
    ...actual,
    Select,
    SelectContent: Pass,
    SelectGroup: Pass,
    SelectItem,
    SelectTrigger: Pass,
    SelectValue: Pass,
  };
});

import { ClientStatusDropdown } from './client-status-dropdown';

afterEach(() => {
  cleanup();
  approveMock.mockReset();
  requestChangesMock.mockReset();
  updateClientStatusMock.mockReset();
});

describe('ClientStatusDropdown — Oct 14 follow-up #1 gate routing', () => {
  it('routes the Approve path on creative_briefs through approveBriefAction and surfaces its refusal', async () => {
    approveMock.mockResolvedValue({
      ok: false,
      error: 'Only the assigned strategist may approve this creative.',
    });
    const onStatusChange = vi.fn();

    const { getByRole, getByLabelText } = render(
      <ClientStatusDropdown
        tableKey="creative_briefs"
        recordId="brief-1"
        currentStatus="pending_for_approval"
        currentNote={null}
        onStatusChange={onStatusChange}
      />,
    );

    fireEvent.change(getByLabelText('Client status'), { target: { value: 'approved' } });
    fireEvent.click(getByRole('button', { name: 'Save client status' }));

    await waitFor(() => {
      expect(approveMock).toHaveBeenCalledWith('brief-1');
    });
    expect(updateClientStatusMock).not.toHaveBeenCalled();
    expect(requestChangesMock).not.toHaveBeenCalled();
    expect(onStatusChange).not.toHaveBeenCalled();

    await waitFor(() => {
      const alert = document.querySelector('[role="alert"]');
      expect(alert?.textContent).toBe('Only the assigned strategist may approve this creative.');
    });
  });

  it('routes the Revisions Needed path on creative_briefs through requestChangesAction', async () => {
    requestChangesMock.mockResolvedValue({
      ok: false,
      error: 'Write a comment before sending the cut back.',
    });

    const { getByRole, getByLabelText } = render(
      <ClientStatusDropdown
        tableKey="creative_briefs"
        recordId="brief-2"
        currentStatus="pending_for_approval"
        currentNote={null}
      />,
    );

    fireEvent.change(getByLabelText('Client status'), { target: { value: 'revisions_needed' } });
    fireEvent.change(getByLabelText('Reason'), { target: { value: 'Please tighten the hook.' } });
    fireEvent.click(getByRole('button', { name: 'Save client status' }));

    await waitFor(() => {
      expect(requestChangesMock).toHaveBeenCalledWith('brief-2');
    });
    expect(approveMock).not.toHaveBeenCalled();
    expect(updateClientStatusMock).not.toHaveBeenCalled();
  });

  it('leaves non-review-ending transitions on the direct updateClientStatus setter', async () => {
    updateClientStatusMock.mockResolvedValue({
      ok: true,
      tableKey: 'creative_briefs',
      recordId: 'brief-3',
      status: 'disapproved',
      note: 'Off brief.',
      updatedAt: new Date().toISOString(),
    });

    const { getByRole, getByLabelText } = render(
      <ClientStatusDropdown
        tableKey="creative_briefs"
        recordId="brief-3"
        currentStatus="pending_for_approval"
        currentNote={null}
      />,
    );

    fireEvent.change(getByLabelText('Client status'), { target: { value: 'disapproved' } });
    fireEvent.change(getByLabelText('Reason'), { target: { value: 'Off brief.' } });
    fireEvent.click(getByRole('button', { name: 'Save client status' }));

    await waitFor(() => {
      expect(updateClientStatusMock).toHaveBeenCalledTimes(1);
    });
    expect(approveMock).not.toHaveBeenCalled();
    expect(requestChangesMock).not.toHaveBeenCalled();
  });
});
