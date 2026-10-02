# Audit: the inheritance machinery that already exists

**Scope** — what is in `/Users/macbook/tallas-tas` at `main @ d7842e7`, and what is in the production
database reachable through `DATABASE_URL`. Read-only: no source file, migration or row was changed.
**Goal this serves** — Airtable-style per-COLUMN inheritance: one parent base (`Creative Hub Template`)
defines the master column set per table, children inherit, a child may DETACH a column to relabel,
hide or reorder it, an attached column keeps following the parent, only admins change column structure.

Every claim below is a file:line or a query result. Where I could not establish something I say
**"I could not establish this."** Nothing is inferred from a name.

---

## Summary verdict

**There is no per-column inheritance in this repo today, and `brand_field_overrides` does not exist.**

1. `brand_field_overrides` is **aspirational only**. It appears in `CLAUDE.md:66`, in a 1400-line
   design document (`docs/design/template-engine.md`), in two backlog tickets, and in two source
   *comments* that point at it as the right future home. There is **no Drizzle table**, **no
   migration** (`grep brand_field_overrides packages/db/drizzle/` returns nothing), and the table
   **does not exist in production** (`information_schema.tables` → 0). CLAUDE.md's assertion that
   "per-brand visibility lives in a `brand_field_overrides` table" describes an intention, not the
   schema.

2. The propagation engine that *does* exist (`packages/db/src/propagation.ts`, 547 lines) is
   **per-ROW value propagation**, not per-column structure. It copies row *values* from the parent
   brand's rows to child rows linked by `template_row_id`, skipping column names listed in that
   child row's `overridden_fields`. It is a different mechanism from column detachment.

