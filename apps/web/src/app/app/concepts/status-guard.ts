import { CONCEPT_CLIENT_STATUS_DEFAULT } from '@tas/db';
import {
  canTransitionClient,
  canTransitionInternal,
  isClientStatusKey,
  isClientTrackOpen,
  type ClientStatusKey,
  type InternalStatusKey,
} from '@tas/domain/state';

/**
 * The Concepts status gates, extracted VERBATIM from `actions.ts` (Ticket 8) so the bulk
 * Change-status action re-runs the SAME checks the single-row save runs (CLAUDE.md non-negotiable 4:
 * a disabled button is a hint, the server is the guarantee). A `'use server'` module may only export
 * async functions, so these pure, synchronous helpers live here, concepts-owned, and both actions
 * modules import them.
 *
 * Nothing here opens a connection or reads a row: each function is a statement about STATE —
 * `isClientTrackOpen` / `canTransitionClient` / `canTransitionInternal` from `@tas/domain/state`
 * are the whole vocabulary, and no status is ever compared to a literal.
 */

/** One refusal, named by the field it is about; the caller shapes it for its own wire format. */
export interface ConceptStatusRefusal {
  readonly field: 'internalStatus' | 'clientStatus';
  readonly message: string;
}

export const CLIENT_GATE_SHUT = 'The client track opens once internal status reaches Approved.';
export const CLIENT_NOT_NEXT = 'That is not the next step on the client track.';
export const INTERNAL_NOT_NEXT = 'That is not the next step on the internal track.';

/** Whether a stored string is one of `CLIENT_STATUS`'s keys — the domain's own membership check. */
export function isClientStatus(value: string): value is ClientStatusKey {
  return isClientStatusKey(value);
}

/**
 * THE GATE (CLAUDE.md non-negotiable 6, PRD §9), checked with no database behind it.
 *
 * A concept whose internal status is not Approved has no client track at all, so it may only ever
 * rest on the client track's FIRST state. Anything past that — the whole of the client bar the
 * strategist can click — requires `isClientTrackOpen` on the internal status the same write is
 * storing: a save that approves a creative and moves the client bar in one submission is legal, and
 * a save that walks the internal status back shuts the gate immediately.
 */
export function clientGateRefusal(
  internal: InternalStatusKey,
  client: ClientStatusKey,
): ConceptStatusRefusal | null {
  if (client === CONCEPT_CLIENT_STATUS_DEFAULT) {
    return null;
  }
  if (isClientTrackOpen(internal)) {
    return null;
  }
  return { field: 'clientStatus', message: CLIENT_GATE_SHUT };
}

/** Standing still is always allowed; any actual move has to be the machine's next step. */
export function clientMoveRefusal(
  internal: InternalStatusKey,
  from: ClientStatusKey,
  to: ClientStatusKey,
): ConceptStatusRefusal | null {
  if (to === from) {
    return null;
  }
  const gate = clientGateRefusal(internal, to);
  if (gate !== null) {
    return gate;
  }
  if (!canTransitionClient(internal, from, to)) {
    return { field: 'clientStatus', message: CLIENT_NOT_NEXT };
  }
  return null;
}

/** Any internal move has to be one the state machine allows; standing still always is. */
export function internalMoveRefusal(
  from: InternalStatusKey,
  to: InternalStatusKey,
): ConceptStatusRefusal | null {
  if (to === from || canTransitionInternal(from, to)) {
    return null;
  }
  return { field: 'internalStatus', message: INTERNAL_NOT_NEXT };
}
