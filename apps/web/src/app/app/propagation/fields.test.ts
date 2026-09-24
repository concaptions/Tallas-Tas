import {
  demoPromotionRequests,
  demoReviewedPromotionRequests,
  type PromotionRequestRow,
  type PropagationRun,
} from '@tas/db';
import { PROMOTION_STATUS } from '@tas/domain/state';
import { describe, expect, it } from 'vitest';

import {
  ALL_STATUSES,
  DEFAULT_STATUS_FILTER,
  PROMOTION_COLUMNS,
  PROMOTION_FILTERS,
  REMOVED_BRAND_LABEL,
  UNKNOWN_REVIEWER_LABEL,
  brandCell,
  decidedByLabel,
  emptyAction,
  emptyTitle,
  filterNote,
  promotionCountLabel,
  PROPAGATION_TRIGGER_LABELS,
  resolveStatusFilter,
  statusFilterHref,
  statusQuery,
  toPromotionItem,
  toPropagationRunItem,
} from './fields';

/** One fixed instant, so every relative string below is a value rather than a moving target. */
const NOW = new Date('2026-09-18T08:10:00.000Z');

const [newest] = demoPromotionRequests;
const approved = demoReviewedPromotionRequests.find((row) => row.status === 'approved');

function requireRow(row: PromotionRequestRow | undefined): PromotionRequestRow {
  if (row === undefined) {
    throw new Error('the fixtures no longer carry the row this test is about');
  }
  return row;
}

describe('PROMOTION_COLUMNS', () => {
  it('opens with the ticket six, in the ticket order, then the decision cell', () => {
    expect(PROMOTION_COLUMNS.slice(0, 6)).toEqual([
      'Brand',
      'Table',
      'Field',
      'Requested by',
      'Requested at',
      'Change',
    ]);
    expect(PROMOTION_COLUMNS).toHaveLength(7);
    expect(PROMOTION_COLUMNS.at(-1)).toBe('Decision');
  });
});

describe('the ?status= filter', () => {
  it('offers every domain state and one option that is not a state', () => {
    expect(PROMOTION_FILTERS.map((option) => option.key)).toEqual([
      ...PROMOTION_STATUS.map((entry) => entry.key),
      ALL_STATUSES,
    ]);
    expect(PROMOTION_FILTERS.map((option) => option.label)).toEqual([
      ...PROMOTION_STATUS.map((entry) => entry.label),
      'All',
    ]);
  });

  it('gives the default state a clean address and every other one a query', () => {
    expect(statusFilterHref(DEFAULT_STATUS_FILTER)).toBe('/app/propagation');
    expect(statusFilterHref('approved')).toBe('/app/propagation?status=approved');
    expect(statusFilterHref(ALL_STATUSES)).toBe('/app/propagation?status=all');
  });

  it('resolves what the address asked for', () => {
    expect(resolveStatusFilter('approved')).toBe('approved');
    expect(resolveStatusFilter('rejected')).toBe('rejected');
    expect(resolveStatusFilter(ALL_STATUSES)).toBe(ALL_STATUSES);
  });

  it('falls back to the pending queue for anything it does not recognise', () => {
    expect(resolveStatusFilter(undefined)).toBe(DEFAULT_STATUS_FILTER);
    expect(resolveStatusFilter('')).toBe(DEFAULT_STATUS_FILTER);
    expect(resolveStatusFilter('promoted')).toBe(DEFAULT_STATUS_FILTER);
    // A repeated ?status= arrives as an array; it must not open the page on everything.
    expect(resolveStatusFilter(['approved', 'rejected'])).toBe(DEFAULT_STATUS_FILTER);
  });

  it('stops the word `all` before it reaches a query', () => {
    expect(statusQuery(ALL_STATUSES)).toBeUndefined();
    expect(statusQuery('pending')).toBe('pending');
    expect(statusQuery('rejected')).toBe('rejected');
  });

  it('says what each state means rather than repeating its own label', () => {
    for (const option of PROMOTION_FILTERS) {
      const note = filterNote(option.key);
      expect(note.length).toBeGreaterThan(0);
      expect(note.toLowerCase()).not.toBe(option.label.toLowerCase());
    }
  });
});

