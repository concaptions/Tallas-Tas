/**
 * Pre-hydration clicks, kept and replayed (SMOKE-13, 2026-10-10).
 *
 * React drops a discrete event that lands before the tree it targets has hydrated — the button
 * takes native focus and nothing happens. On a cold visit the gap is the JS download and parse,
 * so no boundary ordering closes it, and the smoke test saw it on three different controls (the
 * Kanban tab, "New creative", the brand switcher). React 17 replayed these itself; 18 stopped.
 *
 * `HYDRATION_REPLAY_BOOT_SCRIPT` runs inline before any bundle: it records a `pointerdown` whose
 * TARGET React has not hydrated yet (a hydrated node carries a `__reactProps$…` property), keeping
 * the element and the pointer kind. It is not gated on the shell: the shell hydrates seconds before
 * a 400-row page segment behind `loading.tsx`, and a press into that segment in the meantime was
 * lost (SMOKE-16, reproduced by holding only the segment's chunks). `schedulePreHydrationReplay`
 * runs from the shell's first client effect: it stamps `data-hydrated` (a signal for tests, not a
 * gate), then for thirty seconds keeps draining the queue and, as soon as each recorded target has
 * itself hydrated AND committed (`isMountedNode`, React's own mounted rule — a stamped node in a
 * still-hydrating segment is not dispatched to, SMOKE-22) and something up its tree listens
 * (`hasHandlerUpTree` — an inert press is dropped rather than replayed late into an open menu),
 * re-dispatches the sequence a real press produces — pointerdown, mousedown, focus, pointerup, mouseup, click —
 * so a Radix trigger listening on any of them (Tabs: mousedown / focus; Dialog: click;
 * DropdownMenu: pointerdown) reacts exactly once. A target that is gone or disabled is skipped;
 * a press whose target never hydrates within the window is dropped.
 */
export const HYDRATION_REPLAY_ATTR = 'data-hydrated';
const QUEUE_KEY = '__tasPreHydrationClicks';
const MAX_QUEUED = 8;

export const HYDRATION_REPLAY_BOOT_SCRIPT = `(function(){var d=document,q=[];window[${JSON.stringify(
  QUEUE_KEY,
)}]=q;function h(t){for(var k in t){if(k.indexOf('__reactProps$')===0)return true;}return false;}d.addEventListener('pointerdown',function(e){var t=e.target;if(!t||t.nodeType!==1)return;if(h(t))return;if(q.length>=${String(
  MAX_QUEUED,
)})return;q.push({target:t,pointerType:e.pointerType||'mouse'});},true);})();`;

interface QueuedClick {
  readonly target: Element;
  readonly pointerType: string;
}

function queued(): QueuedClick[] {
  const record = (window as unknown as Record<string, unknown>)[QUEUE_KEY];
  return Array.isArray(record) ? (record as QueuedClick[]) : [];
}

/** True once React has hydrated this node: hydration stamps every host node with its props. */
function isHydratedNode(target: Element): boolean {
  return Object.keys(target).some((key) => key.startsWith('__reactProps$'));
}

/** What React leaves on a host node: its fiber (`__reactFiber$…`) and its props (`__reactProps$…`). */
interface FiberLike {
  readonly tag: number;
  readonly flags: number;
  readonly return: FiberLike | null;
  readonly alternate: FiberLike | null;
}

const HOST_ROOT_TAG = 3;
/** `Placement | Hydrating`: the fiber is in a tree React has not COMMITTED yet. */
const NOT_YET_COMMITTED_FLAGS = 0b1000000000010;

function reactKey(target: object, prefix: string): string | undefined {
  return Object.keys(target).find((key) => key.startsWith(prefix));
}

/**
 * True when the node's fiber sits in a committed tree — React's own `getNearestMountedFiber`
 * rule (SMOKE-22). Hydration stamps a node's props during the RENDER phase, and a 400-row
 * segment hydrates time-sliced over many frames before one commit at the end: a press replayed at
 * the stamp lands in a tree React does not dispatch to yet and is lost again. A node with no
 * fiber at all answers false; a fiber whose chain does not end at a host root answers false.
 */
