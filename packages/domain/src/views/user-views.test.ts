import { describe, expect, it } from 'vitest';

import {
  applyUserView,
  defaultUserViewConfig,
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
      }),
    ).toEqual({
      viewType: 'gallery',
      visibleFields: ['a'],
      fieldOrder: [],
      frozenFields: [],
      sort: { key: 'name', direction: 'desc' },
      filter: '',
    });
    expect(parseUserViewConfig({ viewType: 'bogus', sort: { key: 'x' } }).viewType).toBe('grid');
    expect(parseUserViewConfig({ viewType: 'bogus' }).sort).toBeNull();
    expect(parseUserViewConfig({}).visibleFields).toBeNull();
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
