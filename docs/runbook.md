# Runbook

## Prerequisites

- Node 24 (`.node-version`). pnpm 12 through corepack: `corepack enable --install-directory ~/.local/bin pnpm`.
- No local Postgres is needed. Unit tests use PGlite. `pnpm dev` against a real database needs `DATABASE_URL`.

## Everyday commands (repo root)

```bash
pnpm install
pnpm dev          # Next.js app
pnpm typecheck
pnpm lint
pnpm test         # Vitest, all packages
pnpm test:e2e     # Playwright
pnpm build
```

## Credentials the platform needs

| Variable | Service | Who provides | Needed from |
| --- | --- | --- | --- |
| `DATABASE_URL` | Neon (main branch) | Human creates the Neon project | TICKET-003 |
| `DATABASE_URL` (preview) | Neon preview branch | Human | TICKET-003 |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk, organisations enabled | Human | TICKET-004 |
| `SLACK_BOT_TOKEN` | Existing TAS Bot app | Human | Phase 5 |
| `RESEND_API_KEY` | Resend | Human | Phase 5 |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Inngest | Human | Phase 2 |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Cloudflare R2 | Human | Phase 4 |
| `ANTHROPIC_API_KEY` | Anthropic | Human | Phase 5 |
| `AIRTABLE_PAT` | Airtable, read access to Creative Hub bases | Human | Phase 6 |

Never paste secrets into the repo or into chat. Put them in `.env.local` (gitignored).

## Authentication (Clerk)

Without `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in the process environment the app runs identity-less
(D-013): `/` and the sign-in and sign-up pages respond, every `/app` path redirects to `/sign-in`, and
`/sign-in` says what is missing. Clerk's SDK reads both keys from the process environment and `next dev`
loads only `apps/web/.env*`, so for `pnpm dev` put the pair in `apps/web/.env.local` (gitignored, never
committed) or export it in the shell; the repo-root `.env.local` cannot switch Clerk on and keeps
`DATABASE_URL` for `@tas/env` and the db scripts (D-011). With the key set, `CLERK_SECRET_KEY` and a
valid `DATABASE_URL` must be set too. Restart `pnpm dev` after changing them. Root scripts run through
Turborepo, whose strict environment mode hands a task only the variables `turbo.json` declares:
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` and `DATABASE_URL` are passed through to
`dev` and `test:e2e` (D-013), so a shell export reaches them; any other variable exported for a Turbo
task must be added there first.

## Playwright live mode

The demo-mode suite needs no credentials. The Clerk-gated specs (the Start block in
`apps/web/e2e/briefs-editor.spec.ts`) run only when all four live-mode variables are set, named
exactly as the repository secrets. Add them in GitHub → Settings → Secrets and variables → Actions →
Repository secrets; locally export the same four names for one run and never write them to a file
in the repo:

| Secret | What it holds |
| --- | --- |
| `CLERK_PUBLISHABLE_KEY_TEST` | Publishable key of the Clerk **development** instance used for E2E (never production). |
| `CLERK_SECRET_KEY_TEST` | Secret key of the same instance; `@clerk/testing` mints the testing token with it. |
| `CLERK_E2E_USER_PASSWORD` | Password of the pre-created E2E user, `tas-e2e+clerk_test@example.com` (override the address with the non-secret `CLERK_E2E_USER_EMAIL`). |
| `DATABASE_URL_E2E` | Connection string of a Neon branch seeded with `pnpm --filter @tas/db db:seed`; the live tests write to it and reset what they changed. |

Set all four or none. With none the suite runs in demo mode and the live tests report themselves
skipped (D-008); with some of them `liveE2eEnv()` (`apps/web/src/lib/live-e2e-env.ts`) fails the run
naming the missing ones, so a secret that was never added cannot turn into a silent skip.

One-time setup on the Clerk dev instance: create the user above with that password, and make them a
member of the organisation that maps to the seeded brand (`agencies.clerk_org_id`), so `/app` opens
on data the Start test can act on. `apps/web/e2e/support/clerk-login.ts` signs that user in once per
Playwright worker (testing token + password strategy) and reuses the saved storage state under
`test-results/.auth/` (gitignored) for every page of that worker. The Start test snapshots the brief
it picks and restores status, assignee and activity rows in `afterEach` whether it passed or not.

