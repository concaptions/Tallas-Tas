import {
  STANDARD_PAGE_SLUGS,
  clientTabLabel,
  isClientTabSlug,
  isQueuePageSlug,
  type PageKind,
} from '@tas/domain';

import type { PageListItem } from './pages-section';

interface PageRowLike {
  readonly id: string;
  readonly brandId: string | null;
  readonly slug: string;
  readonly title: string;
  readonly pageKind: PageKind;
  readonly sortOrder: number;
  readonly isVisible: boolean;
}

/**
 * The Pages section's list from the brand's rows: the template's and the brand's own, the brand
 * winning by slug, in order; `overridden` when the brand has its own row for the slug. With no
 * standard row at all (demo mode, or a database before migration 0063) the five standard tabs are
 * listed as inherited and visible, which is exactly what the portal shows in that state. The two
 * queue boards' rows are never listed (SMOKE-20): they are not client pages, so there is no switch
 * to flip.
 */
export function pageListItems(
  templateRows: readonly PageRowLike[],
  brandRows: readonly PageRowLike[],
): PageListItem[] {
  const bySlug = new Map(templateRows.map((row) => [row.slug, row] as const));
  for (const row of brandRows) bySlug.set(row.slug, row);
  const ownSlugs = new Set(brandRows.map((row) => row.slug));
  const items = [...bySlug.values()]
    .filter((row) => !isQueuePageSlug(row.slug))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
    .map((row): PageListItem => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      kind: row.pageKind,
      isVisible: row.isVisible,
      overridden: ownSlugs.has(row.slug),
      isTemplate: row.brandId === null,
    }));
  if (items.some((item) => item.kind === 'standard')) return items;
  const fallback = STANDARD_PAGE_SLUGS.map((slug): PageListItem => ({
    id: `fallback:${slug}`,
    slug,
    title: isClientTabSlug(slug) ? clientTabLabel(slug) : 'Calendar',
    kind: 'standard',
    isVisible: true,
    overridden: false,
    isTemplate: true,
  }));
  return [...fallback, ...items];
}

/**
 * The rows the "Custom pages" section edits and pushes (SMOKE-26): custom and module pages that
 * are VISIBLE. A hidden row is out — the two queue boards' template rows above all (hidden for
 * F1, retired by B6), which were listed here with "Push to all clients" while the Pages section
 * had already dropped them. The Pages section stays the one place a hidden page is switched back.
 */
export function customPageRows<
  Row extends { readonly slug: string; readonly pageKind: PageKind; readonly isVisible: boolean },
>(rows: readonly Row[]): Row[] {
  return rows.filter(
    (row) => row.pageKind !== 'standard' && row.isVisible && !isQueuePageSlug(row.slug),
  );
}
