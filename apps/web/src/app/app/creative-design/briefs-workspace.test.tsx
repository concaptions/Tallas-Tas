import { renderToStaticMarkup } from 'react-dom/server';
import { COLUMN_SEED, demoBriefs } from '@tas/db';
import { describe, expect, it } from 'vitest';

import { gridColumnsFrom } from '@/components/views/resolved-columns';
import { EmptyCell } from '@/components/views/grid-cells';

import { BRIEF_RENDERERS } from './briefs-workspace';
import {
  briefStageView,
  clientStatusView,
  creativeTypeLabel,
  internalStatusView,
  performanceView,
  priorityView,
  type BriefItem,
} from './fields';

/**
 * THE gate that replaces the old `BRIEF_COLUMNS` tuple assertion (AI-64a), in the shape the other
 * resolver-driven pages use: the resolver owns the labels and the order, so what a test can still
 * hold the page to is that EVERY column the seed can make the resolver emit — on the parent base or
 * on Gratsi's — is actually DRAWN. A configured column with no renderer is reported by
 * `gridColumnsFrom` rather than dropped, and this is where that report must be empty.
 */
const seededColumns: readonly string[] = [
  ...new Set(
    COLUMN_SEED.flatMap((group) => group.rows)
      .filter((row) => row.tableKey === 'creative_briefs' && row.isHidden !== true)
      .map((row) => row.columnKey),
  ),
];

const [fixture] = demoBriefs;
if (fixture === undefined) {
  throw new Error('the demo brief fixtures are empty');
}
/** The narrowed row, bound once: a hoisted function below cannot see the guard above. */
const first = fixture;

function itemOf(overrides: Partial<BriefItem> = {}): BriefItem {
  return {
    id: first.id,
    name: first.name,
    conceptName: first.conceptName,
    type: first.type,
    typeLabel: creativeTypeLabel(first.type),
    priority: priorityView(first.priority),
    assignee: first.assignee,
    status: internalStatusView('video', 'approved'),
    clientStatus: clientStatusView(first.clientStatus),
    performance: performanceView(first.performance),
    stage: briefStageView(first.internalStatus),
    row: first,
    angleName: first.angleName,
    productName: first.productName,
    collectionName: null,
    campaignOfferName: null,
    assetName: null,
    funnelLabel: first.funnel,
    sourceLabel: first.source,
    href: `/app/creative-design/${first.id}`,
    kanbanFields: {},
    galleryImageUrl: null,
    formSnapshot: {
      conceptId: '',
      funnel: first.funnel,
      type: first.type,
      version: '1',
      batch: '',
      product: '',
      priority: '',
      assignee: '',
      dueDate: '',
      briefToDesign: '',
      scriptContent: '',
      elementsTested: '',
      adContent: '',
      inspiration: '',
      offer: '',
      language: '',
      spellingFeedback2: '',
      angleId: '',
      productId: '',
      inspoLinks: [],
      dimensions: [],
      internalStatus: first.internalStatus,
      clientStatus: first.clientStatus,
    },
    linkCounts: { sheetItems: 0, modules: 0, folders: 0, reports: 0 },
    ...overrides,
  };
}

/** The dash cell, as markup. A cell that contains this drew nothing from the row. */
const EMPTY_CELL = renderToStaticMarkup(<EmptyCell />);

function markupOf(columnKey: string, item: BriefItem): string {
  const renderer = BRIEF_RENDERERS[columnKey];
  if (renderer === undefined) {
    throw new Error(`no renderer for ${columnKey}`);
  }
  return renderToStaticMarkup(<>{renderer.render(item)}</>);
}

describe('BRIEF_RENDERERS', () => {
  it('draws every Creative Design column the seed can resolve, on either base', () => {
    const { missing } = gridColumnsFrom(
      seededColumns.map((columnKey, index) => ({
        columnKey,
        displayLabel: columnKey,
        displayOrder: index,
      })),
      BRIEF_RENDERERS,
    );

    expect(missing).toEqual([]);
    // Falsifiable: the seed really does carry more than the six columns the old tuple named.
    expect(seededColumns.length).toBeGreaterThan(30);
    for (const key of ['name', 'concept_id', 'type', 'priority', 'assignee', 'internal_status']) {
      expect(seededColumns).toContain(key);
    }
  });

  it('supplies no header of its own — the label and the order are the resolver’s', () => {
    const { columns } = gridColumnsFrom(
      [
        { columnKey: 'due_date', displayLabel: 'Deadline', displayOrder: 2 },
        { columnKey: 'name', displayLabel: 'Creative', displayOrder: 1 },
      ],
      BRIEF_RENDERERS,
    );

    expect(columns.map((column) => column.header)).toEqual(['Creative', 'Deadline']);
    expect(columns.map((column) => column.key)).toEqual(['name', 'due_date']);
  });

  it('renders the due date as a day, and the dash when the brief has no deadline', () => {
    const due = itemOf({ row: { ...first, dueDate: new Date('2026-10-20T00:00:00.000Z') } });

    expect(markupOf('due_date', due)).toContain('2026-10-20');
    expect(markupOf('due_date', itemOf({ row: { ...first, dueDate: null } }))).toBe(EMPTY_CELL);
  });

  it('colours the primary cell by the editor stage, through the shared chip', () => {
    const incoming = itemOf({ stage: briefStageView('sent_to_video_editor') });
    const markup = markupOf('name', incoming);

    expect(markup).toContain('data-slot="status-chip"');
    expect(markup).toContain('data-tone="info"');
    expect(markup).toContain('Sent to Editor/Designer');
    // The generated §7 name stays monospace, because it is system output and not a typed field.
    expect(markup).toContain('data-slot="brief-row-name"');
    expect(markup).toContain('font-mono');
  });

  it('draws no stage chip at all once the brief is off the editor board', () => {
    const markup = markupOf('name', itemOf({ stage: briefStageView('approved') }));

    expect(markup).not.toContain('data-slot="status-chip"');
    expect(markup).toContain(first.name);
  });

  it('says Standalone in a chip for a brief with no concept, never an empty cell', () => {
    const markup = markupOf('concept_id', itemOf({ conceptName: null }));

    expect(markup).toContain('data-slot="brief-standalone"');
    expect(markup).toContain('data-tone="mute"');
    expect(markup).not.toBe(EMPTY_CELL);
  });

  it('counts an attachment column rather than printing its URLs', () => {
    const markup = markupOf(
      'design_file',
      itemOf({ row: { ...first, designFile: ['https://a/1.png', 'https://a/2.png'] } }),
    );

    expect(markup).toContain('2 files');
    expect(markup).not.toContain('https://a/1.png');
    expect(markupOf('design_file', itemOf({ row: { ...first, designFile: null } }))).toBe(
      EMPTY_CELL,
    );
  });

  it('draws the three QA ticks from the row’s own booleans', () => {
    const ticked = itemOf({ row: { ...first, qaVideoEditor: true, qaDesigner: false } });

    expect(markupOf('qa_video_editor', ticked)).toContain('aria-label="Yes"');
    expect(markupOf('qa_designer', ticked)).toBe(EMPTY_CELL);
  });

  it('sorts by the value a reader sees, not by a raw key', () => {
    const item = itemOf();

    expect(BRIEF_RENDERERS['name']?.sortValue?.(item)).toBe(first.name);
    expect(BRIEF_RENDERERS['internal_status']?.sortValue?.(item)).toBe('Approved');
    expect(BRIEF_RENDERERS['type']?.sortValue?.(item)).toBe(creativeTypeLabel(first.type));
  });
});
