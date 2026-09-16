# TICKET-010 · Brand switcher and workspace layout

- Owner: frontend
- Size: M
- Depends on: TICKET-008 (`getAuth()`, `listAccessibleBrands`, `requireBrandRole`, `UserMenu`,
  `OrgSwitcher`), TICKET-013 (`dropdown-menu`), TICKET-014 (`internalBrandRoles` from `@tas/domain`)
- PRD: §11 (brand switcher in the top nav; the brand name is the header of the workspace; each role sees
  only its assigned brands, Admin sees all), §3 (brand name becomes the workspace name in the top nav),
  Non-negotiable 10 (clients see zero internal data: the workspace is internal)
- Design: template-engine.md §9 TICKET-036 (adds a "Template" badge and the "Setting up from template"
  gate to this switcher later; keep the component open to a badge slot)

## Why

Every internal page lives under one brand. The layout that resolves `/app/brands/[brandSlug]` to a brand the
actor may see, and the switcher that moves between them, is the frame every Phase 3 table page drops
into. Building it once, on the TICKET-008 helpers, means no page ever re-derives access.

## Acceptance criteria

1. `apps/web/src/app/app/page.tsx` (replacing TICKET-004's placeholder): resolves `getAuth().requireActor()`
   (on `UnauthenticatedError` → `redirect('/sign-in')`), calls `listAccessibleBrands()`, filters to
   brands where the actor is admin or holds at least one `internalBrandRoles` role, and redirects to
   `/app/brands/<slug>` of the first brand by `pickWorkspaceBrand(brands)`. With none: renders the empty state
   from `apps/web/src/components/workspace/empty-state.tsx` with `data-testid="no-workspace"` and the text
   "No brands assigned yet"; for an actor with no `clerkOrgId` it also renders `OrgSwitcher` from
   TICKET-008 (TICKET-004's first-run affordance moves here); for an admin it links to
   `/app/onboarding` (the page arrives in TICKET-011).
2. `apps/web/src/app/app/(workspace)/brands/[brandSlug]/layout.tsx` (URL `/app/brands/<slug>`): `requireActor()`;
   `listAccessibleBrands()`; the brand whose `slug` equals the param, else `notFound()`;
   `requireBrandRole(brand.id, ...internalBrandRoles)` (admin
   passes); `ForbiddenError` → `notFound()`. Renders `TopNav` and the children. The layout contains no
   role logic beyond those calls.
3. `apps/web/src/components/workspace/top-nav.tsx`: brand name as the `<h1>` with
   `data-testid="workspace-name"`, the `BrandSwitcher`, and `UserMenu` from TICKET-008.
4. `apps/web/src/components/workspace/brand-switcher.tsx` (client component) built on the shadcn
   `dropdown-menu` of TICKET-013: trigger `data-testid="brand-switcher"` showing the current brand name;
   items from `brandSwitcherItems(brands, currentSlug)`, each `data-testid="brand-switcher-item"` linking
   to `/app/brands/<slug>`, the current one marked `aria-current="page"`; template brands are rendered with
   a `badge` slot that is empty in this ticket (TICKET-036b fills it).
5. `apps/web/src/components/workspace/items.ts` exports two pure functions with tests in `items.test.ts`:
   `brandSwitcherItems(brands, currentSlug)` → sorted by name, case-insensitive, `{ slug, name, isTemplate,
   current }[]` (test: three brands out of order come back sorted; `current` true for exactly the matching
   slug; unknown `currentSlug` marks none); `pickWorkspaceBrand(brands)` → the first non-template brand by
   name, else the template brand, else `null` (test: child before template; template alone; empty →
   `null`).
6. `apps/web/src/app/app/(workspace)/brands/[brandSlug]/page.tsx` renders "Workspace" and the actor's roles on this brand
   from `requireBrandRole`'s result (`data-testid="my-roles"`, admin shows "admin"); no data tables yet.
7. A client-only actor (assignments with role `client` only) at `/app` sees the empty state, not a brand
   redirect; at `/app/brands/<their brand slug>` gets `notFound()`. Both are covered by the E2E below; the logic
   is TICKET-008's `requireBrandRole` plus the `internalBrandRoles` filter of criterion 1.
8. Playwright `apps/web/e2e/brand-switcher.spec.ts`, using `signInAs` from
   `apps/web/e2e/helpers/auth.ts` (TICKET-012b): (a) seeded admin: `/app` redirects to the seeded child
   brand's URL; `workspace-name` shows its name; the switcher lists both seeded brands; clicking the
   template item navigates to `/app/brands/template` and the header changes; (b) seeded strategist: the
   switcher lists exactly one item; `/app/brands/template` returns the 404 page; (c) an identity with no
   assignments and `clerkOrgId: 'org_seed'` sees `no-workspace` (the org id keeps `OrgSwitcher` out of
   the render, so the case is independent of TICKET-012b's bypass-aware wrapper). Until TICKET-012b lands,
   the whole file is `test.skip(!process.env.E2E_AUTH_BYPASS, 'needs TICKET-012b test sign-in')` and
   `pnpm test:e2e` reports it as skipped with that reason, never as passed. The `process.env` read is in
   `apps/web/e2e/**`; the lint exemption for that directory exists from TICKET-004 (its spec (b) already
   reads Clerk keys from the environment). If it does not exist, stop and report: the integrator adds it
   in TICKET-012b; this ticket never edits `eslint.config.js`.
9. `pnpm typecheck && pnpm lint && pnpm test` green; `pnpm test:e2e` green with the new spec skipped
   (or green with it running once TICKET-012b is in); diff under 300 lines excluding tests.

## Gated criteria (D-008)

- E2E of criterion 8 runs only with TICKET-012b's test sign-in. It is not gated on a credential; it is
  gated on that ticket. Runbook line once TICKET-012b is done: `pnpm test:e2e apps/web/e2e/brand-switcher.spec.ts`.
- Real Clerk sign-in variant of (a): gated on Clerk keys, same command as TICKET-008's runbook line with
  this spec file.

## Files touched

`apps/web/src/app/app/page.tsx`, `apps/web/src/app/app/(workspace)/brands/[brandSlug]/{layout,page}.tsx`,
`apps/web/src/components/workspace/{top-nav,brand-switcher,empty-state}.tsx`,
`apps/web/src/components/workspace/items.ts` and `items.test.ts`, `apps/web/e2e/brand-switcher.spec.ts`.

## Notes

- No business logic in components: access is decided by TICKET-008's helpers and the `internalBrandRoles`
  array from `@tas/domain`; the two pure functions here are presentation order only.
- Canonical route tree (this ticket is the authority; every later ticket copies these paths verbatim):
  `/app` is the protected prefix (TICKET-004 matcher). The internal workspace lives at
  `/app/brands/[brandSlug]/...` with files under `apps/web/src/app/app/(workspace)/brands/[brandSlug]/`;
  admin pages live at `/app/admin/...` with files under `apps/web/src/app/app/(admin)/admin/`; the
  onboarding page is `apps/web/src/app/app/onboarding/page.tsx` (`/app/onboarding`). No ticket creates a
  second tree such as `/app/[brandSlug]` or `apps/web/src/app/app/admin/`.
- TICKET-029b adds a readiness gate to this layout; leave the layout's brand resolution as one function
  call so that gate is a one-line insertion after `requireBrandRole`.
- The client interface (PRD §10) is a separate route tree in Phase 4 (`/client/[brandSlug]`); this
  layout is internal-only by construction (criterion 2).
- Do not add brand settings, brand creation or the onboarding page here; TICKET-011 owns onboarding.
- Keep `TopNav` a server component; only `BrandSwitcher` is `'use client'`.
- No dependency and no decisions entry: `dropdown-menu` and its Radix package come from TICKET-013.
- Brand slugs are unique per agency (TICKET-005); with one agency in V1 the slug alone identifies the
  brand in the URL. When a second agency exists, the lookup in criterion 2 already goes through the
  actor's accessible list, so no cross-agency collision is possible.
- UI governance (CLAUDE.md "UI governance", from the 2026-09-16 design handoff): colours, fonts and radii
  only through the token classes (no hex, no `rounded-full` buttons); the brand status indicator in the
  switcher is a `StatusChip` (tone from `brandStatuses`: active → ok, paused → warn, archived → mute); status values from
  `@tas/domain/state`; any status pill or stepper row is `StatusChip` / `StepRow` from `@tas/ui`; every new
  primitive or status-bearing component gets a story rendered on the `/design-system` page before Done.
