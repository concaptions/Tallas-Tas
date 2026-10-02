# Template base vs Drizzle schema — field-by-field diff (2026-10-02)

**Source of truth as of 2026-10-02:** the Airtable TEMPLATE base `appnaSGAgOUbJ0f9m`.
Not the Gratsi base `appllDG4OmkK2Hdnn`, which every existing mapping file was written against.

**Method.** Both bases' metadata were pulled live from `GET /v0/meta/bases/{baseId}/tables`
(HTTP 200 for both). The template base's raw JSON is saved outside the repo at
`/private/tmp/claude-501/-Users-macbook-Tallas-Tas/5d4da015-65d6-4343-8867-8bce924b68d2/scratchpad/template-base-2026-10-02.json`.
The Gratsi base was pulled only as cross-reference evidence for the table-name/table-id swaps.
Drizzle tables were read from `packages/db/src/schema/*.ts`; mapping evidence from
`packages/db/src/scripts/import-mappings.ts` (`TABLE_MAPPINGS`) and `packages/db/src/airtable-tables.ts`.

**What is NOT counted as a difference.** The shared helper columns from
`packages/db/src/columns.ts` — `id`, `brand_id`, `created_at`, `updated_at`, `created_by`,
`updated_by`, `deleted_at`, `template_row_id`, `overridden_fields`, `custom_fields` — are platform
plumbing and are never reported as extra fields. `legacy_airtable_id` is importer plumbing and is
likewise never counted. Airtable COMPUTED field types (`formula`, `multipleLookupValues`, `rollup`,
`count`, `createdTime`, `lastModifiedTime`, `createdBy`, `lastModifiedBy`, `autoNumber`, `button`)
are not stored by design and are counted separately, never as "missing".

---

## Summary counts

| Metric | Value |
| --- | --- |
| Tables in the template base | 15 |
| Tables matched to a Drizzle table | 15 (all of them) |
| Airtable fields in the base, total | 203 |
| — stored (diffable) | 173 |
| — computed (skipped by design) | 30 |
| Tables missing fields | 2 |
| Total missing fields | 2 |
| Tables with extra Drizzle columns | 10 |
| Total extra Drizzle columns | 61 |
| Extra Drizzle content tables (no table in the template base) | 7 |
| Extra Drizzle junction tables | 12 |
| Extra Drizzle platform tables (never Airtable) | 25 |
| Tables carrying at least one type disagreement that matters | 10 |

`tables_missing_fields` = `copywriting`, `angles`.

`tables_with_extra_fields` = `copywriting`, `creative_briefs`, `concepts`, `angles`, `themes`,
`personas`, `creators`, `products`, `campaigns_offers`, `creative_sheet_items`.

---

## Table-name mismatches between the template base and the Gratsi base

This is the single largest hazard in the diff, and the repo already documents part of it
(`packages/db/src/airtable-tables.ts` header, and `docs/audits/airtable-module-gap-2026-10-01.md`
§4). Verified again today against both bases' live metadata:

| Table id | Name in TEMPLATE base | Name in GRATSI base |
| --- | --- | --- |
| `tblZpBYPTcZcmQ1Kf` | Copywriting | Meta Copywriting |
| `tblhU5yVNhVDwykUt` | Creative Sheet (Internal & Interface) | Creative Design (Internal & Interface) |
| `tbl4UFSFcynlS2Pkn` | **Angles** | **Concepts** |
| `tblRlcp1ibmS7U7HG` | **Concepts** | **Angles** |
| `tblzS73a9JrJGiV2J` | **Themes** | **(Internal) Creative Modules** |
| `tblGC0TxnHI7lKaNQ` | DONT USE Creative Sheet | Creative Sheet |
| `tblRXknfgKsROI961` | Personas | *(id absent from Gratsi; Gratsi Personas is `tblyt7X4VjHxtMDVS`)* |
| `tblgfe8A7nmce6lzn` | AI Characters / Personas | *(absent)* |
| `tbl1aFLMJXxhdVKiz` | *(absent)* | Themes |

Consequences, stated plainly:

1. **Matching by NAME is correct for the template base, and it is what the fetcher does**
   (`resolveTableIds` in `airtable-tables.ts`). The template base's "Angles" table really does
   carry angle fields (Type = Emotional/Functional/Identity/Critical, Pain Points, USP) and its
   "Concepts" table really does carry concept fields (Batch, Concept Style, Formats to create).
   The id collision is Airtable reusing ids across bases, not a semantic swap in the template.
2. **The template base's "Themes" table is shaped like our `creative_modules`, not like our
   `themes`.** Its three stored fields are `Module Name`, `Reference Link`, `Concepts`. Our
   `themes` table's other seven columns (`category`, `notes`, `assignee_id`, `status`,
   `attachments`, `ai_attachment_summary`, `is_active`) came from the GRATSI base's generic
   "Themes" table (`tbl1aFLMJXxhdVKiz`), **which does not exist in the template base at all**.
   Note that in the template base the Themes↔Concepts link is genuine (the `Concepts` field points
   at `tblRlcp1ibmS7U7HG`, which the template calls Concepts), so our `concept_themes` junction is
   the right shape there.
