import { describe, expect, it } from 'vitest';
import { CLIENT_STATUS, canTransitionClient, chipTone } from '@tas/domain/state';
import { demoBriefs } from '@tas/db';

import { loadClientQueue } from '@/lib/client-queue-source';

describe('client portal data', () => {
  it('loads only client-eligible briefs from demo fixtures', async () => {
    const { rows, withheld } = await loadClientQueue({ demoMode: () => true });
    expect(rows.length).toBeGreaterThan(0);
    expect(withheld).toBeGreaterThan(0);
    expect(rows.length + withheld).toBe(demoBriefs.length);
  });

  it('all loaded rows have approved or launched internal status', async () => {
    const { rows } = await loadClientQueue({ demoMode: () => true });
    for (const row of rows) {
      expect(['approved', 'launched']).toContain(row.internalStatus);
    }
  });

  it('maps client status labels from the domain', async () => {
    const { rows } = await loadClientQueue({ demoMode: () => true });
    for (const row of rows) {
      const entry = CLIENT_STATUS.find((s) => s.key === row.clientStatus);
      expect(entry).toBeDefined();
      expect(chipTone(entry?.label ?? '')).toBeTruthy();
    }
  });

  it('never exposes internal-only fields to the client view', async () => {
    const { rows } = await loadClientQueue({ demoMode: () => true });
    for (const row of rows) {
      expect(row).toHaveProperty('name');
      expect(row).toHaveProperty('clientStatus');
      expect(row).toHaveProperty('platform');
    }
  });

  it('determines available actions per row from the state machine', async () => {
    const { rows } = await loadClientQueue({ demoMode: () => true });
    const pendingRow = rows.find((r) => r.clientStatus === 'pending_for_approval');
    if (pendingRow) {
      expect(
        canTransitionClient(pendingRow.internalStatus, pendingRow.clientStatus, 'approved'),
      ).toBe(true);
      expect(
        canTransitionClient(pendingRow.internalStatus, pendingRow.clientStatus, 'revisions_needed'),
      ).toBe(true);
    }
    const approvedRow = rows.find((r) => r.clientStatus === 'approved');
    if (approvedRow) {
      expect(
        canTransitionClient(approvedRow.internalStatus, approvedRow.clientStatus, 'approved'),
      ).toBe(false);
    }
  });
});
