import { angleStatuses } from '@tas/db/schema';
import {
  chipTone,
  internalStatusFor,
  type CreativeTrack,
  type InternalStatusKey,
} from '@tas/domain/state';
import { describe, expect, it } from 'vitest';

import { briefPath, conceptPath } from '@/lib/routes';

import {
  AD_INSPO_LABEL,
  ANGLE_GROUP_HEADINGS,
  ANGLE_NOTE_FIELDS,
  ANGLE_STATUS_OPTIONS,
  APPROVAL_HEADING,
  ASSESSMENT_HEADING,
  CONCEPTS_LABEL,
  CREATIVE_DESIGNS_LABEL,
  CREATIVE_MODULE_CHIP_TONE,
  EM_DASH,
  FORMATS_LABEL,
  INSPIRATION_HEADING,
  MAX_ROW_FORMATS,
  NONE_VALUE,
  NOTES_HEADING,
  POTENTIAL_FIELD,
  STATUS_LABEL,
  WINNING_LABEL,
  angleStatusView,
  chipLabel,
  formatChipRow,
  indexConceptsByAngle,
  indexCreativeDesignsByAngle,
  indexCreativeModulesByAngle,
  inspoSourceLabel,
  overflowLabel,
} from './fields';

/** The first step of each internal track, past `noUncheckedIndexedAccess`. */
function firstStep(track: CreativeTrack): { key: InternalStatusKey; label: string } {
  const [entry] = internalStatusFor(track);
  if (entry === undefined) throw new Error(`the ${track} track is empty`);
  return entry;
}

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

  it('keeps Approval outside the six groups, so the group-heading contract holds', () => {
    expect(APPROVAL_HEADING).toBe('Approval');
    expect(ANGLE_GROUP_HEADINGS).not.toContain(APPROVAL_HEADING);
  });

  it('keeps Inspiration, Assessment and Notes outside the six groups too', () => {
    expect([INSPIRATION_HEADING, ASSESSMENT_HEADING, NOTES_HEADING]).toEqual([
      'Inspiration',
      'Assessment',
      'Notes',
    ]);
    for (const heading of [INSPIRATION_HEADING, ASSESSMENT_HEADING, NOTES_HEADING]) {
      expect(ANGLE_GROUP_HEADINGS).not.toContain(heading);
    }
  });
});

describe('parity labels (Gratsi "Angles", verbatim)', () => {
  it('names every control outside the prose groups exactly as Gratsi does', () => {
    expect(FORMATS_LABEL).toBe('Formats to create');
    expect(AD_INSPO_LABEL).toBe('Ad Inspo');
    expect(WINNING_LABEL).toBe('Winning');
    expect(CONCEPTS_LABEL).toBe('Concepts');
    expect(CREATIVE_DESIGNS_LABEL).toBe('Creatives');
  });

  it('renders Potential as a free-text field on its own column, never a select', () => {
    expect(POTENTIAL_FIELD.name).toBe('potential');
    expect(POTENTIAL_FIELD.label).toBe('Potential');
  });

  it('renders the two note columns under their Gratsi names, internal first', () => {
    expect(ANGLE_NOTE_FIELDS.map(({ name, label }) => ({ name, label }))).toEqual([
      { name: 'internalNotes', label: 'Internal Notes' },
      { name: 'clientNotes', label: 'Client Notes' },
    ]);
    // The internal field says so in its own hint, so the team never mistakes it for client-facing.
    expect(ANGLE_NOTE_FIELDS[0]?.hint).toMatch(/team only/iu);
  });
});

describe('indexConceptsByAngle', () => {
  const ANGLE_A = '55555555-5555-4555-8555-00000000000a';
  const ANGLE_B = '55555555-5555-4555-8555-00000000000b';
  const step = firstStep('video');

  const concepts = [
    {
      id: 'c-newest',
      name: 'B2-BodyClock-GreenScreen',
      angleIds: [ANGLE_A],
      internalStatus: step.key,
    },
    {
      id: 'c-older',
      name: 'B1-BodyClock-Podcast',
      angleIds: [ANGLE_A, ANGLE_B],
      internalStatus: step.key,
    },
    { id: 'c-unpaired', name: 'B1-Nothing-Yet', angleIds: [], internalStatus: step.key },
  ] as const;

  it('inverts the junction: every angle lists each concept paired with it, in the rows’ order', () => {
    const byAngle = indexConceptsByAngle(concepts, 'video');

    expect(byAngle[ANGLE_A]?.map((record) => record.id)).toEqual(['c-newest', 'c-older']);
    expect(byAngle[ANGLE_B]?.map((record) => record.id)).toEqual(['c-older']);
    expect(Object.keys(byAngle)).toEqual([ANGLE_A, ANGLE_B]);
  });

  it('links each record to the concept’s own page, with its internal status as the chip', () => {
    const [record] = indexConceptsByAngle(concepts, 'video')[ANGLE_B] ?? [];

    expect(record).toEqual({
      id: 'c-older',
      label: 'B1-BodyClock-Podcast',
      href: conceptPath('c-older'),
      status: { label: step.label, tone: chipTone(step.label) },
    });
  });

  it('counts a duplicated junction row once rather than rendering the row twice', () => {
    const byAngle = indexConceptsByAngle(
      [{ id: 'c-dup', name: 'Twice', angleIds: [ANGLE_A, ANGLE_A], internalStatus: step.key }],
      'video',
    );

    expect(byAngle[ANGLE_A]).toHaveLength(1);
  });

  it('is empty for no concepts at all', () => {
    expect(indexConceptsByAngle([], 'video')).toEqual({});
  });
});

