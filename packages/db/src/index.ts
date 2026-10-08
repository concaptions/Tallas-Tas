export {
  getAdMetricById,
  insertAdMetric,
  listAdMetrics,
  listConceptMetrics,
  updateAdMetric,
} from './ad-metrics';
export type { AdMetricInput, AdMetricListRow } from './ad-metrics';
export {
  getCompetitorAdById,
  insertCompetitorAd,
  listCompetitorAds,
  updateCompetitorAd,
} from './competitor-ads';
export type { CompetitorAdInput, CompetitorAdListRow } from './competitor-ads';
export {
  getCreatorRankingById,
  insertCreatorRanking,
  listCreatorRankings,
  listCreatorRankingsByCreator,
  updateCreatorRanking,
} from './creator-rankings';
export type { CreatorRankingInput, CreatorRankingListRow } from './creator-rankings';
export { insertAnnotation } from './annotation-queries';
export type { AnnotationInput } from './annotation-queries';
export { insertComment } from './comment-queries';
export type { CommentInput } from './comment-queries';
export { importAirtableExport } from './airtable-import';
export {
  getAssetById,
  insertAsset,
  listAssets,
  listConceptAssets,
  listCreatorAssets,
  softDeleteAsset,
  updateAsset,
} from './assets';
export type { AssetInput, AssetListRow } from './assets';
export { assetCategories } from './schema/assets';
export type { AssetCategory } from './schema/assets';
export type { AirtableExport, AirtableRecord } from './airtable-import';
export { getAngleById, insertAngle, listAngles, updateAngle } from './angles';
export { restoreBrief, snapshotBrief } from './briefs-e2e';
export type { BriefSnapshot } from './briefs-e2e';
export type { AngleInput, AngleListRow } from './angles';
export {
  allocateBriefNumber,
  getBriefById,
  insertBrief,
  listBriefs,
  listBriefsByConceptId,
  renameBrief,
  updateBrief,
  updateBriefClientStatus,
} from './briefs';
export type { BriefInput, BriefListRow } from './briefs';
export {
  getUploadLinkById,
  getUploadLinkByToken,
  insertUploadLink,
  listUploadLinks,
  updateUploadLink,
} from './upload-links';
export {
  listCreatorConceptIds,
  listCreatorProductIds,
  syncCreatorConcepts,
  syncCreatorProducts,
  removeCreatorConcept,
  removeCreatorProduct,
  listConceptAngleIds,
  syncConceptAngles,
  listConceptThemeIds,
  syncConceptThemes,
  listConceptCreatorIds,
  syncConceptCreators,
  listAnglePersonaIds,
  syncAnglePersonas,
  listAngleProductIds,
  syncAngleProducts,
  loadAllConceptAngles,
  loadAllConceptThemes,
  loadAllAnglePersonas,
  loadAllAngleProducts,
} from './junction-queries';
export type { UploadLinkInput, UploadLinkListRow } from './upload-links';
export {
  getOnboardingFormById,
  getOnboardingFormByToken,
  insertOnboardingForm,
  listOnboardingForms,
  updateOnboardingForm,
} from './onboarding-forms';
export type { OnboardingFormInput, OnboardingFormListRow } from './onboarding-forms';
export {
  getAiCharacterById,
  insertAiCharacter,
  listAiCharacters,
  updateAiCharacter,
} from './ai-characters';
export type { AiCharacterInput, AiCharacterListRow } from './ai-characters';
export { getCampaignById, insertCampaign, listCampaigns, updateCampaign } from './campaigns';
export type { CampaignInput } from './campaigns';
export {
  getCollectionById,
  insertCollection,
  listCollections,
  setCollectionCopywritingLinkInBrand,
  updateCollection,
} from './collections';
export type { CollectionInput, CollectionListRow } from './collections';
export {
  getCompetitiveResearchById,
  insertCompetitiveResearch,
  listCompetitiveResearch,
  updateCompetitiveResearch,
} from './competitive-research';
export type { CompetitiveResearchInput, CompetitiveResearchListRow } from './competitive-research';
export {
  getCreativeDimensionById,
  insertCreativeDimension,
  listCreativeDimensions,
  updateCreativeDimension,
} from './creative-dimensions';
export type { CreativeDimensionInput, CreativeDimensionListRow } from './creative-dimensions';
export { baseColumns, propagationColumns } from './columns';
export {
  insertCustomFieldSchema,
  listApplicableFieldSchemas,
  listCustomFieldSchemas,
  propagateCustomFieldSchema,
  softDeleteCustomFieldSchema,
  updateCustomFieldSchema,
} from './custom-field-schemas';
export type {
  CustomFieldSchemaInput,
  CustomFieldSchemaListRow,
  PropagateCustomFieldResult,
} from './custom-field-schemas';
export {
  getConceptById,
  insertConcept,
  listConcepts,
  updateConcept,
  updateConceptClientApproval,
  updateConceptClientStatus,
} from './concepts';
export type { ConceptInput, ConceptListRow } from './concepts';
export {
  getCopyById,
  insertCopy,
  listCopy,
  updateCopy,
  updateCopyClientApproval,
  updateCopyStatus,
} from './copy';
export type { CopyInput, CopyListRow } from './copy';
export {
  getCreatorById,
  insertCreator,
  listCreators,
  listPartnershipCreators,
  updateCreator,
  updateCreatorClientApproval,
  updateCreatorClientStatus,
} from './creators';
export type { CreatorInput, CreatorListRow } from './creators';
export {
  getCollaborationById,
  insertCollaboration,
  listAllCollaborations,
  listCollaborations,
  updateCollaboration,
} from './collaborations';
export type { CollaborationInput, CollaborationListRow } from './collaborations';
export { createAutoDb, createDb, createNeonDb, createNodeDb, drizzleConfig } from './db';
export type { Db, NeonDb, Schema } from './db';
export { deleteFromR2, downloadFromUrl, isR2Available, presignedGetUrl, uploadToR2 } from './r2';
export type {
  R2DeleteFailure,
  R2DeleteOutcome,
  R2DeleteResult,
  R2DownloadOutcome,
  R2DownloadResult,
  R2UploadFailure,
  R2UploadOutcome,
  R2UploadResult,
} from './r2';
export {
  DEMO_ACTOR_ID,
  DEMO_ADMIN_ACTOR_ID,
  DEMO_BRAND_ID,
  DEMO_TEAM_DUAL_ROLE_NAME,
  PARTNERSHIP_REFERENCE_DATE,
  PRODUCT_CSV_COLUMNS,
  STANDALONE_CONCEPT_SLUG,
  demoAdMetrics,
  demoAiCharacters,
  demoAssets,
  demoAngles,
  demoCampaigns,
  demoCollections,
  demoCompetitiveResearch,
  demoCompetitorAds,
  demoCreativeDimensions,
  demoCreatorRankings,
  demoUploadLinks,
  demoOnboardingForms,
  demoBrandAssignments,
  demoBrands,
  demoBriefs,
  demoConcepts,
  demoCopy,
  demoCollaborations,
  demoCreators,
  demoInterfaceConfig,
  demoMemberships,
  demoNotifications,
  demoPartnershipCreators,
  demoPersonas,
  demoProducts,
  demoPromotionRequests,
  demoReviewedPromotionRequests,
  demoTeam,
  demoThemes,
  demoUsers,
} from './demo-data';
export {
  clientAngles,
  clientCalendarEvents,
  clientConcepts,
  clientCopywriting,
  clientCreatives,
  clientCreators,
  clientPartnershipAds,
  clientThemes,
  clientVisibleFields,
  listAnnotations,
  listComments,
} from './client-queries';
export type {
  ClientAngle,
  ClientAnnotation,
  ClientCalendarEvent,
  ClientComment,
  ClientConcept,
  ClientCopy,
  ClientCreative,
  ClientCreator,
  ClientPartnershipAd,
  ClientTheme,
  VisibleField,
} from './client-queries';
export type { DemoBrand } from './demo-data';
export {
  getInterfacePageById,
  listInterfaceConfig,
  setFieldVisibility,
  setPageEnabled,
} from './interface-config';
export type { InterfaceFieldRow, InterfacePageRow } from './interface-config';
export {
  listNotificationSettings,
  listNotifications,
  setChannel,
  setNotificationChannel,
} from './notifications';
export type { NotificationChannel, NotificationRow, NotificationSettingRow } from './notifications';
export { getPersonaById, insertPersona, listPersonas, updatePersona } from './personas';
export type { PersonaInput, PersonaListRow } from './personas';
export { getProductById, insertProduct, listProducts, updateProduct } from './products';
export type { ProductInput, ProductListRow } from './products';
export {
  createPromotionRequest,
  listChildBrands,
  propagateAllContent,
  propagateInterfaceConfig,
  propagateTemplateRow,
  PROPAGATION_TABLES,
  resolveTemplateBrandId,
  seedContentFromTemplate,
} from './propagation';
export type {
  ContentPropagationResult,
  CreatePromotionInput,
  PropagationResult,
} from './propagation';
export {
  applyApprovedPromotion,
  listPendingPromotionRequests,
  listPromotionRequests,
  setPromotionRequestStatus,
} from './promotion-requests';
export type {
  ApplyPromotionResult,
  PromotionRequestInput,
  PromotionRequestRow,
} from './promotion-requests';
export * from './schema';
export { seed } from './seed';
export type { SeedResult } from './seed';
export { getActiveBrandRole, listBrandsForActor, listTeam, listTeamMembers } from './team';
export type { ActorBrandRow, DashboardRole, TeamListRow, TeamMemberRow, TeamRole } from './team';
export { getThemeById, insertTheme, listThemes, updateTheme } from './themes';
export type { ThemeInput, ThemeListRow } from './themes';
export {
  findAgencyByClerkOrg,
  listAvailableTeamMembers,
  onboardBrand,
  type OnboardBrandInput,
  type OnboardBrandResult,
} from './onboard';
export {
  ensureAgencyUser,
  isAgencyUserProvisioned,
  type EnsureAgencyUserInput,
  type EnsureAgencyUserResult,
} from './ensure-user';
export {
  getChannelSettings,
  logNotification,
  markNotificationFailed,
  markNotificationSent,
  resolveRecipients,
} from './notification-dispatch';
export type { LogNotificationInput, ResolvedRecipient } from './notification-dispatch';
export { withBrand } from './tenancy';
export type { BrandedTable, BrandScope, ScopedInsertValue, ScopedUpdateSet } from './tenancy';
export type { ScopedSelect, ScopedWrite } from './tenancy';
export { getViewPreference, saveViewPreference } from './view-preferences';
export {
  activateUserTableView,
  createUserTableView,
  deleteUserTableView,
  getUserTableView,
  listUserTableViews,
  renameUserTableView,
  updateUserTableViewConfig,
  type UserTableViewConfigInput,
} from './user-table-views';
// ── Module parity (2026-10-01): query layers + demo fixtures, one file per module ──
export * from './copy-types';
export * from './demo-copy-types';
export * from './creative-modules';
export * from './demo-creative-modules';
export * from './client-asset-folders';
export * from './demo-client-asset-folders';
export * from './creative-sheet-items';
export * from './demo-creative-sheet-items';
export * from './sm-campaign-feed-tasks';
export * from './demo-sm-campaign-feed-tasks';
export * from './creative-reporting';
export * from './demo-creative-reporting';
export * from './email-campaigns';
export * from './demo-email-campaigns';
export * from './email-flows';
export * from './demo-email-flows';
export * from './youtube-copy';
export * from './demo-youtube-copy';
export * from './airtable-tables';
export * from './client-access-tokens';
export * from './creator-registry';
export { listLinkedIds, syncLinks, syncLinksInBrand } from './links';
export type { LinkJunction, LinkSpec, LinkTable } from './links';
export { insertActivity, listActivity } from './activity-log';
export type { ActivityActor, ActivityChangeInput } from './activity-log';

// THE Airtable formula fields, computed at read time (docs/decisions/formula-policy-2026-10-02.md).
export * from './formulas';

// The per-column inheritance resolver (docs/audits/inheritance-plan-2026-10-02.md).
export * from './column-definitions';
export * from './column-seed';
export * from './custom-interface-pages';