3. **`TABLE_MAPPINGS` is keyed on Gratsi names, so 6 of its 21 entries will not resolve against the
   template base**: `Meta Copywriting`, `Creative Design (Internal & Interface)`,
   `(Internal) Creative Modules`, `Creative Sheet`, and the Angles/Concepts pair whose `airtableTableId`
   comments are now inverted. Seven more map to tables the template base does not have at all.
4. **`AI Characters / Personas` has no `TABLE_MAPPINGS` entry and no `GRATSI_TABLES` entry**, yet
   `packages/db/src/schema/ai-characters.ts` exists and matches it field for field. The importer
   cannot currently read it.
5. **The `Personas` table is a different table in the two bases.** Same name, different id,
   completely different field sets. See the Personas deep dive.

---

## Per-table diff

Notation: ✓ = covered; **MISSING** = an Airtable stored field with no Drizzle column and no
junction; *extra* = a Drizzle column with no Airtable field in the template base.

### 1. Copywriting (`tblZpBYPTcZcmQ1Kf`) → `copywriting`

9 stored, 2 computed. Mapping evidence: `TABLE_MAPPINGS.copywriting` (keyed on the Gratsi name
`Meta Copywriting`).

| Airtable field | Type | Drizzle |
| --- | --- | --- |
| Creative | link → Creative Sheet | `creative_brief_id` ✓ |
| Status | singleSelect (5) | `status` ✓ |
| Collection | link → (Internal) Collections | **MISSING** |
| Product | link → (Internal) Product | `product_id` ✓ |
| Primary Copy | richText | `primary_copy` ✓ |
| Headline | multilineText | `headline` ✓ |
| News Feed / Link Description | multilineText | `link_description` ✓ |
| CTA | singleSelect (6) | `cta` ✓ |
| USED | checkbox | `used` ✓ |

Computed, skipped: `Copy #` (formula), `Autonumber` (autoNumber). Our `copy_number` integer stores
the number we generate ourselves; it is not a missing field.

- **MISSING (1): `Collection`.** No `collection_id` on `copywriting` and no
  `copywriting_collections` junction (verified: no match for either name in `packages/db/src`).
- *Extra (7):* `concept_id`, `funnel`, `winning`, `meta_rating`, `click_for_ai_spell_checker`,
  `spelling_feedback`, `client_comment`. All seven exist as fields in the Gratsi base's
  Meta Copywriting table; none exists in the template.
- Option-set note: Airtable CTA offers 6 options (Shop Now, Learn More, Get Offer, Get Directions,
  Visit Us, Download); `copyCtas` in `packages/db/src/schema/enums.ts` offers 10. Ours is a strict
  superset — no import loss, but the pgEnum `copy_cta` carries four values the template never offers.
- Status options match `COPY_STATUS` in `packages/domain/src/state/copy-status.ts` one for one
  (pending_for_client_review, edited_by_client, approved, revisions_needed, disapproved).

### 2. Creative Sheet (Internal & Interface) (`tblhU5yVNhVDwykUt`) → `creative_briefs`

32 stored, 3 computed. Named `Creative Design (Internal & Interface)` in Gratsi.

All 32 stored fields are covered. **0 missing.**

Covered via a junction or a reverse link rather than a column: `Assets` → `brief_asset_folders`;
`Meta Copywriting` → the reverse of `copywriting.creative_brief_id`.

Type disagreements that matter:

- **`Dimensions` is a record link to "(Internal) Creative Dimensions"; our `dimensions` is a
  `jsonb` array of aspect-ratio STRINGS** ("4:5", "1:1", "9:16" — see the comment at
  `packages/db/src/schema/briefs.ts:64-67`). There is no FK and no junction from a brief to a
  `creative_dimensions` row, so the Airtable link's target record is not reachable from a brief.
  This is the most consequential type mismatch in the base.
- `Internal Status` option set differs both ways: Airtable carries
  **`Video Editing On Hold...`**, which `INTERNAL_VIDEO_STATUS`
  (`packages/domain/src/state/creative-status.ts`) does not; our two internal lists carry
  `launched`, which the Airtable internal select does not (Airtable keeps Launched on the client
  track only).
- `Priority` labels carry turnaround times in Airtable (`Static High (12 hours)`,
  `Static Average (24 hours)`, `Video High (24 hours)`, `Video Average (48 hours)`); `creativePriorities`
  stores the bare names. Same four states, different strings — an importer must normalise.
- `Performance` labels likewise carry parentheticals in Airtable
  (`Winning (ROAS/CPA Goal)`, `High Potential to Iterate (Good CTRs, Thumbstops, etc)`,
  `Losing (Bad All metrics)`) against `creativePerformances` = Winning / High Potential to Iterate /
  Losing. `airtable-import.ts:444` already has a `performance` normalisation map.
- `Funnel` casing: Airtable `TOF / RETARGETTING / ALL FUNNELS` (note the double-T typo) vs
  `creativeFunnels` = `TOF / Retargeting / All Funnels`.
- `Platform` casing: Airtable `Tiktok` vs `creativePlatforms` `TikTok`.
- `Client Status` matches `CLIENT_STATUS` exactly (Pending for Approval, Revisions Needed,
  Approved, Launched) — the DS-Q6 gap recorded in memory is closed in the current code.

