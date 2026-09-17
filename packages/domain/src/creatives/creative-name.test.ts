import { describe, expect, it } from 'vitest';

import {
  CREATIVE_NAME_PARTS,
  CREATIVE_NAME_PLACEHOLDER,
  CREATIVE_NAME_SEPARATOR,
  CREATIVE_SEQUENCE_START,
  STANDALONE_CONCEPT_SLUG,
  conceptNameSegment,
  creativeName,
  creativeNameForConcept,
  isCreativeNameComplete,
  missingCreativeNameParts,
  nextSequence,
  type CreativeSequenceRow,
} from './creative-name';
import { CREATIVE_FUNNELS, CREATIVE_TYPES } from './vocabulary';

describe('creativeName · the PRD §7 formula', () => {
  it("builds PRD §7's own example verbatim", () => {
    expect(
      creativeName({
        funnel: 'All Funnels',
        format: 'Video',
        number: 1,
        batch: 'B1',
        conceptName: 'Less Pressure Means Less Pain-Educational Content',
        version: 1,
      }),
    ).toBe('AV1-B1-Less Pressure Means Less Pain-Educational Content-V1');
  });

  it("builds PRD §5.10's linked-video example verbatim", () => {
    expect(
      creativeName({
        funnel: 'TOF',
        format: 'Video',
        number: 1,
        batch: 'B1',
        conceptName: 'Your Body Clock Is Not Broken-Problem/Solution',
        version: 2,
      }),
    ).toBe('TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2');
  });

  it('appends the optional product suffix only when a product is given', () => {
    const spec = {
      funnel: 'Retargeting',
      format: 'Static',
      number: 1,
      batch: 'B4',
      conceptName: STANDALONE_CONCEPT_SLUG,
      version: 3,
    } as const;

    expect(creativeName(spec)).toBe('RS1-B4-Standalone-V3');
    expect(creativeName({ ...spec, product: 'NIGHT RESET BUNDLE' })).toBe(
      'RS1-B4-Standalone-V3-NIGHT RESET BUNDLE',
    );
  });

  it('treats a blank or null product as no suffix at all', () => {
    const spec = {
      funnel: 'TOF',
      format: 'Video',
      number: 1,
      batch: 'B1',
      conceptName: 'A-B',
      version: 1,
    } as const;

    expect(creativeName({ ...spec, product: null })).toBe('TV1-B1-A-B-V1');
    expect(creativeName({ ...spec, product: '   ' })).toBe('TV1-B1-A-B-V1');
  });

  it('reproduces every demo fixture name (the same six rows `@tas/db` seeds)', () => {
    const fixtures = [
      {
        funnel: 'TOF',
        format: 'Video',
        number: 1,
        batch: 'B1',
        conceptName: 'Your Body Clock Is Not Broken-Problem/Solution',
        version: 2,
      },
      {
        funnel: 'TOF',
        format: 'Static',
        number: 1,
        batch: 'B2',
        conceptName: 'It Is Not Just Your Age-Green Screen',
        version: 1,
      },
      {
        funnel: 'All Funnels',
        format: 'Motion Image',
        number: 1,
        batch: 'B2',
        conceptName: 'Make 9am Look Like 3am-POV: X vs Y',
        version: 1,
      },
      {
        funnel: 'TOF',
        format: 'Video',
        number: 2,
        batch: 'B3',
        conceptName: 'Sleep In The Ninety Minutes You Actually Get-Yapper Style',
        version: 1,
      },
      {
        funnel: 'Retargeting',
        format: 'Static',
        number: 1,
        batch: 'B4',
        conceptName: STANDALONE_CONCEPT_SLUG,
        version: 3,
        product: 'NIGHT RESET BUNDLE',
      },
      {
        funnel: 'TOF',
        format: 'Carousel',
        number: 1,
        batch: 'B3',
        conceptName: 'Sleep In The Ninety Minutes You Actually Get-Yapper Style',
        version: 1,
      },
    ];

    expect(fixtures.map(creativeName)).toEqual([
      'TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2',
      'TS1-B2-It Is Not Just Your Age-Green Screen-V1',
      'AM1-B2-Make 9am Look Like 3am-POV: X vs Y-V1',
      'TV2-B3-Sleep In The Ninety Minutes You Actually Get-Yapper Style-V1',
      'RS1-B4-Standalone-V3-NIGHT RESET BUNDLE',
      'TC1-B3-Sleep In The Ninety Minutes You Actually Get-Yapper Style-V1',
    ]);
  });

  it('takes the first letter from every funnel in the vocabulary', () => {
    const letters = CREATIVE_FUNNELS.map((funnel) =>
      creativeName({
        funnel: funnel.key,
        format: 'Video',
        number: 1,
        batch: 'B1',
        conceptName: 'A-B',
        version: 1,
      }).charAt(0),
    );

    expect(letters).toEqual(['T', 'R', 'A']);
    expect(letters).toEqual(CREATIVE_FUNNELS.map((funnel) => funnel.letter));
  });

  it('takes the second letter from every type in the vocabulary', () => {
    const letters = CREATIVE_TYPES.map((type) =>
      creativeName({
        funnel: 'TOF',
        format: type.key,
        number: 1,
        batch: 'B1',
        conceptName: 'A-B',
        version: 1,
      }).charAt(1),
    );

    expect(letters).toEqual(['V', 'S', 'C', 'M']);
    expect(letters).toEqual(CREATIVE_TYPES.map((type) => type.letter));
  });

  it('writes the number and the version straight through, at two digits too', () => {
    expect(
      creativeName({
        funnel: 'TOF',
        format: 'Video',
        number: 17,
        batch: 'B12',
        conceptName: 'A-B',
        version: 6,
      }),
    ).toBe('TV17-B12-A-B-V6');
  });

  it('keeps the punctuation of the concept segment — a name is not a slug', () => {
    expect(
      creativeName({
        funnel: 'TOF',
        format: 'Video',
        number: 1,
        batch: 'B2',
        conceptName: 'Make 9am Look Like 3am-POV: X vs Y',
        version: 1,
      }),
    ).toBe('TV1-B2-Make 9am Look Like 3am-POV: X vs Y-V1');
  });

  it('trims each part so a pasted trailing space cannot fork the name', () => {
    expect(
      creativeName({
        funnel: ' TOF ',
        format: 'Video ',
        number: 1,
        batch: ' B1 ',
        conceptName: '  Your Body Clock Is Not Broken-Problem/Solution  ',
        version: 2,
        product: ' NIGHT RESET BUNDLE ',
      }),
    ).toBe('TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2-NIGHT RESET BUNDLE');
  });

  it('joins with the exported separator', () => {
    expect(CREATIVE_NAME_SEPARATOR).toBe('-');
  });
});

