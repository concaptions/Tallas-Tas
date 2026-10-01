import { describe, expect, it } from 'vitest';

import {
  ANGLE_GROUP_HEADINGS,
  CREATIVE_MODULE_CHIP_TONE,
  EM_DASH,
  MAX_ROW_FORMATS,
  NONE_VALUE,
  chipLabel,
  creativeModuleHref,
  formatChipRow,
  indexCreativeModulesByAngle,
  inspoSourceLabel,
  overflowLabel,
} from './fields';

describe('formatChipRow', () => {
  it('keeps the vocabulary order whatever order the row stored', () => {
    const row = formatChipRow(['Carousel', 'Static']);

    expect(row.shown.map((entry) => entry.key)).toEqual(['Static', 'Carousel']);
    expect(row.overflow).toBe(0);
  });

  it('collapses past three so a row never wraps', () => {
    const row = formatChipRow(['Static', 'Video', 'Carousel', 'Motion Graphic']);

    expect(row.shown).toHaveLength(MAX_ROW_FORMATS);
    expect(row.overflow).toBe(1);
    expect(overflowLabel(row.overflow)).toBe('+1');
  });

  it('drops a value outside the vocabulary rather than rendering it raw', () => {
    expect(formatChipRow(['Static', 'Billboard']).shown.map((entry) => entry.key)).toEqual([
      'Static',
    ]);
  });

  it('is empty for an angle with no formats, so the cell can render the dash', () => {
    expect(formatChipRow([])).toEqual({ shown: [], overflow: 0 });
  });
});

describe('chipLabel', () => {
  it('takes the name before the em dash off a seeded persona', () => {
    expect(chipLabel(`Denise ${EM_DASH} peri-menopausal, awake at 3am with night sweats`)).toBe(
      'Denise',
    );
  });

  it('leaves a name with no em dash untouched', () => {
    expect(chipLabel('Niagara Deep Sleep Weighted Blanket')).toBe(
      'Niagara Deep Sleep Weighted Blanket',
    );
  });

  it('falls back to the whole string rather than returning an empty chip', () => {
    expect(chipLabel(`${EM_DASH} nameless`)).toBe(`${EM_DASH} nameless`);
  });
});

describe('inspoSourceLabel', () => {
  it('names every kind parseInspoLink can return', () => {
    expect(inspoSourceLabel('meta-ad-library')).toBe('Meta');
    expect(inspoSourceLabel('youtube')).toBe('YouTube');
    expect(inspoSourceLabel('tiktok')).toBe('TikTok');
    expect(inspoSourceLabel('instagram')).toBe('Instagram');
    expect(inspoSourceLabel('other')).toBe('Link');
  });
});

describe('panel groups', () => {
  it('are the six the design specifies, in order', () => {
    expect(ANGLE_GROUP_HEADINGS).toEqual([
      'Identity',
      'Hypothesis',
      'Pain Points',
      'USP',
      'Targeting',
      'Resources',
    ]);
  });

  it('spells "no link" as the empty string the action stores as NULL', () => {
    expect(NONE_VALUE).toBe('');
  });
});

describe('creativeModuleHref', () => {
  it('opens the Creative Modules page on that module, the way its own rows do', () => {
    expect(creativeModuleHref('1234abcd-1234-4abc-8abc-000000000001')).toBe(
      '/app/creative-modules?module=1234abcd-1234-4abc-8abc-000000000001',
    );
  });

  it('encodes an id that is not a uuid so it cannot smuggle a second parameter', () => {
    expect(creativeModuleHref('a&b=c')).toBe('/app/creative-modules?module=a%26b%3Dc');
  });
});

describe('indexCreativeModulesByAngle', () => {
  const ANGLE_A = '55555555-5555-4555-8555-00000000000a';
  const ANGLE_B = '55555555-5555-4555-8555-00000000000b';
  const ANGLE_C = '55555555-5555-4555-8555-00000000000c';

  const modules = [
    { id: 'm-zeta', moduleName: 'Zeta Hooks', angleIds: [ANGLE_A, ANGLE_B] },
    { id: 'm-alpha', moduleName: 'Alpha Demos', angleIds: [ANGLE_A] },
    { id: 'm-none', moduleName: 'Unlinked', angleIds: [] },
  ];

  it('inverts the junction: every angle lists each module that links it, once', () => {
    const byAngle = indexCreativeModulesByAngle(modules);

    expect(byAngle[ANGLE_A]?.map((record) => record.id)).toEqual(['m-alpha', 'm-zeta']);
    expect(byAngle[ANGLE_B]?.map((record) => record.id)).toEqual(['m-zeta']);
  });

  it('orders by module name, not by which module was edited last', () => {
    const byAngle = indexCreativeModulesByAngle(modules);

    expect(byAngle[ANGLE_A]?.map((record) => record.label)).toEqual(['Alpha Demos', 'Zeta Hooks']);
  });

  it('leaves an angle no module links absent, so the panel reads it as empty', () => {
    const byAngle = indexCreativeModulesByAngle(modules);

    expect(byAngle[ANGLE_C]).toBeUndefined();
    expect(Object.keys(byAngle)).toEqual([ANGLE_A, ANGLE_B]);
  });

  it('gives every record a href to the module panel and the module chip tone', () => {
    const [record] = indexCreativeModulesByAngle(modules)[ANGLE_B] ?? [];

    expect(record).toEqual({
      id: 'm-zeta',
      label: 'Zeta Hooks',
      href: creativeModuleHref('m-zeta'),
      chip: CREATIVE_MODULE_CHIP_TONE,
    });
  });

  it('counts a duplicated junction row once rather than rendering the chip twice', () => {
    const byAngle = indexCreativeModulesByAngle([
      { id: 'm-dup', moduleName: 'Twice', angleIds: [ANGLE_A, ANGLE_A] },
    ]);

    expect(byAngle[ANGLE_A]).toHaveLength(1);
  });

  it('is empty for no modules at all', () => {
    expect(indexCreativeModulesByAngle([])).toEqual({});
  });
});