*Extra (12):* `batch`, `version`, `sequence`, `due_date`, `script_content`, `inspo_links`,
`spelling_feedback_2`, `language`, `offer`, `launched_at`, `launch_priority`, `asset_id`.
Of these, `batch`, `script_content`, `spelling_feedback_2`, `language`, `offer` are Gratsi fields;
`version`, `sequence`, `due_date`, `inspo_links`, `launched_at`, `launch_priority`, `asset_id` are
platform additions (PRD §7 naming, the media-buyer queue, R2 uploads) with no Airtable origin.
In the template base `Batch` arrives as a lookup from Concepts, not as a stored field on the sheet.

### 3. Concepts (`tblRlcp1ibmS7U7HG`) → `concepts`

13 stored, 9 computed — the most computed-heavy real table in the base.

All 13 stored fields are covered. **0 missing.** `Themes`, `Angles`, `Creator` and
`Creative Sheet (Internal & Interface)` land on `concept_themes`, `concept_angles`,
`creator_concepts` and the reverse of `creative_briefs.concept_id`.

Computed, skipped (9): `Name` (formula — our `name` column stores the generated value, PRD §7),
`Type (from Angles)`, `Description`, `Performance`, `Creators`, `Pain Points (from Angles)`,
`USP (from Angles)`, `Product (from Angles)`, `Personas (from Angles)`.

- Our `description`, `pain_points` and `usp` columns on `concepts` mirror Airtable fields that are
  **lookups from Angles** in the template base. They are not extra (the Airtable fields exist) and
  not missing (they are computed), but they are denormalised copies: a 0044 migration should decide
  whether `concepts` keeps its own copy or reads through `concept_angles`.
- Type disagreement: `Ad Inspo` is `multilineText` in Airtable; our `ad_inspo_links` is a `jsonb`
  array. Import has to split prose into links.
- Option-set note: `Approval Status` offers 3 (Pending For Approval, Approved, Needs Revisions);
  `conceptApprovalStatuses` carries 5 (`draft`, `pending_client`, `approved`, `rejected`,
  `revision_needed`). `Production Status`'s 6 options match `conceptProductionStatuses` one for one.
- *Extra (4):* `formats` (a second jsonb set beside `formats_to_create`, which is the one that maps),
  `client_comments`, `internal_status`, `client_status`.
- **Stale mapping found:** `TABLE_MAPPINGS.concepts` documents `'Performance' -> 'performance'`, but
  `packages/db/src/schema/concepts.ts` has no `performance` column (grep for `performance` in that
  file returns nothing). The only `performance` the importer writes is
  `creativeBriefs.performance` (`airtable-import.ts:995`). The mapping file is documentation and the
  engine is authoritative, so this is a doc bug, not a runtime one — but it will mislead the next reader.

### 4. Angles (`tbl4UFSFcynlS2Pkn`) → `angles`

10 stored, 1 computed. **Called "Concepts" in the Gratsi base** — `TABLE_MAPPINGS.angles` points at
`airtableTableId: tblRlcp1ibmS7U7HG`, which is the template's Concepts table.

| Airtable field | Type | Drizzle |
| --- | --- | --- |
| Name | singleLineText | `name` ✓ |
| Type | multipleSelects (Emotional, Functional, Identity, Critical) | `type` jsonb ✓ |
| Product | link | `angle_products` ✓ |
| Collection | link → (Internal) Collections | **MISSING** |
| Personas | link | `angle_personas` ✓ |
| Description | multilineText | `description` ✓ |
| Pain Points | multilineText | `pain_points` ✓ |
| USP | multilineText | `usp` ✓ |
| Concepts | link | `concept_angles` ✓ |
| (Internal) Creative Design | link | reverse of `creative_briefs.angle_id` ✓ |

Computed, skipped: `Performance (from Concepts)`.

- **MISSING (1): `Collection`.** No `collection_id` on `angles` and no `angle_collections`
  junction (verified by grep). `angleTypes` in `enums.ts` matches the four `Type` options exactly.
- *Extra (9):* `formats`, `ad_inspo_links`, `potential`, `winning`, `status`, `internal_notes`,
  `client_notes`, `brief_url`, `exact_script_url`. All nine are fields of the Gratsi table; the
  template base's Angles table has none of them.

### 5. Themes (`tblzS73a9JrJGiV2J`) → `themes`

3 stored, 0 computed. **Called "(Internal) Creative Modules" in the Gratsi base.** Read the
table-name section above before acting on this row.

| Airtable field | Type | Drizzle |
| --- | --- | --- |
| Module Name | singleLineText | `name` ✓ (label mismatch only) |
| Reference Link | singleLineText (single value) | `reference_links` jsonb array — type disagreement |
| Concepts | link → Concepts | `concept_themes` ✓ |

- **0 missing.**
- *Extra (7):* `category`, `notes`, `assignee_id`, `status`, `attachments`,
  `ai_attachment_summary`, `is_active`.
- **`themes.category` is `NOT NULL`** (`themeCategoryEnum`, values Framework / Production Style /
  Seasonal) and the template base has **no field to source it from**. An import of the template
  Themes table cannot insert a row without a default. This is an import blocker, not a cosmetic diff.
