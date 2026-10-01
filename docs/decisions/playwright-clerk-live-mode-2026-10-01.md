# Playwright live mode for the Start-a-brief test (2026-10-01)

Branch `claude/playwright-clerk-live-mode`, based on `main` at `ee1c1ae`. Phase 1, discovery only.

## A blocker to settle before anything else

**The live Start test is not on `main`.** It lives in `apps/web/e2e/briefs-editor.spec.ts` on
`claude/festive-euler-9578qg` (commit `e60069e`, nine unmerged commits on top of `main`), together
with the Start button, `startBriefAction` and the `activity_log` table it asserts. A branch cut
from `main` has nothing to un-skip. Phase 2 has to either (1) wait for that branch to merge and
rebase, or (2) base this branch on `claude/festive-euler-9578qg`. Recommendation: (1), so this PR
stays about credentials and CI and not about the editor board.

## 1. Where the test skips

- `apps/web/e2e/briefs-editor.spec.ts:135` (on the feature branch):
  `test.skip(clerkKeys() === undefined, 'No Clerk keys: Start writes a status and an activity row, which demo mode refuses (D-008)')`.
- The same gate is the pattern everywhere: `auth.spec.ts:25` (sign-up test), and every module spec
  skips the other way round (`test.skip(clerkKeys() !== undefined, …)`) because demo mode is the
  only mode the suite has ever run in.
- `clerkKeys()` is `apps/web/src/lib/clerk-keys.ts`: `undefined` unless
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set; then `CLERK_SECRET_KEY` is required or it throws.

## 2. The Clerk setup the app already has

- `@clerk/nextjs` 7.9 in the app; `@clerk/testing` 2.2.34 already a dev dependency.
- `apps/web/e2e/global-setup.ts` calls `clerkSetup(keys)` when keys exist: that fetches a **Clerk
  Testing Token** and makes `setupClerkTestingToken` / `clerk.signIn` available to every test, so
  bot protection never blocks automation. The helper's exports in the installed version are
  `clerkSetup`, `setupClerkTestingToken`, `clerk.signIn`, `clerk.signOut`, `clerk.loaded`.
- `auth.spec.ts` signs UP a fresh `+clerk_test@example.com` user through the page objects, verifies
  with the `424242` test code, then creates an organisation through `window.Clerk`. It leaves a user
  and an organisation behind on every run (the runbook says to delete them by hand).
- Middleware: `clerkMiddleware` protects `/app/*` when keys exist; the `(auth)` routes host the
  hosted sign-in / sign-up components.
- Data: in live mode every page reads Neon through `DATABASE_URL`; a Clerk session resolves to a
  brand via the active organisation (`agencies.clerk_org_id`) or a membership
  (`apps/web/src/lib/data-source.ts`, `resolveLiveBrandId`), and `ensureUser` provisions the roster
  row on first sign-in. The Start test needs an **Incoming brief in a brand the test user can see**,
  so it also needs a database seeded for it. `pnpm --filter @tas/db db:seed` creates the agency,
  two brands, users and assignments with demo Clerk ids (`DEMO_ACTOR_ID`), not a real Clerk user;
  the test user has to be attached to the seeded agency (organisation id in
  `CLERK_DEFAULT_ORGANIZATION_ID`, which the env already declares).

### Options

| Option | How | For | Against |
| --- | --- | --- | --- |
| **A. Testing Token + pre-created test user, password sign-in, storageState per worker (recommended)** | `clerkSetup` in global setup (already there); a helper signs in once per worker with `clerk.signIn({ strategy: 'password', identifier, password })` against a user created once in the Clerk dev instance, saves `storageState`, every test reuses it | Fast (one sign-in per worker), deterministic, nothing left behind, works in CI and locally with the same three variables, the helper already ships in `@clerk/testing` | Needs a human to create the user once in the Clerk dashboard and put it in the seeded organisation; the password is a secret |
| B. Sign-up per run (what `auth.spec.ts` does) | Create a `+clerk_test` user and organisation in the test | No pre-created user | Slow, leaves users and organisations behind, the new organisation is not the seeded agency so the brand resolves to nothing: the Start test cannot find its brief |
| C. "Bypass headers" | — | — | Clerk has no documented header that mints an app session. The Testing Token bypasses bot detection only; it does not sign anyone in. Not available on any plan, not a plan question |

