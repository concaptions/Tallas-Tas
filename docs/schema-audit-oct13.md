# Schema drift audit, all active client bases against the template

Date: 2026-10-13
Author: Buildberg engineering
DB snapshot: 2026-10-13 13:44:58 UTC, Railway Postgres, 18 MB on disk
Bases: 4 active client bases plus the template; 1 archived base (test) left out

Read-only audit. No row was written, no migration was run, no code was changed. Every number below
comes from the live database at the snapshot time or from a grep of the repo at commit 1b10108.

A note on names. The brief names tables bases, base_columns and seeds/columns.ts. In this codebase the
same things are brands, column_definitions and packages/db/src/column-seed.ts. The report uses the
real names. The brief also lists a few tables this schema does not have (ugc_submissions, campaigns,
offers, creator_pool); their equivalents are creators, campaigns_offers and creator_registry.

## 1. Executive summary

- Active client bases audited: 4 (Gratsi, Niagara Sleep Solutions, Mattress Central, Funky Painting).
- Total drift count across all bases: 212 items (196 column-level, 16 vocabulary columns).
- Columns per base vs template: template 283, Gratsi 239 (73 of them custom),
  Niagara 0, Mattress Central 0, Funky Painting 0 (the three unseeded bases inherit the template as is).
- The DDL is already one shared Postgres schema (73 tables, brand_id on 52 of them). Drift lives in the
  display config layer, in the vocabulary stored inside shared columns, and in leftovers of client imports.
- Unique effective schemas today: 2 (template and Gratsi) in column config, 2 in stored vocabulary
  (Gratsi and Niagara disagree on 16 columns). Under a shared contract: 1.
- Headline cost: 6 migrations plus one seed re-run collapse to a shared schema today. Gratsi alone
  took 7 client-driven migrations (0032, 0033, 0038, 0039, 0044, 0056, 0059) out of 69 total; at that rate 5 more
  clients add 35 migrations, 41 in all, plus about 365 more custom config rows
  and 5 more private vocabularies to reconcile in every shared report.

## 2. The case for standardization

- Per-base copies compound. Each client arrives with its own Airtable shape, so every shared feature is
  then built once per shape: Gratsi needed 7 migrations and 73 custom columns, and every column it hides
  (41) or renames (52) is a branch the next feature must honour. Client N adds N things that the other
  N minus 1 bases do not have, so the reconciliation work grows with the square of the client count.
- Airtable lets every base be its own thing because nothing is shared across bases. A multi-tenant
  relational app is the opposite: one table serves every brand, one query serves every dashboard, one
  status word drives one state machine. Two spellings of a funnel or two names for a dimension are not
  two preferences, they are two bugs in every cross-brand report.
- The shared contract: core domain tables are identical for every brand (they already are in DDL).
  Per-brand variance lives in column_definitions as display config (label, order, hidden), never in
  table DDL. A new client field is a display row over a shared custom_fields jsonb, one migration for
  everyone, and the template owns the catalogue that brands subscribe to.

## 3. Drift matrix

Severity uses the chip tones of the design system: critical is bad, high is warn, medium is info, low is
mute. The score is the weighted sum (4, 3, 2, 1). Enum values diverged counts columns where Gratsi and
Niagara, the two bases holding rows, store different value sets.

| Base | Columns | Missing vs template | Added | Enum diverged | Rows | Severity |
|---|---|---|---|---|---|---|
| Template (creative-hub-template) | 283 | none | none | none | 0 | 9 (3 stale rows) |
| Gratsi | 239 | 41 hidden, 52 relabelled, 21 retyped | 73 | 16 | 1084 | 425 |
| Niagara Sleep Solutions | 0 (inherits 283) | 0 | 0 | 16 | 31 | 35 |
| Mattress Central | 0 (inherits 283) | 0 | 0 | 0 (no rows) | 0 | 0 |
| Funky Painting | 0 (inherits 283) | 0 | 0 | 0 (no rows) | 0 | 0 |

Missing from template here means a template column the base removes from view, since the DDL is shared
and no base can lack a physical column. Severity counts for Gratsi: critical 9, high 59, medium 52, low 73.

Three more drift sources sit outside the per-base columns and are counted in the total:

- 9 config rows name columns that migration 0066 dropped from the DDL (template 3, Gratsi 6).
  The seed on main no longer has them; production has not had the seed re-applied since Oct 12.
- 2 frozen tables still carry Gratsi rows: creative_sheet_items 378 and creative_dimensions 22.
  Nothing reads them since migration 0061; the drop waits on Talal.