Run: `CLERK_PUBLISHABLE_KEY_TEST=… CLERK_SECRET_KEY_TEST=… CLERK_E2E_USER_PASSWORD=… DATABASE_URL_E2E=… pnpm test:e2e`
(Turbo passes exactly these names through to the Playwright task, `turbo.json`).

## Pending human verification

Items whose acceptance criteria are gated on credentials (see D-008). Each line gives the exact command.

- Sprints 7–10 (2026-10-01) · apply migrations `0040_user-table-views`, `0041_creator-showcase-videos`,
  `0042_activity-log` and `0043_brief-due-date` to production before deploying:
  `pnpm --filter @tas/db migrate-prod -- --dry-run` then `pnpm --filter @tas/db migrate-prod -- --apply`.
  All four are verified on PGlite by the full suite; none has been applied to Neon.
- VIEWS-01 · as two different Clerk users on the same brand, create a view on `/app/angles`, hide a
  field, reload: the field stays hidden for that user and visible for the other.
- VIEWS-04 · with R2 credentials set, upload a showcase video from a creator's panel and play it inline.
- LINK-01 · link a creator from a concept, open the creator's panel and see the concept; unlink from
  the creator and see it leave the concept.
- EDIT-02/03 · with Clerk keys, run `npx playwright test apps/web/e2e/briefs-editor.spec.ts`: Start an
  Incoming brief, see it move to Under Editing, see the activity log name the status change and you.

- PARITY-29 · apply migration `0039_gratsi-field-parity` to production before deploying the commit that
  reads the new columns: `pnpm --filter @tas/db migrate-prod -- --dry-run` (prints the pending
  statements, writes nothing) then `pnpm --filter @tas/db migrate-prod -- --apply`. Verified on PGlite by
  the full suite; the live apply needs the human's go-ahead because it writes to prod.
- PARITY-29 · sign in to tallas-tas-pi.vercel.app after the deploy and read the sidebar: Overview ·
  Strategy (Angles, Concepts, Personas, Themes, Products, Collections) · Production (Creative Design,
  Creative Sheet, Creative Modules, UGC Management, Client Assets, Creative Dimensions) · Copy (Meta
  Copywriting, YouTube Copywriting, Copy Types) · Campaigns (Campaigns & Offers, Email Campaigns, Email
  Flows, SM Campaign Feed) · Reporting (Creative Reporting, Competitive Research). The demo-mode
  Playwright spec `apps/web/e2e/module-parity.spec.ts` asserts the same labels; the agent cannot sign in.

- D-031 · co-locate the database with the functions (the largest remaining latency win). In Railway,
  open the Postgres service → Settings → Region. If it is not europe-west4, either move it there and keep
  `apps/web/vercel.json` at `"regions": ["fra1"]`, or set `regions` to the matching Vercel region (`iad1`
  for us-east4, `sfo1` for us-west2). Expected: `/client/<missing-slug>` server time drops from about
  1.2 s toward `/sign-in`'s ~0.35 s.
- D-031 · confirm `DATABASE_URL` in Vercel ends with `?sslmode=require`. Without it `createNodeDb` connects
  without TLS and the Vercel-to-Railway traffic is unencrypted on the public internet.
- TICKET-003 · migration and seed against a Neon preview branch (verified on PGlite by
  `packages/db/src/seed.test.ts`). With the preview branch's connection string in `.env.local` as
  `DATABASE_URL`, or exported in the shell:
  `pnpm --filter @tas/db db:migrate && pnpm --filter @tas/db db:seed`
  As a one-liner the variable must be given to both commands (`VAR=x a && b` only sets it for `a`):
  `DATABASE_URL=<neon preview> pnpm --filter @tas/db db:migrate && DATABASE_URL=<neon preview> pnpm --filter @tas/db db:seed`
  Expected: `Migrations applied from .../packages/db/drizzle`, then `Seeded healthCheck <uuid>` (one of
  the eight seed lines, TICKET-005 below), and one row in `health_check` on the branch.
- TICKET-005 · tenancy migration `0001_tenancy` and seed against a Neon preview branch (verified on PGlite
  by `packages/db/src/schema/tenancy-tables.test.ts` and `packages/db/src/seed.test.ts`). Same command as
  the TICKET-003 item above. Expected: eight `Seeded <key> <uuid>` lines, one per `SeedResult` key
  (`agency`, `templateBrand`, `childBrand`, `admin`, `strategist`, `adminMembership`,
  `strategistAssignment`, `healthCheck`). On the branch: enums `agency_role`, `brand_role`,
  `brand_status`; tables `agencies`, `brands`, `users`, `memberships`, `brand_assignments`. The seed is
  plain inserts: a second `db:seed` on the same branch fails on `agencies_slug_unique` and writes nothing.
