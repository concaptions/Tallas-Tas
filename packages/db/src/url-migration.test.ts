import { describe, expect, it } from 'vitest';

import {
  isAirtableUrl,
  isR2Url,
  planMigration,
  replaceInArray,
  summarise,
  type BriefAttachmentRow,
  type CreatorAttachmentRow,
} from './url-migration';

const AIRTABLE = 'https://v5.airtableusercontent.com/v3/u/57/57/1790287200000/abc/def';
const AIRTABLE_DL = 'https://dl.airtable.com/.attachments/abc/def.png';
const R2 = 'https://acct.r2.cloudflarestorage.com/tas/migrated/x/design-1.png';

describe('isAirtableUrl', () => {
  it('matches the Airtable CDN hosts and nothing else', () => {
    expect(isAirtableUrl(AIRTABLE)).toBe(true);
    expect(isAirtableUrl(AIRTABLE_DL)).toBe(true);
    expect(isAirtableUrl(R2)).toBe(false);
    expect(isAirtableUrl('https://example.com/a.png')).toBe(false);
    expect(isAirtableUrl('')).toBe(false);
  });
});

describe('isR2Url', () => {
  it('matches R2 hosts (already migrated)', () => {
    expect(isR2Url(R2)).toBe(true);
    expect(isR2Url('https://cdn.example.r2.dev/uploads/x')).toBe(true);
    expect(isR2Url(AIRTABLE)).toBe(false);
  });
});

describe('replaceInArray', () => {
  it('swaps one URL and preserves order and every other entry', () => {
    expect(replaceInArray(['a', AIRTABLE, 'c'], AIRTABLE, R2)).toEqual(['a', R2, 'c']);
  });

  it('leaves the array unchanged when the URL is absent', () => {
    expect(replaceInArray(['a', 'b'], AIRTABLE, R2)).toEqual(['a', 'b']);
  });
});

function brief(overrides: Partial<BriefAttachmentRow> = {}): BriefAttachmentRow {
  return {
    id: 'brief-1',
    inspirationImage: null,
    qaChecklistDoc: null,
    designFile: null,
    scriptAndBriefBreakdown: null,
    ...overrides,
  };
}

function creator(overrides: Partial<CreatorAttachmentRow> = {}): CreatorAttachmentRow {
  return {
    id: 'creator-1',
    profilePicUrl: null,
    videoIntroUrl: null,
    rawAssetsUrl: null,
    ...overrides,
  };
}

describe('planMigration', () => {
  it('finds every Airtable URL across brief jsonb arrays and creator text columns', () => {
    const items = planMigration(
      [
        brief({ id: 'b1', designFile: [AIRTABLE, R2], qaChecklistDoc: [AIRTABLE_DL] }),
        brief({ id: 'b2', inspirationImage: ['https://example.com/x.png'] }),
      ],
      [creator({ id: 'c1', profilePicUrl: AIRTABLE, videoIntroUrl: R2, rawAssetsUrl: null })],
    );

    expect(items).toEqual([
      { table: 'creative_briefs', rowId: 'b1', field: 'qaChecklistDoc', url: AIRTABLE_DL },
      { table: 'creative_briefs', rowId: 'b1', field: 'designFile', url: AIRTABLE },
      { table: 'creators', rowId: 'c1', field: 'profilePicUrl', url: AIRTABLE },
    ]);
  });

  it('is empty when nothing needs migrating (only R2 or external URLs, idempotent re-run)', () => {
    const items = planMigration(
      [brief({ designFile: [R2] })],
      [creator({ profilePicUrl: R2, videoIntroUrl: null })],
    );
    expect(items).toEqual([]);
  });
});

describe('summarise (the dry-run counts)', () => {
  it('counts URLs, distinct rows, and breaks down by table and field', () => {
    const items = planMigration(
      [brief({ id: 'b1', designFile: [AIRTABLE, AIRTABLE_DL], qaChecklistDoc: [AIRTABLE] })],
      [creator({ id: 'c1', profilePicUrl: AIRTABLE })],
    );

    const summary = summarise(items);

    expect(summary.totalUrls).toBe(4);
    expect(summary.rowsAffected).toBe(2);
    expect(summary.byTable).toEqual({ creative_briefs: 3, creators: 1 });
    expect(summary.byField).toEqual({ designFile: 2, qaChecklistDoc: 1, profilePicUrl: 1 });
  });
});
