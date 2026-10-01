import {
  creativeSheetInternalStatuses,
  creativeSheetStatuses,
  creativeSheetWinning,
} from '@tas/db/schema';
import { chipTone } from '@tas/domain/state';
import { describe, expect, it } from 'vitest';

import {
  countLabel,
  INTERNAL_STATUS_OPTIONS,
  internalStatusView,
  isKanbanField,
  joinUrlLines,
  kanbanColumnsFor,
  kanbanView,
  matchesSearch,
  NOT_SET,
  QA_CHECKS,
  SHEET_CHECKS,
  STATUS_OPTIONS,
  statusView,
  WINNING_OPTIONS,
  winningView,
} from './fields';

describe('the three select vocabularies', () => {
  it('render the @tas/db labels in vocabulary order and store the keys', () => {
    expect(INTERNAL_STATUS_OPTIONS.map(({ key, label }) => ({ key, label }))).toEqual(
      creativeSheetInternalStatuses.map(({ key, label }) => ({ key, label })),
    );
    expect(STATUS_OPTIONS.map(({ key, label }) => ({ key, label }))).toEqual(
      creativeSheetStatuses.map(({ key, label }) => ({ key, label })),
    );
    expect(WINNING_OPTIONS.map(({ key, label }) => ({ key, label }))).toEqual(
      creativeSheetWinning.map(({ key, label }) => ({ key, label })),
    );
  });

  it('agree with chipTone wherever the domain has a rule for the label', () => {
    for (const option of [...INTERNAL_STATUS_OPTIONS, ...STATUS_OPTIONS]) {
      const domain = chipTone(option.label);
      if (domain !== 'mute') {
        expect(option.tone, option.label).toBe(domain);
      }
    }
    expect(internalStatusView('approved')?.tone).toBe(chipTone('Approved'));
    expect(internalStatusView('images_revisions')?.tone).toBe(chipTone('Images Revisions'));
    expect(internalStatusView('revisions_submitted')?.tone).toBe(chipTone('Revisions Submitted'));
    expect(statusView('launched')?.tone).toBe(chipTone('Launched'));
    expect(statusView('revisions_needed')?.tone).toBe(chipTone('Revisions Needed'));
  });

  it('give the sheet’s own words the tones the domain cannot', () => {
    expect(statusView('pending_for_approval')?.tone).toBe('info');
    expect(statusView('denied')?.tone).toBe('bad');
    expect(internalStatusView('ad_submitted')?.tone).toBe('accent');
    expect(internalStatusView('video_editing_on_hold')?.tone).toBe('warn');
    expect(winningView('best_performing')?.tone).toBe('ok');
    expect(winningView('average')?.tone).toBe('mute');
  });

  it('are total: null is no chip, an unknown key renders itself muted', () => {
    expect(internalStatusView(null)).toBeNull();
    expect(statusView(null)).toBeNull();
    expect(winningView(null)).toBeNull();
    expect(statusView('from_a_newer_build')).toEqual({
      key: 'from_a_newer_build',
      label: 'from_a_newer_build',
      tone: 'mute',
    });
  });
});

describe('the checkboxes', () => {
  it('are the six Airtable checkboxes, the three QA ticks first', () => {
    expect(SHEET_CHECKS.map((check) => check.name)).toEqual([
      'qaVideoEditor',
      'qaDesigner',
      'qaStrategist',
      'used',
      'deniedRevisionsNeeded',
      'spellCheckRequested',
    ]);
    expect(QA_CHECKS.map((check) => check.label)).toEqual([
      'Video Editor QA',
      'Graphic Designer QA',
      'Creative Strategist QA',
    ]);
  });
});

describe('joinUrlLines', () => {
  it('shows one link per line, and nothing for a null checklist', () => {
    expect(joinUrlLines(['https://a.example/1', 'https://a.example/2'])).toBe(
      'https://a.example/1\nhttps://a.example/2',
    );
    expect(joinUrlLines(null)).toBe('');
  });
});

describe('countLabel', () => {
  it('is singular at one and says "n of m" while narrowed', () => {
    expect(countLabel(1, 1)).toBe('1 row');
    expect(countLabel(5, 5)).toBe('5 rows');
    expect(countLabel(5, 2)).toBe('2 of 5 rows');
  });
});

describe('matchesSearch', () => {
  const item = {
    name: 'October-TV1-B1-Your Body Clock Is Not Broken-V2',
    briefName: 'TV1-B1-Your Body Clock Is Not Broken-V2',
    internalStatus: 'ad_submitted',
    status: 'denied',
    winning: null,
  };

  it('reads the name, the brief and the select LABELS, never the keys', () => {
    expect(matchesSearch(item, 'october')).toBe(true);
    expect(matchesSearch(item, 'body clock')).toBe(true);
    expect(matchesSearch(item, 'ad submitted')).toBe(true);
    expect(matchesSearch(item, 'denied')).toBe(true);
    expect(matchesSearch(item, 'ad_submitted')).toBe(false);
    expect(matchesSearch(item, 'best performing')).toBe(false);
  });

  it('matches everything on an empty query', () => {
    expect(matchesSearch(item, '')).toBe(true);
  });
});

describe('the Kanban board', () => {
  it('lays out the vocabulary in order, empties kept, with a trailing Not set column', () => {
    const columns = kanbanColumnsFor('status');
    expect(columns.map((column) => column.key)).toEqual([
      ...creativeSheetStatuses.map((entry) => entry.key),
      '',
    ]);
    expect(columns.at(-1)?.label).toBe(NOT_SET);
    expect(kanbanColumnsFor('internalStatus')).toHaveLength(
      creativeSheetInternalStatuses.length + 1,
    );
  });

  it('groups a card by the chosen field', () => {
    const item = { internalStatus: 'approved', status: 'launched' };
    expect(kanbanView('internalStatus', item)?.label).toBe('Approved');
    expect(kanbanView('status', item)?.label).toBe('Launched');
    expect(kanbanView('status', { internalStatus: 'approved', status: null })).toBeNull();
  });

  it('accepts only the two groupable fields', () => {
    expect(isKanbanField('internalStatus')).toBe(true);
    expect(isKanbanField('status')).toBe(true);
    expect(isKanbanField('winning')).toBe(false);
  });
});