- `themes` is the one global table (`brand_id` is null, enforced by the `themes_global` check
  constraint) — correct per CLAUDE.md non-negotiable 3, and unaffected by this diff.
- Our `creative_modules` table carries `module_name` + `foreplay_link`, which is the Gratsi name for
  the same Airtable fields (`Module Name` + `Foreplay Link`; the template calls the second one
  `Reference Link`). The template base has no `(Internal) Creative Modules` table, so by name
  `creative_modules` is an extra table and by shape it duplicates `themes`.

### 6. Personas (`tblRXknfgKsROI961`) → `personas`

See the deep dive below. 15 stored, 0 computed, **0 missing**, 1 extra column.

### 7. UGC Management (`tblRsVqiqUaZRcQYd`) → `creators`

32 stored, 0 computed. Same name in both bases.

All 32 stored fields are covered. **0 missing.** `Concepts to film` → `creator_concepts`,
`Products` → `creator_products`.

Type disagreements that matter:

- **`Platform` is a singleSelect in Airtable (Fiverr, Billo, Backstage, Direct Management, Insense);
  our `platform` is a `jsonb` array.** We allow a set where Airtable allows one.
- **`Creator's Video Intro` and `Creator's Profile Pic` are `multipleAttachments`; our
  `video_intro_url` and `profile_pic_url` are single `text` columns.** Any creator with more than
  one attachment loses all but one on import.
- **`Creator's cost (USD)` is currency with precision 2; `creator_cost` is `integer`.** Cents are
  lost. `Budget per 60sec video` is precision 0, so `budget_per_60s` as integer is faithful.
  `Partnership Price per 30 days` is also precision 2 against an integer column.
- `(Internal) Deadline for the request`, `Date of Management`, `Date of Partnership Activation` are
  Airtable `date` (no time); `deadline`, `date_of_management`, `partnership_activated_at` are
  `timestamptz`. Benign but it invents a time-of-day.
- `For Partnership Ads?` and `Continue Working With?` are Yes/No singleSelects against booleans —
  benign, but a null-vs-No distinction is lost.
- `Extension Time Period` is a singleSelect (30 Days / 60 Days / 90 Days) against
  `extension_days` integer — benign.
- `Partnership Activity` offers 4 options (**Yes**, Not Active, Active, Ended);
  `PARTNERSHIP_ACTIVITY` in `packages/domain/src/state/creator-status.ts` carries 3
  (active, not_active, ended). `Yes` is a stale Airtable option with no key.
- The three status selects match the domain lists: `Internal Creator's Status` (4) ↔
  `CREATOR_INTERNAL_STATUS`, `Status` (9) ↔ `CREATOR_STATUS`, `Internal Assets Status` (3) ↔
  `CREATOR_ASSETS_STATUS`. `creatorAgeBrackets` matches `Age`'s 6 options exactly.
- Importer note: `TABLE_MAPPINGS.creators` maps the Gratsi field names `Additional Note - TAS Team`,
  `Creator Status`, `Paid by TAS`, `Concept to film`. The template base calls the equivalents
  `Internal Brief`, `Status`, *(no equivalent)* and `Concepts to film`. The template's `Status`
  currently maps to `internalCreatorStatus`, which is the **wrong track** — in the template base
  `Status` is the client-facing one and `Internal Creator's Status` is the internal one.

*Extra (9):* `cost_usd` (Gratsi `Paid by TAS`), `concept_ids` and `product_ids` (jsonb mirrors of
the two links that already have junctions), `slack_notified`, `current_period_start`,
`partnership_ended_at`, `requires_attention`, `payment_date`, `creator_info_request`.

### 8. AI Characters / Personas (`tblgfe8A7nmce6lzn`) → `ai_characters`

12 stored, 0 computed. **Table exists only in the template base. No `TABLE_MAPPINGS` entry, no
`GRATSI_TABLES` entry — the importer has no way to read it today.**

All 12 fields map one for one to `packages/db/src/schema/ai-characters.ts`: Name → `name`,
Status → `status`, Basic Info → `basic_info`, Tone of Voice → `tone_of_voice`,
Voice Link (Eleven Labs) → `voice_link`, Personality Traits → `personality_traits`,
Appearance → `appearance`, Traits & Habits → `traits_and_habits`,
Hobbies & Lifestyle → `hobbies_and_lifestyle`, Work & Background → `work_and_background`,
Why He Promotes this brand? → `why_promotes_brand`, Attachments → `attachments`.

- **0 missing, 0 extra.** The best-aligned table in the base.
- Type disagreement that matters: **`Attachments` is `multipleAttachments`; `ai_characters.attachments`
  is a plain `text` column**, where every other attachment field in the schema
  (`qa_checklist_doc`, `design_file`, `inspiration_image`, `script_and_brief_breakdown`,
  `themes.attachments`) is `jsonb`. A multi-attachment value cannot be stored faithfully.
- `Status` options (Draft, Pending for Approval, Approved) have no entry in
  `packages/domain/src/state` that I could find; `status` is plain `text`.

### 9. (Internal) Collections (`tbl6LBNrRqa6Hh4I2`) → `collections`

