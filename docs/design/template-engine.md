# Parent-child template engine (Phase 2) — final design

Sources: `CLAUDE.md` (Non-negotiables 1–3, Architecture principles, Definition of Done), `docs/PRD.md` §5, §10, §11, §14,
`docs/decisions.md` D-001…D-008, `docs/tickets/backlog.md`, TICKET-003 (`packages/db/src/columns.ts` shared column
helper, `createDb` / `createPgliteDb`, `testDb()`), TICKET-005 (`brands.template_brand_id`, `is_template`, `status`,
`withBrand(db, brandId)` in `packages/db/src/tenancy.ts`). The kickoff build (TICKET-001–005) is in flight; every path
below is relative to the layout in `CLAUDE.md` and the package names `@tas/web`, `@tas/db`, `@tas/domain`,
`@tas/integrations`, `@tas/ui`, `@tas/env`.

This document merges three candidate designs. The data model and invariant list come from the data-model-first design;
the job shape (one run per change set, database-claimed, children applied in row-operation-budgeted chunks per step,
attempt-suffixed event ids) comes from the flow-first design; the plan-returning propagation function, the registry
completeness test and the audit-row-outside-the-transaction rule come from the job-first design. Section 11 lists what was
rejected and why. Section 12 lists the `docs/decisions.md` entries this design needs; the planner appends them before
TICKET-020 is picked.

Package direction is one-way: `@tas/db` depends on `@tas/domain`, never the reverse (§3.3). Domain holds the pure types,
string unions and functions; db holds Drizzle tables, SQL and the engine that executes domain plans.

Terms: **template brand** (T) is the `brands` row with `is_template = true`; its rows are **parent rows**. A **child
brand** (C) has `template_brand_id = T.id`; its rows seeded from T are **child copies**; rows it created itself are
**brand-local rows**. A **run** is one execution of the propagation job over one set of parent changes.

---

## 1. Goals and non-goals

### Goals

- G1. One template propagates to every brand (Non-negotiable 1). A parent row insert, update, soft delete or restore
  lands in every non-archived child within minutes, without touching fields the child edited locally.
- G2. Child edits never reach the parent by themselves (Non-negotiable 2). The only path is a `promotion_requests` row,
  reviewed by an Admin, whose approval writes the parent row and then propagates like any other parent write.
- G3. Themes stay global (Non-negotiable 3). `themes` has no `brand_id` value, no template columns, and links to it are
  copied verbatim.
- G4. Structural change = one migration + one registry line. Never a per-brand column. Per-brand visibility is data in
  `brand_field_overrides`.
- G5. The engine is table-agnostic. It knows tables only through a registry entry. Phase 3 adds a data table by adding a
  registry entry; Phase 4 gets "parent interface / child interface" (PRD §10) for free because `interface_pages` and
  `interface_fields` are ordinary registered tables shipped in this phase.
- G6. Every invariant is provable on PGlite with no Inngest runtime, except the properties that need two connections
  (the queued-run row lock in §4.3, the `FOR UPDATE` serialisation in §4.4 and §4.5, the database half of mutual
  exclusion in A12). Those are listed under "Pending human verification" in `docs/runbook.md` with a two-connection
  script against Neon (D-008). Inngest functions are thin wrappers around functions in `@tas/db` that tests call directly.
- G7. Cost: zero added USD beyond the Vercel Pro plan D-006 already assumes. At 50 brands and a busy template editor,
  Inngest step executions stay under 10k per month, Neon compute stays inside the free CU-hour allowance (§5.5), and the
  engine ledgers stay bounded because they are hard-deleted after 90 days (§3.6, §12).
- G8. Every ticket under 300 LOC excluding tests; a test needs at most three lines of setup.

### Non-goals

- Multi-level templates (a child of a child). Depth is one; a constraint enforces it.
- Standalone brands with no template. Every non-template brand has exactly one template (migrated Airtable bases become
  children of the agency template; their existing rows are adopted as copies with `linkToTemplate`, §4.10).
- Merging concurrent edits of the same field. The last write wins inside a brand; across brands, `overridden_fields`
  decides.
- Field-level history/versioning of business rows. History exists for the engine (`template_changes`,
  `propagation_runs`, `propagation_outcomes`), not for every edit of every row.
- Notifications about propagation or promotion. Phase 5 subscribes to the events this design emits.
- UI polish beyond the four screens named in §9 (promote popup, admin promotion dashboard, brand "Template updates" page,
  admin propagation page).

### Assumptions (each one is a line an engineer can challenge)

- A1. One template brand per agency. Enforced by a partial unique index; nothing else depends on the count.
- A2. Field identity everywhere (`overridden_fields`, `template_changes.changed_fields`, `promotion_requests.fields`,
  `brand_field_overrides.field_name`) is the Drizzle schema key (`painPoints`), not the SQL column name. The registry maps
  key to column when raw SQL is generated.
- A3. Not every column is template content. Each registered table declares which fields propagate; statuses, comments,
  assignees, costs, QA flags, tracking numbers and design files are local fields, never propagated, never overrides,
  never promotable. Derived fields (auto-generated names, PRD §7) are recomputed per brand by the naming functions.
- A4. Many-to-many links (creator ↔ concept, product ↔ collection) are per-brand join tables that are themselves
  registered tables with two link columns. Phase 3 decides their shape.
- A5. Inngest free tier allows at least 50k step executions per month (to be verified by the human, D-006). The design
  uses ≈2.3k at the load target (§5.5), so a quota a tenth that size still fits.
- A6. Inngest event payloads **and step outputs** carry ids and field names only, never row values. Events stay far
  under the 32 KB limit; step outputs stay small at any import size because every apply step re-reads the parent rows
  it needs from the database (§4.4). Template content never enters Inngest state.
- A7. Paused brands receive propagation; archived brands do not. Reactivating an archived brand runs `resyncBrand`,
  which inserts the copies it lacks and then re-applies every propagated field of every live parent row under the normal
  override and conflict rules (§4.1), so the brand catches up on everything it missed while archived.
- A8. A child edit that sets a propagated field to a value that happens to equal the parent's still records an
  override; "reset to template" is the only way to remove one. The child write path never reads the parent.
- A9. Parent rows have local fields too (the template brand has statuses); they are ignored by the engine and the template
  brand never has a `client` assignment.
- A10. Only agency admins write the template brand in V1 (see §10 for the open question).
- A11. The production driver supports transactions and `SELECT ... FOR UPDATE` (D-005).
- A12. Mutual exclusion of job instances on one run is the pair (database claim with `claim_generation`, Inngest
  concurrency key per template brand). PGlite proves the database half only (T24); the Inngest half and the
  two-connection behaviour are verified by the runbook script (G6).
- A13. In production a template save is claimed within seconds of its commit, so without a deliberate delay it is one
  run per save. `propagate-run` sleeps 20 s before claiming (§5.2) so an editing session shares runs; correctness never
  depends on that window (the database claim and the sweeper are the authority).
- A14. Vercel Pro (D-006) allows `maxDuration = 300` on the Inngest serve route; each apply step is budgeted to finish
  well inside it (§5.2).

---

## 2. Invariants

Each invariant names the test in §8 that proves it.

- **I1 Parent pointer.** A row with `template_row_id IS NOT NULL` lives in a child brand and references a row of the same
  table in its brand's `template_brand_id`. Rows of the template brand always have `template_row_id IS NULL`. (T1, T26)
- **I2 One copy per parent row.** At most one row per `(brand_id, template_row_id)` in every registered table, soft-deleted
  rows included. A soft-deleted copy is a tombstone: seed, resync and insert propagation can never re-create it. This is
  what makes all three idempotent. (T1, T7, T8)
- **I3 Propagation result.** After a run that carried a change on parent row P with changed fields F, every non-archived
  child copy C satisfies, for each f in F: `C.f = remap(P.f)` unless `f ∈ C.overridden_fields`. (T6)
- **I4 Override vocabulary.** `overridden_fields` is a sorted, de-duplicated JSON array whose entries are keys of the
  table's `propagatedFields` or the literal `'deletedAt'`. Never a local or system field. (T5)
- **I5 Override mutation.** A child write changes `overridden_fields` only by adding the propagated fields whose stored
  value actually changed. A template-brand write never touches `overridden_fields`. (T4, T5)
- **I6 Outbox.** Every template-brand write that changes a propagated field, inserts, soft-deletes or restores a parent row
  writes a `template_changes` row and attaches it to a `propagation_runs` row with `status = 'queued'` in the same
  transaction. A rolled-back write leaves neither. (T4, T24)
- **I7 Run ledger.** Every `template_changes` row belongs to exactly one run. At most one queued `changes` run exists per
  template brand at any moment. For each `(run, child brand)` there is at most one `propagation_child_runs` row and for
  each `(run, child brand, table, parent row)` at most one `propagation_outcomes` row; retries overwrite both. (T7, T24)
- **I8 Privileged scope.** No code outside `withTemplateScope` writes across brands, and cross-brand reads for the admin
  screens go through the same module's read-only scope. A mutating scope cannot exist without an `engine_audit_log` row
  opened before it runs and closed (succeeded or failed) after it, including when the scoped work throws. Read-only
  scopes (`listPromotionRequests`, `listRuns`, the conflicts query) are guarded by `requireAdmin()` /
  `requireBrandRole` at the route and write no audit row: reads are not forensic events and auditing them doubled the
  writes per dashboard view (§6). (T17)
- **I9 Nothing auto-promotes.** The only writes to a parent row made on behalf of a child are inside `approvePromotion`,
  and each such write records `promotion_requests.applied_batch_id`. (T13, T15, T16)
- **I10 Themes are global.** `themes.brand_id IS NULL` always (CHECK); `themes` has no `template_row_id` or
  `overridden_fields`; a link declared `to: 'themes'` is copied verbatim on seed and propagation. (T18)
- **I11 Convergence.** Running the same run twice, or two runs in either order, produces identical child rows and no
  duplicate outcomes. (T7)
- **I12 Brand-local rows are invisible to the engine.** Seed, resync and propagation never write a row with
  `template_row_id IS NULL` in a child brand. Their only read of such rows is the natural-key check (§4.4), which
  makes the engine skip rather than collide. The only operations that turn a brand-local row into a copy are approval
  of a new-row promotion (§4.5) and the migrator's `linkToTemplate` (§4.10). (T8, T28)
- **I13 Readiness.** `brands.seeded_at` is set in the same transaction that inserts the last registry table's copies and
  never before. (T1, T21)
- **I14 Run lifecycle.** A run moves only `queued → running → succeeded | partial | failed`, and `failed | partial →
  running` on retry. Every claim increments `claim_generation`, and every write to `propagation_runs` by a job instance
  carries `WHERE claim_generation = $mine`, so a stale instance cannot change run state after a takeover. The sweeper
  re-sends a stale queued run without spending an attempt (`resend_count`), and increments `attempt` only for runs
  that have actually executed (`failed | partial`, or `running` past the 30-minute guard: a dead instance is a failed
  attempt), stopping at `attempt = 3`. (T24)

---

## 3. Data model

All tables use `baseColumns` from TICKET-003 (`id`, `brand_id`, `created_at`, `updated_at`, `created_by`, `updated_by`,
`deleted_at`). Sketches are Drizzle; migrations are generated by drizzle-kit into `packages/db/drizzle/`.

### 3.1 `brands` additions (migration on the TICKET-005 table)

```ts
// packages/db/src/schema/brands.ts (additions)
seededAt: timestamp('seeded_at', { withTimezone: true }),      // null = seed not finished (I13)
// constraints
check('brands_template_xor', sql`is_template <> (template_brand_id IS NOT NULL)`),   // A1 depth one, no standalone brands
uniqueIndex('brands_one_template_per_agency').on(t.agencyId).where(sql`is_template AND deleted_at IS NULL`),
index('brands_template_brand_idx').on(t.templateBrandId),
```

Domain rules (`packages/domain/src/template/brand-rules.ts`): `assertTemplateParent(parent)` throws unless
`parent.isTemplate`; `assertAssignment(brand, role)` throws for role `client` on a template brand;
`brandReadiness(brand, lastSeedRun)` returns `'ready' | 'seeding' | 'seed_failed'`.

### 3.2 Templated column helper and per-table constraints

```ts
// packages/db/src/template/columns.ts
export const templatedColumns = {
  ...baseColumns,
  brandId: uuid('brand_id').notNull().references(() => brands.id),      // NOT NULL on templated tables
  templateRowId: uuid('template_row_id'),                                // self FK added per table below
  overriddenFields: jsonb('overridden_fields').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
};

export const templatedConstraints = (name: string, t: TemplatedTable) => [
  foreignKey({ name: `${name}_template_row_fk`, columns: [t.templateRowId], foreignColumns: [t.id] }),
  uniqueIndex(`${name}_brand_template_row_uq`).on(t.brandId, t.templateRowId),   // FULL index: includes deleted rows (I2)
  index(`${name}_brand_deleted_idx`).on(t.brandId, t.deletedAt),
  index(`${name}_template_row_idx`).on(t.templateRowId),
  check(`${name}_overridden_is_array`, sql`jsonb_typeof(overridden_fields) = 'array'`),
];
```

Postgres treats NULLs as distinct in a unique index, so any number of brand-local rows (`template_row_id IS NULL`)
coexist in one brand.

**Semantics of `template_row_id`**

| Row | Value | Meaning |
| --- | --- | --- |
| In the template brand | always NULL | it is a parent row; children point at its `id` |
| In a child brand, NOT NULL | id of the parent row in the same table | a child copy; propagation reads and writes it; at most one per parent row (I2) |
| In a child brand, NULL | — | brand-local row; the engine never touches it (I12); promotable as a new parent row |

It is set only by seed, resync, insert propagation, approval of a new-row promotion (§4.5) and the migrator's
`linkToTemplate` (§4.10, the only way an existing brand-local row becomes the copy of a parent row). It is never
repointed and never cleared.

**Semantics of `overridden_fields`**

- Sorted, de-duplicated array of Drizzle keys from the table's `propagatedFields`, plus the literal `'deletedAt'` when
  the child soft-deleted or restored the copy itself (I4).
- Added by every child write whose stored value of a propagated field changed (I5). Equal-value writes add nothing (A8:
  equality is against the child's own current value, not the parent's).
- Removed only by `resetToTemplate` (the reset fields) and by `settleOverrides` on promotion approval (fields that were
  applied to the parent and whose child value still equals what was applied).
- Computed positively (every propagated field whose child value differs from the remapped parent value) only when a
  brand-local row becomes a copy: new-row promotion approval (§4.5) and `linkToTemplate` (§4.10).
- Every write to the array is jsonb set arithmetic on the locked row (`overridden_fields ∪ $added`,
  `overridden_fields − $removed`), never a wholesale assignment, so no code path can drop an entry it did not compute
  (§6 `writeChild`).
- Propagation writes only fields absent from the array; `[]` means "fully inherits".
- Rows of the template brand always have `[]`.

**Field classes** (declared per table in the registry)

