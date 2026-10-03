import {
  demoCampaigns,
  demoCollections,
  demoEmailCampaigns,
  demoProducts,
  demoTeam,
} from '@tas/db';
import { StatusChip } from '@tas/ui';

import { EmailCampaignsWorkspace } from '@/app/app/email-campaigns/email-campaigns-workspace';
import {
  CHANNEL_OPTIONS,
  STATUS_OPTIONS,
  toEmailCampaignItem,
  TYPE_OPTIONS,
} from '@/app/app/email-campaigns/fields';
import { parentColumnsFor } from '@/lib/resolved-columns-source';

/**
 * The Email Campaigns module on the design-system page (CLAUDE.md UI governance rule 4): the
 * identical `EmailCampaignsWorkspace` the route renders — grid, Kanban and send-date Timeline —
 * over the demo fixtures, plus every chip tone the three select vocabularies produce. A server
 * module, so the fixtures come straight from `@tas/db` and never reach the browser bundle; the
 * workspace receives plain data. Click a row or a card to open the same panel the route opens.
 */
const STORY_NOW = new Date('2026-09-20T12:00:00.000Z');

const ITEMS = demoEmailCampaigns.map((row) => toEmailCampaignItem(row, STORY_NOW));
const CAMPAIGN_OPTIONS = demoCampaigns.map(({ id, name }) => ({ id, name }));
const PRODUCT_OPTIONS = demoProducts.map(({ id, name }) => ({ id, name }));
const COLLECTION_OPTIONS = demoCollections.map(({ id, name }) => ({ id, name }));
const ASSIGNEE_OPTIONS = demoTeam.map(({ clerkUserId, fullName }) => ({
  id: clerkUserId,
  name: fullName,
}));

function workspace(view: 'grid' | 'kanban' | 'timeline') {
  return (
    <EmailCampaignsWorkspace
      columns={parentColumnsFor('email_campaigns')}
      items={ITEMS}
      campaignOptions={CAMPAIGN_OPTIONS}
      productOptions={PRODUCT_OPTIONS}
      collectionOptions={COLLECTION_OPTIONS}
      assigneeOptions={ASSIGNEE_OPTIONS}
      demo
      initialSelection={null}
      initialSearch=""
      initialView={view}
    />
  );
}

/** The grid: frozen name, status/type/channel chips, mono dates with the two formula due dates. */
export function EmailCampaignsGridStory() {
  return workspace('grid');
}

/** The board grouped by status (switchable to type or channel), one column per vocabulary entry. */
export function EmailCampaignsKanbanStory() {
  return workspace('kanban');
}

/** The "Calendar": the Timeline keyed on the one date an email campaign has, its send date. */
export function EmailCampaignsTimelineStory() {
  return workspace('timeline');
}

/** Every tone the three vocabularies map to, so a reviewer sees the whole palette at once. */
export function EmailCampaignChipsStory() {
  return (
    <div className="flex flex-col gap-4">
      {[
        { heading: 'Status', options: STATUS_OPTIONS },
        { heading: 'Type', options: TYPE_OPTIONS },
        { heading: 'Channel', options: CHANNEL_OPTIONS },
      ].map((group) => (
        <div key={group.heading} className="flex flex-col gap-2">
          <span className="font-mono text-[11px] tracking-wide text-text3 uppercase">
            {group.heading}
          </span>
          <div className="flex flex-wrap gap-2" data-slot={`email-campaign-${group.heading}-chips`}>
            {group.options.map((option) => (
              <StatusChip key={option.value} tone={option.tone} label={option.label} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
