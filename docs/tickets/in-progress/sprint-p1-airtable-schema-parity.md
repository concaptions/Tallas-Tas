# SPRINT P1 — Airtable Schema Parity (template base `appnaSGAgOUbJ0f9m`)

**PRD sections**: §5.3 (Products), §5.4 (Angles), §5.5 (Personas), §5.6 (Themes),
§5.7 (Concepts), §5.8 (Creators/UGC), §5.10 (Briefs), §5.11 (Copy) — plus Collections,
Campaigns & Offers, Creative Dimensions, AI Characters, Competitive Research, Client Assets.

## Goal

Bring the Drizzle schema to full field-parity with the Airtable **template** base
`appnaSGAgOUbJ0f9m` (cross-referenced against the drifted live Gratsi base
`appllDG4OmkK2Hdnn`), per the 2026-09-28 client call with Talal. Role: `schema`
(`packages/db` only). Split into two phases so each diff stays within the DoD budget.

### Phase A — reconcile dev's schema foundation onto main (this commit)

`main` was deliberately kept migration-light for the Monday demo, so it sits at migration
`0031` while `dev` already carries `0032–0035`. Rather than re-derive those by hand, bring
the schema layer across verbatim:

- `0032_partnership-scanner-columns` — `creators.slack_notified`, `creators.current_period_start`
- `0033_ads_to_launch_fields` — `creative_briefs.launched_at`, `creative_briefs.launch_priority`
- `0034_propagation-runs` — new `propagation_runs` table
- `0035_partnership-end-attention` — `creators.partnership_ended_at`, `creators.requires_attention`
- `schema/{briefs,creators,index,propagation-runs}.ts` + `demo-data.ts` fixtures to match.

Query/domain/UI code for these features is **not** brought here — only the schema
foundation, so later Airtable-parity work builds on a schema that already matches `dev`.

**Acceptance (Phase A):**
- [x] Migrations `0032–0035` present, `_journal.json` updated (36 entries), PGlite migrator applies them
- [x] Schema TS matches the migration SQL; new columns nullable/defaulted (safe on existing rows)
- [x] `demo-data.ts` fixtures satisfy the select types
- [x] `pnpm typecheck` (6/6), lint (changed files clean), `pnpm test` green
- [ ] Merged to `main` (pending human approval)

### Phase B — parity audit (COMPLETE, 2026-09-28)

Audited all 14 content tables (Drizzle columns vs the template field list). **Result:
the content tables are already at template parity — no genuine missing stored columns.**
The audit's 3 apparent "missing" reduced to:

- `campaigns.Collections` and `campaigns.Design attached` → **false positives**: stored as
  reverse FKs `collections.campaign_id` and `creative_briefs.campaign_offer_id`. Not gaps.
- `assets.description` → **not a valid add**: `assets` is the uploaded-file table
  (`filename`/`content_type`/`size_bytes`/`url`/`category`/`caption`), semantically distinct
  from the spec's "Client Assets Organisation" folder table. See open question below.

No Phase B schema code required. Deferred items belong to other tickets, not here:

| Item | Where it belongs |
|---|---|
| `creators.profile_pic_url` / `video_intro_url` (text) → multi-attachment jsonb array; `ai_characters.attachments` text → jsonb | **P2E** (R2 upload / multi image+video per creator) — type change + data migration + upload UI |
| Remove **Production Status** from Concepts (Talal) | **P2B** (Concepts UI) — hide the field; column kept for data (soft-delete philosophy), drop only if confirmed |
| Concepts **Batch + Angle + Theme required** | **P2B** (form validation) |
| Deliberate array supersets: `themes.reference_links`, `concepts.ad_inspo_links`, `creators.platform` | No action — supersets of the Airtable type, harmless |

**Open question for the human:** does the spec's "Client Assets Organisation" (folder
table: Name[Folder]/Description/Location/Creative Design) map onto our `assets` file table,
or is it a separate table? Needs a product decision before any `assets` change.
