# TICKET-023 · Domain propagation plan: `coalesceChanges`, `planChildChange`, chunking

- Owner: backend (`packages/domain/src/template/**`)
- Size: M
- Depends on: TICKET-022
- PRD: §5 (a parent change is replicated; child edits are not overwritten: "sometimes we test an idea
  in a child base"), §14.1
- Design: §2 (I3, I11, I12 plan half; I14 the resend / retry rules), §3.3 (`ChangeGroup`, `ChildPlan`),
  §3.6 (outcome kinds, informative set), §4.3 (request-path backstop: the five-minute rule), §4.4 step 1
  (coalescing, child chunking) and step 2 (the plan table, outcome precedence), §4.8 (delete / restore /
  new-row rules the table encodes), §5.2 (`stepBudget`), §5.4 (`findRunsToResend` predicates), §8
  (Domain row), §11 (single-kind collapsing and fixed chunks rejected)

## Why

The whole propagation decision (what to write, what to skip, what is a conflict) is one pure function
over a parent row, a child row and a link map. Putting it in domain makes every row of the design's
rule table a fixture test that runs without a database, and lets seed, resync and propagation share it.

## Acceptance criteria

1. `src/template/coalesce.ts`: `coalesceChanges(changes: TemplateChange[], specs: readonly
   TemplatedFieldSpec[]): ChangeGroup[]` returns one group per `(tableName, rowId)` with two independent
   parts: `lifecycle` = the last of `insert | soft_delete | restore` by `seq`, or `'none'` when the group
   holds only updates; `fields` = the union of `changedFields` across the group, replaced by every
   `propagatedFields` entry when `lifecycle` is `insert` or `restore`; `lastChangeId` = the id of the
   highest `seq`. Groups are sorted by the table's index in `specs`, then by the group's lowest `seq`.
   An unknown table throws `UnknownTable`.
2. `src/template/plan.ts`: `planChildChange(input)` with the input and output types of design §4.4
   returns an ordered `steps` list (at most one `insert`, then at most one `update`, then at most one
   `soft_delete | restore`), `outcome`, `recordOutcome`, `applied`, `skipped`, `conflicts`, `unresolved`
   and `parentValues` following every row of the §4.4 rule table, checked in the order insert → fields →
   lifecycle:
   - insert: copy missing and parent alive and every non-nullable link resolved and natural key free →
     `insert` step with remapped links, nullable unresolved links as `null` listed in `unresolved`;
     parent soft-deleted → no step, `noop`; a non-nullable link unresolved → `skipped_unresolved_link`;
     natural key held by `naturalKeyOwner` → `skipped_key_conflict` with `conflicts = naturalKey` and
     `parentValues` of those fields.
   - fields (copy exists, alive or deleted): `update` step over `fields − child.overriddenFields`; a
     skipped field whose remapped parent value differs from the child's is a conflict (strict; equal →
     not a conflict); an unresolved link is moved to `unresolved` and not written (never `null` over a
     value); outcome `applied` / `partially_skipped` / `skipped_overridden` / `skipped_equal` /
     `skipped_unresolved_link` per the table.
   - soft_delete: copy alive and `overriddenFields` empty → `soft_delete` step, `soft_deleted`; copy
     alive with any override → no step, `conflicts ∪= ['deletedAt']`, `skipped_overridden`; copy deleted
     or missing → fields outcome, else `noop`.
   - restore: copy missing → handled by insert; copy deleted without `'deletedAt'` override and natural
     key free → `restore` step, `restored`; key held → `skipped_key_conflict`; copy deleted by the
     child (`'deletedAt'` override) or alive → fields outcome, else `noop`.
   - precedence: a lifecycle step that ran names the outcome and the fields lists ride along;
     `skipped_key_conflict` wins over everything; `recordOutcome` is true only for the kinds in
     `informativeOutcomes`.
   The function never reads `child.templateRowId === null` rows: a `child` argument with
   `templateRowId === null` throws `BrandLocalRow` (I12 plan half); `naturalKeyOwner` is the only way a
   brand-local row reaches it.
3. `src/template/links.ts`: `resolveLinkValue(link: LinkSpec, parentValue, linkMap: Map<string,
   string>)` returns `null` for a null parent value, the value verbatim when `link.to === 'themes'`
   (I10), the mapped child id on a hit, and `'unresolved'` on a miss. `remapLinks(spec, parent,
   linkMaps)` applies it to every link field and returns the `links` record `planChildChange` takes.
