'use client';

import type { ReactNode } from 'react';
import type { BriefStats, EditorBar, TurnaroundRow, WeeklyOutputPoint } from '@tas/db';
import type { ChipTone } from '@tas/domain/state';
import { SectionLabel } from '@tas/ui';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  EMPTY_APPROVED_WEEK,
  EMPTY_IN_FLIGHT,
  EMPTY_PER_EDITOR,
  EMPTY_REVISIONS,
  EMPTY_SUBMISSIONS_WINDOW,
  EMPTY_TURNAROUND,
  EMPTY_WEEKLY_OUTPUT,
} from './stats-copy';

/** Max editors drawn on the per-editor bar chart; the rest fold into a `+N more` note. */
const PER_EDITOR_CAP = 10;

/** Four creative types in the turnaround table column order (matches `creativeTypes` in @tas/db). */
const CREATIVE_TYPES = ['Video', 'Static', 'Carousel', 'Motion Image'] as const;

type SeriesTone = 'mute' | 'warn' | 'ok';

/**
 * Status-tone → CSS variable mapping (Ticket 12). Reuses the ChipTone vocabulary so the chart's
 * series colours match the status chips a brief wears elsewhere — one tone, one meaning. The
 * variables are defined in `packages/ui/src/styles/tokens.css` and both light and dark modes
 * redefine them, so the chart follows the theme without any hex entering this file.
 */
export function briefStatusToneColour(tone: ChipTone | SeriesTone): string {
  switch (tone) {
    case 'ok':
      return 'var(--ok)';
    case 'warn':
      return 'var(--warn)';
    case 'bad':
      return 'var(--bad)';
    case 'info':
      return 'var(--info)';
    case 'accent':
      return 'var(--accent)';
    case 'mute':
    default:
      return 'var(--text3)';
  }
}

const AXIS_COLOUR = 'var(--text3)';
const GRID_COLOUR = 'var(--line)';

/** The three series on the per-editor stacked bar; keyed to a ChipTone so the colour follows status. */
const EDITOR_SERIES: readonly {
  readonly key: keyof EditorBar;
  readonly label: string;
  readonly tone: SeriesTone;
}[] = [
  { key: 'assigned', label: 'Assigned', tone: 'mute' },
  { key: 'inReview', label: 'In review', tone: 'warn' },
  { key: 'approved', label: 'Approved', tone: 'ok' },
];

export interface StatsTabProps {
  readonly stats: BriefStats;
}

