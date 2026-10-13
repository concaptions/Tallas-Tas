import { renderToStaticMarkup } from 'react-dom/server';
import { CLIENT_TRACK_LOCKED_NOTE } from '@tas/ui';
import {
  BRIEF_QA_CHECKS,
  chipTone,
  CLIENT_STATUS,
  CLIENT_TRACK_STEPS,
  EDITOR_STAGES,
  INTERNAL_STATUS,
  isClientTrackOpen,
  qaGateReason,
  QA_RESET,
  requiredQaChecks,
} from '@tas/domain/state';
import { CREATIVE_TYPES, creativeTrack } from '@tas/domain/creatives';
import { describe, expect, it } from 'vitest';

import {
  ChipToneMapStory,
  QaGateMatrixStory,
  StatusVocabularyStory,
} from './status-vocabulary.stories';

/**
 * Board 6 drawn live (B6.V17): the stories are pinned against the vocabularies themselves, so a
 * key added to, or retired from, `@tas/domain/state` changes both sides of every assertion. No
 * status string is typed here either.
 */
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgb\(/;

describe('StatusVocabularyStory', () => {
  const html = renderToStaticMarkup(<StatusVocabularyStory />);

  it('lists every live key of both tracks beside its chip, in flow order', () => {
    const keys = [...html.matchAll(/data-slot="status-vocabulary-row" data-key="([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(keys).toEqual([
      ...INTERNAL_STATUS.map((entry) => entry.key),
      ...CLIENT_STATUS.map((entry) => entry.key),
    ]);
    for (const entry of [...INTERNAL_STATUS, ...CLIENT_STATUS]) {
      expect(html).toContain(`>${entry.label}</span>`);
    }
  });

  it('washes exactly the gate row — the one isClientTrackOpen accepts — in ok', () => {
    const gateRows = html.match(/data-gate="true"/g) ?? [];
    expect(gateRows).toHaveLength(INTERNAL_STATUS.filter((e) => isClientTrackOpen(e.key)).length);
    expect(html).toContain('bg-ok/8');
  });

  it('numbers the client steps and sets the branches apart with the locked note', () => {
    expect(html).toContain('data-slot="status-vocabulary-branches"');
    const branches = CLIENT_STATUS.length - CLIENT_TRACK_STEPS.length;
    const dashes = html.match(/text-text4">—<\/span>/g) ?? [];
    expect(dashes).toHaveLength(branches);
    expect(html).toContain(CLIENT_TRACK_LOCKED_NOTE);
    expect(html).toContain('lucide-lock-open');
  });

  it('names the editor-stage keys as stages, not statuses, and the consolidation that retired the rest', () => {
    expect(html).toContain(EDITOR_STAGES.map((stage) => stage.key).join(' / '));
    expect(html).toContain('retired the per-track keys');
  });

  it('uses the token layer only', () => {
    expect(html).not.toMatch(COLOUR_LITERAL);
  });
});

describe('ChipToneMapStory', () => {
  const html = renderToStaticMarkup(<ChipToneMapStory />);

  it('shows one row per tone a live label resolves to, each label under its computed tone', () => {
    const tones = [...html.matchAll(/data-slot="chip-tone-row" data-tone="([^"]+)"/g)].map(
      (match) => match[1],
    );
    const labels = [...new Set([...INTERNAL_STATUS, ...CLIENT_STATUS].map((e) => e.label))];
    const expected = [...new Set(labels.map((label) => chipTone(label)))];
    expect([...tones].sort()).toEqual([...expected].sort());
    for (const label of labels) {
      expect(html).toContain(label);
    }
    expect(html).not.toMatch(COLOUR_LITERAL);
  });
});

describe('QaGateMatrixStory', () => {
  const html = renderToStaticMarkup(<QaGateMatrixStory />);

  it('draws one row per creative type with its track and the gate sentence an untouched brief shows', () => {
    // The Table primitive sets `class` between the two attributes.
    const tracks = [
      ...html.matchAll(/data-slot="qa-gate-matrix-row"[^>]*data-track="([^"]+)"/g),
    ].map((match) => match[1]);
    expect(tracks).toEqual(CREATIVE_TYPES.map((type) => creativeTrack(type.key)));
    for (const type of CREATIVE_TYPES) {
      expect(html).toContain(type.key);
      expect(html).toContain(qaGateReason(creativeTrack(type.key), QA_RESET) ?? '');
    }
    for (const check of BRIEF_QA_CHECKS) {
      expect(html).toContain(check);
    }
  });

  it('marks required ticks with the accent StatusChip and nothing else', () => {
    const required = html.match(/>required<\/span>/g) ?? [];
    const expected = CREATIVE_TYPES.reduce(
      (total, type) => total + requiredQaChecks(creativeTrack(type.key)).length,
      0,
    );
    expect(required).toHaveLength(expected);
    expect(html).not.toMatch(COLOUR_LITERAL);
  });
});
