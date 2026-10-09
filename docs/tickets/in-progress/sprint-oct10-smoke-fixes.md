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
| SMOKE-05 | First click ignored on the Creative Sheet's Kanban toggle and "New creative" button. Reproduced with Playwright: a click that lands before React has hydrated the root is dropped (the button takes native focus, nothing opens), and the sheet hydrates every cell of every row. Not the brand-switcher shape (no form, no menu). Fix: the grid/board sits in its own `Suspense` boundary so the header controls hydrate first (React 18 selective hydration); the window that remains is the JS download on a cold visit. |
| SMOKE-06 | Internal Queue said "One brand in this workspace" with two brands live: the options were derived from the loaded rows, which are scoped to the working brand, so there was always exactly one. `queueBrandOptions` now takes the agency's brands from `loadBrandScope` (the switcher's list), template excluded, each with its row count. |
| SMOKE-07 | Brief page heading ran `creativeNameForConcept` at render time, so a manual-named brief (every imported row) showed a name it never had. `BriefName` renders `creative_briefs.name` verbatim with a mode-aware note; the formula runs at create time only (§7). |
| SMOKE-08 | Interface Config and Notifications 503 on background load (§10, §12) — PASS, no code change: on 156b699 both return 200 on normal load and on background prefetch in production (smoke test, 2026-10-10 evening); neither page calls an external API and both render under `/app/loading.tsx`. |
| SMOKE-09 | Internal Queue brand buttons showed "· 0" beside every non-active brand (Gratsi, 390 live creatives): the counts came from the loaded rows, which are scoped to the working brand. Each button now carries that brand's live brief count from ONE aggregate across the agency scope (`countLiveBriefsByBrand`, on the request's open connection), whichever brand is active. |
| AUDIT-13 | One client vocabulary (Talal, 2026-10-10): `concepts.client_approval_status` and `copywriting.client_approval_status` carry the six `CLIENT_STATUS` keys the Creative Sheet's `creative_briefs.client_status` already carries. Mapped in code — `clientApprovalStatuses` in `@tas/db/schema`, `CLIENT_APPROVAL_STATUS` derived from `CLIENT_STATUS` in `@tas/domain/state`, both writers normalise the retired four-value spelling — no migration: every row of both columns was NULL. `creators.client_status` (the creator track) is untouched and remains the UGC page's client status; `creators.client_approval_status` (76 NULL rows) stays until the frozen-tables drop. |

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
- [x] SMOKE-05: `creative-sheet-workspace.test.tsx` renders the page with `renderToString` and asserts the
      New creative button and the view switcher come before the first Suspense marker and the table after.
- [x] SMOKE-06: `internal-queue-source.test.ts` — two brands in scope yield two options (0 for the one
      without rows), the template never, an out-of-scope row stays reachable by id.
- [x] SMOKE-07: `brief-detail.test.tsx` — a manual brief's h1 is the stored name, never the formula's;
      an auto brief's h1 is the stored name too.
- [x] SMOKE-08: verified in production on 156b699 (200 on load and prefetch); nothing to change.
- [x] SMOKE-09: `internal-queue-source.test.ts` — active brand count, non-active brand count (390 with no
      row loaded), template excluded, empty scope / absent aggregate entry; the loader asks the aggregate
      for exactly the scope's ids. `briefs.test.ts` — `countLiveBriefsByBrand` on PGlite: per-brand counts,
      soft-deleted excluded, unnamed brands absent, empty list means no query.
- [x] AUDIT-13: `client-approval-status.test.ts` (the list IS `CLIENT_STATUS`; legacy keys map; tones from
      `chipTone`), `client-approval-actions.test.ts` (schema list equals the domain's; concepts and
      copywriting store a client-track key as is and the retired spelling as its mapped key; refusals
      and the reason rule), `copywriting/actions.test.ts` (`updateCopyClientApproval` the same).
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter @tas/web build:ci` on the final head.

## Pending human verification

- SMOKE-03 live: `/client/gratsi` in production after the deploy lands on `/client/gratsi/auth` ("Invalid
  Link") with one redirect; the live Playwright project needs the Gratsi brand in the E2E database.
- SMOKE-02 live: on brief `050ea4fe…` (TV01 … V1, imported names) the picker opens with 1:1 and 9:16
  ticked; ticking 4:5 shows "Saving…" then "Saved", and a refresh keeps all three.