8 stored, 0 computed. Same name in both bases. **0 missing, 0 extra** — every field has a column.

| Airtable field | Type | Drizzle |
| --- | --- | --- |
| Collection Name | singleLineText | `name` ✓ |
| URL | url | `url` ✓ |
| Campaigns & Offers | link (many) | `campaign_id` uuid — many→one |
| Angles | link (many) | `angle_id` uuid — many→one |
| (Internal) Product | link (many) | `product_id` uuid — many→one |
| (Internal) Creative Design | **singleLineText** | `creative_design_note` ✓ |
| Ads Copywriting copy | link (many) | `copywriting_id` uuid — many→one |
| (Internal) Creative Design 2 | link (many) | `creative_design_2_id` uuid — many→one |

- Type disagreement that matters: **five Airtable multi-links are collapsed to a single uuid FK
  each.** A collection linked to two angles, two products or two campaigns loses every link but
  one on import. This is the second most consequential mismatch after `creative_briefs.dimensions`.
- `(Internal) Creative Design` being a plain text field in Airtable (not a link) is an Airtable
  quirk our `creative_design_note` column already reflects correctly.
- Our `concept_collections` junction has no counterpart: the template base's Collections table has
  no Concepts link.

### 10. (Internal) Product (`tblfvfJMYNBz2OYYw`) → `products`

8 stored, 0 computed. Same name in both bases. **0 missing.**

Name → `name`, Link → `link`. The six remaining fields are all record links covered from the other
side: `(Internal) Collections` ← `collections.product_id`; `Campaigns & Offers` ←
`campaigns_offers.product_id`; `Angles` ← `angle_products`; `(Internal) Creative Design` ←
`creative_briefs.product_id`; `Meta Copywriting` ← `copywriting.product_id`; `UGC Management` ←
`creator_products`.

*Extra (1):* `collection_link` (text). PRD §5.1 calls it "the collection link is optional"; the
template base has no such field on the Product table.

### 11. Campaigns & Offers (`tblRNaWCVa1cCIwLL`) → `campaigns_offers`

13 stored, 1 computed (`Name`, formula → our `name` column stores it). Same name in both bases.
**0 missing.**

Holiday → `holiday`, Official Date → `official_date` (both `date`, faithful), Country → `country`,
Description → `description`, **Confirmed by Client → `confirmed_by_client`**, Launched →
`launched`, Ads Launch Date → `ads_launch_date`, Ads End Date → `ads_end_date`,
Discount Offer → `discount_offer`, Code → `code`. `Collections` ← `collections.campaign_id`;
`(Internal) Product` → `product_id`; `Design attached` ← `creative_briefs.campaign_offer_id`.

- Importer note: `TABLE_MAPPINGS.campaignsOffers` keys this field on the Gratsi name **`Interested`**.
  The template base calls it **`Confirmed by Client`**. The mapping will not resolve.
- *Extra (1):* `promotional_ideas` (a Gratsi field; absent from the template).

### 12. (Internal) Creative Dimensions (`tblli0Y76yJvG56zK`) → `creative_dimensions`

4 stored, 0 computed. Same name in both bases. **0 missing, 0 extra.**

Name → `name`, Dimensions → `dimensions`, Link Description → `link_description`,
`(Internal) Creative Design` → `creative_design_id`.

- `Link Description` is a `singleSelect` whose four options are junk left over from an Airtable
  template (`Todo`, `In progress`, `Done`, and a literal twitter.com ad-specs URL). Our column is
  plain `text`, which is the right call; nothing to migrate.
- `(Internal) Creative Design` is a multi-link against our single `creative_design_id` uuid —
  many→one, same loss pattern as `collections`.

### 13. Competitive research (`tbl9W6v78tKWznN9S`) → `competitive_research`

7 stored, 0 computed. Same name in both bases. **0 missing, 0 extra, no type disagreements.**
Name, Type (Competitor/Inspiration), Website, Insta → `instagram`, FB Page → `facebook_page`,
Meta Ads Library, Analysis. Fully aligned.

### 14. Client Assets Organisation (`tbldFmPU6AWg62Fll`) → `client_asset_folders`

4 stored, 0 computed. Same name in both bases. **0 missing, 0 extra.**
`Name [Folder]` → `name`, Description → `description`, Location (url) → `location_url`,
`(Internal) Creative Design` → `brief_asset_folders` junction.

### 15. DONT USE Creative Sheet (`tblGC0TxnHI7lKaNQ`) → `creative_sheet_items`

3 stored, 14 computed. **Called "Creative Sheet" in the Gratsi base, where it is live; the template
base has renamed it `DONT USE`.** Treat anything built on it as deprecated.

| Airtable field | Type | Drizzle |
| --- | --- | --- |
| Creative Name | **singleLineText** | `brief_id` uuid FK — type disagreement |
| Status | singleSelect (6) | `status` ✓ |
| Client's Comments | multilineText | `client_comments` ✓ |

- **0 missing.** 14 of 17 fields are lookups/formulas/lastModifiedTime and are skipped by design.
- Type disagreement that matters: in the template base `Creative Name` is **plain text**, while in
  Gratsi it is a record link — which is why we store a `uuid` FK. Importing the template version
  would have no record id to resolve.
