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
  briefs: {
    tableKey: 'briefs',
    label: 'Creative Briefs',
    supportedViews: ['grid', 'kanban', 'gallery'],
    kanbanFields: [
      { field: 'clientStatus', label: 'Client Status' },
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
  concepts: {
    tableKey: 'concepts',
    label: 'Concepts',
    supportedViews: ['grid', 'kanban'],
    kanbanFields: [
      { field: 'approvalStatus', label: 'Approval Status' },
      { field: 'productionStatus', label: 'Production Status' },
      { field: 'internalStatus', label: 'Internal Status' },
      { field: 'clientStatus', label: 'Client Status' },
    ],
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
  personas: {
    tableKey: 'personas',
    label: 'Personas',
    supportedViews: ['grid', 'kanban'],
    kanbanFields: [{ field: 'stageOfAwareness', label: 'Stage of Awareness' }],
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
  themes: {
    tableKey: 'themes',
    label: 'Themes',
    supportedViews: ['grid', 'kanban'],
    kanbanFields: [
      { field: 'category', label: 'Category' },
      { field: 'status', label: 'Status' },
    ],
    galleryFields: [],
    timelineDates: null,
  },
  angles: {
    tableKey: 'angles',
    label: 'Angles',
    supportedViews: ['grid', 'kanban'],
    kanbanFields: [{ field: 'potential', label: 'Potential' }],
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
    supportedViews: ['grid'],
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
