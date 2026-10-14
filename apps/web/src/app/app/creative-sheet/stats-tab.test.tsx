// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The StatsTab unit (Ticket 12). We mock recharts because its `ResponsiveContainer` reaches for the
 * DOM's `ResizeObserver`, which jsdom does not provide; the mock passes the chart's children
 * through so the surrounding panel structure, slots and empty-state text remain assertable.
 */

vi.mock('recharts', () => ({
  Bar: ({ children }: { children?: ReactNode }) => <div data-slot="mock-bar">{children}</div>,
  BarChart: ({ children }: { children?: ReactNode }) => (
    <div data-slot="mock-bar-chart">{children}</div>
  ),
  CartesianGrid: () => null,
  Legend: () => null,
  Line: () => <div data-slot="mock-line" />,
  LineChart: ({ children }: { children?: ReactNode }) => (
    <div data-slot="mock-line-chart">{children}</div>
  ),
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

import type { BriefStats } from '@tas/db';

import {
  EMPTY_APPROVED_WEEK,
  EMPTY_IN_FLIGHT,
  EMPTY_PER_EDITOR,
  EMPTY_REVISIONS,
  EMPTY_SUBMISSIONS_WINDOW,
  EMPTY_TURNAROUND,
  EMPTY_WEEKLY_OUTPUT,
} from './stats-copy';
import { briefStatusToneColour, formatHours, formatPercent, StatsTab } from './stats-tab';

const EMPTY_STATS: BriefStats = {
  kpi: {
    inFlight: 0,
    approvedThisWeek: 0,
    avgRevisionHours: null,
    qaPassRatePct: null,
  },
  perEditor: [],
  weeklyOutput: [
    { day: 'Mon', count: 0 },
    { day: 'Tue', count: 0 },
    { day: 'Wed', count: 0 },
    { day: 'Thu', count: 0 },
    { day: 'Fri', count: 0 },
    { day: 'Sat', count: 0 },
    { day: 'Sun', count: 0 },
  ],
  turnaround: [],
};

const FULL_STATS: BriefStats = {
  kpi: {
    inFlight: 10,
    approvedThisWeek: 3,
    avgRevisionHours: 8,
    qaPassRatePct: 92.5,
  },
  perEditor: [{ editor: 'alice', assigned: 2, inReview: 1, approved: 1 }],
  weeklyOutput: [
    { day: 'Mon', count: 2 },
    { day: 'Tue', count: 0 },
    { day: 'Wed', count: 0 },
    { day: 'Thu', count: 0 },
    { day: 'Fri', count: 0 },
    { day: 'Sat', count: 0 },
    { day: 'Sun', count: 0 },
  ],
  turnaround: [
    {
      editor: 'alice',
      perType: { Video: 6, Static: null, Carousel: null, 'Motion Image': null },
    },
  ],
};

afterEach(() => {
  cleanup();
});

describe('briefStatusToneColour', () => {
  it('reads a CSS token variable for every tone, never a hex literal', () => {
    for (const tone of ['ok', 'warn', 'bad', 'info', 'accent', 'mute'] as const) {
      const value = briefStatusToneColour(tone);
      expect(value).toMatch(/^var\(--/);
      expect(value).not.toMatch(/#[0-9a-f]/i);
    }
  });

  it('falls back to the muted text token on an unknown tone', () => {
    const unknown = 'nope' as unknown as 'mute';
    expect(briefStatusToneColour(unknown)).toBe('var(--text3)');
  });
});

describe('formatPercent', () => {
  it('rounds trivial fractions to a whole number', () => {
    expect(formatPercent(50)).toBe('50%');
    expect(formatPercent(100)).toBe('100%');
  });

  it('keeps one decimal on a non-integer percent', () => {
    expect(formatPercent(87.5)).toBe('87.5%');
    expect(formatPercent(33.33)).toBe('33.3%');
  });
});

describe('formatHours', () => {
  it('rounds whole hours cleanly', () => {
    expect(formatHours(6)).toBe('6 h');
  });

  it('keeps one decimal on a fractional hour', () => {
    expect(formatHours(8.4)).toBe('8.4 h');
  });
});

describe('StatsTab empty state', () => {
  it('renders a slot per empty panel with the Talal review copy', () => {
    const { container } = render(<StatsTab stats={EMPTY_STATS} />);
    const html = container.innerHTML;
    expect(container.querySelector('[data-slot="brief-stats-in-flight-empty"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="brief-stats-approved-week-empty"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="brief-stats-avg-revision-empty"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="brief-stats-qa-pass-rate-empty"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="brief-stats-per-editor-empty"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="brief-stats-weekly-empty"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="brief-stats-turnaround-empty"]')).not.toBeNull();
    expect(html).toContain(EMPTY_IN_FLIGHT);
    expect(html).toContain(EMPTY_APPROVED_WEEK);
    expect(html).toContain(EMPTY_REVISIONS);
    expect(html).toContain(EMPTY_SUBMISSIONS_WINDOW);
    expect(html).toContain(EMPTY_PER_EDITOR);
    expect(html).toContain(EMPTY_WEEKLY_OUTPUT);
    expect(html).toContain(EMPTY_TURNAROUND);
  });
});

describe('StatsTab populated', () => {
  it('renders the four panels with their data', () => {
    const { container } = render(<StatsTab stats={FULL_STATS} />);
    expect(container.querySelector('[data-slot="brief-stats-kpi"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="brief-stats-per-editor"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="brief-stats-weekly"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="brief-stats-turnaround"]')).not.toBeNull();
    // The KPI tiles replace the dash with their formatted value.
    expect(container.innerHTML).toContain('92.5%');
    expect(container.innerHTML).toContain('8 h');
  });
});
