import { describe, expect, it } from 'vitest';

import {
  applyUserView,
  defaultUserViewConfig,
  freezeUpTo,
  frozenUpTo,
  isViewFieldVisible,
  reconcileViewFields,
  parseUserViewConfig,
  toggleViewField,
  USER_VIEW_NAME_MAX,
  validateUserViewName,
} from './user-views';

const FIELDS: readonly { readonly key: string; readonly frozen?: boolean }[] = [
  { key: 'name', frozen: true },
  { key: 'status' },
  { key: 'notes' },
  { key: 'updated' },
];

describe('validateUserViewName', () => {
  it('trims and accepts a short name', () => {
    expect(validateUserViewName('  My queue ')).toEqual({
      ok: true,
      name: 'My queue',
      error: null,
    });
  });

  it('refuses an empty name and one past the limit, in words', () => {
    expect(validateUserViewName('   ').ok).toBe(false);
    expect(validateUserViewName('x'.repeat(USER_VIEW_NAME_MAX + 1)).error).toMatch(/under/);
  });
});

describe('applyUserView', () => {
  it('shows everything in table order under the default config', () => {
    expect(applyUserView(FIELDS, defaultUserViewConfig()).map((f) => f.key)).toEqual([
      'name',
      'status',
      'notes',
      'updated',
    ]);
  });

  it('orders the listed keys first, drops unknown keys and appends the rest', () => {
    const view = { ...defaultUserViewConfig(), fieldOrder: ['updated', 'ghost', 'name'] };
    expect(applyUserView(FIELDS, view).map((f) => f.key)).toEqual([
      'updated',
      'name',
      'status',
      'notes',
    ]);
  });

  it('hides fields outside visibleFields and keeps the table default freeze', () => {
    const view = { ...defaultUserViewConfig(), visibleFields: ['name', 'notes'] };
    const shown = applyUserView(FIELDS, view);
    expect(shown.map((f) => f.key)).toEqual(['name', 'notes']);
    expect(shown[0]?.frozen).toBe(true);
  });

  it('a non-empty frozenFields replaces the table freeze', () => {
    const view = { ...defaultUserViewConfig(), frozenFields: ['status'] };
    const shown = applyUserView(FIELDS, view);
    expect(shown.find((f) => f.key === 'name')?.frozen).toBe(false);
    expect(shown.find((f) => f.key === 'status')?.frozen).toBe(true);
  });

  it('never hides every column: an all-hidden view keeps the first one', () => {
    const view = { ...defaultUserViewConfig(), visibleFields: [] };
    expect(applyUserView(FIELDS, view).map((f) => f.key)).toEqual(['name']);
  });
});

describe('toggleViewField / isViewFieldVisible', () => {
  const all = FIELDS.map((f) => f.key);

  it('turns "everything" into an explicit list minus the toggled key', () => {
    expect(toggleViewField(defaultUserViewConfig(), 'notes', all)).toEqual([
      'name',
      'status',
      'updated',
    ]);
  });

  it('shows a hidden key again', () => {
    expect(toggleViewField({ visibleFields: ['name'] }, 'notes', all)).toEqual(['name', 'notes']);
  });

  it('reads visibility the same way', () => {
    expect(isViewFieldVisible(defaultUserViewConfig(), 'notes')).toBe(true);
    expect(isViewFieldVisible({ visibleFields: ['name'] }, 'notes')).toBe(false);
  });
});

describe('parseUserViewConfig', () => {
  it('narrows a stored row field by field and falls back on junk', () => {
    expect(
      parseUserViewConfig({
        viewType: 'gallery',
        visibleFields: ['a', 1, null],
        fieldOrder: 'nope',
        frozenFields: undefined,
        sort: { key: 'name', direction: 'desc' },
        filter: 42,
        coverField: 7,
      }),
    ).toEqual({
      viewType: 'gallery',
      visibleFields: ['a'],
      fieldOrder: [],
      frozenFields: [],
      sort: { key: 'name', direction: 'desc' },
      filter: '',
      coverField: null,
    });
    expect(parseUserViewConfig({ viewType: 'bogus', sort: { key: 'x' } }).viewType).toBe('grid');
    expect(parseUserViewConfig({ viewType: 'bogus' }).sort).toBeNull();
    expect(parseUserViewConfig({}).visibleFields).toBeNull();
  });

  it('keeps a stored cover column and reads an empty string as the page default', () => {
    // Action item 16. A row written before the cover existed has no `cover_field` at all, and must
    // read as "the page's own cover" — never as a cover key of `''`, which no column has.
    expect(parseUserViewConfig({ coverField: 'video_intro_url' }).coverField).toBe(
      'video_intro_url',
    );
    expect(parseUserViewConfig({ coverField: '' }).coverField).toBeNull();
    expect(parseUserViewConfig({}).coverField).toBeNull();
    expect(defaultUserViewConfig().coverField).toBeNull();
  });
});

/**
 * The namespace change the column resolver brought: a grid's keys were the module's camelCase field
 * names and are now Postgres column keys. A view saved before it would otherwise hide every column,
 * because `isViewFieldVisible` reads "absent from the list" as hidden.
 */
