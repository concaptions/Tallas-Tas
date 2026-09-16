import { describe, expect, it } from 'vitest';

import {
  CONCEPT_NAME_PARTS,
  CONCEPT_NAME_PLACEHOLDER,
  CONCEPT_NAME_SEPARATOR,
  conceptName,
  isConceptNameComplete,
  missingConceptNameParts,
} from './concept-name';

describe('conceptName · the PRD formula', () => {
  it("builds PRD §7's own example verbatim", () => {
    expect(
      conceptName({
        batch: 'B2',
        angleName: 'I Want To Play With My Kid',
        themeName: 'Problem/Solution',
      }),
    ).toBe('B2-I Want To Play With My Kid-Problem/Solution');
  });

  it("builds PRD §5.7's second example verbatim", () => {
    expect(
      conceptName({
        batch: 'B1',
        angleName: 'Less Pressure Means Less Pain',
        themeName: 'Educational Content',
      }),
    ).toBe('B1-Less Pressure Means Less Pain-Educational Content');
  });

  it('reproduces every demo fixture name (the same four rows `@tas/db` seeds)', () => {
    const fixtures = [
      { batch: 'B2', angleName: 'It Is Not Just Your Age', themeName: 'Green Screen' },
      { batch: 'B1', angleName: 'Your Body Clock Is Not Broken', themeName: 'Problem/Solution' },
      { batch: 'B2', angleName: 'Make 9am Look Like 3am', themeName: 'POV: X vs Y' },
      {
        batch: 'B3',
        angleName: 'Sleep In The Ninety Minutes You Actually Get',
        themeName: 'Yapper Style',
      },
    ];

    expect(fixtures.map(conceptName)).toEqual([
      'B2-It Is Not Just Your Age-Green Screen',
      'B1-Your Body Clock Is Not Broken-Problem/Solution',
      'B2-Make 9am Look Like 3am-POV: X vs Y',
      'B3-Sleep In The Ninety Minutes You Actually Get-Yapper Style',
    ]);
  });

  it('keeps the punctuation of the parts — a name is not a slug', () => {
    expect(
      conceptName({ batch: 'B7', angleName: '3am, Every Night', themeName: 'POV: X vs Y' }),
    ).toBe('B7-3am, Every Night-POV: X vs Y');
  });

  it('keeps a hyphen that is inside a part, without escaping it', () => {
    expect(
      conceptName({ batch: 'B4', angleName: 'Peri-Menopausal', themeName: 'Before-After' }),
    ).toBe('B4-Peri-Menopausal-Before-After');
  });

  it('trims each part so a pasted trailing space cannot fork the name', () => {
    expect(
      conceptName({
        batch: ' B2 ',
        angleName: '  Make 9am Look Like 3am',
        themeName: 'POV: X vs Y ',
      }),
    ).toBe('B2-Make 9am Look Like 3am-POV: X vs Y');
  });

  it('joins with the exported separator', () => {
    expect(CONCEPT_NAME_SEPARATOR).toBe('-');
    expect(
      conceptName({ batch: 'B1', angleName: 'A', themeName: 'B' }).split(CONCEPT_NAME_SEPARATOR),
    ).toEqual(['B1', 'A', 'B']);
  });
});

describe('conceptName · partial previews', () => {
  it('previews an untouched draft as the formula itself', () => {
    expect(conceptName({})).toBe('Batch-Angle-Theme');
  });

  it('treats null and undefined and blank text as the same missing part', () => {
    expect(conceptName({ batch: null, angleName: undefined, themeName: '   ' })).toBe(
      'Batch-Angle-Theme',
    );
  });

  it('keeps the batch and still asks for the two links', () => {
    expect(conceptName({ batch: 'B2' })).toBe('B2-Angle-Theme');
  });

  it('keeps the angle while the batch and the theme are still blank', () => {
    expect(conceptName({ angleName: 'Make 9am Look Like 3am' })).toBe(
      'Batch-Make 9am Look Like 3am-Theme',
    );
  });

  it('keeps the theme while the batch and the angle are still blank', () => {
    expect(conceptName({ themeName: 'Green Screen' })).toBe('Batch-Angle-Green Screen');
  });

  it('asks only for the theme once batch and angle are chosen', () => {
    expect(conceptName({ batch: 'B3', angleName: 'It Is Not Just Your Age' })).toBe(
      'B3-It Is Not Just Your Age-Theme',
    );
  });

  it('asks only for the angle once batch and theme are chosen', () => {
    expect(conceptName({ batch: 'B3', themeName: 'Green Screen' })).toBe('B3-Angle-Green Screen');
  });

  it('asks only for the batch once angle and theme are chosen', () => {
    expect(conceptName({ angleName: 'It Is Not Just Your Age', themeName: 'Green Screen' })).toBe(
      'Batch-It Is Not Just Your Age-Green Screen',
    );
  });

  it('never collapses a hyphen: a preview always has three segments', () => {
    for (const input of [
      {},
      { batch: 'B1' },
      { angleName: 'A' },
      { themeName: 'T' },
      { batch: 'B1', angleName: 'A' },
      { batch: 'B1', themeName: 'T' },
      { angleName: 'A', themeName: 'T' },
      { batch: 'B1', angleName: 'A', themeName: 'T' },
    ]) {
      expect(conceptName(input).split(CONCEPT_NAME_SEPARATOR)).toHaveLength(3);
    }
  });

  it('places each placeholder in its own position', () => {
    expect(conceptName({}).split(CONCEPT_NAME_SEPARATOR)).toEqual(
      CONCEPT_NAME_PARTS.map((part) => CONCEPT_NAME_PLACEHOLDER[part]),
    );
  });
});

describe('missingConceptNameParts / isConceptNameComplete', () => {
  it('lists all three for an untouched draft, in name order', () => {
    expect(missingConceptNameParts({})).toEqual(['batch', 'angleName', 'themeName']);
    expect(isConceptNameComplete({})).toBe(false);
  });

  it('drops a part as soon as it is chosen', () => {
    expect(missingConceptNameParts({ batch: 'B2' })).toEqual(['angleName', 'themeName']);
    expect(missingConceptNameParts({ batch: 'B2', themeName: 'Green Screen' })).toEqual([
      'angleName',
    ]);
  });

  it('counts a whitespace-only part as missing', () => {
    expect(
      missingConceptNameParts({ batch: 'B2', angleName: ' ', themeName: 'Green Screen' }),
    ).toEqual(['angleName']);
  });

  it('is empty, and complete, once all three are chosen', () => {
    const full = { batch: 'B2', angleName: 'It Is Not Just Your Age', themeName: 'Green Screen' };
    expect(missingConceptNameParts(full)).toEqual([]);
    expect(isConceptNameComplete(full)).toBe(true);
  });

  it('does not mistake a part whose text equals a placeholder for a missing part', () => {
    const named = { batch: 'B2', angleName: 'Angle', themeName: 'Theme' };
    expect(missingConceptNameParts(named)).toEqual([]);
    expect(conceptName(named)).toBe('B2-Angle-Theme');
  });
});
