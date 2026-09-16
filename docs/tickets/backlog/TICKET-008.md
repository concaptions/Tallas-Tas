# TICKET-008 · Auth readers and route helpers

- Owner: integrator
- Size: M
- Depends on: TICKET-004 (Clerk session), TICKET-005 (`users`, `memberships`, `brand_assignments`,
  `withBrand`)
- PRD: §11 (roles, brands and access: Admin everything; CSM, strategist, editor, designer, media buyer
  only assigned brands; client only their brand; every person has their own account), §3 (team
  assignment is the source of access), D-003 (one Clerk org per agency; clients have no org membership)
- Design: template-engine.md §6 (route helpers are the second line of defence; `requireTemplateEditor` is
  `requireAdmin()` in V1; the privileged cross-brand scope arrives only in TICKET-024a), §9 TICKET-01x-R,
  A9 (the template brand never has a `client` assignment)

## Why

Every page and Server Action after this one starts with "who is this, and what may they touch". Clerk
answers only the first half; the second half lives in our tables (D-003). This ticket resolves a Clerk
session to a `users` row once, lazily, and gives every later ticket three helpers whose behaviour is
proven on PGlite with a stubbed session, so no ticket re-implements role checks.

## Acceptance criteria

1. `packages/db/src/auth/` exports these read functions, each taking the database as its first argument
   (no module-level instance) and each excluding soft-deleted rows:
   - `findUserByClerkId(db, clerkUserId)` → `users` row or `null`.
   - `upsertUserFromClerk(db, { clerkUserId, email, fullName })` → the row; `ON CONFLICT (clerk_user_id) DO
     UPDATE SET email, full_name, updated_at`. A conflict on `email` with a different `clerk_user_id` throws
     `EmailInUseError` (typed, in `packages/db/src/auth/errors.ts`).
   - `findAgencyByClerkOrgId(db, clerkOrgId)` → `agencies` row or `null`.
   - `findMembership(db, { userId, agencyId })` → `{ role }` or `null`.
   - `ensureMembership(db, { userId, agencyId })` → inserts `role = 'member'` when no row exists, returns
     the existing row otherwise; it never changes an existing role (an `admin` stays `admin`).
   - `listAgencyMembers(db, agencyId)` → `{ userId, fullName, email, role }[]` ordered by `full_name`
     (consumed by the onboarding wizard, TICKET-011).
   - `listBrandsForAgency(db, agencyId)` → `{ id, name, slug, isTemplate, status }[]` ordered by name.
   - `findBrandForAgency(db, { brandId, agencyId })` → `{ id, name, slug, isTemplate, status, agencyId,
     templateBrandId }` or `null` (`deleted_at IS NULL AND agency_id = $agencyId`); the one brand-row read
     Server Actions use before a brand-scoped write (TICKET-033).
   - `listBrandsForUser(db, userId)` → `{ id, name, slug, isTemplate, status, roles: BrandRole[] }[]`:
     `brand_assignments` joined to `brands`, filtered by `brand_assignments.user_id = $userId AND
     brand_assignments.deleted_at IS NULL AND brands.deleted_at IS NULL`, one entry per brand with all of
     the user's roles on it. This is the one actor-scoped cross-brand read (see Notes and D-017).
   - `findBrandRoles(db, brandId, userId)` → `BrandRole[]`, read through
     `withBrand(db, brandId).select(brandAssignments)` narrowed by `user_id` (brand-scoped by
     construction).
2. Unit tests on PGlite in `packages/db/src/auth/*.test.ts` through `testDb()` (≤3 lines of setup):
   `upsertUserFromClerk` called twice with the same `clerkUserId` leaves one row and the second call's
   `fullName`; a second `clerkUserId` with the first's email throws `EmailInUseError`; `ensureMembership`
   twice leaves one row and does not downgrade a seeded `admin`; `listBrandsForUser(A)` returns none of
   user B's brands and returns two roles for a user assigned twice to one brand; `findBrandRoles` on the
   template brand returns `[]` for the seeded strategist; `listAgencyMembers` excludes a soft-deleted
   membership; `findBrandForAgency` returns `null` for a brand of another agency and for a soft-deleted
   brand.
