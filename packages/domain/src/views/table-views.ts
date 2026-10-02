export type ViewType = 'grid' | 'kanban' | 'gallery' | 'timeline';

export interface KanbanFieldOption {
  readonly field: string;
  readonly label: string;
}

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
      { field: 'designFile', label: 'Design File', mediaType: 'image' },
      { field: 'inspirationImage', label: 'Inspiration Image', mediaType: 'image' },
    ],
    timelineDates: null,
  },
  // Talal, 2026-09-28 (AI-18): Kanban is for Creative Briefs only — the data tables are a grid you
  // work down, and a second board over the same rows was never read. AI-34: Production Status left
  // the Concepts grid and form on purpose, and it was still reachable here as a board group-by, so
  // it goes with the board. The COLUMN stays (it holds imported Airtable data); only the lens is gone.
  concepts: {
    tableKey: 'concepts',
    label: 'Concepts',
    supportedViews: ['grid', 'gallery'],
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
    supportedViews: ['grid', 'kanban', 'gallery'],
    kanbanFields: [
      { field: 'internalCreatorStatus', label: 'Internal Status' },
      { field: 'clientStatus', label: 'Client Status' },
      { field: 'internalAssetsStatus', label: 'Assets Status' },
      { field: 'partnershipActivity', label: 'Partnership Activity' },
      { field: 'ageBracket', label: 'Age Bracket' },
      { field: 'platform', label: 'Platform' },
    ],
    galleryFields: [
      { field: 'profilePicUrl', label: 'Profile Pic', mediaType: 'image' },
      { field: 'videoIntroUrl', label: 'Video Intro', mediaType: 'video' },
    ],
    timelineDates: null,
  },
  // No Kanban (AI-18): a persona is research, not a queue with stages to drag between.
  personas: {
    tableKey: 'personas',
    label: 'Personas',
    supportedViews: ['grid', 'gallery'],
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
  // No Kanban (AI-18); the category chip row above the grid already does what the board did.
  themes: {
    tableKey: 'themes',
    label: 'Themes',
    supportedViews: ['grid', 'gallery'],
    kanbanFields: [],
    galleryFields: [{ field: 'attachments', label: 'First attachment', mediaType: 'image' }],
    timelineDates: null,
  },
  // No Kanban (AI-18): Potential is a rating to sort by, not a lane to move an angle through.
  angles: {
    tableKey: 'angles',
    label: 'Angles',
    supportedViews: ['grid', 'gallery'],
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
    supportedViews: ['grid', 'gallery'],
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
 * table no longer offers — a Concepts board, say, after AI-18 took Kanban off the data tables. This
 * returns the requested view when the table still supports it, the fallback when it does not, and
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
