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
