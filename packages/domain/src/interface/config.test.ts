import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CONCEPT_FIELDS,
  DEFAULT_INTERFACE_PAGES,
  INTERFACE_ACCESS,
  INTERFACE_PAGE_KEYS,
  accessKey,
  accessTone,
  clientCanEdit,
  defaultInterfaceConfig,
  describeAccess,
  enabledPages,
  findPage,
  isInterfacePageKey,
  togglePage,
  toggleField,
  visibleFields,
  type InterfaceFieldConfig,
  type InterfacePageConfig,
} from './config';

/** A field fixture: the two flags are the whole point, so every test names both. */
function field(
  fieldName: string,
  overrides: Partial<InterfaceFieldConfig> = {},
): InterfaceFieldConfig {
  return {
    fieldName,
    label: fieldName,
    visible: true,
    clientEditable: false,
    position: 0,
    ...overrides,
  };
}

/** `findPage` with the miss turned into a failure, so no assertion here needs a `!`. */
function pageOf<Page extends InterfacePageConfig>(config: readonly Page[], pageKey: string): Page {
  const page = findPage(config, pageKey);
  if (page === undefined) {
    throw new Error(`fixture has no page ${pageKey}`);
  }
  return page;
}

/** Index access under `noUncheckedIndexedAccess`, as a failure rather than an `undefined`. */
function at<Item>(items: readonly Item[], index: number): Item {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`fixture has no item at ${String(index)}`);
  }
  return item;
}

const labelsOf = (fields: readonly InterfaceFieldConfig[]) => fields.map((entry) => entry.label);
const keysOf = (fields: readonly InterfaceFieldConfig[]) => fields.map((entry) => entry.fieldName);

const CONCEPT_LABELS = [
  'Batch',
  'Category',
  'Concept name',
  'Concept Style',
  'Angle',
  'Theme',
  'Product',
  'Description (hypothesis)',
  'Pain Points',
  'USP',
  'Persona',
  'Hook examples',
];

const EDITABLE_BY_PRD = [
  'creatives.client_status',
  'creatives.client_comments',
  'copywriting.client_status',
  'copywriting.client_comment',
  'ugc.client_status',
  'ugc.client_note',
  'ugc.tracking_number',
];

describe('INTERFACE_PAGE_KEYS', () => {
  it('is the `interfacePageKeys` tuple of `@tas/db`, verbatim and in PRD §10 order', () => {
    expect(INTERFACE_PAGE_KEYS).toEqual([
      'concepts',
      'creatives',
      'copywriting',
      'ugc',
      'partnership',
    ]);
  });

  it('guards the vocabulary', () => {
    expect(isInterfacePageKey('ugc')).toBe(true);
    expect(isInterfacePageKey('UGC')).toBe(false);
    expect(isInterfacePageKey('briefs')).toBe(false);
    expect(isInterfacePageKey('')).toBe(false);
  });
});

