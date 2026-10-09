export type ViewType = 'grid' | 'kanban' | 'gallery' | 'timeline' | 'list';

export interface KanbanFieldOption {
  readonly field: string;
  readonly label: string;
}

/**
 * One candidate COVER for a table's gallery cards — "customise the card" asks for a choice of which
 * image field covers it (action item 16), and this is the allow-list that choice is made from.
 *
 * `field` is the RESOLVER's column key (a Postgres column name), not a module's camelCase field
 * name, because the picker is built from the brand's resolved column set: that way a column an
 * admin hid or relabelled cannot be offered as a cover under a label the brand does not use, and a
 * table with no media column simply shows no picker. `label` here is a fallback only — the label a
 * viewer reads is the resolver's `display_label`.
 */
export interface GalleryFieldOption {
  readonly field: string;
  readonly label: string;
  readonly mediaType: 'image' | 'video';
}

export interface TimelineDatePair {
  readonly startField: string;
  readonly endField: string;
}

export interface TableViewCapability {
  readonly tableKey: string;
  readonly label: string;
  readonly supportedViews: readonly ViewType[];
  readonly kanbanFields: readonly KanbanFieldOption[];
  readonly galleryFields: readonly GalleryFieldOption[];
  readonly timelineDates: TimelineDatePair | null;
}

