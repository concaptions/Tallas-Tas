# Airtable → platform module gap audit (Sprint 3A, 2026-10-01)

Read-only audit of the platform on `main` (commit `ee1c1ae`, PARITY-30) against the **live Gratsi base
`appllDG4OmkK2Hdnn`**, never the template `appnaSGAgOUbJ0f9m`. No app code changed. This supersedes
the Prompt 0 audit that lived at this path (commit `855e318`, pre-parity; `git show
855e318:docs/audits/airtable-module-gap-2026-10-01.md` has the per-field detail that drove PARITY-1
to PARITY-36).

**How the live base was read.** This session has no `AIRTABLE_PAT`, and the Airtable connector's
token only reaches the "Claude Queue" base (403 on `appllDG4OmkK2Hdnn`). The table names, ids and
stored-field inventory below therefore come from the 2026-10-01 metadata snapshot of the live base
that Prompt 0 fetched through the base-schema endpoint, cross-checked against the schema-parity gate's
exclusion register (`docs/decisions.md`, "Airtable field exclusion register"), which was built from
the same base on the same day. Every table is matched by **name**, never by id. Before Sprint 3B runs,
re-fetch and re-check with:

```
AIRTABLE_PAT=… node scripts/airtable-parity.mjs
```

A field added or renamed in Airtable since 2026-10-01 fails that gate and is not in this table.

## Summary

| Count | What |
| --- | --- |
| 21 | Gratsi tables in the live base |
| 0 | missing from the database (every table has a Drizzle `pgTable`, 6 of them added by PARITY-2..5) |
| 0 | missing from the UI (every table has a route under `apps/web/src/app/app/` and a sidebar entry) |
| 0 | wrong sidebar label (none names a different module than its table) |
| 13 | shortened sidebar label (the Airtable `(Internal)` prefix / `Management` / `Organisation` suffix is dropped; listed per row) |
| 0 | modelled from the template base instead of Gratsi (the six swapped ids are mapped to their Gratsi names; `resolveTableIds` is name-keyed and tested) |
| 0 | tables skipped by the importer (`SKIPPED_AIRTABLE_TABLES` was removed in PARITY-27; all 21 are fetched and mapped) |
| 31 | stored Airtable fields deliberately not stored, every one registered with a reason in the exclusion register (all are residual single-line text, duplicate links or a UI banner; 29 of 31 are empty on every live row) |
| no | `themes` is **not** modelled on `(Internal) Creative Modules` (see §3) |

Nothing in the 21-table scope is missing. What is left is at the field and vocabulary level and is
already enumerated by the gate; the only open item for 3B is to re-run the gate with a live PAT.

## 1. Gap table

Columns: Gratsi table name · live id · Drizzle table (`packages/db/src/schema/`) · route under
`apps/web/src/app/app/` · sidebar label (`apps/web/src/components/shell/nav.ts`) · field gap (stored
Airtable fields with no column or junction, per the exclusion register; `none` = every stored field
lands) · notes.