- TICKET-004 · Clerk sign-up and organisation creation E2E (`apps/web/e2e/auth.spec.ts`, second test; the
  first, `/app` signed out lands on `/sign-in`, runs on every `pnpm test:e2e` and passes without keys).
  Needs a Clerk **development** instance (`pk_test_…`, `sk_test_…`) with organisations enabled, and a
  valid `DATABASE_URL` (the middleware validates the whole server environment). With `DATABASE_URL`
  in the repo-root `.env.local` (or exported) and the Clerk pair exported in the shell (`turbo.json`
  passes all three through Turborepo's strict environment mode to `test:e2e`, D-013; Playwright's own
  process gates the test on the pair and passes it to the dev server it starts; `apps/web/.env.local`
  is not read for the gate):
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<pk_test…> CLERK_SECRET_KEY=<sk_test…> pnpm test:e2e`
  Stop any dev server on port 3000 first: Playwright reuses a running one, which started without the
  keys. Expected: `3 passed`, with the line "signs up, creates an organisation and lands on /app showing
  its name" marked ✓ rather than `-` (skipped).
  Plumbing check that needs no real keys (proves the variables reach Playwright and the dev server):
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk CLERK_SECRET_KEY=sk_test_x DATABASE_URL=postgres://x pnpm test:e2e`
  must fail in `clerkSetup` (`Failed to fetch testing token from Clerk API`, Clerk rejects the secret)
  instead of reporting the second test as `-` skipped. That publishable key is `pk_test_` plus the
  base64 of `example.clerk.accounts.dev$`, the shape Clerk's SDK checks at start-up; a malformed one
  such as `pk_test_x` makes every request fail and Playwright times out waiting for the dev server.
  The run leaves a `tas-e2e-<stamp>+clerk_test@example.com` user and a `TAS Digital E2E <stamp>`
  organisation on the instance; delete them in the Clerk dashboard.
  The sign-up step assumes the instance defaults: email address + password sign-up, verified by an
  email code (the `+clerk_test` address accepts `424242`).
  Manual check after that: `pnpm dev`, sign up at `/sign-up`, create the agency organisation from the
  switcher on `/app`, and confirm the page shows your name and the organisation name.
- Brand resolution from a real session (`resolveLiveBrand` in `apps/web/src/lib/data-source.ts`). The
  single resolver maps the actor's active Clerk Organization to `agencies.clerk_org_id`, falls back to
  the person's `memberships` row, and throws `AmbiguousBrandError` rather than guessing when more than
  one agency is in scope with no actor. Every branch is unit tested with an injected `actorScope`
  (`apps/web/src/lib/data-source.test.ts`), but the production default reads Clerk's `auth()`, which
  needs keys. With the Clerk pair and a seeded `DATABASE_URL` exported: `pnpm dev`, sign in, and confirm
  `/app` names the seeded brand. Expected once a second agency exists on the branch: a signed-in member
  of agency A still sees only agency A's brand, and a request with no organisation selected fails loudly
  with `AmbiguousBrandError` instead of rendering the other tenant's workspace.

## Local dev gotchas

- **Node via Herd.** `~/.zshrc` loads Herd's own nvm (`NVM_DIR` under `Library/Application Support/Herd`), so
  the active `node` is whatever Herd last selected, not the repo's `.node-version` (24). Check `node -v`
  before `pnpm install`; the system Node 24 lives in `/usr/local/bin`. A `cd` into the repo does not change
  PATH (verified 2026-09-16), so nothing rewrites your shell on entry.
- **Background processes in the Claude Code Bash tool.** After a command launches a server with `&` (for
  example `next start … &`), every later command in the same tool call can fail with `command not found`
  for `curl`, `sed`, `tail`: the tool's shell loses PATH. Use absolute paths (`/usr/bin/curl`,
  `/usr/bin/git`, `/Users/macbook/.local/bin/pnpm`) or the tool's own `run_in_background` option. Plain
  terminals are unaffected.
- **pnpm.** `pnpm` is a corepack shim in `~/.local/bin`; never `npm install -g pnpm`. pnpm 12 refuses
  packages younger than its release-age gate; wait rather than bypass it (TICKET-001 review).
