'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ThemeListRow } from '@tas/db';
import { Button, Input } from '@tas/ui';

import {
  ALL_CATEGORIES,
  CATEGORY_FILTERS,
  filteredCountLabel,
  libraryCountLabel,
  matchesCategory,
  matchesQuery,
  type CategoryFilter,
} from './fields';
import { GlobalBadge } from './global-badge';
import { NewThemeDialog } from './new-theme-dialog';
import { ThemeCard } from './theme-card';

/**
 * The Themes library: the GLOBAL badge, the header, the two filters and the card grid (PRD §5.5).
 *
 * NOT FILTERED BY BRAND, and that is the page. Every other workspace narrows to the brand you are
 * standing in; this grid renders the whole platform's library, which is why the count line says
 * "across the whole platform" in words rather than leaving a reader to assume the usual scope.
 *
 * Both pieces of grid state are URL-backed, exactly as the Angles table does it: `?category=` for
 * the chip row and `?q=` for the search. Written with the History API, so narrowing is instant and
 * a refresh keeps what you had narrowed to, and either view is a link you can send. The two
 * combine, which is also how the empty state is reached — filtering to nothing says so in words
 * and offers to clear both, so the grid area is never a blank rectangle.
 *
 * The rows arrive newest edit first from `loadThemes()`, so this component never sorts.
 */
export interface ThemesWorkspaceProps {
  readonly themes: readonly ThemeListRow[];
  readonly demo: boolean;
  /** The `?category=` the page was opened with, already narrowed to the known vocabulary. */
  readonly initialCategory: CategoryFilter;
  /** The `?q=` filter the page was opened with; `''` when there is none. */
  readonly initialSearch: string;
}

/**
 * Writes both grid parameters without a server round trip; Next.js reads the History API back.
 *
 * Built by hand rather than with `URLSearchParams.toString()`, which encodes a space as `+`:
 * `Production Style` has one, and `%20` is what survives being pasted into a chat window. A filter
 * at its default is removed rather than written, so a cleared view leaves a clean URL.
 */
function syncUrl(category: CategoryFilter, search: string): void {
  const parts: string[] = [];
  if (category !== ALL_CATEGORIES) {
    parts.push(`category=${encodeURIComponent(category)}`);
  }
  if (search.trim() !== '') {
    parts.push(`q=${encodeURIComponent(search)}`);
  }
  const query = parts.length === 0 ? '' : `?${parts.join('&')}`;
  window.history.replaceState(null, '', `${window.location.pathname}${query}`);
}

export function ThemesWorkspace({
  themes,
  demo,
  initialCategory,
  initialSearch,
}: ThemesWorkspaceProps) {
  const router = useRouter();
  const [category, setCategory] = useState<CategoryFilter>(initialCategory);
  const [search, setSearch] = useState(initialSearch);

  const pickCategory = useCallback(
    (next: CategoryFilter) => {
      setCategory(next);
      syncUrl(next, search);
    },
    [search],
  );

  const filter = useCallback(
    (next: string) => {
      setSearch(next);
      syncUrl(category, next);
    },
    [category],
  );

  const clearFilters = useCallback(() => {
    setCategory(ALL_CATEGORIES);
    setSearch('');
    syncUrl(ALL_CATEGORIES, '');
  }, []);

  const saved = useCallback(() => {
    router.refresh();
  }, [router]);

  const term = search.trim();
  const query = term.toLowerCase();
  const visible = useMemo(
    () => themes.filter((theme) => matchesCategory(theme, category) && matchesQuery(theme, query)),
    [themes, category, query],
  );

  const narrowed = visible.length !== themes.length;

  return (
    <div className="flex flex-col gap-8">
      <GlobalBadge />

      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Themes</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Themes</h1>
          <NewThemeDialog demo={demo} onSaved={saved} />
        </div>
        <p className="text-sm text-text2">
          <span data-slot="theme-count">
            {narrowed
              ? filteredCountLabel(visible.length, themes.length)
              : libraryCountLabel(themes.length)}
          </span>{' '}
          — the creative vehicle a concept is built in, shared by every brand.
        </p>
      </header>

      <section aria-labelledby="themes-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="themes-heading" className="text-sm font-medium text-text2">
            Library
          </h2>
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              filter(event.target.value);
            }}
            placeholder="Search themes and notes"
            aria-label="Search themes by name or note"
            data-slot="theme-search"
            className="h-8 w-full sm:w-72"
          />
        </div>

        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filter by category"
          data-slot="category-filters"
        >
          {CATEGORY_FILTERS.map((entry) => {
            const on = entry.key === category;
            return (
              <button
                key={entry.key}
                type="button"
                aria-pressed={on}
                data-slot="category-filter"
                data-category={entry.key}
                onClick={() => {
                  pickCategory(entry.key);
                }}
                className={
                  on
                    ? 'rounded-input border border-accent-line bg-accent-soft px-2.5 py-1 font-mono text-[11px] tracking-wide text-accent uppercase'
                    : 'rounded-input border border-line bg-surface2 px-2.5 py-1 font-mono text-[11px] tracking-wide text-text3 uppercase hover:border-line2 hover:text-text2'
                }
              >
                {entry.label}
              </button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <div
            data-slot="themes-empty"
            className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-4 py-10 text-center"
          >
            <p className="text-sm text-text2">
              {themes.length === 0
                ? 'The library is empty. The first theme you add is available to every brand on the platform.'
                : 'No theme matches these filters. Widen the category or clear the search.'}
            </p>
            {themes.length === 0 ? (
              <NewThemeDialog demo={demo} onSaved={saved} />
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearFilters}
                data-slot="clear-filters"
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div
            data-slot="theme-grid"
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {visible.map((theme) => (
              <ThemeCard key={theme.id} theme={theme} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
