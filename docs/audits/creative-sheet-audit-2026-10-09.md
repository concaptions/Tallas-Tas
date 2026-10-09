# Creative Sheet audit — 2026-10-09

Read-only audit of `main @ 6bdace2` against Talal's nine Creative Sheet items (rename and restructure,
single source for briefs, Copywriting rename, Asset Library merge, Dimensions dropdown and column,
auto-naming, imported names, Source default). No code was changed. Three read-only sub-agents swept
the repo in parallel; every finding below was spot-checked against the file it cites.

Companion script: `packages/db/audit-creative-sheet.mjs` (section 4) reports the production numbers
the repo cannot know.

Sizes: **S** = under a day, under 100 lines · **M** = one to two days, 100 to 300 lines · **L** = more
than two days, must be split into several tickets.

> **Follow-up shipped the same day** (`docs/decisions.md` "Creative Sheet audit follow-up"): items 7, 8
> and 9 are DONE (migration 0060 `name_mode`, "New creative" on the sheet, Source stored, batch printed
> once), items 1, 3 and 4 are DONE for the strings and the `?type=` filter listed there, item 5's
> caveat and item 6 stand, and item 2 is deliberately NOT done: the tables are not merged;
> `packages/db/qa-flag-diff.mjs` feeds that decision.

## 1. Status table