3. `apps/web/src/lib/auth/create-auth.ts` exports `createAuth(deps: AuthDeps)` where
   `AuthDeps = { db: Db; getSession: () => Promise<Session | null> }` and
   `Session = { clerkUserId: string; clerkOrgId: string | null; clerkOrgRole: string | null;
   profile: () => Promise<{ email: string; fullName: string }> }` (`profile` is called only when the `users`
   row does not exist yet, so a warm request makes no Clerk API call). It returns:
   - `currentActor(): Promise<Actor | null>` with `Actor = { userId, clerkUserId, email, fullName,
     clerkOrgId, clerkOrgRole, agencyId: string | null, agencyRole: AgencyRole | null }`. Resolution: no
     session → `null`; `findUserByClerkId`, else `profile()` + `upsertUserFromClerk`; when `clerkOrgId`
     matches an agency, `ensureMembership` then `findMembership` fill `agencyId` / `agencyRole`; otherwise
     both are `null` (clients, D-003).
   - `requireActor()` → `Actor`, throws `UnauthenticatedError`.
   - `requireAdmin()` → `Actor` with `agencyRole === 'admin'`, else throws `ForbiddenError`.
   - `requireBrandRole(brandId, ...roles: BrandRole[])` → `{ actor, roles: BrandRole[] }`. An admin of the
     brand's agency passes with the brand's agency checked (`brands.agency_id === actor.agencyId`) and
     `roles = []`; anyone else passes when `findBrandRoles` intersects `roles` (or is non-empty when
     `roles` is empty), else throws `ForbiddenError`. The brand row is read with `deleted_at IS NULL`; a
     missing brand throws `ForbiddenError` (never reveals existence).
   - `listAccessibleBrands()` → admin: `listBrandsForAgency(actor.agencyId)` each with `roles: []`; others:
     `listBrandsForUser(actor.userId)`.
   - `listAgencyMembers()` → `requireAdmin()` then `listAgencyMembers(db, actor.agencyId)` (the wrapper the
     onboarding page of TICKET-011 calls; pages never call `@tas/db` with a database of their own).
   Errors live in `apps/web/src/lib/auth/errors.ts` (`UnauthenticatedError`, `ForbiddenError`, both with a
   `code` literal).
4. `apps/web/src/lib/auth/index.ts` builds the request-scoped default with React `cache()`:
   `getAuth()` = `createAuth({ db: dbForRequest(), getSession: clerkSession })`, where
   `apps/web/src/lib/auth/clerk-session.ts` maps Clerk's `auth()` (`userId`, `orgId`, `orgRole`) and a lazy
   `currentUser()` to `Session`, and `apps/web/src/lib/db.ts` exports `dbForRequest()` = `cache(() =>
   createNeonDb(serverEnv().DATABASE_URL))` (TICKET-012b re-points it at `createDbFromUrl`). No
   `process.env`; no module-level `db` or `auth` constant (`grep -rn "^const db\|^export const db"
   apps/web/src` prints nothing).
5. `apps/web/src/lib/auth/user-menu.tsx` exports `UserMenu`, a thin wrapper around Clerk's `UserButton`,
   and `apps/web/src/lib/auth/org-switcher.tsx` exports `OrgSwitcher`, a thin wrapper around Clerk's
   `OrganizationSwitcher` (TICKET-010 renders both; TICKET-012b makes both bypass-aware). No logic inside
   either.
6. Unit tests in `apps/web/src/lib/auth/create-auth.test.ts` (Vitest, `// @vitest-environment node`,
   PGlite through `testDb()` and the TICKET-005 seed, a stubbed `getSession`, ≤3 lines of setup per test).
   The seeded agency has `clerk_org_id = 'org_seed'` and the seeded template brand has slug `template`;
   if TICKET-005's seed left either unset, this ticket sets them in `packages/db/src/seed.ts` (one line
   each, no other change to the seed) and lists that file in Files touched. Cases:
   (a) no session → `currentActor()` is `null`, `requireActor()` throws `UnauthenticatedError`;
   (b) first sight of a new `clerkUserId` inserts one `users` row with the given email and name; a second
   `currentActor()` leaves one row and `profile` was called exactly once across both calls;
   (c) a session whose `clerkOrgId` is `'org_seed'` gets `agencyRole 'member'` and exactly one
   `memberships` row after two calls; the seeded admin's session gets `'admin'`;
   (d) `requireAdmin()` passes for the seeded admin and throws `ForbiddenError` for a member and for a
   session with no org;
   (e) `requireBrandRole(child, 'strategist')` passes for the seeded strategist with `roles
   ['strategist']`; `requireBrandRole(child, 'designer')` throws; `requireBrandRole(template,
   'strategist')` throws; `requireBrandRole(child)` (no roles) passes for the strategist and throws for an
   unassigned member; the admin passes on both brands with `roles []`; a random uuid throws
   `ForbiddenError`;
   (f) `listAccessibleBrands()` returns `[child]` for the strategist and both seeded brands for the admin;
   `listAgencyMembers()` returns the seeded members for the admin and throws `ForbiddenError` for the
   strategist.
