import {
  CLIENT_STATUS,
  chipTone,
  EDITOR_STAGES,
  INTERNAL_ENTRY_STATUS,
  INTERNAL_STATUS,
} from '@tas/domain/state';
import { describe, expect, it } from 'vitest';

import {
  BRIEF_CONTENT_FIELDS,
  pendingAfterRows,
  pendingOnSubmit,
  pendingSheetRow,
  rowsWithPendingCreative,
  applyKanbanMoves,
  assetSubline,
  countLabel,
  GROUP_PARAM,
  INTERNAL_STATUS_OPTIONS,
  internalStatusView,
  isKanbanField,
  isSheetStatusField,
  joinUrlLines,
  kanbanColumnsFor,
  kanbanView,
  matchesSearch,
  OTHER_COLUMN,
  QA_CHECKS,
  SEARCH_PARAM,
  SELECTION_PARAM,
  SHEET_CHECKS,
  SHEET_DUE_DATE_LABEL,
  SHEET_GROUPS,
  sheetQaGate,
  STATUS_OPTIONS,
  statusView,
  VOICEOVER_TYPE_OPTIONS,
} from './fields';

describe('the URL parameters', () => {
  it('spell the board field `?groupBy=` — the editor-board link and the retired list’s redirect read it — and never collide', () => {
    expect(GROUP_PARAM).toBe('groupBy');
    expect(new Set([SELECTION_PARAM, SEARCH_PARAM, GROUP_PARAM]).size).toBe(3);
  });
});

describe('the two select vocabularies', () => {
  it('are the state machine’s own lists: INTERNAL_STATUS, then CLIENT_STATUS', () => {
    const expected = INTERNAL_STATUS.map(({ key, label }) => ({ key, label }));
    expect(INTERNAL_STATUS_OPTIONS.map(({ key, label }) => ({ key, label }))).toEqual(expected);
    expect(STATUS_OPTIONS.map(({ key, label }) => ({ key, label }))).toEqual(
      CLIENT_STATUS.map(({ key, label }) => ({ key, label })),
    );
  });

  it('take every tone from chipTone(label) — one tone source for both tracks (B6.V11)', () => {
    for (const option of [...INTERNAL_STATUS_OPTIONS, ...STATUS_OPTIONS]) {
      expect(option.tone, option.label).toBe(chipTone(option.label));
    }
    expect(internalStatusView('approved')?.tone).toBe(chipTone('Approved'));
    expect(internalStatusView('revisions_needed')?.tone).toBe(chipTone('Revisions Needed'));
    expect(internalStatusView('revisions_submitted')?.tone).toBe(chipTone('Revisions Submitted'));
    expect(statusView('launched')?.tone).toBe(chipTone('Launched'));
    expect(statusView('revisions_needed')?.tone).toBe(chipTone('Revisions Needed'));
    expect(statusView('disapproved')?.tone).toBe(chipTone('Disapproved'));
  });

  it('draw the working steps mute, as board 6 rules and the brief page already does', () => {
    expect(statusView('pending_for_approval')?.tone).toBe('info');
    expect(internalStatusView('ad_submitted')?.tone).toBe('mute');
    expect(internalStatusView('under_editing_or_designing')?.tone).toBe('mute');
    expect(internalStatusView('draft')?.tone).toBe('mute');
  });

  it('are total: null is no chip, an unknown key renders itself muted', () => {
    expect(internalStatusView(null)).toBeNull();
    expect(statusView(null)).toBeNull();
    expect(statusView('from_a_newer_build')).toEqual({
      key: 'from_a_newer_build',
      label: 'from_a_newer_build',
      tone: 'mute',
    });
  });
});

describe('the checkboxes', () => {
  it('are the brief’s three QA ticks and its spell-check trigger, QA first', () => {
    expect(SHEET_CHECKS.map((check) => check.name)).toEqual([
      'qaVideoEditor',
      'qaDesigner',
      'qaStrategist',
      'spellCheckRequested',
    ]);
    expect(QA_CHECKS.map((check) => check.label)).toEqual([
      'Video Editor QA',
      'Graphic Designer QA',
      'Creative Strategist QA',
    ]);
  });
});