describe('DEFAULT_INTERFACE_PAGES', () => {
  it("is PRD §10's five pages, in order, with the PRD's own titles", () => {
    expect(DEFAULT_INTERFACE_PAGES.map((page) => page.pageKey)).toEqual([
      'concepts',
      'creatives',
      'copywriting',
      'ugc',
      'partnership',
    ]);
    expect(DEFAULT_INTERFACE_PAGES.map((page) => page.label)).toEqual([
      'Concepts',
      'Creatives',
      'Copywriting',
      'UGC Management',
      'Partnership Ads Tracking',
    ]);
  });

  it('carries one page per key, and no emoji in a label', () => {
    expect(DEFAULT_INTERFACE_PAGES).toHaveLength(INTERFACE_PAGE_KEYS.length);
    for (const page of DEFAULT_INTERFACE_PAGES) {
      expect(page.label).toMatch(/^[A-Za-z ]+$/);
    }
  });

  it("lists the concept card's twelve fields in the PRD's order", () => {
    expect(DEFAULT_CONCEPT_FIELDS.map((entry) => entry.label)).toEqual(CONCEPT_LABELS);
    expect(DEFAULT_CONCEPT_FIELDS.map((entry) => entry.fieldName)).toEqual([
      'batch',
      'category',
      'concept_name',
      'concept_style',
      'angle',
      'theme',
      'product',
      'description',
      'pain_points',
      'usp',
      'persona',
      'hook_examples',
    ]);
  });

  it('keys every field in snake_case storage vocabulary, never the label', () => {
    for (const page of DEFAULT_INTERFACE_PAGES) {
      for (const entry of page.fields) {
        expect(entry.fieldName).toMatch(/^[a-z][a-z0-9_]*$/);
      }
    }
  });

  it('gives the four short pages the columns the client actually touches', () => {
    const fieldsOf = (pageKey: string) =>
      DEFAULT_INTERFACE_PAGES.find((page) => page.pageKey === pageKey)?.fields.map(
        (entry) => entry.fieldName,
      );

    expect(fieldsOf('creatives')).toEqual(['client_status', 'client_comments']);
    expect(fieldsOf('copywriting')).toEqual(['client_status', 'client_comment']);
    expect(fieldsOf('ugc')).toEqual(['client_status', 'client_note', 'tracking_number']);
    expect(fieldsOf('partnership')).toEqual([
      'creator_name',
      'instagram_username',
      'partnership_activity',
      'partnership_expires_on',
    ]);
  });

  it("keeps every internal money column off the client's partnership page", () => {
    const partnership = DEFAULT_INTERFACE_PAGES.find((page) => page.pageKey === 'partnership');
    expect(partnership?.fields.length).toBe(4);
    for (const entry of partnership?.fields ?? []) {
      expect(entry.fieldName).not.toMatch(/price|cost|amount|paid|budget/);
      expect(entry.clientEditable).toBe(false);
    }
  });
});

describe('defaultInterfaceConfig', () => {
  it('enables every page and every field, in PRD order, with dense 0-based positions', () => {
    const config = defaultInterfaceConfig();

    expect(config.map((page) => page.pageKey)).toEqual([...INTERFACE_PAGE_KEYS]);
    expect(config.map((page) => page.position)).toEqual([0, 1, 2, 3, 4]);
    for (const page of config) {
      expect(page.enabled).toBe(true);
      expect(page.fields.map((entry) => entry.position)).toEqual(
        page.fields.map((_entry, index) => index),
      );
      for (const entry of page.fields) {
        expect(entry.visible).toBe(true);
      }
    }
  });

  it('seeds the concept card with twelve visible fields, all read-only', () => {
    const concepts = pageOf(defaultInterfaceConfig(), 'concepts');

    expect(concepts.fields).toHaveLength(12);
    expect(labelsOf(visibleFields(concepts))).toEqual(CONCEPT_LABELS);
    expect(concepts.fields.some((entry) => entry.clientEditable)).toBe(false);
  });

  it("marks editable exactly the fields PRD §10's table grants", () => {
    const editable = defaultInterfaceConfig().flatMap((page) =>
      page.fields
        .filter((entry) => entry.clientEditable)
        .map((entry) => `${page.pageKey}.${entry.fieldName}`),
    );

    expect(editable).toEqual(EDITABLE_BY_PRD);
  });

  it('builds a fresh configuration every call, so a toggled copy cannot reach the defaults', () => {
    const first = defaultInterfaceConfig();
    const second = defaultInterfaceConfig();

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(at(first, 0)).not.toBe(at(second, 0));
    expect(at(at(first, 0).fields, 0)).not.toBe(at(at(second, 0).fields, 0));

    const toggled = toggleField(first, 'concepts', 'hook_examples');
    expect(at(pageOf(toggled, 'concepts').fields, 11).visible).toBe(false);
    expect(at(pageOf(defaultInterfaceConfig(), 'concepts').fields, 11).visible).toBe(true);
  });
});