3. **`overridden_fields` is NOT the same idea as column detachment.** It is per (row × column) and
   protects one row's *value*. Detachment is per (brand × table × column) and governs a column's
   *existence, label, visibility and order*. Detaching `Spelling Feedback` on Gratsi cannot be
   expressed in `overridden_fields` at all, because there is no row to hang it on when the column
   is empty, and because 390 brief rows would each need the same entry. See
   [§ overridden_fields](#overridden_fields) for the full argument. **The owner may be conflating
   them; they must stay separate.**

4. The one mechanism that *is* genuinely per-column, per-brand and already propagating is
   **`interface_pages` + `interface_fields`** — 11 and 51 production rows. It stores exactly the
   fields detachment needs (`field_name`, `label`, `visible`, `position`) keyed by brand. But it is
   **client-facing only** (5 PRD §10 client pages), it has **no concept of attached vs detached**, its
   propagation is a **destructive full replace**, and it covers none of the ~20 internal workspace
   tables. It is the right *shape* and the wrong *surface*.

5. Three of the named mechanisms are **dead**: `propagation_runs` (0 rows, nothing reads it, nothing
   writes it, not even exported), the `custom_fields` jsonb bag (0 non-empty rows, nothing reads or
   writes it), and `custom_field_schemas` (0 rows in production, full CRUD + admin UI exists).
   `overridden_fields` and `template_row_id` are **structurally present but 0% populated in
   production** — 0 of 675 rows carry an override, 0 of 591 rows carry a `template_row_id`.

6. **Recommendation: build a new `column_definitions` table, and do not try to extend
   `overridden_fields` or the row engine.** Reuse `interface_fields` as the *proven design pattern*
   (and probably fold it in later), reuse `withBrand`, `brands.is_template` / `template_brand_id`,
   `promotion_requests` and the `/app/propagation` admin shell. Details in
   [§ Recommendation](#recommendation).

---

## Production measurement

Read-only, via `DATABASE_URL` from `/Users/macbook/Tallas Tas/.env.local` (no credential is
reproduced here). Measured 2026-10-03.

### Does the table exist?

| table | exists in production |
|---|---|
| `interface_fields` | yes |
| `interface_pages` | yes |
| `custom_field_schemas` | yes |
| `propagation_runs` | yes |
| `promotion_requests` | yes |
| **`brand_field_overrides`** | **no** |
| **`column_definitions`** | **no** |

### Row counts

| table | total | alive (`deleted_at is null`) |
|---|---|---|
| `interface_fields` | 51 | 51 |
| `interface_pages` | 11 | 11 |
| `promotion_requests` | 5 | 5 |
| `custom_field_schemas` | **0** | 0 |
| `propagation_runs` | **0** | 0 |
| `user_table_views` | 1 | 1 |
| `user_view_preferences` | 11 | 11 |

### Propagation columns, as actually populated

| table | rows with non-empty `overridden_fields` | rows with `template_row_id` set | total rows |
|---|---|---|---|
| `creative_briefs` | 0 | 0 | 397 |
| `concepts` | 0 | 0 | 106 |
| `creators` | 0 | — | 75 |
| `angles` | 0 | 0 | 48 |
| `personas` | 0 | 0 | 31 |
| `products` | 0 | 0 | 9 |
| `collections` | 0 | — | 5 |
| `copywriting` | 0 | — | 4 |

`custom_fields` jsonb: 0 non-empty rows in `personas` (31), `products` (9), `angles` (48).

**This is the single most consequential number in the audit: the parent-child row linkage is 0%
populated.** Not one production row points at a template row, and not one carries an override.

### Brands

| name | slug | `is_template` | `template_brand_id` |
|---|---|---|---|
| `Creative Hub Template` | `creative-hub-template` | **true** | null |
| `Gratsi` | `gratsi` | false | → Creative Hub Template |
| `Niagara Sleep Solutions` | `niagara-sleep-solutions` | false | → Creative Hub Template |
| `Mattress Central` | `mattress-central` | false | → Creative Hub Template |
| `Funky Painting` | `funky-painting` | false | → Creative Hub Template |
| `test` | `test` | false | → Creative Hub Template |

The parent/child graph the goal assumes **already exists and is correct**. All four named brands plus
a `test` brand point at `Creative Hub Template`.

### Content rows by brand (alive)

| brand | personas | products | angles | concepts | briefs |
|---|---|---|---|---|---|
| **Creative Hub Template** | **0** | **0** | **0** | **0** | **0** |
| Gratsi | 28 | 6 | 43 | 102 | 390 |
| Niagara Sleep Solutions | 3 | 3 | 5 | 4 | 7 |
| Mattress Central | 0 | 0 | 0 | 0 | 0 |
| Funky Painting | 0 | 0 | 0 | 0 | 0 |
| test | 0 | 0 | 0 | 0 | 0 |

**The parent template brand holds no data at all.** The row-level propagation engine therefore has
nothing to propagate: `propagateAllContent` iterates the template's rows (`propagation.ts:448`) and
finds zero in every table. This is consistent with the 0% `template_row_id` figure — the real data
arrived from the Airtable importer into Gratsi and Niagara directly, not by seeding from a template.

---

## Mechanism by mechanism

### `brand_field_overrides` — DOES NOT EXIST {#brand_field_overrides}

| | |
|---|---|
| **Tables carrying it** | none |
| **What reads it** | **nothing reads it** |
| **What writes it** | **nothing writes it** |
| **Per-row or per-column** | n/a — specified as per-column, never built |
| **Admin UI** | none |
| **Wired into a page** | no |
| **Production rows** | **table absent from `information_schema.tables`** |
| **Verdict** | **aspirational. Cite it as a design intention, never as existing schema.** |

Where it appears, exhaustively (34 hits, all prose):

- `CLAUDE.md:66` — "per-brand visibility lives in a `brand_field_overrides` table". This sentence
  describes a rule the schema does not yet implement.
- `docs/design/template-engine.md:500` — a full `pgTable('brand_field_overrides', …)` definition
  **inside a markdown document**. Nothing in `packages/db` imports or mirrors it. The same document's
  `createTemplateRegistry`, `insertTemplated`, `renameFieldKey`, `fieldVisibility` and
  `reconcileFieldCatalog` likewise exist **only as doc text** — `grep` across `packages` and `apps`
  for all five returns zero code hits.
- `docs/tickets/backlog/TICKET-026.md:1` — the ticket that would create it. Status in
  `docs/tickets/backlog.md:50`: `backlog`.
- `docs/tickets/backlog/TICKET-032c.md:42` and `:98` — depends on it.
- `packages/db/src/schema/personas.ts:29` — "Per-brand visibility belongs in
  `brand_field_overrides`, not in a drop."
- `apps/web/src/app/app/personas/fields.ts:51` — same sentence, same forward reference.
- `docs/decisions/no-drop-2026-10-02.md:8`, `docs/decisions/gratsi-unmapped-fields-2026-10-02.md:33`
  and `:56`, `docs/audits/qa-action-items-2026-10-02.md:254` — decisions already *resting on* a table
  that does not exist.

The last group matters for the build: two shipped decisions ("we do not drop a column, per-brand
visibility handles it") have been justified by a table nobody has created. Whatever we build must
discharge that promise.

---

### `interface_pages` and `interface_fields` — per-COLUMN, per-BRAND, already propagating {#interface}

| | |
|---|---|
| **Tables** | `interface_pages`, `interface_fields` — `packages/db/src/schema/interface-config.ts:38` and `:65` |
| **What reads it** | `listInterfaceConfig` `packages/db/src/interface-config.ts:48`; `getInterfacePageById` `:62`; the client-facing read `clientVisibleFields` `packages/db/src/client-queries.ts:470` (its filter at `:485-490`); `apps/web/src/lib/interface-config-source.ts:112`; the page `apps/web/src/app/app/interface-config/page.tsx:2` |
| **What writes it** | `setFieldVisibility` `packages/db/src/interface-config.ts:82`; `setPageEnabled` `:108`; the Server Action `apps/web/src/app/app/interface-config/actions.ts:143` (page) and `:148` (field); onboarding seed `packages/db/src/onboard.ts:139`/`:223`; the propagation push `packages/db/src/propagation.ts:148`/`:184`; `packages/db/src/seed.ts:480`/`:484` |
| **Per-row or per-COLUMN** | **per-COLUMN.** One row is one field of one page of one brand: `field_name` (stable key), `label` (what the client reads), `visible`, `client_editable`, `position`. This is precisely the relabel / hide / reorder triple the goal asks for. |
| **Admin UI** | **yes** — `/app/interface-config`, in the sidebar at `apps/web/src/components/shell/nav.ts:271`, with a config tree and a live preview. It can toggle `visible` and `enabled` **only**; it cannot relabel, cannot reorder, cannot add a field. |
| **Admin-gated?** | **no.** `grep` for `canSee|requireAdmin|role|Admin` in `apps/web/src/app/app/interface-config/page.tsx` and `actions.ts` returns nothing — unlike `/app/propagation`, which gates on `canSeePropagationPage` (`propagation/page.tsx:100`) and re-checks in each action. If column structure must be admin-only, this route is a hole today. |
| **Production rows** | 11 pages, 51 fields — **but only for two brands** (see below) |
| **Verdict** | **reusable as the pattern; wrong surface as-is.** |

**Production shape (this is what the 51 and the 11 actually DO).** They configure the **client**
interface of PRD §10 — which of five client-facing pages a brand's client sees, and which fields
those pages show. They do **not** touch the internal workspace grids.

| brand | page_key | fields | visible | client_editable |
|---|---|---|---|---|
| Niagara Sleep Solutions | `concepts` | 12 | 12 | 0 |
| Niagara Sleep Solutions | `creatives` | 2 | 2 | 2 |
| Niagara Sleep Solutions | `copywriting` | 2 | 2 | 2 |
| Niagara Sleep Solutions | `ugc` | 3 | 3 | 3 |
| Niagara Sleep Solutions | `partnership` | 4 | 4 | 0 |
| test | `concepts` | 12 | 12 | 0 |
| test | `creatives` | 2 | 2 | 2 |
| test | `copywriting` | 2 | 2 | 2 |
| test | `ugc` | 3 | 3 | 3 |
| test | `partnership` | 4 | 4 | 0 |
| test | `calendar` | 5 | 5 | 0 |

23 + 28 = 51. 5 + 6 = 11.

Sample rows (Niagara, `concepts` page, in `position` order):

```
field_name      label           visible  client_editable  position
batch           Batch           t        f                0
category        Category        t        f                1
concept_name    Concept name    t        f                2
concept_style   Concept Style   t        f                3
angle           Angle           t        f                4
theme           Theme           t        f                5
product         Product         t        f                6
```

So each row is: *this brand, on this client page, shows the column `concept_name` under the label
"Concept name", visible, read-only, seventh*. That is per-column brand configuration, stored in the
database, with an admin screen on top. **It is the closest thing in the repo to what we need.**

**Three facts that stop it being the answer by itself:**

1. **`Creative Hub Template` has ZERO interface config rows.** Gratsi, Mattress Central and
   Funky Painting have zero too. Only Niagara and `test` are configured. So there is no parent
   column set to inherit *from*, even on the one surface that could express one.
2. **Its propagation is a destructive full replace, and it is live.**
   `propagateInterfaceConfig` (`propagation.ts:119`) soft-deletes every child field and page
   (`:141`, `:143`) and *then* reinserts only `if (templatePages.length > 0)` (`:145`). The code says
   so itself at `:113-117`: "Current implementation: full replace (delete + reseed). The full engine
   will diff and skip overridden fields". **Consequence, today:** the template has 0 pages, so an
   admin pressing Propagate on `/app/propagation` (`propagate-actions.ts:58`) would soft-delete
   Niagara's 23 field rows and 5 page rows and the `test` brand's 28 and 6, and insert nothing.
   I verified the code path and the row counts; I did **not** run it.
3. **No attached/detached bit.** There is no column recording whether a child's `label`, `visible` or
   `position` was locally changed, so a diffing propagation cannot tell a deliberate child override
   from a stale copy. This is the exact gap detachment fills.

---

### `PROPAGATION_TABLES` — a registry of 20 content tables {#propagation_tables}

| | |
|---|---|
| **Where** | `packages/db/src/propagation.ts:203` |
| **What it is** | `Record<string, BrandedTable>` mapping a SQL table name to its Drizzle table object. 20 entries, asserted by name in `packages/db/src/propagation.test.ts:220` ("registers exactly the 20 content tables"). |
| **What reads it** | `seedContentFromTemplate` `propagation.ts:284`; `propagateTemplateRow` `:332`; `propagateAllContent` `:448`; `applyApprovedPromotion` `promotion-requests.ts:233`; the Server Action's table allow-list `apps/web/src/app/app/propagation/custom-field-actions.ts:36` (`VALID_TABLE_NAMES`) |
| **What writes it** | nothing — it is a source-code literal |
| **Per-row or per-column** | **per-TABLE.** It says *which tables participate*; it says nothing about columns. |
| **Admin UI** | no, but `/app/propagation`'s "add a custom field" form uses its keys as the table dropdown's allow-list (`custom-field-actions.ts:36`) |
| **Production rows** | n/a (code) |
| **Verdict** | **reusable, directly.** It is already the canonical "which tables are templated" list. A `column_definitions` table should validate `table_name` against it, exactly as `custom-field-actions.ts:40` already does. |

One precise gap worth recording: **21 schema files spread `propagationColumns()` but only 20 tables
are registered.** `packages/db/src/schema/client-asset-folders.ts` carries `template_row_id`,
`overridden_fields` and `custom_fields` but is absent from `PROPAGATION_TABLES`
(`grep client_asset_folders packages/db/src/propagation.ts` → nothing). So that table's propagation
columns are unreachable by any engine path.

---

### `template_row_id` — per-ROW parent pointer {#template_row_id}

| | |
|---|---|
| **Declared** | `packages/db/src/columns.ts:41`, inside `propagationColumns()` |
| **Tables carrying it** | 21 — `ai_characters`, `angles`, `campaigns_offers`, `client_asset_folders`, `collections`, `competitive_research`, `concepts`, `copy_types`, `copywriting`, `creative_briefs`, `creative_dimensions`, `creative_modules`, `creative_reporting`, `creative_sheet_items`, `creators`, `email_campaigns`, `email_flows`, `personas`, `products`, `sm_campaign_feed_tasks`, `youtube_copy`. Plus an unrelated column of the same name on `propagation_runs` (`schema/propagation-runs.ts:32`), which records *which parent row a run fanned out*. Migrations: `0019_propagation-columns-and-custom-field-schemas.sql` and later. |
| **What reads it** | `propagateTemplateRow` `propagation.ts:387` (and the soft-delete branch `:345`); `propagateAllContent` `:463` |
| **What writes it** | `seedContentFromTemplate` `propagation.ts:296`; `propagateTemplateRow` `:378`; `propagateAllContent` `:476`. Each sets it to the parent row's `id`. |
| **Per-row or per-column** | **per-ROW.** |
| **Admin UI** | none directly; `@tas/ui`'s `PropagationBadge` (`packages/ui/src/propagation/propagation-badge.tsx`) renders "Synced from template" / "N overrides" and is mounted on 11 workspace pages (`products-workspace.tsx:140`, `collections-workspace.tsx:271`, `email-flows-workspace.tsx:150`, …). |
| **Production rows** | **0 of 591 checked rows have it set** (`personas` 0/31, `products` 0/9, `angles` 0/48, `concepts` 0/106, `creative_briefs` 0/397). |
| **Verdict** | **adjacent.** Correct for row inheritance, irrelevant to column inheritance, and inert in production. |

---

### `overridden_fields` — per (ROW × COLUMN) value lock {#overridden_fields}

| | |
|---|---|
| **Declared** | `packages/db/src/columns.ts:42` — `jsonb('overridden_fields').$type<string[]>().notNull().default([])` |
| **Tables carrying it** | the same 21 as `template_row_id` |
| **What reads it** | `propagateTemplateRow` `propagation.ts:395-407`; `propagateAllContent` `:483-490`; the badge `packages/ui/src/propagation/propagation-badge.tsx:18` |
| **What writes it** | **only ever as `[]`.** `propagation.ts:297`, `:379`, `:477` all assign `value.overriddenFields = []`. A `grep` for `overridden` across `packages/domain`, `packages/db/src` and `apps/web/src` finds **no code anywhere that adds a field name to the array.** Demo fixtures also set `[]` (`demo-data.ts:179` and nine sibling files). |
| **Per-row or per-column** | **per (ROW × COLUMN).** The array lives on one row and names columns of that row. |
| **Admin UI** | read-only badge; **no control sets an override** |
| **Production rows** | **0 non-empty out of 675 rows across 8 tables** |
| **Verdict** | **unrelated to column detachment.** See the argument below. |

**Is `overridden_fields` the same idea as column detachment? No. It is a different idea, and the
distinction changes the design.** Four reasons, each checkable:

1. **Different grain.** `overridden_fields` is keyed by (row, column). Detachment is keyed by
   (brand, table, column). Gratsi detaching `Spelling Feedback` on `creative_briefs` would require
   writing the same entry into **390 separate rows'** jsonb arrays, and into every row created
   afterwards. There is no place to record the brand-level fact.
2. **Different subject.** `overridden_fields` protects a **value** ("do not overwrite *this
   persona's* pain points"). Detachment governs **structure** ("Gratsi calls this column
   *Description [Age Status Salary]*, shows it third, and stops following the parent's renames").
   `propagateTemplateRow:406` uses it in exactly one way — `if (!overridden.has(col))` decide whether
   to copy a value. It can express nothing about a label, an order or a hidden column.
3. **A detached column may have no rows.** Mattress Central and Funky Painting have **0 rows** in
   every content table. They can still need a column relabelled or hidden. A per-row jsonb array
   cannot hold that; there is no row.
4. **Different lifecycle.** A value override is created by an end user editing a cell. A detachment is
   an **admin** structural act, and the goal says "only admins change column structure". Storing both
   in one jsonb array would merge two permission levels into one column.

They are complementary, not alternatives. Keep `overridden_fields` for row values (it is the right
mechanism for that, even if it is currently unpopulated) and build detachment separately.

---

### `custom_fields` — a jsonb bag nothing uses {#custom_fields}

| | |
|---|---|
| **Declared** | `packages/db/src/columns.ts:43` — `jsonb('custom_fields').$type<Record<string, unknown>>().notNull().default({})` |
| **Tables carrying it** | the same 21 |
| **What reads it** | **nothing reads it.** The only non-test, non-demo hits for `customFields` outside `columns.ts` are in `apps/web/src/app/app/propagation/` (`page.tsx:92`, `propagation-workspace.tsx:58`), and those refer to the **`custom_field_schemas` list**, a different thing — a variable that happens to share the name. |
| **What writes it** | **nothing writes it.** Excluded from propagation copies by name? No — note that `MANAGED_PROPAGATION_COLUMNS` (`propagation.ts:230-241`) lists `overridden_fields` and `template_row_id` but **not** `custom_fields`, so a seed would copy the parent's bag verbatim. Moot today, since no bag is ever populated. |
| **Per-row or per-column** | **per-ROW** (a value bag, one per row) |
| **Admin UI** | none |
| **Production rows** | **0 non-empty** in `personas` (31), `products` (9), `angles` (48) |
| **Verdict** | **adjacent / dead.** It is the *value* side of a custom column. If an admin-added column needs storage, this is where its values would go — but it is unproven in production and nothing reads it. |

---

### `custom_field_schemas` — per-COLUMN definitions, per brand, with a working admin UI, zero rows {#custom_field_schemas}

| | |
|---|---|
| **Table** | `packages/db/src/schema/custom-field-schemas.ts:16`. Columns: `brand_id` NOT NULL, `table_name`, `field_key`, `field_type` (`text|number|boolean|select|url`), `field_label`, `options`, `sort_order` (**stored as `text`**, `:30`) |
| **What reads it** | `listCustomFieldSchemas` `packages/db/src/custom-field-schemas.ts:18`; `listApplicableFieldSchemas` `:64`; `propagateCustomFieldSchema` `:90`; `seedContentFromTemplate` `propagation.ts:267`; the page `apps/web/src/app/app/propagation/page.tsx:97` → `:107` |
| **What writes it** | `insertCustomFieldSchema` `:28`; `updateCustomFieldSchema` `:43`; `softDeleteCustomFieldSchema` `:127`; `propagateCustomFieldSchema` `:111`; onboarding `onboard.ts:253`; seed copy `propagation.ts:270`. Server Actions: `addCustomFieldAction` `custom-field-actions.ts:89`, `updateCustomFieldAction` `:116`, `deleteCustomFieldAction` `:160`, `promoteCustomFieldAction` `:195` |
| **Per-row or per-COLUMN** | **per-COLUMN, per-brand, per-table.** `(brand_id, table_name, field_key)` with a label and a sort order. **This is structurally the closest existing table to `column_definitions`.** |
| **Admin UI** | **yes** — the Custom Fields section of `/app/propagation` (`propagation-workspace.tsx:258` → `custom-fields-section.tsx`), admin-gated at `custom-field-actions.ts:80` (`canReviewPromotion`) and at the page level `propagation/page.tsx:100` |
| **Inheritance behaviour** | two mechanisms, both real: (a) `listApplicableFieldSchemas` (`:64-76`) resolves a child's schemas by **reading the parent's rows instead** (`brand?.templateBrandId ?? brandId`) — pure inheritance with no copy; (b) `propagateCustomFieldSchema` (`:82`) copies a parent schema row into each child, **skipping any child that already has that `(table_name, field_key)`** (`:109`) — a crude "do not clobber a local definition". |
| **Wired into a page** | yes, `/app/propagation` only. **No workspace grid reads it.** No page renders a custom field. |
| **Production rows** | **0** |
| **Verdict** | **reusable, and the strongest precedent in the repo** — but only for *added* columns, not for *inherited* ones. It cannot express "the parent defines this column and Gratsi hides it", because a row's existence *is* the column's existence. There is no `hidden`, no `detached`, and `sort_order` is `text`. |

Note also `promoteCustomFieldAction` (`custom-field-actions.ts:195-236`): adding a custom field
raises a `promotion_requests` row with `tableName: 'custom_field_schemas'`, and approving it calls
`propagateCustomFieldSchema` (`promotion-requests.ts:220-231`). **A structural change already flows
through the promotion queue today.** That is the governance path a column change should reuse.

---

### `propagation_runs` — a ledger nobody writes {#propagation_runs}

| | |
|---|---|
| **Table** | `packages/db/src/schema/propagation-runs.ts:22`; migration `0034_propagation-runs.sql` |
| **What reads it** | **nothing reads it.** |
| **What writes it** | **nothing writes it.** |
| **Exported?** | **No.** `grep propagationRuns packages/db/src/index.ts` → nothing. It leaves `packages/db` only through the blanket `export * from './propagation-runs'` at `packages/db/src/schema/index.ts:33`. |
| **Per-row or per-column** | per-RUN (an operational log) |
| **Admin UI** | **none** — the schema comment at `:11` claims "The Run History tab on `/app/propagation` reads this". **That tab does not read it.** `/app/propagation`'s only reads are `loadTeam`, `loadPromotionRequestsByStatus`, `loadCustomFieldSchemas`, `loadChildBrands` (`propagation/page.tsx:92-98`). The comment is wrong. |
| **Production rows** | **0** |
| **Verdict** | **unrelated as built, but the right shape to adopt.** An empty, correctly-designed audit table is a gift: a column-propagation run should write here rather than inventing a second ledger. Its `trigger` union (`:43`) would need a new member. |

---

### `promotion_requests` — the child→parent approval queue {#promotion_requests}

| | |
|---|---|
| **Table** | `packages/db/src/schema/promotion-requests.ts:56`. `brand_id` = **the CHILD** (`:60`), `table_name`, `row_id` (nullable), `field_name`, `current_value`, `proposed_value` (both `text` NOT NULL), `status` (`pending|approved|rejected`), `requested_by/at`, `reviewed_by/at`, `review_note` |
| **What reads it** | `listPromotionRequests` `packages/db/src/promotion-requests.ts:91` (**agency-scoped, not brand-scoped** — the documented exception, `:17-21`); `listPendingPromotionRequests`; `applyApprovedPromotion` `:197`; the page `apps/web/src/app/app/propagation/page.tsx:95` |
| **What writes it** | `createPromotionRequest` `propagation.ts:63`; `setPromotionRequestStatus` `promotion-requests.ts:161`; `promoteCustomFieldAction` `custom-field-actions.ts:213`; seed `seed.ts:499` |
| **Per-row or per-column** | **both, deliberately.** `row_id` is nullable precisely so a request can be "about a field's shape rather than one row's value" (`schema/promotion-requests.ts:28-29`), and the `custom_field_schemas` branch at `promotion-requests.ts:220` uses that. |
| **Admin UI** | **yes** — `/app/propagation`, admin-gated (`page.tsx:100`, `canSeePropagationPage`), filterable by status, approve/reject per row (`promotion-row.tsx`) |
| **Production rows** | **5**, and all five are **seed fixtures**, not real traffic: ids `eeeeeeee-eeee-4eee-8eee-00000000000{1..5}` matching `packages/db/src/seed.ts:499`, with fictional requesters. 3 `pending`, 1 `approved`, 1 `rejected`. Tables named: `angles`, `themes`, `personas`, `copywriting`, `creative_briefs`. |
| **Verdict** | **reusable, directly.** This is the "nothing auto-promotes" machinery of CLAUDE.md non-negotiable 2, it already carries a structural case, and a column change should raise a row here. |

---

### `withBrand` — the tenancy door {#withbrand}

| | |
|---|---|
| **Where** | `packages/db/src/tenancy.ts:123`; `scopeOf` at `:109` |
| **What it does** | Returns a **sealed** query surface with four methods (`select`, `insert`, `update`, `softDelete`). Every statement carries `brand_id = $brandId AND deleted_at IS NULL` (`:110`); a caller's `where` is parenthesised and checked by `contained` (`:102`), which throws on a fragment containing `'`, `"`, `$`, `;`, `--` or `/*` or unbalanced parens. `insert`/`update` re-attach the scoped `brandId` whatever the payload says (`:146`, `:153`), so a row cannot be written into or moved to another brand. `where`, `$dynamic`, joins and `onConflict*` are **out of reach** — the scope cannot be widened. |
| **Per-row or per-column** | neither — it is the access boundary |
| **Production rows** | n/a |
| **Verdict** | **reusable, mandatory.** Every read and write of a new `column_definitions` table goes through it. One caveat for the design: `withBrand` offers **no cross-brand read**, so "read the parent's column set while standing in a child" needs either two scoped reads (the pattern `listApplicableFieldSchemas` already uses, `custom-field-schemas.ts:69-75`, which reaches around `withBrand` with a plain `db.select()` on `brands`) or an explicit, documented agency-scoped query like `listPromotionRequests`. |

---

### `propagate*` — the four entry points {#propagate}

| function | file:line | grain | wired into a page? |
|---|---|---|---|
| `propagateInterfaceConfig` | `propagation.ts:119` | per-COLUMN (interface fields), **destructive full replace** | yes — `propagate-actions.ts:58` |
| `seedContentFromTemplate` | `propagation.ts:256` | per-ROW, one child, at onboarding | yes — `onboard.ts:107` |
| `propagateTemplateRow` | `propagation.ts:324` | per-ROW, one parent row → all children, honours `overridden_fields` | only via `applyApprovedPromotion` (`promotion-requests.ts:261`). **No insert/update hook calls it** — there is no trigger, no Inngest job. A template row edited outside the promotion flow propagates to nobody. |
| `propagateAllContent` | `propagation.ts:434` | per-ROW sweep, all tables, all children, honours `overridden_fields`, soft-deletes orphans (`:511-513`) | yes — `propagate-actions.ts:57` |

All four are synchronous, in-request. `propagateAllContent` is an N(tables) × N(children) ×
N(rows) loop of individual statements — fine at the current zero-row template, a problem at Gratsi's
390 briefs. CLAUDE.md says "Never call an external API from a request handler. Enqueue an Inngest job
and return"; this is a database equivalent and **it is not enqueued**. Worth noting, out of scope here.

---

### Adjacent mechanisms the brief did not name but the build must know about

**`user_table_views`** — `packages/db/src/schema/user-table-views.ts:15`. Per **Clerk user** × `table_key`:
`visible_fields jsonb`, `field_order jsonb`, `frozen_fields jsonb`, `sort`, `filter`, `is_active`.
`brand_id` **stays null** by design (`:8-10`): "a view is a lens on whichever brand the viewer is
standing in". **1 production row** — one user's `personas` view listing 17 `visible_fields`
(`name`, `product`, `angles`, `buyingTriggers`, … including `painPoints`, `dayInTheLife` and the other
columns `PERSONA_HIDDEN_FIELDS` hides from the page). **This is per-column hide/reorder — but
per-USER, not per-BRAND.** It is the right grain and the wrong owner. Two separate layers will exist:
brand column structure (new) and the user's personal lens (this). They must not be merged, and the
precedence rule (brand hides a column → a user's saved view cannot resurrect it) is a decision the
build has to make explicitly.

**`user_view_preferences`** — `packages/db/src/schema/view-preferences.ts:5`, 11 production rows, per
user × brand × table, `view_type` + `kanban_group_by_field`. Unique on `(user_id, brand_id, table_key)`.
Same layer as above.

**Column structure lives in TypeScript today, not in the database.** The real per-table column
catalogue is a hand-written source literal per page. `apps/web/src/app/app/personas/fields.ts:53`
exports `PERSONA_FIELD_GROUPS` — 6 fields with Gratsi's labels ("Description [Age Status Salary]",
"Problem-Solution Awareness Level") — and `:70` exports `PERSONA_HIDDEN_FIELDS`, a hardcoded list of 8
columns the page deliberately does not render **because the Gratsi base has no field for them**, with
the comment at `:51` deferring the real fix to `brand_field_overrides`. **That file is the thing
per-column inheritance has to replace.** Relabelling for one brand is currently a code edit, and
Niagara's hidden-for-Gratsi data is unreachable as a consequence.

**`brands.is_template` / `brands.template_brand_id`** — `packages/db/src/schema/brands.ts:23` and `:22`.
Read by `resolveTemplateBrandId` (`propagation.ts:80`) and `listChildBrands` (`:91`). Correct and
populated (see Brands table above).

**The Template base is excluded from the brand switcher at exactly one line.**
`apps/web/src/lib/data-source.ts:316`:

```ts
return rows.filter((row) => isLive(row) && !row.isTemplate && row.agencyId === agencyId);
```

The doc comment above it (`:310-314`) says the switcher's options and the working brand are both drawn
from this one list, "so the chooser can never offer a brand a read would then refuse". Making the
Template selectable is therefore **one predicate**, but it widens `pickActiveBrand` (`:326`) and every
downstream `withBrand` read to a brand that holds zero content rows — so pages must tolerate an empty
parent brand. `apps/web/src/lib/client-brand-source.ts:47` applies the same `!r.isTemplate` filter to
the **client** surface; that one must stay, since no client may land on the template.

---

## What is missing for per-column inheritance

Measured against the goal, these are the gaps. None of them is partially built.

1. **A parent column set.** No table anywhere stores "the master columns of `personas`". The master
   set is `PERSONA_FIELD_GROUPS` in TypeScript (`apps/web/src/app/app/personas/fields.ts:53`) and its
   siblings per page. Nothing is per-brand, nothing is in the database.
2. **An attached/detached bit.** Nothing in the schema records whether a child's column config is
   following the parent. `overridden_fields` is per-row and only ever `[]`; `interface_fields` has no
   such flag; `custom_field_schemas` has none.
3. **A per-brand label, visibility and order for a workspace (non-client) column.**
   `interface_fields` has all three but only for 5 client pages and only for 2 brands.
4. **A column-level diffing propagation.** The only column-ish propagation
   (`propagateInterfaceConfig`) is a full delete-and-reseed that would destroy child configuration,
   and it says so in its own comment (`propagation.ts:113-117`).
5. **An admin gate on column structure.** `/app/propagation` is gated (`page.tsx:100`);
   `/app/interface-config` is **not** gated at all.
6. **The Template base in the brand switcher.** Blocked at `data-source.ts:316`.
7. **A propagation audit trail that is actually written.** `propagation_runs` exists, is empty, and
   has no writer.
8. **A per-brand column ordering that is not `text`.** `custom_field_schemas.sort_order` is
   `text('sort_order').notNull().default('0')` (`schema/custom-field-schemas.ts:30`), so ordering
   sorts lexically: `'10'` before `'2'`. `interface_fields.position` is a correct `integer`.

---

## Recommendation {#recommendation}

### Build a new `column_definitions` table. Do not extend `overridden_fields` or the row engine.

**Why new, stated plainly: `overridden_fields` and `template_row_id` are per-ROW, and the inheritance
we need is per-COLUMN.** There is no way to key a brand-level column fact to a row-level jsonb array —
not for Mattress Central and Funky Painting, which have zero rows, and not for Gratsi's 390 briefs,
which would each need the same entry. The row engine is a different mechanism for a different problem
and should be left alone.

**Why not extend `interface_fields`, even though it is the right shape.** It is a *client* surface,
documented as such at `schema/interface-config.ts:8-17` and read by the client interface
(`client-queries.ts:470`). Its rows are keyed to one of five `interface_page_key` values, not to a
content table. Overloading it would couple internal grid structure to client page configuration, and
`docs/design/template-engine.md:1447` already rejected the converse ("One `brand_field_overrides`
table with a `surface` column for both workspace and client fields" — listed under rejected
alternatives). **Build `column_definitions` for the workspace, mirror `interface_fields`' proven
column set, and treat folding `interface_fields` into it as a later migration, not a prerequisite.**

**Why not extend `custom_field_schemas`, the nearest neighbour.** Its semantics are "a column that
exists *because* a row exists here". Inherited columns must be expressible as "the parent defines it,
this child hides it" — a row that *suppresses* rather than *creates*. That is a different meaning for
`row exists`, and conflating them makes a soft-delete ambiguous (is the column gone, or just hidden?).
If the build wants one table rather than two, `custom_field_schemas` can later become a
`source = 'custom'` subset of `column_definitions`; **I would not do that in the first ticket.**

**Name it `column_definitions`** — the brief's own name, and nothing in the repo claims it
(`information_schema` → absent; no code hits). **Do not name it `brand_field_overrides`**, despite
CLAUDE.md:66, because that name describes only the override half and the table must also hold the
parent's master set. If the owner prefers to honour CLAUDE.md's wording, add
`brand_field_overrides` as a documented alias in `docs/decisions.md` — but note that the design
document's `brand_field_overrides` (`template-engine.md:500`) is an *override-only* table that assumes
a separate field catalogue, which is not what I am proposing.

### The data model

One table. One row per (brand, table, column) — **including the parent brand**, whose rows *are* the
master set. Same pattern as `interface_fields`, promoted to the workspace and given the detach bit.

```
column_definitions
  -- ...baseColumns()  (id uuid pk, brand_id, created_at, updated_at, created_by, updated_by, deleted_at)
  brand_id        uuid NOT NULL references brands(id)   -- the parent's own rows carry the template brand's id
  table_name      text NOT NULL                          -- validated against Object.keys(PROPAGATION_TABLES)
  field_key       text NOT NULL                          -- the stable key; NEVER renamed (interface_fields' rule, schema/interface-config.ts:60-62)
  label           text NOT NULL                          -- what this brand reads: "Description [Age Status Salary]"
  visible         boolean NOT NULL DEFAULT true
  position        integer NOT NULL                       -- integer, not text; see gap 8
  source          text NOT NULL DEFAULT 'template'       -- 'template' | 'custom'   (a child-invented column)
  detached        boolean NOT NULL DEFAULT false         -- THE BIT. false = keeps following the parent
  detached_at     timestamptz                            -- null iff detached = false
  parent_row_id   uuid references column_definitions(id) -- which parent row this inherits from; null on the parent's own rows

  unique (brand_id, table_name, field_key) where deleted_at is null
  index  (brand_id, table_name, position)
  index  (parent_row_id)
```

Notes on each choice, with the precedent it follows:

- **`field_key` is immutable, `label` is per-brand.** Exactly `interface_fields`' rule, stated at
  `schema/interface-config.ts:60-62`: "the key never changes when a brand renames a label". This is
  what makes a relabel a data change and not a migration.
- **`position integer`**, following `interface_fields.position` (`:79`) and *not*
  `custom_field_schemas.sort_order text` (`:30`).
- **`detached` + `detached_at`** move together, the way `promotion_requests`' three review columns do
  (`schema/promotion-requests.ts:75-77`).
- **`parent_row_id`** is the column analogue of `template_row_id`, named differently on purpose so
  nobody confuses the two engines.
- **`visible` is a boolean, not a deletion.** This discharges the promise already made in
  `docs/decisions/no-drop-2026-10-02.md:8` and `schema/personas.ts:29`.
- **No per-brand Postgres columns** — CLAUDE.md architecture principle. A column's *existence* is a
  row here; its *storage* stays the one physical column, with `custom_fields` jsonb
  (`columns.ts:43`) available for `source = 'custom'` values. That is the first real use of that bag.

### Propagation, and the thing to get right

`propagateColumnDefinitions(db, templateBrandId, actorId)` — a **diffing** push, explicitly **not** the
delete-and-reseed of `propagateInterfaceConfig` (`propagation.ts:138-143`), whose own comment at
`:113-117` says the full engine should diff:

- parent row changed → update the child row **only where `detached = false`**
- parent row added → insert into each child with `detached = false`, `parent_row_id` set
- parent row soft-deleted → soft-delete the child row **unless `detached = true`**
- child row with `detached = true` → **never touched**
- child row with `source = 'custom'` → never touched (it has no parent)

Write one `propagation_runs` row per run (`trigger` gains a `'columns'` member at
`schema/propagation-runs.ts:43`), which finally gives that table a writer and makes the comment at
`:11` true.

### What to reuse, unchanged

| reuse | where | why |
|---|---|---|
| `withBrand` | `tenancy.ts:123` | every read and write of the new table |
| `PROPAGATION_TABLES` | `propagation.ts:203` | the `table_name` allow-list, as `custom-field-actions.ts:36` already does |
| `brands.is_template` / `template_brand_id`, `resolveTemplateBrandId`, `listChildBrands` | `brands.ts:22-23`, `propagation.ts:80`, `:91` | the parent/child graph, already correct in production |
| `promotion_requests` + `/app/propagation` | `schema/promotion-requests.ts:56`, `propagation/page.tsx` | a child's column change requests promotion; `row_id` nullable is already documented as covering "a field's shape rather than one row's value" (`:28-29`) |
| `canReviewPromotion` / `canSeePropagationPage` | used at `custom-field-actions.ts:80`, `propagation/page.tsx:100` | the admin gate. **Also apply it to `/app/interface-config`, which has none today.** |
| `propagation_runs` | `schema/propagation-runs.ts:22` | the audit ledger, currently unwritten |
| `interface_fields` as the design pattern | `schema/interface-config.ts:65` | copy its column set and its key/label discipline; migrate it in later, not now |

### Sequencing, in the order that de-risks the build

1. **Seed the parent.** `Creative Hub Template` has **0 rows in every content table and 0
   `interface_pages`**. Generate its `column_definitions` rows from the existing TypeScript catalogues
   (`PERSONA_FIELD_GROUPS` and siblings) — that is the only place the master column set exists.
2. **Backfill the children as attached** (`detached = false`), with their *current* labels. For Gratsi
   that means promoting `apps/web/src/app/app/personas/fields.ts` from source code to rows, and
   turning `PERSONA_HIDDEN_FIELDS` (`:70`) into eight `visible = false` rows on Gratsi — which, for
   the first time, lets Niagara show the same eight.
3. **Make the grids read the table** instead of the TypeScript literal. This is the large diff and
   should be one table at a time (`personas` first, it is smallest at 31 rows).
4. **Then** the admin UI for detach / relabel / reorder, gated.
5. **Then** `data-source.ts:316` — drop `!row.isTemplate` so the Template base is selectable. Do this
   **after** the grids tolerate a brand with zero content rows, or the Template base will render five
   empty pages. Leave `client-brand-source.ts:47` filtering the template out of the client surface.
6. **Before any of it:** either fix `propagateInterfaceConfig` or disable the Propagate button.
   Pressing it today soft-deletes Niagara's 23 interface fields and reseeds nothing, because the
   template has no interface config. I verified the code path and the counts; I did not run it.

---

## What I could not establish

- **Whether the 51 `interface_fields` rows are ever rendered to a real client.** I traced the read
  (`client-queries.ts:470`) and the route tree (`/client/[brandSlug]/…`), but I did not exercise
  the client surface, and `client-brand-source.ts:47` resolves brands by slug. Niagara is the only
  real brand configured.
- **Why only Niagara and `test` have interface config, and Gratsi does not.** The seed
  (`seed.ts:480`) writes it and onboarding (`onboard.ts:139`) writes it; Gratsi's data arrived by the
  Airtable importer. I could not establish from the repo alone which path each brand took.
- **Whether `CLAUDE.md:66` was written before or after TICKET-026 was deferred to backlog.** I did not
  read git history for it; the ticket's current status in `docs/tickets/backlog.md:50` is `backlog`.
- **What the 1400-line `docs/design/template-engine.md` was approved as.** It specifies a far larger
  system (a `createTemplateRegistry`, `renameFieldKey`, `reconcileFieldCatalog`, a `fieldVisibility`
  projection) of which **no line is implemented**. Whether it is a live plan or a superseded one is a
  question for the owner, and it changes whether `column_definitions` should be shaped to fit it.
- **Whether `user_table_views`' 1 production row belongs to a real user or a test session.** The
  `user_id` is a Clerk id (`user_3Jdeb7bQQ5ROisUylQbysjkgmvS`); I did not resolve it against Clerk.