- 2 generations of interface config coexist: interface_fields, interface_pages and
  interface_tab_visibility (Niagara 23 rows, template 4) next to custom_interface_pages (migration 0063).

## 4. Per-base drill-down

### 4.1 Gratsi

Gratsi is the only client base with its own column config (239 rows: 125 tracking the template, 41 platform
rows, 73 custom) and the only one carrying imported Airtable data. Every finding below is a row in
column_definitions or a value in a shared column, not a table of its own.

Columns hidden from the template (41). Reach is the number of non-test source files naming the key.

| Table | Column | Template label | Severity | Reach |
|---|---|---|---|---|
| ai_characters | appearance | Appearance | medium | 7 |
| ai_characters | attachments | Attachments | medium | 18 |
| ai_characters | basic_info | Basic Info | medium | 2 |
| ai_characters | hobbies_and_lifestyle | Hobbies & Lifestyle | medium | 2 |
| ai_characters | name | Name | medium | 377 |
| ai_characters | personality_traits | Personality Traits | medium | 2 |
| ai_characters | status | Status | medium | 231 |
| ai_characters | tone_of_voice | Tone of Voice | medium | 2 |
| ai_characters | traits_and_habits | Traits & Habits | medium | 2 |
| ai_characters | voice_link | Voice Link (Eleven Labs) | medium | 2 |
| ai_characters | why_promotes_brand | Why He Promotes this brand? | medium | 2 |
| ai_characters | work_and_background | Work & Background | medium | 2 |
| angles | pain_points | Pain Points | medium | 15 |
| angles | type | Type | critical | 576 |
| angles | usp | USP | medium | 24 |
| campaigns_offers | product_id | (Internal) Product | medium | 24 |
| collections | angle_id | Angles | medium | 16 |
| collections | creative_design_2_id | (Internal) Creative Design 2 | medium | 3 |
| concepts | ad_inspo_links | Ad Inspo | medium | 6 |
| concepts | client_status | Client Status | critical | 28 |
| concepts | internal_status | Internal Status | critical | 19 |
| creative_briefs | ad_content | Ad Content | medium | 3 |
| creative_briefs | asset_id | Assets | medium | 3 |
| creative_briefs | campaign_offer_id | Campaigns & Offers | medium | 7 |
| creators | deadline | (Internal) Deadline for the request | medium | 15 |
| creators | for_partnership_ads | For Partnership Ads? | critical | 7 |
| creators | internal_assets_status | Internal Assets Status | medium | 4 |
| personas | buying_triggers | Buying Triggers (Breakthrough Advertising) | medium | 4 |
| personas | day_in_the_life | A Day in the Life | medium | 6 |
| personas | emotional_triggers | Emotional Triggers (Cashvertising) | medium | 4 |
| personas | pain_points | Pain Points (Cashvertising) | medium | 15 |
| personas | perceived_barriers | Perceived Barriers (Buyer Personas) | medium | 4 |
| personas | problem_challenge | Problem/Challenge (StoryBrand) | medium | 4 |
| personas | success_factors | Success Factors (Buyer Personas) | medium | 4 |
| personas | success_transformation | Success/Transformation (StoryBrand) | medium | 4 |
| personas | trigger_words | Trigger Words (Mindstates) | medium | 4 |
| products | campaigns_offers | Campaigns & Offers | medium | 16 |
| products | collection_link | Collection Link | medium | 6 |
| products | collections | (Internal) Collections | medium | 46 |
| products | concepts | Concepts | medium | 119 |
| products | copywriting | Copywriting | medium | 87 |

Custom columns (73) with a proposed home. Shared means the field exists for every brand already or should;
join means the relational schema expresses it as a junction or foreign key and the row is an Airtable
lookup that needs no column; frozen means it goes with the frozen table; custom means it stays a
brand-only display row over the shared custom_fields jsonb.

