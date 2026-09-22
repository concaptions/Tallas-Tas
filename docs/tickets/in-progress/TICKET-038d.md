# TICKET-038d: QA — Client Portal Security & Functional Verification (PRD §10, §11)

Sprint 6 · Agent 4 (qa) · ~4h estimate · Depends on: 038a, 038b, 038c · Loop: report don't fix, max 3 iterations

## Why

The client portal's entire value proposition depends on data isolation. A leaked internal status,
creator cost, or platform source is not a UI bug — it's a trust violation with the client. QA
must verify the ACTUAL data returned by queries and network responses, not just what renders.

## PRD sections

§10, §11

## QA protocol

**Report findings. Do not fix them. If findings exist, report to the human and the implementing
agent. Max 3 QA iterations before escalating unresolved items.**

## Critical — do FIRST

### Network response audit

1. Open the client portal as a client-role user (demo mode if no Clerk).
2. Open browser DevTools → Network tab.
3. Navigate to each of the 6 client pages.
4. For EVERY Server Action / fetch response on each page, inspect the raw JSON payload.
5. **Assert ABSENT** from every response:
   - `creator_cost`, `cost_usd`, `budget_per_60s`, `partnership_price_per_30_days` (COST)
   - `source` on briefs (platform source: Insense/Billo/Backstage/TAS)
   - `platform` on creators (platform source)
   - `internal_status`, `internal_creator_status`, `internal_assets_status` (internal tracks)
   - `assignee` (team assignment)
   - `qa_video_editor`, `qa_designer`, `qa_strategist` (QA checklist)
   - `template_row_id`, `overridden_fields` (propagation internals)
   - `created_by`, `updated_by` (Clerk user IDs)
   - `legacy_airtable_id` (migration artefact)
   - Data from other brands (every `brand_id` in responses matches the client's brand)

6. **This is the Sprint 4 demo-mode/prod gap all over again** — verify the mechanism, not the symptom.
   If a field is absent from rendered HTML but present in the JSON response, that is a FAIL.

### Status filtering

7. Create/seed records in various status combinations:
   - Brief with `internal_status = 'video_editing_in_progress'`, `client_status = 'pending_for_approval'`
   - Brief with `internal_status = 'approved'`, `client_status = 'pending_for_approval'`
   - Brief with `internal_status = 'approved'`, `client_status = 'approved'`
8. Only the second record (internal=approved, client=pending) should appear on the Creatives page.
9. The first (internal not approved) must be completely absent — not greyed out, not hidden by CSS, ABSENT from the response.

## Functional verification

### Annotations

10. On a creative with an image, click to place an xy annotation. Enter text. Submit.
11. Reload the page. Confirm the pin appears at the same coordinates with the correct text.
12. On a creative that would be video-type, pin a timestamp annotation (or verify the timestamp UI renders if using placeholder video).
13. Confirm annotations from one creative don't appear on another.

### Comments

14. Post a top-level comment on a concept.
15. Reply to that comment (thread depth 1).
16. Attempt to reply to the reply — verify max depth is enforced (reply button absent or disabled).
17. Reload. Confirm thread structure persists.
18. Confirm comments on concept A don't appear on concept B.

### Approve / Request Revisions

19. Click Approve on a creative in the client portal.
20. Check the internal `/app/briefs` page — confirm `client_status` changed to `approved`.
21. Click Request Revisions on a copywriting entry.
22. Check the internal `/app/copywriting` page — confirm `client_status` changed to `revisions_needed`.
23. Verify the transition respects `canTransitionClient()` — a record that's already `approved` cannot be re-approved.

### Interface Config

24. In `/app/interface-config`, toggle the "UGC Management" page OFF for the demo brand.
25. Navigate to the client portal. Confirm the UGC tab/page is completely absent.
26. In a second brand (if available), confirm UGC is still visible (brand isolation).
27. Toggle "Hook examples" field OFF on Concepts for the demo brand.
28. Navigate to client Concepts page. Confirm "Hook examples" does not appear on any concept card.
29. Toggle it back ON. Confirm it reappears.

### Promotional Calendar

30. Confirm calendar shows campaign date ranges.
31. Confirm NO discount codes, financial details, or `confirmed_by_client`/`launched` flags appear.
32. Confirm the calendar page respects interface config toggle (if disabled, page absent from nav).

## Full suite

33. `pnpm typecheck` — zero errors
34. `pnpm lint` — zero warnings
35. `pnpm test` — all pass, including new allowlist enforcement tests from 038b
36. `pnpm build` — clean production build

## Report format

For each finding:
- **Severity**: Critical (data leak) / High (functional break) / Medium (UI issue) / Low (polish)
- **Page**: Which client page
- **What**: Exact field name or behaviour
- **Evidence**: Network response snippet, screenshot, or test output
- **Expected**: What should happen per the allowlist or acceptance criteria
