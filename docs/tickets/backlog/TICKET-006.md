# TICKET-006 · CI on GitHub Actions

- Owner: integrator
- Size: S
- Depends on: TICKET-002 (the E2E job needs `apps/web/e2e` to exist), TICKET-004 (the kickoff tickets'
  decision entries end before D-015, which this ticket appends to the append-only file, and the E2E job
  assumes the Clerk-aware Playwright spec of TICKET-004 exists)
- PRD: §14.6 (cost: GitHub Actions free minutes on a private repo are enough for this volume), §16
  (delivery cadence: every check-in shows green checks). Tooling ticket; no product behaviour.
- Design: template-engine.md §3.3 (the `pnpm turbo run build --dry` cycle check), §12 package-direction
  decision (D-022 in this plan's numbering), §9 (TICKET-020 stage 2 and TICKET-037 stage 2b extend this
  workflow later)

## Why

The Definition of Done is enforced by agents on this machine today. Once a human pushes to GitHub, the same
four commands must run on every push so a reviewer can trust a green check instead of a pasted terminal
log, and the package graph is proven acyclic before the engine tickets make `@tas/db` depend on
`@tas/domain`.

## Acceptance criteria

1. `.github/workflows/ci.yml` exists with `name: CI`, triggers `push` (every branch) and `pull_request`,
   and a `concurrency` group keyed on `github.ref` with `cancel-in-progress: true`.
2. Job `checks` (`ubuntu-latest`): `actions/checkout@v4`; `pnpm/action-setup@v4` with no `version` input
   (it reads `packageManager` from the root `package.json`); `actions/setup-node@v4` with
   `node-version-file: .node-version` and `cache: pnpm`; then, as separate named steps in this order:
   `pnpm install --frozen-lockfile`, `pnpm turbo run build --dry` (fails on a cyclic workspace graph),
   `pnpm typecheck`, `pnpm lint`, `pnpm test`.
3. Job `e2e` runs only when `github.event_name == 'pull_request'`, `needs: checks`, same setup steps, then:
   restore `~/.cache/ms-playwright` through `actions/cache@v4` with key
   `playwright-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}`; `pnpm exec playwright install --with-deps
   chromium` only when the cache missed (`if: steps.<cache-step-id>.outputs.cache-hit != 'true'`), and
   `pnpm exec playwright install-deps chromium` always; `pnpm test:e2e` with `CI: 'true'` in `env`;
   `actions/upload-artifact@v4` of `playwright-report/` with `if: failure()` and `retention-days: 7`.
4. No secret and no service credential appears in the workflow. `grep -c "secrets\." .github/workflows/ci.yml`
   prints `0`.
5. Static validation without a GitHub remote: root devDependencies `@action-validator/core` and
   `@action-validator/cli` (exact major pinned, minor and patch float), root script
   `"ci:validate": "action-validator .github/workflows/ci.yml"`. `pnpm ci:validate` exits 0. A deliberately
   broken copy (for example `runs-on` misspelled) makes it exit non-zero; run that check once and paste the
   output in the QA report, do not commit the broken copy.
6. `pnpm turbo run build --dry` exits 0 on the current tree (this is the same command the workflow runs, so
   the reviewer sees it green locally).
7. `pnpm install` after adding the two devDependencies leaves `pnpm-lock.yaml` consistent:
   `pnpm install --frozen-lockfile` exits 0 immediately afterwards.
8. `docs/runbook.md` gets a section "CI" after "Everyday commands" that names the two jobs, when each runs,
   the Playwright cache key, and the local validation command. `docs/runbook.md` "Pending human
   verification" gets the gated line below.
9. `docs/decisions.md` gets `D-015 · CI on GitHub Actions` (next free number if D-015 is taken; update
   this header) listing the two devDependencies added and why (static schema validation of the workflow
   with no `act` and no remote), recording that E2E runs on pull requests only (cost: Playwright with a
   browser is the slowest job; pushes get the unit suite), and adding the hosted-service line D-006's cost
   table lacks: "GitHub Actions: 0 USD; private-repo free minutes (2,000/month) cover ~30 pushes and ~10
   PR E2E runs a week; E2E on PRs only keeps it there".
10. `pnpm typecheck && pnpm lint && pnpm test` stay green from the repo root.

## Gated criteria (D-008)

- First green run on GitHub: gated on a GitHub repository, which the human creates and pushes to. Runbook
  line: `gh repo create tas-creative-platform --private --source . --push && gh run watch` (from the repo
  root; expect job `checks` green on the push and, after opening the first pull request, job `e2e` green).
- The `e2e` job can only be green once the app boots without Clerk keys and with a local database.
  TICKET-012b adds `DATABASE_URL=pglite://.e2e/db` and `E2E_AUTH_BYPASS=1` to this job's `env`; until then
  the job is expected to fail on a pull request and that is not a defect of this ticket.

## Files touched

`.github/workflows/ci.yml`, root `package.json` (two devDependencies, `ci:validate` script),
`pnpm-lock.yaml`, `docs/runbook.md`, `docs/decisions.md`.

## Notes

- `pnpm/action-setup` before `actions/setup-node` is the documented order: `cache: pnpm` needs the pnpm
  binary to find the store path.
- Do not add `--filter` to the CI commands. Root scripts already run through Turborepo (D-009) and the
  Turborepo cache is local to the runner; remote caching is TICKET-007's optional item.
- Do not run `pnpm install` while another agent has a dependency change in flight (lockfile race,
  CLAUDE.md conventions). Announce the install in the report.
- `@action-validator/cli` ships platform binaries. If it does not install on darwin-arm64, replace it
  with `pnpm dlx js-yaml .github/workflows/ci.yml > /dev/null` as the `ci:validate` script (syntax check
  only) and say so in D-015; the workflow content criteria (1 to 4) are then checked with `grep` by QA.
- Nightly `test:load` (design §8, TICKET-037) is a later addition to this file; leave a comment-free
  structure that a second workflow file can sit beside.
