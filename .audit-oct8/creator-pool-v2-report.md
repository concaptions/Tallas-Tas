# Creator Pool v2 — ratings, photo backfill, cross-base import

**Branch:** `claude/festive-euler-9578qg` (base: main `08a22f6`) · **Date:** 2026-10-08
**Status of live steps: PENDING HUMAN.** This cloud container has no `DATABASE_URL`, no R2, no
`AIRTABLE_PAT`, and its egress proxy rejects Railway, api.airtable.com and unavatar.io, so nothing
below ran against production. Every live step is listed with its exact command in
`docs/runbook.md` → "Pending human verification" (three new entries dated 2026-10-08).

## Commits on the branch

| SHA       | What                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `60c6af3` | Rating schema (migration 0056 + trigger), registry brand history (0057), domain rating module, brand-scoped rating queries, Airtable/registry/R2 helpers, env, docs |
| `5727be2` | `backfill-ig-profile-pics.ts`, `backfill-registry-from-airtable.ts` + PGlite tests                                                                                  |
| `4e25340` | `RatingStars` primitive in `@tas/ui`                                                                                                                                |
| `aa56b14` | `rateCreatorAction`, `RatingWidget`, creator panel / pool card / registry detail wiring, design-system stories                                                      |
| `5b65e66` | `airtable-enumerate-creators.ts`, `import-creators-from-airtable.ts` + tests                                                                                        |

## Phase 1 — performance ratings

| Item          | Result                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema        | `creators.performance_rating` (int, CHECK 1..5), `performance_note`, `performance_rated_at`, `performance_rated_by`                                                                                                                                                                                                                                                                                             |
| Roll-up       | `creator_registry.avg_rating` = round-half-up mean of live linked brand ratings, maintained by trigger `creators_registry_avg_rating` (fires on rating, re-link, soft-delete, delete). Verified on PGlite through the real drizzle migrator: trigger, columns and CHECK present; 7 PGlite tests pin the trigger to `computeRegistryAverage`                                                                     |
| Migration     | `packages/db/drizzle/0056_creator_performance_rating.sql`, journal idx 56, `packages/db/apply56.mjs` (BEGIN / SQL / journal insert / COMMIT, rollback on failure, hash guard so a re-run is a no-op)                                                                                                                                                                                                            |
| Domain        | `@tas/domain/creators` → `rating.ts`: `Rating`, `isRating`, `parseRating`, `rateCreatorForBrand` (RangeError on 0/6/2.5, note > 1000, blank actor), `computeRegistryAverage` — 11 tests                                                                                                                                                                                                                         |
| Queries       | `@tas/db` → `updateCreatorPerformanceRating` (withBrand-scoped; other brand gets `null`), `loadCreatorPerformanceHistory`, `getRegistryAvgRating` — 7 PGlite tests                                                                                                                                                                                                                                              |
| Action        | `apps/web/src/app/app/ugc/rating-actions.ts`: demo refusal → zod → Clerk `auth()` → domain validation → `withBrandScope` → `getActiveBrandRole === 'admin'` (same helper the page uses for `canRate`) → brand-scoped write → `revalidatePath('/app/ugc')` — 11 tests incl. csm / video_editor / expired-session refusals                                                                                        |
| UI            | `RatingStars` (keyboard radiogroup, `--warn` / `--text4` tokens, `rounded-input`), `RatingWidget` (note + counter, Saving…/Saved, inline error, "Rated by `<id>` 3 days ago"). Wired: creator panel section "Performance rating" (editable for admins), Creator Pool card (read-only average), registry detail "Ratings" list (Brand · stars · note · rated by · rated at). Stories mounted on `/design-system` |
| Railway apply | **NOT RUN** — `cd packages/db && DATABASE_URL=… node apply56.mjs`                                                                                                                                                                                                                                                                                                                                               |
| Visual smoke  | **NOT RUN** (no dev credentials, no browser against prod). Verified by unit/PGlite tests and the `/design-system` stories                                                                                                                                                                                                                                                                                       |

## Phase 3 — cross-base import (schema + scripts)