describe('visibleFields', () => {
  it('drops the fields switched off and keeps the rest in position order', () => {
    const page: InterfacePageConfig = {
      pageKey: 'concepts',
      label: 'Concepts',
      enabled: true,
      position: 0,
      fields: [
        field('angle', { position: 1 }),
        field('batch', { position: 0 }),
        field('usp', { position: 2, visible: false }),
      ],
    };

    expect(keysOf(visibleFields(page))).toEqual(['batch', 'angle']);
  });

  it('returns nothing at all for a page switched off, however its fields are flagged', () => {
    const page: InterfacePageConfig = {
      pageKey: 'copywriting',
      label: 'Copywriting',
      enabled: false,
      position: 2,
      fields: [field('client_status'), field('client_comment', { clientEditable: true })],
    };

    expect(visibleFields(page)).toEqual([]);
    // The flags themselves are untouched: switching the page back on restores this exact set.
    expect(page.fields.every((entry) => entry.visible)).toBe(true);
  });

  it("never sorts the caller's array in place", () => {
    const fields = [field('angle', { position: 1 }), field('batch', { position: 0 })];
    const page: InterfacePageConfig = {
      pageKey: 'concepts',
      label: 'Concepts',
      enabled: true,
      position: 0,
      fields,
    };

    visibleFields(page);
    expect(keysOf(fields)).toEqual(['angle', 'batch']);
  });

  it('is empty for a page with no fields', () => {
    expect(
      visibleFields({
        pageKey: 'partnership',
        label: 'Partnership Ads Tracking',
        enabled: true,
        position: 4,
        fields: [],
      }),
    ).toEqual([]);
  });
});

describe('enabledPages', () => {
  it('is the tab strip: enabled pages only, in position order', () => {
    const config = togglePage(defaultInterfaceConfig(), 'copywriting');

    expect(enabledPages(config).map((page) => page.label)).toEqual([
      'Concepts',
      'Creatives',
      'UGC Management',
      'Partnership Ads Tracking',
    ]);
  });

  it("sorts a copy and leaves the caller's order alone", () => {
    const config = [...defaultInterfaceConfig()].reverse();

    expect(enabledPages(config).map((page) => page.pageKey)).toEqual([...INTERFACE_PAGE_KEYS]);
    expect(at(config, 0).pageKey).toBe('partnership');
  });

  it('is empty when every page is off', () => {
    const config = INTERFACE_PAGE_KEYS.reduce<readonly InterfacePageConfig[]>(
      (accumulator, pageKey) => togglePage(accumulator, pageKey),
      defaultInterfaceConfig(),
    );

    expect(enabledPages(config)).toEqual([]);
  });
});

describe('findPage', () => {
  it('finds a page by key and misses an unknown one without throwing', () => {
    const config = defaultInterfaceConfig();

    expect(findPage(config, 'ugc')?.label).toBe('UGC Management');
    expect(findPage(config, 'briefs')).toBeUndefined();
  });
});