describe('creativeName · the standalone branch (PRD §8)', () => {
  it('fills the concept segment with the slug rather than throwing', () => {
    expect(
      creativeName({
        funnel: 'Retargeting',
        format: 'Static',
        number: 1,
        batch: 'B4',
        version: 3,
        product: 'NIGHT RESET BUNDLE',
      }),
    ).toBe('RS1-B4-Standalone-V3-NIGHT RESET BUNDLE');
  });

  it('treats null, undefined and blank concept names as the same standalone case', () => {
    const spec = {
      funnel: 'Retargeting',
      format: 'Static',
      number: 1,
      batch: 'B4',
      version: 3,
    } as const;

    for (const conceptName of [null, undefined, '', '   ']) {
      expect(creativeName({ ...spec, conceptName })).toBe('RS1-B4-Standalone-V3');
    }
  });

  it('is still a COMPLETE name: a standalone brief is not an unfinished draft', () => {
    const standalone = {
      funnel: 'Retargeting',
      format: 'Static',
      number: 1,
      batch: 'B4',
      version: 3,
      conceptName: null,
    } as const;

    expect(missingCreativeNameParts(standalone)).toEqual([]);
    expect(isCreativeNameComplete(standalone)).toBe(true);
  });

  it('uses the slug the list page renders its chip from', () => {
    expect(STANDALONE_CONCEPT_SLUG).toBe('Standalone');
  });
});