4. `src/template/chunk.ts`: `chunkChildren(childIds, groupCount, stepBudget = 2000): string[][]` with
   chunk size `max(1, floor(stepBudget / max(1, groupCount)))` and `max(1, ceil(children / size))`
   chunks, so every chunk satisfies `children × groups ≤ stepBudget` and holds at least one child.
   Examples fixed by test: 50 children × 1 group → 1 chunk; 50 × 100 → 3 chunks (20, 20, 10);
   50 × 800 → 25 chunks of 2; 0 children → `[]`.
5. `src/template/run-rules.ts`: the pure predicates every run-repair path shares, with the constants
   `RESEND_AFTER_MS = 5 * 60_000`, `STALE_RUNNING_MS = 30 * 60_000`, `MAX_ATTEMPTS = 3` exported:
   `shouldResend(run: { status: RunStatus; createdAt: Date; lastEnqueuedAt: Date | null }, now: Date)`
   → `true` only when `status === 'queued'` and `(lastEnqueuedAt ?? createdAt) < now − RESEND_AFTER_MS`
   (design §4.3 backstop, §5.4 first clause); `canRetry(run: { status; attempt: number; startedAt: Date |
   null }, now)` → `true` when `status` is `failed | partial` and `attempt < MAX_ATTEMPTS`, or `status ===
   'running'` and `startedAt !== null` and `startedAt < now − STALE_RUNNING_MS` and `attempt <
   MAX_ATTEMPTS` (§5.4 second and third clauses). TICKET-028a's `findRunsToResend` SQL mirrors these,
   TICKET-033's row action and TICKET-036a's admin actions call them; nobody defines a second copy.
6. Unit tests, fixtures only:
   - `coalesce.test.ts`: single update, single insert (fields = all propagated), the six pairs
     update+soft_delete, restore+update, update+restore, insert+soft_delete, soft_delete+restore,
     insert+update (each asserting both parts and `lastChangeId`), ordering across two tables by spec
     order then first `seq`, unknown table throws.
   - `plan.test.ts`: one `it` per row of criterion 2 (fourteen rows) plus: the three ordered pair plans
     (update+soft_delete on an alive clean copy → `[update, soft_delete]`; restore+update on a missing
     copy → `[insert]` carrying the fields; update+restore on a deleted copy → `[update, restore]`);
     strict conflict (skipped-but-equal is `skipped_equal`, not a conflict); unresolved link never
     written; precedence; `recordOutcome` true exactly for the informative kinds; brand-local `child`
     throws; a property check over every generated plan that `steps` are in insert → update →
     lifecycle order and never repeat an action.
   - `links.test.ts`: null, themes verbatim, hit, miss, `remapLinks` over a spec with two links.
   - `chunk.test.ts`: the four examples of criterion 4 and the invariants (every child exactly once,
     each chunk within budget, no empty chunk) over a generated grid of `(children, groups, budget)`.
   - `run-rules.test.ts`: `shouldResend` for a queued run 6 minutes old (true), 4 minutes old (false),
     `lastEnqueuedAt` 2 minutes ago with `createdAt` 10 minutes ago (false), a `running` run 10 minutes
     old (false); `canRetry` for `failed` / `partial` at attempts 1, 2 (true) and 3 (false), `running`
     started 31 minutes ago at attempt 1 (true) and at attempt 3 (false), `running` started 5 minutes ago
     (false), `queued` and `succeeded` (false), `running` with `startedAt null` (false).
7. `src/index.ts` re-exports; `pnpm typecheck && pnpm lint && pnpm test` exit 0.

## Gated criteria (D-008)

none

## Files touched

`packages/domain/src/template/coalesce.ts`, `packages/domain/src/template/plan.ts`,
`packages/domain/src/template/links.ts`, `packages/domain/src/template/chunk.ts`,
`packages/domain/src/template/run-rules.ts`, `packages/domain/src/index.ts`, the `*.test.ts` files next
to them.

## Notes

- No new dependency, no database access, no import from `@tas/db` (TICKET-020's lint fence).
- The chunk formula is stated here as the authority; design §4.4 quotes "twenty" chunks for the
  800-group case, the budget invariant makes it 25. TICKET-037's T25L asserts 25.
- Estimated size ≈220 LOC excluding tests (`run-rules.ts` is ≈20).