- **PGlite tests boot Postgres.** The first test of each `@tas/db` file takes 4–10 s under load;
  `testTimeout` is 30 s. If `pnpm test` flakes on a busy machine, close the Electron apps and rerun.

## Deploy (Vercel)

The Next.js app lives in `apps/web`, so the Vercel project must build from that directory. One-time
project settings in the Vercel dashboard (they cannot be set from the repository):

1. **Root Directory** = `apps/web`, with "Include source files outside of the Root Directory" enabled
   (the app imports `packages/*`). Vercel detects the pnpm workspace and installs at the repository root.
2. Framework preset Next.js; build and install commands come from `apps/web/vercel.json`.
3. Node.js version 24.x (silences the `engines` auto-upgrade warning).
4. Production branch `main`; every pull request gets a preview deployment.

Environment variables (Settings → Environment Variables): none are required for the first deploy. Without
them the app runs identity-less: `/` renders, every private route redirects to `/sign-in`, and the Clerk
sign-in screen needs the two Clerk keys to work. Set, when available:

| Variable | Scope | Note |
| --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Production, Preview | switches the auth layer on (D-013) |
| `CLERK_SECRET_KEY` | Production, Preview | must be set together with the publishable key |
| `DATABASE_URL` | Production, Preview | Neon; required once the publishable key is set (D-013) |
| `E2E_AUTH_BYPASS` | never on Vercel | test-only sign-in (TICKET-012b) |

Redeploy after changing variables. The first deployment was configured by hand on 2026-09-16
(decision D-026); TICKET-007 completes the deploy skeleton.

## Airtable schema-parity gate

`node scripts/airtable-parity.mjs` (needs `AIRTABLE_PAT` in `.env.local`) reads the LIVE Gratsi base's
metadata and fails on any table or stored field that is neither mapped in
`packages/db/src/scripts/import-mappings.ts`, nor a record link whose inverse field is mapped, nor
named in the exclusion register in `docs/decisions.md` (2026-10-01). Re-run it whenever the base gains a
field or a table; `--verbose` prints every field's verdict, `--base <id>` points it at another base.

## Migrations

The schema is TypeScript in `packages/db/src/schema/*.ts`; every table spreads `baseColumns()` from
`packages/db/src/columns.ts` (`id`, `brand_id`, `created_at`, `updated_at`, `created_by`, `updated_by`,
`deleted_at`). Migrations are SQL files under `packages/db/drizzle/`, generated by drizzle-kit and
committed together with the schema change. Never hand-edit a generated `.sql` file or `drizzle/meta/`;
change the schema and generate again.

1. Edit the schema. New tables are exported from `packages/db/src/schema/index.ts`.
2. `pnpm --filter @tas/db db:generate --name <short_name>` writes `drizzle/NNNN_<short_name>.sql` and
   updates `drizzle/meta/`. Needs no database. Read the SQL before committing it.
3. `pnpm test` applies every migration to PGlite through `testDb()` (`@tas/db/testing`), so a broken
   migration fails locally before it reaches Neon.
4. `pnpm --filter @tas/db db:migrate` applies the pending migrations to `DATABASE_URL`. Drizzle records
   applied migrations in `drizzle.__drizzle_migrations`, so the command is safe to repeat. Run it against
   a preview branch first, then main.
5. `pnpm --filter @tas/db db:seed` inserts the seed rows once per fresh database: the tenancy set (agency
   `tas-digital`, template brand `creative-hub-template`, child brand `demo-brand`, an admin with a
   membership, a strategist assigned to the child) and one `health_check` row, as plain inserts. A repeat
   run fails on `agencies_slug_unique` and writes nothing (TICKET-005).

`db:migrate` and `db:seed` read `DATABASE_URL` through `@tas/env`: from the shell, or from the repo-root
`.env.local` in development. They run through `tsx`, a dev dependency, so they need a full
`pnpm install`, not a production-only one. The production driver only reaches Neon (D-012); there is no
local Postgres (D-005).

Tests get a database in one line: `const db = await testDb();` returns a fresh in-memory PGlite with
every migration applied. Application code gets one from `createNeonDb(databaseUrl)` (or `createDb(client)`
with an existing pool) and types it as `Db`; no module-level instance exists anywhere.

## Rolling a schema change out to every brand

(filled in Phase 2)

## Backup and restore

(Phase 7: Neon point-in-time restore procedure)

## Secrets rotation

(Phase 7)
