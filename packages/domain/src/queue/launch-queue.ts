/**
 * The media buyer's launch queue (PRD §9, §11, §13 — ticket `ads-to-launch` Phase 2).
 *
 * PRD §11 gives the media buyer one job on a creative: "download approved creatives, launch them,
 * and set status to Launched". PRD §9 says what Launched means: "Launched needs to exist on the
 * internal track too, not only the client one — the media buyer sets it once the ad is live, and
 * that's how our team knows a creative is finished". So launching moves BOTH tracks; pausing and
 * resuming (the Phase 1 `launched ⇄ paused` loop) are client-track moves only, because the internal
 * track has no paused state — for the team a launched creative stays finished while its ad is off.
 *
 * Pure, like `client-queue.ts` beside it: every rule the page, the loader and the Server Action need
 * is here, asked of `canTransitionClient` / `canTransitionInternal`, and no caller compares a status
 * to a literal.
 */

import {
  canTransitionClient,
  canTransitionInternal,
  type ClientStatusKey,
  type CreativeTrack,
  type InternalStatusKey,
} from '../state/creative-status';

/** The client status a creative waits in until it is launched: the client has signed it off. */
export const LAUNCH_READY_CLIENT_STATUS: ClientStatusKey = 'approved';

/** The client statuses of a creative that has been launched — live, or live and then paused. */
export const LAUNCHED_CLIENT_STATUSES: readonly ClientStatusKey[] = ['launched', 'paused'];

/** How far back "Recently Launched" reaches, in days. */
export const RECENTLY_LAUNCHED_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The earliest `launched_at` "Recently Launched" shows, relative to `now` (the caller's clock). */
export function recentlyLaunchedSince(now: Date): Date {
  return new Date(now.getTime() - RECENTLY_LAUNCHED_DAYS * DAY_MS);
}

export type LaunchQueueActionKey = 'launch' | 'pause' | 'resume';

export interface LaunchQueueAction {
  readonly key: LaunchQueueActionKey;
  /** The button's label. The only place this string is written. */
  readonly label: string;
  /**
   * The client status the action starts from. Needed because two actions aim at the same target:
   * launch (approved → launched) and resume (paused → launched) differ only in where they begin.
   */
  readonly from: ClientStatusKey;
  /** The client status the action moves the creative to. A button never names a status itself. */
  readonly to: ClientStatusKey;
  readonly description: string;
}

export const LAUNCH_QUEUE_ACTIONS: readonly LaunchQueueAction[] = [
  {
    key: 'launch',
    label: 'Mark as Launched',
    from: 'approved',
    to: 'launched',
    description: 'The ad is live in the account. Marks it Launched on both tracks.',
  },
  {
    key: 'pause',
    label: 'Pause',
    from: 'launched',
    to: 'paused',
    description: 'The live ad was switched off. It can be resumed.',
  },
  {
    key: 'resume',
    label: 'Resume',
    from: 'paused',
    to: 'launched',
    description: 'The paused ad is live again.',
  },
];

/** The action for a key, or `undefined`: a control cannot be built from a key the table lacks. */
export function launchQueueAction(key: string): LaunchQueueAction | undefined {
  return LAUNCH_QUEUE_ACTIONS.find((action) => action.key === key);
}

/**
 * The statuses a creative moves to when `action` is taken, or `null` when the move is illegal from
 * where the creative actually is. Asked of the STORED statuses by the Server Action and of the row's
 * statuses by the page, so the drawn control and the accepted write cannot disagree.
 *
 * Launch also moves the internal track to Launched (PRD §9), and is refused when the internal track
 * cannot get there — which, given the client-track gate, only an inconsistent row can hit. A creative
 * already Launched internally stays so. Pause and resume leave the internal status as it is.
 */
export function launchTransition(
  action: LaunchQueueAction,
  track: CreativeTrack,
  internal: InternalStatusKey,
  client: ClientStatusKey,
): { readonly clientStatus: ClientStatusKey; readonly internalStatus: InternalStatusKey } | null {
  if (client !== action.from || !canTransitionClient(internal, client, action.to)) {
    return null;
  }
  if (action.key !== 'launch') {
    return { clientStatus: action.to, internalStatus: internal };
  }
  if (internal === 'launched' || canTransitionInternal(track, internal, 'launched')) {
    return { clientStatus: action.to, internalStatus: 'launched' };
  }
  return null;
}

/** The actions that can SUCCEED on one creative — the only controls its row may draw. */
export function launchQueueActionsFor(
  track: CreativeTrack,
  internal: InternalStatusKey,
  client: ClientStatusKey,
): readonly LaunchQueueAction[] {
  return LAUNCH_QUEUE_ACTIONS.filter(
    (action) => launchTransition(action, track, internal, client) !== null,
  );
}
