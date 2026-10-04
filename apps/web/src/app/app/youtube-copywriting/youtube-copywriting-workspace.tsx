'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getTableCapability, type ViewType } from '@tas/domain';
import { Button, Input, StatusChip, Tabs, TabsList, TabsTrigger } from '@tas/ui';

import { ColumnNotices, KanbanBoard, ViewSwitcher, type KanbanItem } from '@/components/views';
import { ChipListCell, TextCell } from '@/components/views/grid-cells';
import { AirtableGrid } from '@/components/views/airtable-grid';
import {
  gridColumnsFrom,
  type ColumnRegistry,
  type ResolvedColumnView,
} from '@/components/views/resolved-columns';

import { updateYoutubeCopyAction } from './actions';
import {
  booleanChip,
  countLabel,
  DESCRIPTIONS_PREVIEW,
  EM_DASH,
  kanbanColumnsFor,
  kanbanValueOf,
  matchesQuery,
  metaRatingLabel,
  NEW_YOUTUBE_COPY,
  NO_COPY_NOTE,
  NO_MATCH_NOTE,
  SEARCH_PARAM,
  SELECTION_PARAM,
  truncate,
  type CampaignOption,
  type KanbanGroup,
  type LinkOption,
  type YoutubeCopyItem,
} from './fields';
import { YoutubeCopyPanel } from './youtube-copywriting-panel';

/**
 * The YouTube Copywriting grid, its kanban, its header actions and its side panel.
 *
 * The house pattern, mirrored from Products and Personas: an `AirtableGrid` with the generated
 * Copy # frozen on the left, a click or Enter opens the row in a panel fixed to the right edge, and
 * the open row lives in `?youtube-copy=` written through the History API so opening is instant and
 * a refresh reopens it. The search lives in `?q=`, the same key every other list page uses.
 *
 * NOTHING IS RE-LABELLED HERE. `page.tsx` resolved the generated title, every status label and
 * tone, the CTA and funnel labels and both timestamp strings through `fields.ts` before this
 * component saw a row; this file renders what it is handed and never compares a status to a literal.
 *
 * The kanban groups by Status or by Funnel — the two fields `table-views.ts` declares for this
 * table — and a drop posts only `id` and the changed field to the update action, which leaves every
 * other column and every link untouched.
 */
interface YoutubeCopywritingWorkspaceProps {
  /** The brand's ordered, labelled, visible columns, from `loadYoutubeCopyColumns`. */
  readonly columns: readonly ResolvedColumnView[];
  /** True when `columns` is the parent master-set fallback because the brand resolved none. */
  readonly unconfiguredColumns?: boolean;
  readonly items: readonly YoutubeCopyItem[];
  readonly collections: readonly LinkOption[];
  readonly products: readonly LinkOption[];
  readonly campaigns: readonly CampaignOption[];
  readonly copyTypes: readonly LinkOption[];
  readonly demo: boolean;
  readonly initialSelection: string | null;
  /** The `?q=` filter the page was opened with; `''` when there is none. */
  readonly initialSearch: string;
  readonly initialView?: ViewType;
}

const TABLE_KEY = 'youtube-copywriting';

const CAPABILITY = getTableCapability(TABLE_KEY) as NonNullable<
  ReturnType<typeof getTableCapability>
>;