| # | Item | Status | Evidence (file:line, test, commit) | What is still missing |
|---|---|---|---|---|
| 1 | Brief tab renamed "Creative Sheet" | **PARTIAL** | Nav: `apps/web/src/components/shell/nav.ts:128` `label: 'Creative Sheet'`; the old `briefs` entry (:124, `'Creative Design'`) is hidden by `REMOVED_WORKSPACES` (`packages/domain/src/team/access.ts:255`). Page `<h1>`: `creative-sheet/creative-sheet-workspace.tsx:555`. Client tab label: `packages/domain/src/interface-config/custom-pages.ts:33` `creative_sheet: 'Creative Sheet'`. Back link on the brief page already reads "← Creative Sheet" (`brief-detail.tsx:475`). Commit `052ba91`. | Client portal page behind the tab still titles itself **"Creative Briefs"** (`app/client/[brandSlug]/briefs/page.tsx:25`, plus "No briefs ready for review" :28). Overview tiles and chart say "Briefs" (`overview-dashboard.tsx:126`, `pipeline-chart.tsx:12`, `lib/dashboard-source.ts:82-202`). Internal Queue copy (`queue/internal/fields.ts:198-264`). Linked-work panels still say "Creative Designs" (angles `fields.ts:86`, products `product-panel.tsx:313`, collections `collections-panel.tsx:340`). Interface Config source dropdown `creative_briefs: 'Creative Design'` (`custom-pages.ts:65`). Creative Sheet page exports no `metadata`, so the browser tab reads the root title. No email or Slack text exists yet (nothing is sent; see item 1c below). |
| 2 | Single source for all briefs | **PARTIAL** (analysis done; one source **MISSING**) | Two independent tables, no sync in either direction: `packages/db/src/schema/creative-sheet-items.ts:15-19` ("NOT a view over `creative_briefs`… 13 of its 29 fields are stored on the sheet row"). Every workflow consumer reads and writes `creative_briefs` (queues, client portal, approvals, dashboard, editor board); only the sheet grid, panel and two Kanban groupings write `creative_sheet_items`. Decision records: `docs/decisions.md:1427-1429`, `:1769-1798`, `:1815-1830`. Detail in section 2. | A decision and a migration. Recommendation: `creative_briefs` is the source of truth; `creative_sheet_items` shrinks to a link row (section 3). |
| 3 | "Meta Copywriting" → "Copywriting" | **PARTIAL** | Nav `nav.ts:150`; workspace `<h1>` `copywriting-workspace.tsx:405`; client tab; collections and products panels; brief page section label `creative-design/fields.ts:659`. Redirect `app/app/meta-copywriting/page.tsx` → `/app/copywriting`. | Two live strings on the brief page: `brief-detail.tsx:151` "…its Meta copy rows appear here." and `:421` `kind: 'Meta copy'`. Retired-only strings (campaigns-offers, copy-types, youtube) can stay. **Stale e2e**: `apps/web/e2e/copywriting.spec.ts:37` expects the h1 `'Meta Copywriting'` (fails whenever Clerk keys are present); `module-parity.spec.ts:288` expects a `'Meta copy'` label the collections panel no longer renders. |
| 4 | Asset Library merge | **PARTIAL** | One Asset Library per brand (`withBrand`); `/app/client-assets` permanently redirects to `/app/assets?tab=client-folders` (`removed-workspaces.test.ts:19`). The tab renders read-only folder cards from `client_asset_folders` (`asset-grid.tsx:143-151`, `packages/db/src/client-asset-folders.ts:128`). Type field exists: `packages/db/src/schema/assets.ts:26` `category`, values `reference, broll, raw_asset, mood_board, showcase_video, ad, edited_footage` (:42-50) — raw, finished ads, b-rolls, edited footage are all covered. Filter works client-side (`asset-grid.tsx:80-91`, :129-142). Uploads: `/api/assets/upload` route → `composeAssetKey` → R2 key `assets/<brandId>/<uuid>/<filename>` (`lib/r2-constants.ts:38-39`) → one `assets` row (`handler.test.ts:210` happy path). | "Merge" is two lists under one heading: client folders are pointers (name, description, location URL), not assets, and have no create/edit/link UI left. Category labels differ between grid, modal and detail (`'Ads'` vs `'Ad'`, detail prints raw keys). The filter has no `data-slot`, no URL param, and **no test**; the search box skips the Client Folders tab. No DB CHECK on `category`. |
| 5 | Dimensions dropdown regression test | **DONE** | Commit `84d332a`. `apps/web/src/app/app/creative-sheet/dimensions-field.test.tsx:59` "fires onChange with the NEW array the moment a ratio is chosen — no Save button involved" (asserts `onChange` called once with `['4:5','1:1','9:16']`); the fix is `dimensions-field.tsx:106` `onValueChange={add}` → `:61-65` `onChange(next)` → panel `creative-sheet-panel.tsx:351` saves immediately. `creative-design/actions.test.ts:247` "accepts an update that re-posts an imported legacy dimension name" proves the zod gate (`actions.ts:238-241`, `isKnownOrLegacyDimension`) no longer rejects legacy names. Both files are new in the commit, so both failed before it. | Caveat: the brief detail page's own picker still saves only on "Save brief" (`[briefId]/brief-detail.tsx:761-777`). |
| 6 | Dimensions is a column on the Creative Sheet | **DONE** (column) / **PARTIAL** (two writers remain) | UI reads and writes `creative_sheet_items.dimensions` only: migration `packages/db/drizzle/0059_creative_sheet_dimensions.sql`; grid `creative-sheet-workspace.tsx:258-269`; panel → `updateCreativeSheetItemDimensionsAction` (`creative-sheet/actions.ts:281-318`) → `updateCreativeSheetItemDimensions` (`packages/db/src/creative-sheet-items.ts:186-201`, brand-scoped). | `creative_briefs.dimensions` is **still written** by every brief-detail save (`updateBriefAction` → `toInput` `creative-design/actions.ts:521-522`; empty array falls back to `dimensionsFor(type)`) and by the importer (`airtable-import.ts:1086`), and **still read** by the brief detail page (`brief-detail.tsx:732-783`). `creative_dimensions` table: UI actions refuse via `assertWorkspaceLive`, page redirects, no UI reads its rows, but the importer (`airtable-import.ts:1415-1429`) and template propagation (`propagation.ts:216`) still write it. The comment in `creative-dimensions/page.tsx:7-9` claiming the sheet reads it is stale. The two dimension columns are edited in two places that never sync. |
| 7 | Auto-naming for NEW entries | **PARTIAL** | Formula exists and is tested: `packages/domain/src/briefs/generate-brief-name.ts:123-143`, `Source-FUNNEL-<TypeInitial><3-digit Number>-Concept-Batch`, separator `-`, e.g. `TAS-TOF-V001-Summer Sale-Batch 1`; empty Concept or Batch segments collapse (`generate-brief-name.test.ts:68`). Runs in the server action `createBriefAction` (`creative-design/actions.ts:597-619`), stores `creative_briefs.name`; client preview in `new-brief-dialog.tsx:95-102`. Number = brand-wide `brief_number` (migration `0049_brief-number.sql`), allocated inside the create transaction under `pg_advisory_xact_lock(hashtext(brandId))` (`packages/db/src/briefs.ts:239-258`) — race-safe; soft-deleted rows keep their number (`briefs.test.ts:690`). No DB trigger. Later edits of funnel/type/batch/source never rename (`actions.ts:731-733` "UPDATE never overwrites `name`"); only the concept cascade renames, and it skips `brief_number`-named briefs (`concepts/actions.ts:648-673`, test `concepts/actions.test.ts:516`). | (a) **Unreachable from the UI**: `createBriefAction` is called only by `new-brief-dialog.tsx`, which is mounted only by `briefs-workspace.tsx`, which the retired `creative-design/page.tsx` no longer renders. The Creative Sheet's own "new row" (`createCreativeSheetItemAction`, `creative-sheet/actions.ts:197`) creates a sheet row with **no name, no number, no source** — the sheet name is a read-time formula `Month-<brief name>` (`packages/db/src/formulas/names.ts:46`) and reads `"October-"` when unlinked. (b) Bug: a linked brief passes the full concept name (`concept?.name`, which is `Batch-Angle-Theme`) and the concept's batch, so the name doubles the batch (`TAS-TOF-V001-B1-Pain-UGC-B1`). (c) The §7 `sequence` is computed outside the transaction (`actions.ts:594`) and is racy, though no longer part of the name. (d) Stale JSDoc at `actions.ts:639-641` says the name is rebuilt on every save. |
| 8 | Existing names untouched | **PARTIAL** | No backfill or recompute script touches `creative_briefs.name` (checked `packages/db/*.mjs`, `packages/db/src/scripts/*`); the migration-URL script updates only URL columns. `updateBriefAction` never writes `name` (`creative-design/actions.ts:731-733`). The importer stores Airtable's name verbatim (`airtable-import.ts:1074` `name: str(f.Name) ?? 'Untitled'`). The sheet has no stored name. | **No guard, only absence of code** — and one path does rewrite imported names: the concept cascade filters on `briefNumber === null` (`concepts/actions.ts:659`), and imported briefs also have `brief_number = NULL`, so saving an imported concept whose Airtable name differs from the `Batch-Angle-Theme` formula renames every imported brief under it to the §7 shape with a `TAS-` prefix (and a `?` funnel letter for imported `RETARGETTING`/`ALL FUNNELS` keys, `airtable-import.ts:570`). No test asserts an imported name survives a concept edit (`airtable-import.test.ts:118` has the fixture, no assertion). A re-import overwrites `name` from Airtable's current value (`importRows`, `:651-688`), which is the intended upsert. |
| 9 | Source defaults to "TAS" | **PARTIAL** (DB and form done; server action does not persist it) | DB: `packages/db/src/schema/briefs.ts:91` `.notNull().default('TAS')`, migration `0006_briefs.sql:12`. Form: `new-brief-dialog.tsx:65` `useState(BRIEF_NAME_DEFAULT_SOURCE)` (`generate-brief-name.ts:29` `= 'TAS'`). Server action: `briefSchema.source: text.optional()` (`creative-design/actions.ts:297`), defaulted only inside `generateBriefName` (`text(args.source) ?? 'TAS'`). | The server action has no `.default('TAS')` and no refine against `creativeSources` (`['TAS','Client']`, `enums.ts:159`). **Bug**: `toInput` (`actions.ts:486-525`) omits `source`, so the submitted value reaches the **name only** and the column always gets the DB default. A user typing `Client` gets `Client-TOF-V001…` with `source = 'TAS'`. The form is a free-text input, not a select. `creative_sheet_items` has no source column and the sheet create form has no source field. |

