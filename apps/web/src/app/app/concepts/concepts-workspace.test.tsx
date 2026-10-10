import { COLUMN_SEED } from '@tas/db';
import { describe, expect, it } from 'vitest';

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