- *Extra (10):* `internal_status`, `qa_checklist_doc`, `qa_video_editor`, `qa_designer`,
  `qa_strategist`, `used`, `denied_revisions_needed`, `winning`, `spell_check_requested`,
  `spelling_feedback`. All ten come from the Gratsi table.
- `Status` options (Pending For Approval, Approved, Revisions Needed, Denied, Revision Submitted,
  Launched) are a sixth vocabulary, distinct from `CLIENT_STATUS`.

---

## Airtable tables with no Drizzle table

**None.** All 15 template-base tables have a Drizzle home, although two of them
(`AI Characters / Personas`, and `Themes` under its template name) have no importer mapping.

## Drizzle tables with no table in the template base

**7 content tables.** Each mirrors a table that exists in the GRATSI base only:

| Drizzle table | Gratsi table it was built from |
| --- | --- |
| `creative_modules` | (Internal) Creative Modules |
| `copy_types` | (Internal) Copy Type |
| `youtube_copy` | Youtube Copywriting |
| `email_campaigns` | Email Campaigns Management |
| `email_flows` | Email Flows Management |
| `creative_reporting` | Creative Reporting |
| `sm_campaign_feed_tasks` | SM Campaign Management Feed |

**12 junction tables** that exist only to serve those seven or a link the template base does not
have: `creative_module_angles`, `creative_module_designs`, `copywriting_copy_types`,
`email_campaign_campaigns`, `email_campaign_products`, `email_campaign_collections`,
`email_flow_campaigns`, `youtube_copy_collections`, `youtube_copy_products`,
`youtube_copy_campaigns`, `youtube_copy_copy_types`, plus `copywriting_campaigns`,
`campaign_concepts` and `concept_collections` whose Airtable link fields exist in Gratsi but not in
the template base. *(That enumeration is 14 names; `copywriting_campaigns`, `campaign_concepts` and
`concept_collections` are listed here because their LINK is template-absent, not because their
parent table is.)*

**25 platform tables** that were never Airtable and must never be diffed against it:
`agencies`, `brands`, `users`, `memberships`, `brand_assignments`, `activity_log`, `ad_metrics`,
`annotations`, `assets`, `comments`, `competitor_ads`, `creator_rankings`, `custom_field_schemas`,
`health_check`, `interface_pages`, `interface_fields`, `notification_log`, `notification_settings`,
`onboarding_forms`, `promotion_requests`, `propagation_runs`, `upload_links`, `user_table_views`,
`user_view_preferences`, `collaboration_instances`.

68 `pgTable` declarations in total: 15 matched + 7 extra content + 21 junctions + 25 platform.

---

## PERSONAS deep dive

Talal called this one out, so it gets the full treatment. Two separate findings: the schema is
**exactly right**, and the importer mapping is **entirely wrong for this base**.

### The template base's Personas table, field by field

`tblRXknfgKsROI961`, 15 fields, **zero computed**.

| # | Airtable field | Airtable type | Our `personas` column | Status |
| --- | --- | --- | --- | --- |
| 1 | Persona Name | multilineText | `name` (`text`, NOT NULL) | ✓ |
| 2 | A Day in the Life | multilineText | `day_in_the_life` | ✓ |
| 3 | Demographic | multilineText | `demographic` | ✓ |
| 4 | Psychographic | multilineText | `psychographic` | ✓ |
| 5 | Core Desires (Cashvertising) | multilineText | `core_desires` | ✓ |
| 6 | Emotional Triggers (Cashvertising) | multilineText | `emotional_triggers` | ✓ |
| 7 | Pain Points (Cashvertising) | multilineText | `pain_points` | ✓ |
| 8 | Success Factors (Buyer Personas) | multilineText | `success_factors` | ✓ |
| 9 | Perceived Barriers (Buyer Personas) | multilineText | `perceived_barriers` | ✓ |
| 10 | Stage of Market Awareness (Breakthrough Advertising) | singleSelect (3 options) | `stage_of_awareness` (`awareness_stage` pgEnum, 7 values) | ✓ |
| 11 | Buying Triggers (Breakthrough Advertising) | multilineText | `buying_triggers` | ✓ |
| 12 | Problem/Challenge (StoryBrand) | multilineText | `problem_challenge` | ✓ |
| 13 | Success/Transformation (StoryBrand) | multilineText | `success_transformation` | ✓ |
| 14 | Trigger Words (Mindstates) | multilineText | `trigger_words` | ✓ |
| 15 | Angles | multipleRecordLinks → Angles | `angle_personas` junction | ✓ |

**Missing fields: 0.** Every one of the 15 is stored.

**Extra columns: 1.** `product_id` (uuid FK → `products`). The template base's Personas table has no
Product link; the only link it carries is Angles. The column is harmless (nullable) but it is ours,
not Airtable's.

**The one type note:** `Stage of Market Awareness` offers only 3 options in the template base —
`Problem-aware`, `Problem-aware → solution-aware`, `Unaware → Problem-aware`. The `awareness_stage`
pgEnum carries 7 (`unaware`, `unaware_to_problem_aware`, `problem_aware`,
`problem_aware_to_solution_aware`, `solution_aware`, `product_aware`, `most_aware`). All three
Airtable options have an exact enum key, so nothing is lost on import; our enum is a superset, and
the comment in `enums.ts:36-46` already explains why the two transition states are in it. No
migration needed.