| # | Gratsi table | ID | Drizzle table | Route | Sidebar label | Field gap | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Meta Copywriting | `tblZpBYPTcZcmQ1Kf` | `copywriting` (+ `copywriting_campaigns`, `copywriting_copy_types`) | `meta-copywriting/` (legacy `copywriting/` redirects) | Meta Copywriting | 8 registered: `(Internal) Creative Design` (second link to the brief), `Product`, `Angle`, `(Internal) Product`, `Creative Reporting`, `Creative Sheet`, `(Internal) Creative Design 2` (residual text), `⚠️ Please Change the Status…` (banner). All 0 live rows. | Template name is "Copywriting"; same id, different name. 0 records in the live export, so gaps are structural only. |
| 2 | Creative Design (Internal & Interface) | `tblhU5yVNhVDwykUt` | `creative_briefs` (+ `creative_module_designs`, `creative_sheet_items.brief_id`, `brief_asset_folders`) | `creative-design/` + `[briefId]/` (legacy `briefs/` redirects); same rows drive `queue/internal`, `queue/client` | Creative Design (label shortened) | 3 registered: `(Internal) Collections 2`, `Angles` (dead residual text, 0/390), `Ads Copywriting copy` (inverse of an excluded link). | Template calls this id "Creative Sheet (Internal & Interface)". Hand-typed Airtable `Name` vs generated `creative_briefs.name` (non-negotiable 6) is a data-mapping concern for the importer, not a schema gap. |
| 3 | Creative Sheet | `tblGC0TxnHI7lKaNQ` | `creative_sheet_items` (PARITY-3) | `creative-sheet/` (PARITY-10) | Creative Sheet | none (13 stored fields mapped; `Name` is a formula computed by the query layer). | Template calls this id "DONT USE Creative Sheet". 339/390 briefs link a sheet row in the live base. |
| 4 | (Internal) Creative Modules | `tblzS73a9JrJGiV2J` | `creative_modules` (+ `creative_module_angles`, `creative_module_designs`) (PARITY-3) | `creative-modules/` (PARITY-8) | Creative Modules (shortened) | none (4 stored fields mapped). | Template calls this id "Themes" — the trap. Its `Concepts` field links **Angles**; the junction is `creative_module_angles`. `themes` was not modelled on it (§3). |
| 5 | SM Campaign Management Feed | `tblLRajTW55XEhVhk` | `sm_campaign_feed_tasks` (PARITY-3) | `sm-campaign-feed/` (PARITY-11) | SM Campaign Feed (shortened) | none (5 stored fields mapped; `Reminder Trigger` is a clock formula, computed). | |
| 6 | Campaigns & Offers | `tblRNaWCVa1cCIwLL` | `campaigns_offers` (+ `campaign_concepts`, `copywriting_campaigns`, `youtube_copy_campaigns`, `email_campaign_campaigns`, `email_flow_campaigns`) | `campaigns-offers/` (legacy `campaigns/` redirects) | Campaigns & Offers | 1 registered: `Design attached` (loose text, 0 rows). `Promotional Ideas` now has a column (PARITY-2/33). | Its `Angles` field links **Concepts**; junction is `campaign_concepts`. |
| 7 | (Internal) Product | `tblfvfJMYNBz2OYYw` | `products` (+ `email_campaign_products`, `youtube_copy_products`, `angle_products`, `creator_products`) | `products/` | Products (shortened) | 3 registered: `(Internal) Creative Design 2`, `Creative Sheet`, `Email Campaigns Management copy` (residual text; the last name appears twice in the base). All 0/6. | `Table 17` → `email_campaign_products`. |
| 8 | (Internal) Collections | `tbl6LBNrRqa6Hh4I2` | `collections` (+ `email_campaign_collections`, `youtube_copy_collections`, `concept_collections`) | `collections/` | Collections (shortened) | 3 registered: `Creative Sheet`, `(Internal) Product` (text where the platform has `product_id`), `Email Campaigns Management copy` (appears twice). All 0/5. | |
| 9 | Client Assets Organisation | `tbldFmPU6AWg62Fll` | `client_asset_folders` (+ `brief_asset_folders`) | `client-assets/` (PARITY-9) | Client Assets (shortened) | 1 registered: `(Internal) Creative Design` is single-line text in the base, so no `brief_asset_folders` rows can be derived on import. | Prompt 0 found this table with no page; PARITY-9 closed it. |
| 10 | Email Campaigns Management | `tblABjVpwRpYtY7de` | `email_campaigns` (+ `email_campaign_campaigns`, `_products`, `_collections`) (PARITY-4) | `email-campaigns/` (PARITY-13) | Email Campaigns (shortened) | none (15 stored fields mapped; the two due dates are formulas off `Send Date`, computed). | Due-date offsets (−5 d, −10 d) recorded in `docs/decisions.md` item 1. |
| 11 | Email Flows Management | `tblubVflAQZgJSxcF` | `email_flows` (+ `email_flow_campaigns`) (PARITY-4) | `email-flows/` (PARITY-14) | Email Flows (shortened) | none (11 stored fields mapped; due dates computed off `Expected Setup Date`). | |
| 12 | Youtube Copywriting | `tblVR1UmkbDoDzJ7z` | `youtube_copy` (+ `youtube_copy_collections`, `_products`, `_campaigns`, `_copy_types`) (PARITY-2) | `youtube-copywriting/` (PARITY-15) | YouTube Copywriting (capitalisation differs) | 5 registered: `Creative Reporting`, `Creative Sheet`, `(Internal) Product`, `(Internal) Creative Design` (residual text), `⚠️ Please Change the Status…` (banner). All 0 rows. | Own table, not a channel column on `copywriting` (decision 3). Prompt 0 found it importing into `copywriting` as a fallback; PARITY-2/27 fixed that. |
| 13 | (Internal) Copy Type | `tblQiBPj9ypCmYxev` | `copy_types` (+ `copywriting_copy_types`, `youtube_copy_copy_types`) (PARITY-2) | `copy-types/` (PARITY-7) | Copy Types (shortened; under "Settings / Lookups") | none (its two link fields are inverses written from the copy tables). | Reverses the V0 decision to fold copy types into the four copy fields. |
| 14 | Creative Reporting | `tblgW4bwDSSeqihlr` | `creative_reporting` (PARITY-3) | `creative-reporting/` (PARITY-12) | Creative Reporting | none (`Difference CPA` is a formula; `Creative Name` is an invalid formula in the base; `Creative Name (from Creative)` an orphaned lookup). | Prompt 0 had this as a partial match on `ad_metrics`; it now has its own table. `creative_reporting.brief_id` is nullable with no live Airtable source (decision 5). `ad_metrics` / Performance stays platform-native. |
| 15 | (Internal) Creative Dimensions | `tblli0Y76yJvG56zK` | `creative_dimensions` | `creative-dimensions/` | Creative Dimensions (shortened; under "Settings / Lookups") | none | 22 live records. |
| 16 | Themes | `tbl1aFLMJXxhdVKiz` | `themes` (GLOBAL; check constraint forces `brand_id IS NULL`) | `themes/` | Themes | none | Gratsi-only id (no template counterpart). Live rows have empty `Name`; `Concepts.Theme` is a 28-choice multi-select whose values match no theme row, so `concept_themes` imports empty. |
| 17 | Personas | `tblyt7X4VjHxtMDVS` | `personas` (+ `angle_personas`) | `personas/` | Personas | none | Gratsi-only id; the template's Personas (`tblRXknfgKsROI961`) has a different 15-field shape. |
| 18 | Angles | `tblRlcp1ibmS7U7HG` | `angles` (+ `concept_angles`, `angle_personas`, `angle_products`, `creative_module_angles`) | `angles/` | Angles | 5 registered: `Creators` (link with no mapped inverse), `(Internal) Creative Design` (1/43), `Creative Sheet`, `UGC Management copy`, `Concepts copy` (9/43; same pairs as the structured link). | Template calls this id "Concepts" (swapped with #19). `Status` column added by migration 0039. |
| 19 | Concepts | `tbl4UFSFcynlS2Pkn` | `concepts` (+ `concept_angles`, `concept_themes`, `concept_collections`, `campaign_concepts`, `creator_concepts`) | `concepts/` + `[conceptId]/` | Concepts | 1 registered: `UGC Management copy` (residual text, 0/102). | Template calls this id "Angles" (swapped with #18). `description`, `pain_points`, `usp`, `client_comments` added by migration 0039. |
| 20 | UGC Management | `tblRsVqiqUaZRcQYd` | `creators` (+ `creator_concepts`, `creator_products`) | `ugc/` | UGC Management | 1 registered: `Concepts` (second link beside `Concept to film`, 0/70). | `payment_date`, `creator_info_request` added by migration 0039. |
| 21 | Competitive research | `tbl9W6v78tKWznN9S` | `competitive_research` | `competitive-research/` | Competitive Research (capitalisation differs) | none | 0 records in the live export, so the importer path is unexercised with real data. |

Label legend: "shortened" drops `(Internal)`, `Management` or `Organisation`; every label still names
the same module. If Sprint 3C wants the sidebar to read exactly as Airtable does, that is a
`nav.ts` string change on 13 rows and nothing else.

## 2. Importer check (`packages/db/src/scripts/`, `scripts/`)

- **Skipped tables: none.** `SKIPPED_AIRTABLE_TABLES` was deleted in PARITY-27 (`import-mappings.ts`
  line 1298 records its removal). `TABLE_MAPPINGS` has 21 entries, one per Gratsi table.
- **Tables mapped by template id: none.** Every `airtableTableId` in `TABLE_MAPPINGS` is the Gratsi
  id for the Gratsi name it carries. The six ids the two bases share under different names
  (`tblZpBYPTcZcmQ1Kf`, `tblhU5yVNhVDwykUt`, `tbl4UFSFcynlS2Pkn`, `tblRlcp1ibmS7U7HG`,
  `tblGC0TxnHI7lKaNQ`, `tblzS73a9JrJGiV2J`) are mapped to Meta Copywriting, Creative Design,
  Concepts, Angles, Creative Sheet and Creative Modules respectively, which are the Gratsi names.
- **Fetch resolves by name.** `airtable-fetch.ts` line 63 calls `resolveTableIds(meta, GRATSI_TABLES,
  baseId)` against the base's own metadata; `GRATSI_TABLES` (`packages/db/src/airtable-tables.ts`)
  holds 21 names and no ids. `TEMPLATE_IDS_WITH_DIFFERENT_GRATSI_NAME` plus
  `airtable-tables.test.ts` pin that a template id is never handed back for a Gratsi name, and an
  unknown name throws `UnknownAirtableTableError` instead of falling back to a remembered id.
  The ids in `TABLE_MAPPINGS` are documentation for the field tables; they are not what the fetch
  uses.
- **Gate.** `scripts/airtable-parity.mjs` → `packages/db/src/scripts/airtable-parity.ts` fails on any
  stored field that is neither mapped nor registered. It needs `AIRTABLE_PAT`, which this session
  lacks, so it was **not** run here.
- Platform-native export keys with no Gratsi table (Assets, Ad Metrics, Competitor Ads, Creator
  Rankings, Upload Links, AI Characters, Onboarding Forms) are out of this audit's scope by design.

## 3. Was `themes` modelled on "(Internal) Creative Modules"?

No. `themes` is a global table (`brand_id IS NULL` check constraint) with `name`, `category`,
`reference_links` and notes, mapped to Gratsi table **Themes** `tbl1aFLMJXxhdVKiz` by name. Creative
Modules (`tblzS73a9JrJGiV2J`, the id the template labels "Themes") is per-brand with `name`,
`foreplay_link` and links to Angles and Creative Design; it has its own table `creative_modules` since
PARITY-3. The column-by-column check is recorded as decision 4 under "Module parity with the live
Gratsi base" in `docs/decisions.md`. No fix is needed.

## 4. Template ↔ Gratsi id map (kept for the record)

| Table ID | Template name | Gratsi name |
| --- | --- | --- |
| `tblZpBYPTcZcmQ1Kf` | Copywriting | Meta Copywriting |
| `tblhU5yVNhVDwykUt` | Creative Sheet (Internal & Interface) | Creative Design (Internal & Interface) |
| `tbl4UFSFcynlS2Pkn` | Angles | Concepts (swapped) |
| `tblRlcp1ibmS7U7HG` | Concepts | Angles (swapped) |
| `tblGC0TxnHI7lKaNQ` | DONT USE Creative Sheet | Creative Sheet |
| `tblzS73a9JrJGiV2J` | Themes | (Internal) Creative Modules |
| `tblRsVqiqUaZRcQYd` | UGC Management | UGC Management |
| `tblRNaWCVa1cCIwLL` | Campaigns & Offers | Campaigns & Offers |
| `tblfvfJMYNBz2OYYw` | (Internal) Product | (Internal) Product |
| `tblli0Y76yJvG56zK` | (Internal) Creative Dimensions | (Internal) Creative Dimensions |
| `tbl9W6v78tKWznN9S` | Competitive research | Competitive research |
| `tbl6LBNrRqa6Hh4I2` | (Internal) Collections | (Internal) Collections |
| `tbldFmPU6AWg62Fll` | Client Assets Organisation | Client Assets Organisation |

The eight remaining Gratsi ids (Themes, Personas, SM Campaign Management Feed, Email Campaigns
Management, Email Flows Management, Youtube Copywriting, (Internal) Copy Type, Creative Reporting)
have no template counterpart under the same id.

## 5. What Sprints 3B–3D inherit

- **3B (schema/migration):** no table to add. Run the parity gate with a live PAT; any new row it
  reports is the 3B scope. The email due-date offsets are already decided (−5 days design, −10 days
  copy, from `Send Date` / `Expected Setup Date`); if the live formulas now differ, the gate's
  metadata fetch will show it and 3B stops as instructed.
- **3C (pages/nav):** no page to add. Open question is only whether the 13 shortened labels should
  read exactly as the Airtable table names.
- **3D (importer + QA gate):** no skipped table to unskip. The live-mode gate (a run against the
  real base, not demo fixtures) is what remains, and four tables (Meta Copywriting, Youtube
  Copywriting, Client Assets Organisation, Competitive research) had 0 records on 2026-10-01, so a
  live import proves nothing for them until the base holds rows.
