# Oct 7 Action Items -- Status Audit (Oct 8)

Audited from code at `/home/user/Tallas-Tas` on 2026-10-08. Read-only; no code changed.
Railway Postgres: **BLOCKED** -- network policy blocks outbound TCP from this cloud environment. All checks are code/schema/UI only.

---

## Executive Summary

| #   | Item                                                  | Status      | Note                                                                                                                                                       |
| --- | ----------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Template base cleanup (remove 17 tabs)                | **DONE**    | 15 hidden via `TEMPLATE_HIDDEN_SECTION_KEYS`; Upload Links moved to Settings; Copywriting stays visible (renamed, not removed)                             |
| 2   | Rename / restructure                                  | **PARTIAL** | Nav label renamed to "Copywriting"; route still `/app/meta-copywriting/`; "Client Assets" and "Asset Library" remain separate tabs                         |
| 3   | Creative Sheet fixes (dimensions, auto-naming)        | **DONE**    | `dimensions` is a jsonb column on `creative_briefs`, not a table; `generateBriefName` formula shipped with `briefNumber` counter                           |
| 4   | Copywriting FKs (creative_brief, collection, product) | **DONE**    | `creative_brief_id`, `concept_id`, `product_id`, `collection_id` all present on `copywriting` table; indexes exist                                         |
| 5   | Client approval status on 4 tables                    | **PARTIAL** | Present on `creative_sheet_items` and `copywriting`; **MISSING** on `concepts` and `creators`; server action only dispatches to the two that have it       |
| 6   | Interface config system                               | **DONE**    | Schema (`interfacePages`, `interfaceFields`), migration 0051, workspace UI, preview, tree, actions + tests, design-system story all shipped                |
| 7   | Migration approach (process decision)                 | **N/A**     | Process/planning item, not code                                                                                                                            |
| 8   | Airtable client tracking column                       | **N/A**     | Airtable-side change, not in this codebase                                                                                                                 |
| 9   | Asset Library scope                                   | **DONE**    | `assets` table has `category` column with 5 types; UI has category filter; "Client Assets" is intentionally separate (folder pointers, not uploaded files) |
| 10  | Priorities (meta)                                     | **N/A**     | Prioritization decision, not code                                                                                                                          |

---

## Detailed Findings

### Item 1: Template base cleanup -- remove 17 tables from template

**Status: DONE**

**Evidence:**

- `TEMPLATE_HIDDEN_SECTION_KEYS` in `apps/web/src/components/shell/nav.ts` (line 364-382) hides 17 keys from the template brand sidebar.
- Hidden keys: `creative-modules`, `ai-characters`, `competitive-research`, `briefs` (Creative Design), `client-assets`, `youtube-copywriting`, `campaigns`, `email-campaigns`, `email-flows`, `sm-campaign-feed`, `performance`, `creative-reporting`, `creator-ranking`, `copy-types`, `creative-dimensions`, `internal-queue`, `client-queue`.
- `navGroupsForView()` (line 389-401) filters these out when `isTemplate === true`.
- Upload Links: Not in the hidden set because it was relocated to the Settings nav group instead (comment on line 283: "Oct 6/7 Upload Links -> Settings"). Same effect: not a top-level tab.
- Copywriting: Not hidden because it was renamed (Meta Copywriting -> Copywriting) and remains an active authoring tab on the template. This is correct -- the action was to rename it, not remove it.
- Schema tables themselves are deliberately kept (per-brand data stays in Postgres for child brands).
- Nav test (`nav.test.ts`) validates the full section list including the hidden/visible split.

**Gaps: None for the "remove from template" intent.**

---

### Item 2: Rename / restructure

**Status: PARTIAL**

**Item 2.1: "Creative Sheet" exists as a tab**

- Status: DONE
- Evidence: `nav.ts` line 131-136 shows `label: 'Creative Sheet'`, with route `/app/creative-sheet/`. Full workspace, panel, actions, and fields modules exist.

**Item 2.2: "Meta Copywriting" renamed to "Copywriting"**

- Status: PARTIAL
- Evidence:
  - Nav label is `'Copywriting'` (nav.ts line 157), with an explicit comment referencing the Oct 5 Talal sync.
  - Route alias exists: `routes.ts` line 23 says `Alias of metaCopywritingPath -- the copywriting table IS Meta Copywriting.`
  - BUT: The route path is still `/app/meta-copywriting/`, all source files live under `apps/web/src/app/app/meta-copywriting/`, and the workspace component header (copywriting-workspace.tsx line 402-404) still renders "Meta Copywriting" as the page heading.
  - 30+ references to "Meta Copywriting" remain across the codebase in comments, test descriptions, and some UI text.
