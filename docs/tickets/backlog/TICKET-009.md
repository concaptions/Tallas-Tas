# TICKET-009 · createAgency and createBrand

- Owners, in order: integrator (stage 1, `packages/db/src/brand/persist.ts`, the persistence of the
  non-branded tenancy tables) then backend (stage 2, domain functions and Server Actions)
- Size: M
- Depends on: TICKET-014 (`@tas/domain`, `internalBrandRoles`), TICKET-008 (`requireActor`,
  `requireAdmin`, `listAgencyMembers`, `findAgencyByClerkOrgId`)
- PRD: §3 (brand onboarding captures name, website, team assignment: CSM, creative strategist, video
  editor(s), designer(s), media buyer, plus client users), §11 (roles), §14.2 (onboarding is a form, not a
  base clone), §14.1 (one template: every brand is a child of the agency template)
- Design: template-engine.md §3.1 (A1 one template brand per agency; `template_brand_id`; every
  non-template brand has exactly one template), §4.1 (the brand-creation action is where the seed run is
  inserted in TICKET-029a: "Onboarding never waits on the template"), §9 TICKET-01x-B

## Why

The agency and its brands are the roots of every tenancy edge. Creating them must be a validated,
transactional domain operation that the onboarding wizard (TICKET-011) merely renders, and the brand
persistence must already have the exact shape the seed job hooks into, so Phase 2 adds one statement and
one call instead of rewriting onboarding.

## Acceptance criteria

## Stage 1 (integrator) · `packages/db/src/brand/persist.ts`

1. `packages/db/src/brand/persist.ts` exports two functions that take the transaction and a plain plan
   object (the shapes stage 2's `planAgency` / `planBrand` return, declared here structurally as
   `AgencyPlanInput` and `BrandPlanInput` so stage 1 needs nothing from stage 2):
   - `persistAgency(tx, plan: AgencyPlanInput, actorId)` inserts the `agencies` row (`clerk_org_id` from
     the plan), the template brand (`is_template true`, `template_brand_id NULL`, slug `template`, status
     `active`) and the actor's `admin` membership, in that order, and returns
     `{ agencyId, templateBrandId }`.
   - `persistBrand(tx, plan: BrandPlanInput, actorId)` inserts the `brands` row (`is_template false`,
     `template_brand_id` from the plan) and then every assignment through
     `withBrand(tx, brand.id).insert(brandAssignments)` (so `brand_id` is forced whatever the payload
     carries) and returns `{ brand }`.
   Unique violations are not caught here; the driver error propagates and stage 2 maps it. `persistBrand`
   is the only code that inserts a non-template `brands` row; its doc comment states that TICKET-029a
   appends the `propagation_runs` seed insert (`createRun`) as its last statement. That is the single
   insertion point; no placeholder code, no `TODO`.
