'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import {
  defaultUserViewConfig,
  isViewFieldVisible,
  moveViewField,
  parseUserViewConfig,
  reconcileViewFields,
  resolveViewType,
  toggleViewField,
  type UserView,
  type UserViewConfig,
  type UserViewFilter,
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
  /** The frozen (sticky) columns, as a prefix of the viewer's own column order (action item 22). */
  readonly setFrozenFields: (next: readonly string[]) => void;
  /** The media column that covers a gallery card, or null for the page's default (action item 16). */
  readonly setCoverField: (next: string | null) => void;
  /** Moves one field a step in the viewer's own order — grid columns and card lines together. */
  readonly moveField: (key: string, direction: 'up' | 'down') => void;
  /** The view's field conditions (AI-32), replacing the whole list each time. */
  readonly setFilters: (next: readonly UserViewFilter[]) => void;
  /** The grid's grouping column, or null for the flat reading (AI-32). */
  readonly setGroupBy: (next: string | null) => void;
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
  const [views, setViews] = useState<readonly UserView[]>(initialViews);
  /**
   * A stored VIEW TYPE, read against the views this table still offers.
   *
   * `loadUserViews` narrows what it reads from Postgres, but two other paths reach this hook
   * unchecked: the `?view=` of a shared link, and demo mode's `localStorage`. Item 18 took Kanban
   * off the data tables, and a value from either path could still name it — which left the switcher
   * on a tab that is not rendered and the page on a board that is gone. `resolveViewType` hands
   * back the grid instead, and the stale value is overwritten the next time anything is persisted.
   */
  const resolve = useCallback(
    (config: UserViewConfig): UserViewConfig => {
      const viewType = resolveViewType(tableKey, config.viewType, defaultViewType);
      return viewType === config.viewType ? config : { ...config, viewType };
    },
    [defaultViewType, tableKey],
  );
  /**
   * A stored config, read against the keys THIS table has now. A view holds the keys of the columns
   * it shows, and the column resolver changed that vocabulary from the module's camelCase field
   * names to Postgres column keys — so without this a view saved beforehand names nothing the table
   * recognises, and `isViewFieldVisible` reads every column as hidden: a blank grid. The reconciler
   * in `@tas/domain` re-spells what it can, drops what is gone and falls back to "show everything"
   * when a list resolves to nothing; the next save writes the reconciled keys back.
   */
  const reconcile = useCallback(
    (config: UserViewConfig): UserViewConfig => ({
      ...config,
      visibleFields: reconcileViewFields(config.visibleFields, fieldKeys),
    }),
    [fieldKeys],
  );
  const [draft, setDraft] = useState<UserViewConfig>(() => {
    const active = initialViews.find((view) => view.isActive);
    const base = reconcile(active ?? defaultUserViewConfig(defaultViewType));
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

  /**
   * THE CURRENT state, readable from any event handler. React replays a click that landed during
   * hydration, and it schedules the re-render AFTER an effect's setState — so a handler can run
   * against the closures of an OLDER render. The Cover e2e caught `setViewType` doing exactly
   * that after a reload: the storage-read effect had already applied "My view" (gallery + cover),
   * the replayed tab click then rebuilt the draft from the stale default config (cover gone) and
   * persisted the stale EMPTY view list over the visitor's store. Every mutator therefore reads
   * through these refs, which `updateViews` / `updateDraft` write through at set time: a stale
   * closure can still run, but it runs against the current values.
   */
  const viewsRef = useRef<readonly UserView[]>(views);
  const draftRef = useRef<UserViewConfig>(draft);

  const updateViews = useCallback(
    (next: readonly UserView[] | ((current: readonly UserView[]) => readonly UserView[])) => {
      if (typeof next !== 'function') {
        // A plain value updates the ref EAGERLY, so a second mutator in the same tick already
        // reads it — the same synchronous contract `updateDraft` keeps.
        viewsRef.current = next;
        setViews(next);
        return;
      }
      setViews((current) => {
        const value = next(current);
        // A ref write inside an updater is safe here: it is idempotent, so StrictMode's double
        // invocation observes nothing, and it is exactly what keeps the ref current when the
        // transition callbacks reconcile against `current` rather than a snapshot.
        viewsRef.current = value;
        return value;
      });
    },
    [],
  );

  const updateDraft = useCallback((next: UserViewConfig) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  /**
   * Whether demo mode's stored state has been READ this mount. Writes are gated on it: a click
   * that lands in the gap between hydration and the read effect below would otherwise persist
   * the empty initial state over the visitor's stored views — wiping "My view" moments before
   * the effect would have loaded it. The Cover e2e caught exactly that, flaking with the CPU:
   * the effect usually wins the race, and under five parallel workers it sometimes does not.
   * A pre-read interaction is applied optimistically but NOT persisted; the read then lands the
   * stored state the same way fresh server data would, and every later change persists normally.
   */
  const localLoaded = useRef(false);

  // Demo mode: the browser is the store. Read it once after mount so hydration stays clean.
  useEffect(() => {
    if (!local) return;
    const stored = readStored(tableKey, defaultViewType);
    localLoaded.current = true;
    if (stored === null) return;
    updateViews(stored.views);
    const active = stored.views.find((view) => view.isActive);
    const next = active ?? stored.draft;
    const requested = initialViewType === null ? next : { ...next, viewType: initialViewType };
    const config = resolve({ ...requested });
    updateDraft({ ...config });
    /**
     * `onActivate` hands the page the view's remembered SEARCH — but only a real activated view
     * carries one worth adopting. The bare draft is just "what you last had", and every
     * workspace already keeps the live search in the URL (`?q=`), so re-adopting the draft's
     * search here could only ever do harm: a shared link's explicit `?q=green` was being wiped
     * by a stored empty draft whenever the 500ms search debounce had managed to fire before the
     * previous page went away — a latent, timing-shaped flake the concepts search e2e caught.
     * The draft's view TYPE, fields and order still apply through `updateDraft` above.
     */
    if (active !== undefined) onActivate?.(config);
    // The stored state is applied once, on mount; every value named here is stable after it.
  }, [
    local,
    tableKey,
    defaultViewType,
    initialViewType,
    onActivate,
    resolve,
    updateDraft,
    updateViews,
  ]);

  const persistLocal = useCallback(
    (nextViews: readonly UserView[], nextDraft: UserViewConfig) => {
      if (local && localLoaded.current) {
        writeStored(tableKey, { views: nextViews, draft: nextDraft });
      }
    },
    [local, tableKey],
  );

  /** Applies a partial config to the active view (creating one when none is active) and persists it. */
  const patch = useCallback(
    (change: Partial<UserViewConfig>) => {
      const nextDraft = { ...draftRef.current, ...change };
      updateDraft(nextDraft);
      const currentViews = viewsRef.current;
      const active = currentViews.find((view) => view.isActive) ?? null;
      if (active === null) {
        // Nothing to persist into yet: create the viewer's first view from the current lens.
        const created: UserView = {
          id: localId(),
          name: AUTO_VIEW_NAME,
          isActive: true,
          ...nextDraft,
        };
        const nextViews = [...currentViews, created];
        updateViews(nextViews);
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
              updateViews((current) =>
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
      const nextViews = currentViews.map((view) =>
        view.id === active.id ? { ...view, ...nextDraft } : view,
      );
      updateViews(nextViews);
      persistLocal(nextViews, nextDraft);
      if (!local) {
        startTransition(async () => {
          const result = await updateUserViewConfigAction({
            tableKey,
            id: active.id,
            config: change,
          });
          if (!result.ok) setError(result.error);
        });
      }
    },
    [local, persistLocal, tableKey, updateDraft, updateViews],
  );

  const setViewType = useCallback(
    (next: ViewType) => {
      // The view type is remembered on the active view only; with none, it is just the draft.
      if (viewsRef.current.find((view) => view.isActive) === undefined) {
        const nextDraft = { ...draftRef.current, viewType: next };
        updateDraft(nextDraft);
        persistLocal(viewsRef.current, nextDraft);
        return;
      }
      patch({ viewType: next });
    },
    [patch, persistLocal, updateDraft],
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

  const setCoverField = useCallback(
    (next: string | null) => {
      patch({ coverField: next });
    },
    [patch],
  );

  const setFilter = useCallback(
    (next: string) => {
      // Typing is persisted a beat after it stops, never per keystroke.
      const nextDraft = { ...draftRef.current, filter: next };
      updateDraft(nextDraft);
      if (filterTimer.current !== null) window.clearTimeout(filterTimer.current);
      filterTimer.current = window.setTimeout(() => {
        // Read again WHEN THE TIMER FIRES: half a second has passed, and the active view or the
        // rest of the draft may have moved under the debounce.
        if (viewsRef.current.find((view) => view.isActive) === undefined) {
          persistLocal(viewsRef.current, draftRef.current);
          return;
        }
        patch({ filter: next });
      }, 500);
    },
    [patch, persistLocal, updateDraft],
  );

  const toggleField = useCallback(
    (key: string) => {
      patch({ visibleFields: toggleViewField(draftRef.current, key, fieldKeys) });
    },
    [fieldKeys, patch],
  );

  const moveField = useCallback(
    (key: string, direction: 'up' | 'down') => {
      patch({ fieldOrder: moveViewField(fieldKeys, draftRef.current, key, direction) });
    },
    [fieldKeys, patch],
  );

  const setFilters = useCallback(
    (next: readonly UserViewFilter[]) => {
      patch({ filters: [...next] });
    },
    [patch],
  );

  const setGroupBy = useCallback(
    (next: string | null) => {
      patch({ groupBy: next });
    },
    [patch],
  );

  const isFieldVisible = useCallback((key: string) => isViewFieldVisible(draft, key), [draft]);

  const adopt = useCallback(
    (config: UserViewConfig) => {
      const resolved = resolve(reconcile(config));
      updateDraft(resolved);
      onActivate?.(resolved);
    },
    [onActivate, reconcile, resolve, updateDraft],
  );

  const activateView = useCallback(
    (id: string | null) => {
      const currentViews = viewsRef.current;
      const target = id === null ? null : (currentViews.find((view) => view.id === id) ?? null);
      const nextViews = currentViews.map((view) => ({ ...view, isActive: view.id === id }));
      updateViews(nextViews);
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
    [adopt, defaultViewType, local, persistLocal, tableKey, updateViews],
  );

  const createView = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (trimmed === '') {
        setError('Give the view a name.');
        return;
      }
      setError(null);
      const currentDraft = draftRef.current;
      const created: UserView = { id: localId(), name: trimmed, isActive: true, ...currentDraft };
      const nextViews = [
        ...viewsRef.current.map((view) => ({ ...view, isActive: false })),
        created,
      ];
      updateViews(nextViews);
      persistLocal(nextViews, currentDraft);
      if (!local) {
        startTransition(async () => {
          const result = await createUserViewAction({
            tableKey,
            name: trimmed,
            config: currentDraft,
          });
          if (result.ok && result.view !== null) {
            const saved = result.view;
            updateViews((current) =>
              current.map((view) => (view.id === created.id ? { ...saved, isActive: true } : view)),
            );
          } else if (!result.ok) {
            setError(result.error);
          }
        });
      }
    },
    [local, persistLocal, tableKey, updateViews],
  );

  const renameView = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (trimmed === '') {
        setError('Give the view a name.');
        return;
      }
      setError(null);
      const nextViews = viewsRef.current.map((view) =>
        view.id === id ? { ...view, name: trimmed } : view,
      );
      updateViews(nextViews);
      persistLocal(nextViews, draftRef.current);
      if (!local) {
        startTransition(async () => {
          const result = await renameUserViewAction({ tableKey, id, name: trimmed });
          if (!result.ok) setError(result.error);
        });
      }
    },
    [local, persistLocal, tableKey, updateViews],
  );

  const deleteView = useCallback(
    (id: string) => {
      const wasActive = viewsRef.current.find((view) => view.isActive)?.id === id;
      const nextViews = viewsRef.current.filter((view) => view.id !== id);
      updateViews(nextViews);
      const nextConfig = wasActive ? defaultUserViewConfig(defaultViewType) : draftRef.current;
      if (wasActive) adopt(nextConfig);
      persistLocal(nextViews, nextConfig);
      if (!local) {
        startTransition(async () => {
          const result = await deleteUserViewAction({ id });
          if (!result.ok) setError(result.error);
        });
      }
    },
    [adopt, defaultViewType, local, persistLocal, tableKey, updateViews],
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
    setCoverField,
    moveField,
    setFilters,
    setGroupBy,
    toggleField,
    isFieldVisible,
    createView,
    renameView,
    deleteView,
    activateView,
    error,
  };
}