Clerk Testing Tokens are available on every plan including the free development instance (the
runbook's TICKET-004 note already relies on them), so no plan upgrade is needed.

## 3. CI

**There is no CI.** The repository has no `.github/workflows`, no `vercel.json`, no other pipeline
file; Husky runs lint-staged on commit and that is the only automation. `turbo.json` already passes
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` and `DATABASE_URL` through to
`test:e2e:root` (D-013), so the plumbing to the Playwright process exists; the job that would set
them does not. Phase 2 therefore has to create `.github/workflows/e2e.yml` (Node 24, pnpm via
corepack, `pnpm install --frozen-lockfile`, `pnpm exec playwright install chromium`,
`pnpm exec playwright test`) with an `env:` block reading repository secrets. "Secrets store":
GitHub Actions repository secrets, none defined today.

Secrets Phase 2 would read (placeholders only; never a value in the repo):

| Secret | Used by |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | the dev server Playwright starts, and `clerkKeys()` gating |
| `CLERK_SECRET_KEY` | `clerkSetup` (Testing Token) and the server |
| `E2E_CLERK_USER_PASSWORD` | the sign-in helper (the email can be a plain variable, `E2E_CLERK_USER_EMAIL`) |

Plus one the prompt did not list and the test cannot run without: **`DATABASE_URL`** for a
disposable Neon branch seeded with `db:seed` (the Start test writes a status and an activity row).
Four secrets, not three; the runbook entry would say so.

## 4. Plan for Phase 2 (on approval)

1. Wait for `claude/festive-euler-9578qg` to merge; rebase.
2. `apps/web/e2e/support/clerk-login.ts`: a worker-scoped fixture that signs in with
   `clerk.signIn` (password strategy) once, writes `storageState` to a per-worker file, and exposes
   an authenticated `page`; reads `E2E_CLERK_USER_EMAIL` / `E2E_CLERK_USER_PASSWORD`; throws a
   worded error when the Clerk pair is set but the user variables are not.
3. `playwright.config.ts`: declare the variables (placeholders) and a second project `live` that
   runs only when the keys exist; CI workflow with the `env:` block above.
4. `briefs-editor.spec.ts`: replace the skip with the fixture; assert the column move and the
   `activity_log` row (field `internalStatus`, actor = the test user's name).
5. Teardown: a fixture `afterEach` that resets the touched brief (`internal_status`, `assignee`,
   delete its activity rows) through `@tas/db` with `DATABASE_URL`, so the test is idempotent.
6. Runbook: "Playwright live mode" section naming the secrets; `docs/decisions.md` entry.

Hard rules kept: no secret in the repo; the live project is skipped (reported, never green) when
the variables are absent, and green only when it really signed in and wrote the row.

## Outcome (Phase 2, 2026-10-01)

- Branched from `claude/festive-euler-9578qg`, where the live Start test and `activity_log` exist.
- CI created from scratch: `.github/workflows/e2e.yml` runs `pnpm test:e2e` on PRs and pushes to
  `main` with the four repository secrets, and fails a same-repo ref whose secret set is partial.
- The live test moved to `apps/web/e2e/live/briefs-start.spec.ts` and runs in its own Playwright
  project against a second dev server on port 3001, so the demo suite keeps running against the
  demo server in the same invocation (D-014).
- Teardown: `snapshotBrief` / `restoreBrief` in `@tas/db` (PGlite-tested, idempotent), wired through
  the `briefGuard` fixture in `apps/web/e2e/support/brief-reset.ts`.
- Phase 3 (a local run with one-time keys) could not happen in this session: no keys were present.
  Recorded under "Pending human verification" as E2E-LIVE-02.
- Follow-up (branch `claude/auth-spec-live-mode`): the sign-up block of `auth.spec.ts`, which still
  gated on the app's own key names and so skipped in live mode, moved to
  `apps/web/e2e/live/auth-signup.spec.ts` on the same split, starting from no session
  (`anonymousTest` in `clerk-login.ts`) and removing the user and organisation it creates through
  the Clerk Backend API in `afterAll` (`support/clerk-admin.ts`, idempotent).