describe('reconcileViewFields', () => {
  const PERSONA_KEYS = [
    'name',
    'day_in_the_life',
    'demographic',
    'psychographic',
    'core_desires',
    'angle_personas',
  ];

  it('keeps a key the table still has, untouched', () => {
    expect(reconcileViewFields(['name', 'demographic'], PERSONA_KEYS)).toEqual([
      'name',
      'demographic',
    ]);
  });

  it('matches a camelCase key to the snake_case column it became', () => {
    expect(reconcileViewFields(['name', 'dayInTheLife', 'coreDesires'], PERSONA_KEYS)).toEqual([
      'name',
      'day_in_the_life',
      'core_desires',
    ]);
  });

  it('drops a key whose column is gone, keeping the rest of the choice', () => {
    // `updated` was removed from every grid; `product` is not a persona column.
    expect(reconcileViewFields(['name', 'updated', 'product'], PERSONA_KEYS)).toEqual(['name']);
  });

  /**
   * The row this was written for: a production view listing all seventeen pre-resolver persona
   * keys. Reconciled it shows the columns the table has, instead of a blank grid.
   */
  it('reconciles the real production view rather than hiding everything', () => {
    const stored = [
      'name',
      'product',
      'angles',
      'buyingTriggers',
      'emotionalTriggers',
      'triggerWords',
      'updated',
      'stageOfAwareness',
      'dayInTheLife',
      'psychographic',
      'demographic',
      'coreDesires',
      'successFactors',
      'successTransformation',
      'painPoints',
      'perceivedBarriers',
      'problemChallenge',
    ];

    const reconciled = reconcileViewFields(stored, PERSONA_KEYS);

    // The person's own order is preserved; only the spelling of a key changes.
    expect(reconciled).toEqual([
      'name',
      'day_in_the_life',
      'psychographic',
      'demographic',
      'core_desires',
    ]);
    // `angles` is NOT among them: the column is `angle_personas`, which no spelling rule derives
    // from `angles`, so it is dropped rather than guessed at.
    expect(reconciled).not.toContain('angle_personas');
    for (const key of PERSONA_KEYS) {
      expect(isViewFieldVisible({ visibleFields: reconciled }, key)).toBe(
        reconciled?.includes(key) ?? true,
      );
    }
  });

  it('turns a list that resolves to nothing into "show everything", never "hide everything"', () => {
    expect(reconcileViewFields(['gone', 'alsoGone'], PERSONA_KEYS)).toBeNull();
    expect(isViewFieldVisible({ visibleFields: null }, 'name')).toBe(true);
  });

  it('leaves an EMPTY list alone: hiding every column is a real choice, not staleness', () => {
    expect(reconcileViewFields([], PERSONA_KEYS)).toEqual([]);
    expect(isViewFieldVisible({ visibleFields: [] }, 'name')).toBe(false);
  });

  it('passes null through, and never duplicates a key two spellings both reach', () => {
    expect(reconcileViewFields(null, PERSONA_KEYS)).toBeNull();
    expect(reconcileViewFields(['core_desires', 'coreDesires'], PERSONA_KEYS)).toEqual([
      'core_desires',
    ]);
  });
});

describe('freezeUpTo', () => {
  const KEYS = ['name', 'batch', 'theme', 'status'];

  it('freezes the chosen column and everything to its left', () => {
    expect(freezeUpTo(KEYS, 'theme')).toEqual(['name', 'batch', 'theme']);
  });

  it('freezes only the first column when the first is chosen', () => {
    expect(freezeUpTo(KEYS, 'name')).toEqual(['name']);
  });

  it('returns the table default (an empty list) for null, never "nothing frozen"', () => {
    // applyUserView reads [] as "keep the table's own freeze", which is the one column that is
    // always worth pinning. A freeze control must be able to hand that state back.
    expect(freezeUpTo(KEYS, null)).toEqual([]);
  });

  it('returns the table default for a key the view does not show', () => {
    expect(freezeUpTo(KEYS, 'gone')).toEqual([]);
  });

  it('is a prefix of the ORDER IT IS GIVEN, so a reordered view freezes what the viewer sees', () => {
    expect(freezeUpTo(['status', 'name'], 'name')).toEqual(['status', 'name']);
  });
});

describe('frozenUpTo', () => {
  const KEYS = ['name', 'batch', 'theme', 'status'];

  it('is null while the table default is in force', () => {
    expect(frozenUpTo(KEYS, { frozenFields: [] })).toBeNull();
  });

  it('names the last frozen column in the view order', () => {
    expect(frozenUpTo(KEYS, { frozenFields: ['name', 'batch'] })).toBe('batch');
  });

  it('round-trips with freezeUpTo', () => {
    expect(frozenUpTo(KEYS, { frozenFields: freezeUpTo(KEYS, 'theme') })).toBe('theme');
  });

  it('resolves a stored set that is not a clean prefix to its rightmost member', () => {
    expect(frozenUpTo(KEYS, { frozenFields: ['theme'] })).toBe('theme');
  });

  it('ignores a frozen key the table no longer has', () => {
    expect(frozenUpTo(KEYS, { frozenFields: ['gone'] })).toBeNull();
  });
});