### Do our displayed Personas columns match the template base?

**Yes.** Read from `apps/web/src/app/app/personas/personas-workspace.tsx` (`PERSONA_COLUMNS`, lines
100-148) and `apps/web/src/app/app/personas/fields.ts` (`PERSONA_FIELD_GROUPS`).

The grid renders 17 columns: `Name`, `Stage of Awareness`, `Product`, `Linked angles`, then every
`PERSONA_FIELDS` prose field except name and stageOfAwareness — `A Day in the Life`, `Demographic`,
`Psychographic`, `Core Desires`, `Success Factors`, `Success/Transformation`, `Pain Points`,
`Perceived Barriers`, `Problem/Challenge`, `Buying Triggers`, `Emotional Triggers`,
`Trigger Words` — then `Updated`.

- **All 14 stored non-link fields of the template base are displayed**, and the `Angles` link is
  displayed as `Linked angles`. Nothing from the template base is hidden.
- Two displayed columns have no template counterpart: **`Product`** (our extra `product_id`) and
  **`Updated`** (the `updated_at` helper column).
- Labels drop Airtable's parenthetical source attributions: we show `Core Desires`, Airtable shows
  `Core Desires (Cashvertising)`; we show `Stage of Market Awareness`, Airtable shows
  `Stage of Market Awareness (Breakthrough Advertising)`. Same field, shorter label. The grid's
  first header is `Name` while the panel's label is `Persona Name` (Airtable's own wording).

### The importer mapping is written against the wrong Personas table