export function isMountedNode(target: object): boolean {
  const key = reactKey(target, '__reactFiber$');
  if (key === undefined) return false;
  let node = (target as Record<string, unknown>)[key] as FiberLike | null | undefined;
  if (node === null || node === undefined) return false;
  let fiber: FiberLike = node;
  // Walk the not-yet-alternated chain: a Placement/Hydrating flag on the way means uncommitted.
  for (let next: FiberLike | null = node; next !== null && next.alternate === null;) {
    node = next;
    if ((node.flags & NOT_YET_COMMITTED_FLAGS) !== 0) return false;
    next = node.return;
    if (next !== null) fiber = next;
  }
  for (; fiber.return !== null;) fiber = fiber.return;
  return fiber.tag === HOST_ROOT_TAG;
}

/**
 * True when the node, or an ancestor, carries a React handler (`on…` in its props) — a press that
 * nothing listens to has nothing to replay, and replaying it late could dismiss the dialog or
 * menu the user has since opened (SMOKE-22).
 */
export function hasHandlerUpTree(target: object): boolean {
  let node: (object & { parentElement?: Element | null }) | null = target;
  for (let depth = 0; node !== null && depth < 64; depth += 1) {
    const key = reactKey(node, '__reactProps$');
    if (key !== undefined) {
      const props = (node as Record<string, unknown>)[key];
      if (
        props !== null &&
        typeof props === 'object' &&
        Object.keys(props).some((name) => name.startsWith('on'))
      ) {
        return true;
      }
    }
    node = node.parentElement ?? null;
  }
  return false;
}

/** Replayable: hydrated, committed, and something up the tree listens. */
function isReplayable(target: Element): boolean {
  return isHydratedNode(target) && isMountedNode(target) && hasHandlerUpTree(target);
}

function dispatchPress(target: Element, pointerType: string): void {
  const init = { bubbles: true, cancelable: true, button: 0, buttons: 1 };
  target.dispatchEvent(new PointerEvent('pointerdown', { ...init, pointerType }));
  target.dispatchEvent(new MouseEvent('mousedown', init));
  if (target instanceof HTMLElement) target.focus();
  target.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0, pointerType }));
  target.dispatchEvent(new MouseEvent('mouseup', { ...init, buttons: 0 }));
  target.dispatchEvent(new MouseEvent('click', { ...init, buttons: 0 }));
}

/** How long a recorded press waits for its target to hydrate before it is dropped. */
const REPLAY_WINDOW_MS = 30_000;
const REPLAY_POLL_MS = 50;

/**
 * Replays the recorded presses, each as soon as ITS target has hydrated — not when the shell has.
 * The root layout hydrates before the page segment behind `loading.tsx`'s Suspense boundary, so a
 * press replayed at the shell's first effect met the same un-hydrated button it was lost on. The
 * returned function cancels the polling (the component's effect cleanup).
 */
export function schedulePreHydrationReplay(): () => void {
  if (typeof document === 'undefined') return () => undefined;
  document.documentElement.setAttribute(HYDRATION_REPLAY_ATTR, 'true');
  const pending: QueuedClick[] = [];
  const started = Date.now();
  let timer: number | null = null;
  const tick = (): void => {
    // New presses keep arriving while page segments hydrate after the shell (SMOKE-16): the
    // boot script records any press whose TARGET is not hydrated yet, for as long as this runs.
    pending.push(...queued().splice(0));
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      const item = pending[index];
      if (item === undefined) continue;
      const { target, pointerType } = item;
      const gone = !document.contains(target);
      const inert =
        target instanceof HTMLElement && target.matches(':disabled, [aria-disabled="true"]');
      if (gone || inert) {
        pending.splice(index, 1);
        continue;
      }
      if (isReplayable(target)) {
        pending.splice(index, 1);
        dispatchPress(target, pointerType);
      }
    }
    if (Date.now() - started < REPLAY_WINDOW_MS) {
      timer = window.setTimeout(tick, REPLAY_POLL_MS);
    }
  };
  tick();
  return () => {
    if (timer !== null) window.clearTimeout(timer);
  };
}

/** The immediate, single pass — kept for a caller that knows its targets are hydrated. Returns the count. */
export function replayPreHydrationClicks(): number {
  if (typeof document === 'undefined') return 0;
  document.documentElement.setAttribute(HYDRATION_REPLAY_ATTR, 'true');
  const items = queued().splice(0);
  let replayed = 0;
  for (const { target, pointerType } of items) {
    if (!document.contains(target) || !isReplayable(target)) continue;
    dispatchPress(target, pointerType);
    replayed += 1;
  }
  return replayed;
}
