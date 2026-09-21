import { describe, expect, it } from 'vitest';

import { COPY_STATUS_KEYS } from '../state/copy-status';
import { COPY_LIMITS } from './limits';
import { COPY_CTA_KEYS } from './vocabulary';
import { COPY_HEADLINE_MIN_LENGTH, validateCopyDraft, type CopyDraft } from './validate-copy-draft';

const chars = (length: number): string => 'a'.repeat(length);

/** The first demo row, which is exactly what a saveable draft looks like. */
const valid: CopyDraft = {
  primaryCopy:
    'Six years of night shifts and he still could not sleep at noon. It is the rota, not you. Weight, not heat. Ninety nights.',
  headline: 'Your Rota Is Broken. You Are Not.',
  linkDescription: '90 nights. Sleep or return.',
  cta: 'Shop Now',
  status: 'approved',
  creativeBriefId: '33333333-3333-4333-8333-000000000001',
  conceptId: null,
};

const draft = (patch: Partial<CopyDraft>): CopyDraft => ({ ...valid, ...patch });

describe('validateCopyDraft · a complete draft', () => {
  it('accepts the demo row with nothing to say about it', () => {
    expect(validateCopyDraft(valid)).toEqual({
      ok: true,
      fieldErrors: {},
      fieldWarnings: {},
      overLimits: {},
    });
  });

  it.each(COPY_STATUS_KEYS)('accepts the draft in %s', (status) => {
    expect(validateCopyDraft(draft({ status })).ok).toBe(true);
  });

  it.each(COPY_CTA_KEYS)('accepts the draft with the %s call to action', (cta) => {
    expect(validateCopyDraft(draft({ cta })).ok).toBe(true);
  });
});

describe('validateCopyDraft · headline is the one required field', () => {
  it('refuses a draft with no headline', () => {
    const result = validateCopyDraft(draft({ headline: '' }));
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.headline).toBe('A copy row needs a headline.');
  });

  it('refuses a headline that is only whitespace', () => {
    expect(validateCopyDraft(draft({ headline: '   ' })).fieldErrors.headline).toBe(
      'A copy row needs a headline.',
    );
  });

  it('refuses a null headline, the column being nullable', () => {
    expect(validateCopyDraft(draft({ headline: null })).ok).toBe(false);
  });

  it('refuses a one-character headline as a slip', () => {
    const result = validateCopyDraft(draft({ headline: 'a' }));
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.headline).toBe(
      `A headline needs at least ${String(COPY_HEADLINE_MIN_LENGTH)} characters.`,
    );
  });

  it('accepts a headline exactly at the minimum', () => {
    expect(validateCopyDraft(draft({ headline: 'Go' })).ok).toBe(true);
  });
});

describe('validateCopyDraft · the closed vocabularies', () => {
  it('refuses an empty status', () => {
    const result = validateCopyDraft(draft({ status: '' }));
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.status).toBe('Pick the status this copy is in.');
  });

  it('refuses a status outside COPY_STATUS, naming the vocabulary', () => {
    const result = validateCopyDraft(draft({ status: 'pending_for_approval' }));
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.status).toBe(
      `A copy status is one of ${COPY_STATUS_KEYS.join(', ')}.`,
    );
  });

  it('refuses a status label passed where a key belongs', () => {
    expect(validateCopyDraft(draft({ status: 'Approved' })).ok).toBe(false);
  });

  it('refuses an empty CTA', () => {
    const result = validateCopyDraft(draft({ cta: '' }));
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.cta).toBe('Pick the call to action this copy runs with.');
  });

  it('refuses a CTA outside COPY_CTAS, naming the vocabulary', () => {
    const result = validateCopyDraft(draft({ cta: 'Buy Now' }));
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.cta).toBe(`A CTA is one of ${COPY_CTA_KEYS.join(', ')}.`);
  });

  it('reports every broken field at once, not the first one', () => {
    const result = validateCopyDraft(draft({ headline: '', status: 'nope', cta: 'nope' }));
    expect(Object.keys(result.fieldErrors).sort()).toEqual(['cta', 'headline', 'status']);
  });
});

describe('validateCopyDraft · the fields with no rule', () => {
  it('accepts a draft with no creative, because the link is nullable', () => {
    expect(validateCopyDraft(draft({ creativeBriefId: null })).ok).toBe(true);
  });

  it('accepts empty primary copy and an empty link description', () => {
    expect(validateCopyDraft(draft({ primaryCopy: '', linkDescription: '' })).ok).toBe(true);
    expect(validateCopyDraft(draft({ primaryCopy: null, linkDescription: null })).ok).toBe(true);
  });
});

describe('validateCopyDraft · the limits warn, they do not block', () => {
  it('keeps a save open for primary copy past 125 characters, and says how far past', () => {
    const result = validateCopyDraft(draft({ primaryCopy: chars(COPY_LIMITS.primaryCopy + 6) }));
    expect(result.ok).toBe(true);
    expect(result.fieldErrors).toEqual({});
    expect(result.overLimits).toEqual({ primaryCopy: 6 });
    expect(result.fieldWarnings.primaryCopy).toBe(
      'Primary Copy is 6 characters over the ~125 guide. It will be cut short in the feed.',
    );
  });

  it('writes the one-character overage in the singular', () => {
    const result = validateCopyDraft(draft({ headline: chars(COPY_LIMITS.headline + 1) }));
    expect(result.overLimits).toEqual({ headline: 1 });
    expect(result.fieldWarnings.headline).toBe(
      'Headline is 1 character over the ~40 guide. It will be cut short in the feed.',
    );
  });

  it('names the link description the way the panel labels it', () => {
    const result = validateCopyDraft(
      draft({ linkDescription: chars(COPY_LIMITS.linkDescription + 3) }),
    );
    expect(result.fieldWarnings.linkDescription).toBe(
      'News Feed / Link Description is 3 characters over the ~27 guide. It will be cut short in the feed.',
    );
  });

  it('says nothing about a field sitting exactly on its limit', () => {
    const result = validateCopyDraft(
      draft({
        primaryCopy: chars(COPY_LIMITS.primaryCopy),
        headline: chars(COPY_LIMITS.headline),
        linkDescription: chars(COPY_LIMITS.linkDescription),
      }),
    );
    expect(result).toEqual({ ok: true, fieldErrors: {}, fieldWarnings: {}, overLimits: {} });
  });

  it('warns about all three fields at once', () => {
    const result = validateCopyDraft(
      draft({
        primaryCopy: chars(COPY_LIMITS.primaryCopy + 1),
        headline: chars(COPY_LIMITS.headline + 2),
        linkDescription: chars(COPY_LIMITS.linkDescription + 3),
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.overLimits).toEqual({ primaryCopy: 1, headline: 2, linkDescription: 3 });
  });

  it('warns and blocks together when a draft is both over-long and missing a status', () => {
    const result = validateCopyDraft(
      draft({ status: '', primaryCopy: chars(COPY_LIMITS.primaryCopy + 4) }),
    );
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.status).toBeDefined();
    expect(result.overLimits).toEqual({ primaryCopy: 4 });
  });
});