- Gaps:
  - Route path should be `/app/copywriting/` (or redirected)
  - Page heading still says "Meta Copywriting"
  - Panel header (copy-panel.tsx line 330) still says "Meta Copywriting"

**Item 2.3: Asset Library consolidation**

- Status: NOT STARTED (or intentionally not done)
- Evidence:
  - "Client Assets" (`/app/client-assets/`) and "Asset Library" (`/app/assets/`) are separate nav sections (nav.ts lines 137-144).
  - They serve genuinely different purposes:
    - `client_asset_folders` (schema: `client-asset-folders.ts`): folder-level organizers pointing at external locations (Google Drive, Dropbox).
    - `assets` (schema: `assets.ts`): individual uploaded files in Cloudflare R2 with content type, size, and category.
  - If "consolidation" means merging the UI, it has not happened. If it means keeping them separate with proper scoping, both are independently functional.

---

### Item 3: Creative Sheet fixes

**Status: DONE**

**Item 3.1: Dimensions as a column (not a separate table)**

- Status: DONE
- Evidence:
  - `creative_briefs.dimensions` is a `jsonb('dimensions').$type<string[]>()` column (briefs.ts line 104), NOT NULL defaulting to `[]`.
  - Comment (line 65): "dimensions holds the S8 defaults for the brief's type... editable per row, and the vocabulary of ratios lives in packages/domain/src/creatives."
  - `DimensionsGrid` component in `apps/web/src/app/app/creative-design/[briefId]/dimensions-grid.tsx` renders inline from the brief's `dimensions` array.
  - The separate `creative_dimensions` table still exists as a LOOKUP TABLE (configuration table listing available dimension options), which is correct.

**Item 3.2: Auto-naming formula**

- Status: DONE
- Evidence:
  - `generateBriefName` in `packages/domain/src/briefs/generate-brief-name.ts` implements the formula: `Source-Funnel-TypeInitial-Number-Concept-Batch` (e.g. `TAS-TOF-V001-Summer Sale-Batch 1`).
  - `briefNumber` column added to `creative_briefs` (line 150 of briefs.ts), with migration `0049_brief-number.sql`.
  - `funnelAbbreviation()` maps full names to 3-letter codes (TOF, MOF, BOF, RTG, ALL).
  - Empty segments collapse (no dangling hyphens).
  - Unit tests exist in the domain package.

---

### Item 4: Copywriting links (FKs)

**Status: DONE**

**Evidence:**

- `copywriting` table in `packages/db/src/schema/copy.ts` has all four FKs:
  - `creativeBriefId` (line 66): `uuid('creative_brief_id').references(() => creativeBriefs.id)`
  - `conceptId` (line 67): `uuid('concept_id').references(() => concepts.id)`
  - `productId` (line 68): `uuid('product_id').references(() => products.id)`
  - `collectionId` (line 69): `uuid('collection_id').references(() => collections.id)`
- All four have corresponding indexes (lines 103-106).
- Migration `0052_phase2-schema.sql` added `collection_id` FK and its index, plus `product_id` index.

**Note:** The `funnel` column (line 75) exists despite the schema comment (line 29) saying "Funnel is not here." This is a documentation inconsistency -- the column was apparently added back after the comment was written.

---

### Item 5: Client approval status on 4 tables

**Status: PARTIAL**

**What exists:**

- Domain vocabulary: `CLIENT_APPROVAL_STATUS` in `packages/domain/src/state/client-approval-status.ts` with 4 states: `pending_client_approval`, `approved`, `disapproved`, `revision_needed`. Labels and chip tones included.
- Schema enum: `clientApprovalStatuses` in `packages/db/src/schema/enums.ts` (line 586-592).

**Per-table status:**

| Table                  | Column exists? | Server action? | UI wired?                |
| ---------------------- | -------------- | -------------- | ------------------------ |
| `creative_sheet_items` | YES (line 79)  | YES            | YES (workspace, stories) |
| `copywriting`          | YES (line 94)  | YES            | YES (workspace, fields)  |
| `concepts`             | **NO**         | NO             | NO                       |
| `creators`             | **NO**         | NO             | NO                       |

- `client-approval-actions.ts` dispatches to `creative_sheet_items` and `copywriting` only (line 21: `type ClientApprovalTableKey = 'creative_sheet_items' | 'copywriting'`).
- Migration `0052_phase2-schema.sql` added the columns to `creative_sheet_items` and `copywriting` but not `concepts` or `creators`.

**Gaps:**