### 1c. Email and Slack text

Nothing is sent today. `packages/domain/src/notifications/dispatch.ts:47` builds
`[brand] subjectType: subjectName — actor` but no caller sets `subjectType`; the Resend and Slack
calls in `packages/db/src/notification-dispatch.ts:21` are stubs with no non-test callers. The only
"Brief" copy on the notifications surface is the trigger label "Brief assigned to an editor or
designer" (`packages/domain/src/notifications/triggers.ts:56`, `packages/db/src/schema/enums.ts:314`).

### Found in passing (not in the nine items)

- The client portal "Copywriting" tab links to `/client/<slug>/copywriting` (`client/[brandSlug]/layout.tsx:49`) but no such route exists, so the tab 404s.
- `creative_sheet_items.client_approval_status` is never written by any live path (`updateClientApproval` in `lib/client-approval-actions.ts` has no caller; the importer does not map it) yet the sheet grid column (`creative-sheet-workspace.tsx:337-347`), the Overview pipeline (`dashboard-source.ts:504-507`) and the demo progress bar read it.
- In demo mode the client progress bar counts briefs **and** sheet rows, so each creative counts twice (`client/[brandSlug]/layout.tsx:90-111`).
- The sidebar lights nothing on `/app/creative-design/<id>` because `activeSectionKey` (`nav.ts:391`) matches it to the hidden `briefs` entry.

