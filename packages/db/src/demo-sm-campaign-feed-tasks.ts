import { DEMO_ACTOR_ID, DEMO_BRAND_ID } from './demo-data';
import type { SmCampaignFeedTaskListRow } from './sm-campaign-feed-tasks';

/**
 * The SM Campaign Feed fixtures the app serves in DEMO MODE (module parity 2026-10-01). Same
 * conventions as `demo-data.ts`: every id is a hardcoded uuid and every timestamp a fixed ISO string,
 * never `randomUUID()` or `new Date()` at module scope, so the rows are stable across processes and
 * snapshots. The rows are typed as `SmCampaignFeedTaskListRow`, so a fixture and a database row are
 * the same shape and the page renders either without a branch.
 *
 * The fixtures sit in the order `listSmCampaignFeedTasks` returns them — soonest due first, undated
 * last — so a seeded database and the fixtures compare row for row.
 *
 * Due moments are chosen around the 2026-10-01 parity date so the computed Reminder column shows
 * both states: the overdue Meta task reads "Due", the finished X task reads "—" although it is past
 * (done tasks never remind), the TikTok reel is far enough out to be quiet, and the content calendar
 * has no due moment at all.
 */
const at = (iso: string): Date => new Date(iso);

const SM_TASK_MENTIONS_ID = '55667788-5566-4778-8889-000000000001';
const SM_TASK_DISCOUNT_ID = '55667788-5566-4778-8889-000000000002';
const SM_TASK_STORY_ID = '55667788-5566-4778-8889-000000000003';
const SM_TASK_REEL_ID = '55667788-5566-4778-8889-000000000004';
const SM_TASK_CALENDAR_ID = '55667788-5566-4778-8889-000000000005';

/**
 * The shared columns every demo task carries: the audit columns `demo-data.ts`'s `base()` sets, plus
 * the propagation columns and the legacy id. Declared here because `demo-data.ts` keeps its helpers
 * private; the shape is identical so a row here is a row there.
 */
function taskBase(id: string, created: string, updated: string) {
  return {
    id,
    brandId: DEMO_BRAND_ID,
    createdAt: at(created),
    updatedAt: at(updated),
    createdBy: DEMO_ACTOR_ID,
    updatedBy: DEMO_ACTOR_ID,
    deletedAt: null,
    templateRowId: null as string | null,
    overriddenFields: [] as string[],
    customFields: {} as Record<string, unknown>,
    legacyAirtableId: null as string | null,
  };
}

export const demoSmCampaignFeedTasks: SmCampaignFeedTaskListRow[] = [
  {
    ...taskBase(SM_TASK_MENTIONS_ID, '2026-09-21T10:00:00.000Z', '2026-09-28T15:40:00.000Z'),
    taskName: 'Reply to X mentions from the blanket launch thread',
    platform: 'x',
    dueDate: at('2026-09-28T12:00:00.000Z'),
    status: 'done',
    notes: 'Answer every sizing question with the fit guide link. Ignore the resellers.',
  },
  {
    ...taskBase(SM_TASK_DISCOUNT_ID, '2026-09-22T09:30:00.000Z', '2026-09-29T11:05:00.000Z'),
    taskName: 'Pin the fall discount code on the Meta launch post',
    platform: 'meta',
    dueDate: at('2026-09-30T18:00:00.000Z'),
    status: 'in_progress',
    notes:
      'Code FALLSLEEP20 goes live with the post. Pin the comment, then reply to the top three.',
  },
  {
    ...taskBase(SM_TASK_STORY_ID, '2026-09-24T14:15:00.000Z', '2026-09-30T08:20:00.000Z'),
    taskName: 'Snap story: the night-shift nurse wind-down routine',
    platform: 'snapchat',
    dueDate: at('2026-10-02T02:00:00.000Z'),
    status: 'todo',
    notes: 'Three frames: alarm at 7am, blackout mask on, blanket shot. Swipe up to the mask page.',
  },
  {
    ...taskBase(SM_TASK_REEL_ID, '2026-09-25T16:45:00.000Z', '2026-09-30T17:10:00.000Z'),
    taskName: 'Launch the weighted blanket reel',
    platform: 'tiktok',
    dueDate: at('2026-10-15T09:00:00.000Z'),
    status: 'todo',
    notes: 'Use the B2 body-clock cut. Pin the comment with the launch code.',
  },
  {
    ...taskBase(SM_TASK_CALENDAR_ID, '2026-09-26T11:00:00.000Z', '2026-09-26T11:00:00.000Z'),
    taskName: 'Draft the October content calendar',
    platform: null,
    dueDate: null,
    status: 'todo',
    notes: null,
  },
];
