# Oct 7 audit: "62 pre-existing PGlite failures" — closeout

**Verdict: CLOSED.** Fresh run on main itself shows 0 failures.

## What was tested

| Item         | Value                                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Commit       | `08a22f6` — `fix: update test expectations for client_approval_status on concepts and creators` (tip of `origin/main`) |
| Checkout     | `git fetch origin --prune && git checkout main && git pull --ff-only` → already up to date; `git status` clean         |
| Install      | `pnpm install` → "Already up to date", no lockfile drift (`git status` still clean)                                    |
| Run started  | 2026-10-08T12:28:49Z                                                                                                   |
| Run finished | 2026-10-08T12:40:26Z                                                                                                   |
| Log          | `.audit-oct8/main-test-run.log` (3900 lines, full `pnpm test --force` output, no Turborepo cache)                      |

## Gate results

| Gate      | Command                  | Result                                                                                  |
| --------- | ------------------------ | --------------------------------------------------------------------------------------- |
| Typecheck | `pnpm typecheck --force` | 6/6 packages successful, 0 errors (run uncached on purpose; the cached run also passed) |
| Lint      | `pnpm lint`              | `eslint . --max-warnings 0` → 0 errors, 0 warnings                                      |
| Test      | `pnpm test --force`      | **Test Files 234 passed (234) · Tests 3203 passed (3203)** · Duration 689.52s           |

Failures in the log: none. `grep -E "×|FAIL "` over the log returns nothing.

## Comparison with the prior branch run

The pre-merge run on `claude/festive-euler-9578qg` (same tree as `08a22f6`, before fast-forward)
reported 234/234 files and 3203/3203 tests. The main run matches exactly, so the merge introduced
no drift and the counts are the same suite, not a subset.

## Where the 62 went

They were already gone by the time this branch landed: the two files that still failed after the
rebase onto main (`packages/db/src/gratsi-links-columns.test.ts`, 4 tests; `packages/db/src/column-seed.test.ts`,
3 tests) only needed their expectations updated for the `client_approval_status` platform column
on `concepts` and `creators` (commit `08a22f6`). No test was skipped, quarantined or deleted.

## Flake classification

No test failed, so no isolated re-run was needed.