/** Writes one table-state parameter without a server round trip; Next.js reads the History API back. */
function syncUrl(key: typeof SELECTION_PARAM | typeof SEARCH_PARAM, value: string | null): void {
  const url = new URL(window.location.href);
  if (value === null || value.trim() === '') {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

function dash(value: string | null) {
  return value === null || value === '' ? <span className="text-text4">{EM_DASH}</span> : value;
}

/**
 * THE YouTube Copywriting renderer registry, keyed by the resolver's `column_key`.
 *
 * This page is the one where migrating ADDS columns rather than risking losing them: the template's
 * set has sixteen and the hand-written array drew ten, so `angle`, `news_feed`, `client_comment` and
 * the four link junctions were stored and never shown. They are drawn here — the item already
 * carried every one of them, so nothing new is loaded.
 *
 * `copy_number` is the generated Copy # title and keeps its `youtube-copy-row-title` hook and
 * `font-mono` (CLAUDE.md non-negotiable 6 — generated output always renders in the mono face).
 */
const YOUTUBE_COPY_RENDERERS: ColumnRegistry<YoutubeCopyItem> = {
  copy_number: {
    render: (item) => (
      <span data-slot="youtube-copy-row-title" className="font-mono text-xs font-medium">
        {item.title}
      </span>
    ),
    sortValue: (item) => item.copyNumber,
  },
  status: {
    render: (item) => <StatusChip tone={item.statusTone} label={item.statusLabel} />,
    sortValue: (item) => item.statusLabel,
  },
  youtube_copy_collections: {
    render: (item) => (
      <ChipListCell
        chips={item.linkedCollections.map((entry) => ({ label: entry.name, tone: 'info' }))}
      />
    ),
    sortValue: (item) => item.linkedCollections.length,
  },
  youtube_copy_products: {
    render: (item) => (
      <ChipListCell
        chips={item.linkedProducts.map((entry) => ({ label: entry.name, tone: 'mute' }))}
      />
    ),
    sortValue: (item) => item.linkedProducts.length,
  },
  angle: {
    render: (item) => <TextCell value={item.angle} maxWidth={240} />,
    sortValue: (item) => item.angle,
  },
  descriptions: {
    render: (item) =>
      item.descriptions === null ? dash(null) : truncate(item.descriptions, DESCRIPTIONS_PREVIEW),
    cellTitle: (item) => item.descriptions ?? undefined,
    minWidth: 260,
  },
  headline: {
    render: (item) => dash(item.headline),
    sortValue: (item) => item.headline,
    minWidth: 220,
  },
  news_feed: {
    render: (item) => <TextCell value={item.newsFeed} maxWidth={240} />,
    sortValue: (item) => item.newsFeed,
  },
  cta: {
    render: (item) => dash(item.ctaLabel),
    sortValue: (item) => item.ctaLabel,
  },
  youtube_copy_campaigns: {
    render: (item) => (
      <ChipListCell
        chips={item.linkedCampaigns.map((entry) => ({
          label: entry.code ?? entry.name,
          tone: 'accent',
        }))}
      />
    ),
    sortValue: (item) => item.linkedCampaigns.length,
  },
  funnel: {
    render: (item) => dash(item.funnelLabel),
    sortValue: (item) => item.funnelLabel,
  },
  youtube_copy_copy_types: {
    render: (item) => (
      <ChipListCell
        chips={item.linkedCopyTypes.map((entry) => ({ label: entry.name, tone: 'info' }))}
      />
    ),
    sortValue: (item) => item.linkedCopyTypes.length,
  },
  client_comment: {
    render: (item) => <TextCell value={item.clientComment} maxWidth={260} />,
    sortValue: (item) => item.clientComment,
  },
  used: {
    render: (item) => <StatusChip {...booleanChip(item.used)} />,
    sortValue: (item) => (item.used ? 1 : 0),
  },
  winning: {
    render: (item) => <StatusChip {...booleanChip(item.winning)} />,
    sortValue: (item) => (item.winning ? 1 : 0),
  },
  meta_rating: {
    render: (item) => {
      const label = metaRatingLabel(item.metaRating);
      return label === null ? dash(null) : <span className="font-mono text-xs">{label}</span>;
    },
    sortValue: (item) => item.metaRating,
    align: 'right',
  },
  /*
   * The Airtable lookup columns (GRATSI-MATCH, 2026-10-04): read-only echoes of the linked rows,
   * resolved by `build-items.ts` and seeded as Gratsi child-added `lookupRollup` virtual columns —
   * so they resolve for Gratsi only, and the platform set the other brands inherit is unchanged.
   * Campaign names and codes are system output of the campaign name formula, so they keep the
   * mono face (CLAUDE.md non-negotiable 6), as does the stored `created_by` actor id.
   */
  offer: {
    render: (item) => <TextCell value={item.offer} maxWidth={180} />,
    sortValue: (item) => item.offer,
  },
  campaign_from_campaign: {
    render: (item) =>
      item.campaignNames === null ? (
        dash(null)
      ) : (
        <span className="font-mono text-xs">{item.campaignNames}</span>
      ),
    cellTitle: (item) => item.campaignNames ?? undefined,
    sortValue: (item) => item.campaignNames,
    minWidth: 220,
  },
  code_from_campaign: {
    render: (item) =>
      item.campaignCodes === null ? (
        dash(null)
      ) : (
        <span className="font-mono text-xs">{item.campaignCodes}</span>
      ),
    sortValue: (item) => item.campaignCodes,
  },
  collection_url: {
    render: (item) => <TextCell value={item.collectionUrls} maxWidth={240} />,
    sortValue: (item) => item.collectionUrls,
  },
  link_from_product: {
    render: (item) => <TextCell value={item.productLinks} maxWidth={240} />,
    sortValue: (item) => item.productLinks,
  },
  products_from_collections: {
    render: (item) => <TextCell value={item.productsFromCollections} maxWidth={220} />,
    sortValue: (item) => item.productsFromCollections,
  },
  internal_product: {
    render: (item) => <TextCell value={item.internalProduct} maxWidth={200} />,
    sortValue: (item) => item.internalProduct,
  },
  created_by: {
    render: (item) =>
      item.createdBy === null ? (
        dash(null)
      ) : (
        <span className="font-mono text-xs text-text3">{item.createdBy}</span>
      ),
    sortValue: (item) => item.createdBy,
  },
};

export function YoutubeCopywritingWorkspace({
  items,
  collections,
  products,
  campaigns,
  copyTypes,
  demo,
  initialSelection,
  initialSearch,
  initialView = 'grid',
  columns,
  unconfiguredColumns = false,
}: YoutubeCopywritingWorkspaceProps) {
  // Label and order from the resolver, rendering from the registry, joined by the ONE adapter.
  const grid = useMemo(
    () =>
      gridColumnsFrom(columns, YOUTUBE_COPY_RENDERERS, {
        freezeFirst: true,
        frozenMinWidth: 120,
      }),
    [columns],
  );
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [search, setSearch] = useState(initialSearch);
  const [activeView, setActiveView] = useState<ViewType>(initialView);
  const [kanbanGroup, setKanbanGroup] = useState<KanbanGroup>('status');

  const select = useCallback((id: string | null) => {
    setSelection(id);
    syncUrl(SELECTION_PARAM, id);
  }, []);

  const filter = useCallback((next: string) => {
    setSearch(next);
    syncUrl(SEARCH_PARAM, next);
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

  /** A kanban drop: only the id and the grouped field travel, so nothing else on the row changes. */
  const move = useCallback(
    (id: string, value: string) => {
      const form = new FormData();
      form.set('id', id);
      form.set(kanbanGroup, value);
      startTransition(() => {
        void updateYoutubeCopyAction(null, form).then(() => {
          router.refresh();
        });
      });
    },
    [kanbanGroup, router],
  );

  const term = search.trim();
  const query = term.toLowerCase();
  const visible = useMemo(
    () => (query === '' ? items : items.filter((item) => matchesQuery(item, query))),
    [items, query],
  );
  const narrowed = visible.length !== items.length;

  const open = items.find((item) => item.id === selection) ?? null;
  const creating = selection === NEW_YOUTUBE_COPY;

  const kanbanItems: readonly KanbanItem[] = useMemo(
    () =>
      visible.map((item) => ({
        id: item.id,
        name: item.title,
        groupValue: kanbanValueOf(item, kanbanGroup),
        subtitle: item.headline ?? undefined,
        chipLabel: item.statusLabel,
        chipTone: item.statusTone,
        accentTone: item.statusTone,
      })),
    [visible, kanbanGroup],
  );

  const kanbanColumns = useMemo(() => kanbanColumnsFor(kanbanGroup), [kanbanGroup]);

  const newCopy = (slot: string) => (
    <Button
      size="sm"
      onClick={() => {
        select(NEW_YOUTUBE_COPY);
      }}
      data-slot={slot}
    >
      New copy
    </Button>
  );

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">
          YouTube Copywriting
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">YouTube Copywriting</h1>
          {newCopy('new-youtube-copy')}
        </div>
        <p className="text-sm text-text2">
          <span data-slot="youtube-copy-count">{countLabel(items.length, visible.length)}</span> —
          the pre-roll copy, numbered as it is written and tied to the offer it sells.
        </p>
      </header>

      <section aria-labelledby="youtube-copy-heading" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="youtube-copy-heading" className="text-sm font-medium text-text2">
              Library
            </h2>
            <ViewSwitcher
              tableKey={TABLE_KEY}
              supportedViews={[...CAPABILITY.supportedViews]}
              activeView={activeView}
              onViewChange={setActiveView}
              kanbanGroupByField={kanbanGroup}
            />
            <ColumnNotices
              slotPrefix="youtube-copy"
              unconfigured={unconfiguredColumns}
              missing={grid.missing}
              registryName="YOUTUBE_COPY_RENDERERS in youtube-copywriting-workspace.tsx"
            />
            {activeView === 'kanban' ? (
              <Tabs
                value={kanbanGroup}
                onValueChange={(value) => {
                  setKanbanGroup(value === 'funnel' ? 'funnel' : 'status');
                }}
              >
                <TabsList aria-label="Group kanban by" data-slot="youtube-copy-kanban-group">
                  {CAPABILITY.kanbanFields.map((field) => (
                    <TabsTrigger key={field.field} value={field.field}>
                      {field.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            ) : null}
          </div>
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              filter(event.target.value);
            }}
            placeholder="Search copy, angle, status or link"
            aria-label="Search YouTube copy"
            data-slot="youtube-copy-search"
            className="h-8 w-full sm:w-64"
          />
        </div>

        {activeView === 'kanban' ? (
          <KanbanBoard
            items={kanbanItems}
            columns={kanbanColumns.map((column) => column.value)}
            columnLabels={Object.fromEntries(
              kanbanColumns.map((column) => [column.value, column.label]),
            )}
            onMove={move}
            onCardClick={(card) => {
              select(card.id);
            }}
            demo={demo}
          />
        ) : (
          <AirtableGrid
            tableKey={TABLE_KEY}
            columns={grid.columns}
            rows={visible}
            rowId={(item) => item.id}
            rowLabel={(item) => item.title}
            rowAttributes={(item) => ({ 'data-youtube-copy-id': item.id })}
            selectedId={selection}
            onRowClick={(item) => {
              select(item.id);
            }}
            tableSlot="youtube-copy-table"
            rowSlot="youtube-copy-row"
            empty={
              <div
                data-slot="youtube-copy-empty"
                className="flex flex-col items-center gap-3 text-center"
              >
                <p className="text-sm text-text2">{narrowed ? NO_MATCH_NOTE : NO_COPY_NOTE}</p>
                {narrowed ? (
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
                ) : (
                  newCopy('empty-new-youtube-copy')
                )}
              </div>
            }
          />
        )}
      </section>

      {creating || open !== null ? (
        <YoutubeCopyPanel
          key={selection}
          item={creating ? null : open}
          collections={collections}
          products={products}
          campaigns={campaigns}
          copyTypes={copyTypes}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
