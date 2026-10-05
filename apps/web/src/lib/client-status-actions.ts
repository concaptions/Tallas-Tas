'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  updateBriefClientStatus,
  updateConceptClientStatus,
  updateCopyStatus,
  updateCreatorClientStatus,
  type Db,
} from '@tas/db';

import {
  clientStatusRequiresNote,
  clientStatusVocabulary,
  type ClientStatusTableKey,
} from './client-status-vocabulary';
import { withBrandScope } from './concepts-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from './demo-mode';
import {
  briefPath,
  briefsPath,
  conceptPath,
  conceptsPath,
  copywritingPath,
  ugcPath,
} from './routes';

/**
 * The ONE server action every client-status control dispatches through (Oct 5 Talal sync,
 * Agent 5). The four tables the Oct 5 meeting named — Concepts, Creative Sheet (`creative_briefs`),
 * UGC Management (`creators`), Copywriting — all carry a client-facing status track, each with
 * its own domain vocabulary (CLIENT_STATUS, CREATOR_STATUS, COPY_STATUS). The dropdown and the
 * detail panel never pick a writer themselves: they call `updateClientStatus({ tableKey, ... })`
 * and this file switches to the right one, so there is one API, one audit trail and one place
 * that writes the status + timestamp + note trio.
 *
 * DEMO MODE: the action refuses immediately, before validation and before any connection. Live
 * only; the writers all go through `withBrand(brandId)` in `@tas/db`.
 *
 * NOTE DISPATCH: three of the four tables already have a note column on this track —
 * `concepts.client_status_note`, `creative_briefs.client_status_note` (both added by migration
 * 0050), `creators.client_note` (PRD §5.8), and `copywriting.client_comment` (PRD §5.11). The
 * writers map `note` onto the right column for each table so the caller never has to know.
 *
 * EVERY EXPORT IN THIS FILE IS AN ASYNC FUNCTION. Next.js refuses to compile a `'use server'`
 * file that exports anything else, so the synchronous helpers (`clientStatusRequiresNote`,
 * `narrowClientStatusKey`, `ClientStatusTableKey`, …) live in
 * `./client-status-vocabulary.ts` and are imported here.
 */

export interface UpdateClientStatusArgs {
  readonly tableKey: ClientStatusTableKey;
  readonly recordId: string;
  readonly newStatus: string;
  readonly note?: string | null;
}

export interface UpdateClientStatusSuccess {
  readonly ok: true;
  readonly tableKey: ClientStatusTableKey;
  readonly recordId: string;
  readonly status: string;
  readonly note: string | null;
  readonly updatedAt: string;
}

export interface UpdateClientStatusFailure {
  readonly ok: false;
  readonly error: string;
}

export type UpdateClientStatusResult = UpdateClientStatusSuccess | UpdateClientStatusFailure;

const UNKNOWN_RECORD = 'That record is no longer available.';
const NO_SESSION = 'Your session has expired. Sign in again to save.';
const NO_BRAND = 'This workspace has no brand yet.';
const BAD_STATUS = 'That is not a status on this track.';
const BAD_TABLE = 'That table does not carry a client-status track.';
const SAVE_FAILED = 'The status could not be saved. Try again.';

/**
 * The one writer map. Internal: `updateClientStatus` resolves `tableKey` here, hands it the row
 * id, the key, the (possibly null) note and the actor, and the writer returns the fresh row —
 * or null if the id belongs to another brand.
 */
type ClientStatusDispatch = (
  db: Db,
  brandId: string,
  recordId: string,
  newStatus: string,
  note: string | null,
  actorId: string,
) => Promise<{ clientStatus?: string; status?: string } | null>;

const DISPATCH: Record<ClientStatusTableKey, ClientStatusDispatch> = {
  concepts: async (db, brandId, id, status, note, actorId) =>
    updateConceptClientStatus(db, brandId, id, status, note, actorId),
  creative_briefs: async (db, brandId, id, status, note, actorId) =>
    updateBriefClientStatus(db, brandId, id, status, note, actorId),
  creators: async (db, brandId, id, status, note, actorId) =>
    updateCreatorClientStatus(db, brandId, id, status, note, actorId),
  copywriting: async (db, brandId, id, status, note, actorId) =>
    updateCopyStatus(db, brandId, id, status, note, actorId),
};

/** Which paths to revalidate once the write lands, per table. */
const REVALIDATE: Record<ClientStatusTableKey, readonly ((id: string) => string)[]> = {
  concepts: [() => conceptsPath, (id) => conceptPath(id)],
  creative_briefs: [() => briefsPath, (id) => briefPath(id)],
  creators: [() => ugcPath],
  copywriting: [() => copywritingPath],
};

function isKnownTable(tableKey: string): tableKey is ClientStatusTableKey {
  return (
    tableKey === 'concepts' ||
    tableKey === 'creative_briefs' ||
    tableKey === 'creators' ||
    tableKey === 'copywriting'
  );
}

/**
 * The one entry point. See the file header for the full shape.
 */
export async function updateClientStatus(
  args: UpdateClientStatusArgs,
): Promise<UpdateClientStatusResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const { tableKey, recordId, newStatus } = args;
  if (!isKnownTable(tableKey)) {
    return { ok: false, error: BAD_TABLE };
  }

  if (recordId === '' || typeof recordId !== 'string') {
    return { ok: false, error: UNKNOWN_RECORD };
  }

  if (!clientStatusVocabulary(tableKey).includes(newStatus)) {
    return { ok: false, error: BAD_STATUS };
  }

  // The note is optional unless the chosen key is a note-required branch. A blank there is a
  // refusal; an unknown table has already returned above.
  const trimmedNote =
    typeof args.note === 'string' ? args.note.trim() : args.note === null ? null : null;
  const noteValue = trimmedNote === '' ? null : (trimmedNote ?? null);
  if (clientStatusRequiresNote(tableKey, newStatus) && (noteValue === null || noteValue === '')) {
    return { ok: false, error: 'Add a short reason for this status change.' };
  }

  try {
    const { userId } = await auth();
    if (userId === null) {
      return { ok: false, error: NO_SESSION };
    }

    const outcome = await withBrandScope(async (db, brandId) => {
      const dispatcher = DISPATCH[tableKey];
      const saved = await dispatcher(db, brandId, recordId, newStatus, noteValue, userId);
      if (saved === null) {
        return { ok: false as const, error: UNKNOWN_RECORD };
      }
      return { ok: true as const };
    });

    if (outcome === null) {
      return { ok: false, error: NO_BRAND };
    }
    if (!outcome.ok) {
      return outcome;
    }

    for (const to of REVALIDATE[tableKey]) {
      revalidatePath(to(recordId));
    }

    return {
      ok: true,
      tableKey,
      recordId,
      status: newStatus,
      note: noteValue,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
}
