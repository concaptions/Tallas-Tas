import { describe, expect, it } from 'vitest';

import {
  HYDRATION_REPLAY_ATTR,
  HYDRATION_REPLAY_BOOT_SCRIPT,
  hasHandlerUpTree,
  isMountedNode,
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
  it('is a self-contained IIFE that records a pointerdown whose target is not hydrated', () => {
    expect(HYDRATION_REPLAY_BOOT_SCRIPT.startsWith('(function(){')).toBe(true);
    expect(HYDRATION_REPLAY_BOOT_SCRIPT.endsWith('})();')).toBe(true);
    expect(HYDRATION_REPLAY_BOOT_SCRIPT).toContain("addEventListener('pointerdown'");
    // Gated on the TARGET's hydration stamp, never on the shell's attribute (SMOKE-16).
    expect(HYDRATION_REPLAY_BOOT_SCRIPT).toContain("indexOf('__reactProps$')");
    expect(HYDRATION_REPLAY_BOOT_SCRIPT).not.toContain(HYDRATION_REPLAY_ATTR);
    expect(HYDRATION_REPLAY_BOOT_SCRIPT).toContain('q.length>=8');
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

/**
 * SMOKE-22: a press is replayed only into a COMMITTED tree with a listener up the chain. The
 * checks are React's own: a node is mounted when its fiber chain carries no Placement/Hydrating
 * flag (4098) and ends at a host root (tag 3); a handler is an `on…` key in some ancestor's props.
 */
function fiberChain(flagsOnLeaf: number, rootTag = 3): object {
  const root = { tag: rootTag, flags: 0, return: null, alternate: null };
  const leaf = { tag: 5, flags: flagsOnLeaf, return: root, alternate: null };
  return leaf;
}

describe('isMountedNode', () => {
  it('is true for a stamped node whose fiber chain is committed up to a host root', () => {
    expect(isMountedNode({ __reactFiber$abc: fiberChain(0) })).toBe(true);
  });

  it('is false while the fiber is still Hydrating or a Placement (render phase, not committed)', () => {
    expect(isMountedNode({ __reactFiber$abc: fiberChain(4096) })).toBe(false);
    expect(isMountedNode({ __reactFiber$abc: fiberChain(2) })).toBe(false);
  });

  it('is false for a node React has not touched, or a chain that reaches no host root', () => {
    expect(isMountedNode({})).toBe(false);
    expect(isMountedNode({ __reactFiber$abc: fiberChain(0, 5) })).toBe(false);
  });
});

describe('hasHandlerUpTree', () => {
  it('finds a handler on the node or any ancestor, and none on an inert subtree', () => {
    const button = { __reactProps$x: { onClick: () => undefined }, parentElement: null };
    const icon = { __reactProps$x: { className: 'i' }, parentElement: button };
    const inert = { __reactProps$x: { className: 'wrap' }, parentElement: null };
    expect(hasHandlerUpTree(button)).toBe(true);
    expect(hasHandlerUpTree(icon)).toBe(true);
    expect(hasHandlerUpTree(inert)).toBe(false);
    expect(hasHandlerUpTree({ parentElement: inert })).toBe(false);
  });
});