describe('toggleField', () => {
  it('flips one field and returns a new configuration, mutating nothing', () => {
    const config = defaultInterfaceConfig();
    const toggled = toggleField(config, 'concepts', 'hook_examples');

    expect(at(pageOf(config, 'concepts').fields, 11).visible).toBe(true);
    expect(at(pageOf(toggled, 'concepts').fields, 11).visible).toBe(false);
    expect(toggled).not.toBe(config);
    expect(pageOf(toggled, 'concepts')).not.toBe(pageOf(config, 'concepts'));
    // Untouched pages are carried through by reference: the preview re-renders one card, not five.
    expect(pageOf(toggled, 'creatives')).toBe(pageOf(config, 'creatives'));
  });

  it('removes the field from the preview and restores it in its seeded order', () => {
    const config = defaultInterfaceConfig();
    const off = toggleField(config, 'concepts', 'hook_examples');
    const on = toggleField(off, 'concepts', 'hook_examples');

    expect(labelsOf(visibleFields(pageOf(off, 'concepts')))).not.toContain('Hook examples');
    expect(visibleFields(pageOf(off, 'concepts'))).toHaveLength(11);
    expect(labelsOf(visibleFields(pageOf(on, 'concepts')))).toEqual(CONCEPT_LABELS);
  });

  it('toggles the field of ONE page, never the same key on the others', () => {
    const config = defaultInterfaceConfig();
    const toggled = toggleField(config, 'copywriting', 'client_status');

    expect(at(pageOf(toggled, 'copywriting').fields, 0).visible).toBe(false);
    expect(at(pageOf(toggled, 'creatives').fields, 0).visible).toBe(true);
    expect(at(pageOf(toggled, 'ugc').fields, 0).visible).toBe(true);
  });

  it('leaves the configuration alone for an unknown page or field', () => {
    const config = defaultInterfaceConfig();

    expect(toggleField(config, 'briefs', 'batch')).toEqual(config);
    expect(toggleField(config, 'concepts', 'nonexistent')).toEqual(config);
    // `client_status` exists — on three other pages, never on the concept card.
    expect(toggleField(config, 'concepts', 'client_status')).toEqual(config);
    expect(at(toggleField(config, 'concepts', 'nonexistent'), 0)).toBe(at(config, 0));
  });

  it('keeps every other column of a row it touched', () => {
    const row = {
      id: 'row-1',
      brandId: 'brand-1',
      pageKey: 'concepts' as const,
      label: 'Concepts',
      enabled: true,
      position: 0,
      fields: [{ ...field('batch'), id: 'field-1' }],
    };

    const toggled = at(toggleField([row], 'concepts', 'batch'), 0);
    expect(toggled.id).toBe('row-1');
    expect(toggled.brandId).toBe('brand-1');
    expect(at(toggled.fields, 0).id).toBe('field-1');
    expect(at(toggled.fields, 0).visible).toBe(false);
    // The input row is untouched.
    expect(at(row.fields, 0).visible).toBe(true);
  });
});

describe('togglePage', () => {
  it('flips one page and returns a new configuration, mutating nothing', () => {
    const config = defaultInterfaceConfig();
    const toggled = togglePage(config, 'copywriting');

    expect(pageOf(config, 'copywriting').enabled).toBe(true);
    expect(pageOf(toggled, 'copywriting').enabled).toBe(false);
    expect(toggled).not.toBe(config);
    expect(pageOf(toggled, 'concepts')).toBe(pageOf(config, 'concepts'));
  });

  it('hides every field of the page it switched off without changing one flag', () => {
    const config = toggleField(defaultInterfaceConfig(), 'concepts', 'usp');
    const off = togglePage(config, 'concepts');

    expect(visibleFields(pageOf(off, 'concepts'))).toEqual([]);
    expect(pageOf(off, 'concepts').fields).toHaveLength(12);
    expect(pageOf(off, 'concepts').fields.filter((entry) => entry.visible)).toHaveLength(11);
  });

  it('restores exactly the previous field set when the page comes back on', () => {
    const config = toggleField(defaultInterfaceConfig(), 'concepts', 'usp');
    const roundTrip = togglePage(togglePage(config, 'concepts'), 'concepts');

    expect(roundTrip).toEqual(config);
    expect(keysOf(visibleFields(pageOf(roundTrip, 'concepts')))).toEqual(
      keysOf(visibleFields(pageOf(config, 'concepts'))),
    );
    expect(keysOf(visibleFields(pageOf(roundTrip, 'concepts')))).not.toContain('usp');
  });

  it('leaves the configuration alone for an unknown page', () => {
    const config = defaultInterfaceConfig();

    expect(togglePage(config, 'briefs')).toEqual(config);
    expect(at(togglePage(config, 'briefs'), 0)).toBe(at(config, 0));
  });

  it('keeps every other column of the row it flipped', () => {
    const row = {
      id: 'row-1',
      pageKey: 'ugc' as const,
      label: 'UGC Management',
      enabled: true,
      position: 3,
      fields: [field('client_note', { clientEditable: true })],
    };

    const toggled = at(togglePage([row], 'ugc'), 0);
    expect(toggled.id).toBe('row-1');
    expect(toggled.enabled).toBe(false);
    expect(at(toggled.fields, 0).clientEditable).toBe(true);
    expect(row.enabled).toBe(true);
  });
});

