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

## Pending human verification

Items whose acceptance criteria are gated on credentials (see D-008). Each line gives the exact command.

- TICKET-003 · migration and seed against a Neon preview branch (verified on PGlite by
  `packages/db/src/seed.test.ts`). With the preview branch's connection string in `.env.local` as
  `DATABASE_URL`, or exported in the shell:
  `pnpm --filter @tas/db db:migrate && pnpm --filter @tas/db db:seed`
  As a one-liner the variable must be given to both commands (`VAR=x a && b` only sets it for `a`):
  `DATABASE_URL=<neon preview> pnpm --filter @tas/db db:migrate && DATABASE_URL=<neon preview> pnpm --filter @tas/db db:seed`
  Expected: `Migrations applied from .../packages/db/drizzle`, then `Seeded health_check <uuid>`, and
  one row in `health_check` on the branch.
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
5. `pnpm --filter @tas/db db:seed` inserts the seed rows (today: one `health_check` row per run).

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