`TABLE_MAPPINGS.personas` in `packages/db/src/scripts/import-mappings.ts` declares
`airtableTableId: 'tblyt7X4VjHxtMDVS'` — the **Gratsi** Personas table, a different table with a
different id and only 7 fields: `Name`, `Description  [Age Status Salary]`, `Personality`,
`Drivers for this persona`, `Passion`, `Angles`, `Problem-Solution Awareness Level`. Its five
non-link mappings are all approximations ("Closest match to coreDesires", "Airtable Description maps
to demographic").

Run against the TEMPLATE base, that mapping resolves **one** field out of fifteen (`Angles`, which
is a skip). None of `Persona Name`, `A Day in the Life`, `Demographic`, `Psychographic`,
`Core Desires (Cashvertising)` … exists under those names. The Gratsi-era approximations
(`Personality` → `psychographic`, `Passion` → `coreDesires`) also become unnecessary, because the
template base has real `Psychographic` and `Core Desires` fields.

**Verdict:** the `personas` TABLE is already a faithful mirror of the template base and needs no
migration beyond a decision about `product_id`. The `personas` MAPPING needs a full rewrite against
`tblRXknfgKsROI961`, and the awareness-stage value map needs the template's three option labels
(`Problem-aware`, `Problem-aware → solution-aware`, `Unaware → Problem-aware`) rather than Gratsi's.

---

## What a 0044 migration would have to do

### Additive work — safe, no data loss

Postgres DDL:

1. **`copywriting` ↔ collections.** Add a `copywriting_collections` junction (the Airtable field is
   a multi-link, so a junction is the faithful shape, not a single FK). Closes missing field 1 of 2.
2. **`angles` ↔ collections.** Add an `angle_collections` junction. Closes missing field 2 of 2.
3. **`themes.category` must stop being `NOT NULL`**, or get a server-side default. The template base
   has no field to source it from and an import cannot insert a row today. Either
   `ALTER COLUMN category DROP NOT NULL` or `SET DEFAULT 'Framework'`. This is the only hard import
   blocker in the base.
4. **`ai_characters.attachments` `text` → `jsonb`** (`string[]`, default `[]`) so the template's
   `multipleAttachments` survives. Needs a cast of existing values.
5. **`creators.profile_pic_url` / `video_intro_url` `text` → `jsonb`** if more than one attachment
   per creator must survive; otherwise document the truncation.
6. **`creators.creator_cost` and `creators.partnership_price_per_30_days` `integer` →
   `numeric(12,2)`** to keep Airtable's 2-decimal currency. `budget_per_60s` can stay integer
   (Airtable precision 0).
7. **`creators.platform` `jsonb` → `text`**, or leave it and document that we deliberately allow a
   set where Airtable allows one. Narrowing it is destructive; leaving it is additive. Prefer leaving.
8. **A brief ↔ creative_dimensions link.** Add `brief_creative_dimensions` (or a
   `creative_dimension_id` FK) so the Airtable `Dimensions` record link is representable, keeping
   the existing `creative_briefs.dimensions` jsonb for the PRD §8 ratio strings. These are two
   different things sharing one name today.
9. **Collections' five many→one FKs.** If a collection must keep more than one angle / product /
   campaign / copy / design, each needs a junction: `collection_angles`, `collection_products`,
   `collection_campaigns`, `collection_copywriting`, `collection_designs`. Adding junctions is
   additive; the existing single FKs can stay until the data is backfilled.
10. **`creative_dimensions.creative_design_id`** is likewise a many→one collapse of a multi-link;
    same treatment if multiplicity matters.

Not a migration (plain `text` columns, so a vocabulary change only, in `packages/domain/src/state`
and `packages/db/src/schema/enums.ts`):

- Add `video_editing_on_hold` to `INTERNAL_VIDEO_STATUS` — the template base has it and we do not.
- Normalise `Priority`, `Performance`, `Funnel` and `Platform` label strings (hour suffixes,
  parentheticals, `RETARGETTING`, `Tiktok`) in `airtable-import.ts`, which already has a
  `performance` map at line 444.
- Drop or ignore the stale `Yes` option on `Partnership Activity`.

Importer work (no DDL at all, but it gates every import from the new source of truth):

- Rewrite `TABLE_MAPPINGS` against the template base's NAMES. Six entries have a different name
  there (see the mismatch table) and seven map to tables the template base does not have.
- Add a `TABLE_MAPPINGS` entry and a `GRATSI_TABLES`-equivalent entry for
  `AI Characters / Personas` — the Drizzle table exists and is perfectly aligned but unreachable.
- Rewrite `TABLE_MAPPINGS.personas` against `tblRXknfgKsROI961` (see the deep dive).
- Fix `creators`: in the template base `Status` is the CLIENT track and
  `Internal Creator's Status` is the internal one; the current mapping sends `Status` to
  `internalCreatorStatus`.
- Fix `campaignsOffers`: the field is `Confirmed by Client`, not Gratsi's `Interested`.
- Remove the documented-but-nonexistent `concepts.performance` mapping.
- Decide whether template `Themes` imports into `themes` (by name) or `creative_modules` (by shape).
  The two tables cannot both be fed from one Airtable table.

### Destructive work — dropping our 61 extra columns

**I cannot query production from this task, so for every item below: row count unknown, must be
checked before dropping.** The repo's own notes record that a Gratsi import ran into production on
2026-10-01, which makes several of these tables very likely non-empty — but that is a reported
fact, not something verified here.

| Drizzle table | Extra columns a strict template match would drop | Production rows |
| --- | --- | --- |
| `creative_briefs` | 12 — `batch`, `version`, `sequence`, `due_date`, `script_content`, `inspo_links`, `spelling_feedback_2`, `language`, `offer`, `launched_at`, `launch_priority`, `asset_id` | row count unknown, must be checked before dropping |
| `creative_sheet_items` | 10 — `internal_status`, `qa_checklist_doc`, `qa_video_editor`, `qa_designer`, `qa_strategist`, `used`, `denied_revisions_needed`, `winning`, `spell_check_requested`, `spelling_feedback` | row count unknown, must be checked before dropping |
| `angles` | 9 — `formats`, `ad_inspo_links`, `potential`, `winning`, `status`, `internal_notes`, `client_notes`, `brief_url`, `exact_script_url` | row count unknown, must be checked before dropping |
| `creators` | 9 — `cost_usd`, `concept_ids`, `product_ids`, `slack_notified`, `current_period_start`, `partnership_ended_at`, `requires_attention`, `payment_date`, `creator_info_request` | row count unknown, must be checked before dropping |
| `copywriting` | 7 — `concept_id`, `funnel`, `winning`, `meta_rating`, `click_for_ai_spell_checker`, `spelling_feedback`, `client_comment` | row count unknown, must be checked before dropping |
| `themes` | 7 — `category`, `notes`, `assignee_id`, `status`, `attachments`, `ai_attachment_summary`, `is_active` | row count unknown, must be checked before dropping |
| `concepts` | 4 — `formats`, `client_comments`, `internal_status`, `client_status` | row count unknown, must be checked before dropping |
| `campaigns_offers` | 1 — `promotional_ideas` | row count unknown, must be checked before dropping |
| `products` | 1 — `collection_link` | row count unknown, must be checked before dropping |
| `personas` | 1 — `product_id` | row count unknown, must be checked before dropping |

Plus, if "no table in the template base" were read as "drop the table": `creative_modules`,
`copy_types`, `youtube_copy`, `email_campaigns`, `email_flows`, `creative_reporting`,
`sm_campaign_feed_tasks` and their 11 junctions — **row count unknown, must be checked before
dropping**, and `youtube_copy`, `email_campaigns`, `email_flows`, `creative_reporting`,
`sm_campaign_feed_tasks` and `creative_modules` were added specifically because the 2026-10-01 audit
found live Gratsi rows in them.

### The recommendation this audit actually makes

**Do the additive work; do none of the destructive work in 0044.**

The template base is the parent template. Gratsi is a child brand. Our 61 "extra" columns are, with
a handful of platform exceptions, exactly the fields a child brand added on top of the parent —
which is the architecture CLAUDE.md non-negotiable 1 and 2 describe, not a schema defect. Dropping
them would delete migrated Gratsi data and would also break non-negotiable 1, because a column that
exists for one brand and not another is precisely what `brand_field_overrides` and
`overridden_fields` exist to express. The honest shape of this work is:

1. One additive migration (items 1-10 above), with `themes.category` first because it blocks import.
2. A full rewrite of the importer's table and field mappings against the template base's names.
3. A separate, explicitly approved decision — with production row counts in hand — about whether any
   Gratsi-only column or table is genuinely dead.
