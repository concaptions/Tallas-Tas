# TICKET-012b · Test-only sign-in, Playwright and CI on PGlite

- Owner: integrator
- Size: M
- Depends on: TICKET-012a (`createDbFromUrl`, `runMigrations`, `runSeed`, `seedIdentities`), TICKET-004
  (middleware, `ClerkProvider`, sign-in page), TICKET-006 (the E2E job this ticket makes green),
  TICKET-007 (the runbook "Deploy" variable table), TICKET-008 (`createAuth`, `Session`, `UserMenu`,
  `OrgSwitcher`, `dbForRequest`)
- PRD: §16 (delivery cadence), §14.6 (cost: zero added services). Tooling ticket.
- Design: template-engine.md §9 row "TICKET-029b" (the design's name for this ticket), §12 local-PGlite
  decision (renumbered D-020 here), G6 (Inngest-free tests; the engine E2E of TICKET-034 runs on this
  machine)

## Why

No E2E that needs a signed-in user can run today, and every Phase 1 and Phase 2 UI ticket carries an E2E.
This ticket removes that gate for good: the app runs against in-process PGlite (TICKET-012a) and a
test-only sign-in that is structurally unreachable in production, so `pnpm test:e2e` proves user-facing
flows here and in CI while the real Clerk sign-in stays the only gated check.

## Acceptance criteria

1. `packages/env`: `DATABASE_URL` accepts the `pglite:` scheme (refinement: scheme in `postgres`,
   `postgresql`, `pglite`); optional `E2E_AUTH_BYPASS` (string) and `VERCEL_ENV` (enum `development |
   preview | production`) are added to `serverEnv()`; `.env.example` lists both with the comments
   "test-only sign-in; set to 1 on this machine and in CI only; never on Vercel" and "set by Vercel;
   never set it by hand". `.local/` and `.e2e/` are added to `.gitignore`.
2. `apps/web/src/lib/auth/bypass.ts` exports the pure `isTestBypassEnabled(env: { E2E_AUTH_BYPASS?: string;
   VERCEL_ENV?: string; NODE_ENV: string })` → `true` only when `E2E_AUTH_BYPASS === '1'` (the explicit
   opt-in; `'true'`, `'yes'`, `'on'` are refused), `VERCEL_ENV === undefined` and `NODE_ENV !==
   'production'`. Test `bypass.test.ts` is a table with at least these rows: `('1', undefined,
   'development') → true`, `('1', undefined, 'test') → true`, `('1', 'preview', 'development') → false`,
   `('1', 'production', 'development') → false`, `('1', 'development', 'development') → false` (any
   Vercel value refuses), `('1', undefined, 'production') → false`, `('true', undefined, 'development') →
   false`, `(undefined, undefined, 'development') → false`. This test is the proof that the bypass is
   unreachable on Vercel and in any production build. `isTestBypassEnabled` is the name TICKET-034's
   test-only engine route imports.
3. `apps/web/src/lib/auth/test-session.ts`: the cookie `tas_e2e_session` holds a base64url JSON
   `TestIdentity` (TICKET-012a's type, re-exported); `parseTestSession(cookieValue)` → `TestIdentity |
   null` (pure; malformed base64, malformed JSON and missing `email` return `null`, tested);
   `testSession(cookies)` → TICKET-008's `Session` whose `profile()` resolves from the identity without
   any network call.
4. `apps/web/src/app/api/test-auth/route.ts`: `POST` with a `TestIdentity` JSON body sets the cookie
   (`httpOnly`, `sameSite: 'lax'`, `path: '/'`) and returns 204; `DELETE` clears it and returns 204; both
   return 404 with an empty body whenever `isTestBypassEnabled(serverEnv())` is `false`, before reading the
   body. Route test (Vitest, node environment, calling the handlers with `Request` objects and an injected
   env): refused env → 404 and no `set-cookie`; allowed env → 204 with the cookie; `DELETE` → cookie
   cleared.
5. `apps/web/src/lib/auth/index.ts` (TICKET-008): `getSession` is `isTestBypassEnabled(serverEnv()) ?
   testSession : clerkSession`. `apps/web/src/lib/auth/provider.tsx` exports `AuthProvider` which renders
   `ClerkProvider` normally and a passthrough in bypass mode; `apps/web/src/app/layout.tsx` uses it.
   `UserMenu` renders the actor's full name and a "Sign out" form (`DELETE /api/test-auth`, then
   `/sign-in`) in bypass mode, Clerk's `UserButton` otherwise. `OrgSwitcher` (TICKET-008) renders Clerk's
   `OrganizationSwitcher` normally and a static "Create your organisation in Clerk" note in bypass mode,
   so no Clerk component is rendered without a `ClerkProvider`.
6. `apps/web/src/lib/db.ts` (TICKET-008): `dbForRequest()` becomes `cache(() =>
   createDbFromUrl(serverEnv().DATABASE_URL))`; TICKET-008's tests are unchanged. This is what makes
   `pnpm dev` and every E2E run on the PGlite database instead of the Neon driver.
7. `apps/web/src/middleware.ts`: in bypass mode the export is `testMiddleware`, which redirects protected
   routes (TICKET-004's matcher, unchanged and still tested) to `/sign-in` when the cookie is absent and
   passes otherwise; `clerkMiddleware` is not constructed in bypass mode (it throws without keys). Outside
   bypass mode the file is TICKET-004's. The mode is read through `@tas/env`, never `process.env`.
8. `/sign-in` in bypass mode renders a minimal form (`data-testid="test-sign-in"`: email, full name, org
   id, org role, submit) that `POST`s to `/api/test-auth` and redirects to `/app`; outside bypass mode the
   page is TICKET-004's Clerk component. Same for `/sign-up` (it links to `/sign-in`).
9. `apps/web/next.config.ts` gains `serverExternalPackages: ['@electric-sql/pglite']` so the WASM driver
   is not bundled by Next.
10. Root `eslint.config.js`: the `no-restricted-properties` rule for `process.env` exempts
    `apps/web/e2e/**` and `playwright.config.ts` (TICKET-010 and TICKET-011 read `E2E_AUTH_BYPASS` there
    for their skip guards). If TICKET-004 already added the exemption, this criterion is verified as
    present and the file is not edited.
11. `playwright.config.ts`: `globalSetup: 'apps/web/e2e/global-setup.ts'` removes `.e2e/db`, then calls
    `runMigrations` and `runSeed` (TICKET-012a) on `createDbFromUrl('pglite://.e2e/db')` and
    `closePglite`; `webServer.env` = `{ DATABASE_URL: 'pglite://.e2e/db', E2E_AUTH_BYPASS: '1' }`;
    `webServer.reuseExistingServer` is `false` in CI. `apps/web/e2e/helpers/auth.ts` exports
    `signInAs(page, identity: TestIdentity)` (a `page.request.post` to `/api/test-auth`) and re-exports
    `seedIdentities`.
12. `apps/web/e2e/test-sign-in.spec.ts` runs unconditionally: `signInAs(page, seedIdentities.admin)` then
    `/app` does not redirect to `/sign-in` and shows the admin's full name (`actor-name` from TICKET-008
    or `workspace-name` after TICKET-010). TICKET-004's `auth.spec.ts` (a) still passes in bypass mode.
    Remove the `test.skip(!process.env.E2E_AUTH_BYPASS, …)` guards from `brand-switcher.spec.ts` and
    `onboarding.spec.ts` if those tickets landed first; if they have not landed, leave a note in the
    report that they remove the guard themselves.
13. `.github/workflows/ci.yml` (TICKET-006): the `e2e` job's `env` gains `DATABASE_URL: pglite://.e2e/db`
    and `E2E_AUTH_BYPASS: '1'`. `pnpm ci:validate` exits 0.
14. `pnpm test:e2e` exits 0 on this machine with no credential in the environment (`env | grep -c
    "CLERK\|NEON" ` prints `0` first). `DATABASE_URL=pglite://.local/db E2E_AUTH_BYPASS=1 pnpm dev` serves
    `/sign-in` with the test form and `/app` after signing in as `seedIdentities.admin`.
15. `docs/runbook.md`: new section "Local full stack" (the two commands of TICKET-012a criterion 2 and
    criterion 14 here, the identities, how to reset by deleting `.local/` or `.e2e/`); the TICKET-007
    "Deploy" variable table gains the row `E2E_AUTH_BYPASS` with the value "never set on Vercel"; "Pending
    human verification" keeps only the real Clerk sign-in lines from TICKET-004 and TICKET-008 (this
    ticket removes nothing from them and adds no line).
16. `docs/decisions.md` gets `D-020 · Local full stack on PGlite and test-only sign-in` (the engine
    design's D-012, renumbered; next free number if taken, update this header): `pglite://` in
    `createDbFromUrl`, the per-data-dir registry on `globalThis` as the one sanctioned process-wide handle
    and why (PGlite single opener, Next dev reloads), the bypass rule of criterion 2, and that no
    dependency was added.
17. `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` green from the root; diff under 300 lines
    excluding tests.

## Gated criteria (D-008)

none. This ticket is what un-gates the E2E criteria of TICKET-010, TICKET-011 and the Phase 2 UI
tickets (TICKET-033 to TICKET-036b). The only auth check that stays gated anywhere is the real Clerk
sign-in (TICKET-004 (b), TICKET-008), on Clerk keys.

## Files touched

`packages/env/src/**` and tests, `.env.example`, `.gitignore`, `eslint.config.js` (only per criterion 10),
`apps/web/src/lib/db.ts`,
`apps/web/src/lib/auth/{bypass,bypass.test,test-session,test-session.test,index,provider,user-menu,org-switcher}.ts(x)`,
`apps/web/src/app/api/test-auth/route.ts` and `route.test.ts`, `apps/web/src/middleware.ts`,
`apps/web/src/app/layout.tsx`, `apps/web/src/app/(auth)/sign-in/**`, `apps/web/src/app/(auth)/sign-up/**`,
`apps/web/next.config.ts`, `playwright.config.ts`, `apps/web/e2e/{global-setup,helpers/auth}.ts`,
`apps/web/e2e/test-sign-in.spec.ts`, `apps/web/e2e/{brand-switcher,onboarding}.spec.ts` (guard removal
only), `.github/workflows/ci.yml`, `docs/runbook.md`, `docs/decisions.md`.

## Notes

- The bypass must never be reachable in production. Three independent locks: the pure rule
  (criterion 2, unit-tested), the route returning 404 before reading a body (criterion 4), and the
  runbook/Vercel table stating the variable is never set on Vercel. `VERCEL_ENV` is set by Vercel on
  every deployment including previews, so even a mis-set `E2E_AUTH_BYPASS=1` on the project refuses.
- The cookie is unsigned on purpose: whoever can reach a bypass-mode server is, by definition, the test
  runner on this machine or the CI job. Do not add a secret to sign it; a secret would become a
  credential to manage.
- Nothing under `packages/db/**` is edited; every database change is TICKET-012a's.
- If `next dev` spawns a second server process (it does not with the default Next 15 dev server; check
  `ps` once), the registry does not help and the runbook must say to run `pnpm dev` with Turbopack's
  single-process mode; report what you observed.
- `apps/web/src/app/layout.tsx` and the sign-in pages are frontend files; this ticket touches them only
  to insert the `AuthProvider` and the bypass branch, nothing else.