| Table | Column | Label | Type | Proposed home | Severity | Reach |
|---|---|---|---|---|---|---|
| angles | concept_angles | Concepts | link | join | high | 16 |
| angles | creative_briefs | (Internal) Creative Design 2 | link | join | high | 63 |
| angles | creative_module_angles | (Internal) Creative Modules | link | join | high | 10 |
| angles | creators_link | Creators | link | join | high | 2 |
| campaigns_offers | campaign_concepts | Angles | link | join | high | 13 |
| campaigns_offers | copywriting_campaigns | Ads Copywriting copy | link | join | high | 16 |
| campaigns_offers | email_campaign_campaigns | Email Campaigns | link | join | high | 8 |
| campaigns_offers | email_flow_campaigns | Email Campaigns Management copy | link | join | high | 9 |
| campaigns_offers | promotional_ideas | Promotional Ideas | richText | custom | medium | 3 |
| campaigns_offers | youtube_copy_campaigns | COPY | link | join | high | 12 |
| collections | concept_collections | Angles | link | join | high | 4 |
| collections | creative_briefs | (Internal) Creative Design | link | join | high | 63 |
| collections | youtube_copy_collections | Copywriting | link | join | high | 5 |
| concepts | campaign_concepts | Campaigns & Offers | link | join | high | 13 |
| concepts | creative_briefs | (Internal) Creative Design | link | join | high | 63 |
| concepts | formats | Type | multipleSelects | shared | critical | 33 |
| concepts | performance | Performance | lookup | join | high | 48 |
| copywriting | airtable_status_banner | ⚠️ Please Change the Status of the copy | singleLineText | drop | low | 1 |
| copywriting | angle | Angle | singleLineText | custom | medium | 95 |
| copywriting | campaign_from_campaign | Campaign (from Campaign) | lookup | join | high | 3 |
| copywriting | client_comment | Client's Comment | multilineText | drop | low | 10 |
| copywriting | code_from_campaign | Code (from Campaign) | lookup | join | high | 3 |
| copywriting | collection_url | Collection URL | lookup | join | low | 2 |
| copywriting | copywriting_campaigns | Campaign Code | link | join | high | 16 |
| copywriting | copywriting_copy_types | Copy Type | link | join | high | 10 |
| copywriting | created_by | Created By | createdBy | join | high | 16 |
| copywriting | funnel | Funnel | singleSelect | shared | critical | 49 |
| copywriting | internal_product | (Internal) Product | singleLineText | custom | medium | 4 |
| copywriting | link_from_product | Link (from Product) | lookup | join | high | 3 |
| copywriting | meta_rating | Meta Rating | rating | drop | low | 4 |
| copywriting | offer | Offer | lookup | join | high | 42 |
| copywriting | products_from_collections | Products (from Collections) | lookup | join | low | 2 |
| copywriting | winning | Winning | checkbox | drop | low | 25 |
| creative_briefs | ads_copywriting_copy | Ads Copywriting copy | link | join | high | 2 |
| creative_briefs | batch | Batch | singleSelect | shared | critical | 49 |
| creative_briefs | concepts_from_angles | Concepts (from Angles) | lookup | join | high | 2 |
| creative_briefs | copywriting | Copywriting | link | join | high | 87 |
| creative_briefs | created_at | Created | createdTime | join | high | 12 |
| creative_briefs | creative_module_designs | Creative Module | link | join | high | 9 |
| creative_briefs | creative_sheet_items | Creative Sheet | link | join | high | 20 |
| creative_briefs | language | Language | singleSelect | shared | critical | 15 |
| creative_briefs | offer | Offer | richText | shared | critical | 42 |
| creative_briefs | script_content | Script / Ad Content | richText | custom | medium | 3 |
| creative_briefs | spelling_feedback_2 | Spelling Feedback 2 | multilineText | custom | medium | 4 |
| creative_briefs | updated_at | Last Modified | lastModifiedTime | join | high | 22 |
| creative_reporting | creative_name_from_creative | Creative Name (from Creative) | lookup | join | high | 2 |
| creative_sheet_items | angle | Angle (from Creative Name) | lookup | join | high | 95 |
| creative_sheet_items | collection | Collection | lookup | join | low | 26 |
| creative_sheet_items | concepts_from_angle | Concepts (from Angle) (from Creative Name) | lookup | join | high | 2 |
| creative_sheet_items | created_at | Created | createdTime | join | high | 12 |
| creative_sheet_items | creative_module | Creative Module | lookup | join | high | 2 |
| creative_sheet_items | design_file | Design File (from Creative Name) | lookup | join | high | 8 |
| creative_sheet_items | design_link_url | Design Link URL | lookup | join | high | 2 |
| creative_sheet_items | elements_we_are_testing | Elements we are Testing | lookup | join | high | 2 |
| creative_sheet_items | funnel | Funnel | lookup | join | high | 49 |
| creative_sheet_items | internal_product | (Internal) Product (from Creative Name) | lookup | join | high | 4 |
| creative_sheet_items | performance | Performance (from Creative Name) | lookup | join | high | 48 |
| creative_sheet_items | platform | Platform | lookup | join | high | 97 |
| creative_sheet_items | proposed_copy | Proposed Copy | lookup | join | high | 2 |
| creative_sheet_items | type | Type | lookup | join | high | 576 |
| creators | concept_ids | Concepts | link | join | high | 4 |
| creators | creator_cost_with_fee | Creator's cost (USD) | formula | join | high | 2 |
| creators | notify_flag | Notify Flag | formula | join | high | 2 |
| personas | passion | Passion | richText | shared | medium | 10 |
| youtube_copy | airtable_status_banner | ⚠️ Please Change the Status of the copy | singleSelect | drop | low | 1 |
| youtube_copy | campaign_from_campaign | Campaign (from Campaign) | lookup | join | high | 3 |
| youtube_copy | code_from_campaign | Code (from Campaign) | lookup | join | high | 3 |
| youtube_copy | collection_url | Collection URL | lookup | join | high | 2 |
| youtube_copy | created_by | Created By | createdBy | join | high | 16 |
| youtube_copy | internal_product | (Internal) Product | singleLineText | custom | medium | 4 |
| youtube_copy | link_from_product | Link (from Product) | lookup | join | high | 3 |
| youtube_copy | offer | Offer | lookup | join | high | 42 |
| youtube_copy | products_from_collections | Products (from Collections) | lookup | join | high | 2 |

