import { CreatorCard } from '@/app/app/ugc/creator-card';
import { PartnershipTable } from '@/app/app/ugc/partnership-table';
import {
  partnershipRow,
  type CreatorCardRow,
  type PartnershipSourceRow,
} from '@/app/app/ugc/fields';

/**
 * The three shapes the UGC Management route introduces (CLAUDE.md UI governance rule 4): the
 * creator card with its labelled three-track chip row, the avatar in both of its states, and the
 * partnership countdown at every expiry state including the highlight.
 *
 * Nothing is re-drawn here. `CreatorCard` and `PartnershipTable` are the route's own components,
 * mounted with plain objects rather than database rows, and every label, tone and countdown is
 * resolved by the same `@tas/domain` functions the page uses. A tone shown here is the tone the
 * page shows.
 */

/**
 * A stand-in headshot as an inline SVG data URI, the same shape `profile_pic_url` really holds in
 * demo mode. `hsl()` rather than hex because this is DATA standing in for an uploaded photo, not a
 * component — the token layer cannot reach inside an `<img src>`, and a remote placeholder would
 * render as a broken image on a machine with no network.
 */
const SAMPLE_AVATAR = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">' +
    '<rect width="96" height="96" rx="14" fill="hsl(26 15% 13%)"/>' +
    '<text x="48" y="49" text-anchor="middle" dominant-baseline="central" ' +
    'font-family="system-ui, sans-serif" font-size="34" font-weight="600" ' +
    'fill="hsl(30 9% 54%)">DO</text></svg>',
)}`;

const SAMPLE_CREATORS: readonly CreatorCardRow[] = [
  {
    id: 'story-with-picture',
    name: 'Danielle Okonkwo',
    gender: 'Female',
    ageBracket: '25-34',
    platform: 'Direct Management',
    profilePicUrl: SAMPLE_AVATAR,
    internalCreatorStatus: 'approved',
    clientStatus: 'approved',
    internalAssetsStatus: 'approved',
    rawAssetsUrl: null,
    conceptIds: [],
    productIds: [],
  },
  {
    id: 'story-without-picture',
    name: 'Tomás Ferreira',
    gender: 'Male',
    ageBracket: '18-24',
    platform: 'Fiverr',
    profilePicUrl: null,
    internalCreatorStatus: 'pending_for_cs_approval',
    clientStatus: 'due_shipment',
    internalAssetsStatus: 'pending_for_cs_approval',
    rawAssetsUrl: null,
    conceptIds: [],
    productIds: [],
  },
];

/**
 * The card: picture or initials, name, gender and bracket, the platform as a mute chip, and the
 * three status tracks each under the name of the review it belongs to. The second card is the
 * fallback case — a creator sourced off a marketplace arrives with no usable headshot.
 */
export function CreatorCardStory() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {SAMPLE_CREATORS.map((creator) => (
        <CreatorCard key={creator.id} creator={creator} />
      ))}
    </div>
  );
}

/** The reference instant the sample countdowns are read against, so this preview never drifts. */
const STORY_NOW = new Date('2026-09-17T09:00:00.000Z');

const SAMPLE_PARTNERSHIPS: readonly PartnershipSourceRow[] = [
  {
    id: 'story-expiring',
    name: 'Danielle Okonkwo',
    instagramUsername: '@danielle.sleeps.late',
    partnershipActivity: 'active',
    partnershipActivatedAt: new Date('2026-07-22T09:00:00.000Z'),
    partnershipPeriodDays: 60,
    extensionDays: 0,
  },
  {
    id: 'story-active',
    name: 'Marcus Delacroix',
    instagramUsername: '@marcus.after.midnight',
    partnershipActivity: 'active',
    partnershipActivatedAt: new Date('2026-07-09T09:00:00.000Z'),
    partnershipPeriodDays: 60,
    extensionDays: 30,
  },
  {
    id: 'story-expired',
    name: 'Priya Raghunathan',
    instagramUsername: '@priya.at.3am',
    partnershipActivity: 'ended',
    partnershipActivatedAt: new Date('2026-04-15T09:00:00.000Z'),
    partnershipPeriodDays: 30,
    extensionDays: 0,
  },
  {
    id: 'story-none',
    name: 'Hannah Whitcombe',
    instagramUsername: null,
    partnershipActivity: 'not_active',
    partnershipActivatedAt: null,
    partnershipPeriodDays: null,
    extensionDays: 0,
  },
];

/**
 * The table at all four expiry states: three days left (warn rule and tint, `data-near-expiry`),
 * twenty days left with the extension shown as its own term, a lapsed window reading Expired in the
 * `bad` tone, and a row that was never activated — muted, not coloured as though it were a problem.
 */
export function PartnershipCountdownStory() {
  return (
    <PartnershipTable rows={SAMPLE_PARTNERSHIPS.map((row) => partnershipRow(row, STORY_NOW))} />
  );
}
