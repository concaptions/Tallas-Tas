# Sprint Oct 10 — Smoke-test production fixes (SMOKE-01 … SMOKE-08)

**PRD sections**: §5.10 (Creative Briefs / Creative Design), §8 (delivery dimensions, standalone
statics), §9 (two-track approval), §7 (names are generated, never typed), §10 (client interface),
§12 (notifications).

The 2026-10-10 Cowork smoke test on `main` 55f31dc caught production bugs. One ticket per bug, in
the order they were fixed; each has one failing test first, then the fix.

| Ticket   | Scope |
| -------- | ----- |
| SMOKE-01 | Overview Pipeline tile showed "—" for `launched`, `revisions_needed`, `revisions_submitted`, `pending_for_approval`: since the single-source cutover the Creative Sheet's `status` IS the brief's `client_status` (six values) and the tile resolved it through the sheet's retired four-value `clientApprovalLabel`. The tile resolves through `CLIENT_STATUS` (§9). |
| SMOKE-02 | Brief page Dimensions picker: (a) `briefDimensions` looked stored values up raw, so an imported brief's Airtable placement names read as empty — no checkmarks; (b) a tick only set React state, nothing reached the server until "Save brief"; (c) had it saved, it would have replaced the stored array with the one ratio the browser could read. Fix: `briefDimensionKeys` normalises; the picker (`dimensions-picker.tsx`, hook-free) fires `onToggle` on every tick; `changeBriefDimensionAction` MERGES one change onto the stored array on the server (`applyDimensionChange` in `@tas/domain/creatives`) under the brief's advisory lock (`updateBriefDimensionsWith` in `@tas/db`), and logs it (§8). |
| SMOKE-03 | `/client/gratsi` ERR_TOO_MANY_REDIRECTS: `auth/page.tsx` rendered under `[brandSlug]/layout.tsx`, whose token gate redirected to `/auth` again. The gate's layout moved into the `(portal)` route group over every portal page; `auth` sits beside it. URLs unchanged (§10). |
| SMOKE-04 | Production data: brief 5dd5e834… reset `ad_submitted` → `video_editing_in_progress` with an `activity_log` row naming the reason; brief ae4193d7… (SMOKETEST-DELETE-ME-20261010) soft-deleted. One-off guarded script, run once, deleted. |
| SMOKE-05 | First click ignored on the Creative Sheet's Kanban toggle and "New creative" button (Tier 2). |
| SMOKE-06 | Internal Queue says "One brand in this workspace" with two brands live (Tier 2). |
| SMOKE-07 | Brief page heading recomputed the §7 name for a manual-named brief; the page shows `creative_briefs.name` verbatim (Tier 2, §7). |
| SMOKE-08 | Interface Config and Notifications 503 on background load (Tier 2, §10, §12). |

## Acceptance criteria

- [x] SMOKE-01: `overview-dashboard.test.tsx` renders the Creative Sheet tile with every
      `CLIENT_STATUS` key and pins the six labels; no chip starts with "—".
- [x] SMOKE-02: failing tests first — `fields.test.ts` (legacy names normalise), `dimensions-picker.test.tsx`
      (a tick fires `onToggle`), `brief-detail.test.tsx` (the page seeds the picker from the stored array
      and dispatches `changeBriefDimensionAction(id, { op, key })`), `dimensions.test.ts`
      (`applyDimensionChange` merges, never replaces), `briefs.test.ts` (`updateBriefDimensionsWith`
      serialises two concurrent changes on PGlite). The picker has a `/design-system` story.
- [x] SMOKE-03: `portal-gate.test.ts` reads the route tree: no layout beside `auth`, the gate under
      `(portal)`. E2E: demo `client-portal-gate.spec.ts` (auth route answers 200 with its h1); live
      `live/client-portal-gate.spec.ts` (`/client/gratsi` → one redirect → `/client/gratsi/auth`, 200, h1).
- [x] SMOKE-04: before/after rows printed; both writes guarded on the state the smoke test left.
- [ ] SMOKE-05 … SMOKE-08: see the Tier 2 entries as they land.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter @tas/web build:ci` on the final head.

## Pending human verification

- SMOKE-03 live: `/client/gratsi` in production after the deploy lands on `/client/gratsi/auth` ("Invalid
  Link") with one redirect; the live Playwright project needs the Gratsi brand in the E2E database.
- SMOKE-02 live: on brief `050ea4fe…` (TV01 … V1, imported names) the picker opens with 1:1 and 9:16
  ticked; ticking 4:5 shows "Saving…" then "Saved", and a refresh keeps all three.
