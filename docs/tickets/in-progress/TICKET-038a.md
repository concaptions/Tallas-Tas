# TICKET-038a: Schema & Access Architecture — Client Portal (PRD §10, §11)

Sprint 6 · Agent 1 (schema) · ~4h estimate · Depends on: nothing · Blocks: 038b, 038c

## Why

The client portal needs two new subsystems (annotations, threaded comments) and must extend the
interface config to support 6 pages including a new Promotional Calendar. The field allowlist in
`docs/design/sprint-06-client-field-allowlist.md` is the contract between this ticket and 038b.

## PRD sections

§10 (Client interface), §11 (Roles, brands and access)

## Acceptance criteria

### New tables

1. **`annotations`** table in `packages/db/src/schema/annotations.ts`:
   - `id` (uuid PK, `defaultRandom()`)
   - `brandId` (uuid FK brands, NOT NULL)
   - `recordType` (text NOT NULL) — which table the annotation belongs to (`creative_briefs`, `copywriting`, etc.)
   - `recordId` (uuid NOT NULL) — the row in that table
   - `authorId` (text NOT NULL) — Clerk user ID
   - `authorName` (text NOT NULL) — display name at time of annotation (denormalised for client display)
   - `kind` (text NOT NULL, typed as `'video_timestamp' | 'image_xy'`)
   - `timestampSeconds` (real, nullable) — for video annotations only
   - `x` (real, nullable) — for image annotations, normalised 0–1
   - `y` (real, nullable) — for image annotations, normalised 0–1
   - `body` (text NOT NULL) — the annotation text
   - `createdAt`, `updatedAt` (timestamptz)
   - `deletedAt` (timestamptz, nullable, soft delete)
   - Indexes: `(brand_id, record_type, record_id)` for loading annotations per record
   - Constraint: `video_timestamp` requires `timestamp_seconds IS NOT NULL`; `image_xy` requires `x IS NOT NULL AND y IS NOT NULL`

2. **`comments`** table in `packages/db/src/schema/comments.ts`:
   - `id` (uuid PK, `defaultRandom()`)
   - `brandId` (uuid FK brands, NOT NULL)
   - `recordType` (text NOT NULL) — which table
   - `recordId` (uuid NOT NULL) — which row
   - `parentCommentId` (uuid, nullable, FK self-referencing `comments.id`) — for threading
   - `authorId` (text NOT NULL) — Clerk user ID
   - `authorName` (text NOT NULL) — denormalised
   - `body` (text NOT NULL)
   - `createdAt`, `updatedAt` (timestamptz)
   - `deletedAt` (timestamptz, nullable, soft delete)
   - Indexes: `(brand_id, record_type, record_id)` for loading comments per record; `(parent_comment_id)` for thread children
   - Max nesting depth enforced in domain, not schema (2 levels: top-level + replies)

### Interface Config extension

3. Add `'calendar'` to the `interfacePageKeys` pg enum in `packages/db/src/schema/enums.ts` (6th value).
4. Add `'calendar'` to `INTERFACE_PAGE_KEYS` in `packages/domain/src/interface/config.ts`.
5. Add calendar page defaults to `DEFAULT_INTERFACE_PAGES`:
   ```
   { pageKey: 'calendar', label: 'Promotional Calendar', fields: [
     { fieldName: 'campaign_name', label: 'Campaign', clientEditable: false },
     { fieldName: 'holiday', label: 'Holiday', clientEditable: false },
     { fieldName: 'official_date', label: 'Official Date', clientEditable: false },
     { fieldName: 'ads_launch_date', label: 'Ads Launch', clientEditable: false },
     { fieldName: 'ads_end_date', label: 'Ads End', clientEditable: false },
   ] }
   ```
6. Update `demoInterfaceConfig` in `packages/db/src/demo-data.ts` to include the calendar page.

### Migrations

7. Generate Drizzle migration for annotations, comments, and the enum extension.
8. Migration is backwards-compatible — no existing columns renamed or removed.

### Documentation

9. The field allowlist at `docs/design/sprint-06-client-field-allowlist.md` is reviewed and committed alongside the schema. It lists every field per client page and every excluded field with reason.

### Clerk role confirmation

10. Confirm `brand_role` enum already contains `'client'`. Document in the allowlist that:
    - A client user has a `brand_assignments` row with `role = 'client'`
    - A client user has NO row in `memberships` (no agency-level access)
    - `isInternalBrandRole(role)` in `@tas/domain/roles.ts` returns `false` for `'client'`
    - The `/client` layout resolves brand from the viewer's `brand_assignments` where `role = 'client'`

### Tests

11. Schema test: annotations and comments tables exist with expected columns.
12. Enum test: `INTERFACE_PAGE_KEYS` has 6 entries, `interfacePageKeys` pg enum matches.
13. Interface config test: `defaultInterfaceConfig()` returns 6 pages including calendar with 5 fields.

## Out of scope

- Query layer (038b)
- UI (038c)
- Data seeding beyond interface config defaults