export const TABLE_VIEW_CAPABILITIES: Record<string, TableViewCapability> = {
  // ── Module parity (2026-10-01): one entry per new module; each page ships against these ──
  'creative-sheet': {
    tableKey: 'creative-sheet',
    label: 'Creative Sheet',
    supportedViews: ['grid', 'kanban'],
    kanbanFields: [
      { field: 'internalStatus', label: 'Internal Status' },
      { field: 'status', label: 'Status' },
      // The editor's board, re-homed here from the retired Creative Design list (2026-10-09): the
      // three EDITOR_STAGES over the BRIEFS' internal status, cards are briefs, not sheet rows.
      { field: 'editorStage', label: 'Editing stage' },
    ],
    galleryFields: [],
    timelineDates: null,
  },
  'creative-modules': {
    tableKey: 'creative-modules',
    label: 'Creative Modules',
    supportedViews: ['grid'],
    kanbanFields: [],
    galleryFields: [],
    timelineDates: null,
  },
  'sm-campaign-feed': {
    tableKey: 'sm-campaign-feed',
    label: 'SM Campaign Feed',
    supportedViews: ['grid', 'kanban'],
    kanbanFields: [
      { field: 'status', label: 'Status' },
      { field: 'platform', label: 'Platform' },
    ],
    galleryFields: [],
    timelineDates: null,
  },
  'email-campaigns': {
    tableKey: 'email-campaigns',
    label: 'Email Campaigns',
    supportedViews: ['grid', 'kanban', 'timeline'],
    kanbanFields: [
      { field: 'status', label: 'Status' },
      { field: 'type', label: 'Type' },
      { field: 'channel', label: 'Channel' },
    ],
    galleryFields: [],
    // "Calendar by send date": the timeline keyed on the one date an email campaign has.
    timelineDates: { startField: 'sendDate', endField: 'sendDate' },
  },
  'email-flows': {
    tableKey: 'email-flows',
    label: 'Email Flows',
    supportedViews: ['grid', 'kanban'],
    kanbanFields: [
      { field: 'status', label: 'Status' },
      { field: 'type', label: 'Type' },
    ],
    galleryFields: [],
    timelineDates: null,
  },
  'youtube-copywriting': {
    tableKey: 'youtube-copywriting',
    label: 'YouTube Copywriting',
    supportedViews: ['grid', 'kanban'],
    kanbanFields: [
      { field: 'status', label: 'Status' },
      { field: 'funnel', label: 'Funnel' },
    ],
    galleryFields: [],
    timelineDates: null,
  },
  'copy-types': {
    tableKey: 'copy-types',
    label: 'Copy Types',
    supportedViews: ['grid'],
    kanbanFields: [],
    galleryFields: [],
    timelineDates: null,
  },
  'creative-reporting': {
    tableKey: 'creative-reporting',
    label: 'Creative Reporting',
    supportedViews: ['grid'],
    kanbanFields: [],
    galleryFields: [],
    timelineDates: null,
  },
  'client-assets': {
    tableKey: 'client-assets',
    label: 'Client Assets',
    supportedViews: ['grid'],
    kanbanFields: [],
    galleryFields: [],
    timelineDates: null,
  },
  briefs: {
    tableKey: 'briefs',
    label: 'Creative Briefs',
    supportedViews: ['grid', 'kanban', 'gallery'],
    kanbanFields: [
      { field: 'clientStatus', label: 'Client Status' },
      // The editor's three columns over the internal track (Sprint 10, EDIT-01).
      { field: 'editorStage', label: 'Editing stage' },
      { field: 'internalStatus', label: 'Internal Status' },
      { field: 'priority', label: 'Priority' },
      { field: 'performance', label: 'Performance' },
      { field: 'funnel', label: 'Funnel' },
      { field: 'type', label: 'Type' },
      { field: 'source', label: 'Source' },
      { field: 'platform', label: 'Platform' },
      { field: 'language', label: 'Language' },
    ],
    galleryFields: [
      { field: 'design_file', label: 'Design File', mediaType: 'image' },
      { field: 'inspiration_image', label: 'Inspiration Image', mediaType: 'image' },
    ],
    timelineDates: null,
  },
  // NO KANBAN on the data tables (Talal, 2026-09-28, action item 18: "drop Kanban from the data
  // tables (products, personas, angles, themes, concepts)"). The board stays where the lanes ARE the
  // workflow — Creative Briefs and UGC Management (item 29) — and leaves the five tables that are
  // reference data you read down a grid. Dropping the LENS drops no data: every status a lane was
  // built from is still a grid column and still on the record's form.
  concepts: {
    tableKey: 'concepts',
    label: 'Concepts',
    supportedViews: ['grid', 'gallery', 'list'],
    kanbanFields: [],
    galleryFields: [],
    timelineDates: null,
  },
  copywriting: {
    tableKey: 'copywriting',
    label: 'Copywriting',
    supportedViews: ['grid', 'kanban'],
    kanbanFields: [
      { field: 'status', label: 'Status' },
      { field: 'cta', label: 'CTA' },
      { field: 'funnel', label: 'Funnel' },
    ],
    galleryFields: [],
    timelineDates: null,
  },
  creators: {
    tableKey: 'creators',
    label: 'UGC Creators',
    supportedViews: ['grid', 'kanban', 'gallery', 'list'],
    kanbanFields: [
      { field: 'internalCreatorStatus', label: 'Internal Status' },
      { field: 'clientStatus', label: 'Client Status' },
      { field: 'internalAssetsStatus', label: 'Assets Status' },
      { field: 'partnershipActivity', label: 'Partnership Activity' },
      { field: 'ageBracket', label: 'Age Bracket' },
      { field: 'platform', label: 'Platform' },
    ],
    galleryFields: [
      { field: 'profile_pic_url', label: "Creator's Profile Pic", mediaType: 'image' },
      { field: 'video_intro_url', label: "Creator's Video Intro", mediaType: 'video' },
    ],
    timelineDates: null,
  },
  // No Kanban (item 18): a persona is research, not a queue with stages to drag a card between.
  personas: {
    tableKey: 'personas',
    label: 'Personas',
    supportedViews: ['grid', 'gallery', 'list'],
    kanbanFields: [],
    galleryFields: [],
    timelineDates: null,
  },
  campaigns: {
    tableKey: 'campaigns',
    label: 'Campaigns & Offers',
    supportedViews: ['grid', 'timeline'],
    kanbanFields: [],
    galleryFields: [],
    timelineDates: { startField: 'adsLaunchDate', endField: 'adsEndDate' },
  },
  // No Kanban (item 18); the category chip row above the Themes grid already does what the board did.
  themes: {
    tableKey: 'themes',
    label: 'Themes',
    supportedViews: ['grid', 'gallery', 'list'],
    kanbanFields: [],
    galleryFields: [{ field: 'attachments', label: 'First attachment', mediaType: 'image' }],
    timelineDates: null,
  },
  // No Kanban (item 18): Potential is a rating to sort the grid by, not a lane to move an angle through.
  angles: {
    tableKey: 'angles',
    label: 'Angles',
    supportedViews: ['grid', 'gallery', 'list'],
    kanbanFields: [],
    galleryFields: [],
    timelineDates: null,
  },
  assets: {
    tableKey: 'assets',
    label: 'Assets',
    supportedViews: ['grid', 'kanban', 'gallery'],
    kanbanFields: [{ field: 'category', label: 'Category' }],
    galleryFields: [{ field: 'url', label: 'Asset', mediaType: 'image' }],
    timelineDates: null,
  },
  products: {
    tableKey: 'products',
    label: 'Products',
    supportedViews: ['grid', 'gallery', 'list'],
    kanbanFields: [],
    galleryFields: [],
    timelineDates: null,
  },
  performance: {
    tableKey: 'performance',
    label: 'Performance',
    supportedViews: ['grid'],
    kanbanFields: [],
    galleryFields: [],
    timelineDates: null,
  },
  'ad-spy': {
    tableKey: 'ad-spy',
    label: 'Ad Spy',
    supportedViews: ['grid', 'kanban'],
    kanbanFields: [{ field: 'platform', label: 'Platform' }],
    galleryFields: [],
    timelineDates: null,
  },
  'creator-ranking': {
    tableKey: 'creator-ranking',
    label: 'Creator Ranking',
    supportedViews: ['grid'],
    kanbanFields: [],
    galleryFields: [],
    timelineDates: null,
  },
  'upload-links': {
    tableKey: 'upload-links',
    label: 'Upload Links',
    supportedViews: ['grid'],
    kanbanFields: [],
    galleryFields: [],
    timelineDates: null,
  },
  'onboarding-forms': {
    tableKey: 'onboarding-forms',
    label: 'Onboarding Forms',
    supportedViews: ['grid', 'kanban'],
    kanbanFields: [{ field: 'status', label: 'Status' }],
    galleryFields: [],
    timelineDates: null,
  },
};