describe('indexCreativeDesignsByAngle', () => {
  const ANGLE_A = '55555555-5555-4555-8555-00000000000a';
  const video = firstStep('video');
  const still = firstStep('static');

  const briefs = [
    {
      id: 'b-video',
      name: 'TV01-B2-BodyClock-V1',
      angleId: ANGLE_A,
      track: 'video',
      internalStatus: video.key,
    },
    {
      id: 'b-static',
      name: 'TS01-B2-BodyClock-V1',
      angleId: ANGLE_A,
      track: 'static',
      internalStatus: still.key,
    },
    {
      id: 'b-standalone',
      name: 'TS02-B2-Standalone-V1',
      angleId: null,
      track: 'static',
      internalStatus: still.key,
    },
  ] as const;

  it('lists the briefs whose angle_id is the angle, in the rows’ order, and none for a null link', () => {
    const byAngle = indexCreativeDesignsByAngle(briefs);

    expect(byAngle[ANGLE_A]?.map((record) => record.id)).toEqual(['b-video', 'b-static']);
    expect(Object.keys(byAngle)).toEqual([ANGLE_A]);
  });

  it('links each record to the brief’s own page, with its status read on its own track', () => {
    const records = indexCreativeDesignsByAngle(briefs)[ANGLE_A] ?? [];

    expect(records[0]).toEqual({
      id: 'b-video',
      label: 'TV01-B2-BodyClock-V1',
      href: briefPath('b-video'),
      status: { label: video.label, tone: chipTone(video.label) },
    });
    expect(records[1]?.status).toEqual({ label: still.label, tone: chipTone(still.label) });
  });

  it('is empty for no briefs at all', () => {
    expect(indexCreativeDesignsByAngle([])).toEqual({});
  });
});

describe('angle status', () => {
  it('labels the control exactly as Gratsi names the field', () => {
    expect(STATUS_LABEL).toBe('Status');
  });

  it('offers every angleStatuses key, in vocabulary order, with its label', () => {
    expect(ANGLE_STATUS_OPTIONS.map(({ key, label }) => ({ key, label }))).toEqual([
      ...angleStatuses,
    ]);
    expect(ANGLE_STATUS_OPTIONS.map((option) => option.key)).toEqual([
      'pending_for_approval',
      'revised',
      'approved',
      'needs_revisions',
      'revisions_submitted',
    ]);
  });

  it('tones approval ok, a refusal warn, and the rest neutral or informational', () => {
    const tones = Object.fromEntries(
      ANGLE_STATUS_OPTIONS.map((option) => [option.key, option.tone]),
    );

    expect(tones).toEqual({
      pending_for_approval: 'info',
      revised: 'mute',
      approved: 'ok',
      needs_revisions: 'warn',
      revisions_submitted: 'mute',
    });
  });

  it('agrees with the domain’s chipTone wherever the domain has a rule for the label', () => {
    for (const key of ['approved', 'needs_revisions', 'revisions_submitted'] as const) {
      const view = angleStatusView(key);
      expect(view?.tone).toBe(chipTone(view?.label ?? ''));
    }
  });

  it('is null for an unset status, which the column allows', () => {
    expect(angleStatusView(null)).toBeNull();
  });

  it('resolves a stored key to its label and tone', () => {
    expect(angleStatusView('approved')).toEqual({
      key: 'approved',
      label: 'Approved',
      tone: 'ok',
    });
  });

  it('renders a key this build does not list as itself, muted, rather than an empty cell', () => {
    expect(angleStatusView('on_hold')).toEqual({ key: 'on_hold', label: 'on_hold', tone: 'mute' });
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

  it('gives every record the module chip tone and no href: the Creative Modules workspace is removed', () => {
    const [record] = indexCreativeModulesByAngle(modules)[ANGLE_B] ?? [];

    expect(record).toEqual({
      id: 'm-zeta',
      label: 'Zeta Hooks',
      chip: CREATIVE_MODULE_CHIP_TONE,
    });
    expect(record).not.toHaveProperty('href');
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
