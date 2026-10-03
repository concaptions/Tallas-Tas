'use client';

import {
  BoolCell,
  ChipCell,
  ChipListCell,
  CountCell,
  DateCell,
  EmptyCell,
  LinkCell,
  MetricCell,
  MoneyCell,
  TextCell,
} from '@/components/views/grid-cells';
import { ThemePanel } from '@/app/app/themes/theme-panel';
import type { ThemeCardRow } from '@/app/app/themes/fields';

/**
 * The grid cell primitives every Airtable-style table composes (P2A grid wiring, UI governance
 * rule 4). One row per primitive: the value it was handed, how it reads. The stored `"null"` case is
 * here on purpose — it is what an imported collaborator field can carry, and it must never show.
 */
const CELLS: readonly { readonly label: string; readonly cell: React.ReactNode }[] = [
  { label: 'EmptyCell', cell: <EmptyCell /> },
  {
    label: 'TextCell — prose, clipped',
    cell: (
      <TextCell
        value="A long note a strategist wrote about when this theme earns its place in a batch, clipped at the column width."
        maxWidth={240}
      />
    ),
  },
  { label: 'TextCell — stored "null"', cell: <TextCell value="null" /> },
  { label: 'TextCell — mono', cell: <TextCell value="@danielle.okonkwo" mono /> },
  {
    label: 'BoolCell — true / false',
    cell: (
      <span className="flex gap-3">
        <BoolCell value />
        <BoolCell value={false} />
      </span>
    ),
  },
  { label: 'ChipCell', cell: <ChipCell chip={{ label: 'Approved', tone: 'ok' }} /> },
  {
    label: 'ChipListCell',
    cell: (
      <ChipListCell
        chips={[
          { label: 'Static', tone: 'accent' },
          { label: 'Video', tone: 'accent' },
        ]}
      />
    ),
  },
  { label: 'LinkCell', cell: <LinkCell value="https://foreplay.example/swipe/1234" /> },
  {
    label: 'CountCell — 3 / 0',
    cell: (
      <span className="flex gap-3">
        <CountCell count={3} noun="link" />
        <CountCell count={0} noun="link" />
      </span>
    ),
  },
  { label: 'DateCell', cell: <DateCell value={new Date('2026-07-22T10:00:00Z')} /> },
  { label: 'MoneyCell', cell: <MoneyCell value={750} /> },
  // A figure the server already formatted, in the mono face. The empty case takes either dash
  // constant, because a formatter that returned one must not then be rendered as a value.
  { label: 'MetricCell', cell: <MetricCell label="4.12%" /> },
  { label: 'MetricCell (empty)', cell: <MetricCell label="—" /> },
];

export function GridCellsStory() {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full border-collapse text-sm" data-slot="grid-cells-story">
        <tbody>
          {CELLS.map((entry) => (
            <tr key={entry.label} className="border-b border-line/60 last:border-b-0">
              <td className="px-3 py-1.5 font-mono text-[11px] text-text3">{entry.label}</td>
              <td className="px-3 py-1.5 text-text2">{entry.cell}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SAMPLE_THEME: ThemeCardRow = {
  id: 'theme-story',
  name: 'Problem → Solution',
  category: 'Framework',
  status: 'in_progress',
  notes: 'Open on the pain, land on the product. The default theme for a first batch.',
  referenceLinks: ['https://foreplay.example/swipe/1234'],
  usedByBrandCount: 1,
  isActive: true,
  // An imported Gratsi row: the Airtable collaborator's name, shown as plain text.
  assigneeId: 'Talal',
  assigneeName: null,
  attachments: [],
  aiAttachmentSummary: null,
};

/** The theme panel, inline rather than fixed so the story sits in the page flow. */
export function ThemePanelStory() {
  return (
    <div className="relative h-[520px] overflow-hidden rounded-card border border-line">
      <div className="[&>aside]:absolute [&>aside]:w-full [&>aside]:max-w-[480px]">
        <ThemePanel
          theme={SAMPLE_THEME}
          demo
          onClose={() => {
            /* story */
          }}
          onToggled={() => {
            /* story */
          }}
        />
      </div>
    </div>
  );
}
