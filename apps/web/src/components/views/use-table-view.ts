'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import {
  defaultUserViewConfig,
  isViewFieldVisible,
  parseUserViewConfig,
  resolveViewType,
  toggleViewField,
  type UserView,
  type UserViewConfig,
  type UserViewSort,
  type ViewType,
} from '@tas/domain';

import {
  activateUserViewAction,
  createUserViewAction,
  deleteUserViewAction,
  renameUserViewAction,
  updateUserViewConfigAction,
} from '@/lib/user-view-actions';

/**
 * The per-user view state of one table (Sprint 7, VIEWS-01), shared by the six workspaces.
 *
 * The viewer's views arrive from the server (`loadUserViews`) with the active one flagged; this
 * hook keeps them in state, applies the active view's config, and persists every change — a
 * field toggled, a sort, a search, the view type — into that view through the Server Actions,
 * optimistically. A change made with NO active view first creates one ("My view"), so "persists
 * into the active user view" always has a view to persist into.
 *
 * In demo mode there is no user (`userId === null`). The same state then lives in this browser's
 * `localStorage` under the table key, read after mount so server and client HTML agree, so a demo
 * visitor's views survive a reload and are still theirs alone (another browser profile — another
 * "user" — sees none of them).
 */
export interface UseTableViewArgs {
  readonly tableKey: string;
  readonly userId: string | null;
  readonly initialViews: readonly UserView[];
  /** The view type the table opens on with no active view (a URL override wins, see below). */
  readonly defaultViewType: ViewType;
  /** A `?view=` the page was opened with; applied once, over any saved view type. */
  readonly initialViewType?: ViewType | null;
  /** Every field key the Fields popover can toggle, in the table's own order. */
  readonly fieldKeys: readonly string[];
  /** Called when a view is activated (or loaded) so the workspace can adopt its search. */
  readonly onActivate?: (config: UserViewConfig) => void;
}

export interface TableViewState {
  readonly views: readonly UserView[];
  readonly activeView: UserView | null;
  readonly config: UserViewConfig;
  readonly viewType: ViewType;
  readonly setViewType: (next: ViewType) => void;
  readonly setSort: (next: UserViewSort | null) => void;
  readonly setFilter: (next: string) => void;
  /** The frozen (sticky) columns, as a prefix of the viewer's column order (AI-22). */
  readonly setFrozenFields: (next: readonly string[]) => void;
  readonly toggleField: (key: string) => void;
  readonly isFieldVisible: (key: string) => boolean;
  readonly createView: (name: string) => void;
  readonly renameView: (id: string, name: string) => void;
  readonly deleteView: (id: string) => void;
  readonly activateView: (id: string | null) => void;
  readonly error: string | null;
}

/** What a view created from the Fields popover is called when nobody named it. */
export const AUTO_VIEW_NAME = 'My view';

interface StoredState {
  readonly views: readonly UserView[];
  readonly draft: UserViewConfig;
}

const storageKey = (tableKey: string): string => `tas.user-views.${tableKey}`;

function store(): Storage | undefined {
  return (globalThis as { localStorage?: Storage }).localStorage;
}

function readStored(tableKey: string, fallback: ViewType): StoredState | null {
  try {
    const raw = store()?.getItem(storageKey(tableKey));
    if (raw == null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as { views?: unknown; draft?: unknown };
    const rawViews: readonly unknown[] = Array.isArray(record.views) ? record.views : [];
    const views = rawViews
      .filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as Record<string, unknown>)['id'] === 'string',
      )
      .map((entry): UserView => ({
        id: String(entry['id']),
        name: typeof entry['name'] === 'string' ? entry['name'] : AUTO_VIEW_NAME,
        isActive: entry['isActive'] === true,
        ...parseUserViewConfig(entry, fallback),
      }));
    const draft = parseUserViewConfig(
      typeof record.draft === 'object' && record.draft !== null ? record.draft : {},
      fallback,
    );
    return { views, draft };
  } catch {
    return null;
  }
}

function writeStored(tableKey: string, state: StoredState): void {
  try {
    store()?.setItem(storageKey(tableKey), JSON.stringify(state));
  } catch {
    /* private window or disabled storage: the view still works, it just will not be remembered */
  }
}

