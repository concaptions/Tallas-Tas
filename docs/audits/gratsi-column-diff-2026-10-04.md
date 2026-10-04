# Gratsi column diff — platform display vs the Gratsi Airtable base (2026-10-04)

Read-only audit. Source of truth: the LIVE meta API of `appllDG4OmkK2Hdnn`, fetched at run
time (the pasted reference list was verified against it). Platform side: `resolveColumns`
for the Gratsi brand against PRODUCTION. Diff is by display label, normalised; near-name
pairs are listed as RELABEL candidates, not as independent miss+leak.

| table | Airtable | platform | missing | leaks | relabels | resolver-driven |
|---|---|---|---|---|---|---|
| Meta Copywriting (copywriting) | 30 | 14 | 16 | 0 | 0 | NO |
| Creative Sheet (creative_sheet_items) | 29 | 14 | 15 | 0 | 0 | yes |
| Youtube Copywriting (youtube_copy) | 29 | 16 | 13 | 0 | 0 | yes |
| Angles (angles) | 21 | 11 | 10 | 0 | 0 | yes |
| Creative Design (Internal & Interface) (creative_briefs) | 42 | 33 | 10 | 1 | 0 | yes |
| Campaigns & Offers (campaigns_offers) | 20 | 12 | 8 | 0 | 0 | NO |
| Concepts (concepts) | 23 | 17 | 6 | 0 | 1 | yes |
| Themes (themes) | 6 | 0 | 6 | 0 | 0 | NO |
| (Internal) Collections (collections) | 13 | 7 | 6 | 0 | 0 | NO |
| (Internal) Product (products) | 11 | 9 | 4 | 2 | 1 | yes |
| UGC Management (creators) | 36 | 33 | 3 | 0 | 0 | yes |
| Creative Reporting (creative_reporting) | 14 | 13 | 1 | 0 | 1 | yes |
| (Internal) Creative Dimensions (creative_dimensions) | 4 | 3 | 1 | 0 | 0 | NO |
| Personas (personas) | 7 | 7 | 0 | 0 | 0 | yes |
| (Internal) Creative Modules (creative_modules) | 4 | 4 | 0 | 0 | 0 | yes |
| (Internal) Copy Type (copy_types) | 4 | 4 | 0 | 0 | 0 | yes |
| Email Campaigns Management (email_campaigns) | 17 | 17 | 0 | 0 | 0 | yes |
| Email Flows Management (email_flows) | 13 | 13 | 0 | 0 | 0 | yes |
| SM Campaign Management Feed (sm_campaign_feed_tasks) | 6 | 6 | 0 | 0 | 0 | yes |
| Client Assets Organisation (client_asset_folders) | 4 | 4 | 0 | 0 | 0 | yes |
| Competitive research (competitive_research) | 7 | 7 | 0 | 0 | 0 | NO |

Ranked worst-first by missing count. Lookups/rollups below are flagged: they are not
stored columns, but they must still DISPLAY as read-only columns resolved through their link.

## Meta Copywriting → `copywriting` — Airtable 30 vs platform 14 · NOT RESOLVER-DRIVEN
- **Missing from the platform (16):**
  - Copy # — `singleLineText` (stored)
  - Collections — `multipleRecordLinks` (stored)
  - Angle — `singleLineText` (stored)
  - Offer — `multipleLookupValues` (lookup)
  - Campaign (from Campaign) — `multipleLookupValues` (lookup)
  - Code (from Campaign) — `multipleLookupValues` (lookup)
  - Collection URL — `multipleLookupValues` (lookup)
  - Link (from Product) — `multipleLookupValues` (lookup)
  - Products (from Collections) — `multipleLookupValues` (lookup)
  - Created By — `createdBy` (stored)
  - Creative Reporting — `singleLineText` (stored)
  - Creative Sheet — `singleLineText` (stored)
  - (Internal) Product — `singleLineText` (stored)
  - (Internal) Creative Design — `multipleRecordLinks` (stored)
  - ⚠️ Please Change the Status of the copy — `singleLineText` (stored)
  - (Internal) Creative Design 2 — `singleLineText` (stored)
