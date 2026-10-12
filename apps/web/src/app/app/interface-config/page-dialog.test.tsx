import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { PageForm, pageHasStructure, toKebab } from './page-dialog';
import type { PageListItem } from './page-list-item';

vi.mock('./custom-page-actions', () => ({ createCustomPageAction: vi.fn() }));
vi.mock('./page-actions', () => ({ editPageAction: vi.fn() }));

/**
 * The one page form (2026-10-12), rendered statically (a dialog's content lives in a portal). In
 * edit mode it is PRE-FILLED from the row: title, slug (read-only), visibility, and — for a custom
 * or module page — the filter and the column picks; a standard tab gets no structure fields. In
 * create mode it offers the source table.
 */
const COLUMNS = {
  creative_briefs: [
    { columnKey: 'name', displayLabel: 'Name' },
    { columnKey: 'client_status', displayLabel: 'Client Approval' },
  ],
  creators: [],
  copywriting: [],
  concepts: [],
  collections: [],
  products: [],
} as const;

const standard: PageListItem = {
  id: 'cal',
  slug: 'calendar',
  title: 'Calendar',
  kind: 'standard',
  isVisible: false,
  overridden: true,
  isTemplate: true,
  sourceTableKey: 'campaigns_offers',
  filterConfig: {},
  columnConfig: [],
};

const custom: PageListItem = {
  id: 'w',
  slug: 'winners',
  title: 'Winners',
  kind: 'custom',
  isVisible: true,
  overridden: false,
  isTemplate: false,
  sourceTableKey: 'creative_briefs',
  filterConfig: { column: 'client_status', op: 'is', value: 'approved' },
  columnConfig: [{ columnKey: 'client_status', displayLabel: 'Client Approval', displayOrder: 0 }],
};

const form = (page: PageListItem | null) =>
  renderToStaticMarkup(<PageForm page={page} resolverColumnsByTable={COLUMNS} />);

describe('PageForm', () => {
  it('pre-fills a standard tab: title, read-only slug, visibility; no source, filter or columns', () => {
    const markup = form(standard);
    expect(markup).toContain('data-editing="true"');
    expect(markup).toMatch(/name="title"[^>]*value="Calendar"/);
    expect(markup).toMatch(/<input[^>]*readonly[^>]*name="slug"/i);
    const visibleSwitch = /<button[^>]*role="switch"[^>]*>/.exec(markup)?.[0] ?? '';
    expect(visibleSwitch).toContain('data-slot="page-form-visible"');
    expect(visibleSwitch).toContain('aria-checked="false"');
    expect(markup).not.toContain('data-slot="source-select"');
    expect(markup).not.toContain('data-slot="column-pick"');
    expect(markup).not.toContain('data-slot="filter-op-select"');
  });

  it('pre-fills a custom view with its filter value and its column picks ticked', () => {
    const markup = form(custom);
    expect(markup).toMatch(/name="title"[^>]*value="Winners"/);
    expect(markup).toContain('data-slot="filter-value"');
    expect(markup).toMatch(/data-slot="filter-value"[^>]*value="approved"/);
    expect(markup).toMatch(/data-column-key="client_status"[^>]*checked/);
    expect(markup).not.toMatch(/data-column-key="name"[^>]*checked/);
    expect(markup).not.toContain('data-slot="source-select"');
  });

  it('starts empty in create mode and offers the source table', () => {
    const markup = form(null);
    expect(markup).toContain('data-editing="false"');
    expect(markup).toMatch(/name="title"[^>]*value=""/);
    expect(markup).toContain('data-slot="source-select"');
    expect(markup).toContain('data-slot="column-pick"');
  });

  it('knows which pages carry structure, and kebab-cases a typed title', () => {
    expect(pageHasStructure(standard)).toBe(false);
    expect(pageHasStructure(custom)).toBe(true);
    expect(pageHasStructure({ ...custom, kind: 'module' })).toBe(true);
    expect(toKebab('Top Ads  2026!')).toBe('top-ads-2026');
  });
});

/**
 * Part A (2026-10-12): the Columns section lists the client-visible columns of the page's table,
 * each with a checkbox, a label input pre-filled with the page's own label (the resolver's for an
 * unpicked column) and up/down buttons; picked columns come first, in the page's order.
 */
describe('PageForm — Columns', () => {
  it('pre-fills picked columns first with their labels, then the rest unticked', () => {
    const markup = form(custom);
    const rows = [...markup.matchAll(/data-slot="column-row" data-column-key="([a-z_]+)"/g)].map(
      (m) => m[1],
    );
    expect(rows).toEqual(['client_status', 'name']);
    expect(markup).toMatch(
      /data-slot="column-label"[^>]*data-column-key="client_status"[^>]*value="Client Approval"/,
    );
    expect(markup).toMatch(/data-slot="column-label"[^>]*data-column-key="name"[^>]*value="Name"/);
    expect(markup).toContain('data-slot="column-move"');
  });
});
