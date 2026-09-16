# Backlog (ordered)

Pick the top unblocked ticket. Move its file from `backlog/` to `in-progress/` when picked and to `done/`
when QA passes and the reviewer approves. Ticket bodies: `docs/tickets/backlog/TICKET-XXX.md`.

## Kickoff (Phase 0 and the start of Phase 1)

| ID | Title | Owner(s) | Size | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| TICKET-001 | Bootstrap monorepo | integrator | M | — | done |
| TICKET-002 | Next.js app in apps/web | frontend | S | 001 | done |
| TICKET-003 | Env loader package and Neon + Drizzle wiring in packages/db | integrator → schema | M | 001 | done |
| TICKET-004 | Clerk auth with organisations, protected routes | integrator | M | 002, 003 | done |
| TICKET-005 | Tenancy tables and `withBrand(brandId)` | schema → integrator | M | 003 | backlog |

## Phase 0 remainder (to be ticketed by planner after 001–005)

- CI: GitHub Actions runs typecheck, lint, unit tests on every push; E2E on PRs.
- Deploy skeleton to Vercel with preview per PR (needs Vercel account: human).

## Phase 1 remainder

- Role model: Admin, CSM, Creative Strategist, Video Editor, Designer, Media Buyer, Client (PRD §11).
- Route helpers `requireAdmin`, `requireBrandRole(...)`.
- Brand switcher in the top nav.
- Onboarding wizard: create agency (first run), create first brand with team assignment (PRD §3).

## Phase 2 · parent-child template engine (highest risk)

- `template_row_id`, `overridden_fields` on every per-brand table; `template_brand_id` on brands.
- Seed function on brand creation.
- Propagation engine (Inngest job) skipping overridden fields.
- Local override tracking on child updates.
- Promotion request flow with Admin dashboard approve/reject.
- Structural change flow: `brand_field_overrides` for per-brand visibility. Never per-brand columns.

## Phase 3 · data model (ticket per table, in this order)

Products → Personas → Themes (global) → Angles → Concepts (auto-name) → Creative Briefs (auto-name,
nullable concept) → Copywriting → UGC Management with Partnership Ads (25-day expiry job).

## Phase 4 · approvals and client interface

Two-track state machine · internal transitions on team pages, client transitions on client interface ·
client interface skeleton with page/field visibility config · parent/child interface templates ·
frame comments and attachments (proven library).

## Phase 5 · bulk and notifications

CSV upload + templates on every table · notification bus `dispatch(event, payload)` · routing table from
team assignments · per-user Slack/email toggles · AI spell checker (Anthropic API).

## Phase 6 · migration and dashboards

Airtable export to R2 (raw JSON) then transform · dry-run report per brand, human sign-off ·
role dashboards (Media Buyer: Ads to Launch; CSM: full overview; Strategist: pending work; Client:
approval queue + ads pending launch).

## Phase 7 · hardening

Load test propagation (50 brands × 100 rows) · backup/restore runbook · secrets rotation runbook ·
feature flags.
