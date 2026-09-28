# Sprint 2026-09-28 — Talal call: Airtable parity + UI + Overview

Source: client call with Talal, 2026-09-28. Three priorities. This index sequences the
tickets; each links its own file under `backlog/` (or `in-progress/` once picked up).

## Status
- **P1 — Schema parity** → ✅ DONE. [`sprint-p1-airtable-schema-parity`](in-progress/sprint-p1-airtable-schema-parity.md) landed on `main` (`1d8118b`): reconciled dev's `0032–0035`; the audit confirmed the content tables were already at template parity. No further schema adds.

## Recommended sequence (P2/P3)
Do **P2D (theme)** first so the visual layer is settled before the big UI tickets build on it.

| Order | Ticket | Role | Est | Depends on | Blocked? |
|---|---|---|---|---|---|
| 1 | [P2D theme](backlog/sprint-p2d-design-theme.md) — purple gradient + emojis + full-width | FE/DS | M | — | no |
| 2 | [P2A grid/gallery](backlog/sprint-p2a-grid-gallery-views.md) — Airtable-like grid across 6 tables | FE | L | P2D | no |
| 3 | [P2B briefs kanban+detail](backlog/sprint-p2b-briefs-kanban-detail.md) — "most important"; incl. Concepts required-fields + Production-Status removal | FE/domain | XL (split) | P2D, state machine | activity-widget source (verify) |
| 4 | [P2C two-way linking](backlog/sprint-p2c-two-way-linking.md) — verify + close gaps | BE/FE | M | junctions (exist) | no |
| 5 | [P3 overview](backlog/sprint-p3-overview-dashboard.md) — 8 metrics + click-through + per-role aggregation (extends shipped Overview) | BE/FE | L–XL (split) | P2D, brand_assignments | P3-4 Priority Signals needs Slack/Fathom |
| 6 | [P2E R2 uploads](backlog/sprint-p2e-r2-uploads-attachments.md) — multi-attachment schema + uploads + image import | schema/BE/FE | L | — | **R2_* creds absent** |
| 7 | [P2F Gratsi import](backlog/sprint-p2f-gratsi-import-cleanup.md) — second pass, linkage fix, images | migrator | M | P2E-3 | **live prod DB write** (per-run approval); importer on `dev` |

## Blocked-on-credentials / decisions (surface to human)
- **R2 uploads (P2E)** — no `R2_*` on the dev machine; verify with local substitute, live goes to runbook.
- **Gratsi prod import (P2F)** — writes live Railway DB; each run needs explicit go; importer lives on `dev`.
- **Priority Signals (P3-4)** — needs Slack + Fathom ingestion; its own integration epic.
- **OPEN DECISION — "Client Assets Organisation":** spec maps it to `client_assets`, but our `assets` table is an uploaded-file table (`filename`/`url`/`category`/`caption`), semantically a different thing from the spec's folder table (Name[Folder]/Description/Location/Creative Design). Decide: (a) `assets` IS it → rename `caption`→`description`, add folder semantics; or (b) it's a NEW `client_assets` table. Blocks any `assets` schema change.

## Notes carried from P1 audit
- Concepts **Batch+Angle+Theme required** and **Production Status removal** → folded into P2B.
- `creators` pics/videos + `ai_characters.attachments` → multi-attachment upgrade → P2E-1 (the one real remaining schema item).