Relabels (52). Cosmetic, and the one kind of variance the contract keeps in column_definitions.

| Table | Column | Template label | Gratsi label |
|---|---|---|---|
| angles | angle_personas | Personas | Personas (from Angles) |
| angles | angle_products | Product | Product (from Angles) |
| angles | brief_url | Brief URL | Brief |
| angles | exact_script_url | Exact Script URL | Exact Script |
| campaigns_offers | confirmed_by_client | Confirmed by Client | Interested |
| collections | creative_design_note | (Internal) Creative Design | (Internal) Creative Design 2 |
| collections | name | Collection Name | Main Collection |
| concepts | angle_personas | Persona | Personas |
| concepts | approval_status | Approval Status | Status |
| concepts | client_comments | Client Comments | Client's Comments |
| concepts | concept_angles | Angles | Angle |
| concepts | concept_style | Concept Style | Style |
| concepts | creator_concepts | Creator | UGC Management |
| concepts | description | Description | Decription |
| concepts | hook_examples | Hook examples | Hooks |
| concepts | name | Concept Name | Name |
| concepts | script_idea | Script idea | Script |
| copy_types | copywriting_copy_types | Meta copies | Ads Copywriting copy |
| copy_types | youtube_copy_copy_types | YouTube copies | Copywriting |
| copywriting | collections | Collection | Collections |
| copywriting | link_description | News Feed / Link Description | News Feed |
| copywriting | primary_copy | Primary Copy | Descriptions |
| creative_briefs | brief_to_design | Brief | Brief to Design/Editing |
| creative_briefs | collection_id | Collection | (Internal) Collections 3 |
| creative_briefs | inspiration_image | Inspiration Image | Inspiration |
| creative_modules | creative_module_designs | Creative Designs | (Internal) Creative Design |
| creative_reporting | brief_id | Creative | Creative Name |
| creative_sheet_items | name | Name + Angle + Offer | Name |
| creators | cost_usd | Paid by TAS (USD) | Paid by TAS |
| creators | creator_concepts | Concepts to film | Concept to film |
| creators | creator_cost | Creator Cost (USD) | Creator's cost (USD) - Internal |
| creators | internal_brief | Internal Brief | Additional Note - TAS Team |
| creators | internal_creator_status | Internal Creator's Status | Creator Status |
| creators | slack_notified | Slack Notified | Slack Notified  |
| creators | video_intro_url | Creator's Video Intro | Creator's video Intro |
| personas | buying_triggers | Buying Triggers (Breakthrough Advertising) | buying_triggers |
| personas | core_desires | Core Desires (Cashvertising) | Drivers for this persona |
| personas | day_in_the_life | A Day in the Life | day_in_the_life |
| personas | demographic | Demographic | Description [Age Status Salary] |
| personas | emotional_triggers | Emotional Triggers (Cashvertising) | emotional_triggers |
| personas | name | Persona Name | Name |
| personas | pain_points | Pain Points (Cashvertising) | pain_points |
| personas | perceived_barriers | Perceived Barriers (Buyer Personas) | perceived_barriers |
| personas | problem_challenge | Problem/Challenge (StoryBrand) | problem_challenge |
| personas | psychographic | Psychographic | Personality |
| personas | stage_of_awareness | Stage of Market Awareness (Breakthrough Adv.) | Problem-Solution Awareness Level |
| personas | success_factors | Success Factors (Buyer Personas) | success_factors |
| personas | success_transformation | Success/Transformation (StoryBrand) | success_transformation |
| personas | trigger_words | Trigger Words (Mindstates) | trigger_words |
| products | youtube_copy_products | YouTube Copy | Youtube Copywriting |
| youtube_copy | descriptions | Descriptions | Descriptions (90 caractères max) |
| youtube_copy | used | Used | USED |

