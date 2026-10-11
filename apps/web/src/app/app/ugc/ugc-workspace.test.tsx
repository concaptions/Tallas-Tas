import { COLUMN_SEED } from '@tas/db';
import { describe, expect, it } from 'vitest';

import { groupRows } from '@/components/views/airtable-grid-logic';
import { gridColumnsFrom } from '@/components/views/resolved-columns';

import { CREATOR_RENDERERS } from './ugc-workspace';

/**
 * Item 5c (2026-10-11): UGC Management draws a Client Approval column. AUDIT-13's ruling:
 * `creators.client_status` is the CREATOR track's own vocabulary, not the client's approval;
 * `creators.client_approval_status` — seeded "Client Approval" and applied to production — is
 * the one client vocabulary on a creator, and it had no renderer. The registry now draws it (the
 * Creative Design gate, pinned for this column), and the column groups.
 */
const seededColumns: readonly string[] = [
  ...new Set(
    COLUMN_SEED.flatMap((group) => group.rows)
      .filter((row) => row.tableKey === 'creators' && row.isHidden !== true)
      .map((row) => row.columnKey),
  ),
];

describe('CREATOR_RENDERERS', () => {
  it('draws every creators column the seed can resolve — Client Approval included', () => {
    const { missing } = gridColumnsFrom(
      seededColumns.map((columnKey, index) => ({
        columnKey,
        displayLabel: columnKey,
        displayOrder: index,
      })),
      CREATOR_RENDERERS,
    );
    expect(seededColumns).toContain('client_approval_status');
    // Three seeded creators columns were undrawn before item 5c and are not its scope
    // (deadline, for_partnership_ads, profile_pic_url); Client Approval must not be among them.
    expect(missing).not.toContain('client_approval_status');
    expect(missing).toEqual(['deadline', 'for_partnership_ads', 'profile_pic_url']);
  });

  it('groups by the client approval label, the unset creators together', () => {
    const { columns } = gridColumnsFrom(
      [{ columnKey: 'client_approval_status', displayLabel: 'Client Approval', displayOrder: 0 }],
      CREATOR_RENDERERS,
    );
    const rows = [
      { id: 'a', name: 'A', clientApprovalStatus: 'approved' },
      { id: 'b', name: 'B', clientApprovalStatus: null },
      { id: 'c', name: 'C', clientApprovalStatus: 'approved' },
      { id: 'd', name: 'D', clientApprovalStatus: 'disapproved' },
    ] as unknown as Parameters<(typeof CREATOR_RENDERERS)['client_approval_status']['render']>[0][];
    expect(
      groupRows(rows, 'client_approval_status', columns)?.map((g) => [g.label, g.rows.length]),
    ).toEqual([
      ['Approved', 2],
      ['Empty', 1],
      ['Disapproved', 1],
    ]);
  });
});