## 2. The two tables (item 2 in full)

**Columns on both.** `creative_briefs` (`packages/db/src/schema/briefs.ts`) vs `creative_sheet_items`
(`packages/db/src/schema/creative-sheet-items.ts`):

| Field | Brief | Sheet | Sheet kind |
|---|---|---|---|
| Name | `name` (stored) | none; `Month-<brief name>` computed in `withBrief()` (`packages/db/src/creative-sheet-items.ts:66-85`) | lookup |
| Type, Funnel, Platform, Performance, Design URL | stored | joined at read time | lookup |
| Internal status | `internal_status` (state machine keys, has `launched`, `on_hold`) | `internal_status` (sheet vocabulary, `enums.ts:397-407`: no `launched`/`on_hold`, adds `video_editing_on_hold`, `design_submitted`) | **stored copy, different vocabulary** |
| Client status | `client_status` + `_updated_at` + `_note` | `status` (`enums.ts:418-423`: has `denied`, `revisions_submitted`, lacks `disapproved`) **and** `client_approval_status` + `_note` + `_updated_at` (a third vocabulary, `enums.ts:586-589`) | **stored copies** |
| QA flags, checklist doc, spell-check flag, spelling feedback | stored | stored | **stored copies** |
| Dimensions | `dimensions` | `dimensions` (0059) | **stored copy** |
| Used, Denied/revisions needed, Winning, Client comments | — | stored | sheet only |
| Launched at, Launch priority | stored | — | brief only |

**Who reads and writes what.**

| Consumer | Reads | Writes |
|---|---|---|
| Creative Sheet grid and panel (`lib/creative-sheet-source.ts:229-291`, `creative-sheet/actions.ts`) | sheet + briefs (lookups) | **sheet** (`create`, `update`, `updateDimensions`, `move`) |
| Creative Sheet Kanban, `internalStatus` / `status` groupings | sheet | **sheet** (`moveCreativeSheetItemAction` :388) |
| Creative Sheet Kanban, `editorStage` grouping (editor board, commit `025d916`) | briefs | **briefs** (`moveBriefStageAction` `creative-design/actions.ts:952`, `startBriefAction` :873) |
| Brief detail page (`creative-design/[briefId]`) | briefs (+ sheet chips in the rail, `fields.ts:503`) | **briefs** (`updateBriefAction` :643, `toggleQaAction` :787, spell-check, `ClientStatusDropdown` → `updateBriefClientStatus` `packages/db/src/briefs.ts:187`) |
| Internal Queue (`lib/internal-queue-source.ts:118`) | briefs | nothing |
| Client Queue (`lib/client-queue-source.ts:72`, `queue/client/actions.ts:137`) | briefs | **briefs** (`client_status`; does not set `client_status_updated_at`) |
| Client portal (`client-queries.ts:220-235` `clientCreatives`, `client/actions.ts:9-21`) | briefs where `internal_status = 'approved'` | **briefs** (`client_status`) |
| Notifications | — | — (no trigger on either table; dispatch has no callers) |
| Ads to Launch | no route; launch fields live on briefs, written only by demo data; dashboard tile counts briefs with both statuses `approved` (`dashboard-source.ts:165-170`) | — |
| Overview dashboard (`lib/dashboard-source.ts`) | briefs (all tiles) + sheet (`computePipelineSummary` :504-507 only) | — |
| Airtable importer (`packages/db/src/airtable-import.ts`) | — | **both**, independently: briefs from "Creative Briefs" (:1066-1120), sheet rows from "Creative Sheet" (:1448-1483, `brief_id` from the "Creative Name" link); sheet import sets neither `dimensions` nor `client_approval_*` |