| Item      | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema    | `creator_registry.brands jsonb NOT NULL DEFAULT '[]'` of `{brandLabel, sourceAirtableBaseId, firstSeenAt}` — migration `0057_registry_brand_history`, idx 57, `apply57.mjs`                                                                                                                                                                                                                                                                                                                                                         |
| Config    | `AIRTABLE_SOURCE_BASES` (JSON array, `@tas/env` + `.env.example`), parsed by `parseAirtableSourceBases` with per-base field-name overrides; a base not listed is never read                                                                                                                                                                                                                                                                                                                                                         |
| Enumerate | `pnpm --filter @tas/db airtable-enumerate-creators -- [--limit N] [--out path]` → `.audit-oct8/airtable-creators-inventory-<date>.json` (read-only, no Postgres)                                                                                                                                                                                                                                                                                                                                                                    |
| Import    | `pnpm --filter @tas/db import-creators-from-airtable -- --file <inventory> [--apply]`. Match by Instagram handle, then by name only against a row with `total_brands >= 1` (two different namesakes never merge — tested); appends the brand to `brands[]` and bumps `total_brands` once per base (idempotent — second run 0/0, tested); inserts a global row for anyone new; photos re-hosted to R2 only, never the Airtable CDN url. Dry run = same work in a rolled-back transaction, so counts equal `--apply` — 7 PGlite tests |
| Real runs | **NOT RUN** — need `AIRTABLE_PAT`, `AIRTABLE_SOURCE_BASES` and Talal's per-base confirmation                                                                                                                                                                                                                                                                                                                                                                                                                                        |

## Phase 2 — photo backfill

| Item      | Result                                                                                                                                                                                                                                                                                                                                                                  |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instagram | `pnpm --filter @tas/db backfill-ig-profile-pics [-- --apply]`: rows with a handle and no photo → `https://unavatar.io/instagram/<handle>?fallback=false` → validated image ≤ 2 MB → R2 `creator-registry/<id>/<uuid>.<ext>`; 200 ms between requests (5 req/s); refuses `--apply` without R2; writes `.audit-oct8/ig-backfill-report.md` in both modes — 8 PGlite tests |
| Airtable  | `pnpm --filter @tas/db backfill-registry-from-airtable -- --file <inventory> [--apply]`: inventory rows with an attachment → match (Instagram, then name) → fill only a null `profile_pic_url` via R2 — 7 PGlite tests                                                                                                                                                  |
| Real runs | **NOT RUN** — unavatar.io and R2 unreachable from here. Expected effect on Railway: `with profile_pic_url` grows from ~9; the two report files record exact counts                                                                                                                                                                                                      |

## Phase 4 — verification

- `packages/db/qa-registry-v2.mjs` (read-only): schema readiness (4 rating columns, brands column, trigger, CHECK), registry totals, photo counts (and how many are R2-hosted), `avg_rating` drift vs brand ratings, external-brand counts, suspicious-merge table with LOW/MEDIUM/HIGH. **NOT RUN** against Railway.
- Gates on the branch (`5b65e66`): `pnpm typecheck --force` 6/6 clean · `pnpm lint` 0 errors 0 warnings · `pnpm test --force`: see "Full suite" below.

## Full suite

`pnpm test --force` on `5b65e66` (log: `.audit-oct8/creator-pool-v2-test-run.log`):
**Test Files 245 passed (245) · Tests 3285 passed (3285)** · Duration 741.17 s. That is 3203 + 82 new
tests (11 domain rating, 7 rating queries, 13 helper, 15 photo backfill, 9 enumerate/import, 11
rating action, 16 RatingStars/fields). The two `FAIL …` lines in the log are the backfill scripts'
own per-row log output inside passing tests (a 3 MB image and a 404 are the cases under test).

## Before / after counts

| Metric             | Before (Oct 8 audit) | After                                    |
| ------------------ | -------------------- | ---------------------------------------- |
| Registry rows      | 66                   | unchanged until the import runs          |
| With profile photo | ~9                   | unchanged until the backfills run        |
| With avg_rating    | 0                    | unchanged until an admin rates a creator |
| With brands[] > 1  | n/a (column new)     | unchanged until the import runs          |

## Oct 9 — first live run of `stream-airtable-to-r2.mjs` (run by Talal's operator, log: `.audit-oct8/stream-r2.log`)

Preconditions verified on the operator's machine: R2 LIST/PUT/DELETE on `tas-site-media` (after a
merged `R2_BUCKET`/`R2_PUBLIC_BASE` line in `.env.local` was split), Railway reachable
(`creator_registry` = 812 rows), Airtable PAT working on 55 bases.

| Metric                                 | Value                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------- |
| Bases walked                           | 55 (9.3 min)                                                            |
| Records seen                           | 999                                                                     |
| Matched to a registry row              | 540 (48 registry rows carry an Instagram key; the rest matched by name) |
| Unmatched                              | 459                                                                     |
| Pics uploaded to R2                    | 52 (0 failed, 1 already on R2)                                          |
| Matched records with no pic attachment | 487                                                                     |
| Videos                                 | skipped — `creator_registry` has no video column yet                    |
| Verification                           | `total 812 · pics_in_r2 52`                                             |

