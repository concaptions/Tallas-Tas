import { describe, expect, it } from 'vitest';

import * as root from '../index';
import * as state from '../state/index';
import * as propagation from './index';

/**
 * The one structural risk in this module's layout: `PROMOTION_STATUS` is re-exported by BOTH
 * `@tas/domain/state` (where criterion 7 puts it, beside the other status machines) and
 * `@tas/domain/propagation` (one import for the page), and the root barrel exports both. That is
 * only safe because the two paths resolve to the SAME declaration — a second copy would make the
 * name ambiguous in the root barrel and silently drop it. These tests pin identity, not equality.
 */
describe('the propagation barrel', () => {
  it('serves the status tuple, and it is the same object @tas/domain/state serves', () => {
    expect(propagation.PROMOTION_STATUS).toBe(state.PROMOTION_STATUS);
    expect(propagation.promotionStatusLabel).toBe(state.promotionStatusLabel);
    expect(propagation.promotionStatusTone).toBe(state.promotionStatusTone);
  });

  it('reaches the root barrel without the two re-exports colliding', () => {
    expect(root.PROMOTION_STATUS).toBe(state.PROMOTION_STATUS);
    expect(root.promotionStatusLabel('pending')).toBe('Pending');
    expect(root.promotionStatusTone('rejected')).toBe('bad');
  });

  it('serves the diff, the sentence and the guard the page needs', () => {
    expect(typeof propagation.diffSummary).toBe('function');
    expect(typeof propagation.describePromotion).toBe('function');
    expect(typeof propagation.canReviewPromotion).toBe('function');
    expect(propagation.DIFF_VALUE_LIMIT).toBeGreaterThan(0);
    expect(root.diffSummary).toBe(propagation.diffSummary);
    expect(root.describePromotion).toBe(propagation.describePromotion);
    expect(root.canReviewPromotion).toBe(propagation.canReviewPromotion);
  });

  it('composes: every fixture-shaped row gets a status, a diff and a sentence', () => {
    const row = {
      brandName: 'Gratsi',
      tableName: 'themes',
      fieldName: 'reference_links',
      currentValue: 'https://drive.tasdigital.example/themes/problem-solution-2024',
      proposedValue: null,
      status: 'pending',
    };
    expect(propagation.promotionStatusLabel(row.status)).toBe('Pending');
    expect(propagation.promotionStatusTone(row.status)).toBe('info');
    const diff = propagation.diffSummary(row.currentValue, row.proposedValue);
    expect(diff.proposedEmpty).toBe(true);
    expect(propagation.describePromotion(row)).toBe(
      'Gratsi requests promoting Reference links on Themes to the template.',
    );
  });
});
