import { describe, expect, it } from 'vitest';

import {
  CONCEPT_REQUIRED_FIELDS,
  isConceptFieldRequired,
  missingRequiredConceptFields,
  validateConceptDraft,
  type ConceptDraft,
} from './validate-concept-draft';

const valid: ConceptDraft = {
  batch: 'B2',
  angleIds: ['44444444-4444-4444-8444-000000000001'],
  themeIds: ['55555555-5555-4555-8555-000000000001'],
  category: 'New',
};

describe('validateConceptDraft · a saveable draft', () => {
  it('accepts a complete pairing', () => {
    expect(validateConceptDraft(valid)).toEqual({ ok: true, fieldErrors: {} });
  });

  it('accepts it with valid ad inspiration links and blank rows among them', () => {
    expect(
      validateConceptDraft({
        ...valid,
        adInspoLinks: [
          'https://www.facebook.com/ads/library/?id=1',
          '',
          '   ',
          'http://foreplay.test/b',
        ],
      }).ok,
    ).toBe(true);
  });

  it('accepts a draft that has not chosen a concept style — style carries no rule', () => {
    expect(validateConceptDraft({ ...valid, category: 'Iteration' }).ok).toBe(true);
  });
});

describe('validateConceptDraft · batch', () => {
  it('requires a batch', () => {
    expect(validateConceptDraft({ ...valid, batch: null }).fieldErrors.batch).toBe(
      'Pick the batch this concept belongs to.',
    );
  });

  it('treats whitespace as no batch at all', () => {
    expect(validateConceptDraft({ ...valid, batch: '   ' }).fieldErrors.batch).toBe(
      'Pick the batch this concept belongs to.',
    );
  });

  it('refuses a batch outside B1…B20', () => {
    expect(validateConceptDraft({ ...valid, batch: 'B21' }).fieldErrors.batch).toBe(
      'A batch is one of B1 to B20.',
    );
    expect(validateConceptDraft({ ...valid, batch: 'b2' }).fieldErrors.batch).toBe(
      'A batch is one of B1 to B20.',
    );
  });

  it('accepts a padded batch, because the name formula trims it too', () => {
    expect(validateConceptDraft({ ...valid, batch: ' B20 ' }).ok).toBe(true);
  });
});

describe('validateConceptDraft · the pairing', () => {
  it('requires at least one angle', () => {
    expect(validateConceptDraft({ ...valid, angleIds: [] }).fieldErrors.angleIds).toBe(
      'Pick at least one angle this concept is built on.',
    );
  });

  it('requires at least one theme', () => {
    expect(validateConceptDraft({ ...valid, themeIds: [] }).fieldErrors.themeIds).toBe(
      'Pick at least one theme this angle is paired with.',
    );
  });
});

describe('validateConceptDraft · category', () => {
  it('requires a category', () => {
    expect(validateConceptDraft({ ...valid, category: null }).fieldErrors.category).toBe(
      'Pick whether this is new ground or an iteration.',
    );
  });

  it('treats whitespace as no category', () => {
    expect(validateConceptDraft({ ...valid, category: '  ' }).fieldErrors.category).toBe(
      'Pick whether this is new ground or an iteration.',
    );
  });

  it('refuses a category outside the vocabulary', () => {
    expect(validateConceptDraft({ ...valid, category: 'Remix' }).fieldErrors.category).toBe(
      'A concept is one of New, Iteration.',
    );
  });
});

describe('validateConceptDraft · ad inspiration links', () => {
  it('names the first broken link by its position, counting blank rows', () => {
    expect(
      validateConceptDraft({ ...valid, adInspoLinks: ['', 'not a link'] }).fieldErrors.adInspoLinks,
    ).toBe('Ad inspiration 2 is not a valid link. Paste the full http(s) URL.');
  });

  it('refuses a non-http scheme', () => {
    expect(
      validateConceptDraft({ ...valid, adInspoLinks: ['javascript:alert(1)'] }).fieldErrors
        .adInspoLinks,
    ).toBe('Ad inspiration 1 is not a valid link. Paste the full http(s) URL.');
  });

  it('carries no rule when the field was never opened', () => {
    expect(validateConceptDraft(valid).fieldErrors.adInspoLinks).toBeUndefined();
  });
});

describe('the required-field list · the only one in the repository (action item 37)', () => {
  it('names exactly the four fields the validator refuses to save without', () => {
    expect([...CONCEPT_REQUIRED_FIELDS]).toEqual(['batch', 'angleIds', 'themeIds', 'category']);

    const emptyDraft: ConceptDraft = { batch: null, angleIds: [], themeIds: [], category: null };
    // Every field the list marks really does block the save, and nothing else does: the marker the
    // form draws from this list can never promise a rule the validator does not enforce.
    expect(Object.keys(validateConceptDraft(emptyDraft).fieldErrors).sort()).toEqual(
      [...CONCEPT_REQUIRED_FIELDS].sort(),
    );
  });

  it('answers whether one field is required, and says no to the optional ones', () => {
    for (const field of CONCEPT_REQUIRED_FIELDS) {
      expect(isConceptFieldRequired(field)).toBe(true);
    }
    expect(isConceptFieldRequired('conceptStyle')).toBe(false);
    expect(isConceptFieldRequired('adInspoLinks')).toBe(false);
    expect(isConceptFieldRequired('hookExamples')).toBe(false);
  });

  it('lists the empty required fields in the list’s own order, whitespace counting as empty', () => {
    expect(
      missingRequiredConceptFields({ batch: null, angleIds: [], themeIds: [], category: null }),
    ).toEqual(['batch', 'angleIds', 'themeIds', 'category']);
    expect(missingRequiredConceptFields({ ...valid, batch: '  ', category: ' ' })).toEqual([
      'batch',
      'category',
    ]);
    expect(missingRequiredConceptFields(valid)).toEqual([]);
  });

  it('separates a missing value from a wrong one: a bad batch is filled in, not empty', () => {
    // `B21` is outside B1…B20, so the save is still blocked — but the field is not EMPTY, so the
    // form marks it required without also claiming the viewer left it blank.
    expect(missingRequiredConceptFields({ ...valid, batch: 'B21' })).toEqual([]);
    expect(validateConceptDraft({ ...valid, batch: 'B21' }).fieldErrors.batch).toBe(
      'A batch is one of B1 to B20.',
    );
    expect(missingRequiredConceptFields({ ...valid, category: 'Remix' })).toEqual([]);
    expect(validateConceptDraft({ ...valid, category: 'Remix' }).fieldErrors.category).toBe(
      'A concept is one of New, Iteration.',
    );
  });
});

describe('validateConceptDraft · an empty draft', () => {
  it('reports all four required fields at once and nothing else', () => {
    const result = validateConceptDraft({
      batch: null,
      angleIds: [],
      themeIds: [],
      category: null,
    });
    expect(result.ok).toBe(false);
    expect(Object.keys(result.fieldErrors).sort()).toEqual([
      'angleIds',
      'batch',
      'category',
      'themeIds',
    ]);
  });
});