Type differences (21). Thirteen are persona text fields with a null type on the Gratsi row, five are
multiline text that Gratsi stores as rich text, one is concept_themes as a multi select instead of a
record link, one is link_description as single line, one is internal_brief as rich text. None changes
the DDL; the type is a display hint and the fix is a seed row, not a migration.

Enum drift against Niagara (the only other base with rows). Values present in one base and not the other.

| Column | Severity | Gratsi only | Niagara only |
|---|---|---|---|
| concepts.internal_status | low | none | ad_submitted |
| copywriting.status | medium | none | approved, edited_by_client, revisions_needed |
| creative_briefs.funnel | critical | ALL FUNNELS, RETARGETTING | All Funnels, Retargeting |
| creative_briefs.type | high | none | Carousel |
| creative_briefs.internal_status | medium | revisions_submitted | ad_submitted |
| creative_briefs.client_status | medium | disapproved, revisions_needed, revisions_submitted | none |
| creative_briefs.name_mode | low | auto | none |
| creators.internal_creator_status | high | request | approved, pending_for_cs_approval, revisions_needed |
| creators.client_status | high | disapproved, draft, pending_for_approval | revisions_needed |
| creators.internal_assets_status | medium | none | approved, revisions_needed |
| promotion_requests.status | low | pending | approved |
| user_view_preferences.view_type | low | kanban, list | none |
| concepts.formats | critical | five angle types, listed below | Carousel, Motion Graphic, Static, Video |
| creative_briefs.dimensions | critical | Facebook Feed Square, Facebook Reels, Meta | none |
| creative_briefs.platform | low | none | TikTok |
| creators.platform | low | none | Backstage, Direct Management |

The three critical ones:

- creative_briefs.funnel: Gratsi stores ALL FUNNELS and RETARGETTING (32 rows), Niagara stores All Funnels and
  Retargeting. One grouped report shows four funnels instead of two. Reach: 15 files name the column.
- creative_briefs.dimensions: Gratsi stores Facebook Feed Square (352) and Facebook Reels (340), the code
  vocabulary is ratios (1:1, 4:5, 9:16). normalizeCreativeDimensions reads both spellings in 5 files.
- concepts.formats: Gratsi stores angle types (Critical, Emotional, Exciting, Functional, Identity, 114
  values) under the formats key; Niagara stores formats (Carousel, Static, Video). Same key, two meanings.

Code reach notes. Promoting or dropping the 73 custom columns touches 133 distinct source files; the 46
lookup and link rows among them resolve to junction tables the code already reads (concept_angles,
campaign_concepts, copywriting_campaigns and so on), so their removal is a seed change with no code
reach. The hidden concepts.client_status and concepts.internal_status rows matter most: the two-track
approval gate reads those keys in 28 and 19 files respectively.

### 4.2 Niagara Sleep Solutions

- Column config: none. Resolves to the template's 283 columns unchanged.
- Rows: 31 across content tables (concepts 4, briefs 7, creators 5, personas 3,
  angles 5, copy 4, products 3). This is the demo seed data set, written by the app.
- Vocabulary: every stored value matches the code lists (funnel in title case, dimensions as ratios,
  formats as formats). Niagara is what the contract looks like; the 16 diverged columns are Gratsi diverging from it.
- Leftover: 23 interface_fields rows and 5 interface_pages rows from the first interface config generation,
  superseded by custom_interface_pages (0063). Orphan config, not data.
- Code reach if promoted or dropped: nothing, there is no custom column to promote.

### 4.3 Mattress Central

- Column config: none (inherits the template). Rows: 0. Only 4 brand assignments and 2 promotion requests exist.
- Unseeded in the sense of the brief: it has never received a column seed run, which is correct for a base
  that keeps the template shape. Nothing to diff until it is migrated from Airtable.

### 4.4 Funky Painting