| Class | Examples | Seed | Propagate | Override-tracked | Promotable |
| --- | --- | --- | --- | --- | --- |
| system | `id`, `brand_id`, `created_*`, `updated_*`, `deleted_at`, `template_row_id`, `overridden_fields` | set by engine | lifecycle rules in §4.4 and §4.8 | `'deletedAt'` only | no |
| propagated | persona `painPoints`, page `enabled` | copied | yes | yes | yes |
| link (subset of propagated) | `personaId`, `pageId`, `themeId` | remapped (`to: 'themes'` verbatim) | yes, remapped | yes | yes, remapped child → parent |
| local | statuses, comments, assignee, costs, QA flags | column default | never | never | never |
| derived (subset of local) | concept name, creative name | recomputed | recomputed after each applied patch | never | never |

### 3.3 The registry

The spec is split so the package graph stays acyclic: the field-level shape, the row and plan types and every status /
role string union live in `@tas/domain`; `@tas/db` extends the shape with the Drizzle table and builds its `pgEnum`s
from the domain arrays. Domain never imports `@tas/db`. `pnpm turbo run build --dry` runs in CI and fails on a cyclic
package graph (Turborepo refuses one at build time; the dry run catches it before that).

```ts
// packages/domain/src/template/spec.ts (pure: types and string arrays, no Drizzle import)
export type LinkSpec = { field: string; to: string | 'themes'; nullable: boolean };   // `to` may be the owning spec's name (self-link)
export type TemplatedFieldSpec = {
  name: string;                        // 'interface_pages'; stored in every table_name column
  labelField: string;                  // shown in lists, popups and conflict banners
  propagatedFields: readonly string[]; // Drizzle keys; includes link fields; never system columns
  localFields: readonly string[];      // everything else, declared explicitly (completeness test)
  links: readonly LinkSpec[];          // subset of propagatedFields
  naturalKey?: readonly string[];      // business key enforced per brand among alive rows by a partial unique index (§3.9)
};
export type Row = { id: string; brandId: string; templateRowId: string | null; overriddenFields: string[]; deletedAt: Date | null } & Record<string, unknown>;
export type ChangeLifecycle = 'none' | 'insert' | 'soft_delete' | 'restore';
export type ChangeGroup = { tableName: string; rowId: string; lifecycle: ChangeLifecycle; fields: string[]; lastChangeId: string };
export type ChildPlan = /* §4.4 */;
export const brandStatuses    = ['active', 'paused', 'archived'] as const;
export const agencyRoles      = ['admin', 'member'] as const;
export const brandRoles       = ['csm', 'strategist', 'video_editor', 'designer', 'media_buyer', 'client'] as const;
export const changeKinds      = ['insert', 'update', 'soft_delete', 'restore'] as const;
export const changeSources    = ['edit', 'promotion', 'field_resync', 'import'] as const;
export const runTriggers      = ['changes', 'seed', 'resync'] as const;
export const runStatuses      = ['queued', 'running', 'succeeded', 'partial', 'failed'] as const;
export const outcomeKinds     = [/* §3.6 */] as const;
export const promotionStatuses = ['pending', 'approved', 'rejected', 'withdrawn', 'superseded'] as const;
export const engineReasons    = [/* §3.7 */] as const;
// plus the derived unions: BrandStatus, BrandRole, RunStatus, ...

// packages/db/src/template/registry.ts (adds what needs Drizzle)
export type TemplatedTableSpec<T extends TemplatedTable = TemplatedTable> = TemplatedFieldSpec & {
  table: T;
  recompute?: (row: Row, ctx: RecomputeCtx) => Partial<Row>;   // derived fields (naming functions from @tas/domain), Phase 3
};
export type TemplateRegistry = { specs: readonly TemplatedTableSpec[]; byName(name: string): TemplatedTableSpec };

export function createTemplateRegistry(specs: TemplatedTableSpec[]): TemplateRegistry;
// validates at construction: every propagatedFields/localFields/links.field/naturalKey entry is a key of spec.table;
// propagated ∩ local = ∅; naturalKey ⊆ propagatedFields; every links.to is 'themes', the name of an EARLIER spec
// (dependency order) or the spec's OWN name (self-link, must be nullable: it is written in a second pass);
// names unique. Returns a frozen object. Throws otherwise.

export const templateRegistry = createTemplateRegistry([brandFieldOverridesSpec, interfacePagesSpec, interfaceFieldsSpec]);
```

TICKET-005's note "role enums are defined once in `packages/db/src/schema/enums.ts` and re-exported as unions so
`packages/domain` can import them" is flipped by this design: the arrays are defined in `@tas/domain`
(`agencyRoles`, `brandRoles`, `brandStatuses`) and `packages/db/src/schema/enums.ts` builds `pgEnum('brand_role',
brandRoles)` from them and re-exports the unions for convenience. The direction is always db → domain.

The exported constant is frozen and validated; it is a value, not mutable module state. Every engine function takes a
`registry` argument so tests inject a fixture registry (T18, T25) and Phase 3 tickets append a spec to the production
array. Registry position is the seed and propagation order.

**Self-links and join tables.** A link whose `to` is the spec's own name (a concept that is an iteration of another
concept, PRD §5.7; product → collection inside one table family) is declared like any other link but resolved in a
second pass after the table's rows exist: seed and insert propagation write the column as NULL in the INSERT and then
run one `UPDATE <table> c SET <field> = m.child_id FROM <link map> m WHERE c.brand_id = $C AND ...` over the rows just
inserted; update propagation resolves it through the same per-table link map read after the inserts (§4.4). A
non-nullable self-link is rejected by `createTemplateRegistry` because a row cannot reference a sibling that is not yet
inserted. Many-to-many links (product ↔ brief, creator ↔ concept) are registered join tables per A4, placed after both
endpoints, with two non-nullable link columns that must both resolve; an unresolvable side makes the join row
`skipped_unresolved_link` until `resyncBrand` repairs it. Optional cross-links (PRD §5.1, §5.10) are nullable links on the
referring table. (T22 covers a self-link and a join table in the fixture registry.)

`registryCompleteness(db, registry)` (in `packages/db/src/template/testing.ts`) reads `information_schema.columns` for
every registered table and fails if a column is neither a system column nor listed in `propagatedFields` or
`localFields`. A Phase 3 ticket that adds a column and forgets to classify it fails CI (T22).

### 3.4 `template_changes` (append-only journal, the outbox)

```ts
export const templateChangeKind   = pgEnum('template_change_kind',   changeKinds);     // arrays from @tas/domain (§3.3)
export const templateChangeSource = pgEnum('template_change_source', changeSources);

export const templateChanges = pgTable('template_changes', {
  ...baseColumns,                                    // brand_id = the TEMPLATE brand (CHECK not null)
  runId: uuid('run_id').notNull().references(() => propagationRuns.id),
  batchId: uuid('batch_id').notNull(),               // one per writing transaction (promotion links to it)
  seq: bigserial('seq', { mode: 'number' }).notNull(),
  tableName: text('table_name').notNull(),
  rowId: uuid('row_id').notNull(),                   // parent row id
  kind: templateChangeKind('kind').notNull(),
  changedFields: jsonb('changed_fields').$type<string[]>().notNull().default(sql`'[]'::jsonb`), // keys; [] for insert/soft_delete/restore
  source: templateChangeSource('source').notNull(),
  promotionRequestId: uuid('promotion_request_id'),
}, t => [
  index('template_changes_run_idx').on(t.runId, t.seq),
  index('template_changes_row_idx').on(t.tableName, t.rowId, t.createdAt),
  check('template_changes_brand_not_null', sql`brand_id IS NOT NULL`),
]);
```

Rows carry field names only. The job reads the live parent row, which is why two runs touching the same row converge in
any order (I11) and why events and rows stay small (A6).

### 3.5 `propagation_runs` (one row per job execution unit; also the outbox head)

```ts
export const runTrigger = pgEnum('propagation_trigger', runTriggers);      // arrays from @tas/domain (§3.3)
export const runStatus  = pgEnum('propagation_run_status', runStatuses);

export const propagationRuns = pgTable('propagation_runs', {
  ...baseColumns,                                    // brand_id = template brand
  trigger: runTrigger('trigger').notNull(),
  targetBrandId: uuid('target_brand_id').references(() => brands.id),   // seed | resync only
  status: runStatus('status').notNull().default('queued'),
  attempt: integer('attempt').notNull().default(1),  // retry budget: incremented only when a run that executed (failed | partial | stale running) is re-sent (sweeper or admin Retry)
  resendCount: integer('resend_count').notNull().default(0),   // send repair: incremented when a stale queued run is re-sent; never touches attempt
  lastEnqueuedAt: timestamp('last_enqueued_at', { withTimezone: true }),
  claimedBy: text('claimed_by'),                     // Inngest run id of the instance that holds it
  claimGeneration: integer('claim_generation').notNull().default(0),   // +1 on every successful claim; every job write carries WHERE claim_generation = $mine (I14)
  auditId: uuid('audit_id').references(() => engineAuditLog.id),         // set at claim
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  stats: jsonb('stats').$type<RunStats>().notNull().default(sql`'{}'::jsonb`),
  error: text('error'),
}, t => [
  uniqueIndex('propagation_runs_one_queued').on(t.brandId).where(sql`status = 'queued' AND trigger = 'changes'`), // I7
  index('propagation_runs_status_idx').on(t.status, t.createdAt),
  index('propagation_runs_target_idx').on(t.targetBrandId, t.createdAt),
]);
// RunStats = { children: number; changes: number; applied: number; inserted: number; softDeleted: number; restored: number;
//              skipped: number; conflicts: number; unresolved: number; failedChildren: number;
//              tables?: Record<string, { parents: number; inserted: number; unresolved: number }> }   // seed/resync
```

Semantics:

- A `changes` run is the unit of propagation. A template-brand write attaches its changes to the one queued run for
  the template (creating it if none). Saves that land while the run is still queued share it; with the 20-second
  coalescing sleep in §5.2 an editing session of thirty saves a minute apart is roughly thirty runs, while a burst of
  saves or a CSV import is one (A13). Correctness does not depend on how many saves share a run.
- The row is written in the same transaction as the change (I6). The "pending propagation" admin panel is
  `WHERE status = 'queued'`, not an anti-join.
- `attempt` is the retry budget for failures; `resend_count` / `last_enqueued_at` repair lost sends of queued runs
  without spending it; `claimed_by` and `claim_generation` are the mutual-exclusion state (§4.4 step 1, §5.4).
- Seed and resync runs are created by brand creation / the admin action, one per request, `target_brand_id` set.
- `stats` is derived from `propagation_child_runs` and `propagation_outcomes` at finish (never incremented), so a
  retried step cannot double count.

### 3.6 `propagation_child_runs` and `propagation_outcomes` (the ledger)

Two tables. `propagation_child_runs` has exactly one row per `(run, child brand)` once the child was attempted; it
carries the status and the counts, serves the `attempt > 1` narrowing and the stats derivation, and is what makes a
child with zero per-row outcomes visible. `propagation_outcomes` has one row per `(run, child, parent row)` **only when
the row carries information**: `failed`, `skipped_overridden`, `partially_skipped`, `skipped_unresolved_link`,
`skipped_key_conflict`, `inserted`, `soft_deleted`, `restored`. Plain `applied`, `skipped_equal` and `noop` results are
counted on the child-run row and write no per-row outcome. At the load target this drops the ledger from ~1,000 rows a
day to a few dozen plus the informative ones.

```ts
export const childRunStatus = pgEnum('propagation_child_status', ['succeeded', 'failed']);
export const propagationChildRuns = pgTable('propagation_child_runs', {
  ...baseColumns,                                    // brand_id = CHILD brand
  runId: uuid('run_id').notNull().references(() => propagationRuns.id),
  status: childRunStatus('status').notNull(),
  counts: jsonb('counts').$type<Record<OutcomeKind, number>>().notNull().default(sql`'{}'::jsonb`),   // every kind, informative or not
  error: text('error'),
}, t => [uniqueIndex('propagation_child_runs_uq').on(t.runId, t.brandId)]);   // I7; upsert target

export const outcomeKind = pgEnum('propagation_outcome', outcomeKinds);   // from @tas/domain:
// ['applied', 'partially_skipped', 'skipped_overridden', 'skipped_equal', 'inserted', 'soft_deleted', 'restored',
//  'skipped_unresolved_link', 'skipped_key_conflict', 'noop', 'failed']

export const propagationOutcomes = pgTable('propagation_outcomes', {
  ...baseColumns,                                    // brand_id = CHILD brand
  runId: uuid('run_id').notNull().references(() => propagationRuns.id),
  changeId: uuid('change_id').notNull().references(() => templateChanges.id),   // last change of the coalesced group
  tableName: text('table_name').notNull(),
  parentRowId: uuid('parent_row_id').notNull(),
  childRowId: uuid('child_row_id'),
  outcome: outcomeKind('outcome').notNull(),
  appliedFields:  jsonb('applied_fields').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  skippedFields:  jsonb('skipped_fields').$type<string[]>().notNull().default(sql`'[]'::jsonb`),   // all fields not written
  conflictFields: jsonb('conflict_fields').$type<string[]>().notNull().default(sql`'[]'::jsonb`),  // skipped AND parent value differs from child's; the natural key for skipped_key_conflict
  unresolvedFields: jsonb('unresolved_fields').$type<string[]>().notNull().default(sql`'[]'::jsonb`),   // links whose target has no copy yet (resync repairs)
  parentValues:   jsonb('parent_values').$type<Record<string, unknown>>(),   // parent values of conflict fields only, remapped
  error: text('error'),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),      // "Keep mine"
  acknowledgedBy: text('acknowledged_by'),
}, t => [
  uniqueIndex('propagation_outcomes_uq').on(t.runId, t.brandId, t.tableName, t.parentRowId),   // I7; upsert target
  index('propagation_outcomes_conflicts_idx').on(t.brandId, t.tableName, t.childRowId)
    .where(sql`conflict_fields <> '[]'::jsonb AND acknowledged_at IS NULL`),
]);
```

Semantics: at most one row per `(run, child, parent row)`; a retried step upserts (`ON CONFLICT DO UPDATE`), so a
`failed` outcome is replaced by the real one and never treated as done, and a row whose retry produced a
non-informative result is deleted by the same upsert batch (`DELETE ... WHERE run_id, brand_id, table_name,
parent_row_id IN (...)`). A conflict is an outcome with `conflict_fields <> '[]'` and no acknowledgement (§4.9).
`parent_values` holds the parent's value for conflict fields only, so the child's "Template updates" page needs no
cross-brand read. Seed writes no outcome rows; its per-table counts live in `propagation_runs.stats.tables`. Resync
writes child-run and outcome rows like a propagation run (§4.1). Volume at target: a run touching one parent row writes
50 child-run rows and only the informative outcomes (usually none); a 100-row CSV import writes 50 child-run rows plus
5,000 `inserted` outcomes.

**Retention (decision entry in §12).** `propagation_outcomes`, `propagation_child_runs`, `template_changes` and
`engine_audit_log` are operational logs, not data tables: the "soft delete only" rule protects business data and does
not apply to them. A retention job (TICKET-032b, Inngest cron, weekly) hard-deletes outcomes older than 90 days whose
conflicts are acknowledged or empty, child-run rows and journal rows of runs finished more than 90 days ago, and audit
rows older than 90 days whose run rows are gone. `propagation_runs` and `promotion_requests` are kept (small, and the
approval trail I9 depends on them).