export function StatsTab({ stats }: StatsTabProps) {
  return (
    <div data-slot="brief-stats-tab" className="flex flex-col gap-8">
      <KpiRow stats={stats} />
      <PerEditorPanel bars={stats.perEditor} />
      <WeeklyOutputPanel points={stats.weeklyOutput} />
      <TurnaroundPanel rows={stats.turnaround} />
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * KPI tiles
 * ---------------------------------------------------------------------------------------------- */

function KpiRow({ stats }: { stats: BriefStats }) {
  const { kpi } = stats;
  return (
    <section
      data-slot="brief-stats-kpi"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <KpiTile
        slot="brief-stats-in-flight"
        label="Briefs in flight"
        value={kpi.inFlight === 0 ? null : kpi.inFlight.toString()}
        emptyCopy={EMPTY_IN_FLIGHT}
      />
      <KpiTile
        slot="brief-stats-approved-week"
        label="Approved this week"
        value={kpi.approvedThisWeek === 0 ? null : kpi.approvedThisWeek.toString()}
        emptyCopy={EMPTY_APPROVED_WEEK}
      />
      <KpiTile
        slot="brief-stats-avg-revision"
        label="Avg revision turnaround"
        value={kpi.avgRevisionHours === null ? null : formatHours(kpi.avgRevisionHours)}
        emptyCopy={EMPTY_REVISIONS}
      />
      <KpiTile
        slot="brief-stats-qa-pass-rate"
        label="QA pass rate (30d)"
        value={kpi.qaPassRatePct === null ? null : formatPercent(kpi.qaPassRatePct)}
        emptyCopy={EMPTY_SUBMISSIONS_WINDOW}
      />
    </section>
  );
}

/** `87.5%` when the fraction is non-trivial, otherwise rounded to an integer, per the ticket. */
export function formatPercent(pct: number): string {
  const rounded = Math.round(pct * 10) / 10;
  if (Number.isInteger(rounded)) {
    return `${Math.round(pct).toString()}%`;
  }
  return `${rounded.toFixed(1)}%`;
}

/** Hours rounded to one decimal when non-integer, `h` suffix. */
export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  if (Number.isInteger(rounded)) {
    return `${Math.round(hours).toString()} h`;
  }
  return `${rounded.toFixed(1)} h`;
}

interface KpiTileProps {
  readonly slot: string;
  readonly label: string;
  readonly value: string | null;
  readonly emptyCopy: string;
}

function KpiTile({ slot, label, value, emptyCopy }: KpiTileProps) {
  const isEmpty = value === null;
  return (
    <div
      data-slot={slot}
      className="flex flex-col gap-1 rounded-card border border-line bg-surface px-4 py-3"
    >
      <p className="font-mono text-[10.5px] tracking-wide text-text3 uppercase">{label}</p>
      <p className={isEmpty ? 'font-mono text-2xl text-text3' : 'font-mono text-2xl text-text'}>
        {isEmpty ? '—' : value}
      </p>
      {isEmpty ? (
        <p data-slot={`${slot}-empty`} className="text-xs text-text3">
          {emptyCopy}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Per-editor bars (stacked, grouped by assignee)
 * ---------------------------------------------------------------------------------------------- */

function PerEditorPanel({ bars }: { bars: readonly EditorBar[] }) {
  const topBars = bars.slice(0, PER_EDITOR_CAP);
  const remainder = bars.length - topBars.length;
  const data = topBars.map((bar) => ({
    editor: bar.editor,
    assigned: bar.assigned,
    inReview: bar.inReview,
    approved: bar.approved,
  }));
  return (
    <StatsPanel
      slot="brief-stats-per-editor"
      title="In the works"
      emptyCopy={EMPTY_PER_EDITOR}
      isEmpty={topBars.length === 0}
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 24, right: 24, top: 8, bottom: 8 }}
          >
            <CartesianGrid stroke={GRID_COLOUR} horizontal={false} />
            <XAxis
              type="number"
              stroke={AXIS_COLOUR}
              tick={{ fill: AXIS_COLOUR, fontSize: 11 }}
              allowDecimals={false}
            />
            <YAxis
              dataKey="editor"
              type="category"
              width={120}
              stroke={AXIS_COLOUR}
              tick={{ fill: AXIS_COLOUR, fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: 'var(--surface2)' }}
              contentStyle={{
                background: 'var(--surface)',
                border: `1px solid ${GRID_COLOUR}`,
                color: 'var(--text)',
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text2)' }} />
            {EDITOR_SERIES.map((series) => (
              <Bar
                key={series.key}
                dataKey={series.key}
                name={series.label}
                stackId="editor"
                fill={briefStatusToneColour(series.tone)}
                radius={[0, 2, 2, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {remainder > 0 ? (
        <p className="font-mono text-[11px] text-text3" data-slot="brief-stats-per-editor-more">
          +{remainder.toString()} more
        </p>
      ) : null}
    </StatsPanel>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Weekly output
 * ---------------------------------------------------------------------------------------------- */

function WeeklyOutputPanel({ points }: { points: readonly WeeklyOutputPoint[] }) {
  const todayIndex = (new Date().getDay() + 6) % 7; // 0 = Mon
  const data = points.map((p, index) => ({
    day: p.day,
    count: p.count,
    today: index === todayIndex,
  }));
  const total = points.reduce((sum, p) => sum + p.count, 0);
  return (
    <StatsPanel
      slot="brief-stats-weekly"
      title="Weekly output"
      emptyCopy={EMPTY_WEEKLY_OUTPUT}
      isEmpty={total === 0}
    >
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
            <CartesianGrid stroke={GRID_COLOUR} strokeDasharray="2 4" />
            <XAxis
              dataKey="day"
              stroke={AXIS_COLOUR}
              tick={({ x, y, payload }: { x: number; y: number; payload: { value: string } }) => {
                const isToday = payload.value === points[todayIndex]?.day;
                return (
                  <text
                    x={x}
                    y={y + 14}
                    fill={AXIS_COLOUR}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={isToday ? 600 : 400}
                  >
                    {payload.value}
                  </text>
                );
              }}
            />
            <YAxis
              stroke={AXIS_COLOUR}
              tick={{ fill: AXIS_COLOUR, fontSize: 11 }}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ stroke: GRID_COLOUR }}
              contentStyle={{
                background: 'var(--surface)',
                border: `1px solid ${GRID_COLOUR}`,
                color: 'var(--text)',
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke={briefStatusToneColour('ok')}
              strokeWidth={2}
              dot={{ r: 3, fill: briefStatusToneColour('ok') }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </StatsPanel>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Turnaround table
 * ---------------------------------------------------------------------------------------------- */

function TurnaroundPanel({ rows }: { rows: readonly TurnaroundRow[] }) {
  const hasData = rows.length > 0;
  return (
    <StatsPanel
      slot="brief-stats-turnaround"
      title="Revision turnaround (30d)"
      emptyCopy={EMPTY_TURNAROUND}
      isEmpty={!hasData}
    >
      {hasData ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-3 py-2 font-medium text-text3">Editor</th>
                {CREATIVE_TYPES.map((type) => (
                  <th key={type} className="px-3 py-2 font-medium text-text3">
                    {type}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.editor} className="border-b border-line last:border-b-0">
                  <td className="px-3 py-2 text-text">{row.editor}</td>
                  {CREATIVE_TYPES.map((type) => {
                    const value = row.perType[type];
                    return (
                      <td key={type} className="px-3 py-2 text-text2">
                        {value === null ? (
                          <span className="text-text4">—</span>
                        ) : (
                          formatHours(value)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </StatsPanel>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Shared panel shell with an empty-state slot per the ticket spec.
 * ---------------------------------------------------------------------------------------------- */

interface StatsPanelProps {
  readonly slot: string;
  readonly title: string;
  readonly emptyCopy: string;
  readonly isEmpty: boolean;
  readonly children: ReactNode;
}

function StatsPanel({ slot, title, emptyCopy, isEmpty, children }: StatsPanelProps) {
  return (
    <section
      data-slot={slot}
      className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4"
    >
      <SectionLabel>{title}</SectionLabel>
      {isEmpty ? (
        <p data-slot={`${slot}-empty`} className="text-sm text-text3">
          {emptyCopy}
        </p>
      ) : (
        children
      )}
    </section>
  );
}
