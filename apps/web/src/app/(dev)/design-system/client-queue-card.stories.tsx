'use client';

import { clientQueueColumns, groupByClientStatus } from '@tas/domain/state';

import { ClientQueueCard } from '@/app/app/queue/client/client-queue-card';
import {
  CLIENT_QUEUE_RULE_NOTE,
  clientQueueColumnView,
  clientQueueCountLabel,
  clientQueueItem,
  EMPTY_COLUMN_NOTE,
  type ClientQueueSourceRow,
} from '@/app/app/queue/client/fields';
import { QueueColumnPanel, QueueStrip } from '@/components/queue/queue-strip';

/**
 * The two shapes the Client Queue introduces (CLAUDE.md UI governance rule 4, ticket criterion 11):
 * the CLIENT QUEUE CARD — the Internal Queue's card face plus a client-status chip and the two write
 * controls PRD §10 gives the client — and the CLIENT COLUMN STRIP over `clientQueueColumns()`.
 *
 * Nothing is re-implemented and nothing is faked: `ClientQueueCard` is the identical component
 * `/app/queue/client` renders, fed plain rows through the route's own `clientQueueItem`, and the
 * strip is the shared `QueueStrip`/`QueueColumnPanel` both boards use. So every chip tone, priority
 * label, thumbnail tile and column label shown here is the one the board shows.
 *
 * BOTH WRITE CONTROLS ARE MOUNTED IN THEIR DISABLED STATE (`demo`), which is the state the
 * deployment actually runs in: wrapped in `DisabledWrite`, carrying `disabledWriteClassName` and the
 * tooltip that says why. The enabled state is deliberately NOT previewed — a live Approve button on
 * the design-system page would be a write control with a real Server Action behind it.
 *
 * A client module because the card holds `useActionState` and the strip is the same scrolling
 * container the board uses; both belong in the browser exactly as the route has them.
 */

/** Three rows covering the card's branches: both tile sources, and the unassigned, unprioritised case. */
const SAMPLE_ROWS: readonly ClientQueueSourceRow[] = [
  {
    id: 'ds-client-queue-1',
    name: 'TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2',
    internalStatus: 'approved',
    clientStatus: 'pending_for_approval',
    assignee: 'Dorian Vance',
    priority: 'Video High',
    designFileUrl: 'https://frame.example/niagara/tv1-b1-v2-master',
    inspoLinks: [],
  },
  {
    id: 'ds-client-queue-2',
    name: 'TV2-B3-Sleep In The Ninety Minutes You Actually Get-Yapper Style-V1',
    internalStatus: 'approved',
    clientStatus: 'pending_for_approval',
    assignee: null,
    priority: null,
    designFileUrl: null,
    inspoLinks: ['https://www.tiktok.com/@thepostpartumplan/video/7385012994771635745'],
  },
  {
    id: 'ds-client-queue-3',
    name: 'RS1-B4-Standalone-V3-NIGHT RESET BUNDLE',
    internalStatus: 'approved',
    clientStatus: 'approved',
    assignee: 'Rhiannon Okafor',
    priority: 'Static Average',
    designFileUrl: 'https://frame.example/niagara/rs1-b4-v3-client-markup',
    inspoLinks: [],
  },
];

const SAMPLE_ITEMS = SAMPLE_ROWS.map((row) => clientQueueItem(row, `/app/briefs/${row.id}`));

/**
 * The card: the shared face, the client-status chip, and Approve / Request Revisions both inert with
 * the demo-mode tooltip. The middle card is the unassigned, unprioritised case — an italic word and
 * NO priority chip, rather than a blank pill.
 */
export function ClientQueueCardStory() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {SAMPLE_ITEMS.map((item) => (
        <ClientQueueCard key={item.id} item={item} demo />
      ))}
    </div>
  );
}

/**
 * The strip: `CLIENT_STATUS` in PRD §9 order with `launched` removed, each column with its label and
 * count, empty ones keeping their place. It scrolls inside its own container — drag it sideways here
 * and the page does not move, which is the behaviour criterion 10 requires at 390px.
 */
export function ClientQueueColumnStory() {
  const columns = groupByClientStatus(SAMPLE_ITEMS);

  return (
    <div className="flex flex-col gap-2">
      <QueueStrip slot="ds-client-queue-board" label="Client status board preview">
        {columns.map((column) => {
          const head = clientQueueColumnView(column);
          return (
            <QueueColumnPanel
              key={column.key}
              slot="ds-client-queue-column"
              statusKey={column.key}
              label={column.label}
              description={column.description}
              tone={head.tone}
              count={column.count}
              countLabel={clientQueueCountLabel(column.count)}
              emptyNote={EMPTY_COLUMN_NOTE}
            >
              {column.rows.map((item) => (
                <ClientQueueCard key={item.id} item={item} demo />
              ))}
            </QueueColumnPanel>
          );
        })}
      </QueueStrip>
      <p className="font-mono text-[10px] text-text4">
        {String(clientQueueColumns().length)} columns from clientQueueColumns() ·{' '}
        {CLIENT_QUEUE_RULE_NOTE}
      </p>
    </div>
  );
}
