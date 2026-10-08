# Creator Pool prod QA — Oct 8

**Repo:** concaptions/Tallas-Tas · **main:** `08a22f6` · **Checked:** 2026-10-08 (UTC)
**Status:** BLOCKED — this agent's container cannot reach Railway Postgres or the Vercel deployment.
No verdict (GREEN / YELLOW / RED) is given, because none of the prod-facing steps could be observed.

## Deploy info

| Item                      | Result                                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Prod URL                  | `https://tallas-tas-pi.vercel.app`                                                                                                |
| Probe from this container | `HTTP/1.1 403 Forbidden` — the egress proxy rejects the CONNECT (network policy), so the response never came from Vercel          |
| Deployed SHA              | NOT VERIFIED — no Vercel access from here, no Vercel CLI installed, `gh`/GitHub deployment statuses not available in this session |
| Expected SHA              | `08a22f6` (main after the Oct 8 fast-forward merge)                                                                               |

Per the task's own rule ("if deploy is not 08a22f6 or newer, STOP"), the deploy gate could not be
passed or failed — it is unobserved. Steps 2–5 below were therefore not run against prod.

## Ground truth summary

NOT RUN. Railway Postgres (`iriguchi.proxy.rlwy.net:48139`) times out on a raw TCP connect from this
container and `DATABASE_URL` is not present in the shell. The reusable script is delivered and
syntax/lint checked; it has not been executed against live data:

```bash
cd packages/db
DATABASE_URL="postgresql://…@iriguchi.proxy.rlwy.net:48139/railway" \
  node qa-registry.mjs > ../../.audit-oct8/creator-pool-qa.raw.md
```

It prints, read-only: every live registry row (id, name, normalized_instagram, total_brands,
total_projects, linked creator count, actual distinct linked brands); the linked brand creators
under each registry row; multi-brand rows; `total_brands` drift (stored vs actual); and the
suspicious-merge table (rows with no Instagram key whose sources span 2+ brands) with a
LOW / MEDIUM / HIGH risk column computed from the source creators' names.

Expected from the task context (unconfirmed): 66 registry rows, 75 linked creators, 0 unlinked,
2 brands, 9 Instagram-keyed rows, 57 name-grouped rows.

## Suspicious merges

NOT DETERMINED — depends on the ground-truth run above. `qa-unmerge-proposal.sql` was not drafted
because no HIGH merge has been observed; drafting one from guessed ids would be fabrication.

## UI verification

| Step                                            | Result                                                               |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| Sign in as agency admin                         | NOT RUN — no Clerk credentials in this environment, prod unreachable |
| UGC workspace → Creator Pool tab, per brand     | NOT RUN                                                              |
| Registry row count vs ground truth              | NOT RUN                                                              |
| 3 random registry entries → brand history panel | NOT RUN                                                              |
| total_brands = 2 row shows both brands          | NOT RUN                                                              |
| Brand creator → registry entry navigation       | NOT RUN                                                              |
| Registry entry → brand creator navigation       | NOT RUN                                                              |

## Approval status column

| Check                                  | Result                                                                                                                                                                                                                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Column present on creators grid (prod) | NOT RUN in prod. Verified in code and tests on main `08a22f6`: `creators.client_approval_status` is a seeded platform column labelled "Client Approval" at displayOrder 31 (`packages/db/src/column-seed.ts`), asserted by `column-seed.test.ts` and `gratsi-links-columns.test.ts` |
| Save works                             | NOT RUN — the one permitted write was not attempted. Nothing on Railway was touched                                                                                                                                                                                                 |

## What was verified from this environment

- Main `08a22f6` passes typecheck, lint (0 warnings) and the full suite — see `62-failures-closeout.md`.
- Migration `0055_client-approval-concepts-creators.sql` is in the journal at idx 55 (the task context
  says it is already applied on Railway; not re-verified from here).
- `packages/db/qa-registry.mjs` passes `node --check` and `eslint --max-warnings 0`.

## Final verdict

**BLOCKED.** Run the three prod-facing parts from a machine with Railway + Vercel access:

1. `node packages/db/qa-registry.mjs` with `DATABASE_URL` set → paste the output into this file.
2. Confirm the Vercel production deployment SHA is `08a22f6` or newer.
3. Walk the UI steps above as an agency admin and fill in the two tables.

Then set the verdict. A prior attempt from the same kind of container recorded the same blockers in
`creator-pool-qa.md` at the repo root (Oct 8).
