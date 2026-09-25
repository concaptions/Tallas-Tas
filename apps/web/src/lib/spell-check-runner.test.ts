import type { Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  spellCheck: vi.fn(),
  updateBrief: vi.fn(),
}));

vi.mock('./spell-check', () => ({ spellCheck: mocks.spellCheck }));

vi.mock('@tas/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tas/db')>()),
  updateBrief: mocks.updateBrief,
}));

import {
  briefSpellCheckText,
  checkSpellingForBrief,
  hasNewDesignFile,
  maybeSpellCheckDesignFile,
} from './spell-check-runner';

const DB = {} as unknown as Db;
const BRAND = 'brand-1';
const ACTOR = 'user_designer';

function brief(
  overrides: Partial<{
    scriptContent: string | null;
    briefToDesign: string | null;
    designFile: string[] | null;
  }> = {},
) {
  return {
    id: '77777777-7777-4777-8777-000000000001',
    scriptContent: 'Sleep better tonight.',
    briefToDesign: 'Hero shot of the blanket.',
    designFile: ['https://r2/uploads/new-design.png'],
    ...overrides,
  };
}

afterEach(() => {
  mocks.spellCheck.mockReset();
  mocks.updateBrief.mockReset();
});

describe('hasNewDesignFile', () => {
  it('is true when a URL appears that was not there before', () => {
    expect(hasNewDesignFile([], ['a'])).toBe(true);
    expect(hasNewDesignFile(['a'], ['a', 'b'])).toBe(true);
    expect(hasNewDesignFile(null, ['a'])).toBe(true);
  });

  it('is false for a resubmit of the same files, a removal, or nothing', () => {
    expect(hasNewDesignFile(['a'], ['a'])).toBe(false);
    expect(hasNewDesignFile(['a', 'b'], ['a'])).toBe(false);
    expect(hasNewDesignFile(['a'], null)).toBe(false);
    expect(hasNewDesignFile(null, null)).toBe(false);
  });
});

describe('briefSpellCheckText', () => {
  it('joins the script and brief-to-design, dropping blank parts', () => {
    expect(briefSpellCheckText(brief({ scriptContent: 'A', briefToDesign: 'B' }))).toBe('A\n\nB');
    expect(briefSpellCheckText(brief({ scriptContent: null, briefToDesign: 'B' }))).toBe('B');
    expect(briefSpellCheckText(brief({ scriptContent: '', briefToDesign: null }))).toBe('');
  });
});

describe('checkSpellingForBrief', () => {
  it('stores the feedback when the check ran, overwriting any previous result', async () => {
    mocks.spellCheck.mockResolvedValue({
      ok: true,
      feedback: 'Inconsistent hyphenation: day-time',
    });

    const result = await checkSpellingForBrief(DB, BRAND, brief(), ACTOR);

    expect(result).toEqual({ ok: true, feedback: 'Inconsistent hyphenation: day-time' });
    expect(mocks.updateBrief).toHaveBeenCalledOnce();
    const call = mocks.updateBrief.mock.calls[0];
    expect(call?.[3]).toEqual({ spellingFeedback: 'Inconsistent hyphenation: day-time' });
  });

  it('writes nothing when the checker could not run (e.g. no API key)', async () => {
    mocks.spellCheck.mockResolvedValue({
      ok: false,
      error: 'ANTHROPIC_API_KEY is not configured.',
    });

    const result = await checkSpellingForBrief(DB, BRAND, brief(), ACTOR);

    expect(result).toEqual({ ok: false, error: 'ANTHROPIC_API_KEY is not configured.' });
    expect(mocks.updateBrief).not.toHaveBeenCalled();
  });
});

describe('maybeSpellCheckDesignFile (the Design File auto-fire)', () => {
  const base = {
    db: DB,
    brandId: BRAND,
    actorId: ACTOR,
    brief: brief(),
    previousDesignFile: [] as string[],
    demo: false,
  };

  it('fires and stores feedback when a new design file was uploaded', async () => {
    mocks.spellCheck.mockResolvedValue({ ok: true, feedback: 'No issues found.' });

    const result = await maybeSpellCheckDesignFile(base);

    expect(result).toEqual({ ok: true, feedback: 'No issues found.' });
    expect(mocks.spellCheck).toHaveBeenCalledOnce();
    expect(mocks.updateBrief).toHaveBeenCalledOnce();
  });

  it('does NOT fire when the design file is unchanged (a resubmit or another-field edit)', async () => {
    const result = await maybeSpellCheckDesignFile({
      ...base,
      previousDesignFile: ['https://r2/uploads/new-design.png'],
    });

    expect(result).toBeNull();
    expect(mocks.spellCheck).not.toHaveBeenCalled();
    expect(mocks.updateBrief).not.toHaveBeenCalled();
  });

  it('skips silently, without error or write, when ANTHROPIC_API_KEY is missing', async () => {
    mocks.spellCheck.mockResolvedValue({
      ok: false,
      error: 'ANTHROPIC_API_KEY is not configured.',
    });

    const result = await maybeSpellCheckDesignFile(base);

    expect(result).toEqual({ ok: false, error: 'ANTHROPIC_API_KEY is not configured.' });
    expect(mocks.updateBrief).not.toHaveBeenCalled();
  });

  it('does NOT fire in demo mode, even with a new design file', async () => {
    const result = await maybeSpellCheckDesignFile({ ...base, demo: true });

    expect(result).toBeNull();
    expect(mocks.spellCheck).not.toHaveBeenCalled();
    expect(mocks.updateBrief).not.toHaveBeenCalled();
  });
});