**Why 487 "no attachment".** A field probe on five bases shows the pic candidates do not exist in
most tables; the only attachment field is `Creator's Intro` (Star Voice 14/15, FIXD 11/100, Holistic
Hercules 9/9), which the script treats as a video and skipped. Not Your Grandmas has an `Assignee`
attachment field only; Pandaloo has none.

**Bases with zero matches (26 bases, 456 records) — NOT imported, needs Talal's approval per base:**
Ergonomist 97 · SOS Performance Gear 46 · Blackout Coffee 2025 45 · Pongfinity 31 · Clean Green 27 ·
Letter School 24 · K9 Cabins 23 · 3AM Latte 18 · Mattress Central 17 · Panther in the Room 14 ·
The Wisdom World 11 · Comfylabs 11 · Nutty Hero 11 · Funding Fred 11 · Calzone Kitchen 9 ·
The Sample Select 9 · Turkista 8 · Mindra 7 · Santa Mood 7 · Rise Bands 6 · MacKinnon Watches 5 ·
Niagara Sleep Solutions 5 · Bellalab 5 · Rushie 4 · Automatten 4 · Nathan James 1.
The remaining 3 unmatched records are Pandaloo (2) and FIXD (1). Niagara Sleep Solutions scoring 0
is worth a look: Niagara is one of the two brands already in Postgres, so its base's names do not
match the registry's spelling.

**Script changes made in response (same file, pushed to the branch):**

1. Per-base schema diagnostics from `/meta/bases/{id}/tables`: each base prints which pic/video
   field it has, or `NOT FOUND` with the attachment fields it does have; "no attachment" is now
   split into _field missing in table_ vs _field empty on record_, per base and in the totals.
2. Videos go to `intro_videos jsonb` when that column exists (one entry per attachment, keyed by the
   Airtable attachment id, so re-runs append nothing twice); `video_intro_url text` remains a
   fallback; neither present → skipped with a NOTE. Videos over 500 MB are refused.
3. A name match is accepted only when exactly one live registry row carries that name; ambiguous
   names are logged (`AMBIG …`) and listed in the summary, never guessed.
4. The summary lists every base with zero matches and its record count, and every base that has
   matches but no pic field together with its attachment fields, for the mapping fix.

## Deviations and follow-ups for the lead/reviewer

1. **Diff size.** The rating UI (`aa56b14`) is ~740 non-test lines and the Phase 3 scripts ~386,
   both over the 300-line DoD per ticket. The ticket `docs/tickets/in-progress/sprint-oct8-creator-pool-v2.md`
   groups them; the reviewer may want it split into UI primitive / action+panel / pool list, and
   enumerate / import.
2. **Trigger vs domain rule.** Logged in `docs/decisions.md` (2026-10-08): the roll-up is a derived
   aggregate touched by soft-delete and re-link paths, so it lives in Postgres with the domain's
   `computeRegistryAverage` as the pinned reference.
3. **`total_brands` and external brands.** `updateRegistryCreatorStats` recounts linked Postgres
   brands only and would undercount a creator whose extra brands are external; it is not called on
   import. Any future recount must add `jsonb_array_length(brands)`.
4. **Soft-deleted handle owner.** If a soft-deleted registry row owns an Instagram handle, the import
   reports the row in `errors` rather than reviving it — decide whether revival is wanted.
5. **`insertRegistryCreator` strips `createdBy`/`updatedBy`**, so the import sets the actor in a
   follow-up update. Letting the helper accept those two columns would remove one statement.
6. **No Playwright E2E** for the rating flow: it does not cross a page boundary. No screenshots: no
   browser session against the app exists here.

## Slack draft for Talal

> Three things landed for the Creator Pool today, all on the feature branch and green on the full
> suite:
>
> 1. **Ratings** — as an admin you can now give each creator a 1–5 rating plus a note per brand
>    (in the creator panel on UGC). The Creator Pool card shows the average across brands, and the
>    pool detail lists every brand's rating.
> 2. **Photos** — two scripts fill the missing profile pictures: one pulls public Instagram avatars
>    for the creators with a handle, the other takes the photo from the same creator's row in your
>    other bases. Both dry-run first and only write re-hosted copies (no expiring Airtable links).
> 3. **Other bases** — a script imports creators from your other client bases into the global pool
>    and records which brands each person has worked with, without merging two different people
>    who share a name.
>
> What I need from you: the list of bases you want imported (base id + creators table id + a brand
> label per base) and the OK that we may read each one — I will not touch a base you have not named.
> The two migrations and the scripts run from a machine with database access; the exact commands
> are in the runbook.
