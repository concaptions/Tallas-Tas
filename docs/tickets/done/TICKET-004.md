# TICKET-004 · Clerk auth with organisations, protected routes

- Owner: integrator
- Size: M
- Depends on: TICKET-002, TICKET-003
- PRD: §11 (roles, brands and access; every person gets their own account), D-003 (one Clerk org per
  agency)
- Decision: D-013 (the ticket text names D-012, which TICKET-003 stage 2 took; the numbering note is
  the last bullet of D-013)

## Why

Every page after this one is behind auth. Clerk organisations model the agency; brand access is our own
schema (TICKET-005), so this ticket wires identity only.

## Acceptance criteria

1. `@clerk/nextjs` installed in `apps/web`; `clerkMiddleware` in `apps/web/src/middleware.ts` protects
   everything except `/`, `/sign-in(.*)`, `/sign-up(.*)` and static assets. Unauthenticated requests to
   `/app` (and any `/app/*`) redirect to `/sign-in`.
2. `ClerkProvider` in the root layout. Sign-in and sign-up pages using Clerk's components at
   `/sign-in/[[...sign-in]]` and `/sign-up/[[...sign-up]]`.
3. Protected page `/app` renders the signed-in user's name and the active organisation name, and shows
   Clerk's `OrganizationSwitcher` so the agency org can be created on first run.
4. Keys are read through `@tas/env` (`clientEnv()` for the publishable key, `serverEnv()` for the
   secret). No `process.env` in `apps/web`.
5. Unit test for the route matcher: `/app`, `/app/brands/1` are protected; `/`, `/sign-in`, `/sign-up/x`
   are public.
6. Playwright E2E `apps/web/e2e/auth.spec.ts`: (a) always runs: visiting `/app` signed out lands on
   `/sign-in`; (b) runs only when Clerk keys are present in the environment: signs up through
   `@clerk/testing` helpers, creates an organisation, lands on `/app` showing the org name. When keys are
   absent, (b) is reported as skipped with the reason, not as a pass.
7. `docs/runbook.md` "Pending human verification" gets the exact E2E command with the two Clerk
   variables. `docs/decisions.md` D-012 lists dependencies added.

## Gated criteria (D-008)

- Sign-up and organisation creation E2E: gated on Clerk keys.

## Files touched

`apps/web/src/middleware.ts`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/(auth)/sign-in/...`,
`apps/web/src/app/(auth)/sign-up/...`, `apps/web/src/app/app/page.tsx`, `apps/web/src/lib/routes.ts`
(matcher + test), `apps/web/e2e/auth.spec.ts`, `apps/web/package.json`, `docs/runbook.md`,
`docs/decisions.md`.

## Notes

- Do not build the brand switcher here; that is a Phase 1 ticket and needs TICKET-005.
- Do not sync Clerk users into the database here; TICKET-005 defines `users` and a later ticket wires
  the webhook.
