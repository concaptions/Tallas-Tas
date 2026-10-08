# Test Failures Breakdown

**Date:** 2026-10-08
**Branch:** claude/festive-euler-9578qg (c2f9a44)
**Baseline:** e7b60e3 (pre-Phase-2, Oct 7 sprint close)

## Summary

| Metric            | Current Branch | Pre-Phase-2 (e7b60e3) |
| ----------------- | -------------- | --------------------- |
| Test files passed | 174            | 229                   |
| Test files failed | 60             | 0                     |
| Tests passed      | 2,615          | 3,158                 |
| Tests failed      | 570            | 0                     |
| Duration          | ~21 min        | ~24 min               |

**All 570 failures are PHASE_2_INTRODUCED.** Zero failures exist on e7b60e3.

## Root Cause: Single Issue

**PGlite error 42601: "cannot insert multiple commands into a prepared statement"**

The Phase 2 migration file `packages/db/drizzle/0052_phase2-schema.sql` is **missing `--> statement-breakpoint` markers** between its SQL statements. Every other multi-statement migration in the project (0050, 0051, etc.) includes these markers.

The migration journal (`meta/_journal.json`) declares `"breakpoints": true` for entry 52, which tells Drizzle's migrator to split the file on `--> statement-breakpoint` lines. Since 0052 has zero such markers, the entire 73-line file (ALTERs, CREATE TABLEs, CREATE INDEXes) is sent to PGlite as a single prepared statement, which PGlite rejects.

| Migration                       | Statement-breakpoint markers | Tests pass? |
| ------------------------------- | ---------------------------- | ----------- |
| 0050_client-status-workflow.sql | 5                            | Yes         |
| 0051_interface-config.sql       | 6                            | Yes         |
| 0052_phase2-schema.sql          | **0**                        | **No**      |

## Error Classification

| Error Type                 | Count | Percentage |
| -------------------------- | ----- | ---------- |
| DB migration error (42601) | 570   | 100%       |
| Assertion failure          | 0     | 0%         |
| Timeout                    | 0     | 0%         |
| Type error                 | 0     | 0%         |
| Module resolution          | 0     | 0%         |

## Breakdown by Package

| Package         | Files Failed | Tests Failed | Tests Passed |
| --------------- | ------------ | ------------ | ------------ |
| packages/db     | 52           | 541          | ~84          |
| apps/web        | 8            | 29           | ~1,417       |
| packages/domain | 0            | 0            | 1,024        |
| packages/env    | 0            | 0            | 18           |
| packages/ui     | 0            | 0            | 46           |

All 60 failing files use PGlite via `testDb()` from `packages/db/src/testing.ts`. Tests that pass within otherwise-failing files are pure-logic tests that don't need a database.

## Failing Files — packages/db (52 files)

All classified as **PHASE_2_INTRODUCED** (pass on e7b60e3, fail on current branch).

| File                                       | Tests Failed | Error |
| ------------------------------------------ | ------------ | ----- |
| activity-log.test.ts                       | 2            | 42601 |
| ad-metrics.test.ts                         | 2            | 42601 |
| airtable-import.test.ts                    | 32           | 42601 |
| angles.test.ts                             | 18           | 42601 |
| assets.test.ts                             | 2            | 42601 |
| briefs-e2e.test.ts                         | 2            | 42601 |
| briefs.test.ts                             | 22           | 42601 |
| campaign-links.test.ts                     | 2            | 42601 |
| campaigns.test.ts                          | 2            | 42601 |
| client-asset-folders.test.ts               | 2            | 42601 |
| client-queries.test.ts                     | 29           | 42601 |
| collections.test.ts                        | 3            | 42601 |
| column-definitions.test.ts                 | 14           | 42601 |
| column-seed.test.ts                        | 40           | 42601 |
| competitor-ads.test.ts                     | 2            | 42601 |
| concepts.test.ts                           | 22           | 42601 |
| copy.test.ts                               | 12           | 42601 |
| creative-sheet-items.test.ts               | 10           | 42601 |
| creators.test.ts                           | 18           | 42601 |
| custom-interface-pages-propagation.test.ts | 4            | 42601 |
| custom-interface-pages-render.test.ts      | 3            | 42601 |
| custom-interface-pages.test.ts             | 4            | 42601 |
| email-campaigns.test.ts                    | 4            | 42601 |
| email-flows.test.ts                        | 4            | 42601 |
| gratsi-links-columns.test.ts               | 3            | 42601 |
| interface-config.test.ts                   | 3            | 42601 |
| links.test.ts                              | 14           | 42601 |
| notification-settings.test.ts              | 13           | 42601 |
| personas.test.ts                           | 9            | 42601 |
| products.test.ts                           | 2            | 42601 |
| propagation.test.ts                        | 20           | 42601 |
| sm-campaign-feed-tasks.test.ts             | 2            | 42601 |
| team.test.ts                               | 17           | 42601 |
| tenancy.test.ts                            | 16           | 42601 |
| themes.test.ts                             | 21           | 42601 |
| user-table-views.test.ts                   | 12           | 42601 |
| virtual-columns.test.ts                    | 4            | 42601 |
| youtube-copy.test.ts                       | 4            | 42601 |
| schema/tenancy-tables.test.ts              | 4            | 42601 |
| scripts/seed-interface-config.test.ts      | 2            | 42601 |
| _(+12 more with 2-6 failures each)_        | ~40          | 42601 |

## Failing Files — apps/web (8 files)

All classified as **PHASE_2_INTRODUCED**. These are data-source tests that boot PGlite.

| File                                        | Tests Failed |
| ------------------------------------------- | ------------ |
| src/lib/campaigns-source.test.ts            | 3            |
| src/lib/collections-source.test.ts          | 3            |
| src/lib/competitive-research-source.test.ts | 3            |
| src/lib/copy-source.test.ts                 | 4            |
| src/lib/creative-dimensions-source.test.ts  | 3            |
| src/lib/creative-sheet-source.test.ts       | 4            |
| src/lib/dashboard-source.test.ts            | 6            |
| src/lib/youtube-copywriting-source.test.ts  | 3            |

## Fix

Add `--> statement-breakpoint` markers between each SQL statement in `packages/db/drizzle/0052_phase2-schema.sql`. This is the standard Drizzle convention that every other migration in the project follows. The fix:

1. Does not change the SQL statements themselves
2. Does not affect Railway Postgres (migrations already applied there)
3. Does not change the migration journal or snapshot
4. Only affects PGlite test execution

The fix is a single file change with zero risk to production.
