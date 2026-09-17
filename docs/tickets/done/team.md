# Team · Who works on what (PRD §11, §3)

- Page: `/app/team`, sidebar section `team` in the `settings` group (`href`-less today, so it renders
  with a `SoonChip`). Pattern: Personas, mirrored file for file — a table, not cards. Depends on the
  existing `schema/{users,memberships,brand-assignments}.ts`.

## Why

PRD §11: "Admin (me) — Everything, all brands … Client Success Manager — All brands assigned to
them", and "Each person gets their own account … that ends, because per-seat cost is no longer the
constraint." PRD §3: "TAS Digital should be added in a team dashboard, with their role and names."

## Acceptance criteria

1. `/app/team` renders inside the app shell with no frame, padding or background of its own, and the
   sidebar's Team section is active on it (`teamPath` added to `routes.ts` and `href` added to
   `nav.ts` in the same change, so its `SoonChip` is gone).
2. The page is a single `<table>` (`data-slot="team-table"`), one row per member
   (`data-slot="team-row"`), four columns in this order: **Name** (full name above the email in
   `text-text3`), **Role**, **Brands**, **Last active**. No detail panel, no row click.
3. The Role cell is a `StatusChip` from `@tas/ui` (`data-slot="role-chip"`), one fixed tone per role,
   never `rounded-full`. Its label comes from a pure `roleLabel(role)` in `packages/domain/src/roles.ts`,
   backed by `AGENCY_ROLE_LABELS` / `BRAND_ROLE_LABELS` maps over the existing `agencyRoles` /
   `brandRoles` tuples — no role string literal in any component.
4. The Brands cell lists the brands this person is assigned to, alphabetical, comma-separated plain
   text. An Admin shows **All brands** (admins are agency-wide and hold no `brand_assignments` rows);
   a member with none shows **No brands** in `text-text3` — never an empty cell, never "0".
5. Last active is a relative string ("3 days ago") formatted once on the server with a single `now` via
   `relativeTime` / `absoluteTime` (absolute value as the `title`), exactly as Personas does; a member
   who never signed in reads **Never**.
6. A note above the table states who may see this page, using `roleLabel`: "Admin and Client Success
   Managers only." `data-slot="team-access-note"`, toned through the tokens (`bg-surface2`, `text-text3`).
7. In demo mode the stub actor stands in for an admin: the page renders in full and the note adds one
   sentence saying so, there being no session to ask. Live mode is `admin` (agency) and `csm` (brand)
   only; anyone else gets the shell's existing not-authorised treatment, decided in `page.tsx` from
   `currentActor()`, never in a client component.
8. An **Invite member** button sits above the table (`data-slot="invite-member"`), disabled in demo
   mode through `DisabledWrite` + `disabledWriteClassName` from `@tas/ui`, tooltip "Sign in required
   to save changes". It opens nothing here — no invite form; in live mode it is disabled too and
   carries a `SoonChip`.

   `inviteMemberAction` in `apps/web/src/app/app/team/actions.ts` exists behind that button and is
   deliberately NOT wired to it. Say what it is plainly: **it sends no invitation.** There is no
   `invitations` table, no Clerk organisation-invitation call and no mail transport in this repo, so
   the action's whole contract is to RECORD THE INTENT — refuse in demo mode with
   `{ ok: false, error: 'Sign in required to save changes.' }`, validate the email and the role with
   zod (the role comes from the `@tas/domain` vocabularies; `client` is refused by name), re-check
   authorisation on the server with the domain's `canSeeTeamPage`, and return a typed receipt whose
   message says in words that nothing has left the app. It writes no row and never throws to the
   client. Wiring a form to it, persisting the intent and actually sending mail are a later ticket;
   until then no copy anywhere may claim an invitation was sent.
9. `demoTeam` in `packages/db/src/demo-data.ts` has **exactly 5 members**, hardcoded uuids and fixed
   timestamps, one per role: `admin` (agency), `csm`, `strategist`, `video_editor`, `media_buyer`. The
   brief assignees Dorian Vance, Imogen Bardsley and Rhiannon Okafor are three of the five, so
   `DEMO_QUEUE_ASSIGNEE` stays valid; two rows keep the seed's `user_seed_admin` /
   `user_seed_strategist` clerk ids (`DEMO_ACTOR_ID` is the latter), names and emails may change.
10. `seed(db)` inserts its users, memberships and brand assignments FROM `demoTeam` instead of the two
    hand-written rows in `seed.ts`, so a seeded database and the fixtures are row-for-row identical
    (ids included); `SeedResult` still exposes `admin` and `strategist`.
11. `listTeam(db)` in `packages/db/src/team.ts` joins `users` → `memberships` → `brand_assignments` →
    `brands`, returning one `TeamListRow` per user with `role`, `brandNames: string[]` and
    `lastActiveAt: Date | null`. Agency-wide, NOT brand-scoped: it never goes through `withBrand`. A
    PGlite test asserts an admin returns empty `brandNames`, a member only their assigned names.
12. `loadTeam()` in `apps/web/src/lib/team-source.ts` copies `personas-source.ts`: demo mode reads
    `demoTeam` from `@tas/db` and constructs **no** database client even when `DATABASE_URL` is set;
    live mode opens Neon per call and closes it in a `finally`. A connect-spy unit test with an
    injected throwing factory proves the demo branch never calls `connect`.
13. Colours go through the token layer only (no hex), rounding is `rounded-input` / `rounded-card`,
    no button is `rounded-full`, and no workflow status is invented for a team member.
14. `tsc --noEmit` and vitest are clean for `@tas/web`, `@tas/db` and `@tas/domain`;
    `apps/web/e2e/team.spec.ts` covers: five rows render, each with a role chip, the admin row reads
    "All brands", every row shows a last-active string, the note is visible, Invite member disabled.

Out of scope: actually sending an invitation (see criterion 8), editing or removing a member, changing a role, assigning a brand, per-brand
team columns on a brand page, notification routing (§12) and the role-based dashboard (§13).

## Files each agent touches

- domain: `packages/domain/src/roles.ts` + `roles.test.ts` (`roleLabel`, the two label maps)
- schema/db, all under `packages/db/src/`: `demo-data.ts` (`demoTeam`), `team.ts` + `team.test.ts`
  (`listTeam`, `TeamListRow`), `index.ts`, `seed.ts` (+ `seed.test.ts`), `schema/users.ts` (nullable
  `last_active_at` + generated migration)
- backend: `apps/web/src/lib/team-source.ts` + `team-source.test.ts`,
  `apps/web/src/app/app/team/actions.ts` + `actions.test.ts`, and `apps/web/src/lib/routes.ts`
  (`teamPath`, added with the source because the action revalidates that path — the app agent must
  NOT add it a second time)
- app: `apps/web/src/components/shell/nav.ts` (the `href`) and
  `apps/web/src/app/app/team/{page.tsx,team-workspace.tsx,fields.ts}`
- qa: `apps/web/e2e/team.spec.ts`

## Gated criteria

None. Every criterion runs locally in demo mode (no Clerk key, no database); db tests run on PGlite.
