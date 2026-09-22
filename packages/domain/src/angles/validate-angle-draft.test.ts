import { describe, expect, it } from 'vitest';

import type { AngleDraft } from './validate-angle-draft';
import { validateAngleDraft } from './validate-angle-draft';

const PERSONA_ID = '00000000-0000-4000-8000-555500000001';

function draft(overrides: Partial<AngleDraft> = {}): AngleDraft {
  return {
    name: 'Sleep debt is a tax you pay in the morning',
    personaIds: [PERSONA_ID],
    formats: ['Static', 'Video'],
    adInspoLinks: ['https://www.facebook.com/ads/library/?id=1234567890'],
    ...overrides,
  };
}

describe('validateAngleDraft', () => {
  it('accepts a complete draft', () => {
    expect(validateAngleDraft(draft())).toEqual({ ok: true, fieldErrors: {} });
  });

  it('accepts a draft with no ad inspiration at all', () => {
    expect(validateAngleDraft(draft({ adInspoLinks: [] })).ok).toBe(true);
  });

  it('requires a name', () => {
    const result = validateAngleDraft(draft({ name: '   ' }));
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.name).toBe('An angle needs a name.');
  });

  it('requires two characters, counted after trimming', () => {
    const result = validateAngleDraft(draft({ name: ' A ' }));
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.name).toBe('An angle name needs at least 2 characters.');
  });

  it('accepts a two-character name', () => {
    expect(validateAngleDraft(draft({ name: 'A/B' })).ok).toBe(true);
    expect(validateAngleDraft(draft({ name: 'Rx' })).fieldErrors.name).toBeUndefined();
  });

  it('requires at least one persona', () => {
    const result = validateAngleDraft(draft({ personaIds: [] }));
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.personaIds).toBe(
      'Pick at least one persona this angle is written from.',
    );
  });

  it('requires at least one format', () => {
    const result = validateAngleDraft(draft({ formats: [] }));
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.formats).toBe('Pick at least one format to create.');
  });

  it('refuses an ad inspiration entry that is not an http(s) URL, naming its position', () => {
    const result = validateAngleDraft(
      draft({ adInspoLinks: ['https://youtu.be/abc', 'tiktok.com/@brand'] }),
    );
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.adInspoLinks).toBe(
      'Ad inspiration 2 is not a valid link. Paste the full http(s) URL.',
    );
  });

  it('refuses a non-http scheme', () => {
    expect(
      validateAngleDraft(draft({ adInspoLinks: ['mailto:hello@tasdigital.com'] })).fieldErrors
        .adInspoLinks,
    ).toBeDefined();
  });

  it('ignores a blank row, because the panel keeps an empty input at the bottom', () => {
    expect(
      validateAngleDraft(draft({ adInspoLinks: ['https://youtu.be/abc', '', '   '] })).ok,
    ).toBe(true);
  });

  it('reports every broken field at once', () => {
    const result = validateAngleDraft({
      name: '',
      personaIds: [],
      formats: [],
      adInspoLinks: ['nope'],
    });
    expect(result.ok).toBe(false);
    expect(Object.keys(result.fieldErrors).sort()).toEqual([
      'adInspoLinks',
      'formats',
      'name',
      'personaIds',
    ]);
  });
});
