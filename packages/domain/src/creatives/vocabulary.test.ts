import { describe, expect, it } from 'vitest';

import { INTERNAL_STATIC_STATUS, INTERNAL_VIDEO_STATUS, internalStatusFor } from '../state/index';
import {
  CREATIVE_DIMENSION_KEYS,
  CREATIVE_DIMENSIONS,
  CREATIVE_FUNNEL_KEYS,
  CREATIVE_FUNNELS,
  CREATIVE_PRIORITIES,
  CREATIVE_PRIORITY_KEYS,
  CREATIVE_SOURCE_KEYS,
  CREATIVE_SOURCES,
  CREATIVE_TYPE_KEYS,
  CREATIVE_TYPES,
  CREATIVE_VERSIONS,
  DIMENSION_PRESETS,
  creativeDimensionEntry,
  creativeFunnelEntry,
  creativeFunnelLabel,
  creativePriorityEntry,
  creativePriorityLabel,
  creativeTrack,
  creativeTypeEntry,
  creativeTypeLabel,
  creativeVersionLabel,
  dimensionEntries,
  dimensionsFor,
  isCreativeDimension,
  isCreativeFunnel,
  isCreativePriority,
  isCreativeSource,
  isCreativeType,
  isCreativeVersion,
  prioritySlaHours,
  prioritySlaLabel,
  priorityTone,
} from './vocabulary';