describe('the panel sections (Ticket 6, 2026-10-14)', () => {
  it('are the six Ticket 6 headings in render order: Identity, Content, Assets, QA, Status, Activity', () => {
    expect(Object.values(SHEET_GROUPS)).toEqual([
      'Identity',
      'Content',
      'Assets',
      'QA',
      'Status',
      'Activity',
    ]);
  });
});

describe('assetSubline (B2.V20)', () => {
  it('names the file when the field holds exactly one link, decoded, without query or fragment', () => {
    expect(assetSubline(['https://files.example/briefs/breakdown_v2.docx'])).toBe(
      'breakdown_v2.docx',
    );
    expect(assetSubline(['https://r2.example/a%20b.png?x=1#top'])).toBe('a b.png');
    expect(assetSubline(['https://r2.example/dir/'])).toBe('dir');
  });

  it('counts the files otherwise, and survives a malformed escape', () => {
    expect(assetSubline(['https://r2.example/a.png', 'https://r2.example/b.png'])).toBe('2 files');
    expect(assetSubline([])).toBe('0 files');
    expect(assetSubline(['https://r2.example/%E0%A4%A.png'])).toBe('%E0%A4%A.png');
  });
});

describe('sheetQaGate (B4.A12)', () => {
  const none = { qaVideoEditor: false, qaDesigner: false, qaStrategist: false };

  it('reads the ticks it is given, so the line moves before Save', () => {
    expect(sheetQaGate('video', none)).toEqual({
      label: '0 of 2 required checks complete.',
      open: false,
    });
    expect(sheetQaGate('video', { ...none, qaVideoEditor: true, qaStrategist: true })).toEqual({
      label: '2 of 2 required checks complete.',
      open: true,
    });
  });

  it('ignores the tick the other track owns', () => {
    expect(sheetQaGate('static', { ...none, qaVideoEditor: true }).label).toBe(
      '0 of 2 required checks complete.',
    );
    expect(sheetQaGate('static', { ...none, qaDesigner: true, qaStrategist: true }).open).toBe(
      true,
    );
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
  it('lays out the vocabulary in order, empties kept, with a trailing Other column', () => {
    const columns = kanbanColumnsFor('status');
    expect(columns.map((column) => column.key)).toEqual([
      ...CLIENT_STATUS.map((entry) => entry.key),
      '',
    ]);
    expect(columns.at(-1)?.label).toBe(OTHER_COLUMN);
    expect(kanbanColumnsFor('internalStatus')).toHaveLength(INTERNAL_STATUS_OPTIONS.length + 1);
  });

  it('groups a card by the chosen field', () => {
    const item = { internalStatus: 'approved', status: 'launched' };
    expect(kanbanView('internalStatus', item)?.label).toBe('Approved');
    expect(kanbanView('status', item)?.label).toBe('Launched');
    expect(kanbanView('status', { internalStatus: 'approved', status: null })).toBeNull();
  });

  it('lays out the editor board as exactly the three stages, with no Not set column', () => {
    expect(kanbanColumnsFor('editorStage')).toEqual(
      EDITOR_STAGES.map(({ key, label }) => ({ key, label })),
    );
    expect(kanbanColumnsFor('editorStage').some((column) => column.key === '')).toBe(false);
  });

  it('accepts the two sheet statuses and the editor stage as groupable fields', () => {
    expect(isKanbanField('internalStatus')).toBe(true);
    expect(isKanbanField('status')).toBe(true);
    expect(isKanbanField('editorStage')).toBe(true);
    expect(isSheetStatusField('editorStage')).toBe(false);
    expect(isSheetStatusField('status')).toBe(true);
    expect(isKanbanField('winning')).toBe(false);
  });
});

describe('applyKanbanMoves — a dropped card moves at once (SMOKE-10)', () => {
  const cards = [
    { id: 'a', groupValue: 'sent_to_editor_or_designer' },
    { id: 'b', groupValue: 'approved' },
  ];

  it('moves the dropped card to its new column before the server has answered', () => {
    expect(applyKanbanMoves(cards, { a: 'ad_submitted' }).map((c) => [c.id, c.groupValue])).toEqual(
      [
        ['a', 'ad_submitted'],
        ['b', 'approved'],
      ],
    );
  });

  it('leaves the cards untouched with no pending drop, and never mutates its input', () => {
    const before = cards.map((c) => ({ ...c }));
    expect(applyKanbanMoves(cards, {})).toEqual(cards);
    expect(applyKanbanMoves(cards, { a: 'ad_submitted' })).not.toBe(cards);
    expect(cards).toEqual(before);
  });
});

describe('the pending creative (SMOKE-17): shown at submit, replaced by the real row', () => {
  it('is named at SUBMIT time from the preview, under a provisional id', () => {
    expect(pendingOnSubmit('TAS_TOF_V_008_B1')).toEqual({
      id: 'pending:TAS_TOF_V_008_B1',
      name: 'TAS_TOF_V_008_B1',
    });
  });

  it('is dropped once the rows carry its id, and kept while they do not', () => {
    const real = { id: 'real-1', name: 'TAS_TOF_V_008_B1' };
    expect(pendingAfterRows(real, ['other'])).toEqual(real);
    expect(pendingAfterRows(real, ['other', 'real-1'])).toBeNull();
    expect(pendingAfterRows(null, ['real-1'])).toBeNull();
  });
});

describe('the pending creative as a grid row (SMOKE-24)', () => {
  const now = new Date('2026-10-11T09:00:00Z');

  it('is named under the sheet spelling, carries the creative name, and starts both tracks', () => {
    const row = pendingSheetRow(pendingOnSubmit('TAS_TOF_V_008_B1'), now);
    expect(row.item.id).toBe('pending:TAS_TOF_V_008_B1');
    expect(row.item.name).toBe('October-TAS_TOF_V_008_B1');
    expect(row.item.briefName).toBe('TAS_TOF_V_008_B1');
    expect(row.item.internalStatus).toBe(INTERNAL_ENTRY_STATUS);
    expect(row.item.status).toBe(CLIENT_STATUS[0].key);
    expect(row.lookups.proposedCopy).toBeNull();
  });

  it('leads the rows until they carry its id, then steps aside', () => {
    const pendingRow = pendingSheetRow({ id: 'real-1', name: 'TAS_TOF_V_008_B1' }, now);
    const other = pendingSheetRow({ id: 'other', name: 'X' }, now);
    expect(rowsWithPendingCreative(pendingRow, [other]).map(({ item }) => item.id)).toEqual([
      'real-1',
      'other',
    ]);
    expect(rowsWithPendingCreative(pendingRow, [other, pendingRow])).toHaveLength(2);
    expect(rowsWithPendingCreative(null, [other])).toEqual([other]);
  });
});

describe('the Ticket 6 Content fields (migration 0069)', () => {
  it('name the four columns the Content section edits, labelled as the ticket spells them', () => {
    expect(BRIEF_CONTENT_FIELDS.map((field) => field.name)).toEqual([
      'briefText',
      'music',
      'voiceoverType',
      'voiceoverScript',
    ]);
    expect(BRIEF_CONTENT_FIELDS.map((field) => field.label)).toEqual([
      'Brief',
      'Music',
      'Voiceover type',
      'Voiceover script',
    ]);
  });

  it('carry the right field kinds: textarea / plain / single-select / textarea', () => {
    expect(BRIEF_CONTENT_FIELDS.map((field) => field.kind)).toEqual([
      'richtext',
      'text',
      'singleSelect',
      'richtext',
    ]);
  });

  it('offer the three voiceover keys the schema CHECK restricts the column to', () => {
    expect(VOICEOVER_TYPE_OPTIONS.map((option) => option.key)).toEqual(['tts', 'human', 'none']);
    expect(VOICEOVER_TYPE_OPTIONS.map((option) => option.label)).toEqual([
      'Text-to-speech',
      'Human',
      'None',
    ]);
  });

  it('give the Status section a Due label of two characters, so the grid header stays narrow', () => {
    expect(SHEET_DUE_DATE_LABEL).toBe('Due');
  });
});
