# Sprint 6 — Client Field Allowlist

Every field a client can ever see is listed here, per client-facing page.
Fields NOT on this list are never returned by a client-scoped query, even
if the frontend forgets to hide them. This is the **single source of truth**
for Agent 2's query layer.

Cross-referenced against: schema columns in `packages/db/src/schema/`,
PRD §10 field tables, `DEFAULT_INTERFACE_PAGES` in `packages/domain/src/interface/config.ts`,
and the Talal Feedback ticket's explicit exclusions.

## Client NEVER sees (global exclusion list)

These columns are stripped from EVERY client-scoped query result:

| Column | Reason |
|---|---|
| `created_by` | Internal Clerk user ID |
| `updated_by` | Internal Clerk user ID |
| `deleted_at` | Soft-delete internals |
| `template_row_id` | Propagation internals |
| `overridden_fields` | Propagation internals |
| `legacy_airtable_id` | Migration artefact |
| `brand_id` | Implicit from auth scope, never exposed |
| `custom_fields` | Admin-only extensibility |

## Page 1: Concepts

Source table: `concepts`

| Allowed field | Column | Editable? | Notes |
|---|---|---|---|
| Batch | `batch` | No | |
| Category | `category` | No | |
| Concept name | `name` | No | Auto-generated |
| Concept Style | `concept_style` | No | |
| Angle (resolved name) | `angle_id` → join | No | Resolved via join to angles.name |
| Theme (resolved name) | `theme_id` → join | No | Resolved via join to themes.name |
| Product (resolved name) | join to products | No | Via briefs→products or concept→briefs→products |
| Description (hypothesis) | `script_idea` | No | PRD calls this "Description (hypothesis)" |
| Pain Points | join persona | No | Via angle→persona |
| USP | join persona | No | Via angle→persona |
| Persona | join persona | No | Via angle→persona |
| Hook examples | `hook_examples` | No | |
| Approval Status | `approval_status` | No | Client sees but doesn't edit (readonly) |
| Client Status | `client_status` | Yes | Approve / Request Revisions |

**EXCLUDED from concepts:** `internal_status`, `production_status`, `creator_id`, `formats_to_create`, `ad_inspo_links`, `formats`

## Page 2: Creatives (Design + Reporting combined)

Source table: `creative_briefs` filtered to `internal_status = 'approved'`

| Allowed field | Column | Editable? | Notes |
|---|---|---|---|
| Name | `name` | No | Auto-generated creative name |
| Type | `type` | No | Static / Video |
| Funnel | `funnel` | No | TOF / MOF / BOF |
| Design file | `design_file` | No | Image/video URL array |
| Inspiration image | `inspiration_image` | No | Reference images |
| Client Status | `client_status` | Yes | Approve / Request Revisions |
| Comments & annotations | via `comments` + `annotations` tables | Yes | New subsystem |
| Platform | `platform` | No | Where the ad runs (Meta/TikTok), not source |
| Performance | `performance` | No | Winner/Loser/Scaling etc |

**EXCLUDED from creatives:** `source` (platform source — Insense/Billo/TAS), `assignee`, `internal_status`, `priority`, `qa_video_editor`, `qa_designer`, `qa_strategist`, `qa_checklist_doc`, `brief_to_design`, `script_content`, `elements_tested`, `inspo_links`, `dimensions`, `design_file_url`, `spelling_feedback`, `spelling_feedback_2`, `click_for_ai_spell_checker`, `ad_content`, `inspiration`, `language`, `offer`, `batch`, `version`, `sequence`

## Page 3: Copywriting

Source table: `copywriting` filtered via concept/brief internal status

| Allowed field | Column | Editable? | Notes |
|---|---|---|---|
| Copy number | `copy_number` | No | |
| Primary copy | `primary_copy` | No | The actual copy text |
| Headline | `headline` | No | |
| Link description | `link_description` | No | |
| CTA | `cta` | No | |
| Funnel | `funnel` | No | |
| Status | `status` | Yes | Client-facing copy status |
| Client's Comment | `client_comment` | Yes | |

**EXCLUDED from copywriting:** `used`, `winning`, `meta_rating`, `click_for_ai_spell_checker`, `spelling_feedback`

## Page 4: UGC Management

Source table: `creators`

| Allowed field | Column | Editable? | Notes |
|---|---|---|---|
| Name | `name` | No | |
| Age bracket | `age_bracket` | No | |
| Gender | `gender` | No | |
| Profile pic | `profile_pic_url` | No | |
| Video intro | `video_intro_url` | No | |
| Shipping location | `shipping_location` | No | |
| Tracking number | `tracking_number` | Yes | |
| Deadline | `deadline` | No | |
| Client Status | `client_status` | Yes | |
| Client Note | `client_note` | Yes | |
| Raw assets URL | `raw_assets_url` | No | For client to review delivered content |

**EXCLUDED from UGC:** `platform` (Insense/Billo/Backstage — source), `internal_brief`, `budget_per_60s`, `creator_cost`, `cost_usd`, `internal_creator_status`, `internal_assets_status`, `date_of_management`, `continue_working_with`, `creator_link`, `ethnicity`

## Page 5: Partnership Ads Tracking

Source table: `creators` filtered to `for_partnership_ads = true`

| Allowed field | Column | Editable? | Notes |
|---|---|---|---|
| Creator name | `name` | No | |
| Instagram username | `instagram_username` | No | |
| Partnership activity | `partnership_activity` | No | Active/Not Active/Ended |
| Expires on | computed | No | `partnership_activated_at` + `partnership_period_days` |

**EXCLUDED from Partnership:** `partnership_price_per_30_days` (PRICE — never), `budget_per_60s`, `creator_cost`, `cost_usd`, `platform`, `internal_brief`, `internal_creator_status`, `internal_assets_status`, `partnership_notes`, `extension_days`, `continue_working_with`, `facebook_profile_url`

## Page 6: Promotional Calendar (NEW)

Source table: `campaigns_offers`

**IMPORTANT DECISION:** The campaigns_offers table docblock says "Internal only — never shown in the client interface." However, the sprint prompt explicitly lists "Promotional Calendar" as a client page. Resolution: expose a MINIMAL read-only subset — just the calendar events, no discount codes or financial details.

| Allowed field | Column | Editable? | Notes |
|---|---|---|---|
| Campaign name | `name` | No | Auto-generated |
| Holiday | `holiday` | No | |
| Official date | `official_date` | No | |
| Ads launch date | `ads_launch_date` | No | |
| Ads end date | `ads_end_date` | No | |

**EXCLUDED from Promotional Calendar:** `discount_offer`, `code`, `description`, `confirmed_by_client`, `launched`, `country`, `product_id` — all operational/financial detail stays internal.

## Clerk role prerequisite

The `brand_role` enum already includes `'client'`. A user with `brand_assignments.role = 'client'` on a brand sees that brand's client interface. The `isInternalBrandRole(role)` function in `packages/domain/src/roles.ts` returns `role !== 'client'`, which is the gate.

The `/client` layout must resolve the viewer's brand from their `brand_assignments` row where `role = 'client'`, and scope all queries to that single brand. A client user has NO agency membership (the `memberships` table comment says "Clients have no membership").

## Interface Config extension

The existing `INTERFACE_PAGE_KEYS` tuple has 5 entries: `concepts`, `creatives`, `copywriting`, `ugc`, `partnership`. Add `'calendar'` as the 6th key. The `interface_pages` and `interface_fields` tables already support per-brand configuration with template/child override semantics through the existing save/load infrastructure. The calendar page needs no editable fields (all read-only), so its `interface_fields` rows all have `client_editable = false`.
