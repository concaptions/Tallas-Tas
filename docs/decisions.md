# Architectural decisions

Append-only. Newest at the bottom. Format: ID, date, decision, why, consequences.

## D-001 · 2026-09-16 · PRD source and conversion

The PRD is `C_PRD___TAS_Creative_Platform_v1.docx` (Talal Abulshamat, TAS Digital, 10 September 2026),
found on the dev machine and stored as `docs/prd-assets/PRD-v1-original.docx`. `docs/PRD.md` is a
formatting-only conversion (headings, lists, tables, hyperlinks, two images). The author's section numbers
are kept and are what tickets cite. The Airtable bases the PRD references ("TAS Digital Creative Hub
Template version 5.1", "Niagara Sleep Solutions") are not reachable from this machine's Airtable
connection, which only exposes an unrelated base. Migration work (Phase 6) needs access granted.

## D-002 · 2026-09-16 · Ticket files

`docs/tickets/backlog.md` is the ordered index. Ticket bodies are one file each under
`docs/tickets/backlog/`, moved with `git mv` to `in-progress/` and then `done/`. A ticket names its
owning role(s); a two-role ticket lists build stages that run in order.

## D-003 · 2026-09-16 · Clerk tenancy model

One Clerk Organization represents the agency (TAS Digital). Brands are rows in our database, never Clerk
orgs. Internal team members are org members; their real permissions come from `memberships` (agency role)
and `brand_assignments` (per-brand role). Clients are ordinary Clerk users with no org membership; their
access is resolved solely from `brand_assignments` rows with role `client`. Why: keeps the whole
authorization model in our schema (tenancy at the query layer), keeps Clerk usage inside the free tier
(one organisation), and avoids exposing Clerk's org UI to clients. Revisit only if a client needs
org-level Clerk features.

## D-004 · 2026-09-16 · `packages/env` added to the layout

The brief lists db, domain, integrations and ui packages and requires one zod-validated environment
loader with no `process.env` access elsewhere. db, integrations and web all need it, so it becomes its
own package `@tas/env` rather than living inside one consumer. Lint rule `no-restricted-properties`
blocks `process.env` outside it.

## D-005 · 2026-09-16 · PGlite for database tests, driver factory for production

No Postgres or Docker exists on the development machine. Unit tests for `@tas/db` run on
`@electric-sql/pglite` through `drizzle-orm/pglite`, applying the real generated migrations. Production
code receives its client through `createDb(...)`, so the same schema and queries run against Neon. The
production driver must support transactions (propagation and promotion approval need them).

## D-006 · 2026-09-16 · Cost envelope (to be confirmed by the human)

| Service | Plan assumed | Annual USD | Note |
| --- | --- | --- | --- |
| Vercel | Pro, 1 seat | 240 | Hobby plan forbids commercial use |
| Clerk | Free | 0 | assumes ≤10k MAU and ≤100 monthly active orgs; D-003 uses one org |
| Neon | Free | 0 | scale-to-zero; revisit if compute hours exceed the free quota |
| Cloudflare R2 | Pay as you go | 0–40 | 10 GB free; Airtable attachments may exceed it |
| Inngest | Free | 0 | free tier run quota |
| Resend | Free | 0 | 3k emails/month |
| Anthropic API | Pay as you go | 20–60 | spell checker only |
| **Total** |  | **≈260–340** | under the 500 USD ceiling |

Open: the PRD (§17 q5) mentions Cloudflare and Railway. Vercel is kept per the brief; Cloudflare Workers
via OpenNext would cut the Vercel line to ~60 USD if the human prefers it.

## D-007 · 2026-09-16 · Next.js pinned to 15.x

The brief specifies Next.js 15 with React 19. `apps/web` pins `next@15` even if a newer major is
published. Upgrade is a Phase 7 hardening ticket.

## D-008 · 2026-09-16 · Environment-gated acceptance criteria

Some kickoff acceptance criteria need live services that have no credentials yet (Neon preview branch,
Clerk sign-up). Those criteria are satisfied in code, verified against a local substitute where one exists,
and the live check is recorded under "Pending human verification" in `docs/runbook.md` with the exact
command to run once credentials exist. The ticket file states which criteria are gated. A ticket can move
to `done/` with gated criteria only when everything else in the Definition of Done is met and the gated
items are listed.

## D-009 · 2026-09-16 · Bootstrap tooling (TICKET-001)

Root dev dependencies, exact major pinned, minor and patch float with caret:

- `turbo` 2: task pipeline and caching across the pnpm workspace.
- `typescript` 5: compiler. Major 5 because typescript-eslint 8 supports `<6.1.0` and Next.js 15
  (D-007) is tested against 5.x; the TypeScript 6/7 upgrade is a Phase 7 hardening item.
- `@types/node` 24: Node typings for the root config files.
- `eslint` 10 and `@eslint/js` 10: flat config and the core recommended rules.
- `typescript-eslint` 8: strict-type-checked rules through `projectService`; typed lint is cheap on
  this tree. `no-restricted-properties` blocks `process.env` outside `packages/env/**` (D-004).
- `eslint-config-prettier` 10: switches off formatting rules that would fight Prettier.
- `prettier` 3: formatter.
- `vitest` 4: unit runner; the root config discovers `packages/*` and `apps/*` as projects. Vitest 5.0
  shipped on 2026-09-03; major 4 stays until it has settled, the `projects` API is the same.
- `@playwright/test` 1: E2E runner configured at the root, tests under `apps/web/e2e`.
- `husky` 9 and `lint-staged` 17: pre-commit runs Prettier on staged files and ESLint on staged
  ts/tsx.

Conventions fixed by this ticket:

- Root scripts run through Turborepo. Root-level tools are Turborepo root tasks (`//#lint:root`,
  `//#test:root`, `//#test:e2e:root`, `//#typecheck:root`), the pattern Turborepo documents; they
  are uncached because they read files from every package. Packages provide `typecheck`, `build`
  and `dev` scripts. `lint`, `test` and `test:e2e` run once at the root: root ESLint covers every
  package, root Vitest discovers each package's `vitest.config.ts`, Playwright reads
  `apps/web/e2e`. A package adds its own `lint` or `test` script only when it needs another runner.
- `exactOptionalPropertyTypes` stays off (comment in `tsconfig.base.json`): React, Next.js and
  third-party typings pass `undefined` to optional properties; the option adds friction with no
  safety payoff for this codebase.
- Every package sets `"type": "module"`; `verbatimModuleSyntax` requires ESM.
- Prettier skips `docs/` and `CLAUDE.md`: prose owned by the planner and the PRD author; Prettier's
  table padding would rewrite every table for no gain.
- Playwright declares `webServer` only when `apps/web/package.json` exists because it starts the
  server before it looks for tests. Vitest lists a workspace root only when it holds a package
  because it refuses a `projects` glob with no match.

## D-010 · 2026-09-16 · Web app scaffold (TICKET-002)

Dependencies added to `apps/web` (`@tas/web`), exact major pinned, minor and patch float with caret:

- `next` 15 (15.5.x): the App Router host (D-007). `eslint.ignoreDuringBuilds` is on: `next build`
  walks up to the root `eslint.config.js` and would run the same rules a second time; lint runs once
  at the root (D-009).
- `react` 19 and `react-dom` 19: the brief's React version; Next 15.5 lists `^19.0.0` as a peer.
- `@types/react` 19 and `@types/react-dom` 19: typings for the above.
- `tailwindcss` 4, `@tailwindcss/postcss` 4 and `postcss` 8: CSS-first Tailwind
  (`@import "tailwindcss"` in `src/app/globals.css`) through the PostCSS plugin Next.js supports.
- `clsx` 2 and `tailwind-merge` 3: the shadcn `cn` helper.
- `class-variance-authority` 0.7: variant props for shadcn components.
- `@radix-ui/react-slot` 1: `asChild` composition in the shadcn Button.

Conventions fixed by this ticket:

- shadcn/ui is set up by hand in the shape its manual installation documents (`components.json`
  style `new-york`, base colour neutral, CSS variables, `@/` aliases, `cn` in `src/lib/utils.ts`).
  The current CLI (`shadcn@4`) defaults to the Base UI preset and adds runtime packages (`shadcn`,
  `cn`, `radix-ui`, `lucide-react`, `tw-animate-css`) the ticket does not need. `components.json`
  stays valid for `shadcn add`. Chart and sidebar CSS variables are left out until a component needs
  them; the CLI adds them together with that component.
- Root `typescript`, `@types/node`, `vitest` and `@playwright/test` resolve from the root
  `node_modules`; the app does not list them again.
- `next-env.d.ts` is generated and references `.next/types/routes.d.ts`, so it is gitignored in
  `apps/web` and ignored by the root ESLint config (the one root file this ticket touches). The app's
  `typecheck` script runs `next typegen` before `tsc`, so `pnpm typecheck` passes on a fresh clone.
- `apps/web/tsconfig.json` extends the base and pre-sets every option Next.js would otherwise write
  back (`jsx`, `allowJs`, `incremental`, `lib`, the `next` plugin, `include`), so `next build` never
  rewrites it.
- `@next/eslint-plugin-next` is not added: root ESLint (D-009) already covers the app. It is a later
  tooling ticket if its rules earn their keep.

## D-011 · 2026-09-16 · Environment loader (TICKET-003, stage 1)

Dependencies added to `packages/env` (`@tas/env`), exact major pinned, minor and patch float with caret:

- `zod` 4: schema validation for every environment variable; also the validation library the brief
  assumes for forms and Server Action inputs, so no second validator arrives later.
- `dotenv` 17: only its `parse` function is used, on the repo-root `.env.local`. `dotenv.config()` is
  not called because it mutates `process.env`; the loader stays a pure function of its inputs.

Conventions fixed by this ticket:

- Validation is lazy: `serverEnv()` and `clientEnv()` validate when called, never at import. A call site
  that wants memoisation creates its own loader with `createEnv()`, whose cache lives in the returned
  closure. The package holds no module-level parsed environment.
- `.env.local` is read from the repo root, only when `NODE_ENV` is `development` (its default), and is
  merged *under* the process environment so a variable set in the shell or by the host always wins.
  `test` and `production` read the process environment alone.
- An empty value (`KEY=`) counts as unset, so a `.env.local` copied from `.env.example` behaves as
  "nothing configured" instead of failing every optional check.
- `@tas/env/client` is a second entry point with no Node imports. It reads each `NEXT_PUBLIC_*`
  variable through a literal `process.env.NAME` expression, the only form Next.js inlines into the
  browser bundle. `@tas/env` (server) re-exports `clientEnv` for server-side use.
- Clerk keys carry a prefix check (`pk_` publishable, `sk_` secret) because swapping them would ship
  the secret key to the browser. Other optional secrets are validated as non-empty strings only; vendor
  prefixes for those are not documented as stable.
- The package exposes its TypeScript source (`exports` points at `src/*.ts`) and has no build step.
  Relative imports stay extensionless, as in `apps/web`, so consumers are bundlers and TypeScript-aware
  loaders (Vitest, Next.js `transpilePackages`, drizzle-kit's config loader, `tsx` for scripts). Bare
  `node file.ts` cannot resolve extensionless imports and is not a supported way to run this package.
- Numbering: the ticket text names D-011 for stage 2's dependency list and production driver choice.
  Stage 1 ran first and took D-011, so stage 2 records those in D-012.

## D-012 · 2026-09-16 · Database package and production driver (TICKET-003, stage 2)

Dependencies added to `packages/db` (`@tas/db`), exact major pinned, minor and patch float with caret
(for the 0.x packages the caret floats patch only, which is what "pin the major" means before 1.0):

- `drizzle-orm` 0.45: the ORM the brief names. The 1.0 line is still beta (relations API rewrite); the
  upgrade is a Phase 7 hardening item.
- `drizzle-kit` 0.31 (dev): generates SQL migrations from the schema (`db:generate`). It does not apply
  them, see below.
- `@neondatabase/serverless` 1: the production driver, see below.
- `@electric-sql/pglite` 0.5 (dev): in-memory Postgres for tests (D-005), through `drizzle-orm/pglite`.
  Imported only from `src/pglite.ts` and `src/testing.ts`, exposed as the `@tas/db/testing` entry, so
  the app never bundles the WASM.
- `tsx` 4 (dev): runs `db:migrate` and `db:seed` (`src/scripts/*.ts`); bare Node cannot resolve the
  extensionless imports (D-011).
- `@tas/env` (workspace): read only by those two scripts. The library takes the URL or the client as a
  parameter and never touches the environment.

Root tooling side effects of these dependencies:

- `pnpm-workspace.yaml` gains `allowBuilds: { esbuild: false }`. drizzle-kit and tsx bundle esbuild,
  whose postinstall only validates the platform binary pnpm installs as an optional dependency; pnpm 12
  refuses to install while a build script is undecided, so the decision is recorded as "never run".
- `.prettierignore` gains `packages/db/drizzle/`: drizzle-kit's snapshot JSON is committed as written so
  a regenerate does not churn the diff.

Production driver: `@neondatabase/serverless` `Pool` through `drizzle-orm/neon-serverless`.

- Why: Neon's own driver for serverless runtimes (Vercel functions). It speaks the Postgres protocol
  over a WebSocket, so `db.transaction(...)` runs BEGIN/COMMIT on one connection, which propagation and
  promotion approval need (D-005). Node 22+ has a global `WebSocket`, so no `ws` polyfill. The same
  package also runs in Edge middleware if a later ticket needs it there.
- Rejected: `drizzle-orm/neon-http` (Neon's HTTP driver) is the fastest per query but has no
  interactive transactions. `pg` / `postgres.js` over TCP work against Neon and any Postgres, and are
  the swap if the WebSocket path misbehaves, but are not edge-compatible and gain nothing on Vercel.
- Consequence: `createNeonDb` only reaches Neon (or a host behind `neonConfig.wsProxy`). There is no
  local Postgres anyway (D-005).

Conventions fixed by this ticket:

- `createDb(client)` binds any client the Neon driver accepts (`Pool`, `PoolClient`, `Client`) to the
  schema; `createNeonDb(databaseUrl)` builds the pool for it. `createPgliteDb()` binds the PGlite driver
  to the same `drizzleConfig`. Consumers type against `Db` (`PgDatabase<PgQueryResultHKT, Schema>`),
  the common supertype of both, so a query or `withBrand` written once runs on either. No instance is
  created at module level; the scripts create theirs inside `main()` and end the pool.
- `baseColumns()` is a function returning fresh builders, not a shared object: a Drizzle builder mutates
  in place when a table chains `.references()` on it, so a shared object would leak one table's foreign
  key into the next.
- Migrations are applied by the driver-specific migrators reading one folder (`migrationsFolder` in
  `src/migrations.ts`): `drizzle-orm/pglite/migrator` inside `testDb()`, `drizzle-orm/neon-serverless/migrator`
  inside `db:migrate`. `drizzle-kit migrate` is not used because it needs the connection string inside
  `drizzle.config.ts`, which would make `db:generate` fail on a machine without credentials.
- Column names are written explicitly in snake_case (`uuid('brand_id')`) rather than through drizzle's
  `casing` option, so the SQL in `drizzle/` reads the same as the schema.
- Numbering: the ticket text names D-011 for this entry; stage 1 took D-011 (see its last bullet), so
  stage 2 is D-012.

## D-014 · 2026-10-01 · Playwright live mode signs in with Clerk Testing Tokens

Discovery and trade-offs: `docs/decisions/playwright-clerk-live-mode-2026-10-01.md`. Chosen: Clerk's
Testing Token (`@clerk/testing`, already a dev dependency since D-013) plus a pre-created user on the
dev instance signed in with the password strategy, once per Playwright worker, storage state reused
for that worker's pages (`apps/web/e2e/support/clerk-login.ts`). Rejected: sign-up per run (leaves a
user behind every run, and the org membership a seeded brand needs cannot be created from the
browser without a second write path) and bypass headers (not a Clerk feature; a header the app
honours is a backdoor).

Variables are named after the repository secrets (`CLERK_PUBLISHABLE_KEY_TEST`,
`CLERK_SECRET_KEY_TEST`, `CLERK_E2E_USER_PASSWORD`, `DATABASE_URL_E2E`, optional non-secret
`CLERK_E2E_USER_EMAIL`), validated in `@tas/env` like every other variable, and mapped to the app's
own names only on the launched dev server (`playwright.config.ts`), so a developer's `.env.local`
keys never reach an E2E run. All four or none: a partial set fails the run naming the missing ones,
so a test cannot be green locally and silently skipped in CI. Live specs sit in
`apps/web/e2e/live/` and run in a separate Playwright project against a second dev server (port
3001), so one `pnpm test:e2e` runs the demo suite and the live suite side by side; `.github/
workflows/e2e.yml` is the first CI workflow in the repo. No new dependency.

## D-013 · 2026-09-16 · Clerk auth wiring (TICKET-004)

Dependencies added to `apps/web` (`@tas/web`), exact major pinned, minor and patch float with caret:

- `@clerk/nextjs` 7: Clerk's Next.js SDK (`clerkMiddleware`, `ClerkProvider`, `SignIn`, `SignUp`,
  `OrganizationSwitcher`, `auth`, the client hooks). Peers satisfied: Next ^15.5.9, React ~19.3.
- `@clerk/testing` 2 (dev): Playwright helpers. `clerkSetup` fetches a testing token that bypasses bot
  protection, `clerk.loaded` waits for ClerkJS, and the `unstable` page objects drive Clerk's sign-up
  form and enter the test OTP `424242`.
- `@tas/env` (workspace): the app reads both Clerk keys through it (`clientEnv()` publishable,
  `serverEnv()` secret).

Conventions fixed by this ticket:

- `apps/web/src/middleware.ts` runs on the Node.js runtime (`export const config = { runtime: 'nodejs' }`,
  stable since Next 15.5): `serverEnv()` reads the repo-root `.env.local` with `node:fs`, which the
  Edge runtime cannot bundle. Vercel runs Node middleware as a function. `packages/env/src/server.ts`
  now builds that path with `path.resolve`; the previous `new URL(relative, import.meta.url)` is a
  webpack asset reference that fails the build when the file is absent.
- No-keys mode, the D-008 substitute: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in the process environment
  is the switch. Absent, the middleware itself sends every private path to `/sign-in` (nobody can hold
  a session), the root layout renders no `ClerkProvider` (so Clerk's keyless mode never starts) and
  the `(auth)` layout explains what is missing. Present, `CLERK_SECRET_KEY` is required and a missing
  one throws rather than running without auth. `pnpm dev` and the always-on E2E therefore work with
  no credentials. `serverEnv()` validates the whole server environment, so a configured Clerk needs a
  valid `DATABASE_URL` as well.
- The middleware hands `clerkMiddleware` only the publishable key. A `secretKey` option ("dynamic
  keys") makes the SDK encrypt it into a request header for the server components and throw without
  `CLERK_ENCRYPTION_KEY`, which the SDK reads from `process.env` alone, so it would add a variable and
  still depend on the process environment. Instead the SDK reads `CLERK_SECRET_KEY` from the process
  environment itself, the same variable `clerkKeys()` validated through `serverEnv()` before enabling
  Clerk. Consequence: the repo-root `.env.local` (D-011) cannot switch Clerk on for `next dev`, which
  loads only `apps/web/.env*`; locally the pair lives in `apps/web/.env.local` (gitignored) or the
  shell, in production in the host's variables. `DATABASE_URL` keeps working from the root file
  because `serverSource()` reads it with `node:fs`, also inside the Node middleware.
- Turborepo runs every task in strict environment mode (the Turbo 2 default; `turbo.json` sets no
  `envMode`), so a task's command sees only the variables declared for it plus Turbo's built-in
  pass-through set, which on turbo 2.10.13 includes `NEXT_PUBLIC_*` (observed with framework inference
  on and off) but not `CLERK_SECRET_KEY` or `DATABASE_URL`. A pair exported in the shell therefore
  reached `next dev` by half: the publishable key switched Clerk on, `clerkKeys()` threw on every
  request, and through `pnpm test:e2e` (`//#test:e2e:root` → Playwright → `pnpm --filter @tas/web dev`)
  the dev server never became ready. `turbo.json` now lists `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
  `CLERK_SECRET_KEY` and `DATABASE_URL` under `passThroughEnv` for `dev` and `//#test:e2e:root`
  (pass-through rather than `env`: both tasks are uncached, so nothing is hashed). `build`,
  `typecheck`, `lint` and `test` are unchanged: none reads the secret, and `next build` gets the
  publishable key through framework inference, hashed. Commands run with `pnpm --filter` or `pnpm exec`
  bypass Turbo and were never affected.
- The route matcher is our own pure `isPublicPath(pathname)` in `apps/web/src/lib/routes.ts`
  (`/`, `/sign-in(.*)`, `/sign-up(.*)` public, everything else protected). Clerk's `createRouteMatcher`
  is deprecated in v7 (removed in the next major) and typed lint rejects deprecated calls. The
  middleware `matcher` (static assets excluded) stays a literal in `middleware.ts` because Next reads
  it statically.
- The middleware builds the Clerk handler per request from the keys it just read; nothing is cached at
  module level.
- `/app` calls `auth.protect()` as the second line of defence and shows the user and the active
  organisation from Clerk's client session (`useUser`, `useOrganization`), not from `currentUser()` or
  the Backend API: no Clerk API call per page view, and the values follow the `OrganizationSwitcher`.
- `next.config.ts` lists `@tas/env` in `transpilePackages` (D-011) and bridges nothing: values in
  Next's `env` config are inlined into the browser bundle too, so it cannot carry the secret, and
  bridging only the publishable key from the root file would switch Clerk on while the SDK lacks the
  secret.
- Gated E2E: `test.skip(condition, reason)` inside a describe whose title also carries the reason,
  because the list reporter prints titles, not annotations. Playwright `globalSetup` calls `clerkSetup`
  only when keys exist. The test creates the organisation through `window.Clerk.createOrganization` +
  `setActive` (stable ClerkJS API) instead of the switcher's modal, whose copy changes between UI
  releases; the switcher's presence on `/app` is asserted.
- Numbering: the ticket text names D-012 for this entry; TICKET-003 stage 2 took it, so this is D-013.

## D-006a · 2026-09-16 · Cost envelope confirmed against vendor pages

Sources read on 2026-09-16: clerk.com/pricing, vercel.com/docs/plans/hobby, neon.com/pricing, inngest.com/pricing.

| Service | Verified free-tier terms | Consequence |
| --- | --- | --- |
| Clerk Free | 50,000 monthly retained users; Organizations included with 100 monthly retained orgs; **20 members per organization**; Pro 25 USD/mo; org "Enhanced" add-on 100 USD/mo | D-003 keeps clients out of the org. If the internal team passes 20, stop adding members to the Clerk org (authorization already lives in `memberships`/`brand_assignments`); never buy the Enhanced add-on |
| Vercel Hobby | "restricts users to non-commercial, personal use only"; Pro developer seat 20 USD/user/month | Pro with one developer seat: 240 USD/yr. Viewer seats are free |
| Neon Free | 100 CU-hours/project/month, 0.5 GB storage/project, 10 branches, scale-to-zero after 5 min, point-in-time restore window 6 hours (1 GB limit) | Fits at current team size. Backup runbook must state the 6-hour PITR window and add a nightly logical dump to R2. Launch plan is pay-as-you-go if compute exceeds 100 CU-hours |
| Inngest Free | 50k executions/month, 5 concurrent steps, 3 users, 500k events/month | Propagation must batch: one function run per parent transaction with one step per child brand at most, never one execution per row per brand. At 20 parent edits/day x 50 brands = 30k step executions/month, which is inside the tier only with batching |

Annual estimate stands at roughly 260-340 USD. Human decision still open: Vercel Pro (240) versus Cloudflare Workers via OpenNext (about 60), see PRD §17 q5.

## D-015 · 2026-09-16 · Design system source and adaptations

The design handoff (2026-09-16) named a bundled Claude Design artifact `TAS_Creative_Platform.html`
carrying the Two-Track Approval widget. The file was not present at the given path, anywhere on the dev
machine, among the Claude artifacts or in Drive. The handoff text itself carries the tokens, the status
arrays with descriptions, the gate rule and the widget's behavioural values, so TICKET-DS-01..05 are
built from it; only pixel geometry is deferred to a parity pass (TICKET-DS-03b) once the file arrives.

Adaptations, same outcome as the handoff asks:
- Tailwind 4 is CSS-first: tokens live in `packages/ui/src/styles/tokens.css` (raw `:root` variables plus
  `@theme inline` semantic mapping) imported by `apps/web/src/app/globals.css`; there is no
  `tailwind.config.ts`. shadcn variables alias the tokens so shadcn components inherit the palette.
- No Storybook dependency. Stories are CSF-compatible `*.stories.tsx` modules rendered by the
  `/design-system` pages; Playwright screenshots are the visual regression suite. Storybook can be added
  later without rewriting stories.
- Paths follow the repo layout: `apps/web/src/app/...`, `packages/domain/src/state/creative-status.ts`.
- The admin-only guard for `/design-system` needs `requireAdmin()` (TICKET-008), so TICKET-DS-05 runs
  after it; DS-01..04 run right after TICKET-012 (local PGlite stack + test session), which is what lets
  their Playwright tests run on this machine.

## Design system open questions

- DS-Q1 The artifact file: please re-share `TAS_Creative_Platform.html` (or its Claude artifact link) so
  the parity pass can run.
- DS-Q2 Light theme values for `--bg-deep`, `--ok`, `--warn`, `--bad`, `--info` are not specified; the dark
  values are reused.
- DS-Q3 Does `(On Hold)` need its own chip tone? Default: mute.
- DS-Q4 Static-track descriptions are not in the handoff; the video texts are reused with editor →
  designer, cut → design.
- DS-Q5 The `on_hold` description is not in the handoff; a placeholder text is used and marked.
- DS-Q6 `CLIENT_STATUS` in the handoff has no "Revisions Needed", but PRD §9 lists it and PRD §12 has the
  trigger "Client requested revisions". Implemented as handed off (three states). Recommendation: add
  `revisions_needed` (Pending for Approval → Revisions Needed → Pending for Approval) before the client
  interface ticket.

## D-021 · 2026-09-16 · Engine ledgers are operational logs

`propagation_outcomes`, `propagation_child_runs`,
`template_changes` and `engine_audit_log` may be hard-deleted by the retention job (TICKET-032b,
weekly Inngest cron) after 90 days; outcomes only when their conflicts are acknowledged or empty;
audit rows only when no run references them. The "soft delete only" rule protects business data
tables and does not apply to these. `propagation_runs` and `promotion_requests` are kept (small; the
approval trail I9 depends on them). Why: soft deletes reclaim nothing on Neon and the ledger would
consume the free storage within two years (design §3.6, §5.5).

## D-022 · 2026-09-16 · Package direction `@tas/db → @tas/domain`

`@tas/domain` defines the template field spec,
the row and plan types and every status / role string array (`agencyRoles`, `brandRoles`,
`internalBrandRoles`, `brandStatuses`, `changeKinds`, `runStatuses`, `promotionStatuses`, …);
`@tas/db` builds Drizzle tables and `pgEnum`s from them and re-exports the unions. TICKET-005's note
"role enums are defined once in `packages/db/src/schema/enums.ts` and re-exported so `packages/domain`
can import them" is superseded (TICKET-014 creates the arrays, TICKET-022 stage 2 re-points
`enums.ts`). A domain-side `no-restricted-imports` rule (TICKET-020 stage 2) forbids `@tas/db`,
`@tas/integrations`, `@tas/web`, `@tas/env` and `drizzle-orm` in `packages/domain/**`, and the CI step
`pnpm turbo run build --dry` (TICKET-006) fails on a cyclic workspace graph. Why: a cycle is refused by
Turborepo and cannot be ordered by project references (design §3.3, §11).

## D-023 · 2026-09-16 · Inngest usage and the `inngest` SDK; the `@tas/integrations` package

One `propagate-run`
execution per change set with a 20 s coalescing `step.sleep`, a row-operation budget (`stepBudget =
2000`) per apply step, `concurrency { key: templateBrandId, limit: 1 }`, `retries: 3`, no Inngest
`idempotency` / `debounce` / `batchEvents` (the database claim with attempt-suffixed event ids is the
correctness mechanism); `seed-brand` keyed per brand; `sweep-runs` hourly in agency hours (`TZ=
<AGENCY_TIMEZONE> 0 7-21 * * 1-6`); `retention` weekly. ≈2.3k step executions a month at the load
target (design §5.5). TICKET-029a adds the `inngest` npm package (major 3, exact major pinned) to
`packages/integrations` and `apps/web`, and creates `packages/integrations` (`@tas/integrations`) with
the workspace edges `@tas/integrations → @tas/db, @tas/domain, @tas/env` and `@tas/web →
@tas/integrations`; it is the CLAUDE.md layout's integrations package, first used for Inngest (Slack,
Resend, R2 and Airtable join it in later phases). Events and step outputs carry ids, field names and
counts only (design A6).

## D-024 · 2026-09-16 · D-006 amendment: Vercel Pro `maxDuration = 300`, Neon compute, Inngest executions

The
Inngest serve route (`apps/web/src/app/api/inngest/route.ts`, TICKET-029b) exports `maxDuration = 300`,
which needs the Vercel Pro plan D-006 already assumes (TICKET-007 records the plan tier). Neon compute
is estimated at ≈60 CU-hours a month at the load target (design §5.5) against an assumed 100 CU-hour
free allowance, and Inngest at ≈2.3k step executions a month against an assumed 50k free executions
(design A5). Both allowances are assumptions pending the human's confirmation (design §10 q1 and q5);
if either is lower, the first lever is the sweeper cadence (every two hours) and `stepBudget` (5,000),
the second is moving the retention cron into business hours. D-006's table is unchanged in USD.

## D-025 · 2026-09-16 · Concurrency properties are verified outside PGlite

Four properties need two connections
and cannot be proven on single-connection PGlite: (1) the queued-run row lock of a template write
against a concurrent claim (design §4.3); (2) `FOR UPDATE` serialisation of a child edit against a
running propagation (§4.4); (3) `FOR UPDATE` serialisation of promotion approval against a concurrent
child edit and request (§4.5); (4) claim takeover with `claim_generation` (A12, I14). They are checked
by `DATABASE_URL=<neon preview> pnpm --filter @tas/db engine:concurrency` (TICKET-037; expected last
line `engine-concurrency: 4/4 properties held`) and listed under "Pending human verification" in
`docs/runbook.md` (D-008). PGlite tests prove the single-connection half of each (T24, T13, T14).

## D-026 · 2026-09-16 · Fast-path Vercel deploy configuration

The human connected the GitHub repository to Vercel before TICKET-007 (Vercel deploy skeleton) ran, and
the first build ran from the repository root, where no Next.js app exists. To let the frontend be hosted
now, `apps/web/vercel.json` (framework, install and build commands, region) and the runbook "Deploy"
section were committed outside the ticket loop. The only setting that cannot live in the repository is
Root Directory = `apps/web`, documented in the runbook. TICKET-007 builds on this file rather than
creating it. `next build` was verified locally with no Clerk or database variables before the push.

## D-027 · 2026-09-17 · DS-Q6 resolved in favour of PRD §9: `revisions_needed` joins CLIENT_STATUS

The Client Queue shipped with a control that could never succeed. `CLIENT_QUEUE_ACTIONS`' Request
Revisions pointed at `pending_for_approval`, no entry in `CLIENT_TRANSITIONS` had that as a target, so
`canTransitionClient` refused the move from every state and the button answered "that is not the next
step on the client track" on every row in live mode. Approve had the same shape on a card already
client-Approved. Both were drawn unconditionally.

The cause is open question DS-Q6, logged on 2026-09-16 and never answered: the design handoff's
`CLIENT_STATUS` array has three entries and omits Revisions Needed, while PRD §9 states the client
track as "Pending for Approval → Approved / Revisions Needed → Launched", PRD §12 lists the trigger
"Client requested revisions", and PRD §5.8 gives creators a client status including Revisions Needed.
The PRD is the source of truth for product behaviour and the handoff for tokens and widget appearance,
so the handoff's three-entry array is read as a DISPLAY LIST — the columns that were drawn — and not
as the product's state set. DS-Q6 is closed in favour of PRD §9.

What changed: `CLIENT_STATUS` gains `revisions_needed` (label "Revisions Needed") after `approved` and
before `launched`, in PRD §9's order; `CLIENT_TRANSITIONS` becomes `pending_for_approval → approved |
revisions_needed`, `revisions_needed → pending_for_approval` (the team resubmits) and `approved →
launched`; `CLIENT_QUEUE_ACTIONS`' `request_revisions` targets `revisions_needed`. The tone needs no
special case — `chipTone` already maps a "Revisions" label that is not "Submitted" to `warn`. The gate
is untouched: `isClientTrackOpen` still decides whether the client track is reachable at all, and the
Client Queue's rule (internal Approved, client not Launched) is unchanged, so a row in
`revisions_needed` stays on the board — the client has asked for changes and the team has not yet
resubmitted. `CLIENT_QUEUE_COLUMNS` derives from `CLIENT_STATUS`, so the board gains a third column
with no second edit.

One consequence had to be handled rather than inherited: the client STEPPER in
`packages/ui/src/approval/two-track.tsx` walks its list positionally, so a fourth row would have drawn
Approved as `done` on a creative the client had just sent back. `revisions_needed` is a branch off the
decision, not a stage, so the domain exports `CLIENT_TRACK_STEPS` (`CLIENT_STATUS` minus the branch)
for anything linear and the widget names the branch with its header chip instead — the treatment
`ON_HOLD` already gets on the internal track.

Also: `canTransitionClient` reads its table with a widened lookup so a stored status this build has no row for
answers `false` instead of throwing, and a new `clientQueueActionsFor(internal, client)` in
`packages/domain/src/queue/client-queue.ts` returns only the actions the state machine allows from a
row. The card renders that list instead of both buttons, and shows one line where the buttons would be
when nothing is open. No dependency was added and no service cost changes.

## D-028 · 2026-09-17 · Naming formulas stay beside their vocabulary, not in `packages/domain/naming`

CLAUDE.md's architecture principles say "Naming formulas are pure functions in
`packages/domain/naming`, unit tested with fixtures". They are not: the Concept formula is
`packages/domain/src/concepts/concept-name.ts` and the Creative formula is
`packages/domain/src/creatives/creative-name.ts`, each with its `*.test.ts` beside it. Logging the
deviation, per the same file's rule that any deviation is written down with the reason.

Why they are not being moved: each formula reads the vocabulary of the thing it names — PRD §7's
Concept name is Batch-Angle-Theme and is built from `concepts/vocabulary.ts`, the Creative name is
`{FUNNEL}{FORMAT}{NUMBER}-BATCH-CONCEPT-VERSION(-PRODUCT)` and is built from
`creatives/vocabulary.ts`. Grouping by entity keeps a formula, its vocabulary, its validator and its
fixtures in one directory; grouping by "naming" would split every entity in half and leave two
modules importing across the package for the tokens they are made of. The principle's intent — pure
functions, no query, no component, fixture-tested — holds as written; only the directory differs.

Consequence: the CLAUDE.md sentence is read as "pure functions in `packages/domain`, unit tested
with fixtures". A third naming formula goes beside its own vocabulary, not into a `naming/`
directory. Nothing moves, no import path changes, no dependency and no service cost.

## D-029 · 2026-09-17 · One brand resolver and one agency resolver, both in `data-source.ts`

Thirteen modules each kept a private copy of "which tenant am I reading?". Twelve `*-source.ts`
modules had their own `liveBrandId` — `rows.find(row => !row.isTemplate && live(row))`, the FIRST
live non-template brand in the table — and `team-source.ts` and `propagation-source.ts` each had a
byte-identical `liveAgencyId` taking the first live agency. `brands.agency_id` is NOT NULL, so "the
first live brand" only means something while exactly one agency exists: insert a second tenant before
the organisation switcher ships and every one of those copies hands a correctly-scoped
`withBrand(brandId)` call a brand from the wrong tenant. The scope was enforced perfectly around an
id chosen by row order.

Both resolvers now live in `apps/web/src/lib/data-source.ts` and nothing else resolves a tenant.
`resolveLiveAgencyId` takes the actor's agency — the active Clerk Organization first (D-003: one
agency per organisation), then the person's memberships — and falls back to the only agency there is.
`resolveLiveBrandId` is that agency's first live non-template brand. Where there is no honest answer
the resolvers throw `AmbiguousBrandError` instead of returning a row: an actor in two agencies with
neither selected, or two live agencies and no actor scope. Refusing is the safe direction — a page
that errors is a bug report, a page showing another tenant's people is a breach.

`TeamSourceDeps` and `PromotionSourceDeps` extend `BrandResolverDeps` so the `actorScope` seam reaches
them, which is also what makes the refusal testable without Clerk. The demo branch of every module is
untouched and still returns before any connection is opened. No dependency was added and no service
cost changes.

## D-010 · 2026-09-22 · @dnd-kit for Kanban drag-and-drop

Sprint 5 adds a Kanban view with drag-and-drop card movement between columns. `@dnd-kit/core` +
`@dnd-kit/sortable` + `@dnd-kit/utilities` were chosen over `react-beautiful-dnd` (unmaintained) and
`react-dnd` (heavier). @dnd-kit is ~15 KB gzipped, React 19 compatible, and has no peer dependency
beyond React. No hosted service, no cost.

## D-031 · 2026-09-24 · Page-load performance: one connection per request, and the region gap

**What dominated latency (measured, not assumed).** Functions are pinned to Frankfurt (`apps/web/vercel.json`
`"regions": ["fra1"]`; live responses carry `x-vercel-id …::fra1::…`). The Railway Postgres is not in
Europe: server-side, `/sign-in` (no database) takes 341-381 ms while `/client/<missing-slug>` (one fresh
pool, one SELECT) takes 1164-1368 ms, so a fresh connection from fra1 costs about 0.8-1.0 s — consistent
with a US Railway region (us-east4 or us-west2), not europe-west4 (~8-10 ms from fra1). The proxy host
`iriguchi.proxy.rlwy.net` resolves to an anycast Railway IP, so the region itself must be read in the
Railway dashboard. On top of that distance, a full Overview load opened 6 separate node-postgres pools
(about 26 physical connections, since each pool opens one per concurrent query), ran 39 queries, resolved
the same agency and brand 5 times, and `ensureUser` fetched the Clerk profile on every request.

**Changed in code** (within CLAUDE.md's rules):
- `apps/web/src/lib/request-db.ts`: ONE pool per request via React `cache`, ended by `after()` once the
  response is sent. The 26 identical per-module `neonConnection` helpers now delegate to it. `cache` is
  per request, never per process, so this is not the module-level singleton CLAUDE.md forbids, and
  `createAutoDb` remains the factory. Server Actions (where React does not memoize) still get a pool per
  call, ended by `after`.
- Agency and brand-scope resolution memoized per request in `data-source.ts`, keyed on that request's
  `db`, and only when no test seam is injected, so tenancy tests still exercise the uncached resolver.
- `ensureUser` checks `isAgencyUserProvisioned` (one query) before any Clerk call; the profile fetch
  and the writes only happen for a user not yet provisioned.
- The /app layout runs `ensureOrganization`, `ensureUser`, `loadBrandScope` and `currentActor` in
  parallel after `auth.protect()`; the Overview page awaits its two loaders together.
- `loading.tsx` for `/app` and `/client/[brandSlug]`: navigation shows a skeleton at once and dynamic
  routes can be prefetched up to that boundary. (The /app layout does not re-run on client-side
  navigation between /app pages — verified in Next 15.5's walk-tree-with-flight-router-state — so its
  cost is paid on full loads, refreshes and redirects; a navigation's cost is the page's own reads.)
- `experimental.optimizePackageImports: ['@tas/ui', '@tas/domain']` in `next.config.ts`: the barrels were
  shipping every Radix primitive to routes that use none (config only, no dependency).

**Considered and not done.** A cross-request (module-level) pool would remove even the one handshake per
request, but it is exactly the shared mutable module state CLAUDE.md forbids, and on serverless it risks
exhausting Railway's connection limit across instances. The infra-level equivalent is a pooler in front
of Postgres (PgBouncer); Railway does not provide one by default and none is configured. Cross-request
`unstable_cache` of tenant data (brand list, actor) was not added: its key cannot read cookies or the
session inside the cached function, so a mis-keyed entry would serve one tenant's brands to another;
per-request memoization gets the dedup without that risk.

**Pending the human (the largest remaining win).** Co-locate compute and data: read the Postgres region in
Railway (service → Settings → Region), then either move the Railway database to europe-west4 and keep
fra1, or change `vercel.json` `regions` to the matching Vercel region (iad1 for us-east4, sfo1 for
us-west2). Also confirm `DATABASE_URL` carries `sslmode=require`: without it `createNodeDb` connects
without TLS, and the Vercel-to-Railway traffic crosses the public internet unencrypted.

## 2026-09-29 — Record linking: V0 constraints (TASK 5 audit)

The seven Airtable link pairs were audited and the missing read sides fixed (products→angles,
personas→angles, concepts→persona/product columns, concept→creatives, concept↔creator reads,
campaign→collections). Two constraints are DELIBERATE for V0 rather than gaps:

1. **First-linked display and single-select editors.** The junctions are many-to-many, but the
   angle panel's Persona/Product, the concept editor's Theme/Creator and the collection's Campaign
   are single Selects, and list cells show the FIRST linked name. Saving through one of these
   Selects replaces the whole junction set with the one chosen id — fine for demo data (all
   single-linked) but LOSSY for rows imported from Airtable with multiple links. Converting these
   to multi-select chip pickers (the UGC panel already has the pattern) is the follow-up before
   the October migration runs against real data.

2. **One-way link editing.** A link is edited from the side that names it in Airtable (angle edits
   its personas/products, collection chooses its campaign, brief chooses its concept, concept
   chooses its creator/theme); the other side is a read-only list. This mirrors ownership, keeps
   one write path per link, and avoids duelling syncs.

## 2026-10-01 — Module parity with the live Gratsi base (Prompt 1 schema decisions)

Source of truth is the live Gratsi base `appllDG4OmkK2Hdnn`, not the template. Decisions taken
while adding the six missing tables (audit: `docs/audits/airtable-module-gap-2026-10-01.md`):

1. **Due dates are computed, with the base's own formulas.** The metadata carries them, so nothing
   was invented: Email Campaigns `Design Due Date = Send Date − 5 days`, `Copywriting Due Date =
   Design Due Date − 5 days`; Email Flows the same two offsets from `Expected Setup Date`; SM
   Campaign Feed `Reminder Trigger = NOW() > Due Date − 12 hours`; Creative Sheet `Name =
   MONTH(Created) & "-" & Creative Name`; Creative Reporting `Difference CPA = CPA − Target CPA`.
   None is stored; the query layer derives them.
2. **Misnamed Airtable link fields are modelled by their real target.** Creative Modules'
   "Concepts" links Angles → junction `creative_module_angles`; Campaigns & Offers' "Angles" links
   Concepts → `campaign_concepts`. The doc comment on each junction says so.
3. **YouTube copy is its own table (`youtube_copy`)**, not a channel column on `copywriting`:
   the two bases have different funnel vocabularies and the Meta table carries the spell-check
   fields YouTube's does not. `copy_types` returns as a real table (the Airtable V0 decision to
   fold it into the four copy fields is superseded by parity).
4. **`themes` was NOT modelled on Creative Modules** — verified column by column — so no data
   migration is needed there.
5. **Creative Reporting has no live link to Creative Design** (only a dangling lookup), so
   `creative_reporting.brief_id` is a nullable FK the platform sets; the importer leaves it null.
6. Select vocabularies for the new tables live as tuples in `packages/db/src/schema/enums.ts`,
   pulled verbatim from the base's options; their state machines (allowed transitions) land with
   the pages in Prompt 2 under `packages/domain/state`.
7. **Migration `0039_gratsi-field-parity` (Prompt 4, schema-parity gate).** Four stored Gratsi
   fields had been written off as "no column" although the live rows carry data: every concept has
   a `Decription` (sic) and `Pain Points` and 90 of 102 a `USP` (now `concepts.description`,
   `pain_points`, `usp`, plus `client_comments`); 31 of 43 angles carry an approval `Status`
   (`angles.status`, tuple `angleStatuses` — a different axis from Potential/Winning); 23 of 70
   creators carry a `Payment Date` (`creators.payment_date`, plus `creator_info_request`, and the
   existing `slack_notified` is now imported from the base's trailing-space field name). Columns
   are nullable text/timestamptz; no backfill; the importer and the panels carry them.

## 2026-10-01 — Airtable field exclusion register (schema-parity gate)

`node scripts/airtable-parity.mjs` compares the live Gratsi base against `TABLE_MAPPINGS`
(`packages/db/src/scripts/import-mappings.ts`) and FAILS on any stored field that is neither mapped to
a column or junction, nor a record link whose inverse field on the other table is mapped (Airtable's
own `inverseLinkFieldId` says which; the junction is written from that side), nor named below. Every
row here is a deliberate exclusion; the gate matches the `Table › Field` text, so a renamed or new
Airtable field fails the gate until it is mapped or added here with a reason. Live-row counts are
from the 2026-10-01 export. Computed fields (formula, lookup, rollup, count, timestamps, autonumber,
button) are not stored by design and need no entry.

| Table › Field | Kind | Live rows | Why it is not stored |
| --- | --- | --- | --- |
| Meta Copywriting › (Internal) Creative Design | link | 0/0 | Second link to Creative Design beside `Creative`; the platform keeps one `copywriting.creative_brief_id`. |
| Meta Copywriting › Product | text | 0/0 | Residual single-line text; the product is the brief's `product_id`. |
| Meta Copywriting › Angle | text | 0/0 | Residual single-line text; the angle is the brief's `angle_id`. |
| Meta Copywriting › (Internal) Product | text | 0/0 | Residual single-line text (same datum as Product). |
| Meta Copywriting › Creative Reporting | text | 0/0 | Residual single-line text left by a converted link. |
| Meta Copywriting › Creative Sheet | text | 0/0 | Residual single-line text left by a converted link. |
| Meta Copywriting › (Internal) Creative Design 2 | text | 0/0 | Residual single-line text left by a converted link. |
| Meta Copywriting › ⚠️ Please Change the Status of the copy | text | 0/0 | A UI-instruction banner, not data. |
| Youtube Copywriting › Creative Reporting | text | 0/0 | Residual single-line text left by a converted link. |
| Youtube Copywriting › Creative Sheet | text | 0/0 | Residual single-line text left by a converted link. |
| Youtube Copywriting › (Internal) Product | text | 0/0 | Residual single-line text; the product link is `Product` (youtube_copy_products). |
| Youtube Copywriting › (Internal) Creative Design | text | 0/0 | Residual single-line text; `youtube_copy` has no brief link because the base's field is not one. |
| Youtube Copywriting › ⚠️ Please Change the Status of the copy | text | 0/0 | A UI-instruction banner, not data. |
| Creative Design (Internal & Interface) › (Internal) Collections 2 | text | 0/390 | Dead residual text; the real link is `(Internal) Collections 3` → `collection_id`. |
| Creative Design (Internal & Interface) › Ads Copywriting copy | link | 0/390 | Inverse of `Meta Copywriting › (Internal) Creative Design` (excluded above); `Meta Copywriting` (the inverse of `Creative`) is the mapped one. |
| Creative Design (Internal & Interface) › Angles | text | 0/390 | Dead residual text; the real link is `Angle` → `angle_id`. |
| Concepts › UGC Management copy | text | 0/102 | Residual single-line text; the creator link is `UGC Management` ↔ `Concept to film`. |
| Angles › Creators | link | 0/43 | Link to UGC Management with no mapped inverse; creators reach angles through their concepts. |
| Angles › (Internal) Creative Design | text | 1/43 | Residual single-line text; the structured link is `(Internal) Creative Design 2` → `creative_briefs.angle_id`. |
| Angles › Creative Sheet | text | 0/43 | Residual single-line text left by a converted link. |
| Angles › UGC Management copy | text | 0/43 | Residual single-line text left by a converted link. |
| Angles › Concepts copy | text | 9/43 | Residual single-line text (concept names); the structured link `Concepts` → `concept_angles` carries the same pairs. |
| UGC Management › Concepts | link | 0/70 | Second link to Concepts beside `Concept to film` (33 concepts link creators through that one). |
| Campaigns & Offers › Design attached | text | 0/0 | Loose single-line text with no target. |
| (Internal) Product › (Internal) Creative Design 2 | text | 0/6 | Residual single-line text; the structured link is `(Internal) Creative Design` → `creative_briefs.product_id`. |
| (Internal) Product › Email Campaigns Management copy | text | 0/6 (the name appears twice) | Residual single-line text; email campaigns reach products through `Table 17` → `email_campaign_products`. |
| (Internal) Product › Creative Sheet | text | 0/6 | Residual single-line text left by a converted link. |
| (Internal) Collections › Creative Sheet | text | 0/5 | Residual single-line text left by a converted link. |
| (Internal) Collections › (Internal) Product | text | 0/5 | Single-line text where the platform has `product_id`; nothing to resolve. |
| (Internal) Collections › Email Campaigns Management copy | text | 0/5 (the name appears twice) | Residual single-line text; email campaigns reach collections through `Table 17` → `email_campaign_collections`. |
| Client Assets Organisation › (Internal) Creative Design | text | 0/0 | Single-line text, not a link, so no `brief_asset_folders` rows can be derived; the importer says so in its report. |


## 2026-10-01 — Airtable-style grid is the default view of the six core tables (GRID-01…06)

Products, Personas, Angles, Themes, Concepts and UGC Management all open on the shared
`AirtableGrid` (`apps/web/src/components/views/airtable-grid.tsx`): every stored column visible,
horizontal scroll inside the grid, the name column frozen, full page width. Themes and UGC lose
their card grids as the primary view (the UGC card survives on `/design-system`; the Theme card is
now the body of the new `ThemePanel`, opened by a row click, so its labelled fields and the
Archive / Restore form are unchanged). Shared cell primitives live in `grid-cells.tsx`; a stored
literal `"null"` is treated as empty everywhere they render.

**Concepts: Production Status is hidden, not dropped.** `concepts.production_status` stays in the
schema, the importer and the actions, but the list grid, the form and the detail panel no longer
show it (client direction, Prompt C): the two-track Internal / Client statuses are the ones the
team works from, and a third status column on the same row was being read as a contradiction.
No migration; the column can return by rendering it again.

## 2026-10-01 — Per-user views live in their own table; demo mode keeps them in the browser (VIEWS-01)

`user_table_views` (migration 0040) stores one row per saved view: Clerk `user_id` + `table_key`,
the view type, `visible_fields` / `field_order` / `frozen_fields` / `sort` as jsonb and the search
`filter`, with `is_active` marking the one the user last chose. Not an extension of
`user_view_preferences` (which is one row per user+brand+table holding only the view type): a
person keeps SEVERAL named views of one table, and a view is a lens rather than a per-brand
setting, so `brand_id` stays null. The user id is the tenancy edge: every statement in
`packages/db/src/user-table-views.ts` carries it, the way a branded read carries `brand_id`.

In demo mode (no Clerk) there is no user to key on, so `useTableView` keeps the same state in the
visitor's `localStorage` under the table key. It is a convenience store for the demo deployment
only; the Playwright spec treats a second browser context as a second user there.

Jsonb for the config columns on purpose: a new view option (a grouping, a row height) is a code
change in `@tas/domain/views/user-views.ts`, not a migration; `parseUserViewConfig` narrows a
stored row on the way out so an old row never crashes a page.

## 2026-10-01 — Showcase videos reuse `assets`, linked by `creator_id` (VIEWS-04)

A creator's showcase videos are `assets` rows with `category = 'showcase_video'` and a nullable
`creator_id` (migration 0041), uploaded through the shared `uploadToR2` and `insertAsset` the Assets
page uses. No second media table: one bucket, one row shape, one re-hosting script. The upload is a
Server Action taking the file in `FormData` (video MIME only, 250 MB cap); it is refused in demo
mode, without a session, and when the R2 credentials are absent, each with its own message.

## 2026-10-01 — One LinkField and one junction per link, written from either side (LINK-01)

Every link between two of the six core tables is exactly one junction table, and both records edit
it with the same `LinkField`: a concept's creators and a creator's concepts are the same
`creator_concepts` rows, and so on for `concept_angles`, `angle_products` and `angle_personas`.
The link kinds are a pure registry in `@tas/domain/links` (which side of which junction a field
reads); `@tas/db`'s `syncLinks` takes that spec as plain strings so the data package still does
not depend on the domain package; `setLinksAction` is the one Server Action, and it proves the
source row is in the actor's brand through the scoped getter before writing, because junction
tables carry no `brand_id`. Nothing is copied onto a record: the inherited Persona / Product rows on
a concept are read through the angle's junctions at render time.

The Angle and Concept forms post one hidden input per linked id (`personaId`, `productId`,
`angleId`, `creatorId` read with `getAll`), so a Save re-syncs the same set the field already wrote
and can never narrow a multi-link back to one.

## 2026-10-01 — The editor board is a view of `internal_status`; the activity log is its own table (EDIT-01…03)

**Mapping (Incoming / Under Editing / Under Review).** The editor's three columns are a grouping
over the brief's internal status, defined once in `@tas/domain/state/editor-board.ts`:

| Stage         | Video track                                 | Static track                                 |
| ------------- | ------------------------------------------- | -------------------------------------------- |
| Incoming      | sent_to_video_editor                        | sent_to_designer                             |
| Under Editing | video_editing_in_progress, videos_revisions | static_design_in_progress, images_revisions  |
| Under Review  | ad_submitted, revisions_submitted           | ad_submitted, revisions_submitted            |
| off the board | approved, launched, on_hold                 | approved, launched, on_hold                  |

Revisions sit under Editing because the reviewer has handed the work back; the two "submitted"
states sit under Review because a reviewer holds it. No `editor_stage` column exists: Start and a
column drop write `internal_status` through the same transition table every other write obeys
(`canTransitionInternal`), so the board can never disagree with the rail.

**Start sets the assignee to the signed-in user's name.** `creative_briefs.assignee` is text (the
Airtable collaborator's display name), so Start stores `currentActor().fullName`, the string the
grid, the card and the log already show; a Clerk id would print as an opaque token.

**Activity log.** `activity_log` (migration 0042) is one row per changed field per write
(`entity_type` + `entity_id`, `field`, `old_value`, `new_value`, `created_by` + `actor_name`,
`created_at`), per brand. It is written by the Server Actions beside the row update
(`diffFields` from `@tas/domain/activity` decides what changed) and never from the client, so it
records what the database was told. Demo mode has no history to show and says so.

**Due date.** `creative_briefs.due_date` (migration 0043) is the one new column the editor's full
page needed; nullable, set on the brief.

**`/app/briefs/[id]`** stays the permanent alias of `/app/creative-design/[id]` (the module
rename); "Open full page" lands there.

## 2026-10-02 — Airtable formula fields live in `packages/db/src/formulas/`, computed at read time

Owner's instruction, 2026-10-02. One exported, typed function per Airtable formula field, in one
module, imported by the query layer; never re-implemented in UI code, so two readings of one record
cannot disagree. No formula gets a stored column.

- **Wall-clock formulas are read-time ONLY and are never stored**: `smReminderTrigger` (Due Date
  − 12 hours) and `creatorNotifyFlag` (≥ 25 days since Date of Partnership Activation). Both take
  `now` as an explicit parameter rather than calling `new Date()`, which keeps them pure, lets a
  test pin the clock, and makes it impossible for a caller to snapshot a value that expires.
- **Row-data formulas default to computed-on-read** because all of them are cheap arithmetic or
  string joins: the four email due dates, `creatorCostWithFee`, `differenceCpa`,
  `campaignOfferName`, `creativeSheetName`.

This sits beside D-028 (naming formulas stay with their vocabulary rather than in
`packages/domain/naming`) and is the same reasoning: `packages/db` is the only layer that can see a
row's columns and be imported by every reader, and `@tas/db` may not import `@tas/domain`
(CLAUDE.md package direction). Every formula was transcribed from the Gratsi base's own metadata
with field ids resolved to names — see `docs/decisions/formula-policy-2026-10-02.md`, which records
the two places the base contradicts its own documentation: the chained email due dates (copywriting
is ten days before the send date, not five) and the platform-dependent UGC fee (5.5% Fiverr, 10%
Insense, not a flat 5%).

## 2026-10-03 — `/app/column-admin` exceeds the 300-line diff ceiling: waiver, with the split it should have been

CLAUDE.md's Definition of Done caps a ticket at 300 lines of production code and says a bigger one
must be split. The ADMIN-UI track landed roughly 1,100 non-blank, non-comment production lines in
one go: the route (`page.tsx`, `source.ts`, `fields.ts`, `actions.ts`,
`column-admin-workspace.tsx`), its `/design-system` story, and ~95 more lines across the
`/app/interface-config` gate, the nav entry and one doc comment in `data-source.ts`. That is between
three and four times the ceiling. It was commissioned and reviewed as one unit of work, and
splitting it after the fact would mean re-cutting code that is already written and already green, so
the waiver is recorded here rather than pretended away.

The split it should have been, and the shape any follow-up should take:

1. **The read.** `fields.ts` + `source.ts` + `page.tsx` + the admin gate: the chooser, the resolved
   column list and the Inheritance chip, read-only. This is the half that is pure and testable
   without a session.
2. **The writes.** `actions.ts` + the control cluster in the workspace: one Server Action per
   statement kind, the role re-check, the transaction, the key allow-list.
3. **The `/app/interface-config` gate**, which is a security fix with nothing to do with columns and
   should never have travelled with a feature. It is the one part of this diff that is urgent on its
   own: that page edited per-brand client-interface visibility with no role check in the page and
   none in the action.

Consequence: the next column-admin ticket is read-only-or-write-only, not both, and this entry is
the precedent that a waiver is written down with its split rather than claimed in a commit message.

## 2026-10-04 — the second `UGC Management › Concepts` link is hidden, not dropped (AI-41)

Two of our own records disagreed about Gratsi's second, empty link to Concepts. The exclusion
register above lists `UGC Management › Concepts | link | 0/70` as a field the importer deliberately
ignores; `docs/decisions/overnight-ambiguous-fields.md` §2.8 seeded it as a visible Gratsi column of
its own ("two fields, two rows, nothing merged"). Both were defensible in isolation, and together
they produced a notice where a column should have been: `concept_ids` resolved for Gratsi, the UGC
grid's `CREATOR_RENDERERS` has no entry for the key, so `gridColumnsFrom` returned it in `missing`
and the page printed "Configured for this brand but not drawn here: concept_ids".

**Decision.** The register wins on *visibility*, §2.8 wins on *identity*. The row stays — keyed
`concept_ids`, labelled "Concepts", at Gratsi's own order 25 — and becomes `hidden-custom`, which is
the vocabulary the AMBIGUOUS rule already defines for a child-added field nothing writes
(`is_hidden = true`, `source = 'custom'`). One line of `packages/db/src/column-seed.ts`; no code
path, no renderer and no junction changes, and `creator_concepts` / "Concept to film" — the link the
importer really writes, 87 rows in production — is untouched at order 7.

**Why not retire it.** Dropping the row would forget an Airtable field that exists in the live base,
and un-hiding is a one-click Column Admin edit the day it carries data. Retiring it is the owner's
call, not a builder's, and the question is on the list for Talal.

**Consequence.** Re-running `seed-columns --apply` against production flips that one Gratsi row's
`is_hidden` to true; `check-columns --table creators` should then resolve 33 columns for Gratsi
instead of 34, with `creator_concepts` still at order 7. The seed change is committed; the
production write is not done and needs the usual approval.
## 2026-10-04 — Kanban leaves the five data tables; it stays where the lanes ARE the workflow (action item 18)

Talal, 2026-09-28: "drop Kanban from the data tables (products, personas, angles, themes,
concepts)". `packages/domain/src/views/table-views.ts` now lists `['grid', 'gallery']` for all five
and an empty `kanbanFields` on each, which IS the behaviour — `ViewSwitcher` renders exactly the
tabs the capability declares, so the registry is the only gate. The two boards that survive are the
ones whose lanes are a real queue someone moves a card along: Creative Briefs (the media
buyer / strategist board, and the editor's three stages) and UGC Management (action item 29, a
partnership process).

**Nothing was dropped but the lens.** Every field a lane was built from is still a stored column,
still rendered in the grid by the resolver, and still on the record's own form: `stage_of_awareness`
on a persona, `potential` on an angle, `category` and `status` on a theme, the four concept
statuses. `apps/web/src/app/app/concepts/concept-board.tsx` is not deleted either — it still renders
on `/design-system`, so the component is documented rather than lost; no page mounts it.

Two compatibility edges, both deliberate:

- `?view=board` on `/app/concepts` still parses (`conceptViewFromParam` keeps `board`) and opens the
  grid. A link written while the board existed is not a 404, and the next URL sync drops the stale
  parameter.
- A SAVED view can still name `kanban`. `loadUserViews` already narrowed what it read from Postgres
  through `supportsView`, but the `?view=` parameter and demo mode's `localStorage` did not — and
  production holds one personas row saved as a Kanban. `resolveViewType` in
  `packages/domain/src/views/table-views.ts` now narrows every path into `useTableView`, so a stale
  value degrades to the grid instead of leaving the switcher on a tab that is not rendered.

## 2026-10-04 — the "unneeded tables" review ran, and no table is dropped (AI-04)

The item asked for unneeded tables to be dropped. The review happened and the evidence says the
empties are not disuse: every zero-row content table in production (`campaigns_offers`,
`competitive_research`, `copy_types`, `creative_reporting`, `email_campaigns`, `email_flows`,
`youtube_copy`, `ai_characters`, `sm_campaign_feed_tasks`, …) mirrors a table that is also empty in
Gratsi's own Airtable base — the rollout report records that seven migrated tables hold no data yet
— and each has a shipped, resolver-driven module in front of it. Zero rows reflects a client who
has not filled the module in, not a table nobody needs. DECISION: nothing is dropped, no migration
is written; the next brand's import decides which modules fill. Revisit only if Talal names a
specific table.

## 2026-10-04 — "replicate the reference" is checkable only against the Gratsi base, and that check passes (AI-47)

No brief-screen reference exists in the repo: `docs/prd-assets/` holds the PRD, the dashboard
reference and the team-assignment reference, and nothing else. The ONLY checkable reading of
"the brief UI should replicate the reference" is therefore the client's own Airtable base, and
that reading is proven green: `apps/web/e2e/module-parity.spec.ts` asserts 35 named Gratsi fields
render on the Creative Design detail page by label, and the briefs grid now reads its columns from
the resolver (AI-64a). DECISION: adopted as done under the Gratsi-base reading. If Talal meant
another platform's brief screens, that is a different item and it needs the screenshots in
`docs/prd-assets/` first — asked as part of the consolidated questions in
`docs/audits/action-items-stuck.md`.

## 2026-10-04 — "the copy system" is read as the copywriting modules, which exist (AI-53)

Four words, two readings. As a NOUN — the copywriting system — the thing exists and runs:
`copy-types`, `copywriting`, `meta-copywriting` and `youtube-copywriting` are shipped,
resolver-driven modules; `copy_types` and `youtube_copy` verify `ok` in `verify-rollout`; the
brief detail renders its copy links. As a VERB — clone a reference platform's brief system "as
is" — no decision record names such a platform and no artifact describes it, so there is nothing
to build against. DECISION: the noun reading is adopted and the item is done with the copywriting
modules as its evidence; the verb reading, if intended, is the same missing-artifact question as
AI-47 and sits with Talal in `docs/audits/action-items-stuck.md`.

## 2026-10-04 — A gallery cover is a per-viewer lens, not a column definition (action item 16)

"Customise card" asks for two things: which fields show, and which image field is the cover. The
first already worked — a gallery card's labelled lines come from the same column set the grid
renders, so one Fields toggle hides a column and a card line together. The second did not exist: the
cover was whatever each page hard-coded in its `identity` callback, so `creators.galleryFields`
declared a Profile Pic and a Video Intro and NEITHER could be chosen. That registry had no consumer
at all.

**Where the choice lives.** `user_table_views.cover_field` (migration 0047, nullable text), beside
`visible_fields` and `frozen_fields`, and never in `column_definitions`. A cover is one person's way
of looking at rows everyone shares, exactly as a hidden column or a freeze is; putting it in the
column configuration would make one viewer's preference every brand's layout.

**Where the OPTIONS come from.** The brand's resolved column set, intersected with the table's
declared `galleryFields` (`coverFieldOptions`). The registry says which columns are media worth
covering a card with; the resolver says which of them this brand has, in what order, under what
label. So a column an admin hid is not offered, a relabelled column is offered under the brand's own
word, and the `galleryFields` keys were respelled from camelCase field names to resolver column keys
because that is now the vocabulary a view speaks. The resolved COLUMN SET is used rather than the
grid's built columns because `profile_pic_url` — the creators gallery's existing default cover — has
no grid renderer at all: it draws inside the frozen name cell.

**Only UGC Management gets a picker today, and that is the correct answer.** Products, Personas,
Angles and Concepts declare no media column, so `CoverMenu` renders nothing rather than offering an
empty setting. Themes declares exactly one, `attachments`, which is already its default cover, so a
picker there would offer the choice it is already making. Briefs and Assets declare media fields but
their pages carry no per-user view toolbar yet; they inherit the control when they do.

**Two fallbacks, both "degrade to the default, never to nothing"** — the rule
`reconcileViewFields` set for hidden columns. A row with no value in the chosen column keeps the
page's own cover, so a table-wide setting cannot blank the card of a record it does not apply to;
and a stored `cover_field` naming a column the row does not carry is ignored rather than rendered as
an empty card.

NOT DONE by this entry: card line ORDER. `UserViewConfig.fieldOrder` exists and `applyUserView`
applies it, but nothing writes it, and production's one saved view has `field_order = []`. "Customise
the card" is satisfied for the cover and for which lines show; reordering them is a separate ticket.

## 2026-10-04 — Talal ruling AI-33: Gratsi hides Internal Status; Status is its one internal track label

Verified against the live Gratsi base before acting: Concepts carries `Status` (singleSelect) and
no `Internal Status` field. The platform's `internal_status` column therefore leaves GRATSI'S
displayed set only — a `hidden` child row in `CONCEPTS_GRATSI` — while the platform row, every
inheriting brand's view and the Postgres column all stay exactly as they were. Gratsi's own
`approval_status` row keeps rendering under its Airtable label "Status". Nothing dropped.

## 2026-10-04 — Talal ruling AI-39: Gratsi's Concepts shows Script; Script Idea is the template's wording

Verified against the live Gratsi base: Concepts carries `Script` (richText) and no `Script Idea`.
The resolver already said the same — Gratsi's own `script_idea` relabel row renders "Script" and
the template's "Script idea" wording reaches only the brands that inherit it — so this ruling
lands as ALREADY-CORRECT with a pin (`column-seed.test.ts`, AI-39 describe) and no behaviour
change. The Postgres column keeps its 92 live scripts untouched.

## 2026-10-04 — Talal ruling AI-43: linked Concepts stay on the Angle record, shown, two-way

Verified against the live Gratsi base: Angles carries a `Concepts` field (multipleRecordLinks) —
the reverse side of Concepts→Angle, one `concept_angles` junction. The ruling is SHOW, not remove,
and the platform already does: the Angle panel renders the linked concepts list (each row the
concept's generated name linking to its page, with its status chip — `angles.spec.ts`, the
linked-work assertions, 9/9 green today) beside the editable picker, and the link is two-way by
construction (`links.test.ts` proves a write from either side reads back from the other, 6/6).
Reverse links render on the record page, never as grid columns — the same convention every other
reverse link on the platform follows — so Gratsi's grid set is untouched. ALREADY-CORRECT, both
displays kept; the earlier instinct to remove one of the two was wrong and nothing is removed.

## 2026-10-04 — Talal ruling AI-44: the Angle URL fields are real Gratsi fields and they stay

Verified against the live Gratsi base: Angles carries both `Brief` (url) and `Exact Script` (url).
The item's premise — that these were platform leftovers to remove — was wrong; they are Gratsi's
own fields, resolve from Gratsi's own rows (orders 24–25) and render through the angle grid's
LinkCell renderers. ALREADY-CORRECT; pinned in `column-seed.test.ts` (AI-44 describe) so a future
cleanup cannot un-match the live base. Nothing removed anywhere.

## 2026-10-04 — client_status follows AI-33: hidden from Gratsi's displayed Concepts set

The follow-up to AI-33, ruled the same day: `Client Status` has no field in the Gratsi base
either, so per the strict Gratsi-matches-Airtable rule it leaves GRATSI'S displayed Concepts set —
one more `hidden` child row in `CONCEPTS_GRATSI`. VERIFIED BEFORE SHIPPING, as the ruling
required: the client-facing interface reads `concepts.client_status` from the database
(`clientConcepts` selects the column directly; the portal's approve/revise actions write it;
nothing in `apps/web/src/app/client` or `client-data-source.ts` touches `resolveColumns`), so the
client gate is untouched by what the team's grid displays. Only the Gratsi team grid loses the
display chip. The Postgres column, every writer, Niagara's view and the platform row all stay.

## 2026-10-04 — GRATSI-MATCH, links cluster: Angles reads as the live base reads; five fields stay flags

The strict Gratsi-matches-Airtable rule applied to `angles` (input:
`docs/audits/gratsi-column-diff-2026-10-04.md`, Angles section and annotation 6). Gratsi now
resolves SIXTEEN columns, the live base's own 21 fields in the live base's own order minus the
five below. What changed is display only:

- **Reverse links become read-only GRID columns** — `Concepts` (keyed `concept_angles`),
  `(Internal) Creative Modules` (`creative_module_angles`) and `(Internal) Creative Design 2`
  (`creative_briefs`, the `angle_id` FK read backwards). Nothing stored, nothing editable: the
  grid renders the linked record names through the one shared `LinkedRecordsCell`, from the same
  three page inversions the panel's "Linked work" section already loads. This EXTENDS AI-43 —
  which confirmed the record-page display at a time when the platform convention kept reverse
  links off grids — to the grid, per annotation 6 of the diff; both displays now exist and
  nothing was removed.
- **The two Concepts-side lookups surface under Airtable's own names** — the previously hidden
  `angle_products` / `angle_personas` child rows flip to visible relabels `Product (from Angles)`
  and `Personas (from Angles)`: the junctions ARE that lookup's data, read-only as before.

**Five Airtable fields are deliberately NOT columns**, each already ruled by the 2026-10-02
exclusion register and re-affirmed here rather than silently skipped:

| field | why it stays a flag |
|---|---|
| `Creators` | Link to UGC Management with NO stored inverse anywhere (`import-mappings.ts` angles › Creators: `skip`, empty on all 43 live rows). Building it would need new storage, which this display-only pass may not add; it stays excluded until an owner asks for the junction. |
| `(Internal) Creative Design` | Residual text left by a converted link; 1/43, a stale snapshot of the live `(Internal) Creative Design 2` link (rule 5). |
| `Creative Sheet` | Residual text, 0/43 (rule 5). |
| `UGC Management copy` | Residual text, 0/43 (rule 5). |
| `Concepts copy` | Residual text; the live `Concepts` link carries the same pairs (rule 5). |

Pinned in `packages/db/src/gratsi-links-columns.test.ts` (the Airtable list minus exactly these
five names) and in the updated Angles describes of `column-seed.test.ts`; `verify-rollout`
expects gratsi 16. Parent rows untouched — Niagara still resolves the same sixteen it did.

## 2026-10-04 — GRATSI-MATCH, links cluster: Creative Design resolves the live base's 42 fields; four stay flags; Due Date keeps AI-49

The strict rule applied to `creative_briefs` (diff of 2026-10-04, Creative Design section).
Gratsi resolves THIRTY-NINE columns — the base's 42 fields, at the base's own positions, minus
the four flags below, plus `Due Date`. Display only; the parent set and every write path are
untouched:

- **Reverse links as read-only columns**: `Creative Module` (keyed `creative_module_designs`,
  0 rows today — the importer fills it), `Creative Sheet` (`creative_sheet_items`, its `brief_id`
  read backwards) and `Meta Copywriting` (`copywriting`, the `creative_brief_id` FK read
  backwards, rendered as the copy rows' generated titles).
- **Airtable's system fields display the shared columns** (diff annotation 3): `Last Modified` →
  `updated_at`, `Created` → `created_at`. No migration.
- **`Concepts (from Angles)` is a VIRTUAL lookup** — `briefConceptsFromAngles` in
  `packages/db/src/formulas/lookups.ts`, computed on read through the brief's angle into
  `concept_angles`; `storedColumns` keeps it out of every writable set.
- **`Due Date` is NOT hidden.** The strict Gratsi-matches-Airtable rule calls it a leak (no base
  has the field); the standing AI-49 ruling is Talal's own "columns + due date" ask. The strict
  rule DEFERS to AI-49 here, pending a ruling that names the winner; the column moves to the end
  of the displayed set (after the Airtable range) so the base's own order is undisturbed.

**Four Airtable fields stay decision flags**, never columns:

| field | why it stays a flag |
|---|---|
| `Created 2` | A second `createdTime` system field, 390/390 — a duplication remnant (rule 5). `Created` already displays `created_at`; a second display of the same datum would be two readings of one value. |
| `(Internal) Collections 2` | Residual single-line text left by a converted link (rule 5); the live link is `(Internal) Collections 3` → `collection_id`. |
| `Ads Copywriting copy` | The unread half of the duplicate copy-table link pair (overnight finding 8). Its stored side DOES NOT EXIST — `copywriting` carries one brief FK, `creative_brief_id`, and `Meta Copywriting` already reverses it — and the copywriting side belongs to the copy track. WAITING-ON-THE-COPY-TRACK: if that track lands a second stored link, the briefs-side display is one seed row away; nothing is migrated from this cluster. |
| `Angles` | Residual single-line text (rule 5); the real link is `Angle` → `angle_id`, displayed at position 13. |

Pinned in `gratsi-links-columns.test.ts` (the 42-field list minus exactly these four, plus
`Due Date` last) and the Creative Design describes of `column-seed.test.ts`; `verify-rollout`
expects gratsi 39. The grid data costs no new query shape: the copy and concept loaders the page
now reads are the same demo-aware sources every other page uses, indexed once per request.
