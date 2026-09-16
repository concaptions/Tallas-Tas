# TICKET-011 · Onboarding wizard

- Owner: frontend
- Size: M
- Depends on: TICKET-009 (`createAgencyAction`, `createBrandAction`, `createBrandInput`,
  `teamAssignmentInput`), TICKET-010 (workspace layout and the admin empty state that links here),
  TICKET-013 (`input`, `label`, `select`, `card`)
- PRD: §3 (adding a client is a short setup: brand name, website, team assignment with CSM, creative
  strategist, video editor(s), designer(s), media buyer; client users; notification routing and
  interface configuration derive from it later), §11 (roles), §14.2 (onboarding is a form, not a base
  clone)
- Design: template-engine.md §4.1 ("A brand created before the template is populated seeds whatever
  exists. Onboarding never waits on the template"), §9 TICKET-01x-B (the wizard builds on the action)

## Why

PRD §14.2 is one of the seven reasons for the project: onboarding a client must be a form. The actions
exist (TICKET-009); this ticket is the form, wired so the first run (no agency yet) and every later brand
use the same page.

## Acceptance criteria

1. Page `apps/web/src/app/app/onboarding/page.tsx` (server component): `requireActor()`
   (`UnauthenticatedError` → `redirect('/sign-in')`); computes `wizardStep({ hasAgency: actor.agencyId !==
   null, isAgencyAdmin: actor.agencyRole === 'admin', isOrgAdmin: actor.clerkOrgRole === 'org:admin' })`
   and renders that step; when the step is `'forbidden'` → `notFound()`.
2. `apps/web/src/components/onboarding/step.ts` exports the pure `wizardStep(input)` →
   `'create-agency' | 'create-brand' | 'forbidden'`: `'create-agency'` when `!hasAgency && isOrgAdmin`;
   `'create-brand'` when `hasAgency && isAgencyAdmin`; `'forbidden'` otherwise. Test `step.test.ts` covers
   all four combinations of `hasAgency` and the admin flags, including `hasAgency && !isAgencyAdmin` →
   `'forbidden'`, `!hasAgency && !isOrgAdmin` → `'forbidden'`, and the case criterion 6 relies on:
   `{ hasAgency: false, isAgencyAdmin: false, isOrgAdmin: true }` → `'create-agency'`.
3. Step "Create your agency" (`apps/web/src/components/onboarding/agency-step.tsx`, client component):
   one field "Agency name" (`data-testid="agency-name"`), submit `data-testid="create-agency"` calling
   `createAgencyAction`; on `{ ok: true }` it calls `router.refresh()` so the page re-renders into the
   brand step; on `{ ok: false }` it shows `message` in `data-testid="form-error"`. Client-side validation
   reuses `createAgencyInput` from `@tas/domain` (no rule is restated in the component).
4. Step "Create the first brand" / "Add a brand" (`brand-step.tsx`, client component; the title depends
   on whether `listAccessibleBrands()` returned any non-template brand, passed in as a prop): fields "Brand
   name" (`brand-name`), "Website" (`brand-website`, optional), and the team assignment block
   (`team-assignment-fields.tsx`) with one select per PRD §3 role: CSM (`team-csm`), Creative Strategist
   (`team-strategist`), Video editors (`team-video-editors`, multi), Designers (`team-designers`, multi),
   Media buyer (`team-media-buyer`); options are `getAuth().listAgencyMembers()` (TICKET-008 criterion 3)
   passed in by the page. Client-side validation reuses `createBrandInput`. Submit `data-testid=
   "create-brand"` calls `createBrandAction`; success → `router.push('/app/brands/<slug>')`; failure → `form-error`
   with the returned `message` (`slug_taken`, `not_a_member`, `invalid_slug` surface verbatim).
5. "Client users" block (`client-users-placeholder.tsx`): a card titled "Client users" with the copy
   "Client invitations arrive with the client interface. Nothing is stored yet." and no input
   (`data-testid="client-users-placeholder"`). It sends `clients: []`. This is the PRD §3 placeholder the
   ticket title names; no email is collected or stored.
6. `apps/web/src/app/app/page.tsx` (TICKET-010) redirects to `/app/onboarding` whenever
   `wizardStep({ hasAgency, isAgencyAdmin, isOrgAdmin })` is not `'forbidden'` (an org admin with no
   agency yet, or an agency admin with no brands); every other actor with no brands sees the TICKET-010
   empty state unchanged. The page computes the step with the same pure function; no rule is restated.
7. Playwright `apps/web/e2e/onboarding.spec.ts` with `signInAs` (TICKET-012b), skipped with the reason
   "needs TICKET-012b test sign-in" until then (same pattern as TICKET-010): (a) identity `{ clerkUserId:
   'user_e2e_founder', email: 'founder@e2e.test', fullName: 'E2E Founder', clerkOrgId: 'org_e2e_fresh',
   clerkOrgRole: 'org:admin' }` visits `/app` → lands on `/app/onboarding` showing `agency-name`; types
   "E2E Agency", submits → the brand step appears with the founder selectable in every role; fills
   "Niagara Sleep Solutions", `https://example.com`, assigns the founder to all five roles, submits →
   URL is `/app/brands/niagara-sleep-solutions` and `workspace-name` reads "Niagara Sleep Solutions"; the
   switcher lists "Niagara Sleep Solutions" and "Template"; (b) the same founder opens `/app/onboarding`
   again → the brand step with title "Add a brand"; submitting "Niagara Sleep Solutions" again shows
   `form-error` containing "slug"; (c) the seeded strategist opening `/app/onboarding` gets the 404 page.
8. No `process.env`, no direct database access and no business rule in `apps/web/src/components/
   onboarding/**` (`grep -rn "process.env\|@tas/db" apps/web/src/components/onboarding` prints nothing;
   the page reads through `getAuth()` only, including `listAgencyMembers()`).
9. `pnpm typecheck && pnpm lint && pnpm test` green; `pnpm test:e2e` green with the new spec skipped or
   running; diff under 300 lines excluding tests.

## Gated criteria (D-008)

- E2E of criterion 7 runs only with TICKET-012b's test sign-in (ticket gate, not a credential). Runbook
  line once TICKET-012b is done: `pnpm test:e2e apps/web/e2e/onboarding.spec.ts`.
- Real Clerk variant: a human signs up, creates the Clerk organisation, and completes both steps in the
  browser on a preview deployment (TICKET-007). Recorded as a manual check in the runbook.

## Files touched

`apps/web/src/app/app/onboarding/page.tsx`, `apps/web/src/app/app/page.tsx` (redirect branch),
`apps/web/src/components/onboarding/{wizard,agency-step,brand-step,team-assignment-fields,
client-users-placeholder}.tsx`, `apps/web/src/components/onboarding/step.ts` and `step.test.ts`,
`apps/web/e2e/onboarding.spec.ts`.

## Notes

- The page passes data down; the step components call Server Actions and render results. Every rule
  (who may create, what a valid team is, what the slug is) is in `@tas/domain` and the TICKET-009
  factories; the wizard restates none of it.
- No dependency and no decisions entry: the form components come from TICKET-013.
- The template brand is created by `createAgencyAction`; the wizard never shows it as a choice and never
  lets a brand be named so that its slug is `template` (the action refuses; the form shows the message).
- Notification routing and interface configuration (PRD §3 bullets 4 and 6) derive from the team
  assignment in Phase 5 and Phase 4; nothing here anticipates them.
- Read `listAgencyMembers()` once in the page; multi-selects filter that list client-side.
- After TICKET-029b the brand step's redirect lands on "Setting up from template" (design §4.1);
  TICKET-029b and TICKET-036b own that gate, not this ticket.
- UI governance (CLAUDE.md "UI governance", from the 2026-09-16 design handoff): colours, fonts and radii
  only through the token classes (no hex, no `rounded-full` buttons); status values from
  `@tas/domain/state`; any status pill or stepper row is `StatusChip` / `StepRow` from `@tas/ui`; every new
  primitive or status-bearing component gets a story rendered on the `/design-system` page before Done.
