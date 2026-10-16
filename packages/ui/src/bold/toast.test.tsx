import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BOLD_TOAST_DURATION_MS, BoldToast } from './toast';

describe('BoldToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing while closed', () => {
    render(
      <BoldToast open={false} onDismiss={() => undefined}>
        Saved
      </BoldToast>,
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('is a status region and self-dismisses after 3.2s', () => {
    const onDismiss = vi.fn();
    render(
      <BoldToast open onDismiss={onDismiss}>
        Creative saved
      </BoldToast>,
    );
    const toast = screen.getByRole('status');
    expect(toast.textContent).toContain('Creative saved');
    expect(BOLD_TOAST_DURATION_MS).toBe(3200);
    act(() => {
      vi.advanceTimersByTime(BOLD_TOAST_DURATION_MS - 1);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('cancels the timer when closed early, so a dismissed toast never fires twice', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <BoldToast open onDismiss={onDismiss}>
        Saved
      </BoldToast>,
    );
    rerender(
      <BoldToast open={false} onDismiss={onDismiss}>
        Saved
      </BoldToast>,
    );
    act(() => {
      vi.advanceTimersByTime(BOLD_TOAST_DURATION_MS * 2);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