describe('clientCanEdit', () => {
  it('needs both axes, in that order', () => {
    expect(clientCanEdit(field('client_status', { visible: true, clientEditable: true }))).toBe(
      true,
    );
    expect(clientCanEdit(field('client_status', { visible: true, clientEditable: false }))).toBe(
      false,
    );
    expect(clientCanEdit(field('client_status', { visible: false, clientEditable: true }))).toBe(
      false,
    );
    expect(clientCanEdit(field('client_status', { visible: false, clientEditable: false }))).toBe(
      false,
    );
  });

  it('grants nothing on the concept card, whatever the page shows', () => {
    for (const entry of visibleFields(pageOf(defaultInterfaceConfig(), 'concepts'))) {
      expect(clientCanEdit(entry)).toBe(false);
    }
  });

  it('grants the seven fields §10 grants, and only those', () => {
    const granted = defaultInterfaceConfig().flatMap((page) =>
      visibleFields(page)
        .filter((entry) => clientCanEdit(entry))
        .map((entry) => `${page.pageKey}.${entry.fieldName}`),
    );

    expect(granted).toEqual(EDITABLE_BY_PRD);
  });

  it('grants nothing on a page that is switched off', () => {
    const config = togglePage(defaultInterfaceConfig(), 'ugc');
    const granted = visibleFields(pageOf(config, 'ugc')).filter((entry) => clientCanEdit(entry));

    expect(granted).toEqual([]);
    // The field itself still says it is editable; the page gate is what closed it.
    expect(at(pageOf(config, 'ugc').fields, 0).clientEditable).toBe(true);
  });
});

describe('describeAccess', () => {
  it('is one of three phrases, one per branch', () => {
    expect(describeAccess(field('a', { visible: true, clientEditable: true }))).toBe(
      'Client can edit',
    );
    expect(describeAccess(field('a', { visible: true, clientEditable: false }))).toBe(
      'Client sees it',
    );
    expect(describeAccess(field('a', { visible: false, clientEditable: false }))).toBe(
      'Hidden from the client',
    );
    expect(describeAccess(field('a', { visible: false, clientEditable: true }))).toBe(
      'Hidden from the client',
    );
  });

  it('agrees with `clientCanEdit` on every combination of the two flags', () => {
    for (const visible of [true, false]) {
      for (const clientEditable of [true, false]) {
        const entry = field('a', { visible, clientEditable });
        expect(describeAccess(entry) === 'Client can edit').toBe(clientCanEdit(entry));
      }
    }
  });

  it('keys the three branches and tones them from the shared chip vocabulary', () => {
    expect(accessKey(field('a', { visible: true, clientEditable: true }))).toBe('edit');
    expect(accessKey(field('a', { visible: true }))).toBe('read');
    expect(accessKey(field('a', { visible: false }))).toBe('hidden');

    expect(accessTone(field('a', { visible: true, clientEditable: true }))).toBe('accent');
    expect(accessTone(field('a', { visible: true }))).toBe('info');
    expect(accessTone(field('a', { visible: false }))).toBe('mute');

    for (const entry of INTERFACE_ACCESS) {
      expect(['ok', 'warn', 'bad', 'info', 'accent', 'mute']).toContain(entry.tone);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it('carries one entry per branch and no duplicate key', () => {
    expect(INTERFACE_ACCESS.map((entry) => entry.key)).toEqual(['edit', 'read', 'hidden']);
  });
});
