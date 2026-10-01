import { demoCampaigns, demoEmailFlows, demoTeam } from '@tas/db';
import { StatusChip } from '@tas/ui';

import type { LinkOption } from '@/app/app/email-flows/email-flows-panel';
import {
  EmailFlowsBoard,
  EmailFlowsGrid,
  EmailFlowsWorkspace,
} from '@/app/app/email-flows/email-flows-workspace';
import {
  EMAIL_FLOW_STATUS_OPTIONS,
  EMAIL_FLOW_TYPE_OPTIONS,
  emailFlowItem,
} from '@/app/app/email-flows/fields';

/**
 * The shapes the Email Flows route introduces (CLAUDE.md UI governance rule 4), mounted as the
 * product mounts them over the demo fixtures. A SERVER module on purpose, like
 * `role-dashboard.stories.tsx`: it reads `demoEmailFlows` from `@tas/db`, which must never reach the
 * browser bundle, and hands the route's own client components plain, serialisable items. Nothing is
 * re-drawn here; a tone shown here is the tone the page shows.
 */

/** The reference instant the relative timestamps are read against, so this preview never drifts. */
const STORY_NOW = new Date('2026-09-20T09:00:00.000Z');

const ITEMS = demoEmailFlows.map((flow) => emailFlowItem(flow, STORY_NOW));
const CAMPAIGNS: LinkOption[] = demoCampaigns.map(({ id, name }) => ({ id, name }));
const ASSIGNEES: LinkOption[] = demoTeam.map(({ clerkUserId, fullName }) => ({
  id: clerkUserId,
  name: fullName,
}));

/** Every status and every type as the shared `StatusChip`, in the base's order, with its tone. */
export function EmailFlowChipsStory() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2" data-slot="email-flow-status-chips">
        {EMAIL_FLOW_STATUS_OPTIONS.map((option) => (
          <StatusChip key={option.value} tone={option.tone} label={option.label} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2" data-slot="email-flow-type-chips">
        {EMAIL_FLOW_TYPE_OPTIONS.map((option) => (
          <StatusChip key={option.value} tone={option.tone} label={option.label} />
        ))}
      </div>
    </div>
  );
}

/**
 * The grid over the four fixtures: frozen name column with the propagation badge, status and type
 * chips, the typed setup date beside the two computed due dates in `font-mono`, the assignee, the
 * Klaviyo host with the full URL in the cell title. Rows are not clickable here.
 */
export function EmailFlowsGridStory() {
  return <EmailFlowsGrid items={ITEMS} />;
}

/** The board grouped by status: every vocabulary column kept, each card chipped with its type. */
export function EmailFlowsBoardStory() {
  return <EmailFlowsBoard items={ITEMS} groupField="status" demo />;
}

/**
 * The route as shipped, in demo mode: click a row to open the side panel — every stored field as a
 * labelled read-only control, the two due dates computed, the Campaigns & Offers chip picker — and
 * press Escape to close it.
 */
export function EmailFlowsWorkspaceStory() {
  return (
    <EmailFlowsWorkspace
      items={ITEMS}
      campaigns={CAMPAIGNS}
      assignees={ASSIGNEES}
      demo
      initialSelection={null}
      initialSearch=""
    />
  );
}