7. Route guard unchanged: TICKET-004's matcher test still passes; nothing in this ticket touches
   `middleware.ts`.
8. `docs/decisions.md` gets `D-017 · Auth reads in packages/db/src/auth` (next free number if taken; update
   this header). It lists every read in `packages/db/src/auth/` with its scope key: `findUserByClerkId`
   (clerk user id), `findAgencyByClerkOrgId` (clerk org id), `findMembership` (user id + agency id),
   `listAgencyMembers` (agency id), `listBrandsForAgency` (agency id), `findBrandForAgency` (agency id +
   brand id), `listBrandsForUser` (user id); `findBrandRoles` is brand-scoped through `withBrand`. None of
   the others is brand-scoped, all live only in `packages/db/src/auth/`, none runs in the privileged
   template scope (design §6), and criterion 2 proves user A never sees user B's brands. It also records
   the one exemption from the "every mutation goes through a domain function" rule: the identity
   bookkeeping upserts `upsertUserFromClerk` and `ensureMembership` are the only mutations in the codebase
   outside a domain function; they carry no business rule (a role is never changed) and are covered by
   criterion 2. The reviewer's checklist for this ticket includes reading D-017. No dependency added.
9. `docs/runbook.md` "Pending human verification" gets the gated line below.
10. `pnpm typecheck && pnpm lint && pnpm test` green from the root; diff under 300 lines excluding tests.

## Gated criteria (D-008)

- Real Clerk sign-in creates the `users` row: gated on Clerk keys. Runbook line:
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<pk> CLERK_SECRET_KEY=<sk> DATABASE_URL=<neon preview> pnpm test:e2e
  apps/web/e2e/auth.spec.ts` (TICKET-004's spec (b) is extended by one assertion: after sign-up, `/app`
  shows the signed-in user's full name read from the `users` row, `data-testid="actor-name"`).

## Files touched

`packages/db/src/auth/{users,agencies,memberships,brands,errors,index}.ts` and their `*.test.ts`,
`packages/db/src/index.ts` (re-export `auth`), `packages/db/src/seed.ts` (only per criterion 6),
`apps/web/src/lib/db.ts`,
`apps/web/src/lib/auth/{create-auth,create-auth.test,clerk-session,errors,index,user-menu,org-switcher}.ts(x)`,
`apps/web/src/app/app/page.tsx` (one line: render `actor.fullName` with `data-testid="actor-name"`),
`apps/web/e2e/auth.spec.ts` (one assertion in the gated half), `docs/decisions.md`, `docs/runbook.md`.

## Notes

- `packages/db/src/auth` is reads plus the two lazy upserts (`upsertUserFromClerk`, `ensureMembership`).
  They are identity bookkeeping, not business mutations; D-017 (criterion 8) records the exemption and a
  doc comment on each cites it. Role changes (promote to admin, remove a member) are not in this ticket.
- `Db` is the type TICKET-003 exports for the Drizzle instance; if TICKET-003 exposes `testDb()` from the
  package root instead of `@tas/db/testing`, import it from there.
- `BrandRole` and `AgencyRole` come from `@tas/db` (TICKET-005's enums re-export). TICKET-014 moves the
  arrays to `@tas/domain`; the unions keep their names, so this ticket does not change when that lands.
- `requireBrandRole` reads the brand row once (`agency_id`) so an admin of agency X cannot pass on a brand
  of agency Y. Keep that read even though V1 has one agency.
- The helpers throw; they never `redirect()`. The workspace layout (TICKET-010) maps
  `UnauthenticatedError` → `/sign-in` and `ForbiddenError` → `notFound()`. Server Actions map both to
  `{ ok: false }` results (TICKET-009).
- `UserMenu` and `OrgSwitcher` are server-safe wrappers; do not put session state into a client component.
