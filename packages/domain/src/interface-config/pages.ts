/**
 * The client-page entity (Scope A, `docs/designs/client-interface-config-2026-10-10.md`): every
 * row of `custom_interface_pages` — a STANDARD tab, an admin CUSTOM view or a platform MODULE page —
 * read through one ordered list. Pure: the merge is `mergeCustomPages`, this module only names the
 * standard set, maps a standard row to its PRD §10 page key, and moves a page one step in the order.
 */

import { CLIENT_TAB_KEYS, type ClientTabKey } from './custom-pages';

export const PAGE_KINDS = ['standard', 'custom', 'module'] as const;
export type PageKind = (typeof PAGE_KINDS)[number];

/** The standard tabs as page slugs: the four `CLIENT_TAB_KEYS` and `calendar` (Talal, answer 2). */
export const STANDARD_PAGE_SLUGS = [...CLIENT_TAB_KEYS, 'calendar'] as const;
export type StandardPageSlug = (typeof STANDARD_PAGE_SLUGS)[number];

export function isStandardPageSlug(value: string): value is StandardPageSlug {
  return (STANDARD_PAGE_SLUGS as readonly string[]).includes(value);
}

export function isClientTabSlug(value: string): value is ClientTabKey {
  return (CLIENT_TAB_KEYS as readonly string[]).includes(value);
}

/**
 * The PRD §10 page key a page row answers for: `interface_pages.enabled` is READ from the page
 * row's `is_visible` (Talal, answer 1), so the §10 config and the portal nav cannot disagree.
 * `partnership` is the module page `partnership-ads` (B5); a custom view answers for no §10 page.
 */
const PAGE_KEY_BY_SLUG: Readonly<Record<string, string>> = {
  concepts: 'concepts',
  creative_sheet: 'creatives',
  ugc_management: 'ugc',
  copywriting: 'copywriting',
  calendar: 'calendar',
  'partnership-ads': 'partnership',
};

export function interfacePageKeyForSlug(slug: string): string | null {
  return PAGE_KEY_BY_SLUG[slug] ?? null;
}

/** The page slug a PRD §10 page key is answered by, or null for a key with no page row. */
export function pageSlugForInterfacePageKey(pageKey: string): string | null {
  const found = Object.entries(PAGE_KEY_BY_SLUG).find(([, key]) => key === pageKey);
  return found === undefined ? null : found[0];
}

export interface OrderedPage {
  readonly slug: string;
  readonly sortOrder: number;
}

/**
 * The order after moving one page a step up or down: every page keeps its place except the moved
 * one and its neighbour, which swap, and the result is renumbered 0..n-1 so the stored orders are
 * dense whatever they were. Unknown slug or a move off either end returns the input renumbered.
 */
export function movePage<Page extends OrderedPage>(
  pages: readonly Page[],
  slug: string,
  direction: 'up' | 'down',
): readonly (Page & { sortOrder: number })[] {
  const sorted = [...pages].sort((a, b) => a.sortOrder - b.sortOrder);
  const at = sorted.findIndex((page) => page.slug === slug);
  const to = direction === 'up' ? at - 1 : at + 1;
  if (at !== -1 && to >= 0 && to < sorted.length) {
    const moved = sorted[at];
    const neighbour = sorted[to];
    if (moved !== undefined && neighbour !== undefined) {
      sorted[at] = neighbour;
      sorted[to] = moved;
    }
  }
  return sorted.map((page, index) => ({ ...page, sortOrder: index }));
}
