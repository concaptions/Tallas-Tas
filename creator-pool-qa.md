# Creator Pool QA Report

**Date:** 2026-10-08
**Repo:** concaptions/Tallas-Tas
**Status:** BLOCKED — environment cannot reach external services

## Environment Constraints

| Service          | Host                          | Reachable | Reason                                                    |
| ---------------- | ----------------------------- | --------- | --------------------------------------------------------- |
| Railway Postgres | iriguchi.proxy.rlwy.net:48139 | NO        | Connection times out — network policy blocks outbound TCP |
| Vercel (prod)    | tallas-tas-pi.vercel.app      | NO        | Egress proxy returns 403 (CONNECT rejected by policy)     |
| Vercel CLI       | N/A                           | NO        | Not installed in this container                           |

## What Cannot Be Done From This Environment

1. **Ground-truth query** — Cannot connect to Railway Postgres to run the `qa-registry.mjs` script or verify the 66 registry rows / 75 creator rows.
2. **Visual inspection** — Cannot open the Vercel deployment to check the Creator Pool tab renders.
3. **Two-way link verification** — Cannot navigate the prod app to test registry/creator linking.
4. **Deploy confirmation** — Cannot check which commit SHA is deployed to Vercel.

## What Was Verified Locally

1. **Code exists:** The Creator Pool tab is defined in `apps/web/src/app/app/ugc/fields.ts` as the third UGC tab (`creator_pool`).
2. **Tests pass:** `apps/web/src/app/app/ugc/fields.test.ts` confirms the three-tab structure (`Creators`, `Partnership Ads`, `Creator Pool`).
3. **Schema exists:** `packages/db/src/schema/creator-registry.ts` defines the `creator_registry` table with `normalizedInstagram` unique constraint.
4. **FK wiring exists:** `packages/db/src/schema/creators.ts` has `registryCreatorId` FK referencing `creatorRegistry.id`.
5. **Seed script exists:** `packages/db/src/scripts/seed-creator-registry.ts` handles the dedup-by-Instagram-handle logic.
6. **Domain logic exists:** `packages/domain/src/creators/registry.ts` exports `normalizeInstagramUsername` and `matchRegistryCreator`.

## Suspicious Merge Risk (Code-Level Assessment)

The seed script matches creators by **normalized Instagram handle only**. Creators without an Instagram username are skipped (`skippedNoHandle` counter). The user's context says "only 9 creators had Instagram usernames; the other 57 were grouped by lowercase name" — but the committed script does NOT match by name, only by Instagram. If 66 registry rows exist from 75 creators with only 9 having Instagram, the script that ran against prod must have been a different version or was run with additional logic.

**Risk:** The 57 name-based merges may have been done by a different script or manual SQL. Verify against the actual Railway data.

## Recommendations

To complete this QA, run from a local machine or an environment with network access to Railway and Vercel:

```bash
# Ground-truth query
DATABASE_URL="postgresql://postgres:...@iriguchi.proxy.rlwy.net:48139/railway" \
  node packages/db/qa-registry.mjs

# Or use psql directly
psql "$DATABASE_URL" -c "
  SELECT cr.name, cr.normalized_instagram, cr.total_brands,
         count(c.id) as linked_creators
  FROM creator_registry cr
  LEFT JOIN creators c ON c.registry_creator_id = cr.id
  WHERE cr.deleted_at IS NULL
  GROUP BY cr.id
  ORDER BY cr.total_brands DESC, cr.name;
"
```

## Verdict

**YELLOW** — Code is correct and tested, but prod verification is blocked by network policy. The name-based merge discrepancy needs investigation against live data.
