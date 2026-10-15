// @vitest-environment jsdom
import { COLUMN_SEED } from '@tas/db';
import { defaultUserViewConfig } from '@tas/domain';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { loadConceptColumns, loadConcepts } from '@/lib/concepts-source';
import { conceptPath } from '@/lib/routes';
import { groupRows } from '@/components/views/airtable-grid-logic';
import { gridColumnsFrom } from '@/components/views/resolved-columns';

import { CONCEPT_RENDERERS, ConceptsWorkspace } from './concepts-workspace';
import {
  EMPTY_CONCEPT_RECORD,
  clientStatusView,
  internalStatusView,
  type ConceptItem,
} from './fields';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('./bulk-actions', () => ({
  deleteConceptsAction: vi.fn(),
  bulkMoveConceptsAction: vi.fn(),
}));

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

/**
 * Phase B5 commit 3 — the GroupOrderController is wired into the Concepts grid. The DAO scope is
 * `concepts`; the test renders the workspace with an active view that groups by `clientStatus`
 * and asserts a draggable SortableGroupHeader lands on every group header. A view with no group
 * draws no drag handle.
 */
describe('Phase B5 commit 3 — GroupOrderController in Concepts grid', () => {
  async function demoConcepts() {
    const demoMode = () => true;
    const [{ rows }, { columns }] = await Promise.all([
      loadConcepts({ demoMode }),
      loadConceptColumns({ demoMode }),
    ]);
    const items: ConceptItem[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      batch: row.batch,
      angleName: row.angleName,
      personaName: row.personaName,
      productName: row.productName,
      themeName: row.themeName,
      href: conceptPath(row.id),
      ...EMPTY_CONCEPT_RECORD,
      status: internalStatusView(row.internalStatus),
      clientStatus: clientStatusView(row.clientStatus),
    }));
    return { columns, items };
  }

  it('mounts a draggable SortableGroupHeader per group when the view groups by a column', async () => {
    const { columns, items } = await demoConcepts();
    const markup = renderToString(
      <ConceptsWorkspace
        columns={columns}
        items={items}
        demo
        initialView="table"
        initialSearch=""
        userViews={{
          userId: null,
          views: [
            {
              id: 'view-concepts-group',
              name: 'By client status',
              isActive: true,
              ...defaultUserViewConfig('grid'),
              groupBy: 'client_status',
            },
          ],
        }}
      />,
    );
    expect(markup).toContain('data-slot="group-header-draggable"');
    const handles = markup.match(/data-slot="group-drag-handle"/g) ?? [];
    expect(handles.length).toBeGreaterThan(0);
  });

  it('renders no drag handle when the view has no groupBy', async () => {
    const { columns, items } = await demoConcepts();
    const markup = renderToString(
      <ConceptsWorkspace
        columns={columns}
        items={items}
        demo
        initialView="table"
        initialSearch=""
        userViews={{ userId: null, views: [] }}
      />,
    );
    expect(markup).not.toContain('data-slot="group-drag-handle"');
  });
});
