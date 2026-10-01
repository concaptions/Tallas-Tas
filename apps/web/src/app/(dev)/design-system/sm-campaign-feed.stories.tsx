import { demoSmCampaignFeedTasks } from '@tas/db';
import { StatusChip } from '@tas/ui';

import {
  buildSmTaskItem,
  PLATFORM_OPTIONS,
  REMINDER_LABEL,
  REMINDER_TONE,
  STATUS_OPTIONS,
} from '@/app/app/sm-campaign-feed/fields';
import { SmCampaignFeedWorkspace } from '@/app/app/sm-campaign-feed/sm-campaign-feed-workspace';

/**
 * The SM Campaign Feed module (module parity 2026-10-01, UI governance rule 4): the identical
 * workspace `/app/sm-campaign-feed` renders, over the demo fixtures, in its grid and its Kanban
 * configuration, plus every chip the module can show. Nothing is re-implemented: the rows are built
 * by the same `buildSmTaskItem` the page uses, with a FIXED clock so the Reminder column reads the
 * same on every visit to this page (the route itself uses the request's clock).
 */
const STORY_NOW = new Date('2026-10-01T12:00:00.000Z');

const ITEMS = demoSmCampaignFeedTasks.map((task) => buildSmTaskItem(task, STORY_NOW));

export function SmCampaignFeedGridStory() {
  return (
    <SmCampaignFeedWorkspace
      items={ITEMS}
      demo
      initialSelection={null}
      initialSearch=""
      initialView="grid"
    />
  );
}

export function SmCampaignFeedKanbanStory() {
  return (
    <SmCampaignFeedWorkspace
      items={ITEMS}
      demo
      initialSelection={null}
      initialSearch=""
      initialView="kanban"
      initialKanbanField="status"
    />
  );
}

/** Every vocabulary chip and the computed Reminder chip, so each tone the module uses is on this page. */
export function SmCampaignFeedChipsStory() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2" data-slot="sm-task-platform-chips">
        <span className="text-[11px] tracking-wide text-text3 uppercase">Platform</span>
        {PLATFORM_OPTIONS.map((option) => (
          <StatusChip key={option.value} tone={option.tone} label={option.label} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2" data-slot="sm-task-status-chips">
        <span className="text-[11px] tracking-wide text-text3 uppercase">Status</span>
        {STATUS_OPTIONS.map((option) => (
          <StatusChip key={option.value} tone={option.tone} label={option.label} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2" data-slot="sm-task-reminder-chip">
        <span className="text-[11px] tracking-wide text-text3 uppercase">Reminder</span>
        <StatusChip tone={REMINDER_TONE} label={REMINDER_LABEL} />
      </div>
    </div>
  );
}
