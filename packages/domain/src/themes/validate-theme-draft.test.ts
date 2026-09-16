import { describe, expect, it } from 'vitest';

import type { ThemeDraft } from './validate-theme-draft';
import { validateThemeDraft } from './validate-theme-draft';

function draft(overrides: Partial<ThemeDraft> = {}): ThemeDraft {
  return {
    name: 'Problem/Solution',
    category: 'Framework',
    referenceLinks: ['https://www.tiktok.com/@brand/video/7312'],
    ...overrides,
  };
}

describe('validateThemeDraft', () => {
  it('accepts a complete draft', () => {
    expect(validateThemeDraft(draft())).toEqual({ ok: true, fieldErrors: {} });
  });

  it('accepts a draft with no reference links at all', () => {
    expect(validateThemeDraft(draft({ referenceLinks: [] })).ok).toBe(true);
    expect(validateThemeDraft({ name: 'Green Screen', category: 'Production Style' }).ok).toBe(
      true,
    );
  });

  it('requires a name', () => {
    const result = validateThemeDraft(draft({ name: '   ' }));
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.name).toBe('A theme needs a name.');
  });

  it('requires two characters, counted after trimming', () => {
    const result = validateThemeDraft(draft({ name: ' A ' }));
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.name).toBe('A theme name needs at least 2 characters.');
  });

  it('accepts a two-character name', () => {
    expect(validateThemeDraft(draft({ name: 'UGC' })).ok).toBe(true);
    expect(validateThemeDraft(draft({ name: 'Rx' })).fieldErrors.name).toBeUndefined();
  });

  it('requires a category', () => {
    const result = validateThemeDraft(draft({ category: null }));
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.category).toBe('Pick the kind of theme this is.');
  });

  it('treats an empty category the same as nothing chosen', () => {
    expect(validateThemeDraft(draft({ category: '  ' })).fieldErrors.category).toBe(
      'Pick the kind of theme this is.',
    );
  });

  it('refuses a category outside the closed vocabulary', () => {
    const result = validateThemeDraft(draft({ category: 'production_style' }));
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.category).toBe(
      'A theme is one of Framework, Production Style, Seasonal.',
    );
  });

  it('accepts each of the three categories', () => {
    for (const category of ['Framework', 'Production Style', 'Seasonal']) {
      expect(validateThemeDraft(draft({ category })).ok).toBe(true);
    }
  });

  it('refuses a reference link that is not an http(s) URL, naming its position', () => {
    const result = validateThemeDraft(
      draft({ referenceLinks: ['https://example.com/a', 'not a url'] }),
    );
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.referenceLinks).toBe(
      'Reference link 2 is not a valid link. Paste the full http(s) URL.',
    );
  });

  it('refuses a non-http protocol', () => {
    expect(
      validateThemeDraft(draft({ referenceLinks: ['javascript:alert(1)'] })).fieldErrors
        .referenceLinks,
    ).toBe('Reference link 1 is not a valid link. Paste the full http(s) URL.');
  });

  it('ignores blank rows, because the list keeps an empty input at the bottom', () => {
    expect(validateThemeDraft(draft({ referenceLinks: ['', '  ', 'http://example.com'] })).ok).toBe(
      true,
    );
  });

  it('reports every broken field at once', () => {
    const result = validateThemeDraft({
      name: '',
      category: null,
      referenceLinks: ['nope'],
    });
    expect(result.ok).toBe(false);
    expect(Object.keys(result.fieldErrors).sort()).toEqual(['category', 'name', 'referenceLinks']);
  });

  it('carries no rule for notes: they are not part of the draft at all', () => {
    // A theme with no notes is a perfectly good theme, so the dialog's Notes field can never
    // block a save.
    expect(validateThemeDraft({ name: 'Holiday Gifting', category: 'Seasonal' })).toEqual({
      ok: true,
      fieldErrors: {},
    });
  });
});
