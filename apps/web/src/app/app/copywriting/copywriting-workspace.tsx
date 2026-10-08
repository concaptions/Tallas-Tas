'use client';

import { useCallback, useMemo, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { copyFunnelLabel } from '@tas/domain/copy';
import { getTableCapability, type ViewType } from '@tas/domain';
import { clientApprovalLabel, clientApprovalTone } from '@tas/domain/state';
import {
  Button,
  DEMO_WRITE_HINT,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  StatusChip,
} from '@tas/ui';

import { ColumnNotices, KanbanBoard, ViewSwitcher, type KanbanItem } from '@/components/views';
import { AirtableGrid } from '@/components/views/airtable-grid';
import { ChipListCell, TextCell } from '@/components/views/grid-cells';
import {
  gridColumnsFrom,
  type ColumnRegistry,
  type ResolvedColumnView,
} from '@/components/views/resolved-columns';

import { CopyPanel } from './copy-panel';
import {
  EM_DASH,
  NEW_COPY_SOON_HINT,
  NO_COPY_NOTE,
  NO_MATCH_NOTE,
  PRIMARY_COPY_PREVIEW,
  SEARCH_PARAM,
  SELECTION_PARAM,
  booleanChip,
  copyCountLabel,
  filteredCopyCountLabel,
  matchesQuery,
  truncate,
  type CollectionChoice,
  type ConceptChoice,
  type CopyItem,
  type CopyTypeChoice,
  type CreativeChoice,
  type ProductChoice,
} from './fields';

/**
 * The Copywriting grid, its kanban and its side panel (PRD §5.11) — RESOLVER-DRIVEN since the
 * Gratsi column match (2026-10-04, `docs/audits/gratsi-column-diff-2026-10-04.md`): label, order
 * and visibility come from the brand's resolved column set, rendering from the registry below, and
 * the two are joined by the ONE `gridColumnsFrom` adapter, exactly as on YouTube Copywriting. The
 * hand-written six-header `<Table>` this replaces drew 6 of the Gratsi base's 30 fields.
 *
 * NOTHING IS RE-LABELLED HERE. `page.tsx` resolved the generated title, every status label and chip
 * tone, the linked names and every lookup string through the domain and `lookupRollup` before this
 * component saw a row; this file renders what it is handed and never compares a status to a literal.
 *
 * The Linked Creative cell is the one cell with a second interaction in it: it links to the brief's
 * own page, so the click is stopped from also opening the panel. An unattached row renders the
 * muted em dash instead — the ordinary case, not a broken one.
 */
interface CopywritingWorkspaceProps {
  /** The brand's ordered, labelled, visible columns, from `loadCopyColumns`. */
  readonly columns: readonly ResolvedColumnView[];
  /** True when `columns` is the parent master-set fallback because the brand resolved none. */
  readonly unconfiguredColumns?: boolean;
  readonly items: readonly CopyItem[];
  readonly creatives: readonly CreativeChoice[];
  readonly concepts: readonly ConceptChoice[];
  /** The brand's collections, for the panel's Linked Collection single-select (Oct 5). */
  readonly collections: readonly CollectionChoice[];
  /** The brand's products, for the panel's Linked Product single-select (Oct 5). */
  readonly products: readonly ProductChoice[];
  /** The brand's copy types, for the panel's picker; the page resolved them, this file never does. */
  readonly copyTypes: readonly CopyTypeChoice[];
  readonly demo: boolean;
  readonly initialSelection: string | null;
  readonly initialSearch: string;
  readonly initialView?: ViewType;
}

const COPY_CAP = getTableCapability('copywriting') as NonNullable<
  ReturnType<typeof getTableCapability>
>;

/** Writes `?copy=` and `?q=` without a server round trip; Next.js reads the History API back. */
function syncUrl(selection: string | null, search: string): void {
  const url = new URL(window.location.href);
  if (selection === null) {
    url.searchParams.delete(SELECTION_PARAM);
  } else {
    url.searchParams.set(SELECTION_PARAM, selection);
  }
  if (search.trim() === '') {
    url.searchParams.delete(SEARCH_PARAM);
  } else {
    url.searchParams.set(SEARCH_PARAM, search);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

/** Capitalize a raw status value for display as a kanban column label. */
function capitalize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function dash(value: string | null) {
  return value === null || value === '' ? <span className="text-text4">{EM_DASH}</span> : value;
}

/**
 * THE Copywriting renderer registry, keyed by the resolver's `column_key` — every key of the
 * template's ten-field master set AND of Gratsi's twenty-five (the virtual `lookupRollup` columns
 * included), so `ColumnNotices` never has a "not drawn here" to report on either base.
 *
 * `copy_number` is the generated Copy # title and keeps its `copy-row-title` hook and `font-mono`
 * (CLAUDE.md non-negotiable 6 — generated output always renders in the mono face), as do the
 * campaign names and codes, which are system output of the campaign name formula.
 */
const COPY_RENDERERS: ColumnRegistry<CopyItem> = {
  copy_number: {
    render: (item) => (
      <span data-slot="copy-row-title" className="font-mono text-xs font-medium whitespace-nowrap">
        {item.title}
      </span>
    ),
    sortValue: (item) => item.copyNumber,
  },
  creative_brief_id: {
    render: (item) =>
      item.creativeName === null || item.creativeHref === null ? (
        <span data-slot="copy-row-unlinked" className="text-text3">
          {EM_DASH}
        </span>
      ) : (
        <Link
          href={item.creativeHref}
          data-slot="copy-row-creative"
          onClick={(event: MouseEvent<HTMLAnchorElement>) => {
            event.stopPropagation();
          }}
          className="inline-flex rounded-input border border-line bg-surface2 px-1.5 py-0.5 font-mono text-[11px] text-text2 hover:border-accent-line hover:text-accent"
        >
          {item.creativeName}
        </Link>
      ),
    sortValue: (item) => item.creativeName,
    minWidth: 220,
  },
  status: {
    render: (item) => <StatusChip tone={item.statusTone} label={item.statusLabel} />,
    sortValue: (item) => item.statusLabel,
  },
  collections: {
    render: (item) => (
      <ChipListCell
        chips={item.collections.map((entry) => ({ label: entry.label, tone: 'info' }))}
      />
    ),
    sortValue: (item) => item.collections.length,
  },
  product_id: {
    render: (item) => <TextCell value={item.productName} maxWidth={200} />,
    sortValue: (item) => item.productName,
  },
  angle: {
    render: (item) => <TextCell value={item.angleName} maxWidth={220} />,
    sortValue: (item) => item.angleName,
  },
  primary_copy: {
    render: (item) =>
      item.primaryCopy === null ? dash(null) : truncate(item.primaryCopy, PRIMARY_COPY_PREVIEW),
    cellTitle: (item) => item.primaryCopy ?? undefined,
    minWidth: 260,
  },
  headline: {
    render: (item) => dash(item.headline),
    sortValue: (item) => item.headline,
    minWidth: 220,
  },
  link_description: {
    render: (item) => <TextCell value={item.linkDescription} maxWidth={240} />,
    sortValue: (item) => item.linkDescription,
  },
  cta: {
    render: (item) => dash(item.cta),
    sortValue: (item) => item.cta,
  },
  copywriting_campaigns: {
    render: (item) => (
      <ChipListCell
        chips={item.campaigns.map((entry) => ({ label: entry.label, tone: 'accent' }))}
      />
    ),
    sortValue: (item) => item.campaigns.length,
  },
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
  funnel: {
    render: (item) => dash(copyFunnelLabel(item.funnel)),
    sortValue: (item) => item.funnel,
  },
  copywriting_copy_types: {
    render: (item) => (
      <ChipListCell chips={item.copyTypeNames.map((name) => ({ label: name, tone: 'info' }))} />
    ),
    sortValue: (item) => item.copyTypeNames.length,
  },
  client_comment: {
    render: (item) => <TextCell value={item.clientComment} maxWidth={260} />,
    sortValue: (item) => item.clientComment,
  },
  collection_url: {
    render: (item) => <TextCell value={item.collectionUrls} maxWidth={240} />,
    sortValue: (item) => item.collectionUrls,
  },
  link_from_product: {
    render: (item) => <TextCell value={item.productLink} maxWidth={240} />,
    sortValue: (item) => item.productLink,
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
    render: (item) =>
      item.metaRating === null ? (
        dash(null)
      ) : (
        <span className="font-mono text-xs">{String(item.metaRating)}</span>
      ),
    sortValue: (item) => item.metaRating,
    align: 'right',
  },
  products_from_collections: {
    render: (item) => <TextCell value={item.collectionProducts} maxWidth={220} />,
    sortValue: (item) => item.collectionProducts,
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
  internal_product: {
    render: (item) => <TextCell value={item.productName} maxWidth={200} />,
    sortValue: (item) => item.productName,
  },
  client_approval_status: {
    render: (item) => {
      const key = item.clientApprovalStatus;
      if (key === null) return dash(null);
      return (
        <StatusChip
          tone={clientApprovalTone(key) as import('@tas/domain/state').ChipTone}
          label={clientApprovalLabel(key)}
        />
      );
    },
    sortValue: (item) => clientApprovalLabel(item.clientApprovalStatus),
  },
};

export function CopywritingWorkspace({
  columns,
  unconfiguredColumns = false,
  items,
  creatives,
  concepts,
  collections,
  products,
  copyTypes,
  demo,
  initialSelection,
  initialSearch,
  initialView,
}: CopywritingWorkspaceProps) {
  // Label and order from the resolver, rendering from the registry, joined by the ONE adapter.
  const grid = useMemo(
    () =>
      gridColumnsFrom(columns, COPY_RENDERERS, {
        freezeFirst: true,
        frozenMinWidth: 120,
      }),
    [columns],
  );
  const router = useRouter();
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [search, setSearch] = useState(initialSearch);
  const [activeView, setActiveView] = useState<ViewType>(initialView ?? 'grid');

  const select = useCallback(
    (id: string | null) => {
      setSelection(id);
      syncUrl(id, search);
    },
    [search],
  );

  const filter = useCallback(
    (next: string) => {
      setSearch(next);
      syncUrl(selection, next);
    },
    [selection],
  );

  const close = useCallback(() => {
    select(null);
  }, [select]);

  const clearSearch = useCallback(() => {
    filter('');
  }, [filter]);

  const saved = useCallback(() => {
    router.refresh();
  }, [router]);

  const query = search.trim().toLowerCase();
  const visible = useMemo(
    () => (query === '' ? items : items.filter((item) => matchesQuery(item, query))),
    [items, query],
  );

  const narrowed = visible.length !== items.length;
  const open = items.find((item) => item.id === selection) ?? null;

  const kanbanItems: KanbanItem[] = useMemo(
    () =>
      visible.map((item) => ({
        id: item.id,
        name: item.title,
        groupValue: item.status,
        subtitle: item.headline ?? undefined,
        chipLabel: item.statusLabel,
        chipTone: item.statusTone,
      })),
    [visible],
  );

  const kanbanColumns = useMemo(
    () => [...new Set(kanbanItems.map((ki) => ki.groupValue))],
    [kanbanItems],
  );

  const kanbanLabels = useMemo(
    () => Object.fromEntries(kanbanColumns.map((col) => [col, capitalize(col)])),
    [kanbanColumns],
  );

  const handleKanbanMove = useCallback(() => {
    /* will be wired to updateCopyAction in a follow-up */
  }, []);

  /**
   * "New copy" is a write, so demo mode disables it with the standard reason. It is disabled in
   * live mode too, with its own reason: creating a copy row is explicitly out of this ticket's
   * scope, so the button would have nothing to submit.
   */
  const newCopy = (slot: string) => (
    <DisabledWrite active hint={demo ? DEMO_WRITE_HINT : NEW_COPY_SOON_HINT}>
      <Button size="sm" disabled className={disabledWriteClassName} data-slot={slot}>
        New copy
      </Button>
    </DisabledWrite>
  );

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Copywriting</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Copywriting</h1>
          {newCopy('new-copy')}
        </div>
        <p className="text-sm text-text2">
          <span data-slot="copy-count">
            {narrowed
              ? filteredCopyCountLabel(visible.length, items.length)
              : copyCountLabel(items.length)}
          </span>{' '}
          — ad copy written separately, tied to the creative it runs against.
        </p>
      </header>

      <section aria-labelledby="copywriting-heading" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="copywriting-heading" className="text-sm font-medium text-text2">
              Library
            </h2>
            <ViewSwitcher
              tableKey="copywriting"
              supportedViews={[...COPY_CAP.supportedViews]}
              activeView={activeView}
              onViewChange={setActiveView}
              kanbanGroupByField="status"
            />
            <ColumnNotices
              slotPrefix="copy"
              unconfigured={unconfiguredColumns}
              missing={grid.missing}
              registryName="COPY_RENDERERS in copywriting-workspace.tsx"
            />
          </div>
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              filter(event.target.value);
            }}
            placeholder="Search copy"
            aria-label="Search copy by title, headline, body, creative or status"
            data-slot="copy-search"
            className="h-8 w-full sm:w-64"
          />
        </div>

        {activeView === 'kanban' ? (
          <KanbanBoard
            items={kanbanItems}
            columns={kanbanColumns}
            columnLabels={kanbanLabels}
            onMove={handleKanbanMove}
            demo={demo}
          />
        ) : (
          <AirtableGrid
            tableKey="copywriting"
            columns={grid.columns}
            rows={visible}
            rowId={(item) => item.id}
            rowLabel={(item) => item.title}
            rowAttributes={(item) => ({ 'data-copy-id': item.id })}
            selectedId={selection}
            onRowClick={(item) => {
              select(item.id);
            }}
            tableSlot="copy-table"
            rowSlot="copy-row"
            empty={
              <div data-slot="copy-empty" className="flex flex-col items-center gap-3 text-center">
                <p className="text-sm text-text2">{narrowed ? NO_MATCH_NOTE : NO_COPY_NOTE}</p>
                {narrowed ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearSearch}
                    data-slot="clear-search"
                  >
                    Clear search
                  </Button>
                ) : (
                  newCopy('empty-new-copy')
                )}
              </div>
            }
          />
        )}
      </section>

      {open === null ? null : (
        <CopyPanel
          key={open.id}
          item={open}
          creatives={creatives}
          concepts={concepts}
          collections={collections}
          products={products}
          copyTypes={copyTypes}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      )}
    </div>
  );
}