- Order: ORDER DIVERGES from Airtable for the matched columns.

## Creative Sheet → `creative_sheet_items` — Airtable 29 vs platform 14
- **Missing from the platform (15):**
  - Performance (from Creative Name) — `multipleLookupValues` (lookup)
  - (Internal) Product (from Creative Name) — `multipleLookupValues` (lookup)
  - Angle (from Creative Name) — `multipleLookupValues` (lookup)
  - Concepts (from Angle) (from Creative Name) — `multipleLookupValues` (lookup)
  - Elements we are Testing — `multipleLookupValues` (lookup)
  - Design File (from Creative Name) — `multipleLookupValues` (lookup)
  - Design Link URL — `multipleLookupValues` (lookup)
  - Collection — `multipleLookupValues` (lookup)
  - Platform — `multipleLookupValues` (lookup)
  - Funnel — `multipleLookupValues` (lookup)
  - Type — `multipleLookupValues` (lookup)
  - Proposed Copy — `multipleLookupValues` (lookup)
  - Creative Module — `multipleLookupValues` (lookup)
  - Created — `createdTime` (stored)
  - Last Modified — `lastModifiedTime` (stored)
- Order: ORDER DIVERGES from Airtable for the matched columns.

## Youtube Copywriting → `youtube_copy` — Airtable 29 vs platform 16
- **Missing from the platform (13):**
  - Offer — `multipleLookupValues` (lookup)
  - Campaign (from Campaign) — `multipleLookupValues` (lookup)
  - Code (from Campaign) — `multipleLookupValues` (lookup)
  - Creative — `multipleLookupValues` (lookup)
  - Collection URL — `multipleLookupValues` (lookup)
  - Link (from Product) — `multipleLookupValues` (lookup)
  - Products (from Collections) — `multipleLookupValues` (lookup)
  - Created By — `createdBy` (stored)
  - Creative Reporting — `singleLineText` (stored)
  - Creative Sheet — `singleLineText` (stored)
  - (Internal) Product — `singleLineText` (stored)
  - (Internal) Creative Design — `singleLineText` (stored)
  - ⚠️ Please Change the Status of the copy — `singleLineText` (stored)
- Order: matched columns follow Airtable order.

## Angles → `angles` — Airtable 21 vs platform 11
- **Missing from the platform (10):**
  - Creators — `multipleRecordLinks` (stored)
  - Concepts — `multipleRecordLinks` (stored)
  - Product (from Angles) — `multipleLookupValues` (lookup)
  - Personas (from Angles) — `multipleLookupValues` (lookup)
  - (Internal) Creative Modules — `multipleRecordLinks` (stored)
  - (Internal) Creative Design — `singleLineText` (stored)
  - Creative Sheet — `singleLineText` (stored)
  - (Internal) Creative Design 2 — `multipleRecordLinks` (stored)
  - UGC Management copy — `singleLineText` (stored)
  - Concepts copy — `singleLineText` (stored)
- Order: ORDER DIVERGES from Airtable for the matched columns.

## Creative Design (Internal & Interface) → `creative_briefs` — Airtable 42 vs platform 33
- **Missing from the platform (10):**
  - Creative Module — `multipleRecordLinks` (stored)
  - Last Modified — `lastModifiedTime` (stored)
  - Created — `createdTime` (stored)
  - Created 2 — `createdTime` (stored)
  - (Internal) Collections 2 — `singleLineText` (stored)
  - Creative Sheet — `multipleRecordLinks` (stored)
  - Ads Copywriting copy — `multipleRecordLinks` (stored)
  - Meta Copywriting — `multipleRecordLinks` (stored)
  - Angles — `singleLineText` (stored)
  - Concepts (from Angles) — `multipleLookupValues` (lookup)
- **Shown but not a Gratsi field — leaks to hide (1):**
  - Due Date
- Order: ORDER DIVERGES from Airtable for the matched columns.

