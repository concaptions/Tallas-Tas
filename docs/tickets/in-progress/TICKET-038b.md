# TICKET-038b: Backend — Client-Scoped Query Layer & Actions (PRD §10, §11)

Sprint 6 · Agent 2 (backend) · ~6h estimate · Depends on: 038a · Blocks: 038c

## Why

The client portal's data safety depends on a dedicated query layer that enforces the field allowlist
at the SQL level, not at the UI level. A raw API response from a client-scoped query must never
contain an internal field, even if the frontend forgets to hide it.

## PRD sections

§10 (Client interface — configurable per client), §11 (Roles, brands and access — client role)

## Acceptance criteria

### Client-scoped query layer

1. New module `packages/db/src/client-queries.ts` (or `client-scope.ts`) with functions:
   - `clientConcepts(db, brandId)` — returns concepts with ONLY allowlisted fields, joins angle/theme/persona names
   - `clientCreatives(db, brandId)` — returns creative_briefs WHERE `internal_status = 'approved'`, ONLY allowlisted fields
   - `clientCopywriting(db, brandId)` — returns copywriting rows with ONLY allowlisted fields
   - `clientCreators(db, brandId)` — returns creators (general UGC) with ONLY allowlisted fields
   - `clientPartnershipAds(db, brandId)` — returns creators WHERE `for_partnership_ads = true`, ONLY partnership allowlisted fields, computes `expiresOn` from `partnership_activated_at + partnership_period_days`
   - `clientCalendarEvents(db, brandId)` — returns campaigns_offers with ONLY the 5 calendar fields (name, holiday, official_date, ads_launch_date, ads_end_date)

2. Each function uses explicit `SELECT` with named columns — NOT `SELECT *` with post-hoc stripping.
   The allowlist from `docs/design/sprint-06-client-field-allowlist.md` is the source of truth.

3. Each function is brand-scoped: `WHERE brand_id = $brandId AND deleted_at IS NULL`.

4. Creatives filter: `WHERE internal_status = 'approved'` — a creative the internal team hasn't
   signed off never appears in any client query, regardless of client_status.

### Interface Config filtering

5. `clientVisibleFields(db, brandId, pageKey)` reads the `interface_fields` table and returns
   only the fields where `visible = true` for that brand+page. Client queries use this to
   further restrict which of the allowlisted fields actually appear (a CSM can hide "Hook examples"
   for one brand via Interface Config).

6. If no interface config rows exist for a brand (new brand, not yet configured), fall back to
   `defaultInterfaceConfig()` from `@tas/domain` — all fields visible.

### Annotation & comment queries

7. `listAnnotations(db, brandId, recordType, recordId)` — returns annotations for a record, ordered by `created_at`.
8. `listComments(db, brandId, recordType, recordId)` — returns comments for a record, ordered by `created_at`, with `parentCommentId` for client-side threading.
9. Both are brand-scoped.

### Server actions

10. `createAnnotationAction(formData)` — validates kind, coordinates/timestamp, body. Requires authenticated user with brand access. Demo mode refused.
11. `createCommentAction(formData)` — validates body, optional parentCommentId (max depth 2). Requires authenticated user with brand access. Demo mode refused.
12. `approveRecordAction(formData)` — transitions `client_status` to `'approved'` on the specified record (briefs, copywriting, concepts, or creators). Uses existing `canTransitionClient()` from `@tas/domain/state`. Demo mode refused.
13. `requestRevisionsAction(formData)` — transitions `client_status` to `'revisions_needed'`. Same guard as above. Demo mode refused.
14. `updateClientFieldAction(formData)` — for fields marked `clientEditable: true` in interface config (client_comment, client_note, tracking_number). Validates the field is in the allowlist AND `clientEditable` before writing.

### Interface Config actions (admin-side, for /app)

15. `saveInterfaceConfigAction(formData)` — saves page/field toggles for a brand. Admin only.
    Extends existing infrastructure. Template brand saves propagate defaults to child brands
    that haven't overridden.

### Demo mode

16. All client-scoped data sources have a demo mode path that returns fixture data from
    `packages/db/src/demo-data.ts`. New demo fixtures:
    - 3–5 demo annotations (2 video_timestamp, 2 image_xy) on existing demo briefs
    - 5–8 demo comments (some threaded with parent_comment_id) on existing demo briefs and concepts
    - Calendar events already exist as demo campaigns_offers

### Tests — THE CRITICAL ONES

17. **Allowlist enforcement test**: For each of the 6 client query functions, assert that the
    returned object's keys are EXACTLY the allowlisted fields — no `internal_status`, no `source`,
    no `assignee`, no `creator_cost`, no `partnership_price_per_30_days`, no `budget_per_60s`.
    Use `Object.keys(result[0])` and assert against the allowlist.

18. **Cost/price exclusion test**: Insert a creator with `creator_cost = 500`, `budget_per_60s = 200`,
    `partnership_price_per_30_days = 1000`. Query via `clientCreators()`. Assert none of those
    three fields appear in the result. Same for `clientPartnershipAds()`.

19. **Platform source exclusion test**: Insert a brief with `source = 'Insense'`. Query via
    `clientCreatives()`. Assert `source` is absent from result.

20. **Internal status exclusion test**: Insert a brief with `internal_status = 'video_editing_in_progress'`.
    Query via `clientCreatives()`. Assert it returns 0 rows (not approved internally).

21. **Interface config filtering test**: Set `visible = false` for `hook_examples` on concepts
    for a brand. Query `clientConcepts()` with interface config applied. Assert `hook_examples`
    is absent.

22. **Annotation/comment CRUD tests**: Create, list, soft-delete.

23. **Client status transition tests**: Approve and Request Revisions flip the status correctly.

## Out of scope

- UI components (038c)
- Clerk middleware changes (not needed — existing auth is sufficient with brand_assignments check)
