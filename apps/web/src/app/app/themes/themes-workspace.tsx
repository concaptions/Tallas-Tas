'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ThemeListRow } from '@tas/db';
import type { ViewType } from '@tas/domain';
import { getTableCapability } from '@tas/domain';
import { Button, Input } from '@tas/ui';

import { useTableView, ViewToolbar, GalleryView, galleryItemsFrom } from '@/components/views';
import { AirtableGrid, type GridColumn } from '@/components/views/airtable-grid';
import type { UserViewConfig } from '@tas/domain';
import type { UserViewsResult } from '@/lib/user-view-actions';
import { ChipCell, CountCell, TextCell } from '@/components/views/grid-cells';

import {
  ALL_CATEGORIES,
  CATEGORY_FILTERS,
  assigneeValue,
  attachmentChipRow,
  filteredCountLabel,
  libraryCountLabel,
  matchesCategory,
  matchesQuery,
  referenceChipRow,
  statusChip,
  themeCategoryLabel,
  themeCategoryTone,
  usageLabel,
  type CategoryFilter,
} from './fields';
import { GlobalBadge } from './global-badge';
import { NewThemeDialog } from './new-theme-dialog';
import { ThemePanel } from './theme-panel';

const THEMES_CAP = getTableCapability('themes') as NonNullable<
  ReturnType<typeof getTableCapability>
>;

/**
 * The Themes library: the GLOBAL badge, the header, the two filters and the Airtable-style grid
 * (PRD §5.5). A row opens the theme's side panel (`?theme=`), which hosts the full labelled card and
 * its Archive / Restore action; the Gallery shows the same rows as cards covered by their first
 * attachment. No Kanban (action item 18): the category chip row below the header already groups the
 * library by the field the board grouped by, in place, without leaving the grid.
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
  /** The `?theme=` the page was opened with: the row whose panel is open, or null. */
  readonly initialSelection?: string | null;
  /** The viewer's saved views of this table (VIEWS-01); `userId` null in demo mode. */
  readonly userViews: UserViewsResult;
}

/**
 * Writes both grid parameters without a server round trip; Next.js reads the History API back.
 *
 * Built by hand rather than with `URLSearchParams.toString()`, which encodes a space as `+`:
 * `Production Style` has one, and `%20` is what survives being pasted into a chat window. A filter
 * at its default is removed rather than written, so a cleared view leaves a clean URL.
 */
function syncUrl(
  tab: ThemeTab,
  category: CategoryFilter,
  search: string,
  theme: string | null = null,
): void {
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
  if (theme !== null && theme !== '') {
    parts.push(`theme=${encodeURIComponent(theme)}`);
  }
  const query = parts.length === 0 ? '' : `?${parts.join('&')}`;
  window.history.replaceState(null, '', `${window.location.pathname}${query}`);
}

/**
 * The Airtable-style grid columns for Themes: the typed name (frozen), the category and status
 * chips, the assignee as plain text (the resolved user, else the imported collaborator name — never
 * "null", never a blank chip), the prose columns clipped with the whole text on hover, the two
 * attachment columns as counts, the usage line and whether the theme is archived.
 */