- `client_approval_status`, `client_approval_note`, and `client_approval_status_updated_at` must be added to `concepts` and `creators` schemas.
- Migration needed for those two tables.
- `ClientApprovalTableKey` union needs to include `'concepts' | 'creators'`.
- Server action dispatch needs two more entries.
- UI for concepts and creators needs approval status rendering.

---

### Item 6: Interface config system

**Status: DONE**

**Evidence:**

- Schema: `packages/db/src/schema/interface-config.ts` -- two tables:
  - `interfacePages` (which of PRD S10's five pages a brand enables)
  - `interfaceFields` (which fields each page shows, with `visible` and `clientEditable` flags)
- Migration: `packages/db/drizzle/0051_interface-config.sql` exists.
- UI workspace: `apps/web/src/app/app/interface-config/interface-config-workspace.tsx` -- full draft-based UI with live preview.
- Config tree: `config-tree.tsx` -- the page/field tree with toggle switches.
- Config preview: `config-preview.tsx` -- shows what the client will see.
- Server actions: `actions.ts` with `saveInterfaceConfigAction`.
- Actions test: `actions.test.ts` -- validation tests for demo mode and Clerk integration.
- Design system story: `interface-config.stories.tsx`.
- Nav entry: `nav.ts` line 273-278 under Settings.
- Domain logic: uses `enabledPages`, `toggleField`, `togglePage` from `@tas/domain/interface`.
- Token section component exists for client access tokens.

---

### Item 7: Migration approach (process decision)

**Status: N/A** -- This is a process/planning decision, not a code deliverable.

---

### Item 8: Airtable client tracking column

**Status: N/A** -- This is an Airtable-side configuration change, not part of this codebase.

---

### Item 9: Asset Library scope

**Status: DONE**

**Evidence:**

- Schema: `assets` table in `packages/db/src/schema/assets.ts` has `category` column typed as `AssetCategory`.
- Five categories: `reference`, `broll`, `raw_asset`, `mood_board`, `showcase_video` (line 42-48).
- UI: `AssetLibrary` component in `apps/web/src/app/app/assets/asset-grid.tsx` has a category filter dropdown (line 52: `useState<AssetCategory | 'all'>('all')`).
- Each category has a display label (line 31-37: Reference, B-Roll, Raw Assets, Mood Board, Showcase video).
- Asset detail page exists at `/app/assets/[assetId]/`.
- Upload modal exists with category selection.
- "Client Assets" is a separate table (`client_asset_folders`) for external folder links -- this is architecturally correct and not a duplication.

---

### Item 10: Priorities (meta)

**Status: N/A** -- Prioritization/planning decision, not a code deliverable.

---

## Fastest Path to Green

1. **Item 5 (PARTIAL): Add `client_approval_status` to `concepts` and `creators`**
   - Add 3 columns (`client_approval_status`, `client_approval_note`, `client_approval_status_updated_at`) to both schema files.
   - Write migration 0053.
   - Extend `ClientApprovalTableKey` and dispatch in `client-approval-actions.ts`.
   - Wire up UI in concept-panel and UGC panel.
   - Estimated: 1 ticket, backend + frontend stages.

2. **Item 2.2 (PARTIAL): Complete Meta Copywriting -> Copywriting rename**
   - Rename route directory from `meta-copywriting/` to `copywriting/` (or add redirect).
   - Update page heading in `copywriting-workspace.tsx` (line 402-404).
   - Update panel header in `copy-panel.tsx` (line 330).
   - Estimated: Small diff, mostly file renames + string changes.

3. **Item 2.3 (NOT STARTED / INTENTIONAL): Asset Library consolidation**
   - Confirm whether Talal wants the two tabs merged or kept separate.
   - If merge: design a unified view that shows both R2 uploads and external folder links.
   - If keep separate: mark as DONE by design decision.
   - Estimated: Needs product decision first.

4. **Item 4 doc inconsistency: `funnel` column vs. comment**
   - The `copywriting` schema comment says "Funnel is not here" but `funnel: text('funnel')` exists at line 75 of copy.ts.
   - Update the comment to reflect reality, or remove the column if it was added in error.
   - Estimated: One-line fix either way.

5. **Prod DB verification (BLOCKED)**
   - Confirm migrations 0051 and 0052 ran successfully on Railway Postgres.
   - Verify interface_pages and interface_fields tables exist with data.
   - Verify client_approval_status columns exist on creative_sheet_items and copywriting.
   - **Cannot be done from this environment.**

---

## Raw Evidence Files

- `/home/user/Tallas-Tas/.audit-oct8/schema-grep.txt` -- grep output for all 17 table names
- This report: `/home/user/Tallas-Tas/.audit-oct8/talal-oct7-status.md`
