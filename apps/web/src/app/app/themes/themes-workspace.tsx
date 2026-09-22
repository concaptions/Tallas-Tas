'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ThemeListRow } from '@tas/db';
import type { ViewType } from '@tas/domain';
import { getTableCapability } from '@tas/domain';
import { Button, Input } from '@tas/ui';

import { KanbanBoard, type KanbanItem, ViewSwitcher } from '@/components/views';

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

const THEMES_CAP = getTableCapability('themes') as NonNullable<
  ReturnType<typeof getTableCapability>
>;

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
export type ThemeTab = 'active' | 'archived';

export interface ThemesWorkspaceProps {
  readonly themes: readonly ThemeListRow[];
  readonly demo: boolean;
  /** The `?category=` the page was opened with, already narrowed to the known vocabulary. */
  readonly initialCategory: CategoryFilter;
  /** The `?q=` filter the page was opened with; `''` when there is none. */
  readonly initialSearch: string;
  /** The `?tab=` the page was opened with; defaults to `'active'`. */
  readonly initialTab: ThemeTab;
  /** The `?view=` the page was opened with; defaults to `'grid'`. */
  readonly initialView?: ViewType;
}

/**
 * Writes both grid parameters without a server round trip; Next.js reads the History API back.
 *
 * Built by hand rather than with `URLSearchParams.toString()`, which encodes a space as `+`:
 * `Production Style` has one, and `%20` is what survives being pasted into a chat window. A filter
 * at its default is removed rather than written, so a cleared view leaves a clean URL.
 */
function syncUrl(tab: ThemeTab, category: CategoryFilter, search: string): void {
  const parts: string[] = [];
  if (tab !== 'active') {
    parts.push(`tab=${tab}`);
  }
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
  initialTab,
  initialView,
}: ThemesWorkspaceProps) {
  const router = useRouter();
  const [tab, setTab] = useState<ThemeTab>(initialTab);
  const [category, setCategory] = useState<CategoryFilter>(initialCategory);
  const [search, setSearch] = useState(initialSearch);
  const [activeView, setActiveView] = useState<ViewType>(initialView ?? 'grid');

  const pickTab = useCallback(
    (next: ThemeTab) => {
      setTab(next);
      syncUrl(next, category, search);
    },
    [category, search],
  );

  const pickCategory = useCallback(
    (next: CategoryFilter) => {
      setCategory(next);
      syncUrl(tab, next, search);
    },
    [tab, search],
  );

  const filter = useCallback(
    (next: string) => {
      setSearch(next);
      syncUrl(tab, category, next);
    },
    [tab, category],
  );

  const clearFilters = useCallback(() => {
    setCategory(ALL_CATEGORIES);
    setSearch('');
    syncUrl(tab, ALL_CATEGORIES, '');
  }, [tab]);

  const saved = useCallback(() => {
    router.refresh();
  }, [router]);

  const tabThemes = useMemo(
    () => themes.filter((theme) => (tab === 'active' ? theme.isActive : !theme.isActive)),
    [themes, tab],
  );

  const activeCount = useMemo(() => themes.filter((t) => t.isActive).length, [themes]);
  const archivedCount = useMemo(() => themes.filter((t) => !t.isActive).length, [themes]);

  const term = search.trim();
  const query = term.toLowerCase();
  const visible = useMemo(
    () =>
      tabThemes.filter((theme) => matchesCategory(theme, category) && matchesQuery(theme, query)),
    [tabThemes, category, query],
  );

  const narrowed = visible.length !== tabThemes.length;

  const kanbanItems = useMemo<KanbanItem[]>(
    () =>
      visible.map((theme) => ({
        id: theme.id,
        name: theme.name,
        groupValue: theme.category,
      })),
    [visible],
  );

  const kanbanColumns = useMemo(
    () => [...new Set(kanbanItems.map((item) => item.groupValue))],
    [kanbanItems],
  );

  const kanbanLabels = useMemo(
    () =>
      Object.fromEntries(
        kanbanColumns.map((col) => [
          col,
          col.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
        ]),
      ),
    [kanbanColumns],
  );

  const handleKanbanMove = useCallback(() => {
    /* no-op: themes don't support drag reordering */
  }, []);

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
              ? filteredCountLabel(visible.length, tabThemes.length)
              : libraryCountLabel(tabThemes.length)}
          </span>{' '}
          — the creative vehicle a concept is built in, shared by every brand.
        </p>
      </header>

      <div
        className="flex items-center gap-1 border-b border-line"
        role="tablist"
        aria-label="Theme status"
        data-slot="theme-tabs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'active'}
          data-slot="tab-active"
          onClick={() => {
            pickTab('active');
          }}
          className={
            tab === 'active'
              ? 'border-b-2 border-accent px-3 py-2 text-sm font-medium text-accent'
              : 'border-b-2 border-transparent px-3 py-2 text-sm font-medium text-text3 hover:text-text2'
          }
        >
          Active ({activeCount})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'archived'}
          data-slot="tab-archived"
          onClick={() => {
            pickTab('archived');
          }}
          className={
            tab === 'archived'
              ? 'border-b-2 border-accent px-3 py-2 text-sm font-medium text-accent'
              : 'border-b-2 border-transparent px-3 py-2 text-sm font-medium text-text3 hover:text-text2'
          }
        >
          Archived ({archivedCount})
        </button>
      </div>

      <section aria-labelledby="themes-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="themes-heading" className="text-sm font-medium text-text2">
            Library
          </h2>
          <ViewSwitcher
            tableKey="themes"
            supportedViews={[...THEMES_CAP.supportedViews]}
            activeView={activeView}
            onViewChange={setActiveView}
            kanbanGroupByField="category"
          />
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

        {activeView === 'kanban' ? (
          <KanbanBoard
            items={kanbanItems}
            columns={kanbanColumns}
            columnLabels={kanbanLabels}
            onMove={handleKanbanMove}
            demo={demo}
          />
        ) : visible.length === 0 ? (
          <div
            data-slot="themes-empty"
            className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-4 py-10 text-center"
          >
            <p className="text-sm text-text2">
              {tabThemes.length === 0
                ? tab === 'archived'
                  ? 'No archived themes.'
                  : 'The library is empty. The first theme you add is available to every brand on the platform.'
                : 'No theme matches these filters. Widen the category or clear the search.'}
            </p>
            {tabThemes.length === 0 && tab === 'active' ? (
              <NewThemeDialog demo={demo} onSaved={saved} />
            ) : tabThemes.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearFilters}
                data-slot="clear-filters"
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : (
          <div
            data-slot="theme-grid"
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {visible.map((theme) => (
              <ThemeCard key={theme.id} theme={theme} demo={demo} onToggled={saved} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
