'use client';

import { useCallback, useMemo, useState, useTransition, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  DEMO_WRITE_HINT,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  StatusChip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tas/ui';
import { getTableCapability, type ViewType } from '@tas/domain';

import {
  ViewSwitcher,
  KanbanBoard,
  GalleryView,
  type KanbanItem,
  type GalleryItem,
} from '@/components/views';

import { updateBriefAction } from './actions';
import { BriefPanel } from './brief-panel';
import {
  BRIEF_COLUMNS,
  EM_DASH,
  NEW_BRIEF_SOON_HINT,
  NO_BRIEFS_NOTE,
  NO_MATCH_NOTE,
  SEARCH_PARAM,
  STANDALONE_CONCEPT_SLUG,
  briefCountLabel,
  filteredBriefCountLabel,
  matchesQuery,
  type BriefItem,
} from './fields';

interface BriefsWorkspaceProps {
  readonly items: readonly BriefItem[];
  readonly demo: boolean;
  readonly initialSearch: string;
  readonly initialView: ViewType;
  readonly initialKanbanField: string | null;
}

function syncUrl(search: string): void {
  const url = new URL(window.location.href);
  if (search.trim() === '') {
    url.searchParams.delete(SEARCH_PARAM);
  } else {
    url.searchParams.set(SEARCH_PARAM, search);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

const BRIEFS_CAP = getTableCapability('briefs') as NonNullable<
  ReturnType<typeof getTableCapability>
>;

export function BriefsWorkspace({
  items,
  demo,
  initialSearch,
  initialView,
  initialKanbanField,
}: BriefsWorkspaceProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [activeView, setActiveView] = useState<ViewType>(initialView);
  const [kanbanField, setKanbanField] = useState<string>(
    initialKanbanField ?? BRIEFS_CAP.kanbanFields[0]?.field ?? 'clientStatus',
  );
  const [, startTransition] = useTransition();

  const filter = useCallback((next: string) => {
    setSearch(next);
    syncUrl(next);
  }, []);

  const clearSearch = useCallback(() => {
    setSearch('');
    syncUrl('');
  }, []);

  const open = useCallback(
    (item: BriefItem) => {
      router.push(item.href);
    },
    [router],
  );

  // The board's quick-look panel (P2B-3): a card click opens it beside the columns instead of
  // navigating away. The full page is one button further, so triaging a column costs no navigation.
  const [panelId, setPanelId] = useState<string | null>(null);

  const openPanel = useCallback((card: KanbanItem) => {
    setPanelId(card.id);
  }, []);

  const closePanel = useCallback(() => {
    setPanelId(null);
  }, []);

  const onRowKey = (event: KeyboardEvent<HTMLTableRowElement>, item: BriefItem) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open(item);
    }
  };

  const query = search.trim().toLowerCase();
  const visible = useMemo(
    () => (query === '' ? items : items.filter((item) => matchesQuery(item, query))),
    [items, query],
  );

  const narrowed = visible.length !== items.length;

  const panelItem = items.find((item) => item.id === panelId) ?? null;

  const handleKanbanMove = useCallback(
    (itemId: string, newValue: string) => {
      if (demo) return;
      const item = items.find((i) => i.id === itemId);
      if (!item) return;

      startTransition(() => {
        const fd = new FormData();
        fd.set('id', item.id);
        const snap = item.formSnapshot;
        fd.set('conceptId', snap.conceptId);
        fd.set('funnel', snap.funnel);
        fd.set('type', snap.type);
        fd.set('version', snap.version);
        fd.set('batch', snap.batch);
        fd.set('product', snap.product);
        fd.set('priority', snap.priority);
        fd.set('assignee', snap.assignee);
        fd.set('briefToDesign', snap.briefToDesign);
        fd.set('scriptContent', snap.scriptContent);
        fd.set('elementsTested', snap.elementsTested);
        fd.set('adContent', snap.adContent);
        fd.set('inspiration', snap.inspiration);
        fd.set('offer', snap.offer);
        fd.set('language', snap.language);
        fd.set('spellingFeedback2', snap.spellingFeedback2);
        fd.set('angleId', snap.angleId);
        fd.set('productId', snap.productId);
        for (const link of snap.inspoLinks) {
          fd.append('inspoLinks', link);
        }
        for (const dim of snap.dimensions) {
          fd.append('dimensions', dim);
        }
        fd.set('internalStatus', snap.internalStatus);
        fd.set('clientStatus', snap.clientStatus);

        fd.set(kanbanField, newValue);

        void updateBriefAction(null, fd);
      });
    },
    [demo, items, kanbanField],
  );

  // The board card carries what a media buyer scans for (P2B-2): the generated name, the concept it
  // belongs to, priority and type as chips, the assignee, and a left stripe coloured by the stage the
  // card sits in. Every tone comes from the domain's `chipTone`, never a locally chosen colour.
  const kanbanItems: readonly KanbanItem[] = useMemo(() => {
    return visible.map((item) => ({
      id: item.id,
      name: item.name,
      groupValue: item.kanbanFields[kanbanField] ?? '',
      subtitle: item.conceptName ?? STANDALONE_CONCEPT_SLUG,
      chipLabel: item.status.label,
      chipTone: item.status.tone,
      accentTone: item.status.tone,
      assignee: item.assignee,
      badges: [
        ...(item.priority === null
          ? []
          : [{ label: item.priority.label, tone: item.priority.tone }]),
        { label: item.typeLabel, tone: 'mute' as const },
      ],
      href: item.href,
    }));
  }, [visible, kanbanField]);

  const kanbanColumns = useMemo(() => {
    const seen = new Set<string>();
    for (const item of kanbanItems) {
      if (item.groupValue !== '') seen.add(item.groupValue);
    }
    return [...seen];
  }, [kanbanItems]);

  // Column headers are the domain's own status labels ("Sent to Video Editor",
  // "Pending for Approval"), never a re-capitalised key: both groupable fields are
  // status tracks and every item already carries their views, so the header can
  // never drift from `@tas/domain/state`.
  const kanbanLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const item of visible) {
      labels[item.status.key] = item.status.label;
      labels[item.clientStatus.key] = item.clientStatus.label;
    }
    return labels;
  }, [visible]);

  const galleryItems: readonly GalleryItem[] = useMemo(() => {
    return visible
      .filter((item) => item.galleryImageUrl !== null)
      .map((item) => ({
        id: item.id,
        name: item.name,
        imageUrl: item.galleryImageUrl,
        mediaType: 'image' as const,
        subtitle: item.conceptName ?? STANDALONE_CONCEPT_SLUG,
        href: item.href,
      }));
  }, [visible]);

  const newBrief = (slot: string) => (
    <DisabledWrite active hint={demo ? DEMO_WRITE_HINT : NEW_BRIEF_SOON_HINT}>
      <Button size="sm" disabled className={disabledWriteClassName} data-slot={slot}>
        New brief
      </Button>
    </DisabledWrite>
  );

  const kanbanFieldOptions = BRIEFS_CAP.kanbanFields;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Creative Design</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Creative Design</h1>
          {newBrief('new-brief')}
        </div>
        <p className="text-sm text-text2">
          <span data-slot="brief-count">
            {narrowed
              ? filteredBriefCountLabel(visible.length, items.length)
              : briefCountLabel(items.length)}
          </span>{' '}
          — one record per creative asset, named for you.
        </p>
      </header>

      <section aria-labelledby="briefs-heading" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 id="briefs-heading" className="text-sm font-medium text-text2">
              Pipeline
            </h2>
            <ViewSwitcher
              tableKey="briefs"
              supportedViews={[...BRIEFS_CAP.supportedViews]}
              activeView={activeView}
              onViewChange={setActiveView}
              kanbanGroupByField={kanbanField}
            />
          </div>
          <div className="flex items-center gap-2">
            {activeView === 'kanban' && kanbanFieldOptions.length > 1 ? (
              <select
                value={kanbanField}
                onChange={(e) => {
                  setKanbanField(e.target.value);
                }}
                className="h-8 rounded-input border border-line bg-surface px-2 text-xs text-text"
                aria-label="Group by"
              >
                {kanbanFieldOptions.map((opt) => (
                  <option key={opt.field} value={opt.field}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : null}
            <Input
              type="search"
              value={search}
              onChange={(event) => {
                filter(event.target.value);
              }}
              placeholder="Search briefs"
              aria-label="Search briefs by name, concept, type, priority, assignee or status"
              data-slot="brief-search"
              className="h-8 w-full sm:w-64"
            />
          </div>
        </div>

        {visible.length === 0 ? (
          <div
            data-slot="briefs-empty"
            className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-4 py-10 text-center"
          >
            <p className="text-sm text-text2">{narrowed ? NO_MATCH_NOTE : NO_BRIEFS_NOTE}</p>
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
              newBrief('empty-new-brief')
            )}
          </div>
        ) : activeView === 'kanban' ? (
          <KanbanBoard
            items={kanbanItems}
            columns={kanbanColumns}
            columnLabels={kanbanLabels}
            onMove={handleKanbanMove}
            demo={demo}
            onCardClick={openPanel}
          />
        ) : activeView === 'gallery' ? (
          <GalleryView items={galleryItems} />
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <Table data-slot="briefs-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {BRIEF_COLUMNS.map((column) => (
                    <TableHead key={column} className="px-3">
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((item) => (
                  <TableRow
                    key={item.id}
                    data-slot="brief-row"
                    data-brief-id={item.id}
                    role="button"
                    tabIndex={0}
                    aria-label={item.name}
                    onClick={() => {
                      open(item);
                    }}
                    onKeyDown={(event) => {
                      onRowKey(event, item);
                    }}
                    className="cursor-pointer"
                  >
                    <TableCell
                      data-slot="brief-row-name"
                      className="px-3 py-1.5 font-mono text-xs whitespace-normal text-text"
                    >
                      {item.name}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 whitespace-normal text-text2">
                      {item.conceptName ?? (
                        <span data-slot="brief-standalone">
                          <StatusChip tone="mute" label={STANDALONE_CONCEPT_SLUG} />
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-text2">{item.typeLabel}</TableCell>
                    <TableCell className="px-3 py-1.5">
                      {item.priority === null ? (
                        <span className="text-text4">{EM_DASH}</span>
                      ) : (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <StatusChip tone={item.priority.tone} label={item.priority.label} />
                          {item.priority.sla === null ? null : (
                            <span className="font-mono text-[11px] text-text3">
                              {item.priority.sla}
                            </span>
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 whitespace-normal text-text2">
                      {item.assignee ?? <span className="text-text4">{EM_DASH}</span>}
                    </TableCell>
                    <TableCell className="px-3 py-1.5">
                      <StatusChip tone={item.status.tone} label={item.status.label} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {panelItem === null ? null : (
        <BriefPanel item={panelItem} onClose={closePanel} onOpenFull={open} />
      )}
    </div>
  );
}
