# Sprint Oct 8 — Creator Pool v2: ratings, photo backfill, cross-base import (PRD §5.8)

Oct 8 Talal message · lead + 3 agents · Depends on: Oct 8 audit gap closure (main `08a22f6`) ·
Blocks: nothing

## Why

The Creator Pool (global `creator_registry`, PRD §5.8 + Talal sync) lists 66 people but tells the
agency nothing about how each one performed, shows initials for 57 of them, and only knows the two
brands that live in this Postgres. Talal asked for three things on Oct 8: a per-brand 1–5 rating that
rolls up on the pool card, real profile photos, and the creators from his other client bases.

## PRD sections

§5.8 (UGC management / creators), §5.8.1 (partnership fields on the same record), Talal sync on the
global registry. Decisions: `docs/decisions.md` 2026-10-08 (two entries).

## Acceptance criteria

### Phase 1 — performance ratings
- [x] `creators` gains `performance_rating` (CHECK 1..5), `performance_note`, `performance_rated_at`,
      `performance_rated_by` — migration `0056_creator_performance_rating`, journal idx 56, `apply56.mjs`.
- [x] `creator_registry.avg_rating` recomputed by trigger on rating / link / soft-delete changes.
- [x] `@tas/domain/creators` `rating.ts`: `Rating`, `parseRating`, `rateCreatorForBrand`,
      `computeRegistryAverage` (round half up) — 11 unit tests.
- [x] `@tas/db` `creator-rating-queries.ts`: brand-scoped `updateCreatorPerformanceRating`,
      `loadCreatorPerformanceHistory`, `getRegistryAvgRating` — 7 PGlite tests incl. trigger behaviour.
- [x] `rateCreatorAction` (agency admin only, 1..5, note ≤ 1000) and `RatingStars` / `RatingWidget`
      wired into the creator panel, the pool card (read-only) and the registry detail per-brand rows;
      stories on `/design-system`.
- [ ] Migration 0056 applied to Railway (pending human — `docs/runbook.md`).

### Phase 3 — cross-base import (schema + scripts)
- [x] `creator_registry.brands jsonb` — migration `0057_registry_brand_history`, idx 57, `apply57.mjs`.
- [x] `AIRTABLE_SOURCE_BASES` in `@tas/env` + `.env.example`; `parseAirtableSourceBases`,
      `listAirtableCreatorRows`, `findRegistryMatch`, `storeRegistryProfilePic` helpers with tests.
- [x] `airtable-enumerate-creators.ts` (read-only inventory, `--limit`, `--out`).
- [x] `import-creators-from-airtable.ts` (dry-run default, `--apply`, idempotent, PGlite-tested).
- [ ] Real enumeration + import runs (pending human: needs `AIRTABLE_PAT`, `AIRTABLE_SOURCE_BASES`
      and Talal's confirmation per base).

### Phase 2 — photo backfill
- [x] `backfill-ig-profile-pics.ts` (unavatar.io, 5 req/s, R2 `creator-registry/`, ≤ 2 MB, images only).
- [x] `backfill-registry-from-airtable.ts` (inventory attachments → R2).
- [ ] Real runs + `.audit-oct8/ig-backfill-report.md` (pending human: R2 + network).

### Phase 4 — verification
- [ ] `packages/db/qa-registry-v2.mjs` run against Railway; `.audit-oct8/creator-pool-v2-report.md`.

## Gated criteria

`pnpm typecheck` · `pnpm lint` (0 warnings) · `pnpm test` (≥ 3203 + new tests) before every commit.

## Out of scope

Un-merging the Oct 8 name-grouped registry rows; Instagram Graph API; a client-facing rating view
(non-negotiable 10: ratings are internal).
