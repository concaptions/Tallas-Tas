'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ClientAssetFolderListRow } from '@tas/db';
import { getTableCapability, type ViewType } from '@tas/domain';
import { Button, Input, PropagationBadge, StatusChip } from '@tas/ui';

import { ViewSwitcher } from '@/components/views';
import { AirtableGrid, type GridColumn } from '@/components/views/airtable-grid';

import { ClientAssetPanel, NEW_CLIENT_ASSET_FOLDER, type LinkOption } from './client-asset-panel';
import { designCountLabel, EM_DASH, linkCountTone } from './fields';

/**
 * The Client Assets grid, its header actions and its side panel. A copy of `products-workspace.tsx`
 * with the description, the location link and the linked-designs count as columns and the design
 * chip picker in the panel.
 *
 * The panel is NOT a modal: it is fixed to the right edge, the grid stays visible and clickable
 * beside it, and there is no backdrop. The open folder lives in the `?folder=` query parameter,
 * written with the History API so opening a row is instant and a refresh still reopens it. The
 * filter is URL-backed the same way, in `?q=`.
 */
export interface ClientAssetFolderItem {
  readonly folder: ClientAssetFolderListRow;
  /** The location host, computed on the server, or null when there is no link. */
  readonly locationHost: string | null;
  /** Airtable's record-link count, computed on the server from the junction ids. */
  readonly designCount: number;
  readonly updatedLabel: string;
  readonly updatedTitle: string;
}

interface ClientAssetsWorkspaceProps {
  readonly items: readonly ClientAssetFolderItem[];
  /** The brand's briefs, the options the panel's chip picker offers. */
  readonly briefs: readonly LinkOption[];
  readonly demo: boolean;
  readonly initialSelection: string | null;
  /** The `?q=` filter the page was opened with; `''` when there is none. */
  readonly initialSearch: string;
  readonly initialView?: ViewType;
}

const TABLE_KEY = 'client-assets';

const CLIENT_ASSETS_CAP = getTableCapability(TABLE_KEY) as NonNullable<
  ReturnType<typeof getTableCapability>
>;

/**
 * Writes one table-state parameter without a server round trip; Next.js reads the History API back.
 * An empty value is removed rather than written as `?q=`, so a cleared filter leaves a clean URL.
 */
