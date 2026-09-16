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