- Column config: none (inherits the template). Rows: 0. Only 2 brand assignments and 1 promotion request exist.
- Same position as Mattress Central. Its Airtable base is the next copy waiting to happen unless the
  import lands on the shared shape with display rows only.

### 4.5 Template (creative-hub-template)

- 283 column rows across 21 tables, 8 hidden (the Oct 12 retirements). 3 rows are stale: concepts.formats_to_create,
  concepts.production_status and copywriting.used name DDL columns that 0066 dropped. The seed on main
  already omits them; one seed re-run removes them.
- No content rows. The template holds shape, not data, which is right.
- Nothing has ever propagated: propagation_runs is empty and the 5 promotion requests are field-level.

## 5. Standardization plan

- Freeze per-base variance into column_definitions only. From today no client gets an ALTER TABLE of its
  own; a brand may hide, rename and reorder, and that is all a brand row may do.
- The template owns the catalogue. column_definitions rows with brand_id of the template are the contract;
  a client subscribes by having no row (inherit) or a tracking row (relabel). This is already how the
  resolver works; the plan makes it the only path.
- New custom fields: one migration adds a custom_fields jsonb column to each content table and a
  brand_field_overrides table; a client field becomes a column_definitions row with source custom over
  that jsonb. Every base inherits the column; only the display row is per brand.
- Migration path, three steps, one week each, no downtime:
  1. Week 1, config: re-run the column seed on Railway (removes 9 stale rows), reclassify the 46 Gratsi
     lookup rows as joins (seed change), decide the 27 remaining custom rows between shared and custom.
  2. Week 2, data: three UPDATE migrations, funnel casing, dimensions to ratios, concepts.formats to the
     angle type column. Each is one statement per brand with a count check before and after.
  3. Week 3, DDL: custom_fields jsonb and brand_field_overrides (one migration), drop the two frozen
     tables, retire the three first-generation interface config tables. Three migrations, all additive
     or on tables nothing reads.
- Governance: a new field request goes to the template first (promotion request, Admin approval) and
  propagates; no out-of-band ALTER TABLE on a client base. The propagation page already enforces the
  approval; the rule adds that DDL changes only ever ship as template migrations.

## 6. Risks of staying on per-base copies

- Feature releases cost N times. One client already cost 7 migrations and 73 custom rows; four clients at that
  rate is 28 migrations and about 290 custom rows, each a branch the QA matrix has to cover.
- Reporting across bases becomes impossible without per-query shims. Today a funnel report needs a
  casing shim, a dimensions report needs normalizeCreativeDimensions, and a formats report cannot be
  written at all because Gratsi stores angle types in that column.
- Onboarding a new client stops being a copy and starts being a merge. The Gratsi import needed its own
  parity migration (0039), a module parity migration (0038) and 73 config rows before the first page
  rendered; Mattress Central and Funky Painting will each need the same unless the shape is fixed first.
- The team hits a ceiling at about 5 bases. With 5 private vocabularies every status change, every new
  column and every report touches 5 shapes; the sprint logs for Oct 10 to Oct 12 already show one client
  consuming most of a week of schema work.

## 7. Appendix

### 7.1 Raw column diff per base

Template columns per table (config rows): ai_characters 12, angles 16, campaigns_offers 13, client_asset_folders
4, collections 8, competitive_research 7, concepts 23, copy_types 4, copywriting 11, creative_briefs 31,
creative_dimensions 4, creative_modules 4, creative_reporting 13, creative_sheet_items 17, creators 37,
email_campaigns 17, email_flows 13, personas 15, products 12, sm_campaign_feed_tasks 6, youtube_copy 16.

Gratsi columns per table (config rows): ai_characters 12, angles 19, campaigns_offers 8, collections 10,
concepts 25, copy_types 2, copywriting 23, creative_briefs 40, creative_modules 1, creative_reporting 3,
creative_sheet_items 25, creators 34, personas 16, products 10, youtube_copy 11.

DDL columns per content table (shared by every base): concepts 32, creative_briefs 57, copywriting 28, personas
27, angles 25, themes 17, creators 59, products 14, campaigns_offers 24, collections 19, creative_modules 13,
creative_sheet_items 28, creative_dimensions 15, youtube_copy 23, ai_characters 23.

Gratsi type differences:

