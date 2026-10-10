import { describe, expect, it } from 'vitest';

import {
  HYDRATION_REPLAY_ATTR,
  HYDRATION_REPLAY_BOOT_SCRIPT,
  replayPreHydrationClicks,
  schedulePreHydrationReplay,
} from './hydration-replay';

/**
 * The replay without a DOM: the boot script is the inline string the root layout ships (it must
 * parse, stop recording once the root is stamped, and cap the queue), and the replay is a no-op
 * off the browser. The behaviour itself — a press that landed before hydration opens the dialog
 * after it — is the Playwright spec `first-click.spec.ts`, which reproduced the loss first.
 */
describe('HYDRATION_REPLAY_BOOT_SCRIPT', () => {
  it('is a self-contained IIFE that records pointerdowns until the root is stamped', () => {
    expect(HYDRATION_REPLAY_BOOT_SCRIPT.startsWith('(function(){')).toBe(true);
    expect(HYDRATION_REPLAY_BOOT_SCRIPT.endsWith('})();')).toBe(true);
    expect(HYDRATION_REPLAY_BOOT_SCRIPT).toContain("addEventListener('pointerdown'");
    expect(HYDRATION_REPLAY_BOOT_SCRIPT).toContain(`hasAttribute("${HYDRATION_REPLAY_ATTR}")`);
    expect(HYDRATION_REPLAY_BOOT_SCRIPT).toContain('q.length>=4');
  });
});

describe('the replay off the browser', () => {
  it('replays nothing and schedules nothing where there is no document', () => {
    expect(replayPreHydrationClicks()).toBe(0);
    expect(() => {
      schedulePreHydrationReplay()();
    }).not.toThrow();
  });
});
