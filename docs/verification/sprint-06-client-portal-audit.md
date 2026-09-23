# Sprint 6 Client Portal — Security Audit (TICKET-038d)

Date: 2026-09-23
Auditor: Claude Opus 4.6 (automated)

## Baseline

- **Tests:** 1910 passed / 135 files
- **Typecheck:** 6/6 clean
- **Lint:** 0 warnings
- **Build:** all 7 client routes render (`/client/[brandSlug]` + 6 pages)

## Network Response Audit

### Column allowlist verification

Every client query in `packages/db/src/client-queries.ts` uses explicit `.select({...})` with named columns. No `SELECT *`.

| Function | Dangerous fields checked | Result |
|---|---|---|
| `clientThemes` | id, name, category, isActive only | PASS |
| `clientAngles` | id, name, description, winning + junction names | PASS |
| `clientConcepts` | No creatorCost, internalStatus, source | PASS |
| `clientCreatives` | internalStatus as WHERE filter only, never returned | PASS |
| `clientCopywriting` | No cost fields, no internal fields | PASS |
| `clientCreators` | No creatorCost, costUsd, partnershipPrice | PASS |
| `clientPartnershipAds` | No partnershipPricePer30Days | PASS |
| `clientCalendarEvents` | No budget or internal fields | PASS |
| `listAnnotations` | No brandId/deletedAt in output | PASS |
| `listComments` | No brandId/deletedAt in output | PASS |

### Data flow tracing (per page)

All 6 pages are **pure server components** (no `'use client'` directive). Data flows:

1. Page calls `loadClient*()` → returns typed `Client*[]`
2. Server component renders table rows inline from typed objects
3. No client component receives the data array as props
4. RSC payload contains only rendered HTML, not raw data objects

No full objects passed to client components. No risk of hidden fields in page source.

### Demo fixture mode

`client-data-source.ts` fixture paths explicitly map only allowed fields from demo data — no spread operators, no pass-through of full fixture objects.

## Cross-Brand Isolation

| Layer | Mechanism | Verified |
|---|---|---|
| Query layer | `brandScope(brandId)` applies `eq(table.brandId, brandId) AND isNull(table.deletedAt)` on every branded query | YES |
| Themes | Global library (no brand filter — correct per non-negotiable 3) | YES |
| Junction queries | `loadAllAnglePersonas/Products` loads globally, but persona/product lookup maps are brand-filtered; cross-brand IDs resolve to `undefined` and are filtered out | YES |
| Tests | `client queries return nothing for a different brand` covers all 6 query functions | YES |
| Annotations | `listAnnotations is brand-isolated` test confirms empty for other brand | YES |

## Server Action Audit

| Action | Auth check | Brand resolution | Cross-brand safe | Demo refusal |
|---|---|---|---|---|
| `createAnnotationAction` | `actorId()` → `auth()` | `withBrandScope` → Clerk org | YES | YES |
| `createCommentAction` | `actorId()` → `auth()` | `withBrandScope` → Clerk org | YES | YES |
| `approveRecordAction` | `actorId()` → `auth()` | `withBrandScope` + `getBriefById(db, brandId, id)` | YES | YES |
| `requestRevisionsAction` | `actorId()` → `auth()` | `withBrandScope` + `getBriefById(db, brandId, id)` | YES | YES |

Brand resolution in actions uses Clerk org membership (not URL slug). A user can only mutate records within their own org's brand.

`getBriefById` uses `withBrand(db, brandId)` — a cross-brand `id` returns null, action fails with "no longer available."

## Annotation/Comment Security

- Insert-only: no delete/edit endpoints exist for client-facing annotations or comments
- Brand-scoped: both tables have `brand_id` FK + composite index `(brand_id, record_type, record_id)`
- Threaded comments: `MAX_COMMENT_DEPTH = 2` enforced server-side
- Check constraints: `video_timestamp` requires `timestamp_seconds`, `image_xy` requires `x` AND `y`

## Middleware / Route Access

- `/client/**` marked as public tree in `routes.ts` — correct for client portal (read-only access by brand slug)
- Server actions require Clerk auth — unauthenticated calls return "session expired" error
- No admin route links in client portal nav (checked both layouts)

## Findings

### CRITICAL: 0
### HIGH: 0
### MEDIUM: 0

### LOW: 1

**L-1: Junction loaders fetch globally.** `loadAllAnglePersonas` and `loadAllAngleProducts` load all junction rows across all brands. Defense-in-depth (brand-filtered lookup maps) prevents leakage, but adding brand-scoped junction loaders would reduce data touched per request. Not a security issue — optimisation only.

### Design Notes (not bugs)

- **Client portal read is public.** Knowing a brand slug grants read access. Proper client auth is a future ticket (see `docs/tickets/in-progress/real-auth.md`).
- **`loadClientCreatives` fixture returns `[]`.** Demo briefs aren't all marked "approved", so the internal-status gate correctly filters them out.

## Migration Status

- **Migration 0027** (`annotations` + `comments` tables): file present at `packages/db/drizzle/0027_clumsy_monster_badoon.sql`
- **Production:** pending manual verification

## Verdict

**PASS** — zero CRITICAL or HIGH findings. The client portal data layer enforces column allowlists, brand isolation, and auth on mutations. Safe to ship.