| Table | Column | Template type | Gratsi type |
|---|---|---|---|
| concepts | concept_themes | link | multipleSelects |
| concepts | hook_examples | multilineText | richText |
| concepts | pain_points | multilineText | richText |
| concepts | script_idea | multilineText | richText |
| concepts | usp | multilineText | richText |
| copywriting | link_description | multilineText | singleLineText |
| creators | creator_info_request | multilineText | richText |
| creators | internal_brief | multilineText | richText |
| personas | buying_triggers | multilineText | null |
| personas | core_desires | multilineText | null |
| personas | day_in_the_life | multilineText | null |
| personas | demographic | multilineText | null |
| personas | emotional_triggers | multilineText | null |
| personas | name | multilineText | null |
| personas | pain_points | multilineText | null |
| personas | perceived_barriers | multilineText | null |
| personas | problem_challenge | multilineText | null |
| personas | psychographic | multilineText | null |
| personas | success_factors | multilineText | null |
| personas | success_transformation | multilineText | null |
| personas | trigger_words | multilineText | null |

Stale config rows (DDL column dropped by 0066):

- template: concepts.formats_to_create
- template: concepts.production_status
- template: copywriting.used
- gratsi: concepts.formats_to_create
- gratsi: concepts.production_status
- gratsi: copywriting.client_comment
- gratsi: copywriting.meta_rating
- gratsi: copywriting.used
- gratsi: copywriting.winning

Row counts per content table and base (live rows, soft-deleted excluded):

| Table | Template | Gratsi | Niagara | Mattress Central | Funky Painting |
|---|---|---|---|---|---|
| concepts | 0 | 102 | 4 | 0 | 0 |
| creative_briefs | 0 | 391 | 7 | 0 | 0 |
| copywriting | 0 | 2 | 4 | 0 | 0 |
| personas | 0 | 28 | 3 | 0 | 0 |
| angles | 0 | 43 | 5 | 0 | 0 |
| themes | 0 | 0 | 0 | 0 | 0 |
| creators | 0 | 72 | 5 | 0 | 0 |
| products | 0 | 6 | 3 | 0 | 0 |
| campaigns_offers | 0 | 0 | 0 | 0 | 0 |
| collections | 0 | 5 | 0 | 0 | 0 |
| creative_modules | 0 | 35 | 0 | 0 | 0 |
| creative_sheet_items | 0 | 378 | 0 | 0 | 0 |
| creative_dimensions | 0 | 22 | 0 | 0 | 0 |
| youtube_copy | 0 | 0 | 0 | 0 | 0 |
| ai_characters | 0 | 0 | 0 | 0 | 0 |

themes is a global table (9 rows, no brand_id), per non-negotiable 3.

Stored vocabulary per column and base (value and count):

- angles.status (gratsi): approved 6, pending_for_approval 25
- concepts.category (niagara-sleep-solutions): Iteration 2, New 2
- concepts.category (gratsi): Iteration 28, New 74
- concepts.internal_status (niagara-sleep-solutions): ad_submitted 1, draft 3
- concepts.internal_status (gratsi): draft 102
- concepts.client_status (niagara-sleep-solutions): pending_for_approval 4
- concepts.client_status (gratsi): pending_for_approval 102
- concepts.approval_status (gratsi): approved 87, pending_client 12, rejected 2
- concepts.client_approval_status (gratsi): approved 87, disapproved 2, pending_for_approval 12
- concepts.name_mode (niagara-sleep-solutions): manual 4
- concepts.name_mode (gratsi): manual 102
- copywriting.status (niagara-sleep-solutions): approved 1, edited_by_client 1, pending_for_client_review 1,
  revisions_needed 1
- copywriting.status (gratsi): pending_for_client_review 2
- creative_briefs.funnel (niagara-sleep-solutions): All Funnels 1, Retargeting 1, TOF 5
- creative_briefs.funnel (gratsi): ALL FUNNELS 21, RETARGETTING 11, TOF 359
- creative_briefs.type (niagara-sleep-solutions): Carousel 1, Motion Image 1, Static 2, Video 3
- creative_briefs.type (gratsi): Motion Image 1, Static 65, Video 325
- creative_briefs.priority (niagara-sleep-solutions): Static Average 1, Static High 1, Video Average 2, Video High 3
- creative_briefs.priority (gratsi): Static Average 22, Static High 34, Video Average 105, Video High 219
- creative_briefs.internal_status (niagara-sleep-solutions): ad_submitted 1, approved 4,
  sent_to_editor_or_designer 1, under_editing_or_designing 1
- creative_briefs.internal_status (gratsi): approved 369, revisions_submitted 17, sent_to_editor_or_designer 1,
  under_editing_or_designing 4
- creative_briefs.client_status (niagara-sleep-solutions): approved 1, launched 1, pending_for_approval 5
- creative_briefs.client_status (gratsi): approved 226, disapproved 2, launched 89, pending_for_approval 10,
  revisions_needed 51, revisions_submitted 13