function localId(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useTableView({
  tableKey,
  userId,
  initialViews,
  defaultViewType,
  initialViewType = null,
  fieldKeys,
  onActivate,
}: UseTableViewArgs): TableViewState {
  // A saved view, a `?view=` in a shared link or a value left in this browser's store can name a
  // view the table no longer offers — a Concepts board after AI-18 dropped Kanban from the data
  // tables. `resolveViewType` falls back to the grid rather than leaving the switcher on a tab that
  // is not there, and the stale value is replaced the next time anything is persisted.
  const resolve = useCallback(
    (config: UserViewConfig): UserViewConfig => {
      const viewType = resolveViewType(tableKey, config.viewType, defaultViewType);
      return viewType === config.viewType ? config : { ...config, viewType };
    },
    [defaultViewType, tableKey],
  );

  const [views, setViews] = useState<readonly UserView[]>(initialViews);
  const [draft, setDraft] = useState<UserViewConfig>(() => {
    const active = initialViews.find((view) => view.isActive);
    const base = active ?? defaultUserViewConfig(defaultViewType);
    const requested =
      initialViewType === null ? { ...base } : { ...base, viewType: initialViewType };
    return {
      ...requested,
      viewType: resolveViewType(tableKey, requested.viewType, defaultViewType),
    };
  });
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const filterTimer = useRef<number | null>(null);
  const local = userId === null;

  const activeView = views.find((view) => view.isActive) ?? null;

  // Demo mode: the browser is the store. Read it once after mount so hydration stays clean.
  useEffect(() => {
    if (!local) return;
    const stored = readStored(tableKey, defaultViewType);
    if (stored === null) return;
    setViews(stored.views);
    const active = stored.views.find((view) => view.isActive);
    const next = active ?? stored.draft;
    const requested = initialViewType === null ? next : { ...next, viewType: initialViewType };
    const config = resolve({ ...requested });
    setDraft({ ...config });
    onActivate?.(config);
    // The stored state is applied once, on mount; every value named here is stable after it.
  }, [local, tableKey, defaultViewType, initialViewType, onActivate, resolve]);

  const persistLocal = useCallback(
    (nextViews: readonly UserView[], nextDraft: UserViewConfig) => {
      if (local) writeStored(tableKey, { views: nextViews, draft: nextDraft });
    },
    [local, tableKey],
  );

  /** Applies a partial config to the active view (creating one when none is active) and persists it. */
  const patch = useCallback(
    (change: Partial<UserViewConfig>) => {
      const nextDraft = { ...draft, ...change };
      setDraft(nextDraft);
      if (activeView === null) {
        // Nothing to persist into yet: create the viewer's first view from the current lens.
        const created: UserView = {
          id: localId(),
          name: AUTO_VIEW_NAME,
          isActive: true,
          ...nextDraft,
        };
        const nextViews = [...views, created];
        setViews(nextViews);
        persistLocal(nextViews, nextDraft);
        if (!local) {
          startTransition(async () => {
            const result = await createUserViewAction({
              tableKey,
              name: AUTO_VIEW_NAME,
              config: nextDraft,
            });
            if (result.ok && result.view !== null) {
              const saved = result.view;
              setViews((current) =>
                current.map((view) =>
                  view.id === created.id ? { ...saved, isActive: true } : view,
                ),
              );
            } else if (!result.ok) {
              setError(result.error);
            }
          });
        }
        return;
      }
      const nextViews = views.map((view) =>
        view.id === activeView.id ? { ...view, ...nextDraft } : view,
      );
      setViews(nextViews);
      persistLocal(nextViews, nextDraft);
      if (!local) {
        startTransition(async () => {
          const result = await updateUserViewConfigAction({
            tableKey,
            id: activeView.id,
            config: change,
          });
          if (!result.ok) setError(result.error);
        });
      }
    },
    [activeView, draft, local, persistLocal, tableKey, views],
  );

  const setViewType = useCallback(
    (next: ViewType) => {
      // The view type is remembered on the active view only; with none, it is just the draft.
      if (activeView === null) {
        const nextDraft = { ...draft, viewType: next };
        setDraft(nextDraft);
        persistLocal(views, nextDraft);
        return;
      }
      patch({ viewType: next });
    },
    [activeView, draft, patch, persistLocal, views],
  );

  const setSort = useCallback(
    (next: UserViewSort | null) => {
      patch({ sort: next });
    },
    [patch],
  );

  const setFrozenFields = useCallback(
    (next: readonly string[]) => {
      patch({ frozenFields: [...next] });
    },
    [patch],
  );

  const setFilter = useCallback(
    (next: string) => {
      // Typing is persisted a beat after it stops, never per keystroke.
      const nextDraft = { ...draft, filter: next };
      setDraft(nextDraft);
      if (filterTimer.current !== null) window.clearTimeout(filterTimer.current);
      filterTimer.current = window.setTimeout(() => {
        if (activeView === null) {
          persistLocal(views, nextDraft);
          return;
        }
        patch({ filter: next });
      }, 500);
    },
    [activeView, draft, patch, persistLocal, views],
  );

  const toggleField = useCallback(
    (key: string) => {
      patch({ visibleFields: toggleViewField(draft, key, fieldKeys) });
    },
    [draft, fieldKeys, patch],
  );

  const isFieldVisible = useCallback((key: string) => isViewFieldVisible(draft, key), [draft]);

  const adopt = useCallback(
    (config: UserViewConfig) => {
      const resolved = resolve(config);
      setDraft({ ...resolved });
      onActivate?.(resolved);
    },
    [onActivate, resolve],
  );

  const activateView = useCallback(
    (id: string | null) => {
      const target = id === null ? null : (views.find((view) => view.id === id) ?? null);
      const nextViews = views.map((view) => ({ ...view, isActive: view.id === id }));
      setViews(nextViews);
      const nextConfig = target ?? defaultUserViewConfig(defaultViewType);
      adopt(nextConfig);
      persistLocal(nextViews, nextConfig);
      if (!local) {
        startTransition(async () => {
          const result = await activateUserViewAction({ tableKey, id });
          if (!result.ok) setError(result.error);
        });
      }
    },
    [adopt, defaultViewType, local, persistLocal, tableKey, views],
  );

  const createView = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (trimmed === '') {
        setError('Give the view a name.');
        return;
      }
      setError(null);
      const created: UserView = { id: localId(), name: trimmed, isActive: true, ...draft };
      const nextViews = [...views.map((view) => ({ ...view, isActive: false })), created];
      setViews(nextViews);
      persistLocal(nextViews, draft);
      if (!local) {
        startTransition(async () => {
          const result = await createUserViewAction({ tableKey, name: trimmed, config: draft });
          if (result.ok && result.view !== null) {
            const saved = result.view;
            setViews((current) =>
              current.map((view) => (view.id === created.id ? { ...saved, isActive: true } : view)),
            );
          } else if (!result.ok) {
            setError(result.error);
          }
        });
      }
    },
    [draft, local, persistLocal, tableKey, views],
  );

  const renameView = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (trimmed === '') {
        setError('Give the view a name.');
        return;
      }
      setError(null);
      const nextViews = views.map((view) => (view.id === id ? { ...view, name: trimmed } : view));
      setViews(nextViews);
      persistLocal(nextViews, draft);
      if (!local) {
        startTransition(async () => {
          const result = await renameUserViewAction({ tableKey, id, name: trimmed });
          if (!result.ok) setError(result.error);
        });
      }
    },
    [draft, local, persistLocal, tableKey, views],
  );

  const deleteView = useCallback(
    (id: string) => {
      const wasActive = activeView?.id === id;
      const nextViews = views.filter((view) => view.id !== id);
      setViews(nextViews);
      const nextConfig = wasActive ? defaultUserViewConfig(defaultViewType) : draft;
      if (wasActive) adopt(nextConfig);
      persistLocal(nextViews, nextConfig);
      if (!local) {
        startTransition(async () => {
          const result = await deleteUserViewAction({ id });
          if (!result.ok) setError(result.error);
        });
      }
    },
    [activeView, adopt, defaultViewType, draft, local, persistLocal, tableKey, views],
  );

  return {
    views,
    activeView,
    config: draft,
    viewType: draft.viewType,
    setViewType,
    setSort,
    setFilter,
    setFrozenFields,
    toggleField,
    isFieldVisible,
    createView,
    renameView,
    deleteView,
    activateView,
    error,
  };
}
