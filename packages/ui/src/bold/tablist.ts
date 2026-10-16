import { useCallback, useRef } from 'react';

import type { KeyboardEvent } from 'react';

/**
 * Roving focus for a horizontal tablist (redesign commit 3b, spec §3.7): Arrow keys move focus
 * between tabs, Home/End jump to the ends, and selection stays manual — Enter/Space activate the
 * focused tab through the button's native click. `BoldTabs` and `BoldSubnav` share it; the caller
 * gives the selected tab `tabIndex 0` and the rest `-1`, which is what makes the roving work.
 */
export function useRovingTablist(count: number) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const setTabRef = useCallback(
    (index: number) => (element: HTMLButtonElement | null) => {
      refs.current[index] = element;
    },
    [],
  );

  const onTabKeyDown = useCallback(
    (index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
      const target =
        event.key === 'ArrowRight'
          ? (index + 1) % count
          : event.key === 'ArrowLeft'
            ? (index - 1 + count) % count
            : event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? count - 1
                : null;
      if (target === null) {
        return;
      }
      event.preventDefault();
      refs.current[target]?.focus();
    },
    [count],
  );

  return { setTabRef, onTabKeyDown };
}
