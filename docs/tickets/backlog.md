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
| TICKET-005 | Tenancy tables and `withBrand(brandId)` | schema → integrator | M | 003 | in-progress |

## Batch 2 · Phase 0 remainder, Phase 1 remainder and the design system (in this order)

Ticket bodies in `docs/tickets/backlog/`. Gated = the file has at least one line under "Gated criteria (D-008)".
TICKET-012a/012b un-gate every E2E; the design-system tickets (from the 2026-09-16 handoff) come before the
first product screens so every screen inherits the tokens, `StatusChip` and `StepRow`.

| ID | Title | Owner(s) | Size | Depends on | Gated | Status |
| --- | --- | --- | --- | --- | --- | --- |
| TICKET-006 | CI on GitHub Actions | integrator | S | 002, 004 | yes | backlog |
| TICKET-007 | Vercel deploy skeleton | integrator | S | 002, 003, 006 | yes | backlog |
| TICKET-008 | Auth readers and route helpers | integrator | M | 004, 005 | yes | backlog |
| TICKET-014 | `@tas/domain` package skeleton and role arrays | integrator | S | 003, 005 | no | backlog |
| TICKET-012a | PGlite driver dispatch, migrate/seed entrypoints and seed identities | schema | S | 003, 005, 008 | no | backlog |
| TICKET-012b | Test-only sign-in, Playwright and CI on PGlite | integrator | M | 012a, 004, 006, 007, 008 | no | backlog |
| TICKET-DS-01 | Land the design tokens (`@tas/ui`, Tailwind `@theme`, fonts, tokens page) | integrator → frontend | M | 002, 012b | no | backlog |
| TICKET-DS-02 | Codify the creative status state machines and the client-track gate | backend | M | 014 | no | backlog |
| TICKET-DS-03 | Two-Track Approval widget | frontend | M | DS-01, DS-02 | yes | backlog |
| TICKET-DS-04 | Extract StatusChip and StepRow into shared UI | frontend | S | DS-03 | no | backlog |
| TICKET-013 | shadcn components for Phase 1 and 2 | frontend | S | 002, DS-01 | no | backlog |
| TICKET-DS-05 | Design system reference page (admin-only) | frontend | M | DS-04, 013, 008 | no | backlog |
| TICKET-009 | createAgency and createBrand | integrator → backend | M | 014, 008 | no | backlog |
| TICKET-010 | Brand switcher and workspace layout | frontend | M | 008, 013, 014 | yes | backlog |
| TICKET-011 | Onboarding wizard | frontend | M | 009, 010, 013 | yes | backlog |

## Batch 3 · Phase 2 parent-child template engine (design: `docs/design/template-engine.md`)

