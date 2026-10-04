# Overnight action-items run — final report (2026-10-04)

Run executed unattended off the 2026-10-04 audit (`action-items-full-status.md`). Main pushed at
`0ebdfa2`; a follow-up commit carries the verify-rollout register and this report.

## Headline

- **Zero unblocked items remain open.** 25 were already DONE; **27 reached DONE this run** (15
  merged from the stranded track branches + AI-36 cherry-picked first, 9 built fresh, 3 settled by
  decision record); 13 stay BLOCKED-ON-TALAL (questions consolidated); 2 stay BLOCKED-ON-R2;
  AI-27's production import is READY BUT NOT APPLIED (two independent stop signals, below).
  **Nothing is STUCK** — no item exhausted its QA passes.
- Gates at pushed HEAD: typecheck ✓, lint ✓ (zero warnings), **unit 201 files / 2882 tests ✓,
  e2e 232 passed / 0 failed / 3 credential-skipped** (the skips are the live-mode specs, by design).
- Production: **resolver 15/15 tables verified ok** (incl. creative_briefs 31/33, newly
  resolver-driven); migrations **0047 + 0048 applied**; column seed reconciled (372 definitions
  over 2 bases; AI-34 hide + AI-41 retirement + AI-49 due_date now live). Row/junction counts vs
  the Phase-0 baseline: **identical on all 69 tables except `column_definitions` 447→448** (the
  intended due-date config row). No content or junction data moved.

## Per-item status

**DONE before the run (25, audit evidence):** AI-01, 03, 05, 07, 10, 11, 12, 14, 15, 19, 20, 21,
23, 24, 25, 28, 29, 38, 40, 45, 46, 50, 51, 56, 58.

**DONE this run — merged from the stranded branches, gated, cross-branch breakage fixed at root:**
- AI-36 concept saves un-broken (cherry-pick `0b53718`, the live-broken fix, landed first) · AI-08
  (`dab9c8c`) · AI-18 + AI-22 (ai-views; + born-red gallery selector fixed) · AI-34 + AI-35 + AI-37
  (ai-concepts) · AI-41 + AI-42 (ai-linking) · AI-48 + AI-49 + AI-52 + AI-54 + AI-64a (ai-briefs) ·
  AI-57 + AI-59 + AI-65 (ai-editor). Three parallel-built tests pinned the stage label AI-59
  renamed; all three reconciled (`94e382f`, `f574597`).
- AI-06 complete: the three reference cards (recovered WIP finished, `8a25b67`) + per-CSM shell +
  hardcoded showcase removed (`e80f092`). AI-09 cross-client totals (`e509cd3`,
  listBrandsForActor + one-connection panel loop). AI-13 gradient rendered on top bar + primary
  CTA + /design-system swatch (`9a55b08`).
- AI-16 cover picker (rescued WIP `7a157e8` finished; its flake was three real useTableView bugs,
  fixed at root `bb6b694`/`48bd82f`/`a711cf1`) + card-line reorder (`5a3b19b`). AI-17 List view on
  the six tables + Concepts quick-look panel with the name as a real Link (`3f65828`; row-click
  contract change owned in the commit; parity walk follows via `30ecf69`). AI-32 field filters +
  grouping (`e3c14f5`). AI-64 closes with 64a (grid) + the filters half (AI-32).
- AI-26 UI half: dead avatar URLs flip to initials — onError AND a hydration-time
  complete/naturalWidth check, since production's 410s fire before React attaches (`7fca6bc`,
  `0ebdfa2`). AI-55 product-required rule in validateAngleDraft, both callers, boundary-tested
  (`440ebf9`).
- Settled by decision record: AI-04 (nothing dropped — empties mirror Gratsi's own, `79ea289`),
  AI-47 (Gratsi-base reading proven by module-parity, `3d8f24e`), AI-53 (noun reading — the
  copywriting modules exist, `2197ea2`).

**BLOCKED-ON-TALAL (13):** AI-02, 33, 39, 43, 44, 60, 61, 62, 63, 66, 67, 68, 69 — every question
consolidated in `action-items-stuck.md` §6 (`1548b59`).

**BLOCKED-ON-R2 (2 + a half):** AI-30, AI-31, and AI-26's re-host (919 URLs / 442 rows). Exact
need: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — plus the
public-read URL fix in packages/db/src/r2.ts before anything plays back.

## AI-27 — ready, deliberately not applied tonight

Two independent stop signals, either sufficient:
1. **The run's own scope rule tripped.** The final pre-apply fetch shows the live base moved
   during the day: **Concepts 106 → 102** (four records gone from Airtable). The dependency-closed
   import syncs junctions to the export, so concept junctions would shrink below the Phase-0
   baseline — movement OUTSIDE the expected set (creative_sheet_items +377, creative_modules +35
   (+2 junctions), creator_products +27), which this run's instructions answer with STOP.
2. The session's permission layer declined the final pre-apply dry-run invocation, and it was not
   re-attempted.
Earlier tonight a full dry run DID complete clean (exit 0, rolled back; unmapped fields all
lookups/formulas/system, the two known select normalisations only). Baseline junctions are
untouched in prod. **To apply after reviewing the Concepts drift** (fresh export at
`$SCRATCH/gratsi-apply.json`, or re-fetch):
`cd ~/tallas-tas && set -a && . "/Users/macbook/Tallas Tas/.env.local" && set +a && pnpm --filter @tas/db airtable-import -- --file <export.json> --brand-name "Gratsi" --brand-id 11111111-1111-4111-8111-111111111113 --dry-run` — read the counts, then re-run with `--dry-run` dropped.

## Migrations applied

- `0047_view-cover-field.sql` (user_table_views.cover_field text NULL)
- `0048_view-filters-grouping.sql` (filters jsonb '[]' NOT NULL; group_by text NULL)
Both information_schema-guarded, applied via migrate-prod `--apply` after a clean dry run; plus
`seed-columns --apply` (the designed deploy path for column-seed changes).

## Needs a human (flag-for-manual)

1. Signed-in multi-brand render of the per-CSM shell (needs a real Clerk session + assignments;
   logic is PGlite-tested). Eyeball /app as the 4-brand CSM after deploy.
2. The live-mode e2e project (3 skipped specs) still needs the four live variables.
3. AI-41's "not drawn here" notice disappearance on Gratsi UGC — signed-in check.
4. Vercel deploy of `0ebdfa2`+ was triggered by the push; confirm it went live.
5. Filters/grouping ignore long-text renderer columns by design (no text accessor); separate
   ticket if they should be filterable.

## Commits

Pushed `03dea84..0ebdfa2` (31 commits: 2 audit, honesty fix, baseline, Talal questions, AI-36,
6 track merges + 2 Phase-3 track merges, per-item builds, 5 cross-track QA fixes) — plus the
follow-up commit carrying this report and the verify-rollout register (AI-34/AI-41 expected
counts). Branches claude/ai-* and claude/ovn-* are fully merged; `claude/ovn-ai16-wip` (the
rescued WIP) is absorbed by the views merge and can be deleted.