function syncUrl(key: 'folder' | 'q', value: string | null): void {
  const url = new URL(window.location.href);
  if (value === null || value.trim() === '') {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

/** The search reads what the grid and the panel show: name, description, location and designs. */
function matches(item: ClientAssetFolderItem, query: string): boolean {
  const { name, description, locationUrl, briefNames } = item.folder;
  return [name, description ?? '', locationUrl ?? '', briefNames.join(' ')].some((value) =>
    value.toLowerCase().includes(query),
  );
}

/**
 * The Airtable-style grid columns: the frozen name column carries the propagation badge; the
 * description is truncated with the full text in the cell title; the location is the host as a real
 * link that opens the folder without opening the panel; the count is the shared `StatusChip` in the
 * count tones, never bare text, so a zero is a visible chip.
 */
const CLIENT_ASSET_COLUMNS: readonly GridColumn<ClientAssetFolderItem>[] = [
  {
    key: 'name',
    header: 'Folder name',
    frozen: true,
    minWidth: 220,
    sortValue: (item) => item.folder.name,
    render: (item) => (
      <span className="flex items-center gap-1.5 font-medium">
        {item.folder.name}
        <PropagationBadge
          templateRowId={item.folder.templateRowId}
          overriddenFields={item.folder.overriddenFields}
        />
      </span>
    ),
  },
  {
    key: 'description',
    header: 'Description',
    minWidth: 240,
    cellTitle: (item) => item.folder.description ?? undefined,
    render: (item) =>
      item.folder.description === null ? (
        <span className="text-text4">{EM_DASH}</span>
      ) : (
        <span className="block max-w-[28rem] truncate">{item.folder.description}</span>
      ),
  },
  {
    key: 'location',
    header: 'Location',
    sortValue: (item) => item.locationHost,
    cellTitle: (item) => item.folder.locationUrl ?? undefined,
    render: (item) =>
      item.folder.locationUrl === null ? (
        <span className="text-text4">{EM_DASH}</span>
      ) : (
        <a
          href={item.folder.locationUrl}
          target="_blank"
          rel="noreferrer"
          data-slot="client-asset-location-link"
          className="text-accent underline-offset-2 hover:underline"
          onClick={(event) => {
            event.stopPropagation();
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
          }}
        >
          {item.locationHost}
        </a>
      ),
  },
  {
    key: 'designs',
    header: 'Linked designs',
    sortValue: (item) => item.designCount,
    cellTitle: (item) => item.folder.briefNames.join(', ') || undefined,
    render: (item) => (
      <StatusChip
        tone={linkCountTone(item.designCount)}
        label={designCountLabel(item.designCount)}
      />
    ),
  },
  {
    key: 'updated',
    header: 'Updated',
    sortValue: (item) => item.updatedTitle,
    cellTitle: (item) => item.updatedTitle,
    render: (item) => <span className="text-text3">{item.updatedLabel}</span>,
  },
];

export function ClientAssetsWorkspace({
  items,
  briefs,
  demo,
  initialSelection,
  initialSearch,
  initialView = 'grid',
}: ClientAssetsWorkspaceProps) {
  const router = useRouter();
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [search, setSearch] = useState(initialSearch);
  const [activeView, setActiveView] = useState<ViewType>(initialView);

  const select = useCallback((id: string | null) => {
    setSelection(id);
    syncUrl('folder', id);
  }, []);

  const filter = useCallback((next: string) => {
    setSearch(next);
    syncUrl('q', next);
  }, []);

  const close = useCallback(() => {
    select(null);
  }, [select]);

  const saved = useCallback(
    (id: string) => {
      select(id);
      router.refresh();
    },
    [router, select],
  );

  const term = search.trim();
  const query = term.toLowerCase();
  const visible = useMemo(
    () => (query === '' ? items : items.filter((item) => matches(item, query))),
    [items, query],
  );

  const open = items.find((item) => item.folder.id === selection)?.folder ?? null;
  const creating = selection === NEW_CLIENT_ASSET_FOLDER;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Client Assets</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Client Assets</h1>
          <Button
            size="sm"
            onClick={() => {
              select(NEW_CLIENT_ASSET_FOLDER);
            }}
            data-slot="new-client-asset-folder"
          >
            New folder
          </Button>
        </div>
        <p className="text-sm text-text2">
          <span data-slot="client-asset-folder-count">
            {visible.length === items.length
              ? `${String(items.length)} ${items.length === 1 ? 'folder' : 'folders'}`
              : `${String(visible.length)} of ${String(items.length)} folders`}
          </span>{' '}
          — where the client&apos;s material lives, and which designs start from each folder.
        </p>
      </header>

      <section aria-labelledby="client-assets-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="client-assets-heading" className="text-sm font-medium text-text2">
            Folders
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="search"
              value={search}
              onChange={(event) => {
                filter(event.target.value);
              }}
              placeholder="Search name, description, link or design"
              aria-label="Search client asset folders"
              data-slot="client-asset-folder-search"
              className="h-8 w-full sm:w-64"
            />
            <ViewSwitcher
              tableKey={TABLE_KEY}
              supportedViews={[...CLIENT_ASSETS_CAP.supportedViews]}
              activeView={activeView}
              onViewChange={setActiveView}
              kanbanGroupByField={null}
            />
          </div>
        </div>

        <AirtableGrid
          tableKey={TABLE_KEY}
          columns={CLIENT_ASSET_COLUMNS}
          rows={visible}
          rowId={(item) => item.folder.id}
          rowLabel={(item) => item.folder.name}
          rowAttributes={(item) => ({ 'data-client-asset-folder-id': item.folder.id })}
          selectedId={selection}
          onRowClick={(item) => {
            select(item.folder.id);
          }}
          tableSlot="client-assets-table"
          rowSlot="client-asset-folder-row"
          empty={
            <div
              data-slot="client-assets-empty"
              className="flex flex-col items-center gap-3 text-center"
            >
              <p className="text-sm text-text2">
                {items.length === 0
                  ? 'No folders yet. Start with the brand kit the client shared.'
                  : `Nothing matches “${term}”. Try a folder name, a host or a design.`}
              </p>
              {items.length === 0 ? (
                <Button
                  size="sm"
                  onClick={() => {
                    select(NEW_CLIENT_ASSET_FOLDER);
                  }}
                  data-slot="empty-new-client-asset-folder"
                >
                  New folder
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    filter('');
                  }}
                  data-slot="clear-search"
                >
                  Clear search
                </Button>
              )}
            </div>
          }
        />
      </section>

      {creating || open !== null ? (
        <ClientAssetPanel
          key={selection}
          folder={creating ? null : open}
          briefs={briefs}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
