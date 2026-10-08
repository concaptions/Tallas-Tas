'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  updateConceptClientApproval,
  updateCopyClientApproval,
  updateCreativeSheetClientApproval,
  updateCreatorClientApproval,
  type Db,
} from '@tas/db';
import { CLIENT_APPROVAL_STATUS } from '@tas/domain/state';

import { withBrandScope as withConceptScope } from './concepts-source';
import { withBrandScope as withCreativeSheetScope } from './creative-sheet-source';
import { withBrandScope as withCopyScope } from './copy-source';
import { withBrandScope as withUgcScope } from './ugc-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from './demo-mode';
import { conceptsPath, copywritingPath, creativeSheetPath, ugcPath } from './routes';

/**
 * The server action for the `client_approval_status` column on `creative_sheet_items` and
 * `copywriting` (Talal sync action item). These columns are SEPARATE from the two-track
 * `clientStatus` column: the two-track is the PRD approval flow, while client approval status
 * is the client's direct response to a delivered creative or copy. The dispatch pattern mirrors
 * `client-status-actions.ts`, with one entry point for both tables.
 */

export type ClientApprovalTableKey =
  'creative_sheet_items' | 'copywriting' | 'concepts' | 'creators';

export interface UpdateClientApprovalArgs {
  readonly tableKey: ClientApprovalTableKey;
  readonly recordId: string;
  readonly newStatus: string;
  readonly note?: string | null;
}

export interface UpdateClientApprovalSuccess {
  readonly ok: true;
  readonly tableKey: ClientApprovalTableKey;
  readonly recordId: string;
  readonly status: string;
  readonly note: string | null;
  readonly updatedAt: string;
}

export interface UpdateClientApprovalFailure {
  readonly ok: false;
  readonly error: string;
}

export type UpdateClientApprovalResult = UpdateClientApprovalSuccess | UpdateClientApprovalFailure;

const VALID_KEYS = CLIENT_APPROVAL_STATUS.map((entry) => entry.key) as readonly string[];

const NOTE_REQUIRED: readonly string[] = ['disapproved', 'revision_needed'];

type ClientApprovalDispatch = (
  db: Db,
  brandId: string,
  recordId: string,
  newStatus: string,
  note: string | null,
  actorId: string,
) => Promise<{ clientApprovalStatus?: string | null } | null>;

const DISPATCH: Record<ClientApprovalTableKey, ClientApprovalDispatch> = {
  creative_sheet_items: async (db, brandId, id, status, note, actorId) =>
    updateCreativeSheetClientApproval(db, brandId, id, status, note, actorId),
  copywriting: async (db, brandId, id, status, note, actorId) =>
    updateCopyClientApproval(db, brandId, id, status, note, actorId),
  concepts: async (db, brandId, id, status, note, actorId) =>
    updateConceptClientApproval(db, brandId, id, status, note, actorId),
  creators: async (db, brandId, id, status, note, actorId) =>
    updateCreatorClientApproval(db, brandId, id, status, note, actorId),
};

const REVALIDATE: Record<ClientApprovalTableKey, readonly string[]> = {
  creative_sheet_items: [creativeSheetPath],
  copywriting: [copywritingPath],
  concepts: [conceptsPath],
  creators: [ugcPath],
};

function scopeFor(tableKey: ClientApprovalTableKey) {
  switch (tableKey) {
    case 'creative_sheet_items':
      return withCreativeSheetScope;
    case 'copywriting':
      return withCopyScope;
    case 'concepts':
      return withConceptScope;
    case 'creators':
      return withUgcScope;
  }
}

export async function updateClientApproval(
  args: UpdateClientApprovalArgs,
): Promise<UpdateClientApprovalResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const { tableKey, recordId, newStatus } = args;

  if (typeof recordId !== 'string' || recordId === '') {
    return { ok: false, error: 'That record is no longer available.' };
  }

  if (!VALID_KEYS.includes(newStatus)) {
    return { ok: false, error: 'That is not a valid client approval status.' };
  }

  const trimmedNote = typeof args.note === 'string' ? args.note.trim() : null;
  const noteValue = trimmedNote === '' ? null : trimmedNote;

  if (NOTE_REQUIRED.includes(newStatus) && (noteValue === null || noteValue === '')) {
    return { ok: false, error: 'Add a short reason for this status change.' };
  }

  try {
    const { userId } = await auth();
    if (userId === null) {
      return { ok: false, error: 'Your session has expired. Sign in again to save.' };
    }

    const withScope = scopeFor(tableKey);
    const outcome = await withScope(async (db, brandId) => {
      const dispatcher = DISPATCH[tableKey];
      const saved = await dispatcher(db, brandId, recordId, newStatus, noteValue, userId);
      if (saved === null) {
        return { ok: false as const, error: 'That record is no longer available.' };
      }
      return { ok: true as const };
    });

    if (outcome === null) {
      return { ok: false, error: 'This workspace has no brand yet.' };
    }
    if (!outcome.ok) {
      return outcome;
    }

    for (const path of REVALIDATE[tableKey]) {
      revalidatePath(path);
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
    return { ok: false, error: 'The status could not be saved. Try again.' };
  }
}