### 3.7 `engine_audit_log` (one row per privileged scope)

```ts
export const engineReason = pgEnum('engine_reason', engineReasons);   // from @tas/domain:
// ['seed', 'resync', 'propagate', 'field_resync', 'promotion_request', 'promotion_apply', 'reset_to_template',
//  'acknowledge', 'import', 'sweep', 'retention']
// Every reason is a mutation. Cross-brand reads (`promotion_review`, run listing) are not audited (I8).
export const engineAuditLog = pgTable('engine_audit_log', {
  ...baseColumns,                                    // brand_id = template brand
  actorId: text('actor_id').notNull(),               // user id, or 'system:inngest', 'system:migrate'
  reason: engineReason('reason').notNull(),
  targetBrandId: uuid('target_brand_id'),
  subject: jsonb('subject').$type<{ tableName?: string; rowId?: string; requestId?: string; runId?: string }>(),
  status: text('status').notNull().default('running'),   // running | succeeded | failed
  rowsWritten: integer('rows_written').notNull().default(0),
  error: text('error'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
}, t => [index('engine_audit_actor_idx').on(t.actorId, t.createdAt)]);
```

### 3.8 `promotion_requests`

```ts
export const promotionStatus = pgEnum('promotion_status', promotionStatuses);   // array from @tas/domain (§3.3)
export type PromotionDecision = 'take_proposed' | 'keep_current' | 'restore_parent';   // defined in @tas/domain

export const promotionRequests = pgTable('promotion_requests', {
  ...baseColumns,                                    // brand_id = requesting CHILD brand (CHECK not null)
  tableName: text('table_name').notNull(),
  childRowId: uuid('child_row_id').notNull(),
  parentRowId: uuid('parent_row_id'),                // NULL => "promote as a new parent row"
  fields: jsonb('fields').$type<string[]>().notNull(),                       // requested propagated fields
  base: jsonb('base').$type<Record<string, unknown>>().notNull(),           // parent values at request time ({} for new row), parent link ids
  proposed: jsonb('proposed').$type<Record<string, unknown>>().notNull(),   // child values at request time, links remapped child -> parent
  parentUpdatedAt: timestamp('parent_updated_at', { withTimezone: true }),  // staleness badge
  note: text('note'),
  status: promotionStatus('status').notNull().default('pending'),
  requestedBy: text('requested_by').notNull(),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewNote: text('review_note'),
  approvedFields: jsonb('approved_fields').$type<string[]>(),               // subset of fields the admin took
  conflicts: jsonb('conflicts').$type<Record<string, { base: unknown; current: unknown; proposed: unknown }>>(), // filled at review
  decisions: jsonb('decisions').$type<Record<string, PromotionDecision>>(),
  appliedBatchId: uuid('applied_batch_id'),          // template_changes.batch_id written by approval (I9)
}, t => [
  uniqueIndex('promotion_requests_one_pending').on(t.tableName, t.childRowId).where(sql`status = 'pending'`),
  index('promotion_requests_status_idx').on(t.status, t.createdAt),
  index('promotion_requests_brand_idx').on(t.brandId, t.status),
  check('promotion_requests_brand_not_null', sql`brand_id IS NOT NULL`),
]);
```

Semantics: `base` and `proposed` are snapshots so the reviewer sees a three-way diff (base, current parent, proposed)
and so the row remains meaningful after the child moves on. `parent_row_id IS NULL` is the "new parent row" kind; on
approval it is set and the child row's `template_row_id` is set to the new parent id. Terminal states are terminal
(§4.5).

### 3.9 Phase 2 templated tables

```ts
// brand_field_overrides: per-brand visibility of workspace fields (structural change, CLAUDE.md principle 4)
export const brandFieldOverrides = pgTable('brand_field_overrides', {
  ...templatedColumns,
  tableName: text('table_name').notNull(),
  fieldName: text('field_name').notNull(),           // Drizzle key
  hidden: boolean('hidden').notNull().default(false),
  readOnly: boolean('read_only').notNull().default(false),
  label: text('label'),                              // null = registry label
  position: integer('position'),
}, t => [
  ...templatedConstraints('brand_field_overrides', t),
  uniqueIndex('brand_field_overrides_uq').on(t.brandId, t.tableName, t.fieldName).where(sql`deleted_at IS NULL`),
]);
// registry: propagatedFields ['tableName','fieldName','hidden','readOnly','label','position'], localFields [], links [],
//           naturalKey ['tableName','fieldName']

// interface_pages / interface_fields: PRD §10 client interface configuration (Phase 4 UI, engine-ready now)
export const interfacePageKey = pgEnum('interface_page_key', ['concepts', 'creatives', 'copywriting', 'ugc', 'partnership']);
export const interfacePages = pgTable('interface_pages', {
  ...templatedColumns,
  pageKey: interfacePageKey('page_key').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  position: integer('position').notNull().default(0),
  label: text('label'),
}, t => [...templatedConstraints('interface_pages', t),
  uniqueIndex('interface_pages_uq').on(t.brandId, t.pageKey).where(sql`deleted_at IS NULL`)]);
// registry: propagatedFields ['pageKey','enabled','position','label'], localFields [], links [], naturalKey ['pageKey']

export const interfaceFields = pgTable('interface_fields', {
  ...templatedColumns,
  pageId: uuid('page_id').notNull().references(() => interfacePages.id),   // link, remapped
  fieldName: text('field_name').notNull(),
  visible: boolean('visible').notNull().default(true),
  clientEditable: boolean('client_editable').notNull().default(false),
  position: integer('position').notNull().default(0),
}, t => [...templatedConstraints('interface_fields', t),
  uniqueIndex('interface_fields_uq').on(t.brandId, t.pageId, t.fieldName).where(sql`deleted_at IS NULL`)]);
// registry: propagatedFields ['pageId','fieldName','visible','clientEditable','position'], localFields [],
//           links [{ field: 'pageId', to: 'interface_pages', nullable: false }], naturalKey ['pageId','fieldName']
```

`brand_field_overrides` is workspace-only; client-facing field visibility is `interface_fields` because it is
per page and needs `client_editable` (see §11 for the rejected single-table-with-surface variant).

