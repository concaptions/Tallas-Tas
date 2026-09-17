'use client';

import { groupByInternalStatus, internalQueueColumns } from '@tas/domain/state';
import { StatusChip } from '@tas/ui';

import {
  EMPTY_COLUMN_NOTE,
  queueColumnView,
  queueCountLabel,
  queueItem,
  READ_ONLY_NOTE,
  type QueueSourceRow,
} from '@/app/app/queue/internal/fields';
import { QueueCard } from '@/app/app/queue/internal/queue-card';

/**
 * The two shapes the Internal Queue introduces, mounted as the product mounts them (CLAUDE.md UI
 * governance rule 4, ticket criterion 13): the QUEUE CARD and the QUEUE COLUMN.
 *
 * Nothing is re-implemented and nothing is faked: `QueueCard` is the identical component
 * `/app/queue/internal` renders, fed plain rows through the route's own `queueItem`, so every chip
 * tone, priority label and thumbnail tile shown here is the one the board shows. The column order
 * and its labels come from `internalQueueColumns()`, so this preview cannot drift from PRD §9
 * either.
 *
 * A client module because `QueueCard` is a `next/link` anchor and the column strip is the same
 * scrolling container the board uses; both belong in the browser exactly as the route has them.
 */
const BRAND = '11111111-1111-4111-8111-000000000002';

/** Four rows covering every branch the card has: the three tile sources, and no priority at all. */
const SAMPLE_ROWS: readonly QueueSourceRow[] = [
  {
    id: 'ds-queue-1',
    name: 'TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2',
    internalStatus: 'approved',
    brandId: BRAND,
    assignee: 'Dorian Vance',
    priority: 'Video High',
    designFileUrl: 'https://frame.example/niagara/tv1-b1-v2-master',
    inspoLinks: ['https://www.youtube.com/watch?v=nm1TxQj9IsQ'],
  },
  {
    id: 'ds-queue-2',
    name: 'MS2-B2-It Is Not Just Your Age-Yapper Style-V1',
    internalStatus: 'static_design_in_progress',
    brandId: BRAND,
    assignee: 'Rhiannon Okafor',
    priority: 'Static High',
    designFileUrl: null,
    inspoLinks: ['https://www.tiktok.com/@thepostpartumplan/video/7385012994771635745'],
  },
  {
    id: 'ds-queue-3',
    name: 'RS1-B4-Standalone-V3-NIGHT RESET BUNDLE',
    internalStatus: 'images_revisions',
    brandId: BRAND,
    assignee: null,
    priority: null,
    designFileUrl: null,
    inspoLinks: [],
  },
  {
    id: 'ds-queue-4',
    name: 'AM1-B2-Make 9am Look Like 3am-Green Screen-V1',
    internalStatus: 'ad_submitted',
    brandId: BRAND,
    assignee: 'Imogen Bardsley',
    priority: 'Video Average',
    designFileUrl: null,
    inspoLinks: [
      'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=CA&id=1204339857741622',
    ],
  },
];

const SAMPLE_ITEMS = SAMPLE_ROWS.map((row) => queueItem(row, `/app/briefs/${row.id}`));

/**
 * The card: generated name in monospace, the labelled tile, the assignee and the priority chip —
 * and the unassigned, unprioritised case, which shows an italic word and NO chip rather than a
 * blank pill.
 */
export function QueueCardStory() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {SAMPLE_ITEMS.map((item) => (
        <QueueCard key={item.id} item={item} />
      ))}
    </div>
  );
}

/**
 * The strip: every column of PRD §9 in order, each with its label and count, empty ones keeping
 * their place. It scrolls inside its own container — drag it sideways here and the page does not
 * move, which is the behaviour criterion 12 requires at 390px.
 */
export function QueueColumnStory() {
  const columns = groupByInternalStatus(SAMPLE_ITEMS);

  return (
    <div className="flex flex-col gap-2">
      <div className="-mx-1 min-w-0 overflow-x-auto px-1 pb-2">
        <div className="flex w-max items-start gap-3">
          {columns.map((column) => {
            const head = queueColumnView(column);
            return (
              <section
                key={column.key}
                aria-label={`${column.label}, ${queueCountLabel(column.count)}`}
                className="flex w-60 shrink-0 flex-col gap-2 rounded-card border border-line bg-surface2 p-3"
              >
                <header className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 text-[11px] font-medium tracking-wide text-text2 uppercase">
                    {column.label}
                  </h3>
                  <StatusChip tone={head.tone} label={String(column.count)} />
                </header>
                {column.count === 0 ? (
                  <p className="py-2 text-xs text-text4">{EMPTY_COLUMN_NOTE}</p>
                ) : (
                  column.rows.map((item) => <QueueCard key={item.id} item={item} />)
                )}
              </section>
            );
          })}
        </div>
      </div>
      <p className="font-mono text-[10px] text-text4">
        {String(internalQueueColumns().length)} columns from internalQueueColumns() ·{' '}
        {READ_ONLY_NOTE}
      </p>
    </div>
  );
}