## Campaigns & Offers → `campaigns_offers` — Airtable 20 vs platform 12 · NOT RESOLVER-DRIVEN
- **Missing from the platform (8):**
  - Name — `formula` (formula)
  - Collections — `multipleRecordLinks` (stored)
  - Product — `multipleLookupValues` (lookup)
  - COPY — `multipleRecordLinks` (stored)
  - Design attached — `singleLineText` (stored)
  - Email Campaigns — `multipleRecordLinks` (stored)
  - Email Campaigns Management copy — `multipleRecordLinks` (stored)
  - Ads Copywriting copy — `multipleRecordLinks` (stored)
- Order: matched columns follow Airtable order.

## Concepts → `concepts` — Airtable 23 vs platform 17
- **Missing from the platform (6):**
  - Production Status — `singleSelect` (stored)
  - Performance — `multipleLookupValues` (lookup)
  - UGC Management — `multipleRecordLinks` (stored)
  - Campaigns & Offers — `multipleRecordLinks` (stored)
  - (Internal) Creative Design — `multipleRecordLinks` (stored)
  - UGC Management copy — `singleLineText` (stored)
- **Relabel candidates (near-name pairs, 1):**
  - Airtable "Name" ↔ platform "Concept Name"
- Order: matched columns follow Airtable order.

## Themes → `themes` — Airtable 6 vs platform 0 · NOT RESOLVER-DRIVEN
- **Missing from the platform (6):**
  - Name — `singleLineText` (stored)
  - Notes — `multilineText` (stored)
  - Assignee — `singleCollaborator` (stored)
  - Status — `singleSelect` (stored)
  - Attachments — `multipleAttachments` (stored)
  - Attachment Summary — `aiText` (stored)
- Order: matched columns follow Airtable order.

## (Internal) Collections → `collections` — Airtable 13 vs platform 7 · NOT RESOLVER-DRIVEN
- **Missing from the platform (6):**
  - Copywriting — `multipleRecordLinks` (stored)
  - Creative Sheet — `singleLineText` (stored)
  - (Internal) Creative Design — `multipleRecordLinks` (stored)
  - Table 17 — `multipleRecordLinks` (stored)
  - Email Campaigns Management copy — `singleLineText` (stored)
  - Email Campaigns Management copy — `singleLineText` (stored)
- Order: ORDER DIVERGES from Airtable for the matched columns.

## (Internal) Product → `products` — Airtable 11 vs platform 9
- **Missing from the platform (4):**
  - (Internal) Creative Design 2 — `singleLineText` (stored)
  - Table 17 — `multipleRecordLinks` (stored)
  - Email Campaigns Management copy — `singleLineText` (stored)
  - Creative Sheet — `singleLineText` (stored)
- **Shown but not a Gratsi field — leaks to hide (2):**
  - Collection Link
  - Concepts
- **Relabel candidates (near-name pairs, 1):**
  - Airtable "Email Campaigns Management copy" ↔ platform "Email Campaigns"
- Order: ORDER DIVERGES from Airtable for the matched columns.

## UGC Management → `creators` — Airtable 36 vs platform 33
- **Missing from the platform (3):**
  - Concepts — `multipleRecordLinks` (stored)
  - Creator's cost (USD) — `formula` (formula)
  - Notify Flag — `formula` (formula)
- Order: ORDER DIVERGES from Airtable for the matched columns.

## Creative Reporting → `creative_reporting` — Airtable 14 vs platform 13
- **Missing from the platform (1):**
  - Creative Name (from Creative) — `multipleLookupValues` (lookup)
- **Relabel candidates (near-name pairs, 1):**
  - Airtable "Creative Name" ↔ platform "Creative"
- Order: matched columns follow Airtable order.

## (Internal) Creative Dimensions → `creative_dimensions` — Airtable 4 vs platform 3 · NOT RESOLVER-DRIVEN
- **Missing from the platform (1):**
  - (Internal) Creative Design — `multipleRecordLinks` (stored)
- Order: matched columns follow Airtable order.

## Personas → `personas` — Airtable 7 vs platform 7
- MATCHES (by label set). ORDER DIVERGES from Airtable for the matched columns.

## (Internal) Creative Modules → `creative_modules` — Airtable 4 vs platform 4
- MATCHES (by label set). matched columns follow Airtable order.

## (Internal) Copy Type → `copy_types` — Airtable 4 vs platform 4
- MATCHES (by label set). matched columns follow Airtable order.