| ID | Title | Owner(s) | Size | Depends on | Gated | Status |
| --- | --- | --- | --- | --- | --- | --- |
| TICKET-022 | Domain template spec, override functions and brand rules | backend → schema | M | 014, 005 | no | backlog |
| TICKET-020 | Template registry, `brands` additions and `templatedColumns` | schema → integrator | M | 022, 006 | yes | backlog |
| TICKET-021 | Engine ledger tables and `renameFieldKey` | schema | M | 020 | no | backlog |
| TICKET-023 | Domain propagation plan: `coalesceChanges`, `planChildChange`, chunking, run rules | backend | M | 022 | no | backlog |
| TICKET-024a | Privileged template scope: factories, audit, reads, `writeChild`, acknowledge | schema | M | 021, 023 | no | backlog |
| TICKET-024b | Batched plan execution, ledger upserts, package subpaths and the import fence | schema → integrator | M | 024a | no | backlog |
| TICKET-026 | `brand_field_overrides`, `interface_pages`, `interface_fields` and `fieldVisibility` | schema | M | 021 | no | backlog |
| TICKET-025 | `withBrand` templated methods and the template journal | integrator | M | 022, 024a, 026 | no | backlog |
| TICKET-027a | `seedBrand`, readiness read, `testTemplateWorld` and the dev seed | schema | M | 024b, 026 | no | backlog |
| TICKET-027b | Per-child apply and `resyncBrand` (plan, chunk, in-process twin) | schema | M | 027a | no | backlog |
| TICKET-028a | Run lifecycle: claim, assert, finish, resend, retry | schema | M | 025, 027a, 023 | no | backlog |
| TICKET-028b | `applyChildChunk` and `propagateRun` | schema | L | 028a, 027b | no | backlog |
| TICKET-029a | `createRun`, the `@tas/integrations` package and the Inngest functions | schema → backend | M | 028b, 027b, 009, 003 | no | backlog |
| TICKET-029b | Inngest serve route, request-path client, seed on brand creation, readiness gate, env | backend → frontend → integrator | M | 029a, 027a, 009, 010, 012b, 007 | yes | backlog |
| TICKET-030 | `promotion_requests` table, promotion state machine and promotion domain functions | schema → backend | M | 022, 021, 014 | no | backlog |
| TICKET-031a | Promotion ops: request, withdraw, reject, list, preview; Server Actions and `requireTemplateEditor` | schema → backend | M | 030, 024b, 008, 009, 014 | no | backlog |
| TICKET-031b | Op `approvePromotion` and the approve Server Action | schema → backend | M | 031a, 029b | yes | backlog |
| TICKET-032a | Ops: reset to template, acknowledge conflicts, conflicts query, resync brand | schema → backend | M | 028b, 030, 029b, 027b, 008, 014 | no | backlog |
| TICKET-032c | Ops: field resync, field catalog reconcile, `db:migrate` hook and deploy hook | schema → backend | M | 032a, 025, 026, 012a, 007 | yes | backlog |
| TICKET-032b | Ops `linkToTemplate` and `retentionSweep`, retention cron | schema → backend | S | 032a | no | backlog |
| TICKET-033 | Child edit popup and promotion modal | backend → frontend | M | 031a, 029b, 028a, 023, 026, 025, 012b, 010, 013, 008 | yes | backlog |
| TICKET-034 | Admin promotion dashboard and the end-to-end promotion flow | backend → frontend | M | 031b, 033, 012b, 029b, 011, 013 | yes | backlog |
| TICKET-035 | Brand "Template updates" page, conflict badge, reset-to-template menu items | backend → frontend | M | 032a, 033, 034, 012b, 010 | yes | backlog |
| TICKET-036a | Run listing ops and the propagation admin actions | schema → backend | S | 032a, 029b, 028a, 023 | no | backlog |
| TICKET-036b | Admin propagation page, "Setting up from template" page, brand switcher Template badge | frontend | M | 036a, 034, 033, 029b, 012b, 010, 011 | yes | backlog |
| TICKET-037 | Runbook, two-connection concurrency script, load-test project, Phase 3 checklist, decisions confirmed | planner → schema → integrator → qa | S | 029b, 032b, 032c, 036b, 006 | yes | backlog |

## Tooling follow-ups (reviewer suggestions from TICKET-001 and TICKET-002, not yet ticketed)

- D-009 says the root `typecheck` task is uncached while `//#typecheck:root` is cached; amend the prose or add `cache: false` so config and decision agree.
- TICKET-001 cites PRD §14.6; the cost target is item 1 under PRD §14 (the author's PRD also numbers two sections "16"). Fix the citation when the ticket is revisited.
- Lint gap: `no-restricted-properties` misses `const { env } = process; env.X`. Add a `no-restricted-syntax` selector with the same message, exempted under `packages/env/**` (fold into TICKET-012b or TICKET-020 stage 2).
- The `.js/.mjs/.cjs` ESLint override declares no Node globals; add `languageOptions.globals` when the first root script needs `process` or `__dirname`.
- `turbo.json`: `typecheck` and `lint` depend on `^build`; drop it if packages resolve each other from TypeScript sources.
- `playwright.config.ts`: `reuseExistingServer` should be `!CI` read through `@tas/env` (fold into TICKET-012b).
- `Button asChild` renders the landing `<h1>` as a button; use a `Card` when the real landing page lands (TICKET-010).

## Phase 3 · data model (ticket per table, in this order)

- Brand status action (`active` ↔ `paused` ↔ `archived`, admin); `archived → active` calls `requestResync` (design A7).

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