describe('the empty state', () => {
  it('says something different for each state, so "up to date" never reads as "broken"', () => {
    const titles = PROMOTION_FILTERS.map((option) => emptyTitle(option.key));

    expect(new Set(titles).size).toBe(PROMOTION_FILTERS.length);
    expect(titles.every((title) => title.length > 0)).toBe(true);
  });

  it('always offers a way out, and never back to the state that is already empty', () => {
    for (const option of PROMOTION_FILTERS) {
      const action = emptyAction(option.key);

      expect(action.key).not.toBe(option.key);
      expect(action.href.startsWith('/app/propagation')).toBe(true);
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it('sends the empty queue to the history and every other empty state back to the queue', () => {
    expect(emptyAction(DEFAULT_STATUS_FILTER).key).toBe(ALL_STATUSES);
    expect(emptyAction(ALL_STATUSES).key).toBe(DEFAULT_STATUS_FILTER);
    expect(emptyAction('approved').key).toBe(DEFAULT_STATUS_FILTER);
  });
});

describe('toPromotionItem', () => {
  it('resolves a pending fixture into the cells the table renders', () => {
    const item = toPromotionItem(requireRow(newest), NOW);

    expect(item.brand).toEqual({ text: 'Funky Painting', muted: false });
    expect(item.tableName).toBe('angles');
    expect(item.fieldName).toBe('formats');
    expect(item.requestedBy).toBe('Rhiannon Okafor');
    expect(item.currentValue).toBe('Static, Video, Carousel');
    expect(item.proposedValue).toBe('Static, Video, Carousel, Motion Graphic');
    expect(item.pending).toBe(true);
    expect(item.decidedBy).toBeNull();
  });

  it('takes the status label and tone from the domain, never from a literal here', () => {
    const pending = toPromotionItem(requireRow(newest), NOW);
    const settled = toPromotionItem(requireRow(approved), NOW);

    expect(pending.statusLabel).toBe('Pending');
    expect(pending.statusTone).toBe('info');
    expect(settled.statusLabel).toBe('Approved');
    expect(settled.statusTone).toBe('ok');
  });

  it('formats both timestamps on the server, with an absolute one behind the relative', () => {
    const item = toPromotionItem(requireRow(newest), NOW);

    expect(item.requestedAt).toBe('yesterday');
    expect(item.requestedAtTitle).toBe('2026-09-17 08:10');
  });

  it('names who settled a request and when, on a settled row only', () => {
    const item = toPromotionItem(requireRow(approved), NOW);

    expect(item.pending).toBe(false);
    expect(item.decidedBy).toContain('Marguerite Alaoui');
    expect(item.reviewNote).toContain('Promoted.');
  });
});

describe('brandCell', () => {
  it('uses the name the join already carried, so the cell costs no second query', () => {
    expect(brandCell(requireRow(newest))).toEqual({ text: 'Funky Painting', muted: false });
  });

  it('says a soft-deleted brand is gone rather than rendering an empty cell', () => {
    const orphan: PromotionRequestRow = { ...requireRow(newest), brandName: null };

    expect(brandCell(orphan)).toEqual({ text: REMOVED_BRAND_LABEL, muted: true });
  });
});

describe('decidedByLabel', () => {
  it('is null while a request is still pending', () => {
    expect(decidedByLabel(requireRow(newest), NOW)).toBeNull();
  });

  it('never prints half a fact when the reviewer is gone but the timestamp is not', () => {
    const anonymous: PromotionRequestRow = { ...requireRow(approved), reviewedBy: null };

    expect(decidedByLabel(anonymous, NOW)).toContain(UNKNOWN_REVIEWER_LABEL);
  });

  it('is null when a settled row carries no timestamp at all', () => {
    const undated: PromotionRequestRow = { ...requireRow(approved), reviewedAt: null };

    expect(decidedByLabel(undated, NOW)).toBeNull();
  });
});

function runRow(overrides: Partial<PropagationRun> = {}): PropagationRun {
  return {
    id: 'run-1',
    brandId: null,
    createdAt: new Date('2026-09-18T06:10:00.000Z'),
    updatedAt: new Date('2026-09-18T06:10:00.000Z'),
    createdBy: 'user_admin',
    updatedBy: 'user_admin',
    deletedAt: null,
    templateBrandId: 'template-1',
    tableName: 'products',
    trigger: 'update',
    templateRowId: 'row-9',
    childrenUpdated: 3,
    skipped: 1,
    ...overrides,
  };
}

describe('toPropagationRunItem', () => {
  it('resolves a ledger row, labelling the trigger and formatting the run time once', () => {
    const item = toPropagationRunItem(runRow(), NOW);

    expect(item.id).toBe('run-1');
    expect(item.tableName).toBe('products');
    expect(item.triggerLabel).toBe('Row updated');
    expect(item.childrenUpdated).toBe(3);
    expect(item.skipped).toBe(1);
    expect(item.actor).toBe('user_admin');
    // NOW is two hours after the fixed createdAt.
    expect(item.ranAt).toContain('hour');
  });

  it('carries a null actor through for an unattended run', () => {
    expect(toPropagationRunItem(runRow({ createdBy: null }), NOW).actor).toBeNull();
  });

  it('has a label for every trigger the engine can log', () => {
    for (const trigger of Object.keys(PROPAGATION_TRIGGER_LABELS)) {
      expect(
        PROPAGATION_TRIGGER_LABELS[trigger as keyof typeof PROPAGATION_TRIGGER_LABELS],
      ).toBeTruthy();
    }
    expect(PROPAGATION_TRIGGER_LABELS.sweep).toBe('Full re-sync');
    expect(PROPAGATION_TRIGGER_LABELS.seed).toBe('Brand seeded');
  });
});

describe('promotionCountLabel', () => {
  it.each([
    [0, '0 requests'],
    [1, '1 request'],
    [3, '3 requests'],
  ])('reads %s as %s', (count, expected) => {
    expect(promotionCountLabel(count)).toBe(expected);
  });
});
