# TAS Creative Platform — engineering rules

This file is loaded into every agent that works in this repository. It condenses the engineering brief.
Product intent lives in `docs/PRD.md` (the author's section numbers are what tickets cite). Read the PRD
section a ticket cites before writing code. Never write throwaway code: every change belongs to a ticket in
`docs/tickets/` and must meet the Definition of Done below.

## Mission

Replace TAS Digital's Airtable Creative Hub with a multi-tenant SaaS. Two audiences: the TAS creative team
(internal workspace) and their clients (per-brand approval interface). V0 of the briefing system in 3 to 4
weeks, active clients migrated in October 2026, fully off Airtable by end of 2026. Total running cost
target: 500 USD per year. Every architectural choice respects that ceiling.

## Non-negotiables (escalate to the human before breaking any of these)

1. One parent template propagates to every brand. A structural change in the parent lands in every child.
2. Child changes can *request* promotion to the parent (popup → Admin dashboard → approve). Nothing auto-promotes.
3. Themes are a GLOBAL library across all brands. Every other data table is per-brand, seeded from the parent template.
4. Two-track approval: Internal Status (team only, invisible to clients) and Client Status (client-facing).
   A creative appears in the client interface only when Internal = Approved AND Client = Pending for Approval.
5. Statics can exist without a Concept. `creative_briefs.concept_id` is nullable. Never NOT NULL.
6. Names are auto-generated, never hand typed. Concept = Batch-Angle-Theme. Creative =
   {FUNNEL}{FORMAT}{NUMBER}-BATCH-CONCEPT-VERSION(-PRODUCT). See PRD §7.
7. Notifications are Slack DMs through the existing TAS Bot app (never a new Slack app). Email is a per-user
   toggle. Routing comes from the brand's team assignment set at onboarding, not per-automation config.
8. Meta tokens (later) are read-only. No write scopes. Ever.
9. CSV bulk upload on every data table in V1 with a downloadable CSV template per table.
10. Clients see zero internal data: no internal statuses, budgets, creator costs, partnership prices.

## Tech stack (any deviation is logged in `docs/decisions.md` with the reason)

Next.js 15 App Router + React 19, TypeScript strict · Postgres on Neon · Drizzle ORM + drizzle-kit ·
Clerk (auth + organisations) · Server Actions for mutations (no tRPC in V0) · shadcn/ui + Tailwind CSS 4 ·
Cloudflare R2 · Inngest (background jobs, schedules) · Slack Web API via existing TAS Bot · Resend ·
Vercel hosting · Playwright (E2E) · Vitest (unit) · pnpm workspaces + Turborepo.

Local machines have no Postgres or Docker. Database tests run on PGlite (`@electric-sql/pglite`, real
Postgres compiled to WASM) through `drizzle-orm/pglite`. Production code takes a connection via a factory
(`createDb(...)`), never a module-level singleton.

## Repo layout

```
apps/web                 Next.js app                         package @tas/web
packages/db              Drizzle schema, migrations, seed,   package @tas/db
                         propagation engine, withBrand
packages/domain          Business logic, state machines,     package @tas/domain
                         naming formulas (pure functions)
packages/integrations    Slack, Resend, Inngest, R2, Airtable package @tas/integrations
packages/ui              shadcn components, brand-agnostic   package @tas/ui
packages/env             zod-validated environment loader    package @tas/env
docs                     PRD.md, decisions.md, runbook.md, glossary.md, tickets/, design/
scripts                  Migration and one-off scripts
```

## Architecture principles (defend these when a shortcut looks tempting)

- Root cause first. A UI bug is traced to the data or the state machine. Never patch the symptom.
- Tenancy is enforced at the query layer: every branded query goes through `withBrand(brandId)` in
  `packages/db`. Route-level checks (`requireAdmin`, `requireBrandRole`) are the second line of defence.
- Parent-child template = one Postgres schema, `brand_id` on every per-brand table, nullable
  `template_row_id` pointing at the parent row, `overridden_fields` jsonb listing locally edited fields.
  Propagation is a background job that applies the parent diff to every child, skipping overridden fields.
- Never create per-brand Postgres columns. Structural changes are migrations that apply to every brand;
  per-brand visibility lives in a `brand_field_overrides` table.
- State machines are code in `packages/domain/state`. The UI reads allowed transitions from there.
- Naming formulas are pure functions in `packages/domain/naming`, unit tested with fixtures.
- Notifications flow through one `dispatch(event, payload)`; Slack, email and in-app are subscribers.
- Never call an external API from a request handler. Enqueue an Inngest job and return.
- Every table has `id`, `brand_id` (nullable on global tables), `created_at`, `updated_at`, `created_by`,
  `updated_by`, `deleted_at` (soft delete). No exceptions. Use the shared column helper in `packages/db`.
- No shared mutable module state. A singleton is a bug.
- If a test needs more than three lines of setup, refactor the code, not the test.
- No `process.env` access outside `packages/env`. Lint enforces this.
- Every mutation goes through a domain function; components never contain business logic.

## Definition of Done (the reviewer enforces every line)

- All acceptance criteria in the ticket are met.
- `pnpm typecheck`, `pnpm lint` (zero warnings), `pnpm test` pass from the repo root.
- Unit tests for every new pure function, state transition and naming formula.
- E2E test for every new user-facing flow that crosses a page boundary.
- Every new query is scoped by `brand_id` where applicable, proven by a targeted test.
- Every new mutation goes through a domain function, not raw Drizzle.
- The ticket links the PRD section it satisfies.
- No `TODO`, no `FIXME`, no `any` without a written justification comment.
- No new dependency without a note in `docs/decisions.md`. Any new hosted service is flagged with its cost.
- Diff under 300 lines of code (tests excluded from the count). Bigger means the ticket must be split.

## Conventions

- Node 24 (`.node-version`), pnpm 12 via corepack (`packageManager` in root `package.json`). Never npm or yarn.
- Root scripts, all through Turborepo: `pnpm dev`, `build`, `typecheck`, `lint`, `test`, `test:e2e`.
- Never run `pnpm install` from two agents at once (lockfile race). Serialize dependency changes.
- Commit message format: `TICKET-00X: <imperative summary>`, body optional, then
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Commit only after QA and review approve.
- Soft delete only. Never `DELETE FROM` a data table.
- IDs are `uuid` with `defaultRandom()`. Timestamps are `timestamptz`.
- File and symbol names: kebab-case files, camelCase functions, PascalCase types and components.
- Tests live next to the code as `*.test.ts`; E2E under `apps/web/e2e/*.spec.ts`.
- Secrets never enter the repo. `.env.example` lists every variable with a comment. `.env*` is gitignored.

## Branching and release (rule since 2026-10-09)

- `main` is the only branch. Work directly on `main`; do not create feature branches. `main` deploys
  production (Vercel builds every push).
- Everything that matters lives on `origin/main` (rule since 2026-10-10): push after every green commit;
  no local branches, no worktrees, no stashes, no untracked work left on a machine. If a change is not
  ready to push, it is not ready to write. A one-off script is deleted after it runs; its output goes
  into the commit message or `docs/decisions.md`.
- Before EVERY push to `main`, from the repo root: `pnpm typecheck`, `pnpm lint`, `pnpm test`, and
  `pnpm --filter @tas/web build:ci` (the prerender must pass). A push with any of the four red is a
  production incident.
- Any migration must be applied to Railway with its `packages/db/applyNN.mjs` BEFORE the push that
  needs it (`cd packages/db && DATABASE_URL=… node applyNN.mjs`). Production code must never reach
  Vercel ahead of the column it reads. Never `pnpm db:migrate` against Railway: the drizzle-kit
  journal is out of sync; the apply scripts are the only path.
- Migration numbers are hand-assigned and contiguous (`NNNN_<slug>.sql` + a journal entry with the
  same tag); check the last number in `packages/db/drizzle` before adding one.

## Current state (as of 2026-10-10, main at fcb148c + B2 in flight)

What is live in production (Railway Postgres, Vercel on every push to `main`):

- **Single source of truth for creatives**: the Creative Sheet is a view over `creative_briefs`
  (migration 0061). `creative_sheet_items` and `creative_dimensions` are FROZEN (no reader, no writer,
  `frozen-tables.test.ts` fails the suite on a new import); the drop is a later migration after Talal.
- **Names**: every one of the 397 live briefs is `name_mode = 'manual'`; the formula runs at CREATE only
  (`createBriefAction`), a concept rename cascades only to `auto` rows (`renameBrief`), and the brief
  page shows `creative_briefs.name` verbatim. Never recompute a name on a display path.
- **Dimensions** live in `creative_briefs.dimensions` (jsonb string[]). Production holds two spellings
  — 354 briefs with Airtable placement names (`Facebook Reels`), ~8 with ratios — and the code reads
  both through `normalizeCreativeDimensions`; a one-time normalisation is a pending data decision.
  The brief page's picker saves ONE change per tick, merged on the server under the brief's advisory
  lock (`updateBriefDimensionsWith` + `applyDimensionChange`).
- **One client vocabulary**: `CLIENT_STATUS` (six keys) is the client track everywhere.
  `concepts.client_approval_status` and `copywriting.client_approval_status` carry the same keys
  (code-level, no migration; every row was NULL). `creators.client_status` is the creator track and is
  untouched; `creators.client_approval_status` is unused until the frozen-tables drop.
- **Client portal**: the token gate lives in `app/client/[brandSlug]/(portal)/layout.tsx`;
  `auth/page.tsx` sits beside the group (a layout beside `auth` loops the redirect —
  `portal-gate.test.ts` pins this). The template custom pages `internal-queue` and `client-queue` are
  HIDDEN (`is_visible = false`, F1 containment); an empty `column_config` is refused at the write path.
- **Brands in production**: the template (`creative-hub-template`), Niagara, Mattress Central, Gratsi
  (390 briefs, 102 concepts, 71 creators, its own `creative_briefs.language` column definition),
  Funky Painting. The stray `test` brand is soft-deleted. No FIXD / KillenFrog / Killen Academy brand
  exists yet; `custom_field_schemas` is empty; `propagation_runs` was empty until B3 — nothing has
  ever propagated to a client brand, and nothing is scheduled to (no cron, no job runner package).
- **Migrations applied on Railway**: through 0062 (`custom_interface_pages.page_kind / module_key /
  template_row_id / overridden_fields`). Apply scripts are `packages/db/applyNN.mjs`, never
  `db:migrate`.

In flight — Scope A of `docs/designs/client-interface-config-2026-10-10.md` (ticket
`docs/tickets/in-progress/sprint-oct10-smoke-fixes.md` holds the Oct 10 fixes; the Oct 7 audit is in
`docs/decisions.md` 2026-10-10 entries):

- B2 client column allow-list on `loadCustomPageRows` (`packages/db/src/client-columns.ts`; rows are
  projected to allowed Postgres-named keys — `internal_*`, costs, prices, QA ticks never leave it).
- B3 template page pushes go through `promotion_requests` (Admin approves on `/app/propagation`,
  approval runs `propagateCustomInterfacePageToChildren` under a `propagation_runs` row); the direct
  push path is gone. Admin only may push; CSM may toggle per brand.
- B4 Interface Config "Pages" section + migration 0063 (the four `interface_tab_visibility` template
  rows and `calendar` become `page_kind = 'standard'` rows; `interface_pages.enabled` is read from
  them). 0063 ships alone, is applied on Railway, then the UI code.
- B5 Partnership Ads Tracking as the first `module` page (`source_table_key = creators`, filter
  `for_partnership_ads = true`, the PRD §5.8.1 columns WITHOUT `partnership_price_per_30_days`),
  enabled on Gratsi only.
- B6 (separate session, after a week live): delete `/app/queue/*`, replace `client-queue` with a
  standard "Approvals" page, hard-delete the hidden `internal-queue` row.

Open, needing the human: SMOKE-08 closed as PASS (no code); `UPLOAD-PUBLIC-ROUTE` (no public route
accepts a file against an `upload_links` token); the dimensions data normalisation; the FIXD /
KillenFrog per-client column work (Tier C, one at a time, Talal's go each); the `claude/ai-cleanup`
worktree (uncommitted brand-gradient work, unclassified); the `.audit-oct8/` and `.audit-oct9/`
scratch folders (untracked, 3.6 MB, importer and audit outputs).

Operating lessons that cost time this sprint: run `git reset` before each commit and chain commits
with `&&` (lint-staged stashes unstaged edits on partially staged files and a rejected commit leaves
the index staged); edit nothing while a gate run is in flight; stale `apps/web/.next/types` can fail
typecheck after a route is deleted (`rm -rf apps/web/.next/types`); pg scripts must run from
`packages/db` to resolve `pg`; `DATABASE_URL` for Railway is in the live repo's `.env.local`.

## UI governance (design system, from the 2026-09-16 handoff)

Every UI ticket after TICKET-DS-01..05 must, in this order, and the reviewer rejects any diff that breaks one:

1. Import colours, fonts and radii from the token layer (`packages/ui/src/styles/tokens.css` through the
   Tailwind semantic classes `bg-surface`, `text-text2`, `border-line`, `bg-accent`, `text-ok`, `font-mono`,
   `rounded-input`, `rounded-card`, …). Never a hex value, never `rounded-full` on a button.
2. Import status values from `@tas/domain/state` (`INTERNAL_VIDEO_STATUS`, `INTERNAL_STATIC_STATUS`,
   `CLIENT_STATUS`, `isClientTrackOpen`, `chipTone`, `stepState`). Never a magic string.
3. Import `StatusChip` and `StepRow` from `@tas/ui` (`packages/ui/src/status/`). Never re-implement a
   status pill or a stepper row.
4. Render every new primitive or status-bearing component on the `/design-system` page (as a story in a
   `*.stories.tsx` module the page mounts) before the ticket can be Done.

The `/design-system` page is the single source of truth for anyone who touches UI. Auto-generated system
output (concept names, creative names, IDs) always renders in `font-mono`.

## Credential status (as of 2026-09-16)

No credentials exist on the development machine for Neon, Clerk, Slack, Resend, Inngest, R2 or the
Anthropic API. Code must be fully env-driven, unit tests must run without any of them, and every
acceptance criterion that needs a live service is verified with a local substitute (PGlite for Postgres)
and listed under "Pending human verification" in `docs/runbook.md`.

## Agent roles

planner (tickets) · schema (`packages/db` only) · backend (Server Actions, domain, integrations) ·
frontend (pages, components; no business logic) · integrator (auth wiring, tenant helpers, env,
middleware, feature flags, review queue) · migrator (`packages/integrations/airtable`, `scripts/`) ·
qa (runs the checks, reports exact output) · reviewer (PRD section + diff, approve or numbered changes).
Stay inside your role's files. If a ticket needs two roles it says so and the stages run in order.