## Email Campaigns Management → `email_campaigns` — Airtable 17 vs platform 17
- MATCHES (by label set). matched columns follow Airtable order.

## Email Flows Management → `email_flows` — Airtable 13 vs platform 13
- MATCHES (by label set). matched columns follow Airtable order.

## SM Campaign Management Feed → `sm_campaign_feed_tasks` — Airtable 6 vs platform 6
- MATCHES (by label set). matched columns follow Airtable order.

## Client Assets Organisation → `client_asset_folders` — Airtable 4 vs platform 4
- MATCHES (by label set). matched columns follow Airtable order.

## Competitive research → `competitive_research` — Airtable 7 vs platform 7 · NOT RESOLVER-DRIVEN
- MATCHES (by label set). matched columns follow Airtable order.

## Annotations the raw diff cannot know (read before fixing anything)

1. **Three "gaps" are standing rulings, not bugs.** Concepts' missing `Production Status` is
   Talal's 2026-09-28 "take it out" (AI-34, hidden everywhere, 73 live values kept). The
   `Due Date` "leak" on Creative Design is Talal's own AI-49 ask ("columns + due date") — a
   deliberate platform column. UGC's missing `Concepts` link is AI-41's retirement of the dead
   second link (0/70 filled). Each now CONFLICTS with the strict Gratsi-matches-Airtable rule;
   none may be auto-"fixed" without a ruling naming the winner.
2. **The dead-lookup register is the TEMPLATE's, not Gratsi's.** `overnight-dead-lookups.md`'s 12
   `isValid:false` lookups are broken in the parent base (its `Creative Name` is singleLineText).
   In GRATSI, `Creative Name` is a real link and every Creative Sheet lookup is alive — they are
   display work, not seed-nothing rows.
3. **Airtable system fields map to columns the platform already stores.** `Created`,
   `Last Modified`, `Created By` (and `Created 2`) are `created_at` / `updated_at` / `created_by`
   on every table (CLAUDE.md shared columns) — display derivations, no migration.
4. **Junk and duplicate fields** (`Table 17`, both `Please Change the Status of the copy` fields,
   the duplicate `Email Campaigns Management copy` pair on Collections, `Created 2`, and the
   `… copy` text remnants of Airtable table-duplications) match rule 5: decision-doc them, do not
   invent columns.
5. **Themes is the global exception** (non-negotiable 3; held out of the resolver by decision).
   Its real displayed set is the hardcoded eight (name, category, status, assignee, notes,
   attachments, attachmentSummary, referenceLinks): Airtable's six plus the platform's `category`
   and `referenceLinks` — a cross-brand library page, flagged rather than per-brand-hidden.
