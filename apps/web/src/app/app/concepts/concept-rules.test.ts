import { describe, expect, it } from 'vitest';

import { conceptName, validateConceptDraft } from '@tas/domain/concepts';

/**
 * The Concept form's rules (Sprint 9, LINK-03), pinned at the domain function the form and the
 * Server Action both call: Batch, Angle and Theme are required and block the save, and the name is
 * Batch-Angle-Theme, re-derived whenever any of the three changes (CLAUDE.md non-negotiable 6).
 */
describe('concept form rules', () => {
  it('blocks the save while any of Batch, Angle or Theme is missing, naming each one', () => {
    const missing = validateConceptDraft({
      batch: null,
      angleIds: [],
      themeIds: [],
      category: 'New',
    });
    expect(missing.ok).toBe(false);
    expect(Object.keys(missing.fieldErrors)).toEqual(
      expect.arrayContaining(['batch', 'angleIds', 'themeIds']),
    );

    const noTheme = validateConceptDraft({
      batch: 'B1',
      angleIds: ['angle-1'],
      themeIds: [],
      category: 'New',
    });
    expect(noTheme.ok).toBe(false);
    expect(noTheme.fieldErrors.themeIds).toBeDefined();
    expect(noTheme.fieldErrors.angleIds).toBeUndefined();
  });

  it('saves once all three are picked', () => {
    const complete = validateConceptDraft({
      batch: 'B1',
      angleIds: ['angle-1', 'angle-2'],
      themeIds: ['theme-1'],
      category: 'New',
    });
    expect(complete.ok).toBe(true);
    expect(complete.fieldErrors).toEqual({});
  });

  it('derives the name as Batch-Angle-Theme and re-derives it when any part changes', () => {
    const base = {
      batch: 'B1',
      angleName: 'Your Body Clock Is Not Broken',
      themeName: 'Problem/Solution',
    };
    expect(conceptName(base)).toBe('B1-Your Body Clock Is Not Broken-Problem/Solution');
    expect(conceptName({ ...base, batch: 'B2' })).toBe(
      'B2-Your Body Clock Is Not Broken-Problem/Solution',
    );
    expect(conceptName({ ...base, angleName: 'Daylight Proof' })).toBe(
      'B1-Daylight Proof-Problem/Solution',
    );
    expect(conceptName({ ...base, themeName: 'Green Screen' })).toBe(
      'B1-Your Body Clock Is Not Broken-Green Screen',
    );
    // A missing part reads as its placeholder, never as "null" or an empty segment.
    expect(conceptName({ ...base, themeName: null })).not.toMatch(/null|--$/);
  });
});