describe('creativeName · partial previews', () => {
  it('previews an untouched draft without losing a segment', () => {
    expect(creativeName({})).toBe('???-Batch-Standalone-V?');
  });

  it('treats null and undefined and blank text as the same missing part', () => {
    expect(
      creativeName({ funnel: null, format: undefined, number: null, batch: '  ', version: null }),
    ).toBe('???-Batch-Standalone-V?');
  });

  it('replaces one position at a time as the strategist chooses', () => {
    expect(creativeName({ funnel: 'TOF' })).toBe('T??-Batch-Standalone-V?');
    expect(creativeName({ funnel: 'TOF', format: 'Static' })).toBe('TS?-Batch-Standalone-V?');
    expect(creativeName({ funnel: 'TOF', format: 'Static', number: 1 })).toBe(
      'TS1-Batch-Standalone-V?',
    );
    expect(creativeName({ funnel: 'TOF', format: 'Static', number: 1, batch: 'B4' })).toBe(
      'TS1-B4-Standalone-V?',
    );
    expect(
      creativeName({ funnel: 'TOF', format: 'Static', number: 1, batch: 'B4', version: 1 }),
    ).toBe('TS1-B4-Standalone-V1');
  });

  it('places each placeholder in its own position', () => {
    expect(creativeName({}).startsWith(CREATIVE_NAME_PLACEHOLDER.funnel)).toBe(true);
    expect(creativeName({})).toContain(CREATIVE_NAME_PLACEHOLDER.batch);
    expect(creativeName({}).endsWith(`V${CREATIVE_NAME_PLACEHOLDER.version}`)).toBe(true);
  });

  it('refuses a funnel or a type this build does not know — there is no letter for it', () => {
    expect(
      creativeName({
        funnel: 'Bottom Of Funnel',
        format: 'Gif',
        number: 1,
        batch: 'B1',
        version: 1,
      }),
    ).toBe('??1-B1-Standalone-V1');
    expect(missingCreativeNameParts({ funnel: 'Bottom Of Funnel', format: 'Gif' })).toContain(
      'funnel',
    );
  });

  it('refuses a number or a version that is not a positive integer', () => {
    for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(creativeName({ funnel: 'TOF', format: 'Video', number: bad, version: bad })).toBe(
        'TV?-Batch-Standalone-V?',
      );
    }
  });
});

describe('missingCreativeNameParts / isCreativeNameComplete', () => {
  it('lists every required part for an untouched draft, in name order', () => {
    expect(missingCreativeNameParts({})).toEqual([
      'funnel',
      'format',
      'number',
      'batch',
      'version',
    ]);
    expect(missingCreativeNameParts({})).toEqual([...CREATIVE_NAME_PARTS]);
    expect(isCreativeNameComplete({})).toBe(false);
  });

  it('drops a part as soon as it is chosen', () => {
    expect(missingCreativeNameParts({ funnel: 'TOF' })).toEqual([
      'format',
      'number',
      'batch',
      'version',
    ]);
    expect(missingCreativeNameParts({ funnel: 'TOF', batch: 'B1', version: 1 })).toEqual([
      'format',
      'number',
    ]);
  });

  it('is empty, and complete, once every required part is chosen', () => {
    const full = { funnel: 'TOF', format: 'Video', number: 1, batch: 'B1', version: 1 };
    expect(missingCreativeNameParts(full)).toEqual([]);
    expect(isCreativeNameComplete(full)).toBe(true);
  });

  it('never counts the optional product as missing', () => {
    expect(missingCreativeNameParts({ product: 'NIGHT RESET BUNDLE' })).not.toContain('product');
  });
});

describe('conceptNameSegment', () => {
  it("strips the batch prefix, which is PRD §7's second example", () => {
    expect(
      conceptNameSegment({
        name: 'B1-Less Pressure Means Less Pain-Educational Content',
        batch: 'B1',
      }),
    ).toBe('Less Pressure Means Less Pain-Educational Content');
  });

  it('strips the prefix of each of the four seeded concepts', () => {
    const concepts = [
      { name: 'B2-It Is Not Just Your Age-Green Screen', batch: 'B2' },
      { name: 'B1-Your Body Clock Is Not Broken-Problem/Solution', batch: 'B1' },
      { name: 'B2-Make 9am Look Like 3am-POV: X vs Y', batch: 'B2' },
      { name: 'B3-Sleep In The Ninety Minutes You Actually Get-Yapper Style', batch: 'B3' },
    ];

    expect(concepts.map(conceptNameSegment)).toEqual([
      'It Is Not Just Your Age-Green Screen',
      'Your Body Clock Is Not Broken-Problem/Solution',
      'Make 9am Look Like 3am-POV: X vs Y',
      'Sleep In The Ninety Minutes You Actually Get-Yapper Style',
    ]);
  });

  it('keeps a name that does not start with its batch, rather than truncating at a guess', () => {
    expect(conceptNameSegment({ name: 'Legacy Concept', batch: 'B7' })).toBe('Legacy Concept');
  });

  it('does not strip a batch that only looks like a prefix', () => {
    expect(conceptNameSegment({ name: 'B12-Angle-Theme', batch: 'B1' })).toBe('B12-Angle-Theme');
  });

  it('keeps the whole name when the concept carries no batch', () => {
    expect(conceptNameSegment({ name: 'B1-Angle-Theme', batch: null })).toBe('B1-Angle-Theme');
  });

  it('is null for a concept with no name', () => {
    expect(conceptNameSegment({ name: null, batch: 'B1' })).toBeNull();
    expect(conceptNameSegment({})).toBeNull();
  });
});