- creative_briefs.language (gratsi): English 124
- creative_briefs.name_mode (niagara-sleep-solutions): manual 7
- creative_briefs.name_mode (gratsi): auto 1, manual 390
- creative_sheet_items.status (gratsi): approved 226, denied 2, launched 86, revisions_needed 51, revisions_submitted 13
- creators.internal_creator_status (niagara-sleep-solutions): approved 3, pending_for_cs_approval 1, revisions_needed 1
- creators.internal_creator_status (gratsi): request 72
- creators.client_status (niagara-sleep-solutions): approved 1, due_shipment 1, filming_in_progress 1,
  revisions_needed 1, video_delivered 1
- creators.client_status (gratsi): approved 1, disapproved 11, draft 17, due_shipment 1, filming_in_progress 4,
  pending_for_approval 5, video_delivered 33
- creators.internal_assets_status (niagara-sleep-solutions): approved 2, pending_for_cs_approval 2, revisions_needed 1
- creators.internal_assets_status (gratsi): pending_for_cs_approval 72
- personas.stage_of_awareness (niagara-sleep-solutions): problem_aware 1, product_aware 1, solution_aware 1
- personas.stage_of_awareness (gratsi): problem_aware 3, product_aware 2, solution_aware 9
- angles.type (niagara-sleep-solutions): Critical 1, Emotional 4, Functional 2, Identity 1
- angles.formats (niagara-sleep-solutions): Carousel 2, Motion Graphic 1, Static 3, Video 5
- concepts.formats (niagara-sleep-solutions): Carousel 1, Motion Graphic 1, Static 2, Video 4
- concepts.formats (gratsi): Critical 26, Emotional 26, Exciting 19, Functional 27, Identity 16
- creative_briefs.dimensions (niagara-sleep-solutions): 1:1 7, 4:5 4, 9:16 7
- creative_briefs.dimensions (gratsi): 1:1 3, 4:5 2, 9:16 3, Facebook Feed Square 352, Facebook Reels 340, Meta 4
- creative_briefs.platform (niagara-sleep-solutions): Meta 6, TikTok 1
- creative_briefs.platform (gratsi): Meta 334
- creative_sheet_items.dimensions (gratsi): Facebook Feed Square 350, Facebook Reels 338, Meta 4
- creators.platform (niagara-sleep-solutions): Backstage 1, Billo 1, Direct Management 1, Fiverr 1, Insense 1
- creators.platform (gratsi): Billo 37, Fiverr 5, Insense 22

### 7.2 SQL queries used

All run in one session with default_transaction_read_only on, so a write would have failed.

```sql
SELECT id, name, slug, is_template, template_brand_id, status, deleted_at FROM brands;
SELECT t.table_name, bool_or(c.column_name = 'brand_id') AS has_brand_id, count(*) AS column_count
  FROM information_schema.tables t JOIN information_schema.columns c USING (table_schema, table_name)
 WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE' GROUP BY 1;
SELECT table_name, column_name, data_type, udt_name FROM information_schema.columns WHERE table_schema = 'public';
SELECT * FROM column_definitions WHERE deleted_at IS NULL ORDER BY brand_id, table_key, display_order;
SELECT * FROM custom_field_schemas WHERE deleted_at IS NULL;
SELECT * FROM custom_interface_pages WHERE deleted_at IS NULL;
SELECT template_brand_id, table_name, trigger, count(*) FROM propagation_runs GROUP BY 1, 2, 3;
SELECT brand_id, table_name, field_name, status, count(*) FROM promotion_requests GROUP BY 1, 2, 3, 4;
-- per branded table:
SELECT brand_id, count(*) AS total, sum(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) AS live
  FROM <table> GROUP BY brand_id;
-- per status-like text column:
SELECT brand_id, <column>::text, count(*) FROM <table> WHERE <column> IS NOT NULL AND deleted_at IS NULL
 GROUP BY 1, 2;
-- per jsonb array column:
SELECT brand_id, v, count(*) FROM <table>, LATERAL jsonb_array_elements_text(<column>) AS v
 WHERE deleted_at IS NULL GROUP BY 1, 2;
```

The canonical seed was read by bundling packages/db/src/column-seed.ts and dumping COLUMN_SEED: 280
template rows and 233 Gratsi rows at commit 1b10108. Code reach is grep -rlw of each column key over
apps/web/src and packages/*/src, test files excluded.