2. Tests `packages/db/src/brand/persist.test.ts` on PGlite through `testDb()`: `persistAgency` writes one
   agency, one template brand pointing at nothing and one admin membership; `persistBrand` writes one
   brand with `template_brand_id` = the seeded template and one `brand_assignments` row per assignment,
   every one with `brand_id` = the new brand even when the plan's assignments carry a foreign `brandId`;
   a second `persistBrand` with the same `(agency_id, slug)` throws the driver's unique-violation error
   and leaves no assignment rows (the caller's transaction rolls back).
3. `packages/db/src/index.ts` exports both functions and the two input types.

## Stage 2 (backend) · domain functions and Server Actions

4. `packages/domain/src/brand/slug.ts`: `slugify(name: string): string` (NFKD fold, lowercase, non
   `[a-z0-9]` runs → `-`, trim `-`, cut at 48 characters without a trailing `-`; returns `''` when nothing
   remains) and `reservedSlugs = ['template', 'new'] as const` (`template` is the agency template
   brand's own slug; `new` is kept free for a create route under `/app/brands/`). Test `slug.test.ts`:
   `'Niagara Sleep Solutions'` → `'niagara-sleep-solutions'`; `'  Café  Ünïcode!! '` → `'cafe-unicode'`;
   `'B2 / Test'` → `'b2-test'`; a 60-character name is cut to ≤48 with no trailing `-`; `'!!!'` → `''`.
5. `packages/domain/src/brand/create-agency.ts`: zod `createAgencyInput` (`name` trimmed, 2 to 80
   characters), `canCreateAgency(actor: { clerkOrgId, clerkOrgRole }, existing: { id } | null)` →
   `'ok' | 'no_org' | 'not_org_admin' | 'exists'` (`'ok'` only when `clerkOrgId` is set, `clerkOrgRole ===
   'org:admin'` and `existing` is `null`), and `planAgency(input, actor)` → `{ agency: { name, slug,
   clerkOrgId }, templateBrand: { name: 'Template', slug: 'template', isTemplate: true, status: 'active'
   }, adminMembership: { role: 'admin' } }` (assignable to stage 1's `AgencyPlanInput`). Test
   `create-agency.test.ts` covers all four `canCreateAgency` results and the plan shape.
6. `packages/domain/src/brand/create-brand.ts`: zod `teamAssignmentInput` = `{ csm: uuid, strategist:
   uuid, videoEditors: uuid[] (min 1), designers: uuid[] (min 1), mediaBuyer: uuid, clients: uuid[]
   (default []) }` (exactly the PRD §3 roles plus client users), zod `createBrandInput` = `{ name (2 to
   80), website?: url, slug?: string, team: teamAssignmentInput }`, `assignmentsFor(team)` →
   `{ userId, role: BrandRole }[]` de-duplicated on `(userId, role)`, `assertAssignableMembers(assignments,
   memberUserIds: string[])` throwing `NotAMemberError(userId, role)` for any `internalBrandRoles`
   assignment whose user is not an agency member (`client` assignments are exempt, D-003), and
   `planBrand(input, ctx: { agencyId, templateBrandId })` → `{ brand: { agencyId, name, slug, website,
   templateBrandId, isTemplate: false, status: 'active' }, assignments }` (assignable to
   `BrandPlanInput`) where `slug = input.slug ?? slugify(name)` and a slug that is `''` or in
   `reservedSlugs` throws `InvalidSlugError`. Test `create-brand.test.ts`: one user in two roles gives two
   rows; the same user twice as designer gives one; a non-member CSM throws `NotAMemberError`; a
   non-member client does not; missing `mediaBuyer` fails validation; `name 'Template'` throws
   `InvalidSlugError`; the plan carries `templateBrandId` and `isTemplate false`.
7. `apps/web/src/lib/action-result.ts`: `ActionResult<T> = { ok: true; data: T } | { ok: false; code:
   string; message: string }` and `toActionError(e)` mapping `UnauthenticatedError`, `ForbiddenError`,
   zod errors and the domain errors above to codes (`unauthenticated`, `forbidden`, `invalid_input`,
   `not_a_member`, `invalid_slug`, `agency_exists`, `slug_taken`); anything else rethrows.
8. `apps/web/src/app/app/(admin)/admin/agency/actions.ts` (`'use server'`) exports `createAgencyAction(raw:
   unknown)` built by `createAgencyActions({ auth, db })` from
   `apps/web/src/app/app/(admin)/admin/agency/create-agency-actions.ts`: `requireActor()`;
   `findAgencyByClerkOrgId`; `canCreateAgency` must be `'ok'` (else `{ ok: false, code }` with the result
   as the code); `planAgency`; one `db.transaction` calling `persistAgency(tx, plan, actor.userId)`; a
   unique violation on `clerk_org_id` returns `agency_exists`. Returns `{ agencyId, templateBrandId }`.
   The action module contains no Drizzle query (`grep -c "tx.insert\|db.insert" apps/web/src/app/app/\(admin\)/admin/agency/*.ts`
   prints `0`).
9. `apps/web/src/app/app/(admin)/admin/brands/actions.ts` (`'use server'`) exports `createBrandAction(raw:
   unknown)` built by `createBrandActions({ auth, db })` in `create-brand-actions.ts`: `requireAdmin()`;
   parse; template brand = the `isTemplate` entry of `listBrandsForAgency(db, actor.agencyId)` (missing →
   code `no_template_brand`); `assertAssignableMembers` against `listAgencyMembers`; `planBrand`; one
   `db.transaction` calling `persistBrand(tx, plan, actor.userId)`. A unique violation on `(agency_id,
   slug)` returns `slug_taken`. Returns `{ brandId, slug }`. No Drizzle query in the module (same grep
   on the `brands` directory prints `0`).
10. Tests `apps/web/src/app/app/(admin)/admin/**/*.test.ts` on PGlite with `createAuth` from TICKET-008 and
    a stubbed session (≤3 lines of setup): (a) `createAgency` by an org admin with no agency creates the
    agency, one template brand (`is_template true`, `template_brand_id null`, slug `template`) and one
    admin membership; the same call again returns `agency_exists`; a member (`clerkOrgRole 'org:member'`)
    gets `not_org_admin`; (b) `createBrand` by the seeded admin with all five roles pointing at seeded
    members creates one `brands` row with `template_brand_id` = the seeded template and `is_template
    false`, and `findBrandRoles` on the new brand returns the assigned roles for each user; (c) every
    inserted assignment has `brand_id` = the new brand even when the raw input carries a foreign
    `brandId` field (ignored by the schema); (d) the seeded strategist calling `createBrand` gets
    `forbidden`; (e) a second brand with the same name gets `slug_taken`; (f) a CSM who is not a member
    gets `not_a_member` and no row is written.
11. `pnpm typecheck && pnpm lint && pnpm test` green from the root; the two stages together stay under
    300 lines excluding tests.

## Gated criteria (D-008)

none

## Files touched

Stage 1: `packages/db/src/brand/persist.ts` (+ test), `packages/db/src/index.ts`.
Stage 2: `packages/domain/src/brand/{slug,create-agency,create-brand,errors,index}.ts` and tests,
`packages/domain/src/index.ts` (re-exports), `apps/web/src/lib/action-result.ts`,
`apps/web/src/app/app/(admin)/admin/agency/{actions,create-agency-actions}.ts` and test,
`apps/web/src/app/app/(admin)/admin/brands/{actions,create-brand-actions}.ts` and test.

## Notes

- Stage 1 writes nothing under `packages/domain`; stage 2 writes nothing under `packages/db`. The
  backend never touches the database directly: the actions call `planX` then `persistX`.
- Route tree: admin files live under `apps/web/src/app/app/(admin)/admin/**` (URL `/app/admin/...`), the
  canonical tree TICKET-010 states. Server Action modules are not wrapped by the admin layout's
  `requireAdmin()` (TICKET-034); each action guards itself.
- `createAgency` cannot sit behind `requireAdmin()`: no membership exists before the agency does. The
  Clerk org admin (the person who created the org, D-003) is the only one who may run it, and only once
  per org. After it, `requireAdmin()` works because the membership row exists.
- `clients` accepts existing `users` ids only; client invitations (Clerk invitation flow) belong to the
  client interface phase. TICKET-011 shows the placeholder text for that.
- Do not seed the new brand here; do not import Inngest. TICKET-029a appends `createRun` inside
  `persistBrand`; TICKET-029b calls `enqueueRun` in `createBrandActions` after the transaction.
- `reservedSlugs` protects the template brand's slug and the `/app/brands/new` route; no decisions entry
  is needed (no dependency, no deviation).
- `website` is stored as given after zod `url()` validation; other brand links (PRD §3) arrive with the
  brand settings page, not here.
- Keep the Server Action files (`actions.ts`) to the `'use server'` export lines; the factories hold the
  logic so tests inject `auth` and `db`.
