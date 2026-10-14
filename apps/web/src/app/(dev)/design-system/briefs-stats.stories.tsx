'use client';

import type { BriefStats } from '@tas/db';

import { StatsTab } from '@/app/app/creative-sheet/stats-tab';

/**
 * The Creative Sheet stats tab (Ticket 12) rendered in three fixture states: empty, partial and
 * full. Pure markup — the stats values travel in as props, there is no server fetch and no action.
 * The `.stories.test.tsx` asserts no raw hex colour reaches these panels.
 */

const EMPTY: BriefStats = {
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

const PARTIAL: BriefStats = {
  kpi: {
    inFlight: 12,
    approvedThisWeek: 3,
    avgRevisionHours: null,
    qaPassRatePct: null,
  },
  perEditor: [
    { editor: 'Alice', assigned: 3, inReview: 1, approved: 2 },
    { editor: 'Bob', assigned: 2, inReview: 2, approved: 0 },
  ],
  weeklyOutput: [
    { day: 'Mon', count: 2 },
    { day: 'Tue', count: 1 },
    { day: 'Wed', count: 0 },
    { day: 'Thu', count: 0 },
    { day: 'Fri', count: 0 },
    { day: 'Sat', count: 0 },
    { day: 'Sun', count: 0 },
  ],
  turnaround: [],
};

const FULL: BriefStats = {
  kpi: {
    inFlight: 18,
    approvedThisWeek: 7,
    avgRevisionHours: 14.3,
    qaPassRatePct: 87.5,
  },
  perEditor: [
    { editor: 'Alice', assigned: 4, inReview: 2, approved: 3 },
    { editor: 'Bob', assigned: 3, inReview: 2, approved: 2 },
    { editor: 'Carla', assigned: 2, inReview: 1, approved: 1 },
    { editor: 'Diego', assigned: 1, inReview: 1, approved: 1 },
  ],
  weeklyOutput: [
    { day: 'Mon', count: 3 },
    { day: 'Tue', count: 2 },
    { day: 'Wed', count: 4 },
    { day: 'Thu', count: 1 },
    { day: 'Fri', count: 0 },
    { day: 'Sat', count: 0 },
    { day: 'Sun', count: 0 },
  ],
  turnaround: [
    {
      editor: 'Alice',
      perType: { Video: 8.5, Static: 4, Carousel: null, 'Motion Image': null },
    },
    {
      editor: 'Bob',
      perType: { Video: 12, Static: null, Carousel: 6, 'Motion Image': 3 },
    },
  ],
};

export function BriefsStatsEmptyStory() {
  return <StatsTab stats={EMPTY} />;
}

export function BriefsStatsPartialStory() {
  return <StatsTab stats={PARTIAL} />;
}

export function BriefsStatsFullStory() {
  return <StatsTab stats={FULL} />;
}

export const BRIEF_STATS_STORIES = {
  empty: BriefsStatsEmptyStory,
  partial: BriefsStatsPartialStory,
  full: BriefsStatsFullStory,
} as const;