describe('creativeNameForConcept', () => {
  it('names a linked brief from the concept row, batch included', () => {
    expect(
      creativeNameForConcept(
        { name: 'B1-Your Body Clock Is Not Broken-Problem/Solution', batch: 'B1' },
        { funnel: 'TOF', format: 'Video', number: 1, version: 2 },
      ),
    ).toBe('TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2');
  });

  it('names a standalone brief from its own batch and product, with no concept', () => {
    expect(
      creativeNameForConcept(null, {
        funnel: 'Retargeting',
        format: 'Static',
        number: 1,
        batch: 'B4',
        version: 3,
        product: 'NIGHT RESET BUNDLE',
      }),
    ).toBe('RS1-B4-Standalone-V3-NIGHT RESET BUNDLE');
  });

  it("lets an explicit batch win over the concept's own", () => {
    expect(
      creativeNameForConcept(
        { name: 'B1-Angle-Theme', batch: 'B1' },
        { funnel: 'TOF', format: 'Video', number: 1, batch: 'B9', version: 1 },
      ),
    ).toBe('TV1-B9-Angle-Theme-V1');
  });
});

describe('nextSequence · PRD §7 increments per funnel and format', () => {
  const rows: CreativeSequenceRow[] = [
    { funnel: 'TOF', type: 'Video', sequence: 1 },
    { funnel: 'TOF', type: 'Video', sequence: 2 },
    { funnel: 'TOF', type: 'Static', sequence: 1 },
    { funnel: 'TOF', type: 'Carousel', sequence: 1 },
    { funnel: 'All Funnels', type: 'Motion Image', sequence: 1 },
    { funnel: 'Retargeting', type: 'Static', sequence: 1 },
  ];

  it('starts at one for a pair the brand has never used', () => {
    expect(nextSequence([], 'TOF', 'Video')).toBe(CREATIVE_SEQUENCE_START);
    expect(nextSequence(rows, 'Retargeting', 'Video')).toBe(1);
    expect(CREATIVE_SEQUENCE_START).toBe(1);
  });

  it('continues each pair independently across the six seeded briefs', () => {
    expect(nextSequence(rows, 'TOF', 'Video')).toBe(3);
    expect(nextSequence(rows, 'TOF', 'Static')).toBe(2);
    expect(nextSequence(rows, 'TOF', 'Carousel')).toBe(2);
    expect(nextSequence(rows, 'All Funnels', 'Motion Image')).toBe(2);
    expect(nextSequence(rows, 'Retargeting', 'Static')).toBe(2);
    expect(nextSequence(rows, 'All Funnels', 'Video')).toBe(1);
  });

  it('never lets one funnel bump another funnel of the same format', () => {
    expect(nextSequence(rows, 'Retargeting', 'Static')).toBe(2);
    expect(nextSequence(rows, 'TOF', 'Static')).toBe(2);
  });

  it('is max + 1, not count + 1, so a deleted row never hands its number out twice', () => {
    const withGap: CreativeSequenceRow[] = [
      { funnel: 'TOF', type: 'Video', sequence: 1 },
      { funnel: 'TOF', type: 'Video', sequence: 7 },
    ];
    expect(nextSequence(withGap, 'TOF', 'Video')).toBe(8);
  });

  it('ignores a sequence that is not a positive integer rather than poisoning the maximum', () => {
    const noisy: CreativeSequenceRow[] = [
      { funnel: 'TOF', type: 'Video', sequence: 2 },
      { funnel: 'TOF', type: 'Video', sequence: Number.NaN },
      { funnel: 'TOF', type: 'Video', sequence: -4 },
      { funnel: 'TOF', type: 'Video', sequence: 1.5 },
    ];
    expect(nextSequence(noisy, 'TOF', 'Video')).toBe(3);
  });

  it('starts at one when every row of the pair is unusable', () => {
    expect(nextSequence([{ funnel: 'TOF', type: 'Video', sequence: 0 }], 'TOF', 'Video')).toBe(1);
  });

  it('gives a name whose number nothing else in the brand is using', () => {
    const number = nextSequence(rows, 'TOF', 'Video');
    expect(creativeName({ funnel: 'TOF', format: 'Video', number, batch: 'B5', version: 1 })).toBe(
      'TV3-B5-Standalone-V1',
    );
  });
});
