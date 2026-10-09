import { clientApprovalStatuses } from '@tas/db/schema';
import { CLIENT_APPROVAL_STATUS, CLIENT_STATUS } from '@tas/domain/state';
import type { Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { updateClientApproval } from './client-approval-actions';

/**
 * The shared `client_approval_status` writer for concepts and copywriting, under the one client
 * vocabulary (2026-10-10): a `CLIENT_STATUS` key is stored as it is, the retired four-value spelling
 * is stored as its mapped key, anything else is refused before any write. Each table's db writer is
 * replaced by a recorder; the three scopes run the body against one brand.
 */
const seam = vi.hoisted(() => ({
  written: [] as { table: string; status: string; note: string | null }[],
  scope: <T>(run: (db: Db, brandId: string) => Promise<T>): Promise<T | null> =>
    run({} as Db, 'brand-under-test'),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({
  auth: (): Promise<{ userId: string | null }> => Promise.resolve({ userId: 'user_2TESTACTOR' }),
}));
vi.mock('./concepts-source', () => ({ withBrandScope: seam.scope }));
vi.mock('./copy-source', () => ({ withBrandScope: seam.scope }));
vi.mock('./ugc-source', () => ({ withBrandScope: seam.scope }));
vi.mock('@tas/db', async (importOriginal) => {
  const record =
    (table: string) =>
    (_db: Db, _brandId: string, id: string, status: string, note: string | null) => {
      seam.written.push({ table, status, note });
      return Promise.resolve({ id, clientApprovalStatus: status });
    };
  return {
    ...(await importOriginal<typeof import('@tas/db')>()),
    updateConceptClientApproval: record('concepts'),
    updateCopyClientApproval: record('copywriting'),
    updateCreatorClientApproval: record('creators'),
  };
});

function live(): void {
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
}

afterEach(() => {
  vi.unstubAllEnvs();
  seam.written = [];
});

describe('the vocabulary is one list in two packages', () => {
  it('@tas/db/schema clientApprovalStatuses equals CLIENT_APPROVAL_STATUS equals CLIENT_STATUS', () => {
    const pairs = (list: readonly { key: string; label: string }[]) =>
      list.map((entry) => [entry.key, entry.label]);
    expect(pairs(clientApprovalStatuses)).toEqual(pairs(CLIENT_APPROVAL_STATUS));
    expect(pairs(clientApprovalStatuses)).toEqual(pairs(CLIENT_STATUS));
  });
});

describe('updateClientApproval — the mapping on both tables', () => {
  it('concepts: stores a CLIENT_STATUS key as it is and maps the retired spelling', async () => {
    live();

    const kept = await updateClientApproval({
      tableKey: 'concepts',
      recordId: 'concept-1',
      newStatus: 'launched',
    });
    const mapped = await updateClientApproval({
      tableKey: 'concepts',
      recordId: 'concept-1',
      newStatus: 'revision_needed',
      note: 'Angle reads as a feature list.',
    });

    expect(kept.ok && kept.status).toBe('launched');
    expect(mapped.ok && mapped.status).toBe('revisions_needed');
    expect(seam.written).toEqual([
      { table: 'concepts', status: 'launched', note: null },
      { table: 'concepts', status: 'revisions_needed', note: 'Angle reads as a feature list.' },
    ]);
  });

  it('copywriting: the same two rules, pending_client_approval included', async () => {
    live();

    await updateClientApproval({
      tableKey: 'copywriting',
      recordId: 'copy-1',
      newStatus: 'pending_client_approval',
    });
    await updateClientApproval({
      tableKey: 'copywriting',
      recordId: 'copy-1',
      newStatus: 'revisions_submitted',
    });

    expect(seam.written.map((row) => row.status)).toEqual([
      'pending_for_approval',
      'revisions_submitted',
    ]);
  });

  it('refuses a word outside both spellings, on either table, before any write', async () => {
    live();

    const concept = await updateClientApproval({
      tableKey: 'concepts',
      recordId: 'concept-1',
      newStatus: 'nonsense',
    });
    const copy = await updateClientApproval({
      tableKey: 'copywriting',
      recordId: 'copy-1',
      newStatus: 'rejected',
    });

    expect(concept.ok).toBe(false);
    expect(copy.ok).toBe(false);
    expect(seam.written).toEqual([]);
  });

  it('still asks for a reason on disapproved and revisions_needed, in either spelling', async () => {
    live();

    const bare = await updateClientApproval({
      tableKey: 'concepts',
      recordId: 'concept-1',
      newStatus: 'revision_needed',
    });

    expect(bare.ok).toBe(false);
    expect(seam.written).toEqual([]);
  });
});