**Can they drift?** Yes, today, in ten ways: internal status (sheet panel vs editor board), client
status (sheet `status` vs queue/portal approvals), `client_approval_status` always NULL but read, QA
flags (sheet checkboxes vs brief toggles), spell-check (sheet flag triggers nothing), dimensions (two
pickers), vocabulary gaps (`launched` has no sheet key), cardinality (`brief_id` is many-to-one and
nullable; a brief can have zero or several sheet rows), the brief rail showing both statuses side by
side, and re-import overwriting each table's copy separately. Demo data already disagrees (sheet row
`status: 'revisions_needed'` vs brief `pending_for_approval`; sheet `approved` vs brief `launched`;
`packages/db/src/demo-creative-sheet-items.ts`). There is **no sync code** in either direction
(`propagation.ts:216,224` is template-to-brand propagation, not a sheet-to-brief sync). The template
base itself names the sheet table "DONT USE Creative Sheet" (`docs/audits/airtable-module-gap-2026-10-01.md:155,159`).

## 3. Recommendation: `creative_briefs` is the single source of truth

Everything that carries workflow weight already reads and writes `creative_briefs`: the two-track
state machine and client gate (non-negotiable 4), both queues, the client portal and its approvals,
the dashboard tiles, the launch fields, auto-naming, spell-check and the editor board. The sheet's
stored statuses feed nothing downstream. `creative_sheet_items` keeps only what is genuinely its own:
the link row (`id`, `brand_id`, `brief_id`, `created_at` for the month prefix, `legacy_airtable_id`)
and, after a decision, the four sheet-only fields (`used`, `denied_revisions_needed`, `winning`,
`client_comments`) either moved onto the brief or kept on the link row.

This reverses the Oct 9 decision that put `dimensions` on the sheet (0059); the column is harmless to
keep until step 8 but should stop being the write target once the grid reads briefs. Talal signs
this off before step 2 starts.

| Step | What | Size |
|---|---|---|
| 1 | Record the decision in `docs/decisions.md`; run `audit-creative-sheet.mjs` on production for the drift baseline (section 4). | S |
| 2 | Vocabulary map, as code in `packages/domain/src/state`: sheet internal → brief internal (`video_editing_on_hold` → `on_hold`, `design_submitted` → ?), sheet `status` → `CLIENT_STATUS` (`denied` → `disapproved`, `revisions_submitted` → ?), `client_approval_status` → `client_status`. Unit tests per mapping. Domain decision, needs Talal on the two `?`. | M |
| 3 | Migration: add `used`, `denied_revisions_needed`, `winning`, `client_comments` to `creative_briefs` (or derive `denied_revisions_needed` from `client_status` and fold `winning` into `performance`). Apply script. | S |
| 4 | Backfill script (`packages/db/backfill-sheet-to-brief.mjs`, dry-run first): copy sheet-only fields to the brief; dimensions as a union; status conflicts resolved by newest `updated_at`, each resolution logged. Re-run the audit; drift must read zero. | M |
| 5 | Point the Creative Sheet grid, panel and Kanban at briefs (`listBriefs` joined to the link rows); route every write through the existing brief actions (`updateBriefAction` subset, `toggleQaAction`, `updateBriefClientStatus`, a brief dimensions action with the save-on-pick `DimensionsField`). Retire `moveCreativeSheetItemAction` and the sheet `internalStatus`/`status` groupings; keep `editorStage` and add a brief `clientStatus` grouping. E2E for the sheet round trip. | L (split: read path / write path / Kanban) |
| 6 | Drop the sheet arm from `computePipelineSummary` and the demo progress bar; the brief rail shows one status. | S |
| 7 | Importer: map the Airtable sheet's stored fields onto the brief with the step-2 map; write only link and month on the sheet row. PGlite test. | M |
| 8 | **Later**, after one release with a zero-drift audit: migration dropping the stored-copy columns from `creative_sheet_items` (statuses, QA, spell-check, dimensions, client approval). Never `DROP TABLE`. | S |
| 9 | **Later**: retire `creative_dimensions` writers (importer, propagation) and the unmounted workspace code. | S |

## 4. Production numbers: `packages/db/audit-creative-sheet.mjs`

Read-only; reads `DATABASE_URL` from the environment and never prints it; prints counts only, never a
row's name or comment. Validated against PGlite with every migration replayed and seeded edge cases
(unlinked sheet row, soft-deleted brief, two sheet rows on one brief, order-only dimension
difference, legacy dimension name, `Client-` prefixed name with `source = 'TAS'`).

```
cd packages/db && DATABASE_URL="postgresql://…" node audit-creative-sheet.mjs > ../../.audit-oct9/creative-sheet-counts.md
```