describe('the stored vocabularies mirror `@tas/db`', () => {
  it('holds the three funnels of `creativeFunnels`, in order', () => {
    expect(CREATIVE_FUNNEL_KEYS).toEqual(['TOF', 'Retargeting', 'All Funnels']);
  });

  it('holds the four types of `creativeTypes`, in order, with §5.10 spelling', () => {
    expect(CREATIVE_TYPE_KEYS).toEqual(['Video', 'Static', 'Carousel', 'Motion Image']);
  });

  it('holds the four priorities of `creativePriorities`, tightest SLA first', () => {
    expect(CREATIVE_PRIORITY_KEYS).toEqual([
      'Static High',
      'Static Average',
      'Video High',
      'Video Average',
    ]);
  });

  it('holds the three §8 ratios, in the order the dimensions grid renders them', () => {
    expect(CREATIVE_DIMENSION_KEYS).toEqual(['4:5', '1:1', '9:16']);
  });

  it('offers exactly V1 through V6', () => {
    expect([...CREATIVE_VERSIONS]).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('gives every entry a label, and every label is the key itself for these vocabularies', () => {
    for (const entry of [...CREATIVE_FUNNELS, ...CREATIVE_TYPES, ...CREATIVE_PRIORITIES]) {
      expect(entry.label).toBe(entry.key);
    }
  });
});

describe('the PRD §7 letters', () => {
  it('maps the funnels to T, R and A', () => {
    expect(CREATIVE_FUNNELS.map((entry) => [entry.key, entry.letter])).toEqual([
      ['TOF', 'T'],
      ['Retargeting', 'R'],
      ['All Funnels', 'A'],
    ]);
  });

  it('maps the types to V, S, C and M', () => {
    expect(CREATIVE_TYPES.map((entry) => [entry.key, entry.letter])).toEqual([
      ['Video', 'V'],
      ['Static', 'S'],
      ['Carousel', 'C'],
      ['Motion Image', 'M'],
    ]);
  });

  it('gives every funnel and every type a distinct single letter', () => {
    const funnelLetters = CREATIVE_FUNNELS.map((entry) => entry.letter);
    const typeLetters = CREATIVE_TYPES.map((entry) => entry.letter);
    expect(new Set(funnelLetters).size).toBe(funnelLetters.length);
    expect(new Set(typeLetters).size).toBe(typeLetters.length);
    for (const letter of [...funnelLetters, ...typeLetters]) {
      expect(letter).toHaveLength(1);
    }
  });
});

describe('guards and entry lookups', () => {
  it('accepts every key of its own vocabulary and nothing else', () => {
    expect(CREATIVE_FUNNEL_KEYS.every(isCreativeFunnel)).toBe(true);
    expect(CREATIVE_TYPE_KEYS.every(isCreativeType)).toBe(true);
    expect(CREATIVE_PRIORITY_KEYS.every(isCreativePriority)).toBe(true);
    expect(CREATIVE_DIMENSION_KEYS.every(isCreativeDimension)).toBe(true);

    expect(isCreativeFunnel('BOF')).toBe(false);
    expect(isCreativeType('Motion Graphic')).toBe(false);
    expect(isCreativePriority('High')).toBe(false);
    expect(isCreativeDimension('16:9')).toBe(false);
  });

  it('does not confuse the angle vocabulary with the brief vocabulary', () => {
    expect(isCreativeType('Motion Image')).toBe(true);
    expect(creativeTypeEntry('Motion Graphic')).toBeUndefined();
  });

  it('accepts V1 through V6 and refuses anything else', () => {
    expect(CREATIVE_VERSIONS.every(isCreativeVersion)).toBe(true);
    expect(isCreativeVersion(0)).toBe(false);
    expect(isCreativeVersion(7)).toBe(false);
    expect(isCreativeVersion(1.5)).toBe(false);
  });

  it('returns undefined for a value this build does not know', () => {
    expect(creativeFunnelEntry('BOF')).toBeUndefined();
    expect(creativePriorityEntry('Urgent')).toBeUndefined();
    expect(creativeDimensionEntry('16:9')).toBeUndefined();
  });

  it('renders an unknown stored value back rather than a blank cell', () => {
    expect(creativeFunnelLabel('BOF')).toBe('BOF');
    expect(creativeTypeLabel('Gif')).toBe('Gif');
    expect(creativePriorityLabel('Urgent')).toBe('Urgent');
  });

  it('writes the version label, leading V included', () => {
    expect(CREATIVE_VERSIONS.map(creativeVersionLabel)).toEqual([
      'V1',
      'V2',
      'V3',
      'V4',
      'V5',
      'V6',
    ]);
  });
});

describe('priorities · the PRD §5.10 SLA', () => {
  it('promises 12h, 24h, 24h and 48h', () => {
    expect(CREATIVE_PRIORITIES.map((entry) => [entry.key, entry.slaHours])).toEqual([
      ['Static High', 12],
      ['Static Average', 24],
      ['Video High', 24],
      ['Video Average', 48],
    ]);
  });

  it('reads the hours back for every priority', () => {
    expect(CREATIVE_PRIORITY_KEYS.map(prioritySlaHours)).toEqual([12, 24, 24, 48]);
  });

  it('labels the hours for every priority', () => {
    expect(CREATIVE_PRIORITY_KEYS.map(prioritySlaLabel)).toEqual(['12h', '24h', '24h', '48h']);
  });

  it('has no SLA for an unprioritised brief — that is not a deadline of zero', () => {
    expect(prioritySlaHours(null)).toBeNull();
    expect(prioritySlaHours(undefined)).toBeNull();
    expect(prioritySlaLabel(null)).toBeNull();
    expect(prioritySlaHours('Urgent')).toBeNull();
  });
});

describe('priorityTone · every priority', () => {
  it('tones each of the four priorities off its clock', () => {
    expect(CREATIVE_PRIORITY_KEYS.map(priorityTone)).toEqual(['bad', 'warn', 'warn', 'mute']);
  });

  it('gives the two 24h priorities the same chip, because it is the same promise', () => {
    expect(priorityTone('Static Average')).toBe(priorityTone('Video High'));
  });

  it('rests an unprioritised or unknown brief rather than letting it shout', () => {
    expect(priorityTone(null)).toBe('mute');
    expect(priorityTone(undefined)).toBe('mute');
    expect(priorityTone('Urgent')).toBe('mute');
  });
});

describe('creativeTrack · which internal ladder a type is graded on', () => {
  it('sends video and motion image down the video track', () => {
    expect(creativeTrack('Video')).toBe('video');
    expect(creativeTrack('Motion Image')).toBe('video');
  });

  it('sends static and carousel down the static track', () => {
    expect(creativeTrack('Static')).toBe('static');
    expect(creativeTrack('Carousel')).toBe('static');
  });

  it('agrees with the `track` on every entry', () => {
    for (const entry of CREATIVE_TYPES) {
      expect(creativeTrack(entry.key)).toBe(entry.track);
    }
  });

  it('feeds `internalStatusFor` so no component branches on the type itself', () => {
    expect(internalStatusFor(creativeTrack('Carousel'))).toBe(INTERNAL_STATIC_STATUS);
    expect(internalStatusFor(creativeTrack('Motion Image'))).toBe(INTERNAL_VIDEO_STATUS);
  });

  it('falls back to the track whose first state is the stored column default', () => {
    expect(creativeTrack('Gif')).toBe('video');
    expect(internalStatusFor(creativeTrack('Gif'))[0]?.key).toBe('sent_to_video_editor');
  });
});

describe('dimensions · the PRD §8 presets', () => {
  it('gives video and motion image 4:5, 1:1 and 9:16', () => {
    expect(DIMENSION_PRESETS.Video).toEqual(['4:5', '1:1', '9:16']);
    expect(DIMENSION_PRESETS['Motion Image']).toEqual(['4:5', '1:1', '9:16']);
  });

  it('gives static and carousel 1:1 and 9:16', () => {
    expect(DIMENSION_PRESETS.Static).toEqual(['1:1', '9:16']);
    expect(DIMENSION_PRESETS.Carousel).toEqual(['1:1', '9:16']);
  });

  it('matches the defaults `@tas/db` stored on the six fixtures', () => {
    expect(CREATIVE_TYPE_KEYS.map((type) => [type, dimensionsFor(type)])).toEqual([
      ['Video', ['4:5', '1:1', '9:16']],
      ['Static', ['1:1', '9:16']],
      ['Carousel', ['1:1', '9:16']],
      ['Motion Image', ['4:5', '1:1', '9:16']],
    ]);
  });

  it('gives an unknown type the superset rather than an empty grid', () => {
    expect(dimensionsFor('Gif')).toEqual(['4:5', '1:1', '9:16']);
  });

  it('names the §8 delivery size for each ratio', () => {
    expect(CREATIVE_DIMENSIONS.map((entry) => entry.pixels)).toEqual([
      '1080x1350',
      '1080x1080',
      '1080x1920',
    ]);
    expect(creativeDimensionEntry('1:1')?.pixels).toBe('1080x1080');
  });
});

describe('dimensionEntries · a stored array as a grid', () => {
  it('renders a stored array in vocabulary order, whatever order the row carries', () => {
    expect(dimensionEntries(['9:16', '4:5', '1:1']).map((entry) => entry.key)).toEqual([
      '4:5',
      '1:1',
      '9:16',
    ]);
  });

  it('never repeats a ratio a row happens to list twice', () => {
    expect(dimensionEntries(['1:1', '1:1', '9:16'])).toHaveLength(2);
  });

  it('drops a ratio this build does not know rather than rendering it raw', () => {
    expect(dimensionEntries(['1:1', '16:9']).map((entry) => entry.key)).toEqual(['1:1']);
  });

  it('is empty for an empty array, so the page shows its own empty state', () => {
    expect(dimensionEntries([])).toEqual([]);
  });

  it('renders every preset', () => {
    for (const type of CREATIVE_TYPE_KEYS) {
      expect(dimensionEntries(dimensionsFor(type)).map((entry) => entry.key)).toEqual([
        ...dimensionsFor(type),
      ]);
    }
  });
});

describe('the creative sources vocabulary (PRD §7 optional source prefix)', () => {
  it('holds the two sources of `creativeSources`, in order', () => {
    expect(CREATIVE_SOURCE_KEYS).toEqual(['TAS', 'Client']);
  });

  it('labels each source with its own key (no separate display string)', () => {
    expect(CREATIVE_SOURCES.map((entry) => entry.label)).toEqual(['TAS', 'Client']);
  });

  it('narrows a known source and rejects anything else', () => {
    expect(isCreativeSource('TAS')).toBe(true);
    expect(isCreativeSource('Client')).toBe(true);
    expect(isCreativeSource('client')).toBe(false);
    expect(isCreativeSource('Agency')).toBe(false);
    expect(isCreativeSource('')).toBe(false);
  });
});
