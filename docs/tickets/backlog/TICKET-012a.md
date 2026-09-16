# TICKET-012a · PGlite driver dispatch, migrate/seed entrypoints and seed identities

- Owner: schema (`packages/db/**`)
- Size: S
- Depends on: TICKET-003 (`createDb(client)`, `createNeonDb`, `createPgliteDb`, migrate and seed
  entrypoints, `@tas/env`), TICKET-005 (the seed), TICKET-008 (the seed's `clerk_org_id = 'org_seed'`
  and template slug `template`)
- PRD: §16 (delivery cadence: every user-facing flow must be demonstrable on this machine every ~3 days
  without waiting for credentials), §14.6 (cost: zero added services). Tooling ticket.
- Design: template-engine.md §9 row "TICKET-029b" (the design's name for the local-PGlite ticket), §12
  local-PGlite decision (D-020 in this plan's numbering, appended by TICKET-012b), G6

## Why

CLAUDE.md's credential status means the app cannot run against a database on this machine. Letting the
one `DATABASE_URL` variable name an in-process PGlite directory gives `pnpm dev`, Playwright and CI a
real Postgres with the real migrations, and no second configuration path.

## Acceptance criteria

1. `packages/db/src/create-db.ts` exports `parseDatabaseUrl(url)` → `{ driver: 'pglite'; dataDir: string }
   | { driver: 'neon'; url: string }` (`pglite://<path>` → `dataDir = <path>` relative to the process cwd;
   `postgres://` and `postgresql://` → neon; anything else throws `UnsupportedDatabaseUrlError`) and
   `createDbFromUrl(url)` dispatching to `createPgliteDb({ dataDir })` or `createNeonDb(url)`.
   TICKET-003's `createDb(client)` (the factory taking a driver client) keeps its name and signature and
   its tests are unchanged; `createDbFromUrl` is the one dispatcher every entrypoint and `apps/web`
   (TICKET-012b, TICKET-029b) use. The PGlite branch keeps one open handle per `dataDir` in a registry
   stored on `globalThis` under `Symbol.for('@tas/db/pglite-registry')` (a local-only connection pool;
   PGlite allows one opener per data directory, and Next dev reloads modules), plus `closePglite(dataDir?)`
   for tests and process exit. The in-memory `createPgliteDb()` of TICKET-003 is unchanged.
2. The `db:migrate` and `db:seed` entrypoints of TICKET-003 go through `createDbFromUrl(serverEnv().DATABASE_URL)`,
   using `drizzle-orm/pglite/migrator` for the pglite driver and the Neon migrator otherwise, so
   `DATABASE_URL=pglite://.local/db pnpm --filter @tas/db db:migrate && DATABASE_URL=pglite://.local/db
   pnpm --filter @tas/db db:seed` exits 0 and creates `.local/db/`. The migrate and seed bodies are exported
   as `runMigrations(db)` and `runSeed(db)` so tests and TICKET-012b's Playwright global setup call them
   without spawning a process.
3. `packages/db/src/seed.ts` exports `seedIdentities: { admin: TestIdentity; strategist: TestIdentity }`
   built from the seed's own values, where `TestIdentity = { clerkUserId, email, fullName, clerkOrgId?:
   string, clerkOrgRole?: string }` is declared in `packages/db/src/seed.ts` (TICKET-012b re-exports it).
   `seedIdentities.admin.clerkOrgId` is `'org_seed'` with `clerkOrgRole 'org:admin'`. No other change to
   the seed.
4. Tests on PGlite: `create-db.test.ts`: `parseDatabaseUrl` table (`pglite://.x/db`, `postgres://…`,
   `postgresql://…`, `mysql://…` throws, `''` throws); `createDbFromUrl('pglite://<tmp>')` twice returns the
   same handle and a second `dataDir` a different one; `closePglite(dir)` then `createDbFromUrl` reopens.
   `seed.test.ts` (extends TICKET-003's seed test): after `runMigrations` and `runSeed` on a fresh PGlite,
   the agency has `clerk_org_id 'org_seed'`, the template brand has slug `template`, and
   `seedIdentities.admin.clerkUserId` / `.strategist.clerkUserId` match the seeded `users` rows.
5. `packages/db/src/index.ts` exports `parseDatabaseUrl`, `createDbFromUrl`, `closePglite`,
   `runMigrations`, `runSeed`, `seedIdentities` and `TestIdentity`.
6. `pnpm typecheck && pnpm lint && pnpm test` green from the root; diff under 300 lines excluding tests.

## Gated criteria (D-008)

none

## Files touched

`packages/db/src/create-db.ts` and `create-db.test.ts`, the TICKET-003 migrate/seed entrypoints under
`packages/db/src/`, `packages/db/src/seed.ts` (+ test), `packages/db/src/index.ts`.

## Notes

- `globalThis` registry: this is the one place a process-wide handle is sanctioned, because PGlite's
  data directory takes a single opener and every request-scoped `createDbFromUrl` would otherwise reopen
  it. It is keyed by `dataDir`, exposed through `closePglite`, and documented in D-020 (TICKET-012b). The
  Neon branch keeps creating a stateless HTTP client per request as TICKET-003 defined.
- `createDbFromUrl` for pglite applies no migrations by itself; `db:migrate` does, so the dev and E2E
  databases are built the same way production is.
- No new dependency: `@electric-sql/pglite` is already a dependency of `@tas/db` (D-005). No root file
  is edited; `.gitignore` entries for `.local/` and `.e2e/` are TICKET-012b's.
