import { COLUMN_SEED } from '@tas/db';
import { describe, expect, it } from 'vitest';

import { groupRows } from '@/components/views/airtable-grid-logic';
import { gridColumnsFrom } from '@/components/views/resolved-columns';

import { CONCEPT_RENDERERS } from './concepts-workspace';

/**
 * Every Concepts column the seed can make the resolver emit is DRAWN (the Creative Design gate,
 * applied here after SMOKE-12: `client_approval_status` was seeded as "Client Approval" on
 * 2026-10-08 and had no renderer, so the grid reported it missing and never showed the column).
 */
const seededColumns: readonly string[] = [
  ...new Set(
    COLUMN_SEED.flatMap((group) => group.rows)
      .filter((row) => row.tableKey === 'concepts' && row.isHidden !== true)
      .map((row) => row.columnKey),
  ),
];

/**
 * SMOKE-18: "Group: Client Approval" works on the grid. The Group menu offers every resolved
 * column, and `groupRows` buckets by the column's `sortValue` — so the registry's
 * `client_approval_status` entry must read a groupable string (the status label), with the unset
 * rows landing in the one empty bucket rather than scattering.
 */
describe('grouping by Client Approval', () => {
  it('buckets the rows by the client approval label, the unset ones together', () => {
    const { columns } = gridColumnsFrom(
      [
        {
          columnKey: 'client_approval_status',
          displayLabel: 'Client Approval',
          displayOrder: 12,
        },
      ],
      CONCEPT_RENDERERS,
    );
    const rows = [
      { id: 'a', clientApproval: { key: 'approved', label: 'Approved', tone: 'ok' } },
      { id: 'b', clientApproval: null },
      { id: 'c', clientApproval: { key: 'approved', label: 'Approved', tone: 'ok' } },
      { id: 'd', clientApproval: { key: 'disapproved', label: 'Disapproved', tone: 'bad' } },
    ] as unknown as Parameters<(typeof CONCEPT_RENDERERS)['client_approval_status']['render']>[0][];

    const groups = groupRows(rows, 'client_approval_status', columns);
    expect(groups?.map((group) => [group.label, group.rows.length])).toEqual([
      ['Approved', 2],
      ['Empty', 1],
      ['Disapproved', 1],
    ]);
  });
});

describe('CONCEPT_RENDERERS', () => {
  it('draws every Concepts column the seed can resolve — Client Approval included', () => {
    const { missing } = gridColumnsFrom(
      seededColumns.map((columnKey, index) => ({
        columnKey,
        displayLabel: columnKey,
        displayOrder: index,
        fieldType: null,
        source: 'parent' as const,
        formula: null,
        isDetached: false,
        inheritedFrom: null,
      })),
      CONCEPT_RENDERERS,
    );
    expect(seededColumns).toContain('client_approval_status');
    expect(missing).toEqual([]);
  });
});
