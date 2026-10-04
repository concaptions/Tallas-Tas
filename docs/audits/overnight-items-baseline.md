# Overnight run — production baseline (no-data-lost reference)

Captured 2026-10-04 before any merge or build of the overnight action-items run.
Read-only `count(*)` on every `public` base table, via `pg` against the production DATABASE_URL.
HEAD at capture: 4f2f275 (main, 3 ahead of origin).

Every QA pass of this run asserts these counts are unchanged, with exactly two intended
exceptions if Phase 8 (AI-27 import) applies: creative_sheet_items +377, creative_modules +35
(plus its two junctions), creator_products +27, and junction counts the dependency-closed
import predicts in its dry run.

| table | rows |
|---|---|
| activity_log | 0 |
| ad_metrics | 0 |
| agencies | 1 |
| ai_characters | 0 |
| angle_personas | 78 |
| angle_products | 57 |
| angles | 48 |
| annotations | 0 |
| assets | 0 |
| brand_assignments | 14 |
| brands | 6 |
| brief_asset_folders | 0 |
| campaign_concepts | 0 |
| campaigns_offers | 0 |
| client_asset_folders | 0 |
| collaboration_instances | 0 |
| collections | 5 |
| column_definitions | 447 |
| comments | 0 |
| competitive_research | 0 |
| competitor_ads | 0 |
| concept_angles | 115 |
| concept_collections | 207 |
| concept_themes | 4 |
| concepts | 106 |
| copy_types | 0 |
| copywriting | 4 |
| copywriting_campaigns | 0 |
| copywriting_copy_types | 0 |
| creative_briefs | 397 |
| creative_dimensions | 22 |
| creative_module_angles | 0 |
| creative_module_designs | 0 |
| creative_modules | 0 |
| creative_reporting | 0 |
| creative_sheet_items | 0 |
| creator_concepts | 87 |
| creator_products | 0 |
| creator_rankings | 0 |
| creators | 75 |
| custom_field_schemas | 0 |
| email_campaign_campaigns | 0 |
| email_campaign_collections | 0 |
| email_campaign_products | 0 |
| email_campaigns | 0 |
| email_flow_campaigns | 0 |
| email_flows | 0 |
| health_check | 1 |
| interface_fields | 51 |
| interface_pages | 11 |
| memberships | 6 |
| notification_log | 0 |
| notification_settings | 16 |
| onboarding_forms | 0 |
| personas | 31 |
| products | 9 |
| promotion_requests | 5 |
| propagation_runs | 0 |
| sm_campaign_feed_tasks | 0 |
| themes | 9 |
| upload_links | 0 |
| user_table_views | 1 |
| user_view_preferences | 11 |
| users | 6 |
| youtube_copy | 0 |
| youtube_copy_campaigns | 0 |
| youtube_copy_collections | 0 |
| youtube_copy_copy_types | 0 |
| youtube_copy_products | 0 |