export function getTableCapability(tableKey: string): TableViewCapability | undefined {
  return TABLE_VIEW_CAPABILITIES[tableKey];
}

export function supportsView(tableKey: string, view: ViewType): boolean {
  const cap = TABLE_VIEW_CAPABILITIES[tableKey];
  return cap !== undefined && cap.supportedViews.includes(view);
}

/**
 * The view a table can actually render, given the one that was asked for.
 *
 * A saved view, a `?view=` in a shared link or a value left in a browser's store can name a view a
 * table no longer offers — a Concepts board, say, now that item 18 has taken Kanban off the data
 * tables. `loadUserViews` already narrows a view it read from Postgres, but the two other ways a
 * view type reaches `useTableView` — the `?view=` parameter and demo mode's `localStorage` — went
 * through no such check, so a stale value left the switcher sitting on a tab that is not rendered
 * and the page showing a board component that is gone.
 *
 * Returns the requested view when the table still supports it, the fallback when it does not, and
 * the table's first view when it does not support the fallback either. An unknown table key is
 * passed through untouched: a capability nobody declared is not evidence against the request.
 */
export function resolveViewType(
  tableKey: string,
  requested: ViewType,
  fallback: ViewType = 'grid',
): ViewType {
  const cap = TABLE_VIEW_CAPABILITIES[tableKey];
  if (cap === undefined) return requested;
  if (cap.supportedViews.includes(requested)) return requested;
  if (cap.supportedViews.includes(fallback)) return fallback;
  return cap.supportedViews[0] ?? 'grid';
}
