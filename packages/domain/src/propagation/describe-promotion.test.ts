import { describe, expect, it } from 'vitest';

import {
  PROMOTION_UNKNOWN_BRAND,
  describePromotion,
  humanizeIdentifier,
  promotionBrandLabel,
  promotionFieldLabel,
  promotionTableLabel,
  type PromotionSubject,
} from './describe-promotion';

const funkyPainting: PromotionSubject = {
  brandName: 'Funky Painting',
  tableName: 'angles',
  fieldName: 'formats',
};

describe('describePromotion', () => {
  it('is one plain sentence naming the brand, the field and the table', () => {
    expect(describePromotion(funkyPainting)).toBe(
      'Funky Painting requests promoting Formats on Angles to the template.',
    );
  });

  it('names all three parts of every fixture row', () => {
    const rows: readonly PromotionSubject[] = [
      funkyPainting,
      { brandName: 'Gratsi', tableName: 'themes', fieldName: 'reference_links' },
      { brandName: 'Mattress Central', tableName: 'personas', fieldName: 'pain_points' },
      {
        brandName: 'Niagara Sleep Solutions',
        tableName: 'creative_briefs',
        fieldName: 'elements_tested',
      },
    ];
    for (const row of rows) {
      const sentence = describePromotion(row);
      expect(sentence).toContain(promotionBrandLabel(row.brandName));
      expect(sentence).toContain(promotionFieldLabel(row.fieldName));
      expect(sentence).toContain(promotionTableLabel(row.tableName));
      expect(sentence.endsWith('.')).toBe(true);
    }
  });

  it('reads the underscored names as English', () => {
    expect(
      describePromotion({
        brandName: 'Niagara Sleep Solutions',
        tableName: 'creative_briefs',
        fieldName: 'elements_tested',
      }),
    ).toBe(
      'Niagara Sleep Solutions requests promoting Elements tested on Creative briefs to the template.',
    );
  });

  it('falls back to a placeholder when the brand was soft-deleted, and never gaps the sentence', () => {
    const sentence = describePromotion({ ...funkyPainting, brandName: null });
    expect(sentence).toBe(
      `${PROMOTION_UNKNOWN_BRAND} requests promoting Formats on Angles to the template.`,
    );
    expect(sentence).not.toContain('  ');
  });

  it('never throws on a missing, null or blank brand name', () => {
    expect(() => describePromotion({ ...funkyPainting, brandName: undefined })).not.toThrow();
    expect(describePromotion({ tableName: 'angles', fieldName: 'formats' })).toContain(
      PROMOTION_UNKNOWN_BRAND,
    );
    expect(describePromotion({ ...funkyPainting, brandName: '   ' })).toContain(
      PROMOTION_UNKNOWN_BRAND,
    );
  });

  it('contains no markup, so it is safe as an aria-label', () => {
    const sentence = describePromotion({ ...funkyPainting, brandName: '<b>Funky</b>' });
    expect(sentence).toBe('<b>Funky</b> requests promoting Formats on Angles to the template.');
    expect(sentence).not.toContain('&lt;');
  });

  it('says "to the template", which is what makes it a promotion and not an edit', () => {
    expect(describePromotion(funkyPainting)).toContain('to the template');
  });

  it('is pure: the same request answers the same twice', () => {
    expect(describePromotion(funkyPainting)).toBe(describePromotion(funkyPainting));
  });
});

describe('humanizeIdentifier', () => {
  it('turns snake_case into sentence case', () => {
    expect(humanizeIdentifier('pain_points')).toBe('Pain points');
    expect(humanizeIdentifier('creative_briefs')).toBe('Creative briefs');
    expect(humanizeIdentifier('cta')).toBe('Cta');
  });

  it('handles kebab-case, repeated separators and surrounding space', () => {
    expect(humanizeIdentifier('reference-links')).toBe('Reference links');
    expect(humanizeIdentifier('elements__tested')).toBe('Elements tested');
    expect(humanizeIdentifier('  formats  ')).toBe('Formats');
  });

  it('is total: an empty or separator-only name comes back unchanged rather than blank', () => {
    expect(humanizeIdentifier('')).toBe('');
    expect(humanizeIdentifier('___')).toBe('___');
  });

  it('leaves an already-capitalised name alone', () => {
    expect(humanizeIdentifier('Formats')).toBe('Formats');
  });
});

describe('the cell labels', () => {
  it('label the table and the field through the same humaniser', () => {
    expect(promotionTableLabel('creative_briefs')).toBe('Creative briefs');
    expect(promotionFieldLabel('reference_links')).toBe('Reference links');
  });

  it('label a present brand by its own name', () => {
    expect(promotionBrandLabel('Gratsi')).toBe('Gratsi');
  });

  it('label a missing brand with the shared placeholder, so the page runs no second query', () => {
    expect(promotionBrandLabel(null)).toBe(PROMOTION_UNKNOWN_BRAND);
    expect(promotionBrandLabel(undefined)).toBe(PROMOTION_UNKNOWN_BRAND);
    expect(promotionBrandLabel('')).toBe(PROMOTION_UNKNOWN_BRAND);
  });
});