It reports, in total and per brand:

1. row counts in both tables (all and live);
2. partner gaps: sheet rows with `brief_id` NULL, pointing at a missing or soft-deleted brief, or at a brief in another brand; briefs with no live sheet row; briefs with more than one;
3. names: how many live briefs match the CREATE-path shape (`^[A-Za-z]+-([A-Z]{3}-)?[A-Z]?[0-9]{3,}(-.+)?$`), the PRD §7 shape, the Airtable-era short shape, or none; how many have `brief_number` set; imported briefs whose name already carries a `Source-` prefix in §7 shape (the cascade in item 8 has run on them); `Untitled`/blank; double hyphens;
4. `source`: null vs `TAS` vs other (the sheet has no source column; the script says so), plus CREATE-named briefs whose name prefix differs from the stored `source` (item 9 bug);
5. dimensions: linked pairs that differ strictly and as sets, sheet-empty-brief-not (0059 gap), brief-empty-sheet-not, legacy names on either side, unlinked rows carrying dimensions; refuses politely if `apply59.mjs` has not run;
6. status copies: internal status, client approval vs client status, QA flags that differ.

## 5. Build plan (do not build yet)

Ordered by priority. P1 is data integrity and the bugs found; P2 is what Talal sees; P3 is the
consolidation. Each row is one ticket in `docs/tickets/` citing PRD §7/§8/§9.

| # | Pri | Item | Work | Size |
|---|---|---|---|---|
| BP-1 | P1 | 8 | Guard the concept cascade: skip briefs with `legacy_airtable_id IS NOT NULL` (and `brief_number IS NOT NULL`, already); test "an imported brief keeps its Airtable name when its concept is renamed". Normalise imported funnel keys (`RETARGETTING`, `ALL FUNNELS`) to vocabulary keys in the importer so a §7 recompute can never print `?`. | S |
| BP-2 | P1 | 9, 7b | `briefSchema.source`: `.default('TAS')` + refine against `creativeSources`; `toInput` passes `source` so the column matches the name; concept segment via `conceptNameSegment` (no doubled batch); Source as a `<select>` of `creativeSources`; tests for all three. | S |
| BP-3 | P1 | 2 | Decision record + production drift baseline (section 3 step 1), then steps 2–4 as their own tickets. | S, then M+S+M |
| BP-4 | P2 | 7a | "New creative" on the Creative Sheet: one dialog that creates the **brief** through `createBriefAction` (auto-named, numbered) and the linked sheet row in the same transaction; retire `createCreativeSheetItemAction`'s unnamed row. Preview uses `generateBriefName` with the next number. E2E for create → appears on the sheet with the generated name in `font-mono`. | M |
| BP-5 | P2 | 1 | Rename the user-facing strings where the sheet is meant: client portal page title and empty state, Overview tiles and chart, Internal Queue copy, the three "Creative Designs" linked-work panels, Interface Config `creative_briefs` label, `metadata` title on the Creative Sheet page; fix `activeSectionKey` so the sheet lights up on a brief page; fix or hide the client Copywriting tab (404). Keep Airtable field names ("Brief to Design"). | M |
| BP-6 | P2 | 3 | The two "Meta copy" strings on the brief page; fix `e2e/copywriting.spec.ts:37` and `module-parity.spec.ts:288`. | S |
| BP-7 | P2 | 4 | Asset Library: one label map for categories shared by grid, modal and detail; `?type=` URL param on the filter with `data-slot`; search covers Client Folders; a component test for the filter. Decide with Talal whether client folders become `assets` rows with a `client_folder` category (M) or stay pointers (S). | S–M |
| BP-8 | P3 | 2 | Single-source migration steps 5–7 (section 3): read path, write path, Kanban, pipeline/progress bar, importer. | L, split in 3–4 tickets |
| BP-9 | P3 | 6, 5 | After BP-8: brief detail picker becomes the save-on-pick `DimensionsField`; the sheet's `dimensions` column stops being written; stale comment in `creative-dimensions/page.tsx`; later drop (step 8). | S |
| BP-10 | P3 | 7c | Move the §7 `sequence` computation inside the create transaction under the same advisory lock, or stop storing it once no name uses it. Delete the stale JSDoc at `actions.ts:639-641`. | S |
| BP-11 | P3 | 1c | When notifications ship: subject text says "creative"/"Creative Sheet", never "brief"; one test on `planDeliveries` output. | S |