**Natural keys.** The partial unique indexes above (`_uq`, alive rows only) are business keys a brand-local row can
also hold: a child creates its own `interface_pages` row with `page_key = 'ugc'`, and the template later inserts a
`'ugc'` page. The registry declares the key (`naturalKey`, link fields remapped through the child's link map) and
insert / restore propagation checks it before writing (§4.4); a collision becomes an outcome `skipped_key_conflict`
with `conflict_fields = naturalKey` and `parent_values`, shown on the brand's "Template updates" page, instead of a
unique violation that poisons the child on every run. Forbidding brand-local rows in these tables was rejected (§11).

### 3.10 `themes` (global)

```ts
export const themes = pgTable('themes', {
  ...baseColumns, name: text('name').notNull(), referenceLinks: jsonb('reference_links'), notes: text('notes'), attachments: jsonb('attachments'),
}, t => [check('themes_global', sql`brand_id IS NULL`)]);
```

No `template_row_id`, no `overridden_fields`, not in the registry. A registry link with `to: 'themes'` copies the id
verbatim (I10). Per-brand theme favourites (PRD §17 q4), if wanted later, are a per-brand registered join table.

---

## 4. Operations

All SQL is generated from the registry by `packages/db/src/template/sql.ts`. `$T` = template brand id, `$C` = child
brand id, `$actor` = text actor id. Decisions live in pure functions under `packages/domain/src/template/` and
`packages/domain/src/state/`; `packages/db/src/template/` executes the plans they return.

### 4.1 Seed (`seedBrand(db, registry, { runId })`)

Trigger: the brand-creation Server Action inserts the `brands` row (`seeded_at NULL`) and a `propagation_runs` row
(`trigger 'seed', target_brand_id, status 'queued'`) in one transaction, commits, then `enqueueRun(run)`. The UI shows
"Setting up from template" while `brandReadiness` is `'seeding'`.

One transaction, inside `withTemplateScope(reason: 'seed')`, one statement per registered table in registry order:

```sql
INSERT INTO interface_fields (brand_id, template_row_id, overridden_fields, created_by, updated_by,
                              page_id, field_name, visible, client_editable, position)
SELECT $C, p.id, '[]'::jsonb, $actor, $actor,
       (SELECT c.id FROM interface_pages c WHERE c.brand_id = $C AND c.template_row_id = p.page_id),
       p.field_name, p.visible, p.client_editable, p.position
FROM interface_fields p
WHERE p.brand_id = $T AND p.deleted_at IS NULL
  -- NOT NULL links must resolve; unresolved parents are counted, not inserted (resync repairs them)
  AND EXISTS (SELECT 1 FROM interface_pages c WHERE c.brand_id = $C AND c.template_row_id = p.page_id)
ON CONFLICT (brand_id, template_row_id) DO NOTHING
RETURNING id, template_row_id;
```

Then the self-link post-pass for tables that declare one (§3.3), `recompute` for derived fields (Phase 3, one UPDATE
per returned row), `stats.tables[name] = { parents, inserted, unresolved }`, and as the last statement `UPDATE brands
SET seeded_at = now() WHERE id = $C AND seeded_at IS NULL` (I13). Local fields are absent from the column list, so
statuses start at their defaults. Links resolve because targets precede referrers in registry order. A **nullable**
link whose target has no copy in the child (target parent row deleted, or never seeded) is written NULL by the
subquery and counted in `unresolved`; it is repaired by the next resync or by any propagation that re-applies the field
once the target exists. A **non-nullable** link that does not resolve keeps the parent row out of the insert (the
`EXISTS` filter) and counts it.

**`resyncBrand(db, registry, { runId })`** is the repair tool for any gap (unresolved links, a child created while a
parent row was deleted, an archived brand reactivated after weeks of template edits). It is seed followed by a full
re-apply, in one `withTemplateScope(reason: 'resync', targetBrandId)`:

1. the seed statements above (`INSERT ... ON CONFLICT DO NOTHING`), which only create missing copies and never touch
   `seeded_at`;
2. for every registered table, synthetic groups `{ lifecycle: 'none', fields: <all propagated fields> }` for every
   **live** parent row, run through `planChildChange` for this one child under the normal override, conflict and
   link rules (§4.4 step 2, same batched SQL, same plan function), plus `{ lifecycle: 'soft_delete', fields: [] }`
   for every soft-deleted parent row that has an alive copy in the child (so a delete missed while archived lands
   under the same override rule as a propagated delete);
3. child-run and outcome rows written under the resync run, so the brand's "Template updates" page shows the
   conflicts the re-apply found, exactly as a propagation would.

A resync therefore updates every non-overridden field to the current parent value, never touches an overridden one,
and resolves links that were unresolved earlier (T19b, T20). It is bounded by the parent row count (800 statements'
worth of row-operations at the load target, batched per table), runs in chunks like a propagation run when the parent
has more than `stepBudget` rows, and is idempotent (I11).

Transaction boundary: one transaction for all tables plus `seeded_at`. 800 rows at the load target is well under a
second; all-or-nothing means the readiness flag is trustworthy. The resync re-apply runs in its own per-table
transactions after the seed transaction, like a propagation run's child transaction.

A brand created before the template is populated seeds whatever exists (possibly nothing); every later parent insert
propagates as an insert (§4.8), so the child catches up row by row. Onboarding never waits on the template.

### 4.2 Child update with override tracking (`withBrand(...).updateTemplated`)

`withBrand(db, brandId, ctx?: { actorId: string; batchId?: string })` gains four methods that are the only path which
maintains `overridden_fields` and the journal:

```ts
.updateTemplated(spec, id, patch)      // returns { row, overriddenAdded: string[], runId?: string }
.insertTemplated(spec, values)         // returns { row, runId?: string }
.softDeleteTemplated(spec, id)         // returns { row, runId?: string }
.restoreTemplated(spec, id)            // returns { row, runId?: string }
```

Each runs in one transaction: `SELECT ... FOR UPDATE` the row scoped by brand and `deleted_at IS NULL`, call the pure
domain function, write. Patches containing hidden fields (from `brand_field_overrides`) or unknown keys are rejected by
the domain function before any SQL.

```ts
// packages/domain/src/template/override.ts (pure)
export function diffPropagated(before: Row, after: Row, spec): string[];      // keys whose normalised value changed
export function applyChildEdit(row: Row, patch: Partial<Row>, spec): { values: Partial<Row>; overriddenFields: string[]; overriddenAdded: string[] };
// overriddenFields = union(row.overriddenFields, diffPropagated(row, {...row, ...patch}, spec)), sorted, deduped (I4, I5)
```

```sql
-- $2 = overriddenAdded; the union is computed in SQL on the locked row (set arithmetic, §3.2), never assigned wholesale
UPDATE interface_pages
SET label = $1,
    overridden_fields = (SELECT coalesce(jsonb_agg(DISTINCT e ORDER BY e), '[]'::jsonb)
                         FROM jsonb_array_elements(overridden_fields || $2::jsonb) e),
    updated_at = now(), updated_by = $actor
WHERE id = $id AND brand_id = $C AND deleted_at IS NULL;
```

Child `softDeleteTemplated`: `SET deleted_at = now(), overridden_fields = overridden_fields ∪ ['deletedAt']`. Child
`restoreTemplated` keeps `'deletedAt'` in the array: the child owns the row's lifecycle from then on. Brand-local rows
(`template_row_id IS NULL`) never gain entries while they are brand-local; when one becomes a copy (new-row promotion
approval §4.5, `linkToTemplate` §4.10) its array is computed positively from the parent/child diff at that moment.

`insertTemplated` on a child brand for a table with a `naturalKey` is allowed (PRD §10 wants per-brand pages); the
partial unique index rejects a duplicate of an alive row, and a later template insert with the same key is skipped by
propagation as `skipped_key_conflict` (§4.4), never a failed child.

The Server Action returns `overriddenAdded`; when non-empty the UI shows the PRD §5 popup ("Keep for this brand only /
Propose to template", §4.5).

### 4.3 Parent update → journal → run (same four methods on the template brand)

`withBrand(db, brandId, ctx)` stays synchronous (TICKET-005). Each templated method reads `brands.is_template` inside
its own transaction (`SELECT is_template, template_brand_id FROM brands WHERE id = $brandId FOR SHARE`, one indexed
read, before the row lock); a route that already loaded the brand row may pass `ctx.isTemplate` as a hint, and the
transaction still verifies it and throws on a mismatch. On the template brand the same method leaves
`overridden_fields` untouched and, if `diffPropagated` is non-empty (or the kind is insert / soft_delete / restore),
attaches a journal row to the template's queued run inside the same transaction (I6):

```sql
-- 1. the one queued run for this template, created if absent (partial unique index makes this race-safe)
INSERT INTO propagation_runs (brand_id, trigger, status, attempt, created_by)
VALUES ($T, 'changes', 'queued', 1, $actor)
ON CONFLICT (brand_id) WHERE status = 'queued' AND trigger = 'changes'
DO UPDATE SET updated_at = now()
RETURNING id, attempt, resend_count, created_at, last_enqueued_at;
-- 2. the journal row
INSERT INTO template_changes (brand_id, run_id, batch_id, table_name, row_id, kind, changed_fields, source, created_by)
VALUES ($T, $runId, $batchId, 'interface_pages', $id, 'update', '["label"]'::jsonb, 'edit', $actor);
```

`DO UPDATE` takes a row lock on the queued run, so a concurrent claim (§5.3) waits until this transaction commits and
then sees its changes; if the claim won first, Postgres re-checks the partial index predicate and this transaction
inserts a fresh queued run. Either way every change belongs to exactly one run that has not started (I7).

A patch touching only local fields writes no journal row. `batchId` comes from `ctx` (one per Server Action
transaction; `randomUUID()` if absent) and is returned with the run row (`runId, attempt, resendCount, createdAt`) so
the action can call `enqueueRun(run)` after commit and return. **Request-path backstop (§5.4):** if the returned queued
run is older than 5 minutes (`created_at < now() − 5 min`), its earlier send was lost or the previous run is still
applying; the action calls `resendRun(runId)` instead, which bumps `resend_count`, sets `last_enqueued_at` and sends
the event with the resend id. This repairs a lost send within one save instead of waiting for the sweeper. Bulk CSV
import (Phase 5) calls `insertTemplated` per row inside one transaction with one `batchId` and `source 'import'`; that
is one run, not a hundred.

Non-admin writes to the template brand are refused by `requireTemplateEditor` at the route and by
`assertTemplateWriter(actor, brand)` in the domain (A10).

### 4.4 Propagation of a run (`propagateRun(db, registry, { runId, inngestRunId, stepBudget = 2000 })`)

Data flow, each numbered step maps to one Inngest step (§5.2). Every step output carries ids and field names only
(A6): the claim step returns groups and child ids, and every apply step re-reads the parent rows it needs. Template
content never enters Inngest state, and every apply step sees the parent row as it is when the step runs, which is the
correctness argument of §3.4 (a newer parent value is applied either by this step or by the run that journaled it).

1. **claim** (one short transaction):
   ```sql
   UPDATE propagation_runs
   SET status = 'running', claimed_by = $inngestRunId, claim_generation = claim_generation + 1,
       started_at = now(), audit_id = $auditId
   WHERE id = $runId
     AND (status IN ('queued', 'failed', 'partial')
          OR (status = 'running' AND (claimed_by = $inngestRunId OR started_at < now() - interval '30 minutes')))
   RETURNING id, attempt, claim_generation;
   ```
   Zero rows → the run is done or held by a live instance; return `{ skipped: true }`. `claimed_by = $inngestRunId`
   lets the same function run re-claim its own row when the process died between the claim commit and Inngest
   memoizing the step (the retry would otherwise see `running` with a fresh `started_at` and skip for 30 minutes);
   seed and resync runs use the same predicate. The 30-minute guard is for dead instances. Mutual exclusion is the
   pair (this claim, Inngest concurrency key), A12: the database cannot tell a dead instance from a live one in a long
   retry backoff, so a takeover is made explicit by `claim_generation`. Every later write to `propagation_runs` by this
   instance carries `WHERE claim_generation = $mine`; a stale instance that wakes after a takeover changes nothing
   there (its child-row writes are idempotent and are additionally stopped by the step-start check in step 2).

   Then read the changes (`SELECT * FROM template_changes WHERE run_id = $runId ORDER BY seq`) and coalesce them:
   ```ts
   // packages/domain/src/template/propagate.ts (pure)
   export function coalesceChanges(changes: TemplateChange[], registry): ChangeGroup[];
   // one group per (table, rowId) with two INDEPENDENT parts:
   //   lifecycle = last of {insert, soft_delete, restore} in seq order, or 'none' when the group holds only updates
   //   fields    = union of changedFields across the whole group; all propagated fields when lifecycle is insert or restore
   // lastChangeId = the change with the highest seq (stored on the outcome). Groups sorted by registry order, then by
   // first seq inside a table, so a persona and the angle that references it (same import) apply in order.
   ```
   Collapsing a group to one kind lost writes (an edit followed by a delete dropped the edit; a restore followed by an
   edit dropped the restore); keeping the parts separate is what lets the plan apply both (domain pair tests, §8).

   Children: `SELECT id FROM brands WHERE template_brand_id = $T AND deleted_at IS NULL AND status <> 'archived'`
   (unseeded brands included: propagation and seed are both idempotent through I2, so their order does not matter). On
   `attempt > 1` keep only children whose `propagation_child_runs` row for this run is missing or `failed`. The step
   returns `{ groups: ChangeGroup[], childIds, attempt, claimGeneration }`: at the load target a 100-row import is 100
   small objects, no row values. Children are split into chunks so that `children × groups ≤ stepBudget` row-operations
   per step (at least one child per step): one edit over 50 children is one apply step, a 100-row import over 50
   children is three, the 800-row migration import is twenty.

2. **apply:<i>** for each chunk. The step starts with
   `SELECT claimed_by, claim_generation FROM propagation_runs WHERE id = $runId` and throws
   `NonRetriableError('lost claim')` unless both equal this instance's (a re-claimed run belongs to the new instance,
   §5.4). It then reads the parent rows for its groups (`SELECT * FROM <table> WHERE id = ANY($ids)`, one statement
   per table, deleted rows included: the live state is what propagates). Per child, one transaction; inside it, tables
   in registry order:
   ```sql
   SELECT * FROM interface_pages WHERE brand_id = $C AND template_row_id = ANY($parentIds) FOR UPDATE;   -- copies, deleted or not
   -- link map for THIS table's link fields, read immediately before this table's groups are planned, after the
   -- referenced tables (earlier in registry order) were written in this same transaction
   SELECT template_row_id, id FROM interface_pages WHERE brand_id = $C AND deleted_at IS NULL AND template_row_id = ANY($linkTargetIds);
   -- natural-key owners for insert / restore groups (alive rows only, key values remapped through the link map)
   SELECT id, template_row_id, page_key FROM interface_pages WHERE brand_id = $C AND deleted_at IS NULL AND page_key = ANY($keys);
   ```
   Reading the link map per table, after the earlier tables' writes, is what makes an update that repoints
   `interface_fields.page_id` to a page inserted earlier in the same run resolve (T8). Self-links resolve in the
   post-pass after the table's inserts (§3.3).

   Then the plan function decides per group and SQL executes:
   ```ts
   export function planChildChange(input: {
     group: ChangeGroup; parent: Row; child: Row | null; spec;
     links: Record<string, string | null | 'unresolved'>;          // remapped value per link field of the parent
     naturalKeyOwner: Row | null;                                    // alive child row holding the remapped natural key, if any
   }): ChildPlan;
   // ChildPlan = { steps: PlanStep[]; outcome: OutcomeKind; recordOutcome: boolean;
   //               applied: string[]; skipped: string[]; conflicts: string[]; unresolved: string[]; parentValues }
   // PlanStep = { action: 'insert'; values: Row }
   //          | { action: 'update'; values: Partial<Row> }
   //          | { action: 'soft_delete' } | { action: 'restore' }
   ```
   A plan is an ordered list of up to three steps, always in this order: **(1) insert** when the copy is missing and
   the parent is alive (lifecycle `insert` or `restore`, or an update group whose copy is missing: the seed gap
   self-heals); **(2) fields** `group.fields − child.overriddenFields`, links remapped, applied to the copy whether it
   is alive or soft-deleted; **(3) lifecycle** (`soft_delete` / `restore`) under the override rules. An edit followed by
   a delete in one run writes the edit and then the tombstone; a restore followed by an edit inserts-or-restores and
   writes the edit; an edit followed by a restore restores and applies the edit.

   Rules for each step (the function checks them in this order):

   | Step | Condition | Action | Contribution to the outcome |
   | --- | --- | --- | --- |
   | insert | copy missing, parent `deleted_at IS NULL`, every non-nullable link resolves, natural key free | `INSERT ... SELECT` (§4.1 shape, `p.deleted_at IS NULL` kept, `ON CONFLICT DO NOTHING`, RETURNING); nullable unresolved links written NULL and listed in `unresolved`; then self-link post-pass and `recompute` | `inserted` when RETURNING has the row, else `noop` (never assumed) |
   | insert | copy missing, parent soft-deleted | nothing (seed and insert filter deleted parents; a later `restore` inserts it) | `noop` |
   | insert | copy missing, a non-nullable link unresolved | nothing (resync repairs) | `skipped_unresolved_link`, `unresolved = [field]` |
   | insert | copy missing, natural key held by another alive child row | nothing | `skipped_key_conflict`, `conflict_fields = naturalKey`, `parent_values` |
   | fields | copy exists (alive or deleted) | write `fields − overriddenFields`; a skipped field whose remapped parent value differs from the child's current value is a conflict; a link (nullable or not) whose target has no copy is moved to `unresolved` and **not written** (never NULL over a value) | `applied` / `partially_skipped` / `skipped_overridden` (nothing written, ≥1 conflict) / `skipped_equal` (nothing written, no conflict) / `skipped_unresolved_link` |
   | fields | lifecycle `insert`, copy exists (origin child of a promoted row, or a re-run) | same as above over all propagated fields | as above (usually `skipped_equal`) |
   | soft_delete | copy alive, `overridden_fields = []` after the fields step | `SET deleted_at = now()` | `soft_deleted` |
   | soft_delete | copy alive, any override | nothing; `conflict_fields ∪= ['deletedAt']` | `skipped_overridden` |
   | soft_delete | copy already deleted, or missing | nothing (a missing copy needs no tombstone: seed, insert and restore all read the parent's `deleted_at`) | fields outcome, else `noop` |
   | restore | copy missing, parent alive after the restore | handled by the insert step above | `inserted` |
   | restore | copy deleted, no `'deletedAt'` override, natural key free | `SET deleted_at = NULL` | `restored` |
   | restore | copy deleted, natural key held by another alive child row | nothing | `skipped_key_conflict` |
   | restore | copy deleted by the child (`'deletedAt'` override), or alive | nothing | fields outcome, else `noop` |

   Outcome precedence: a lifecycle step that ran names the outcome (`inserted`, `soft_deleted`, `restored`) and the
   fields step's lists ride along in `applied_fields` / `conflict_fields`; otherwise the fields step names it;
   `skipped_key_conflict` wins over both. `recordOutcome` is true only for the informative kinds (§3.6); the rest are
   counted on the child-run row.

   **Execution is batched per child transaction**, planned in memory first, at most three statements per table plus
   one child-run upsert per child (T25 asserts the statement count):
   ```sql
   -- (a) inserts: one multi-row INSERT ... SELECT FROM <table> p WHERE p.brand_id = $T AND p.deleted_at IS NULL AND p.id = ANY($insertIds)
   --     ON CONFLICT (brand_id, template_row_id) DO NOTHING RETURNING id, template_row_id;   -- outcome derived from RETURNING
   -- (b) field writes and lifecycle in one statement: each VALUES row carries a flag per propagated column and the lifecycle
   UPDATE interface_pages AS c
   SET label      = CASE WHEN v.set_label    THEN v.label    ELSE c.label    END,
       position   = CASE WHEN v.set_position THEN v.position ELSE c.position END,
       deleted_at = CASE v.lifecycle WHEN 'soft_delete' THEN now() WHEN 'restore' THEN NULL ELSE c.deleted_at END,
       updated_at = now(), updated_by = 'system:propagation:' || $runId
   FROM (VALUES ($id1, true, $l1, false, NULL, 'none'), ($id2, false, NULL, true, $p2, 'soft_delete'), ...)
        AS v(id, set_label, label, set_position, position, lifecycle)
   WHERE c.id = v.id AND c.brand_id = $C;
   -- (c) outcomes: one multi-row INSERT ... ON CONFLICT (run_id, brand_id, table_name, parent_row_id) DO UPDATE SET
   --     outcome = EXCLUDED.outcome, applied_fields = ..., skipped_fields = ..., conflict_fields = ..., unresolved_fields = ...,
   --     parent_values = ..., error = NULL, updated_at = now();
   --     plus DELETE FROM propagation_outcomes WHERE run_id = $runId AND brand_id = $C AND table_name = $t AND parent_row_id = ANY($nonInformative)
   -- (d) once per child: INSERT INTO propagation_child_runs (run_id, brand_id, status, counts) ... ON CONFLICT (run_id, brand_id) DO UPDATE
   ```
   A 100-row import over 50 children is 50 transactions of at most three statements per table plus one, not 5,000
   round trips; an apply step at the budget stays well inside `maxDuration` at any Vercel-to-Neon latency (§5.2).

   Updates are applied to soft-deleted child copies too (cheap, keeps them current for a later restore). If a child
   transaction throws, it is rolled back and one `propagation_child_runs` row `{ status: 'failed', error }` is upserted
   for that child in a separate short transaction (no per-row outcomes are invented); the step then rethrows so Inngest
   retries it. Re-running a child is safe: values come from the live parent, inserts hit `ON CONFLICT`, deletes and
   restores are guarded by `deleted_at` (I11).

3. **finish** (one transaction, `WHERE claim_generation = $mine`; zero rows → `NonRetriableError('lost claim')`):
   compare the child list computed at claim with `propagation_child_runs` for this run: `failedChildren` = children
   with no child-run row at all (the transaction failed and the failed-row write failed too, connection drop) plus
   rows with `status = 'failed'`. Derive `stats` from the child-run counts and the informative outcomes, set
   `status = CASE WHEN failedChildren = 0 THEN 'succeeded' ELSE 'partial' END`, `finished_at = now()`, close the audit
   row. `onFailure` (all Inngest retries exhausted) sets `status = 'failed'` and the error under the same generation
   guard.

Transaction boundaries: claim; one per child; finish. Nothing holds a lock across steps. The `FOR UPDATE` on child
copies serialises correctly against a concurrent child edit on the same row (the edit's `FOR UPDATE` waits, then its
`overridden_fields` union is computed on the propagated value); PGlite cannot exercise two connections, so this is
part of the two-connection runbook script (G6).

### 4.5 Promotion request lifecycle

**Request** (child user clicks Promote in the popup or the row menu). `requestPromotion(db, registry, { actorId,
brandId, tableName, rowId, fields?, note })` inside `withTemplateScope(reason: 'promotion_request')`, one transaction
that starts with `childRowById(..., { forUpdate: true })`:

```ts
// packages/domain/src/template/promotion.ts (pure)
export function buildPromotionRequest(child: Row, parent: Row | null, links: LinkMaps, spec, fields?: string[]): PromotionDraft;
//  fields default = child.overriddenFields ∩ propagatedFields (all propagated fields for a brand-local row)
//  base = pick(parent, fields) with parent link ids; proposed = pick(child, fields) with links remapped child -> parent
//  throws UnresolvedLinkError { field, childLinkId } when a link target is brand-local (promote that row first)
//  throws NothingToPromote when fields is empty
```

The row lock serialises requests per child row: the second of two editors clicking Promote at once waits, then sets
the first request to `superseded` and inserts its own. The partial unique index `promotion_requests_one_pending` is
the safety net, not the mechanism; a unique violation can only mean a bug and is not caught. (T12 runs two requests
back to back and asserts one pending, one superseded.) A brand-local row produces a request with `parent_row_id NULL`.

**Review** (Admin dashboard). `listPromotionRequests` is a read-only scope behind `requireAdmin()` (no audit row, I8)
and joins the live parent. `reviewPromotion(request, currentParent | null)` (pure) returns `{ stale: string[];
conflicts; parentDeleted: boolean; alreadyMatching: string[] }` where `conflicts[f]` exists when `currentParent[f] ≠
base[f]` and `≠ proposed[f]`, `alreadyMatching` lists fields whose current parent value already equals the proposal, and
`parentDeleted` is a single conflict on `'deletedAt'`. The badges are computed for display; approval recomputes them on
locked rows.

**Approve** (`approvePromotion(db, registry, { actorId, requestId, approvedFields?, decisions?, reviewNote? })`,
`requireAdmin()` only), one transaction. Lock order, always the same to avoid deadlocks with `requestPromotion` and
child edits: **(1)** the `promotion_requests` row `FOR UPDATE` (zero rows or not pending → `NotPending`), **(2)** the
parent row `scope.parentRow(spec, request.parentRowId, { forUpdate: true })` (null for a new-row request), **(3)** the
child row `scope.childRowById(spec, request.brandId, request.childRowId, { forUpdate: true })`. Every decision below is
computed on these locked rows, so a parent edit or a child edit that lands between the admin's page load and the click
is seen: a parent edit turns into a conflict that needs a decision (or a stale-request error), a child edit is kept as
an override.

```ts
const links    = await scope.resolveLinksToParent(spec, request.brandId, linkIdsOf(childLocked, spec));  // child link ids -> parent ids
const decision = decidePromotion(request, parentLocked, approvedFields ?? request.fields, decisions);   // pure
// throws MissingDecision(field) if an approved field is in conflict on the LOCKED parent and has no decision
// throws MissingDecision('deletedAt') if the parent is soft-deleted and decisions.deletedAt !== 'restore_parent'
// parentPatch = proposed for non-conflicting approved fields + 'take_proposed' fields; 'keep_current' fields are dropped
// alreadyMatching fields are recorded in approved_fields but not written
if (request.parentRowId === null) {
  const parent = await withBrand(tx, T, { actorId, batchId }).insertTemplated(spec, decision.parentValues);     // journal 'insert'
  // the origin child becomes the copy of the new parent row; its overrides are computed POSITIVELY: every propagated
  // field whose current child value differs from the new parent's remapped value (fields the admin did not approve,
  // fields the child edited after the request) so the insert that propagates back cannot overwrite them
  const add = overridesForLinkedRow(childLocked, parent, links, spec);    // pure: propagatedFields.filter(f => childLocked[f] !== remap(parent[f]))
  await scope.writeChild(spec, request.brandId, request.childRowId, { templateRowId: parent.id }, { addOverrides: add });
} else {
  if (decision.restoreParent) await withBrand(tx, T, ctx).restoreTemplated(spec, request.parentRowId);           // journal 'restore'
  await withBrand(tx, T, { actorId, batchId }).updateTemplated(spec, request.parentRowId, decision.parentPatch);   // journal 'update'
  const { remove } = settleOverrides(childLocked, request.proposed, decision.appliedFields);
  await scope.writeChild(spec, request.brandId, request.childRowId, {}, { removeOverrides: remove });
}
```
```sql
UPDATE promotion_requests
SET status = 'approved', reviewed_by = $actor, reviewed_at = now(), review_note = $note,
    approved_fields = $approved, conflicts = $conflicts, decisions = $decisions, applied_batch_id = $batchId
WHERE id = $r AND status = 'pending';      -- zero rows => NotPending
```

`settleOverrides(childLocked, proposed, appliedFields)` (pure) returns the fields to **remove** from the origin child's
overrides: those that were applied to the parent and whose locked child value still equals `proposed[f]`. It never
returns a full replacement array and never assumes the request-time override set is current: `writeChild` applies it
as `overridden_fields − $remove` on the locked row (§6), so an override added by a child edit between request and
approval (`position` while `label` was pending) survives both the approval and the next propagation (T13). The journal
rows carry `source 'promotion'` and `promotion_request_id`. After commit the action calls `enqueueRun`; propagation
delivers the promoted values to every other child (the origin hits equal values or `ON CONFLICT`; for a new-row
promotion it hits `insert | exists` with the positively computed overrides, so an unapproved field keeps the child's
value, T15). Approving a new-row promotion whose link target has no parent counterpart is refused with
`UnresolvedLinkError`: nothing cascades, nothing auto-promotes (I9).

**Reject / withdraw**: `UPDATE promotion_requests SET status = 'rejected' | 'withdrawn', reviewed_by, reviewed_at,
review_note WHERE id = $r AND status = 'pending'`. Reject requires a note; withdraw is the requester, an admin, or
`resetToTemplate` on the same row (§4.7: a reset abandons the proposed value, so the request must not outlive it). No
other table changes; the child keeps its overrides.

State machine (`packages/domain/src/state/promotion.ts`; the UI reads allowed transitions from here):

```
                       withdraw (requester | admin | resetToTemplate on the row) ──► withdrawn
                       │
  create ──► pending ──┼── approve (admin; approvedFields ⊆ fields; a decision for every conflict) ──► approved
                       │
                       ├── reject (admin, note) ─────────────────► rejected
                       │
                       ├── new request on the same child row ────► superseded
                       │
                       └── resetToTemplate on a strict subset of fields ──► superseded (a narrowed pending request replaces it)
  approved | rejected | withdrawn | superseded are terminal.
  stale / parentDeleted / alreadyMatching are computed badges on pending, never stored states.
```

### 4.6 Structural change (new column) — never per-brand columns

Runbook section "Rolling a schema change out to every brand" (`docs/runbook.md`):

1. Migration adds the column to the one table (nullable or with a default). Every brand has it immediately.
2. Registry entry: add the key to `propagatedFields` or `localFields`. `registryCompleteness` fails until you decide.
3. If the migration backfills parent rows with real values, run the admin action `resyncTemplateField(tableName,
   field)`: inside one transaction it attaches to the queued run and inserts one `template_changes` row (`kind 'update'`,
   `changed_fields [field]`, `source 'field_resync'`) per live parent row, then enqueues. Children without an override
   on that field receive the value.
4. Visibility: `reconcileFieldCatalog(db, registry)` (run by `db:migrate` and by the deploy hook) inserts a
   `brand_field_overrides` row (`hidden false`) into the **template brand** for every registered propagated or local
   field that lacks one, as ordinary template inserts under `source 'field_resync'`; propagation inserts them into
   every child. A brand that does not want the field flips `hidden` locally (an override). `fieldVisibility(withBrand(C),
   tableName)` is what forms and CSV templates call; hidden fields are omitted from forms and stripped from accepted
   patch keys.
5. Removing a column: migration drops it and runs `UPDATE <table> SET overridden_fields = overridden_fields - 'field'`
   (jsonb `-` on a string array) plus the same on `promotion_requests.fields` for pending requests; the registry entry
   goes; `reconcileFieldCatalog` soft-deletes the catalog rows for fields no longer registered (propagates as
   soft-deletes).
6. Renaming: `renameFieldKey(tx, targets, tableName, from, to)` (`packages/db/src/template/migrate-helpers.ts`) is
   registry-driven: `targets` is a list of `{ table, column, kind: 'array' | 'objectKeys' | 'scalar' }` that each
   ticket appends to (`fieldKeyTargets` in `packages/db/src/template/field-key-targets.ts`). TICKET-021 registers
   `<templated table>.overridden_fields` (array) and `template_changes.changed_fields` (array); TICKET-026 registers
   `brand_field_overrides.field_name` (scalar); TICKET-030 registers `promotion_requests.fields` (array) and
   `promotion_requests.base` / `proposed` (objectKeys) together with their test (T23b). The helper runs in the same
   migration as the column rename.

### 4.7 Reset a child field to template (`resetToTemplate`)

`resetToTemplate(db, registry, { actorId, brandId, tableName, rowId, fields: string[] | 'all' })`, one transaction inside
`withTemplateScope(reason: 'reset_to_template', targetBrandId: brandId)`:

```ts
const child  = await scope.childRowById(spec, brandId, rowId, { forUpdate: true });     // refuses brand-local rows (NoTemplateRow)
const parent = await scope.parentRow(spec, child.templateRowId);                          // deleted rows included
const links  = await scope.resolveLinks(spec, brandId, parent);
const { values, removeOverrides } = resetFields(child, parent, links, fields, spec);      // pure: parent values, the override entries to remove
await scope.writeChild(spec, brandId, rowId, values, { removeOverrides });                // raw write, bypasses override tracking on purpose (I4 kept); jsonb '-'
await scope.acknowledgeConflicts(brandId, tableName, rowId, fields);                      // field-level: conflict_fields - fields, acknowledged only when empty (§4.9)
await scope.settlePendingPromotion(brandId, tableName, rowId, fields);                    // see below
```

`fields = ['deletedAt']` (or `'all'`) on a copy the child deleted restores it if the parent is alive, or deletes it if
the parent is deleted, and removes the lifecycle override. An unresolvable non-nullable link throws
`UnresolvedLinkError` and the transaction rolls back.

**Pending promotion on the same row.** A reset abandons the child's value, so a pending `promotion_requests` row that
still proposes it must not survive: if the admin approved it later, the discarded value would reach the parent and
propagate back to the child (no override any more). Inside the same transaction, `settlePendingPromotion` locks the
pending request for `(table, child row)` if any and: when `fields` covers all of the request's fields (or is `'all'`),
sets it to `withdrawn` (`review_note = 'reset to template'`); when the intersection is partial, sets it to `superseded`
and inserts a new pending request narrowed to `request.fields − fields` with the same `base` / `proposed` subsets and
`requested_by`. Both transitions are in the state machine (§4.5) and T11.

### 4.8 Parent soft delete, parent restore, new parent rows

- **Parent soft delete** (`softDeleteTemplated` on T, journal `soft_delete`): template-owned copies follow
  (`overridden_fields = '[]'`), child-owned copies stay and get a row-level conflict (`conflict_fields = ['deletedAt']`,
  §4.4). The child's "Template updates" page offers Keep mine (acknowledge) or Delete here too (`softDeleteTemplated`).
  Nothing is hard-deleted.
- **Parent restore** (journal `restore`): copies that propagation deleted come back; copies the child deleted itself
  (`'deletedAt'` in overrides) stay deleted. Symmetric with the delete rule and row-local: no history lookup needed. A
  child that has **no copy** (created while the parent row was soft-deleted, so seed skipped it, or its insert was
  skipped) receives one: restore is "insert if missing, else restore" (§4.4), so a restored parent row reaches every
  child without a manual resync (T10). The fields carried by the same group are applied after the insert / restore.
- **New parent row after children exist** (`insertTemplated` on T, journal `insert`): propagates as an insert into every
  non-archived child with `overridden_fields = []`, links remapped. If a non-nullable link cannot resolve in a child
  (target never seeded), outcome `skipped_unresolved_link`; `resyncBrand` inserts it later. This is also how a brand
  created against an empty template fills up (§4.1).

### 4.9 Conflicts (parent changed a field the child overrode)

No conflict table. A conflict is a `propagation_outcomes` row for the child brand with `conflict_fields <> '[]'` and
`acknowledged_at IS NULL` (partial index in §3.6). The condition is strict: a skipped field whose remapped parent value
already equals the child's current value is `skipped_equal`, not a conflict. The brand's "Template updates" page lists
the latest unacknowledged outcome per `(table, child row)` with child value (from the row) and template value (from
`parent_values`), no cross-brand read. Actions:

- **Keep mine** → `acknowledgeConflicts(brandId, tableName, childRowId, fields?)`. Without `fields` it is row-level:
  `UPDATE propagation_outcomes SET acknowledged_at = now(), acknowledged_by = $u WHERE brand_id = $C AND table_name =
  $t AND child_row_id = $r AND acknowledged_at IS NULL` (all open outcomes for the row, so repeated parent edits do not
  pile up). With `fields` it is field-level: `UPDATE propagation_outcomes SET conflict_fields = conflict_fields -
  $fields::text[], parent_values = parent_values - $fields::text[], acknowledged_at = CASE WHEN conflict_fields -
  $fields::text[] = '[]'::jsonb THEN now() END, acknowledged_by = ... WHERE ... AND acknowledged_at IS NULL`, so
  resetting `label` on a row whose outcome also lists `position` leaves the `position` conflict open for someone to
  decide (T11). `resetToTemplate` always uses the field-level form.
- **Take template** → `resetToTemplate` (§4.7), which acknowledges the reset fields as part of its transaction.
- Row-level (`deletedAt`): Keep mine / Delete here too.
- `skipped_key_conflict` (a template row could not be inserted or restored because a brand-local row holds its
  natural key): the page shows both rows; the actions are Keep mine (acknowledge), or delete or rename the local row
  after which the next resync or parent edit inserts the copy.

The dashboard badge is `SELECT count(DISTINCT (table_name, child_row_id)) ... WHERE brand_id = $C AND acknowledged_at IS
NULL AND conflict_fields <> '[]'`.

### 4.10 Adopting an existing row as a copy (`linkToTemplate`, the migrator's tool)

Migrated Airtable bases (Phase 6) become children of the agency template, but their rows arrive as brand-local rows
(`template_row_id NULL`). Without a link the engine ignores them (I12) and inserts every template row next to them,
producing "Persona X" twice. `linkToTemplate(db, registry, { actorId, brandId, tableName, rowId, parentRowId })` runs
under `withTemplateScope(reason: 'import', targetBrandId: brandId)`, one transaction:

1. lock the child row `FOR UPDATE`; refuse unless `template_row_id IS NULL` (`AlreadyLinked`);
2. refuse unless the parent row exists in the brand's `template_brand_id` (`NoSuchParent`) and no other row in the
   brand has `template_row_id = parentRowId`, deleted rows included (I2, `CopyExists`);
3. `SET template_row_id = $parentRowId`, `overridden_fields = overridesForLinkedRow(child, parent, links, spec)` (the
   same positive rule as new-row approval, §4.5: every propagated field whose child value differs from the remapped
   parent value; links that point at brand-local targets count as overrides);
4. no journal row (the parent did not change) and no propagation; from the next run on the row is an ordinary copy:
   propagation updates its non-overridden fields only (T28).

The migrator (`scripts/`, `packages/integrations/airtable`) calls it after matching imported rows to template rows by
their natural key or label; rows it cannot match stay brand-local and the template's copies are inserted beside them
for the human to reconcile in the dry-run report. It is also the manual repair for a `skipped_key_conflict` when the
local row *is* the template row under a different id.

---

## 5. Background jobs (Inngest)

`packages/integrations/src/inngest/`: `client.ts` (`createInngest(env)` factory, no singleton), `events.ts` (zod
schemas), `functions/propagate-run.ts`, `functions/seed-brand.ts`, `functions/sweep-runs.ts`,
`functions/retention.ts`, `enqueue.ts`. `apps/web/app/api/inngest/route.ts` serves them and exports
`maxDuration = 300` (Vercel Pro, A14, §12). Function bodies are one-line wrappers: the work is `propagateRun`,
`seedBrand`, `resyncBrand`, `findRunsToResend`, `retentionSweep` in `@tas/db`, which tests call directly on PGlite
(G6).

### 5.1 Events

| Event | Payload | Event `id` (Inngest dedupes for 24 h) |
| --- | --- | --- |
| `template/run.queued` | `{ templateBrandId, runId, attempt, resend }` | `run:<runId>:<attempt>` on the first send of an attempt; `run:<runId>:<attempt>:resend:<resendCount>` when a queued run is re-sent |
| `brand/seed.queued` | `{ brandId, templateBrandId, runId, attempt, resend, trigger: 'seed' \| 'resync' }` | same scheme |
| `template/run.finished` | `{ runId, templateBrandId, status, stats }` | `run-finished:<runId>:<attempt>` (Phase 5 notification consumer) |

`enqueueRun(inngest, run)` builds the event (ids only, A6) from the run row and sends it. Server Actions call it after
commit and return (never inside the transaction, never an external call before commit). Saves into the same queued run
send identical ids; Inngest keeps one. A lost send is repaired by the request-path backstop (§4.3), the admin
propagation page and the sweeper (§5.4), all through `resendRun`, which never touches `attempt`.

### 5.2 `propagate-run` (`template/run.queued`)

- `concurrency: { key: event.data.templateBrandId, limit: 1 }` so runs for one template apply in order;
  `retries: 3`; no Inngest `idempotency` and no debounce: the database claim is the authority.
- Steps: `coalesce` (`step.sleep('coalesce', '20s')`, A13) → `claim` → `apply:0 … apply:n-1` → `finish`, with
  `n = max(1, ⌈children × groups / stepBudget⌉)`. 50 brands and one edit = 4 step executions; a 100-row import = 6;
  the 800-row migration import = 23.
- Coalescing window: without the sleep a save is claimed within seconds of its commit and the design would be one run
  per save. The 20 s sleep lets the saves of one editing burst share the queued run; with `limit: 1` a save that lands
  while the previous run is applying joins the next queued run anyway. It is an optimisation only: correctness stays
  with the database claim, the attempt-suffixed ids and the sweeper (§11).
- Step unit: a budget of `stepBudget = 2000` (child × group) row-operations, not a fixed number of children, so the
  chunk count scales with the change set. Each child transaction issues at most three statements per table plus one
  child-run upsert (§4.4), so an apply step at the budget is ≤ 50 transactions of a few statements each, well under a
  minute from Vercel to Neon and far inside `maxDuration = 300`. T25 asserts the statement count per child
  transaction; T25L asserts it on the 800-row case.
- Failure isolation: a failing child rolls back its own transaction, records a `failed` child-run row and the step
  retries. A retried step re-applies every child in its chunk, including those that already committed: re-application
  is idempotent and the upserts overwrite their rows, so no skip logic is needed. After three retries the run is
  `partial` or `failed`; the sweeper re-sends it up to `attempt = 3`, re-applying only children whose child-run row is
  missing or `failed`. A poisoned child cannot block the others or burn executions forever; the admin propagation page
  shows it with a Retry button (sets `attempt + 1`, re-sends).
- Mutual exclusion: the pair in A12. `claimed_by` and the 30-minute `running` guard stop a sweeper re-send from claiming
  a live instance's run; if a takeover does happen (an instance in a long retry backoff), the old instance's next apply
  or finish step reads `claimed_by` / `claim_generation`, sees another instance and stops with `NonRetriableError('lost
  claim')` (§4.4), so two instances never apply or finish the same run at once (T24).

### 5.3 `seed-brand` (`brand/seed.queued`)

- `concurrency: { key: event.data.brandId, limit: 1 }`, `retries: 3`. Steps: `claim` (same SQL as §4.4 step 1,
  including the self-re-claim predicate), `seed` (one transaction, §4.1), `finish`. Three executions per brand.
- `resync` runs `resyncBrand`: `claim`, `seed`, then `apply:0 … apply:n-1` over the synthetic groups (§4.1, same
  budget as a propagation run), `finish`.

### 5.4 `sweep-runs` (cron `0 7-21 * * 1-6`, agency timezone, ≈ 400 executions per month)

Hourly during agency hours only: a 24/7 `*/15` cron would wake Neon every 15 minutes and by itself keep compute on for
about eight hours a day (§5.5). Between sweeps the request-path backstop (§4.3: any template write that finds its queued
run older than 5 minutes re-sends it after commit) and the admin propagation page (re-sends stale queued runs on load,
same rule) cover the common case within one user action. One step, `findRunsToResend(db, now)`:

```sql
SELECT * FROM propagation_runs
WHERE deleted_at IS NULL AND (
     (status = 'queued'  AND coalesce(last_enqueued_at, created_at) < now() - interval '5 minutes')   -- send lost, or waiting behind the previous run
  OR (status = 'running' AND started_at < now() - interval '30 minutes')                            -- instance died
  OR (status IN ('failed', 'partial') AND attempt < 3))                                             -- retry budget
```

Send repair and retry budget are separate:

- **queued** → `UPDATE propagation_runs SET resend_count = resend_count + 1, last_enqueued_at = now() WHERE id = $id
  AND status = 'queued' RETURNING *`, then `enqueueRun` with id `run:<runId>:<attempt>:resend:<resendCount>` (unique,
  so the 24-hour dedupe never swallows it). `attempt` is untouched: a queued run legitimately waits behind the
  template's previous run (`limit: 1`; a 100-row import over 50 brands takes minutes) and must arrive at its first
  execution with its full retry budget.
- **running (stale)** and **failed | partial** → `UPDATE ... SET attempt = attempt + 1 WHERE id = $id AND attempt < 3
  RETURNING *`, then `enqueueRun` with `run:<runId>:<attempt>`. These runs have executed at least once, so the re-send
  is a retry and spends budget (a dead instance is a failed attempt; without a ceiling a run that kills its instance
  every time would be re-sent forever). Runs at `attempt = 3` stop being re-sent and surface on the admin propagation
  page. A stale-running takeover succeeds through the claim (`claim_generation + 1`); the old
  instance, if still alive, loses its claim at its next step (§5.2).

### 5.5 Cost at the load target (50 brands, 100 rows, 8 tables, 20 template saves per working day)

Inngest step executions per month:

| Item | Per month | Executions |
| --- | --- | --- |
| Change runs (≈ 1 run per save, A13: 20 saves × 22 days = 440 runs, some bursts coalesce) | 440 × 4 | 1,760 |
| Imports (4 × 100-row CSV) | 4 × 6 | 24 |
| Seeds and resyncs (10 brands) | 10 × 3 | 30 |
| Sweeper (hourly, 15 h × 26 days) | 390 × 1 | 390 |
| Retention (weekly) | 4 × 1 | 4 |
| Retries (5 % of runs) | 22 × 4 | ~90 |
| **Total** | | **≈ 2,300** |

Under 5 % of the assumed free quota (A5). Neon compute: business-hours use ≈ 10 h × 22 days × 0.25 CU = 55 CU-hours;
the sweeper runs inside those hours and adds at most 26 × 5-minute wake-ups on days nobody is editing (≈ 0.5 CU-hour);
off-hours wake-ups come only from Inngest retries and are negligible. ≈ 60 CU-hours per month against the free plan's
allowance, which D-006 must confirm (§12); if it is lower, the sweeper drops to every two hours and the retention job
moves into business hours. Neon storage: 40k data rows plus the ledgers bounded by the 90-day retention (§3.6): at 50
child-run rows per run, 440 runs a month and 5,000 `inserted` outcomes per import, the steady state is under 30 MB
including indexes, inside the free 0.5 GB with room for growth. Peak connections: one claim plus one child
transaction per running function, at most a handful. Zero added USD beyond the Vercel Pro line D-006 already carries.

---

## 6. Tenancy: `withBrand` versus the privileged scope

`withBrand(db, brandId, ctx)` stays the only way Server Actions touch branded rows and stays synchronous. It gains the
four templated methods (§4.2) so "every mutation goes through a domain function" holds: they call the pure domain
functions and are the only writers of `overridden_fields` and the journal from user code. Each reads `is_template`
inside its transaction (§4.3). `withBrand` cannot read another brand; on the template brand it writes the journal,
nothing more.

The engine legitimately crosses brands. It does so only through:

```ts
// packages/db/src/template/scope.ts
export type EngineAudit = { actorId: string; reason: EngineReason; targetBrandId?: string; subject?: Subject };
export async function withTemplateScope<T>(db, registry, templateBrandId, audit: EngineAudit,
                                           fn: (scope: TemplateScope) => Promise<T>): Promise<T>;
// 1) INSERT engine_audit_log (status 'running') in its own statement, outside any transaction, so it survives a rollback
// 2) run fn(scope); scope counts rows written
// 3) UPDATE engine_audit_log SET status = 'succeeded' | 'failed', rows_written, error, closed_at = now(); rethrow on failure
export async function withTemplateRead<T>(db, registry, templateBrandId, fn: (scope: TemplateReadScope) => Promise<T>): Promise<T>;
// read-only subset (childBrands, parentRow(s), childRow(s), run and request listings); no audit row (I8)

interface TemplateScope extends TemplateReadScope {
  auditId: string;
  tx<R>(fn: (s: TemplateScope) => Promise<R>): Promise<R>;
  childBrands(): Promise<{ id: string; status: BrandStatus; seededAt: Date | null }[]>;
  parentRow(spec, rowId, opts?: { forUpdate }): Promise<Row | null>;               // template brand only, deleted included
  parentRows(spec, ids: string[]): Promise<Row[]>;
  childRow(spec, childBrandId, templateRowId, opts?: { forUpdate }): Promise<Row | null>;
  childRowById(spec, childBrandId, rowId, opts?: { forUpdate }): Promise<Row | null>;
  childRows(spec, childBrandId, templateRowIds: string[], opts?): Promise<Row[]>;
  resolveLinks(spec, childBrandId, parentIds: string[]): Promise<Map<string, string>>;          // parent id -> child id (alive copies)
  resolveLinksToParent(spec, childBrandId, childIds: string[]): Promise<Map<string, string | null>>;
  naturalKeyOwners(spec, childBrandId, keys: Record<string, unknown>[]): Promise<Row[]>;      // alive rows holding a remapped natural key
  writeChild(spec, childBrandId, rowId, values: Partial<Row>,
             overrides?: { addOverrides?: string[]; removeOverrides?: string[] }): Promise<void>;
  //   raw, no override tracking; brand from the argument, never the payload; `values` may not contain overriddenFields:
  //   overrides are written as jsonb set arithmetic on the locked row
  //   (overridden_fields = sort(dedupe((overridden_fields - $remove) || $add))) so no path can drop an entry it did not compute
  applyChildPlans(spec, childBrandId, plans: PlannedGroup[]): Promise<AppliedCounts>;         // the batched statements of §4.4
  insertChildFromParent(spec, childBrandId, parentRowId): Promise<{ inserted: boolean; childId?: string }>;
  seedTable(spec, childBrandId): Promise<{ parents: number; inserted: number; unresolved: number }>;
  upsertChildRun(run: ChildRunRow): Promise<void>;
  upsertOutcomes(outcomes: OutcomeRow[], dropKeys: OutcomeKey[]): Promise<void>;
  acknowledgeConflicts(childBrandId, tableName, childRowId, fields?): Promise<number>;
  settlePendingPromotion(childBrandId, tableName, childRowId, fields: string[] | 'all'): Promise<void>;   // §4.7; added by TICKET-032a once promotion_requests exists (TICKET-030)
}
```

The class constructor is private; the factory that inserts the audit row is the only thing that returns a mutating
instance (I8). `writeChild`, `applyChildPlans` and `insertChildFromParent` accept only registered tables and take the
brand from the argument.

Fence (ESLint `no-restricted-imports`, owned by the integrator stage of TICKET-024): `@tas/db/template/scope` may be
imported only from `packages/db/src/template/**` and `packages/integrations/src/inngest/**`. `apps/web` never imports
the scope; it imports named operations from `@tas/db/template/ops`: `requestPromotion`, `withdrawPromotion`,
`rejectPromotion`, `approvePromotion`, `listPromotionRequests`, `resetToTemplate`, `acknowledgeConflicts`,
`resyncBrand`, `resyncTemplateField`, `reconcileFieldCatalog`, `linkToTemplate`, `listRuns`, `retryRun`, `resendRun`.
Each mutating op opens the scope with the caller's user id and a fixed reason; each read op uses `withTemplateRead`.
Route helpers are the second line: `requireTemplateEditor(templateBrandId)` = `requireAdmin()` in V1; promotion
approval, resync, retry and `linkToTemplate` are `requireAdmin()`; reset and acknowledge are `requireBrandRole(brandId,
internal roles)`; clients never reach any of them.

Audit trail: `engine_audit_log` (actor, reason, status, rows) → `propagation_runs.audit_id` →
`propagation_child_runs` / `propagation_outcomes.run_id`; promotion approvals additionally store `applied_batch_id`,
and the journal rows store `promotion_request_id`. Reads are not audited (I8): the admin dashboards are behind
`requireAdmin()` and an audit row per page view had no forensic value.

---

## 7. Themes (global) and interface configuration as a template

**Themes.** `themes` is `baseColumns` only with `CHECK (brand_id IS NULL)`, no templated columns, not registered.
Concepts (Phase 3) declare `themeId` in `propagatedFields` and `links: [{ field: 'themeId', to: 'themes', nullable: true }]`;
seed and propagation copy the id verbatim; promotion carries it unchanged. A registry entry for a table without
`template_row_id` is rejected by `createTemplateRegistry`, so `themes` can never be registered by accident (T18).

**Interface configuration (PRD §10).** `interface_pages` and `interface_fields` (§3.9) are ordinary registry entries.
The template brand's rows are the PARENT interface; each child's copies are its CHILD interface. Switching a page off
for one brand is `updateTemplated` on the child (override on `enabled`); changing the default field list for every brand
is an edit on the template (propagates, skipping overrides); making one client's layout the default is a promotion
request. Client users never write these tables (route helper). Phase 4 adds screens only; Phase 2 proves the linked
pair end to end (T2, T8, T15).

---

## 8. Test plan on PGlite

Fixture `testTemplateWorld()` in `packages/db/src/template/testing.ts`: migrations applied, one agency, template brand T,
children A and B (seeded), actor id; returns `{ db, registry, T, A, B, actor }`. `fixtureRegistry(db)` adds test-only
tables (`fx_items` with a `themeRef` global link, a nullable self-link `parentItemId` and a local `status`; `fx_links`
→ `fx_items`; `fx_pairs`, a join table with two non-nullable links) for tests that need a table the production registry
does not have. Inngest functions are never started; tests call `propagateRun`, `seedBrand`, `resyncBrand`,
`findRunsToResend` directly. Domain tests use fixtures only, no database.

Two Vitest projects in `packages/db`: the default suite (every ticket's Definition of Done runs it) and
`vitest.load.config.ts` (script `test:load`, excluded from the root `test` task, run nightly in CI) which holds T25L.
Properties that need two connections are not in either; they are the runbook's two-connection script (G6, §12).

| # | Test | Proves |
| --- | --- | --- |
| T1 | seed A from T (3 pages, 5 fields): counts, `template_row_id` set, `overridden_fields = []`, `seeded_at` set; second seed changes nothing | I1, I2, I13, seed idempotent |
| T2 | seeded `interface_fields.page_id` equals A's page whose `template_row_id` is the parent page; fixture self-link `parentItemId` is remapped by the post-pass; fixture join table rows resolve both sides | link remap on seed, §3.3 |
| T3 | seeded rows have `updated_by` = seed actor and local defaults; parent local values are not copied (fixture `status`) | field classes |
| T4 | template `updateTemplated(label)` → journal row `changed_fields ['label']` attached to a queued run, `overridden_fields` untouched; local-only patch → no journal row; a throwing transaction leaves no run; the returned run row carries `createdAt` / `resendCount` for the backstop | I5, I6, §4.3 |
| T5 | child `updateTemplated(label)` → `overridden_fields ['label']`, `overriddenAdded ['label']`; same value again → unchanged; local field → nothing; unknown key and hidden field rejected; `is_template` mismatch with `ctx.isTemplate` throws | I4, I5, A8, §4.3 |
| T6 | propagate: A (no override) gets label, no per-row outcome, child-run row `counts.applied = 1`; B (overridden) keeps its own with outcome `skipped_overridden`, `conflict_fields ['label']`, `parent_values`; B overridden to the same value → counted `skipped_equal`, no outcome row; run stats match child-run rows and outcomes | I3, I7, §3.6, §4.9 |
| T7 | same run applied twice; two runs in reverse order; a retried chunk after an injected failure (fixture CHECK) → identical rows, one child-run row per (run, child), one outcome per (run, child, row), `failed` overwritten, status `partial` then `succeeded` on attempt 2; a child whose failed-row write is suppressed (fixture hook) has no child-run row and the run is `partial` | I11, I7, I14, §4.4 finish |
| T8 | template `insertTemplated(page)` after seed → A and B receive copies; brand-local rows in A untouched; a persona-then-angle pair inserted in one batch applies in registry order; an insert-page + repoint-field pair in one run resolves the new page (per-table link map) | insert propagation, I12, ordering, §4.4 |
| T9 | template soft-deletes a page: A's clean copy deleted; B's overridden copy kept with `conflict_fields ['deletedAt']` | §4.8 |
| T10 | template restores: A's copy restored; a copy B deleted itself (`'deletedAt'` override) stays deleted; brand C seeded while P was deleted has no copy, P restored → C receives the copy (`restore | missing → insert`) | §4.8, §4.4 |
| T11 | `resetToTemplate(B, ['label'])` copies the parent value, removes only that override (jsonb `-`), narrows the outcome's `conflict_fields` (a `['label','position']` outcome keeps `position` open, not acknowledged), writes a closed audit row; refuses a brand-local row; `['deletedAt']` reconciles lifecycle; a pending promotion on `['label']` becomes `withdrawn`, one on `['label','position']` becomes `superseded` with a new pending request on `['position']` | §4.7, §4.9, I8 |
| T12 | `requestPromotion` from B: `base`/`proposed` snapshots with links mapped to parent ids; two requests back to back → one `superseded`, one `pending`, no unique violation; empty fields refused | §4.5 |
| T13 | approve with the parent unchanged: parent updated, journal rows with `source 'promotion'`, `applied_batch_id` set, B's `label` override removed; a B edit of `position` committed between request and approval keeps its override through the approval and the next propagation; propagate → A receives the value; approve a subset → only those fields written | I9, settle, §4.5 locking |
| T14 | approve after the parent moved: the decision is computed on the locked parent (a parent edit after the review read still needs a decision); approve without a decision throws; `keep_current` keeps the parent value and B's override; parent deleted → requires `restore_parent` | stale semantics |
| T15 | promote a brand-local `interface_fields` row whose page is brand-local → `UnresolvedLinkError`; after promoting the page, approval inserts a parent row, sets B's `template_row_id`, computes B's overrides positively, propagates an insert to A only; a subset approval (`visible` approved, `position` not) leaves B's `position` intact after the insert propagation | new-row promotion, I9, §4.5 |
| T16 | reject and withdraw change only the request row; transition table is exhaustive (every legal transition passes, every illegal one throws, including withdraw-by-reset and narrow-supersede); a `client` role cannot approve (domain guard) | Non-negotiable 2 |
| T17 | `withBrand(A).select(interfacePages)` never returns B or T rows; the scope cannot be constructed without the factory; every mutating scope creation inserts one audit row closed `succeeded`, or `failed` when `fn` throws; `withTemplateRead` inserts none; `writeChild` ignores `brand_id` in the payload and refuses `overriddenFields` in `values`; `addOverrides` / `removeOverrides` leave unrelated entries in place | I8, §6 |
| T18 | `themes` insert with a `brand_id` fails the CHECK; `createTemplateRegistry` rejects a spec for `themes`; fixture `themeRef` survives seed and propagation verbatim | I10 |
| T19 | archived child skipped, paused child updated, unseeded child receives inserts | A7 |
| T19b | archive B, change `P.label` and soft-delete Q, reactivate, `resyncBrand(B)` → B's `label` updated, B's overridden field untouched, B's copy of Q deleted, outcomes written under the resync run | A7, §4.1 |
| T20 | insert propagation with an unresolvable NOT NULL link → `skipped_unresolved_link`; a nullable link to a missing target is inserted NULL and listed in `unresolved_fields`; an update to an unresolved link leaves the child's value (never NULL); after the target is seeded, `resyncBrand` inserts / repairs it | §4.8, §4.1 |
| T21 | brand created with an empty template (`seeded_at` set, zero rows), then three template inserts → the child has three rows; `brandReadiness` for missing run, queued, failed, succeeded | §4.1, I13 |
| T22 | registry self-test: every key exists, link targets precede referrers, a self-link is accepted only when nullable, `naturalKey ⊆ propagatedFields`, propagated ∩ local = ∅; `registryCompleteness` fails when a fixture column is unclassified | A2, G4, §3.3 |
| T23 | `renameFieldKey` with the registered targets rewrites `overridden_fields`, `changed_fields`, `brand_field_overrides.field_name`; T23b (TICKET-030) adds `promotion_requests.fields/base/proposed` | §4.6 |
| T24 | outbox and sweeper: a committed template write leaves a `queued` run; writes before a claim share one queued run; after a claim the next write opens a new run; `findRunsToResend` lists stale queued, stuck running and `failed` runs under `attempt 3` and skips `attempt 3`; a queued re-send bumps `resend_count` and leaves `attempt`; claim on a `succeeded` run returns null; claim with a live `running` run by another instance returns null; the same `inngestRunId` re-claims its own `running` row; a re-claim bumps `claim_generation` and the old instance's `assertClaim` throws `lost claim` and `finish` under the old generation updates zero rows | I6, I7, I14, A12 |
| T25 | smoke load (default suite): 5 children × 20 rows × 3 fixture tables; one template update and a 20-row import propagate; statement count per child transaction ≤ 3 per table + 1 | §4.4 batching |
| T25L | load (`test:load`, nightly): 50 children × 100 rows × 8 fixture tables seeded; one template update propagates to 50 children; 100-row import in one run; 800-row import chunked into 20 apply steps with the statement count asserted; wall time reported | Phase 7 baseline, §5.2 |
| T26 | `brands` constraints: template with a `template_brand_id` fails; second template in an agency fails; `client` assignment on the template refused | A1, A9 |
| T27 | `reconcileFieldCatalog` creates missing template `brand_field_overrides` rows and propagates them; a child `hidden` override survives a template `label` change; `fieldVisibility` omits hidden; `resyncTemplateField` delivers a backfilled value to children without an override | §4.6 |
| T28 | `linkToTemplate`: refuses a linked row, a missing parent and a parent that already has a copy; links a brand-local row, sets positive overrides; the next propagation updates non-overridden fields only | §4.10, I12 |
| T29 | B has a brand-local `interface_pages` row `page_key 'ugc'`; T inserts a `'ugc'` page → B outcome `skipped_key_conflict` with `conflict_fields ['pageKey']`, A gets the copy, the run is `succeeded`; the same for a restore whose key B reused; after B deletes its local row a resync inserts the copy | §3.9, §4.4 |
| T30 | `retentionSweep`: outcomes older than 90 days with acknowledged or empty conflicts are gone, an unacknowledged conflict stays, runs and requests stay | §3.6 |
| Domain | `diffPropagated`, `applyChildEdit`, `coalesceChanges` (every pair: update+soft_delete, restore+update, update+restore, insert+soft_delete, soft_delete+restore, insert+update), `planChildChange` (every row of the §4.4 table, including the ordered insert → fields → lifecycle plans for each pair and the natural-key rows), `resetFields`, `overridesForLinkedRow`, `buildPromotionRequest`, `reviewPromotion`, `decidePromotion`, `settleOverrides` (returns only removals), `brandReadiness`, chunking by `stepBudget`, promotion and run transition tables | pure functions, fixtures only |

---

## 9. Ticket breakdown

All under 300 LOC excluding tests; owners per `CLAUDE.md` roles; every ticket cites PRD §5 and §14.1 plus the section
named. Order is the dependency order. A two-stage ticket lists its stages in order and the exact directories each
stage may touch; a stage never writes outside them. Every ticket file carries a "Gated criteria (D-008)" block, empty
when nothing is gated. The two prerequisites at the top are Phase 1 remainder items that the engine tickets depend on;
the planner adds them to `docs/tickets/backlog.md` before TICKET-020 with their final numbers (`01x` below is a
placeholder).

| ID | Title | Stages: owner (directories) | LOC | Depends on | Gated criteria (D-008) |
| --- | --- | --- | --- | --- | --- |
| TICKET-01x-R | Role model readers and route helpers `requireAdmin()`, `requireBrandRole(brandId, roles)`, `currentActor()` (Clerk user → `users.id`) | integrator (`apps/web/lib/auth/**`, `packages/db/src/auth/**` reads only) | ~150 | 004, 005 | real Clerk sign-in: Clerk keys; helpers unit-tested with a stubbed actor |
| TICKET-01x-B | `createBrand` Server Action behind `requireAdmin()` (name, slug, team assignment); the PRD §3 onboarding wizard builds on it later | backend (`apps/web/app/(admin)/brands/**`, `packages/domain/src/brand/**`) | ~120 | 01x-R | none |
| TICKET-022 | Domain: `template/spec.ts` (field spec, `Row`, `ChangeGroup`, `ChildPlan`, status / role / reason arrays), `diffPropagated`, `applyChildEdit`, `resetFields`, `settleOverrides`, `overridesForLinkedRow`, `assertTemplateWriter`, brand rules, `brandReadiness`, run state machine | 1 backend (`packages/domain/src/template/**`, `packages/domain/src/state/**`) → 2 schema (`packages/db/src/schema/enums.ts` re-pointed at the domain arrays; TICKET-005's note flipped) | ~200 | 005 | none |
| TICKET-020 | db registry: `brands` additions (`seeded_at`, template CHECK, one-template index), `templatedColumns` + `templatedConstraints`, `TemplatedTableSpec` = domain spec + `table`, `createTemplateRegistry` (self-link and `naturalKey` rules), `registryCompleteness`, engine `pgEnum`s from the domain arrays, migration; CI cycle check `pnpm turbo run build --dry` | 1 schema (`packages/db/**`) → 2 integrator (`.github/workflows/**`, `turbo.json`) | ~190 | 022 | none |
| TICKET-021 | Tables `template_changes`, `propagation_runs` (`attempt`, `resend_count`, `last_enqueued_at`, `claimed_by`, `claim_generation`), `propagation_child_runs`, `propagation_outcomes`, `engine_audit_log` + migration; `renameFieldKey` + `fieldKeyTargets` (`overridden_fields`, `changed_fields`) | schema (`packages/db/**`) | ~220 | 020 | none |
| TICKET-023 | Domain: `coalesceChanges` (lifecycle + fields), `planChildChange` (full §4.4 table, ordered steps, natural key), `resolveLinkValue`, chunking by `stepBudget` | backend (`packages/domain/src/template/**`) | ~200 | 022 | none |
| TICKET-024 | `withTemplateScope` / `withTemplateRead` with audit open/close and the scope methods (`writeChild` override arithmetic, `applyChildPlans` batched SQL, `naturalKeyOwners`, `upsertChildRun`, `upsertOutcomes`), `sql.ts` generator; no `ops/` skeleton (each ops ticket creates its own file) | 1 schema (`packages/db/src/template/scope.ts`, `sql.ts`) → 2 integrator (ESLint fence in the root `eslint.config.*`) | ~240 | 021, 023 | none |
| TICKET-025 | `withBrand` templated methods, `is_template` read in-transaction, queued-run upsert + journal on the template brand, run row returned for the backstop | integrator (`packages/db/src/tenancy.ts`, `packages/db/src/template/journal.ts`) | ~200 | 022, 024 | none |
| TICKET-026 | `brand_field_overrides`, `interface_pages`, `interface_fields` tables + registry entries with `naturalKey` + migration; `fieldVisibility`; `fieldKeyTargets` += `brand_field_overrides.field_name` | schema (`packages/db/**`) | ~170 | 020 | none |
| TICKET-027 | `seedBrand` / `resyncBrand` (seed statements, self-link post-pass, re-apply through `planChildChange`, `seeded_at`) | schema (`packages/db/src/template/seed.ts`, `resync.ts`) | ~220 | 024, 026 | none |
| TICKET-028a | Run lifecycle: `claim` (self re-claim, `claim_generation`), `assertClaim`, `finish` (missing child-run rows → `partial`), stats, `findRunsToResend`, `resendRun`, `retryRun` | schema (`packages/db/src/template/run.ts`) | ~200 | 027 | none |
| TICKET-028b | `applyChildChunk`: parent re-read per step, per-table link map, plan execution through `applyChildPlans`, failed child-run side transaction, chunking | schema (`packages/db/src/template/apply.ts`) | ~220 | 028a | none |
| TICKET-029 | Inngest: `createInngest` factory, events, `propagate-run` (sleep, claim, apply, finish), `seed-brand`, `sweep-runs` (agency-hours cron), `enqueue.ts`, serve route with `maxDuration = 300`; `createBrand` wires the seed run + event; readiness gate | 1 backend (`packages/integrations/src/inngest/**`, `apps/web/app/api/inngest/**`, the `createBrand` action) → 2 integrator (`packages/env/**`, `.env.example`, `AGENCY_TIMEZONE`) | ~220 | 028b, 01x-B | live send and seed-on-create: `npx inngest-cli dev` + `DATABASE_URL` (Neon preview or `pglite://`); command in the runbook |
| TICKET-029b | `createDb` accepts `DATABASE_URL=pglite://<dir>` for `pnpm dev` and Playwright; `E2E_AUTH_BYPASS` test-only sign-in (refused when `VERCEL_ENV` is set); Playwright `webServer` uses both | integrator (`packages/db/src/create-db.ts`, `packages/env/**`, `apps/web/lib/auth/**`, `playwright.config.ts`) | ~120 | 003, 004, 01x-R | none (this is what un-gates the E2E tickets) |
| TICKET-030 | `promotion_requests` table + migration; `fieldKeyTargets` += `promotion_requests.fields/base/proposed` (T23b); `state/promotion.ts` (withdraw-by-reset, narrow-supersede); domain `buildPromotionRequest`, `reviewPromotion`, `decidePromotion` | 1 schema (`packages/db/**`) → 2 backend (`packages/domain/**`) | ~240 | 025 | none |
| TICKET-031a | Ops `requestPromotion` (row lock), `withdrawPromotion`, `rejectPromotion`, `listPromotionRequests` (read scope) with T12, T16; Server Actions + `requireTemplateEditor` | 1 schema (`packages/db/src/template/ops/**`) → 2 backend (`apps/web/app/(workspace)/**/actions.ts`, `apps/web/lib/auth/require-template-editor.ts`) | ~200 | 029, 030, 01x-R | none |
| TICKET-031b | Op `approvePromotion` (lock order, positive overrides, settle) with T13–T15; approve Server Action | 1 schema (ops dir) → 2 backend (`apps/web/app/(admin)/**/actions.ts`) | ~180 | 031a | none |
| TICKET-032a | Ops `resetToTemplate` (field-level acknowledgement, `settlePendingPromotion` scope method), `acknowledgeConflicts`, conflicts query, `resyncBrand` action, `resyncTemplateField`, `reconcileFieldCatalog` + `db:migrate` hook with T11, T27; Server Actions | 1 schema (ops dir, `packages/db/src/template/scope.ts` for the one method, `packages/db/src/template/migrate-helpers.ts`) → 2 backend (Server Actions in `apps/web`) | ~250 | 028b, 030, 01x-R | `db:migrate` deploy hook on a Neon preview branch |
| TICKET-032b | Ops `linkToTemplate` (T28) and `retentionSweep` (T30) + Inngest `retention` cron | 1 schema (ops dir, `packages/db/src/template/retention.ts`) → 2 backend (`packages/integrations/src/inngest/functions/retention.ts`) | ~130 | 032a | none |
| TICKET-033 | UI: child edit returns `overriddenAdded`; Promote popup + promotion modal (field picker, two-column diff, note, unresolved-link message); overridden pills | frontend (`apps/web/app/(workspace)/**`, `packages/ui/**`) | ~240 | 031a, 029b | E2E on `pglite://` + `E2E_AUTH_BYPASS` runs locally; the real Clerk sign-in variant: Clerk keys |
| TICKET-034 | UI: Admin promotion dashboard (pending/decided, three-way diff, per-field approve, decisions for conflicts, reject with note). E2E: strategist edits → promotes → admin approves → second brand shows the value (engine driven through a test-only route) | frontend (`apps/web/app/(admin)/**`, `apps/web/e2e/**`) | ~260 | 031b, 029b | same as 033; `pnpm test:e2e` command in the runbook |
| TICKET-035 | UI: brand "Template updates" page (grouped conflicts incl. `skipped_key_conflict`, Keep mine per field / Take template, row-level delete), nav badge, "Reset to template" field and row menu items | frontend | ~240 | 032a, 029b, 01x-R | same |
| TICKET-036 | UI: Admin propagation page (queued/running/partial/failed runs, per-child rows and outcomes, Retry, stale re-send on load), "Setting up from template" gate, brand switcher "Template" badge | frontend | ~220 | 029, 032a, 029b, 01x-R | same |
| TICKET-037 | Runbook ("Rolling a schema change out to every brand", the two-connection concurrency script, the "Pending human verification" list), Phase 3 ticket checklist, `packages/db/vitest.load.config.ts` + `test:load` nightly CI, `docs/decisions.md` entries of §12 confirmed | 1 planner → 2 qa → 3 integrator (`vitest*.config.ts`, `.github/workflows/**`) | ~80 | 029, 032b | nightly load run: CI account |

Phase 3 tickets each add one registry spec (`propagatedFields`, `localFields`, `links`, `naturalKey`, `recompute`),
`templatedConstraints`, one `fieldKeyTargets` entry and one propagation test (≈20 LOC). Phase 4 builds screens on
`interface_*` with no engine change. Phase 6 (migration): the migrator matches imported rows to template rows by natural
key or label and adopts them with `linkToTemplate` (§4.10); unmatched rows stay brand-local and appear in the dry-run
report next to the template copies the seed inserts.

---

## 10. Open questions for the human

1. **Inngest quota (A5).** Confirm the free tier's monthly step budget once the account exists. The design uses ≈2.3k;
   if the quota is far lower, raise `stepBudget` to 5,000 and the sweeper to every two hours.
2. **Who edits the template brand (A10).** Default here: agency admins only; strategists work in children and promote.
   Alternative: allow `strategist`/`csm` assigned to the template brand. Widening this widens who can trigger a 50-brand
   fan-out; it is a one-line change in `requireTemplateEditor` and `assertTemplateWriter`.
3. **Paused brands (A7).** Confirm that paused brands keep receiving propagation and only archived ones stop.
4. **Field classes per table (A3).** When Phase 3 tickets are written, decide per column: e.g. do Angle `Internal Notes`
   and `Client Notes` propagate? Default: propagate `Description`, `Pain Points`, `USP`, `Type`, `Formats`; keep notes
   local.
5. **Neon compute allowance and Vercel Pro (§5.5, A14).** Confirm the free plan's monthly CU-hour allowance covers
   ≈60 CU-hours, and that the Vercel plan allows `maxDuration = 300` on the Inngest route. Both are D-006 amendments (§12).
6. **Conflict notifications.** Should a conflict or a promotion decision trigger a Slack DM (Phase 5)? The
   `template/run.finished` event exists for it.
7. **Coalescing window (A13).** 20 seconds between a template save and the start of propagation. Acceptable, or should
   it be shorter (more runs) or longer (fewer)?
8. **Agency timezone for the sweeper cron (§5.4).** `AGENCY_TIMEZONE` env var; default `Asia/Karachi` until confirmed.

---

## 11. Rejected alternatives and why

- **One Inngest job per child brand (fan-out events).** Best failure isolation on paper, but 50 events per parent edit
  plus open/apply/close steps means ~150 executions per edit; at a busy template that brushes the free quota. Per-child
  transactions inside one run give the same isolation at a handful of executions.
- **Per-child cursors over a global sequence with an advisory lock on parent writes.** Correct only if every write path
  takes the lock; a missed lock skips a change forever and the lag check cannot see it, and the property is unprovable
  on single-connection PGlite. Reading live parent values makes strict ordering unnecessary, so the machinery buys
  nothing. Outcomes are the ledger instead.
- **Storing `from`/`to` values in the journal, in events or in Inngest step output.** Values are read live at apply
  time; storing them bloats the journal (14 long persona fields × 100 rows per import), makes out-of-order runs
  diverge, and in step output it puts template content into a third-party service's state and hits its per-step size
  cap on a large import. The claim step returns ids and field names; each apply step re-reads its parent rows (A6).
  The promotion request is the one place values are snapshotted, because a reviewer needs the three-way diff.
- **Inngest debounce or `idempotency` as the correctness mechanism.** A debounced event can be the only event for a
  run that then never triggers; function-level idempotency keys collide with legitimate retries. Both are replaced by
  the queued-run partial unique index (coalescing) and the database claim with attempt-suffixed event ids. The 20 s
  `step.sleep` in §5.2 is an optimisation that reduces run count; nothing is correct because of it.
- **Collapsing a coalesced group to one kind (the last in sequence).** Dropped writes in ordinary sessions: an edit
  followed by a delete lost the edit, a restore followed by an edit lost the restore. A group now keeps lifecycle and
  fields apart and the plan applies insert → fields → lifecycle in order (§4.4).
- **A fixed chunk of ten children per apply step.** Fine for one edit, 16,000 sequential round trips per step for the
  800-row import and a guaranteed Vercel timeout. The step unit is a row-operation budget and each child transaction
  is batched into a few statements per table.
- **A 24/7 `*/15` sweeper.** Alone it keeps Neon compute awake about eight hours a day and is more than half of all
  Inngest executions. Hourly during agency hours plus the request-path backstop repairs a lost send faster on the path
  that matters and costs almost nothing.
- **Skipping children that already have an outcome on retry.** Contradicts recording `failed` outcomes. Replaced by
  idempotent re-application and outcome upsert; on later attempts the child list is narrowed to failed or missing
  child-run rows.
- **One outcome row per (run, child, parent row), always.** ~1,000 rows a day at the load target and 40,000 per
  template import, consuming the free storage within two years, for rows that say "applied". Informative outcomes only;
  the rest are counts on a per-child row.
- **Soft-deleting engine ledgers as retention.** Reclaims nothing on Neon. The "soft delete only" rule protects business
  data; `propagation_outcomes`, `propagation_child_runs`, `template_changes` and `engine_audit_log` are operational
  logs and are hard-deleted after 90 days (§3.6, §12).
- **A separate `template_conflicts` table with six statuses.** Duplicates information already in outcomes and needs
  its own reconciliation on every propagation. An outcome with `conflict_fields`, `parent_values` and an
  acknowledgement column is one table fewer and stays honest through the `skipped_equal` distinction.
- **Read-time conflict computation by joining the child row to its parent.** Requires a cross-brand read on every row
  page load. Snapshotting `parent_values` on the outcome avoids it.
- **Auditing cross-brand reads.** One insert plus one update per dashboard view, `rows_written = 0`, no forensic value,
  and it padded the ledger. Mutating scopes are audited; reads sit behind `requireAdmin()` (I8).
- **"Detach" (set `template_row_id` to NULL) when the parent deletes a row the child owns.** One-way, creates duplicate
  parent rows on re-promotion, and breaks I1's "never repointed". Keep mine leaves the copy attached; a parent restore
  is then a no-op for it.
- **Deriving "was this copy deleted by the engine?" from outcome history on restore.** A history query where a
  row-local flag suffices. `'deletedAt'` in `overridden_fields` gives delete, restore and reset one rule.
- **Approving a stale promotion by writing `proposed` over a newer parent value with only a badge.** Weaker than
  Non-negotiable 2 deserves. Conflicting fields need an explicit per-field decision; a deleted parent needs
  `restore_parent`, and the decision is taken on the locked parent row, not on the page-load read.
- **Clearing the origin child's overrides unconditionally on approval, or assigning `overridden_fields` wholesale.**
  Overwrites an edit made between request and approval at the next propagation. `settleOverrides` returns only the
  entries to remove, a newly linked row gets a positively computed set, and `writeChild` applies set arithmetic on the
  locked row.
- **Catching the unique violation in `requestPromotion` and returning the winner.** Works, but leaves the supersede
  step racy and the error path as the normal path. Locking the child row first serialises requests per row and keeps
  the partial unique index as a safety net.
- **Forbidding brand-local rows in tables with a natural key.** Simple, but PRD §10 wants per-brand interface pages
  and Phase 3 tables will have natural keys too (persona name). The engine skips a colliding insert or restore as
  `skipped_key_conflict` and the brand decides.
- **Reading `is_template` at `withBrand` construction.** Needs a query, so `withBrand` would become async and every
  TICKET-005 caller would change. The read is one indexed `FOR SHARE` inside each templated method's transaction.
- **One `brand_field_overrides` table with a `surface` column for both workspace and client fields.** Client field
  visibility is per interface page and needs `client_editable`; folding it in would give the catalog reconcile job
  responsibility for client pages. `interface_fields` keeps PRD §10 in its own pair of tables.
- **Seed step per table (eight transactions).** Idempotent by I2, but a readiness flag on a half-seeded brand is
  ambiguous. One transaction for 800 rows costs nothing and makes `seeded_at` trustworthy.
- **Resync as "insert missing copies only".** Never updated an existing copy, so a reactivated brand stayed stale until
  each parent field was edited again. Resync is seed plus a full re-apply under the normal override rules (§4.1).
- **A mutable module-level registry array that Phase 3 pushes into.** Shared mutable module state. The registry is a
  validated frozen value passed to every engine function; Phase 3 edits the array literal.
- **`template_row_id` as a partial unique index (`WHERE template_row_id IS NOT NULL`).** Equivalent for uniqueness but
  a full index also serves as the `ON CONFLICT` target for soft-deleted copies, which is what makes tombstones block
  re-insertion.
- **Registry types in `packages/db` imported by `packages/domain`.** A workspace cycle (`@tas/db` calls domain plan
  functions that take db types); Turborepo refuses it and project references cannot be ordered. The field-level spec
  and every string union live in domain; db extends them (§3.3).

---

## 12. Decisions to record in `docs/decisions.md` (planner appends before TICKET-020 is picked)

- **D-010 Engine ledgers are operational logs.** `propagation_outcomes`, `propagation_child_runs`, `template_changes`
  and `engine_audit_log` may be hard-deleted by the retention job after 90 days (acknowledged or empty conflicts
  only); the "soft delete only" rule applies to business data tables. `propagation_runs` and `promotion_requests` are
  kept. Why: soft deletes reclaim nothing and the ledger would consume the free Neon storage within two years.
- **D-011 Package direction `@tas/db` → `@tas/domain`.** Domain defines the template field spec, row and plan types
  and every status / role string array; db builds Drizzle tables and `pgEnum`s from them and re-exports the unions.
  TICKET-005's note 2 is flipped accordingly. `pnpm turbo run build --dry` in CI fails on a cycle.
- **D-006 amendment: Vercel Pro `maxDuration = 300`** on `apps/web/app/api/inngest/route.ts`, and **Neon compute** is
  estimated at ≈60 CU-hours per month (§5.5); the free plan's CU-hour allowance must be confirmed by the human, with
  the sweeper cadence as the first lever.
- **D-012 Local full-stack runs on PGlite.** `createDb` accepts `DATABASE_URL=pglite://<dir>` (or
  `DATABASE_DRIVER=pglite`) so `pnpm dev` and Playwright run against in-process PGlite; `E2E_AUTH_BYPASS` enables a
  test-only sign-in that is refused whenever `VERCEL_ENV` is set. The engine E2E (TICKET-034) runs on this machine;
  only the real Clerk sign-in stays gated.
- **D-013 Inngest usage.** One run per change set with a 20 s coalescing sleep, a row-operation budget per apply step,
  an agency-hours hourly sweeper (`AGENCY_TIMEZONE`), a weekly retention cron. Roughly 2.3k step executions a month at
  the load target.
- **D-014 Concurrency properties are verified outside PGlite.** The queued-run row lock, the `FOR UPDATE`
  serialisation of child edits against propagation and of promotion approval against edits, and the claim takeover are
  checked by a two-connection script against a Neon preview branch and listed under "Pending human verification" in
  the runbook (D-008).