6. **Angles' missing links are reverse links.** The platform convention showed them on the record
   page only (AI-43's ruling confirmed the panel display); the strict rule now asks for read-only
   GRID columns too. That is new display work, not new storage.

# POST-FIX RE-AUDIT (same script, same truth source, after the three GRATSI-MATCH clusters + prod seed apply)

Eleven tables now diff at 0 missing / 0 leaks (Creative Sheet at its full 29/29, all thirteen
lookups alive). Every residual below is a NAMED exception, not an open gap: the rule-5 remnants,
the three ruling conflicts (Production Status/AI-34, Due Date/AI-49, UGC Concepts/AI-41), the two
storage-gap flags (Angles › Creators links nothing anywhere; Creative Design › Ads Copywriting
copy has no stored side), and the Themes global-library exception — each recorded in
docs/decisions.md. The 'resolver-driven NO' flags in this appendix are the audit script's own
stale hardcoded map: all five of those pages were rewired this run (verify-rollout covers all 20
registered tables ok against prod).

# Gratsi column diff — platform display vs the Gratsi Airtable base (2026-10-04)

Read-only audit. Source of truth: the LIVE meta API of `appllDG4OmkK2Hdnn`, fetched at run
time (the pasted reference list was verified against it). Platform side: `resolveColumns`
for the Gratsi brand against PRODUCTION. Diff is by display label, normalised; near-name
pairs are listed as RELABEL candidates, not as independent miss+leak.

| table | Airtable | platform | missing | leaks | relabels | resolver-driven |
|---|---|---|---|---|---|---|
| Themes (themes) | 6 | 0 | 6 | 0 | 0 | NO |
| Angles (angles) | 21 | 16 | 5 | 0 | 0 | yes |
| Meta Copywriting (copywriting) | 30 | 25 | 5 | 0 | 0 | NO |
| Youtube Copywriting (youtube_copy) | 29 | 24 | 5 | 0 | 0 | yes |
| (Internal) Product (products) | 11 | 7 | 4 | 0 | 1 | yes |
| (Internal) Collections (collections) | 13 | 9 | 4 | 0 | 0 | NO |
| Creative Design (Internal & Interface) (creative_briefs) | 42 | 39 | 4 | 1 | 0 | yes |
| Concepts (concepts) | 23 | 21 | 2 | 0 | 0 | yes |
| Campaigns & Offers (campaigns_offers) | 20 | 18 | 2 | 0 | 0 | NO |
| UGC Management (creators) | 36 | 35 | 1 | 0 | 0 | yes |
| Personas (personas) | 7 | 7 | 0 | 0 | 0 | yes |
| Creative Sheet (creative_sheet_items) | 29 | 29 | 0 | 0 | 0 | yes |
| (Internal) Creative Modules (creative_modules) | 4 | 4 | 0 | 0 | 0 | yes |
| (Internal) Copy Type (copy_types) | 4 | 4 | 0 | 0 | 0 | yes |
| Email Campaigns Management (email_campaigns) | 17 | 17 | 0 | 0 | 0 | yes |
| Email Flows Management (email_flows) | 13 | 13 | 0 | 0 | 0 | yes |
| Creative Reporting (creative_reporting) | 14 | 14 | 0 | 0 | 0 | yes |
| SM Campaign Management Feed (sm_campaign_feed_tasks) | 6 | 6 | 0 | 0 | 0 | yes |
| (Internal) Creative Dimensions (creative_dimensions) | 4 | 4 | 0 | 0 | 0 | NO |
| Client Assets Organisation (client_asset_folders) | 4 | 4 | 0 | 0 | 0 | yes |
| Competitive research (competitive_research) | 7 | 7 | 0 | 0 | 0 | NO |

Ranked worst-first by missing count. Lookups/rollups below are flagged: they are not
stored columns, but they must still DISPLAY as read-only columns resolved through their link.

## Themes → `themes` — Airtable 6 vs platform 0 · NOT RESOLVER-DRIVEN
- **Missing from the platform (6):**
  - Name — `singleLineText` (stored)
  - Notes — `multilineText` (stored)
  - Assignee — `singleCollaborator` (stored)
  - Status — `singleSelect` (stored)
  - Attachments — `multipleAttachments` (stored)
  - Attachment Summary — `aiText` (stored)
- Order: matched columns follow Airtable order.

## Angles → `angles` — Airtable 21 vs platform 16
- **Missing from the platform (5):**
  - Creators — `multipleRecordLinks` (stored)
  - (Internal) Creative Design — `singleLineText` (stored)
  - Creative Sheet — `singleLineText` (stored)
  - UGC Management copy — `singleLineText` (stored)
  - Concepts copy — `singleLineText` (stored)
- Order: matched columns follow Airtable order.

## Meta Copywriting → `copywriting` — Airtable 30 vs platform 25 · NOT RESOLVER-DRIVEN
- **Missing from the platform (5):**
  - Creative Reporting — `singleLineText` (stored)
  - Creative Sheet — `singleLineText` (stored)
  - (Internal) Creative Design — `multipleRecordLinks` (stored)
  - ⚠️ Please Change the Status of the copy — `singleLineText` (stored)
  - (Internal) Creative Design 2 — `singleLineText` (stored)
- Order: matched columns follow Airtable order.

## Youtube Copywriting → `youtube_copy` — Airtable 29 vs platform 24
- **Missing from the platform (5):**
  - Creative — `multipleLookupValues` (lookup)
  - Creative Reporting — `singleLineText` (stored)
  - Creative Sheet — `singleLineText` (stored)
  - (Internal) Creative Design — `singleLineText` (stored)
  - ⚠️ Please Change the Status of the copy — `singleLineText` (stored)
- Order: matched columns follow Airtable order.

## (Internal) Product → `products` — Airtable 11 vs platform 7
- **Missing from the platform (4):**
  - (Internal) Creative Design 2 — `singleLineText` (stored)
  - Table 17 — `multipleRecordLinks` (stored)
  - Email Campaigns Management copy — `singleLineText` (stored)
  - Creative Sheet — `singleLineText` (stored)
- **Relabel candidates (near-name pairs, 1):**
  - Airtable "Email Campaigns Management copy" ↔ platform "Email Campaigns"
- Order: matched columns follow Airtable order.

## (Internal) Collections → `collections` — Airtable 13 vs platform 9 · NOT RESOLVER-DRIVEN
- **Missing from the platform (4):**
  - Creative Sheet — `singleLineText` (stored)
  - Table 17 — `multipleRecordLinks` (stored)
  - Email Campaigns Management copy — `singleLineText` (stored)
  - Email Campaigns Management copy — `singleLineText` (stored)
- Order: matched columns follow Airtable order.

## Creative Design (Internal & Interface) → `creative_briefs` — Airtable 42 vs platform 39
- **Missing from the platform (4):**
  - Created 2 — `createdTime` (stored)
  - (Internal) Collections 2 — `singleLineText` (stored)
  - Ads Copywriting copy — `multipleRecordLinks` (stored)
  - Angles — `singleLineText` (stored)
- **Shown but not a Gratsi field — leaks to hide (1):**
  - Due Date
- Order: matched columns follow Airtable order.

## Concepts → `concepts` — Airtable 23 vs platform 21
- **Missing from the platform (2):**
  - Production Status — `singleSelect` (stored)
  - UGC Management copy — `singleLineText` (stored)
- Order: matched columns follow Airtable order.

## Campaigns & Offers → `campaigns_offers` — Airtable 20 vs platform 18 · NOT RESOLVER-DRIVEN
- **Missing from the platform (2):**
  - Product — `multipleLookupValues` (lookup)
  - Design attached — `singleLineText` (stored)
- Order: matched columns follow Airtable order.

## UGC Management → `creators` — Airtable 36 vs platform 35
- **Missing from the platform (1):**
  - Concepts — `multipleRecordLinks` (stored)
- Order: matched columns follow Airtable order.

## Personas → `personas` — Airtable 7 vs platform 7
- MATCHES (by label set). ORDER DIVERGES from Airtable for the matched columns.

## Creative Sheet → `creative_sheet_items` — Airtable 29 vs platform 29
- MATCHES (by label set). matched columns follow Airtable order.

## (Internal) Creative Modules → `creative_modules` — Airtable 4 vs platform 4
- MATCHES (by label set). matched columns follow Airtable order.

## (Internal) Copy Type → `copy_types` — Airtable 4 vs platform 4
- MATCHES (by label set). matched columns follow Airtable order.

## Email Campaigns Management → `email_campaigns` — Airtable 17 vs platform 17
- MATCHES (by label set). matched columns follow Airtable order.

## Email Flows Management → `email_flows` — Airtable 13 vs platform 13
- MATCHES (by label set). matched columns follow Airtable order.

## Creative Reporting → `creative_reporting` — Airtable 14 vs platform 14
- MATCHES (by label set). matched columns follow Airtable order.

## SM Campaign Management Feed → `sm_campaign_feed_tasks` — Airtable 6 vs platform 6
- MATCHES (by label set). matched columns follow Airtable order.

## (Internal) Creative Dimensions → `creative_dimensions` — Airtable 4 vs platform 4 · NOT RESOLVER-DRIVEN
- MATCHES (by label set). matched columns follow Airtable order.

## Client Assets Organisation → `client_asset_folders` — Airtable 4 vs platform 4
- MATCHES (by label set). matched columns follow Airtable order.

## Competitive research → `competitive_research` — Airtable 7 vs platform 7 · NOT RESOLVER-DRIVEN
- MATCHES (by label set). matched columns follow Airtable order.