const THEME_COLUMNS: readonly GridColumn<ThemeListRow>[] = [
  {
    key: 'name',
    header: 'Name',
    frozen: true,
    minWidth: 220,
    sortValue: (theme) => theme.name,
    render: (theme) => (
      <span className="font-medium" data-slot="theme-name">
        {theme.name}
      </span>
    ),
  },
  {
    key: 'category',
    header: 'Category',
    sortValue: (theme) => themeCategoryLabel(theme.category),
    render: (theme) => (
      <ChipCell
        chip={{
          label: themeCategoryLabel(theme.category),
          tone: themeCategoryTone(theme.category),
        }}
      />
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortValue: (theme) => statusChip(theme.status)?.label ?? null,
    render: (theme) => <ChipCell chip={statusChip(theme.status)} />,
  },
  {
    key: 'assignee',
    header: 'Assignee',
    sortValue: (theme) => assigneeValue(theme)?.text ?? null,
    render: (theme) => {
      const assignee = assigneeValue(theme);
      return (
        <span data-slot="theme-assignee" data-resolved={assignee?.mono === true ? 'false' : 'true'}>
          <TextCell value={assignee?.text ?? null} />
        </span>
      );
    },
  },
  {
    key: 'notes',
    header: 'Notes',
    render: (theme) => <TextCell value={theme.notes} maxWidth={320} />,
  },
  {
    key: 'attachments',
    header: 'Attachments',
    sortValue: (theme) => attachmentChipRow(theme.attachments).shown.length,
    render: (theme) => {
      const row = attachmentChipRow(theme.attachments);
      return <CountCell count={row.shown.length + row.overflow} noun="file" />;
    },
  },
  {
    key: 'attachmentSummary',
    header: 'Attachment Summary',
    render: (theme) => <TextCell value={theme.aiAttachmentSummary} maxWidth={320} />,
  },
  {
    key: 'referenceLinks',
    header: 'Reference Links',
    sortValue: (theme) => referenceChipRow(theme.referenceLinks).shown.length,
    render: (theme) => {
      const row = referenceChipRow(theme.referenceLinks);
      return <CountCell count={row.shown.length + row.overflow} noun="link" />;
    },
  },
  {
    key: 'usedBy',
    header: 'Used by',
    sortValue: (theme) => theme.usedByBrandCount,
    render: (theme) => (
      <span className="text-text3" data-slot="theme-usage">
        {usageLabel(theme.usedByBrandCount)}
      </span>
    ),
  },
  {
    key: 'active',
    header: 'Active',
    align: 'center',
    sortValue: (theme) => (theme.isActive ? 1 : 0),
    render: (theme) => (theme.isActive ? 'Active' : 'Archived'),
  },
];

/** Every column key the Fields popover can toggle, and its label, in grid order (VIEWS-01). */
const FIELD_KEYS: readonly string[] = THEME_COLUMNS.map((column) => column.key);
const FIELD_OPTIONS = THEME_COLUMNS.map((column) => ({ key: column.key, label: column.header }));

export function ThemesWorkspace({
  themes,
  demo,
  initialCategory,
  initialSearch,
  initialTab,
  initialView,
  initialSelection = null,
  userViews,
}: ThemesWorkspaceProps) {
  const router = useRouter();
  const [tab, setTab] = useState<ThemeTab>(initialTab);
  const [category, setCategory] = useState<CategoryFilter>(initialCategory);
  const [search, setSearch] = useState(initialSearch);
  const [selection, setSelection] = useState<string | null>(initialSelection);

  const pickTab = useCallback(
    (next: ThemeTab) => {
      setTab(next);
      syncUrl(next, category, search, selection);
    },
    [category, search, selection],
  );

  const pickCategory = useCallback(
    (next: CategoryFilter) => {
      setCategory(next);
      syncUrl(tab, next, search, selection);
    },
    [tab, search, selection],
  );

  const filter = useCallback(
    (next: string) => {
      setSearch(next);
      syncUrl(tab, category, next, selection);
    },
    [tab, category, selection],
  );

  const clearFilters = useCallback(() => {
    setCategory(ALL_CATEGORIES);
    setSearch('');
    syncUrl(tab, ALL_CATEGORIES, '', selection);
  }, [tab, selection]);

  const select = useCallback(
    (id: string | null) => {
      setSelection(id);
      syncUrl(tab, category, search, id);
    },
    [tab, category, search],
  );

  const close = useCallback(() => {
    select(null);
  }, [select]);

  const adoptView = useCallback(
    (config: UserViewConfig) => {
      filter(config.filter);
    },
    [filter],
  );

  const tableView = useTableView({
    tableKey: 'themes',
    userId: userViews.userId,
    initialViews: userViews.views,
    defaultViewType: 'grid',
    initialViewType: initialView ?? null,
    fieldKeys: FIELD_KEYS,
    onActivate: adoptView,
  });
  const activeView = tableView.viewType;
  const setActiveView = tableView.setViewType;
  const onSearch = useCallback(
    (next: string) => {
      filter(next);
      tableView.setFilter(next);
    },
    [filter, tableView],
  );

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

  const open = themes.find((theme) => theme.id === selection) ?? null;

  // The card image is the first attachment (Sprint 7 gallery); a theme with none shows its initial.
  const galleryItems = useMemo(
    () =>
      galleryItemsFrom(
        visible,
        THEME_COLUMNS,
        (theme) => ({
          id: theme.id,
          name: theme.name,
          imageUrl: theme.attachments?.[0] ?? null,
          subtitle: themeCategoryLabel(theme.category),
        }),
        { fieldOrder: tableView.config.fieldOrder },
      ),
    [visible, tableView.config.fieldOrder],
  );

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
          <ViewToolbar
            tableKey="themes"
            supportedViews={[...THEMES_CAP.supportedViews]}
            activeView={activeView}
            onViewChange={setActiveView}
            kanbanGroupByField={null}
            views={tableView.views}
            activeViewId={tableView.activeView?.id ?? null}
            onActivateView={tableView.activateView}
            onCreateView={tableView.createView}
            onRenameView={tableView.renameView}
            onDeleteView={tableView.deleteView}
            fields={FIELD_OPTIONS}
            isFieldVisible={tableView.isFieldVisible}
            onToggleField={tableView.toggleField}
            viewConfig={tableView.config}
            onFreezeChange={tableView.setFrozenFields}
            onMoveField={tableView.moveField}
            error={tableView.error}
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              onSearch(event.target.value);
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

        {activeView === 'gallery' ? (
          <GalleryView
            items={galleryItems}
            visibleFields={tableView.config.visibleFields}
            selectedId={selection}
            cardSlot="theme-gallery-card"
            onItemClick={(item) => {
              select(item.id);
            }}
          />
        ) : (
          <AirtableGrid
            tableKey="themes"
            view={tableView.config}
            onSortChange={tableView.setSort}
            columns={THEME_COLUMNS}
            rows={visible}
            rowId={(theme) => theme.id}
            rowLabel={(theme) => theme.name}
            rowAttributes={(theme) => ({
              'data-theme-id': theme.id,
              'data-category': theme.category,
            })}
            selectedId={selection}
            onRowClick={(theme) => {
              select(theme.id);
            }}
            tableSlot="themes-table"
            rowSlot="theme-row"
            empty={
              <div
                data-slot="themes-empty"
                className="flex flex-col items-center gap-3 text-center"
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
            }
          />
        )}
      </section>

      {open === null ? null : (
        <ThemePanel key={open.id} theme={open} demo={demo} onClose={close} onToggled={saved} />
      )}
    </div>
  );
}
