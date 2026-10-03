# Every displayed column in the app, and what each page needs to become resolver-driven

**Audit date:** 2026-10-03 · **Subagent D** · read-only pass, no source file changed
**Repo:** `/Users/macbook/tallas-tas`
**Commit I started at:** `0ae92cb` (as the task stated).
**Commit I finished at:** `ec71f39` — **the repo moved under me mid-audit.** See
[Delta 0](#delta-0--the-resolver-landed-while-i-was-reading-the-single-most-important-finding).
**Refreshes:** `docs/audits/ui-columns-2026-10-02.md` (same scope, commit `d7842e7`).

Only two source files changed between `d7842e7` and `0ae92cb`
(`apps/web/src/app/app/personas/fields.ts`, `packages/db/src/schema/personas.ts`, comment-only, +2
lines each), so **the earlier audit's `file:line` anchors are still valid except in
`personas/fields.ts`, where every line after 50 shifted by +2.** All line numbers below are at
`ec71f39`.

---

## Deltas against `ui-columns-2026-10-02.md`

Ordered by how much they change the plan. Three corrections, one addition, one confirmation.

### Delta 0 — the resolver landed while I was reading (the single most important finding)

The task says a new table `column_definitions` "will" hold the per-column configuration. **It already
exists, implemented, tested and migrated**, in a commit that landed during this audit window:

- `packages/db/src/schema/column-definitions.ts:24-68` — `pgTable('column_definitions')` with
  `brandId`, `tableKey`, `columnKey`, `displayLabel`, `displayOrder`, `isHidden`, `isDetached`,
  `fieldType`, `source: 'parent' | 'custom'`, plus the shared `baseColumns()`.
- `packages/db/src/column-definitions.ts:67-105` — `resolveColumns(db, brandId, tableKey)`, the
  read-time merge: parent defines the set and its order, a child row wins for its own column, a
  child-only row appends, `isHidden` removes from the result and never from the table.
- `packages/db/src/column-definitions.ts:131-154` `upsertColumnDefinition`, `:164-181`
  `reattachColumn` (soft delete, so reattaching is recoverable).
- `packages/db/drizzle/0045_column-inheritance.sql`, journal entry `idx: 45`,
  `tag: 0045_column-inheritance` (`packages/db/drizzle/meta/_journal.json`, 46 entries).
- `packages/db/src/column-definitions.test.ts` — 294 lines.

**`apps/web/src` imports none of it.** `grep -rn "columnDefinitions\|column-definitions\|resolveColumns" apps/web/src`
returns nothing.

This reframes the whole deliverable. The resolver half is done. `ResolvedColumn`
(`packages/db/src/column-definitions.ts:11-21`) carries `columnKey`, `displayLabel`, `displayOrder`,
`fieldType`, `source`, `isDetached`, `inheritedFrom` — **label, order and visibility as data, and no
renderer field.** The renderer registry is therefore the entire remaining gap, exactly as the task
frames it, and `fieldType` is the hook that lets 204 of the 267 columns pick their primitive without
a registry entry at all.

I did not query the database (no `psql` on this machine), so **I could not establish whether
`column_definitions` holds any rows.** A page wired to `resolveColumns` against an unseeded base
renders zero columns. Seeding is a sibling's half.

### Delta 1 — `grid-cells.tsx` is used by 6 pages, not 18. The earlier audit's central claim is wrong

`ui-columns-2026-10-02.md` says `grid-cells.tsx` is *"imported by 18 of the workspace pages"* and
builds its whole summary on it (*"the `grid-cells.tsx` library carries almost all of it"*). The live
source does not support that number:

```
$ grep -rln "views/grid-cells" apps/web/src
apps/web/src/app/(dev)/design-system/grid-cells.stories.tsx
apps/web/src/app/app/angles/angles-workspace.tsx
apps/web/src/app/app/concepts/concepts-workspace.tsx
apps/web/src/app/app/personas/personas-workspace.tsx
apps/web/src/app/app/products/products-workspace.tsx
apps/web/src/app/app/themes/themes-workspace.tsx
apps/web/src/app/app/ugc/ugc-workspace.tsx
```

**Seven files: six workspace pages and one design-system story.** A second grep for the primitive
names themselves (`TextCell|BoolCell|ChipCell|ChipListCell|LinkCell|CountCell|DateCell|MoneyCell|EmptyCell|cellText|GRID_EMPTY`)
returns the same seven files plus the module itself. The module's own doc comment says *"every one of
the six tables"* (`apps/web/src/components/views/grid-cells.tsx:10`) — the comment is right and the
earlier audit's 18 is not.

The other **nine** `AirtableGrid` pages each hand-rolled their own equivalents instead:

| Page | Its private copy |
| --- | --- |
| creative-reporting | `function Dash()` `:65`, `function Metric({label})` `:70` |
| email-campaigns | `function Dash()` `:86`, `function MonoDate({value})` `:91`, `function Choice({view})` `:95` |
| email-flows | `function dash()` `:128` |
| creative-sheet | `function chipOrDash(view)` `:106`, `Tick`, `QaTicks` |
| youtube-copywriting | `function dash(value)` `:80` |
| client-assets, copy-types, creative-modules, sm-campaign-feed | inline `<span className="text-text4">{EM_DASH}</span>` at every cell |

And the empty-cell sentinel itself is declared **25 times**: `export const EM_DASH = '—'` in 21
module `fields.ts` files, plus `EMPTY_FIELD` (`themes/fields.ts:245`), `GRID_EMPTY`
(`grid-cells.tsx:15`), `UNSET_LABEL` (`packages/domain/src/creators/vocabulary.ts:80`) and
`EM_DASH = UNSET_LABEL` (`ugc/fields.ts:80`).

**Why this matters for the plan:** the earlier audit's conclusion ("the renderers are nearly free,
the real work is the 15 unkeyed pages") understates the work by one whole step. Before a registry can
name a primitive, the primitive has to exist on the page that needs it. Six of fifteen grid pages
can be wired today; nine need `grid-cells` adopted first, which also deletes 24 copies of the dash.

The sharp correlation: **the same six pages that import `grid-cells` are the same six that pass
`view={tableView.config}` to `AirtableGrid`** — angles, concepts, personas, products, themes, ugc.
Nothing else does. Those six are the modern tier on both axes, and they are where the resolver
should land.

### Delta 2 — 59 of the 267 columns sit on tables the resolver has no key for

`column_definitions.tableKey` is documented as *"The content table, as `PROPAGATION_TABLES` keys it"*
(`packages/db/src/schema/column-definitions.ts:34`). `PROPAGATION_TABLES`
(`packages/db/src/propagation.ts:204-227`) holds **21 keys**. Every one of the 21 has a list page, so
that side is complete. But **ten displayed tables have no key in it**:

| Table with a list page | Columns | Why it has no key |
| --- | --- | --- |
| `themes` | 10 | GLOBAL table. `check('themes_global', sql\`${table.brandId} is null\`)` (`packages/db/src/schema/themes.ts:33`) — CLAUDE.md non-negotiable 3. There is no per-brand row to detach. |
| `notifications` (settings matrix) | 4 | Not a record table |
| `promotion_requests` | 7 | Admin surface |
| `custom_field_schemas` | 4 | Admin surface |
| `brands` (child-brand list) | 2 | Admin surface |
| `users` / `brand_assignments` (team) | 4 | Not per-brand content |
| `creator_rankings` | 8 | Derived reporting table |
| `onboarding_forms` | 5 | Not in the registry |
| `ad_metrics` (performance) | 9 | Derived reporting table |
| `upload_links` | 6 | Not in the registry |

**59 columns, 22% of the surface**, that `resolveColumns` cannot address as it stands. The earlier
audit flagged themes' global-table problem but did not count the other nine.

**And one key is claimed twice.** `/app/ugc` renders two different tables — the 33-column Creators
grid (`ugc-workspace.tsx:112`) and the 6-column Partnerships table (`partnership-table.tsx:47`) —
both over `creators`. `resolveColumns(db, brandId, 'creators')` returns one ordered list, so the
registry needs a view discriminator or Partnerships needs its own `tableKey`. Nothing in the resolver
or its tests anticipates two tables on one key.

### Delta 3 — a record table the earlier audit omitted, and two counting slips

**Omitted table.** `apps/web/src/app/app/creative-design/[briefId]/brief-detail.tsx:823-825` renders
a 3-column record table — `Script` / `Kind` / `Status` — over the brief's scripts, inside
`<Table data-slot="brief-scripts-table">` (`:820`). It is not in the earlier audit's groups A, B, C
or D. It is on a detail route rather than a list page, so I have **kept it out of the 267** to stay
comparable, and report it separately: the true figure for "every displayed column definition today"
is **270 across 33 tables** if detail-route tables count.

**Counting slips in the earlier audit's own headings** (its per-row data is right; the headings are
not):
- Its group B heading reads "11 tables on 10 routes" above a table of **13 rows** whose columns sum
  to the 69 it states. The correct count is **13 tables on 11 routes** (propagation holds 3 tables,
  ugc's Partnerships shares `/app/ugc` with the Creators grid).
- Its duplicated-label class A states **56** above a list of 55, of which 2 are header-vs-header, not
  header-vs-panel-label. My programmatic re-derivation finds **53** header-vs-field-label pairs
  (see [Duplicated labels](#duplicated-labels)).

### Delta 4 — confirmed, re-derived independently

Everything below I re-verified from source and it holds:

- **267 displayed columns** across **32 tables on 29 routes**: 170 in 15 `AirtableGrid` pages, 69 in
  13 hand-built `@tas/ui` `<Table>`s, 28 in 4 raw `<table>`s. Column counts verified by counting
  `key:` entries in each `GridColumn<…>[]` block and resolving each spread's arity.
- **23 tables hold a literal definition, 9 are partly or fully config-driven.** (The task's phrasing
  says "23 pages / 9"; they are tables, and two of them share `/app/ugc` while three share
  `/app/propagation`.)
- `grid-cells.tsx` **is** a shared cell-primitive library with exactly the eight primitives named —
  `TextCell:36`, `BoolCell:51`, `ChipCell:66`, `ChipListCell:72`, `LinkCell:84`, `CountCell:104`,
  `DateCell:120`, `MoneyCell:128` — plus `EmptyCell:24`, `cellText:18`, `GRID_EMPTY:15`. 131 lines.
- Every `GridColumn` carries a required `render` (`airtable-grid.tsx:28`,
  `readonly render: (row: Row) => ReactNode`), so "has renderers" is true of all 15 grid pages and is
  not the discriminator.
- `CONCEPT_COLUMNS` (`concepts/fields.ts:264-272`) is **dead** — seven strings whose only consumers
  are `fields.test.ts:182` and a prose comment at `concepts-workspace.tsx:116`. The page renders
  `CONCEPT_GRID_COLUMNS`'s 21 columns.
- The "four columns" comment at `meta-copywriting/fields.ts:37` sits above a six-string tuple
  (`:44-51`) and six columns render. Stale prose.
- `competitive-research` is the only hand-built table whose list carries **keys** as well as labels
  (`fields.ts:94-100`), and its cells (`:234-261`) are five positional `<TableCell>`s that never read
  them — so reordering the list reorders the headers and silently mismatches the data.
- `brand_field_overrides` does not exist. `grep -rn "brand_field_overrides" packages/db/src apps/web/src`
  returns nothing at all now: the two comments that named it were rewritten to point at
  `column_definitions` in `0ae92cb`.
- Two hand-rolled status pills bypass `StatusChip`, breaking UI-governance rule 3:
  `onboarding-forms-table.tsx:11-15` (a local `STATUS_TONE` class map) and
  `upload-links-table.tsx:59-66` (an inline class ternary).

---

## How I classify a renderer, and the margin on it

The task asks me to split each column into "pure data (a label and a value, fully expressible through
a primitive)" versus "genuinely code". `GridColumn` has no `kind` field, so this is a judgement I
applied, not a property I read. The test I used, stated so it can be checked:

> **PURE-DATA** — the cell is reproducible as `{renderer, path, params}` where `renderer` names one
> of a fixed shared primitive set, `path` reaches the value from the row by property access (plus
> `.length` on an array), and `params` are **literal JSON** (a noun, a max width, `mono`, an
> alignment, a fixed tone, a true/false label pair). Label, order and visibility come from
> `ResolvedColumn`. **No code is written for this column.**
>
> **BESPOKE** — the registry must hold a code reference. Three kinds:
> - **badge** — the frozen name beside `<PropagationBadge>`. One shared composite, 11 copies.
> - **vocabulary** — the only non-literal part is a `key → {label, tone}` map keyed by a stored
>   vocabulary value. One registry entry per *vocabulary*, reused across columns and pages.
> - **code** — the cell emits its own element tree, reads two or more independent row properties,
>   constructs an href, mounts a non-primitive component, or needs data that is not on the row.

Adjudications I made inside that rule, because they are where the boundary actually bites:

| Case | Verdict | Reason |
| --- | --- | --- |
| Chip with a **constant** tone and a value label (`tone: PERSONA_CHIP_TONE`, `tone: 'mute'`, `tone: 'info'`, `tone: 'accent'`) | PURE | the tone is a literal param |
| Chip whose tone **varies with the value** (`angleStatusView`, `themeCategoryTone`, `linkCountTone`) | vocabulary | the map is a code reference |
| Chip over a `{tone, label}` pair the **server already resolved** onto the row (`item.status`, `item.statusTone`, `item.differenceCpa`) | PURE | the row carries the pair |
| `x ? 'Yes' : 'No'` with two literal tones | PURE | a `boolLabel` renderer with literal params |
| Truncation / preview / dash substitution (`basicInfoPreview`, `truncate`, `descriptionPreview`) | PURE | `TextCell`'s `maxWidth` is already this param |
| ISO date, currency, server-formatted metric label | PURE | `DateCell`, `MoneyCell`, a mono text renderer |
| Stored URL rendered as host + href | PURE | `LinkCell` takes the stored value; no href is built |
| Label from a **page-level map or a second table** (`productMap.get(id)`, `TABLE_OPTIONS.find(…)`) | code / vocabulary | the label is not on the row |

**This is the same three-way split the earlier audit reached (its S / V / C), and I reached it
independently after trying two stricter cuts and finding they collapse** — if "a function appears in
`render`" makes a column bespoke then nearly everything is, and if it does not then nothing is. The
line that survives is: *accessor computation is data-side, renderer structure and tone decisions are
code-side.*

**The margin.** My per-page numbers match the earlier audit's `S / (V+C)` on **25 of 29 tables**. I
differ on four, each for a stated reason:

| Table | Mine | Earlier | Why I differ |
| --- | --- | --- | --- |
| angles | 15 / 2 | 11 / 6 | `Persona`, `Product`, `Formats to create`, `Type` all pass a **constant** tone (`PERSONA_CHIP_TONE` `:153`, `PRODUCT_CHIP_TONE` `:168`, `FORMAT_CHIP_TONE` `:213`, `'mute'` `:225`). Only `Status` and `Potential` compute a tone from the value. |
| campaigns-offers | 10 / 1 | 8 / 3 | `Confirmed` `:317-320` and `Launched` `:323-326` are `x ? 'ok' : 'mute'` + `x ? 'Yes' : 'No'` — literal params, not a vocabulary. `Product` `:330-333` reads `productMap`, so I move it the other way, into code. |
| creative-sheet | 3 / 4 | 2 / 5 | `Used` `:159-164` is `<Tick on={item.used} label="Used" />` (`:163`) — `BoolCell` plus a literal label. |
| creative-design, meta-copywriting, propagation (promotions), team, ugc (Partnerships) | +1 pure each | | a chip over a server-resolved `{tone,label}`, or a class chosen by a row boolean from two literals, is a literal param in my rule and a vocabulary in theirs. |

So the honest statement is: **204 / 63 under my rule, 196 / 71 under the earlier audit's. The gap is
8 columns, 3% of the surface, and it is one definitional choice about constant tones, not a factual
disagreement.** Both numbers say the same thing — roughly three quarters of the surface is data.

---

## Summary table

### A. `AirtableGrid` pages — 15 pages, 170 columns

| Module | Route | `tableKey` | Cols | Definition | Hardcoded / config | Pure | Bespoke |
| --- | --- | --- | --- | --- | --- | --- | --- |
| angles | `/app/angles` | `angles` | 17 | `angles-workspace.tsx:134-275` `ANGLE_COLUMNS` | **HARDCODED** literal array | 15 | 2 |
| client-assets | `/app/client-assets` | `client_asset_folders` | 5 | `client-assets-workspace.tsx:80-154` | **HARDCODED** | 2 | 3 |
| concepts | `/app/concepts` | `concepts` | 21 | `concepts-workspace.tsx:120-251` | **HARDCODED** | **21** | **0** |
| copy-types | `/app/copy-types` | `copy_types` | 5 | `copy-types-workspace.tsx:70-126` | **HARDCODED** | 2 | 3 |
| creative-modules | `/app/creative-modules` | `creative_modules` | 5 | `creative-modules-workspace.tsx:80-132` | **HARDCODED** | 2 | 3 |
| creative-reporting | `/app/creative-reporting` | `creative_reporting` | 12 | `creative-reporting-workspace.tsx:80-183` | **HARDCODED** | 11 | 1 |
| creative-sheet | `/app/creative-sheet` | `creative_sheet_items` | 7 | `creative-sheet-workspace.tsx:118-170` | **HARDCODED**, the only `export`ed array | 3 | 4 |
| email-campaigns | `/app/email-campaigns` | `email_campaigns` | 12 | `email-campaigns-workspace.tsx:104-199` | **HARDCODED** | 8 | 4 |
| email-flows | `/app/email-flows` | `email_flows` | 9 | `email-flows-workspace.tsx:138-228` | **HARDCODED** | 6 | 3 |
| personas | `/app/personas` | `personas` | 7 | `personas-workspace.tsx:101-139` | **PARTLY CONFIG** — 4 of 7 spread `PERSONA_FIELDS` at `:112-118` | 6 | 1 |
| products | `/app/products` | `products` | 10 | `products-workspace.tsx:128-201` | **HARDCODED** | 9 | 1 |
| sm-campaign-feed | `/app/sm-campaign-feed` | `sm_campaign_feed_tasks` | 7 | `sm-campaign-feed-workspace.tsx:79-161` | **HARDCODED** | 4 | 3 |
| themes | `/app/themes` | **none (global)** | 10 | `themes-workspace.tsx:119-209` | **HARDCODED** | 7 | 3 |
| ugc (Creators) | `/app/ugc` | `creators` | **33** | `ugc-workspace.tsx:112-364` | **PARTLY CONFIG** — 3 of 33 spread `creatorTracks(…)` at `:146-165` | 26 | 7 |
| youtube-copywriting | `/app/youtube-copywriting` | `youtube_copy` | 10 | `youtube-copywriting-workspace.tsx:89-164` | **HARDCODED** | 8 | 2 |
| **Totals** | | | **170** | | 13 hardcoded, 2 partly config | **130** | **40** |

### B. Hand-built `@tas/ui` `<Table>` — 13 tables on 11 routes, 69 columns

No column objects: the cell is inline JSX in the row body, **positional**, with no key.

| Module | Route | `tableKey` | Cols | Header definition | Hardcoded / config | Pure | Bespoke |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ai-characters | `/app/ai-characters` | `ai_characters` | 4 | `ai-characters-workspace.tsx:160-163` | **HARDCODED** JSX | 3 | 1 |
| campaigns-offers | `/app/campaigns-offers` | `campaigns_offers` | 11 | `campaigns-workspace.tsx:220-230` | **HARDCODED** JSX | 10 | 1 |
| collections | `/app/collections` | `collections` | 6 | `collections-workspace.tsx:201-206` | **HARDCODED** JSX | 5 | 1 |
| competitive-research | `/app/competitive-research` | `competitive_research` | 5 | `fields.ts:94-100`, mapped at `:170-174` | **CONFIG headers, with keys**; cells positional `:234-261` | 3 | 2 |
| creative-design | `/app/creative-design` | `creative_briefs` | 6 | `fields.ts:94-101`, mapped at `briefs-workspace.tsx:437-441` | **CONFIG headers, labels only**; cells positional `:461-494` | 5 | 1 |
| creative-dimensions | `/app/creative-dimensions` | `creative_dimensions` | 4 | `creative-dimensions-workspace.tsx:156-159` | **HARDCODED** JSX | 3 | 1 |
| meta-copywriting | `/app/meta-copywriting` | `copywriting` | 6 | `fields.ts:44-51`, mapped at `copywriting-workspace.tsx:276-280` | **CONFIG headers, labels only**; cells positional `:301-353` | 3 | 3 |
| notifications | `/app/notifications` | **none** | 4 | `fields.ts:27-31`, mapped at `notification-row.tsx:148-152` | **CONFIG on both axes** — headers *and* cells iterate `NOTIFICATION_CHANNELS` (`:112-122`) | 2 | 2 |
| propagation (promotions) | `/app/propagation` | **none** | 7 | `fields.ts:44-52`, mapped at `promotion-row.tsx:303-307` | **CONFIG headers, labels only**; cells positional `:203-266` | 5 | 2 |
| propagation (custom fields) | `/app/propagation` | **none** | 4 | `custom-fields-section.tsx:263-266` (+ conditional 5th `:267`) | **HARDCODED** JSX | 2 | 2 |
| propagation (child brands) | `/app/propagation` | **none** | 2 | `propagation-controls.tsx:74-75` | **HARDCODED** JSX | 2 | 0 |
| team | `/app/team` | **none** | 4 | `fields.ts:30`, mapped at `team-table.tsx:30-34` | **CONFIG headers, labels only**; cells positional `:52-92` | 3 | 1 |
| ugc (Partnerships) | `/app/ugc` | `creators` **(collides)** | 6 | `ugc/fields.ts:329-336`, mapped at `partnership-table.tsx:47-51` | **CONFIG headers, labels only**; cells positional `:65-91` | 5 | 1 |
| **Totals** | | | **69** | | 6 hardcoded, 7 config | **51** | **18** |

### C. Raw `<table>` — 4 pages, 28 columns

| Module | Route | `tableKey` | Cols | Header definition | Hardcoded / config | Pure | Bespoke |
| --- | --- | --- | --- | --- | --- | --- | --- |
| creator-ranking | `/app/creator-ranking` | **none** | 8 | `creator-leaderboard.tsx:43-50` | **HARDCODED** `<th>` | 7 | 1 |
| onboarding-forms | `/app/onboarding-forms` | **none** | 5 | `onboarding-forms-table.tsx:41-45` | **HARDCODED** `<th>` | 3 | 2 |
| performance | `/app/performance` | **none** | 9 | `performance-tracker.tsx:105-113` | **HARDCODED** `<th>` | **9** | **0** |
| upload-links | `/app/upload-links` | **none** | 6 | `upload-links-table.tsx:39-44` | **HARDCODED** `<th>` | 4 | 2 |
| **Totals** | | | **28** | | 4 hardcoded | **23** | **5** |

### D. Routes with no column definition

| Module | Route | What it renders |
| --- | --- | --- |
| ad-spy | `/app/ad-spy` | card grid, `ad-spy-board.tsx:83-103` |
| assets | `/app/assets` | card grid, `asset-grid.tsx:88-113` |
| concepts (Board) | `/app/concepts?view=kanban` | `concept-board.tsx:41` — one column per **internal status** |
| queue/client | `/app/queue/client` | kanban of client statuses |
| queue/internal | `/app/queue/internal` | kanban, `internal-queue-board.tsx:106` `groupByInternalStatus` |
| interface-config | `/app/interface-config` | `config-tree.tsx` — a page/field toggle tree |
| onboard | `/app/onboard` | form wizard |
| briefs, campaigns, copywriting | `/app/{briefs,campaigns,copywriting}` | `page.tsx:16` `permanentRedirect` |

The kanban columns are **statuses**, not fields. A per-brand status vocabulary is a different feature
from per-brand columns and `column_definitions` does not model it.

### The whole surface in one line

**267 displayed columns · 204 pure-data (76%) · 63 bespoke (24%).** The 63 decompose into:

| Kind | Count | Distinct renderers needed |
| --- | --- | --- |
| **badge** — frozen name + `<PropagationBadge>` | 11 | **1** shared composite |
| **vocabulary** — `key → {label, tone}` resolved in the cell | 34 | **27** named vocabulary references |
| **code** — true one-offs | 18 | **18** |
| | **63** | **46 registry entries** |

So the registry is 46 entries over 267 columns, and 204 columns need **no entry at all** — they can
be driven by `ResolvedColumn.fieldType` plus literal params.

---

## The renderer vocabulary the registry needs

`ResolvedColumn` has no renderer field, so the registry is code, keyed `tableKey:columnKey`. Its
renderer names, and which already exist:

**Exists today** (`apps/web/src/components/views/grid-cells.tsx`, used by 6 of 32 tables):

| Name | Primitive | Literal params |
| --- | --- | --- |
| `text` | `TextCell:36` | `maxWidth`, `mono` |
| `bool` | `BoolCell:51` | — |
| `chip` | `ChipCell:66` | takes a `{label, tone}` the row already carries |
| `chipList` | `ChipListCell:72` | a fixed `tone` for every chip |
| `url` | `LinkCell:84` | — (host + href both from the stored value) |
| `count` | `CountCell:104` | `noun` |
| `date` | `DateCell:120` | — |
| `money` | `MoneyCell:128` | — |

**Must be added** — each one exists today as 2 to 9 private copies:

| Name | What it does | The copies it replaces |
| --- | --- | --- |
| `metric` | right-aligned mono over a server-formatted label, dash-aware | `creative-reporting:70` `Metric`; `performance-tracker` 8 inline spans; `creator-leaderboard` 4 |
| `monoNumber` | a number in mono, zero-as-dash optional | `ugc-workspace:313`, `:323`; `email-flows:191`, `:202` |
| `boolLabel` | `x ? trueLabel : falseLabel`, optional tone pair | `themes:207` (`Active`/`Archived`); `campaigns:317`, `:323` (`Yes`/`No`); `upload-links:62` (`Active`/`Inactive`) |
| `flagChip` | a constant `{tone,label}` shown only when a row flag is set | `sm-campaign-feed:135` |
| `badgeName` | frozen name + `<PropagationBadge>` from a path triple | **11 copies** (see below) |

`badgeName` is the single highest-leverage addition. `<PropagationBadge>`
(`packages/ui/src/propagation/propagation-badge.tsx:11-37`) takes `templateRowId` and
`overriddenFields`, renders nothing on a template row, `"synced"` when a child tracks its parent and
`"N overrides"` with the field names in the `title` when it has diverged. Eleven cells wrap it
identically:

```
client-assets-workspace.tsx:90        creative-reporting-workspace.tsx:90
collections-workspace.tsx:269         email-campaigns-workspace.tsx:114
competitive-research-workspace.tsx:237  email-flows-workspace.tsx:148
copy-types-workspace.tsx:80           products-workspace.tsx:138
creative-dimensions-workspace.tsx:222 sm-campaign-feed-workspace.tsx:89
creative-modules-workspace.tsx:90
```

One `badgeName` renderer collapses 11 bespoke columns into 11 pure-data ones, taking the surface to
**215 pure / 52 bespoke (81% / 19%)**. It is also the right vocabulary to mirror: **row-level
attach/detach is already shipped with a UI on 11 pages**, and column-level detach should reuse its
words rather than invent a second set.

---

## Per-module ordered dumps and renderer registries

Header text is quoted **exactly as it renders**, including the sentence-case/title-case
inconsistencies — those are findings, not transcription errors. `Reads` is the row property the cell
reads. `Origin` is the Drizzle column, or `computed` / `linked` / `generated`.

### angles — `/app/angles` — `tableKey: angles`

`ANGLE_COLUMNS`, `angles-workspace.tsx:134-275`. **HARDCODED** literal array;
`view={tableView.config}` at `:491`. Imports `grid-cells`. `pgTable angles`:
`packages/db/src/schema/angles.ts:18-47`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `item.angle.name` | `angles.name` | `text` `{weight:'medium'}` frozen |
| 2 | `Persona` | `item.angle.personaName` | **linked** `angle_personas` → `personas.name` | `chip` `{tone:PERSONA_CHIP_TONE}` + `headOnly` |
| 3 | `Product` | `item.angle.productName` | **linked** `angle_products` | `chip` `{tone:PRODUCT_CHIP_TONE}` |
| 4 | `Status` | `item.angle.status` | `angles.status` | **vocab** `angleStatusView` |
| 5 | `Potential` | `item.angle.potential` | `angles.potential` | **vocab** `anglePotential` |
| 6 | `Winning` | `item.angle.winning` | `angles.winning` | `bool` |
| 7 | `Formats to create` | `item.angle.formats` | `angles.formats` jsonb | `chipList` `{tone:FORMAT_CHIP_TONE}` |
| 8 | `Type` | `item.angle.type` | `angles.type` jsonb | `chipList` `{tone:'mute'}` |
| 9 | `Description` | `item.angle.description` | `angles.description` | `text` |
| 10 | `Pain Points` | `item.angle.painPoints` | `angles.pain_points` | `text` |
| 11 | `USP` | `item.angle.usp` | `angles.usp` | `text` |
| 12 | `Ad Inspo` | `item.angle.adInspoLinks.length` | **computed** count over `ad_inspo_links` jsonb | `count` `{noun:'link'}` |
| 13 | `Brief URL` | `item.angle.briefUrl` | `angles.brief_url` | `url` |
| 14 | `Exact Script URL` | `item.angle.exactScriptUrl` | `angles.exact_script_url` | `url` |
| 15 | `Internal Notes` | `item.angle.internalNotes` | `angles.internal_notes` | `text` |
| 16 | `Client Notes` | `item.angle.clientNotes` | `angles.client_notes` | `text` |
| 17 | `Updated` | `item.updatedLabel` / `item.updatedTitle` | **computed** over `updated_at` | `text` `{tone:'muted'}` |

**Registry — 15 pure / 2 bespoke.** Two entries only:
`{ status: vocab('angleStatus'), potential: vocab('anglePotential') }`.
No composite anywhere. **The cheapest wide table in the app.**

### client-assets — `/app/client-assets` — `tableKey: client_asset_folders`

`CLIENT_ASSET_COLUMNS`, `client-assets-workspace.tsx:80-154`. **HARDCODED**, uncontrolled grid
(`:254`, no `view` prop). Does **not** import `grid-cells`.
`pgTable client_asset_folders`: `schema/client-asset-folders.ts:17-28`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Folder name` | `.name`, `.templateRowId`, `.overriddenFields` | `client_asset_folders.name` `:25` | **badge** |
| 2 | `Description` | `item.folder.description` | `.description` `:26` | `text` `{maxWidth:448}` |
| 3 | `Location` | `item.locationHost` | **computed** `hostLabel(locationUrl)` over `.location_url` `:27` | **code** — bespoke `<a>` with `stopPropagation` on **click *and* keydown** plus `data-slot="client-asset-location-link"` (`:118-132`). `LinkCell` does neither. |
| 4 | `Linked designs` | `item.designCount` | **linked** `folder.briefIds.length` | **vocab** `linkCount` |
| 5 | `Updated` | `item.updatedLabel` | **computed** | `text` `{tone:'muted'}` |

**Registry — 2 pure / 3 bespoke.** `{ name: badgeName, location: code('externalLink'), designs: vocab('linkCount') }`.
Folding keydown + a `slot` param into `LinkCell` turns column 3 pure and makes this 3/2.

### concepts — `/app/concepts` — `tableKey: concepts`

`CONCEPT_GRID_COLUMNS`, `concepts-workspace.tsx:120-251`. **HARDCODED**, `view=` at `:464`.
Imports `grid-cells`. Row type `ConceptItem`, `concepts/fields.ts:175-205`.
`pgTable concepts`: `schema/concepts.ts:42-75`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `item.name` | `concepts.name` — **generated**, Batch-Angle-Theme (CLAUDE.md §6) | `text` `{mono:true, slot:'concept-row-name'}` frozen |
| 2 | `Batch` | `item.batch` | `concepts.batch` | `text` `{mono:true}` |
| 3 | `Angle` | `item.angleName` | **linked** `concept_angles` | `text` |
| 4 | `Persona` | `item.personaName` | **linked, two hops** — through the angle; `fields.ts:180` says "never stored on the concept" | `text` |
| 5 | `Product` | `item.productName` | **linked, two hops** | `text` |
| 6 | `Theme` | `item.themeName` | **linked** `concept_themes` | `text` |
| 7 | `Internal Status` | `item.status.{tone,label}` | `concepts.internal_status` | `chip` — pair pre-resolved server-side |
| 8 | `Client Status` | `item.clientStatus.{tone,label}` | `concepts.client_status` | `chip` — pre-resolved |
| 9 | `Approval Status` | `item.approvalStatusLabel` | `concepts.approval_status` | `text` |
| 10 | `Category` | `item.categoryLabel` | `concepts.category` | `text` |
| 11 | `Concept Style` | `item.styleLabel` | `concepts.concept_style` | `text` |
| 12 | `Formats to create` | `item.formatsToCreate` | `formats_to_create` jsonb | `chipList` `{tone:'accent'}` |
| 13 | `Hook Examples` | `item.hookExamples` | `concepts.hook_examples` | `text` |
| 14 | `Script Idea` | `item.scriptIdea` | `concepts.script_idea` | `text` |
| 15 | `Description` | `item.description` | `concepts.description` | `text` |
| 16 | `Pain Points` | `item.painPoints` | `concepts.pain_points` | `text` |
| 17 | `USP` | `item.usp` | `concepts.usp` | `text` |
| 18 | `Client Comments` | `item.clientComments` | `concepts.client_comments` | `text` |
| 19 | `Collection` | `item.collectionName` | **linked** `concept_collections` | `text` |
| 20 | `Creators` | `item.creatorCount` | **linked** count | `count` `{noun:'creator'}` |
| 21 | `Ad Inspo` | `item.adInspoCount` | **computed** count over `ad_inspo_links` jsonb | `count` `{noun:'link'}` |

**Registry — 21 pure / 0 bespoke. EMPTY.** `ConceptItem` resolves every label, tone and count on the
server, so all 21 renderers are a primitive over a ready value. The widest grid needs no registry at
all.

> `concepts.production_status` is deliberately not displayed (`fields.ts:189`: "hidden from the list,
> the form and the panel; the column stays"). A resolver migration should delete the dead
> `CONCEPT_COLUMNS` tuple (`fields.ts:264-272`), not feed it.

### copy-types — `/app/copy-types` — `tableKey: copy_types`

`COPY_TYPE_COLUMNS`, `copy-types-workspace.tsx:70-126`. **HARDCODED**, uncontrolled (`:225`). No
`grid-cells`. `pgTable copy_types`: `schema/copy-types.ts:24-34`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `.name` + propagation fields | `copy_types.name` `:32` | **badge** |
| 2 | `Description` | `item.descriptionPreview` | **computed** preview over `.description` `:33` | `text` `{maxChars}` |
| 3 | `Meta copies` | `item.metaCopies.length` | **linked** `copywriting_copy_types` (`:49-55`) | **vocab** `linkCount` + `metaCopyCountLabel` |
| 4 | `YouTube copies` | `item.youtubeCopies.length` | **linked** `youtube_copy_copy_types` (`schema/youtube-copy.ts:132-138`) | **vocab** `linkCount` + `youtubeCopyCountLabel` |
| 5 | `Updated` | `item.updatedLabel` | **computed** | `text` `{tone:'muted'}` |

**Registry — 2 pure / 3 bespoke.** `{ name: badgeName, metaCopies: vocab('linkCount'), youtubeCopies: vocab('linkCount') }`.
One vocabulary, used twice.

### creative-modules — `/app/creative-modules` — `tableKey: creative_modules`

`CREATIVE_MODULE_COLUMNS`, `creative-modules-workspace.tsx:80-132`. **HARDCODED**, uncontrolled
(`:233`). No `grid-cells`. `pgTable creative_modules`: `schema/creative-modules.ts:21-31`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Module name` | `.moduleName` + propagation | `.module_name` `:29` | **badge** |
| 2 | `Foreplay link` | `item.foreplayHost` | **computed** host over `.foreplay_link` `:30` | `text` |
| 3 | `Angles` | `item.angleCount` | **linked** `creative_module_angles` (`:45-51`) | **vocab** `linkCount` |
| 4 | `Creative designs` | `item.designCount` | **linked** `creative_module_designs` (`:63-69`) | **vocab** `linkCount` |
| 5 | `Updated` | `item.updatedLabel` | **computed** | `text` `{tone:'muted'}` |

**Registry — 2 pure / 3 bespoke.** Identical in shape to copy-types; the same `linkCount` vocabulary.

### creative-reporting — `/app/creative-reporting` — `tableKey: creative_reporting`

`COLUMNS`, `creative-reporting-workspace.tsx:80-183`. **HARDCODED**, uncontrolled (`:290`). No
`grid-cells`; its own `Dash()` `:65` and `Metric({label})` `:70`.
`pgTable creative_reporting`: `schema/creative-reporting.ts:39-59`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name + Angle + Offer` | `.nameAngleOffer` + propagation | `.name_angle_offer` `:47` | **badge** |
| 2 | `Creative` | `item.row.briefName` | **linked** `.brief_id` `:48` → `creative_briefs.name` | `text` `{mono:true}` |
| 3 | `CTR (%)` | `item.ctrLabel` | `.ctr` numeric `:52` | `metric` |
| 4 | `Thumb-stop rate` | `item.thumbStopLabel` | `.thumb_stop_rate` numeric `:53` | `metric` |
| 5 | `Results` | `item.resultsLabel` | `.results` numeric `:54` | `metric` |
| 6 | `CPA` | `item.cpaLabel` | `.cpa` numeric `:55` | `metric` |
| 7 | `Target CPA` | `item.targetCpaLabel` | `.target_cpa` numeric `:56` | `metric` |
| 8 | `Difference CPA` | `item.differenceCpa.{tone,label}` | **formula, NOT stored** — `creativeReportDifferenceCpa(cpa, targetCpa)`, `packages/db/src/creative-reporting.ts:67`; the `cellTitle` at `:148` reads `'CPA − Target CPA (formula, read-only)'` | `chip` — pair pre-resolved |
| 9 | `ROAS` | `item.roasLabel` | `.roas` numeric `:57` | `metric` |
| 10 | `Target ROAS` | `item.targetRoasLabel` | `.target_roas` numeric `:58` | `metric` |
| 11 | `Ad link` | `item.adLinkHost` | **computed** host over `.ad_link` `:51` | `text` |
| 12 | `Updated` | `item.updatedLabel` | **computed** | `text` `{tone:'muted'}` |

**Registry — 11 pure / 1 bespoke.** `{ nameAngleOffer: badgeName }`. Needs the `metric` primitive
and a **virtual-column** concept: `Difference CPA` has no Postgres column, so
`column_definitions.column_key = 'difference_cpa'` would name a formula, not a column.
`.notes` `:49` and `.ad_design` jsonb `:50` are stored and not displayed.

### creative-sheet — `/app/creative-sheet` — `tableKey: creative_sheet_items`

`CREATIVE_SHEET_COLUMNS`, `creative-sheet-workspace.tsx:118-170` — **the only `export`ed column
array**, mounted by `design-system/creative-sheet.stories.tsx:116`. **HARDCODED**, uncontrolled
(`:353`). No `grid-cells`; its own `chipOrDash` `:106`, `Tick`, `QaTicks`.
`pgTable creative_sheet_items`: `schema/creative-sheet-items.ts:57-78`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `item.name` | **generated formula; no `name` column exists on the table.** `CreativeSheetItemListRow = CreativeSheetItem & CreativeSheetBriefFields & { name: string }` (`packages/db/src/creative-sheet-items.ts:56-57`) | `text` `{mono:true}` frozen |
| 2 | `Brief` | `item.briefName` | **linked** `.brief_id` `:65` | `text` `{mono:true}` |
| 3 | `Internal Status` | `item.internalStatus` | `.internal_status` `:66` | **vocab** `sheetInternalStatus` |
| 4 | `Status` | `item.status` | `.status` `:67` | **vocab** `sheetStatus` |
| 5 | `Winning` | `item.winning` | `.winning` `:75` (**text, not boolean**) | **vocab** `sheetWinning` |
| 6 | `Used` | `item.used` | `.used` `:73` | `bool` `{label:'Used'}` |
| 7 | `QA` | `QA_CHECKS.filter(c => item[c.name])` | **three stored columns in one cell** — `.qa_video_editor` `:69`, `.qa_designer` `:70`, `.qa_strategist` `:71`, via `QA_CHECKS` (`fields.ts:136-140`) | **code** `QaTicks` |

**Registry — 3 pure / 4 bespoke.** `{ internalStatus: vocab(…), status: vocab(…), winning: vocab(…), qa: code('qaTicks') }`.
Column 7 is the sharpest case in the repo of a cell that is **not one column**: one header, one
`render`, three Drizzle booleans. `column_definitions` assumes `column_key` ↔ one column, so `qa`
needs either three rows collapsed by the registry or an explicit composite key.

### email-campaigns — `/app/email-campaigns` — `tableKey: email_campaigns`

`COLUMNS`, `email-campaigns-workspace.tsx:104-199`. **HARDCODED**, uncontrolled (`:418`). No
`grid-cells`; its own `Dash` `:86`, `MonoDate` `:91`, `Choice` `:95`.
`pgTable email_campaigns`: `schema/email-campaigns.ts:33-53`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `.name` + propagation | `.name` `:41` | **badge** |
| 2 | `Status` | `.status` | `.status` `:43` | **vocab** `emailCampaignStatus` |
| 3 | `Type` | `.type` | `.type` `:51` | **vocab** `emailCampaignType` |
| 4 | `Channel` | `.channel` | `.channel` `:52` | **vocab** `emailCampaignChannel` |
| 5 | `Send date` | `.sendDate` | `.send_date` date `:44` | `date` |
| 6 | `Design due` | `.designDueDate` | **formula, no stored column** — `sendDate − 5 days`, `packages/db/src/email-campaigns.ts:74-76`; `cellTitle` at `:149` reads `'Send date − 5 days (formula, read-only)'` | `date` |
| 7 | `Copywriting due` | `.copywritingDueDate` | **formula** — `sendDate − 10 days`; `cellTitle` at `:156` | `date` |
| 8 | `Assignee` | `.assigneeName` | **linked** `.assignee_id` `:46` → `users.full_name` | `text` |
| 9 | `Klaviyo` | `item.klaviyoHost` | **computed** host over `.klaviyo_link` `:49` | `text` |
| 10 | `Copy link` | `item.copyHost` | **computed** host over `.copy_link` `:47` | `text` |
| 11 | `Campaigns & Offers` | `.campaignOfferNames` | **linked** `email_campaign_campaigns` (`:68-74`) | `chipList` `{tone:'info'}` |
| 12 | `Updated` | `item.updatedLabel` | **computed** | `text` `{tone:'muted'}` |

**Registry — 8 pure / 4 bespoke.** Three vocabularies plus `badgeName`. Two virtual columns, whose
provenance lives **only in a `cellTitle` string literal** — if the resolver drives the headers, that
provenance needs a home in data.

### email-flows — `/app/email-flows` — `tableKey: email_flows`

`EMAIL_FLOW_COLUMNS`, `email-flows-workspace.tsx:138-228`. **HARDCODED**, uncontrolled (`:240`). No
`grid-cells`; its own `dash()` `:128`. `pgTable email_flows`: `schema/email-flows.ts:32-50`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Flow name` | `.flowName` + propagation | `.flow_name` `:40` | **badge** |
| 2 | `Status` | `.status` | `.status` `:43` | **vocab** `emailFlowStatus` |
| 3 | `Type` | `.type` | `.type` `:47` | **vocab** `emailFlowType` |
| 4 | `Expected setup date` | `item.setupLabel` | `.expected_setup_date` date `:41` | `text` (raw ISO in `cellTitle`) |
| 5 | `Design due` | `item.designDueLabel` | **formula, no stored column** | `text` `{mono:true}` (`:186-195`) |
| 6 | `Copywriting due` | `item.copywritingDueLabel` | **formula, no stored column** | `text` `{mono:true}` |
| 7 | `Assignee` | `.assigneeName` | **linked** `.assignee_id` `:49` | `text` |
| 8 | `Klaviyo link` | `item.klaviyoHost` | **computed** host over `.klaviyo_link` `:46` | `text` |
| 9 | `Updated` | `item.updatedLabel` | **computed** | `text` `{tone:'muted'}` |

**Registry — 6 pure / 3 bespoke.** Also the **only page with a CSV template that is a column list**:
`EMAIL_FLOW_CSV_COLUMNS` (`email-flows/fields.ts:145-157`), eleven snake_case names. It carries
database columns, not display headers, so it is **not** a duplicated-label risk — see
[Duplicated labels](#duplicated-labels).

### personas — `/app/personas` — `tableKey: personas` — *the page the resolver should land on*

`PERSONA_COLUMNS`, `personas-workspace.tsx:101-139`. **PARTLY CONFIG-DRIVEN**, `view=` at `:339`.
Imports `grid-cells`. `pgTable personas`: `schema/personas.ts:14-51`.

Three literals wrapped around one spread:

```
:101  const PERSONA_COLUMNS: readonly GridColumn<PersonaItem>[] = [
:102-109    { key: 'name', header: 'Name', frozen: true, … }                      ← literal
:112-118    ...PERSONA_FIELDS.filter(f => f.name !== 'name' && f.name !== 'stageOfAwareness')
                              .map(field => ({ key: field.name, header: field.label, … }))
:119-132    { key: 'stageOfAwareness', header: 'Problem-Solution Awareness Level', … }  ← literal
:133-138    { key: 'angles', header: 'Angles', … }                                ← literal
```

| # | Header | Reads | Origin | Renderer | Source |
| --- | --- | --- | --- | --- | --- |
| 1 | `Name` | `.name` | `personas.name` | `text` `{weight:'medium'}` frozen | literal `:104` |
| 2 | `Description [Age Status Salary]` | `.demographic` | `.demographic` | `text` | **spread** ← `fields.ts:60` |
| 3 | `Personality` | `.psychographic` | `.psychographic` | `text` | **spread** ← `fields.ts:61` |
| 4 | `Drivers for this persona` | `.coreDesires` | `.core_desires` | `text` | **spread** ← `fields.ts:62` |
| 5 | `Passion` | `.passion` | `.passion` (added by migration `0044_personas-passion`) | `text` | **spread** ← `fields.ts:63` |
| 6 | `Problem-Solution Awareness Level` | `.stageOfAwareness` | `.stage_of_awareness` **pgEnum** | **vocab** `awareness` | literal `:121` |
| 7 | `Angles` | `.angleNames.join(', ')` | **linked** `angle_personas` | `text` `{maxWidth:320}` | literal `:135` |

**Registry — 6 pure / 1 bespoke.** `{ stageOfAwareness: vocab('awareness') }`. **One entry.**

`PERSONA_FIELD_GROUPS` (`fields.ts:55-67`) is already a `{name, label, kind}` table — the resolver's
payload shape minus visibility and order. And `PERSONA_HIDDEN_FIELDS` (`fields.ts:74-85`) is a
hand-written visibility list of ten keys: `dayInTheLife`, `emotionalTriggers`, `painPoints`,
`successFactors`, `perceivedBarriers`, `buyingTriggers`, `problemChallenge`,
`successTransformation`, `triggerWords`, `productId`. The comment now says so explicitly
(`fields.ts:50-53`): *"Per-brand visibility belongs in the `column_definitions` table … which is why
this constant is temporary scaffolding, not the destination."* **This page is column inheritance
already implemented by hand, for one brand, with a comment naming its own replacement.**

### products — `/app/products` — `tableKey: products`

`PRODUCT_COLUMNS`, `products-workspace.tsx:128-201`. **HARDCODED**, `view=` at `:395`. Imports
`grid-cells`. `pgTable products`: `schema/products.ts:11-22` — only **three** business columns;
seven of ten displayed columns are link counts.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Product name` | `.name` + propagation | `products.name` `:19` | **badge** |
| 2 | `Landing page URL` | `item.linkHost` | **computed** `hostLabel` over `.link` `:20` | `text` |
| 3 | `Collection link` | `item.collectionHost` | **computed** over `.collection_link` `:21` | `text` |
| 4 | `Angles` | `.angleNames` | **linked** `angle_products` | `text` `{maxWidth:320}` |
| 5 | `Concepts` | `.conceptCount` | **linked** count | `count` `{noun:'concept'}` |
| 6 | `Creative Designs` | `item.creativeDesigns.length` | **linked** `creative_briefs.product_id` | `count` `{noun:'design'}` |
| 7 | `Creators` | `item.creators.length` | **linked** `creator_products` | `count` `{noun:'creator'}` |
| 8 | `Email Campaigns` | `item.emailCampaigns.length` | **linked** `email_campaign_products` | `count` `{noun:'campaign'}` |
| 9 | `YouTube Copy` | `item.youtubeCopy.length` | **linked** `youtube_copy_products` | `count` `{noun:'copy'}` |
| 10 | `Updated` | `item.updatedLabel` | **computed** | `text` `{tone:'muted'}` |

**Registry — 9 pure / 1 bespoke.** `{ name: badgeName }`. Five `count` columns whose only per-column
datum is an English noun, which becomes resolver data for free.

### sm-campaign-feed — `/app/sm-campaign-feed` — `tableKey: sm_campaign_feed_tasks`

`SM_TASK_COLUMNS`, `sm-campaign-feed-workspace.tsx:79-161`. **HARDCODED**, uncontrolled (`:355`). No
`grid-cells`. `pgTable sm_campaign_feed_tasks`: `schema/sm-campaign-feed-tasks.ts:25-38` — every
stored business column is displayed, plus one computed.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Task` | `.taskName` + propagation | `.task_name` `:33` | **badge** |
| 2 | `Platform` | `.platform` | `.platform` `:34` | **vocab** `smPlatform` |
| 3 | `Due date` | `item.dueLabel` | **computed** over `.due_date` `:35` | `text` |
| 4 | `Status` | `.status` | `.status` `:36` | **vocab** `smStatus` |
| 5 | `Reminder` | `item.reminder` | **computed** `'due'` vs not, derived from `.due_date` | `flagChip` `{tone:REMINDER_TONE, label:REMINDER_LABEL}` (`:138`) |
| 6 | `Notes` | `.notes` | `.notes` `:37` | `text` `{maxWidth:448}` |
| 7 | `Updated` | `item.updatedLabel` | **computed** | `text` `{tone:'muted'}` |

**Registry — 4 pure / 3 bespoke.** `Reminder` has no field to attach to: a virtual column again.

### themes — `/app/themes` — **GLOBAL table, no `tableKey`**

`THEME_COLUMNS`, `themes-workspace.tsx:119-209`. **HARDCODED**, `view=` at `:511`. Imports
`grid-cells`. `pgTable themes`: `schema/themes.ts:18-34`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `theme.name` | `themes.name` `:22` | `text` `{weight:'medium', slot:'theme-name'}` frozen |
| 2 | `Category` | `theme.category` | `themes.category` **pgEnum** `:23` | **vocab** `themeCategory` |
| 3 | `Status` | `theme.status` | `themes.status` `:27` | **vocab** `themeStatus` |
| 4 | `Assignee` | `assigneeValue(theme)` | **linked, fallback-to-stored** — `.assignee_id` `:26` → `users.full_name`; an imported Gratsi row stores a collaborator display name matching no Clerk id and renders as-is (`packages/db/src/themes.ts:41-48`) | **code** — wrapper span carries `data-resolved` computed from `assignee.mono` |
| 5 | `Notes` | `theme.notes` | `themes.notes` `:25` | `text` `{maxWidth:320}` |
| 6 | `Attachments` | `attachmentChipRow(theme.attachments)` | `.attachments` jsonb `:28` | `count` `{noun:'file'}` |
| 7 | `Attachment Summary` | `theme.aiAttachmentSummary` | `.ai_attachment_summary` `:29` | `text` `{maxWidth:320}` |
| 8 | `Reference Links` | `referenceChipRow(theme.referenceLinks)` | `.reference_links` jsonb `:24` | `count` `{noun:'link'}` |
| 9 | `Used by` | `theme.usedByBrandCount` | **computed, cross-brand** — distinct brands with a live concept on the theme, counted deliberately **outside** `withBrand` (`packages/db/src/themes.ts:52-63`) | `text` `{tone:'muted'}` |
| 10 | `Active` | `theme.isActive` | `.is_active` `:30` | `boolLabel` `{true:'Active', false:'Archived'}` |

**Registry — 7 pure / 3 bespoke.** But **this table cannot use `resolveColumns` as written.**
`brand_id` is constrained null (`check('themes_global', sql\`${table.brandId} is null\`)` `:33`,
CLAUDE.md non-negotiable 3), and `themes` is absent from `PROPAGATION_TABLES`. There is no per-brand
row to detach from. Column inheritance needs its own rule here: either the template brand owns the
one definition set for all brands, or `column_definitions` gains a null-`brand_id` global tier of its
own. **This is a design decision, not plumbing, and nothing in the shipped resolver addresses it.**

### ugc (Creators tab) — `/app/ugc` — `tableKey: creators`

`CREATOR_COLUMNS`, `ugc-workspace.tsx:112-364`. **PARTLY CONFIG-DRIVEN** — 30 literal entries plus
one 3-element spread = **33 columns**, the widest table in the app. `view=` at `:634`. Imports
`grid-cells`. `pgTable creators`: `schema/creators.ts:82-148`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `.name`, `.profilePicUrl` | `.name` `:93` + `.profile_pic_url` `:97` | **code — the app's only avatar cell.** `<img>` when a URL exists, else an initials tile on `bg-surface3` (`:121-139`). Two row properties, one cell |
| 2 | `Internal Status` | `creatorTracks(creator)` → `internal` | `.internal_creator_status` `:114` | **vocab** `creatorTrack` — **spread** `:146-165` |
| 3 | `Client Status` | → `client` | `.client_status` `:117` | **vocab** `creatorTrack` — **spread** |
| 4 | `Assets Status` | → `assets` | `.internal_assets_status` `:118` | **vocab** `creatorTrack` — **spread** |
| 5 | `Gender` | `.gender` | `.gender` `:95` | `text` |
| 6 | `Age Bracket` | `.ageBracket` | `.age_bracket` `:94` | **vocab** `ageBracket` |
| 7 | `Ethnicity` | `.ethnicity` | `.ethnicity` `:96` | `text` |
| 8 | `Platform` | `.platform` | `.platform` jsonb `:100` | **vocab** `creatorPlatform` + `chipList` `{tone:'mute'}` |
| 9 | `Creator Link` | `.creatorLink` | `.creator_link` `:99` | `url` |
| 10 | `Instagram Username` | `.instagramUsername` | `.instagram_username` `:124` | `text` `{mono:true}` |
| 11 | `Facebook Profile` | `.facebookProfileUrl` | `.facebook_profile_url` `:145` | `url` |
| 12 | `Linked Concepts` | `.conceptIds.length` | `.concept_ids` jsonb `:110` | `count` `{noun:'concept'}` |
| 13 | `Linked Products` | `.productIds.length` | `.product_ids` jsonb `:111` | `count` `{noun:'product'}` |
| 14 | `Internal Brief` | `.internalBrief` | `.internal_brief` `:101` | `text` |
| 15 | `Client's Note` | `.clientNote` | `.client_note` `:121` | `text` |
| 16 | `Creator Info Request` | `.creatorInfoRequest` | `.creator_info_request` `:147` | `text` |
| 17 | `Raw Assets URL` | `.rawAssetsUrl` | `.raw_assets_url` `:109` | `url` |
| 18 | `Video Intro` | `.videoIntroUrl` | `.video_intro_url` `:98` | `url` |
| 19 | `Shipping Location` | `.shippingLocation` | `.shipping_location` `:102` | `text` |
| 20 | `Tracking Number` | `.trackingNumber` | `.tracking_number` `:103` | `text` `{mono:true}` |
| 21 | `Date of Management` | `.dateOfManagement` | `.date_of_management` `:104` | `date` |
| 22 | `Budget per 60sec Video` | `.budgetPer60s` | `.budget_per_60s` `:106` | `money` |
| 23 | `Creator Cost (USD)` | `.creatorCost` | `.creator_cost` `:107` | `money` |
| 24 | `Paid by TAS (USD)` | `.costUsd` | `.cost_usd` `:108` | `money` |
| 25 | `Payment Date` | `.paymentDate` | `.payment_date` `:146` | `date` |
| 26 | `Partnership Activity` | `.partnershipActivity` | `.partnership_activity` `:126` | **vocab** `partnershipActivity` |
| 27 | `Date of Partnership Activation` | `.partnershipActivatedAt` | `.partnership_activated_at` `:129` | `date` |
| 28 | `Partnership Period (days)` | `.partnershipPeriodDays` | `.partnership_period_days` `:130` | `monoNumber` |
| 29 | `Extension (days)` | `.extensionDays` | `.extension_days` `:132` | `monoNumber` `{zeroAsDash:true}` |
| 30 | `Partnership Price per 30 Days` | `.partnershipPricePer30Days` | `.partnership_price_per_30_days` `:133` | `money` |
| 31 | `Continue Working With?` | `.continueWorkingWith` | `.continue_working_with` `:131` | `bool` |
| 32 | `Partnership Notes` | `.partnershipNotes` | `.partnership_notes` `:144` | `text` |
| 33 | `Slack Notified` | `.slackNotified` | `.slack_notified` `:134` | `bool` |

**Registry — 26 pure / 7 bespoke.** Counter-intuitive and true: the widest table has exactly **one**
true one-off (the avatar). `grid-cells` already carries 26 of 33.

Two notes a migration must carry:

1. **The spread is a workaround, not a field list.** `:146-150` calls
   `creatorTracks({internalCreatorStatus:'', clientStatus:'', internalAssetsStatus:''})` with **dummy
   empty values purely to enumerate the three track keys**, then each `render` calls `creatorTracks`
   again on the real row and `.find()`s its own track back out. `CREATOR_TRACKS`
   (`ugc/fields.ts:91-95`) is the actual data. The header is a template string
   `` `${track.label} Status` `` (`:152`) [verified], so **no literal `'Internal Status'` exists in this file** —
   a resolver that greps for headers will miss three columns here.
2. **CLAUDE.md non-negotiable 10 lives in this table.** Columns 22-24 and 30 are internal money
   figures. `column_definitions` has `isHidden` but **no client/internal axis**, so a per-brand
   resolver that can unhide a column could expose creator costs on a client surface. The visibility
   axis needs a bound the shipped schema does not have.

### youtube-copywriting — `/app/youtube-copywriting` — `tableKey: youtube_copy`

`COLUMNS`, `youtube-copywriting-workspace.tsx:89-164`. **HARDCODED**, uncontrolled (`:333`). No
`grid-cells`; its own `dash(value)` `:80`. `pgTable youtube_copy`: `schema/youtube-copy.ts:52-72`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Copy #` | `item.title` (sorts on `item.copyNumber`) | **generated** `copyNumberLabel(copyNumber)` over `.copy_number` `:60` | `text` `{mono:true, slot:'youtube-copy-row-title'}` frozen |
| 2 | `Headline` | `item.headline` | `.headline` `:64` | `text` |
| 3 | `Descriptions` | `item.descriptions` | `.descriptions` `:63` | `text` `{maxChars:DESCRIPTIONS_PREVIEW}` |
| 4 | `Status` | `item.statusTone` / `item.statusLabel` | `.status` `:61` | `chip` — pre-resolved |
| 5 | `CTA` | `item.ctaLabel` | `.cta` `:66` | `text` |
| 6 | `Funnel` | `item.funnelLabel` | `.funnel` `:67` | `text` |
| 7 | `Used` | `item.used` | `.used` `:69` | **vocab** `booleanChip` |
| 8 | `Winning` | `item.winning` | `.winning` `:70` | **vocab** `booleanChip` |
| 9 | `Meta rating` | `item.metaRating` | `.meta_rating` `:71` | `text` `{mono:true}` via `metaRatingLabel` |
| 10 | `Updated` | `item.updatedLabel` | **computed** | `text` `{tone:'muted'}` |

**Registry — 8 pure / 2 bespoke.** One vocabulary (`booleanChip`), used twice. The one wrinkle:
**the header names the number while the cell renders the generated title.** `.angle` `:62`,
`.news_feed` `:65`, `.client_comment` `:68` are stored and not displayed.

### ai-characters — `/app/ai-characters` — `tableKey: ai_characters`

Four `<TableHead>` literals, `ai-characters-workspace.tsx:160-163`; cells `:223-244`.
**HARDCODED on both axes.** `pgTable ai_characters`: `schema/ai-characters.ts:15-35`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `character.name` | `.name` `:23` | `text` `{weight:'medium'}` |
| 2 | `Status` | `character.status` | `.status` `:25` | **vocab** `aiCharacterStatus` |
| 3 | `Basic Info` | `basicInfoPreview(character.basicInfo)` | `.basic_info` `:26` | `text` `{maxChars:BASIC_INFO_PREVIEW_LENGTH}` |
| 4 | `Updated` | `updatedLabel` | **computed** | `text` `{tone:'muted'}` |

**Registry — 3 pure / 1 bespoke.** Zero composites, but **no column array exists** and the cells are
positional. Nine stored columns are not displayed: `attachments`, `tone_of_voice`, `voice_link`,
`personality_traits`, `appearance`, `traits_and_habits`, `hobbies_and_lifestyle`,
`work_and_background`, `why_promotes_brand` (`:24-34`) — real material for the resolver to switch on.

### campaigns-offers — `/app/campaigns-offers` — `tableKey: campaigns_offers`

Eleven `<TableHead>` literals, `campaigns-workspace.tsx:220-230`; cells `:294-339`.
**HARDCODED on both axes.** `pgTable campaigns_offers`: `schema/campaigns.ts:28-49`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `campaign.name` | `.name` `:36` | `text` `{mono:true}` |
| 2 | `Holiday` | `campaign.holiday` | `.holiday` `:37` | `text` |
| 3 | `Offer` | `campaign.discountOffer` | `.discount_offer` `:38` | `text` |
| 4 | `Code` | `campaign.code` | `.code` `:39` | `text` `{mono:true}` |
| 5 | `Official Date` | `formatDate(campaign.officialDate)` | `.official_date` date `:40` | `date` |
| 6 | `Ads Launch` | `formatDate(.adsLaunchDate)` | `.ads_launch_date` date `:46` | `date` |
| 7 | `Ads End` | `formatDate(.adsEndDate)` | `.ads_end_date` date `:47` | `date` |
| 8 | `Confirmed` | `.confirmedByClient` | `.confirmed_by_client` `:44` | `boolLabel` `{true:'Yes'/'ok', false:'No'/'mute'}` (`:317-320`) |
| 9 | `Launched` | `.launched` | `.launched` `:45` | `boolLabel` (`:323-326`) |
| 10 | `Product` | `productMap.get(campaign.productId)` | **linked** `.product_id` `:48` | **code** — the label comes from a page-level `productMap`, not the row (`:330-333`) |
| 11 | `Updated` | `updatedLabel` | **computed** | `text` `{tone:'muted'}` |

**Registry — 10 pure / 1 bespoke.** `{ product: code('productLookup') }`, and it turns pure the
moment the server joins `productName` onto the row the way collections already does.
`.country` `:41`, `.description` `:42`, `.promotional_ideas` `:43` stored, not displayed.

### collections — `/app/collections` — `tableKey: collections`

Six `<TableHead>` literals, `collections-workspace.tsx:201-206`; cells `:266-292`.
**HARDCODED on both axes.** `pgTable collections`: `schema/collections.ts:17-33`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `.name` + propagation | `.name` `:25` | **badge** |
| 2 | `URL` | `urlHost` | **computed** host over `.url` `:26` | `text` |
| 3 | `Campaign` | `.campaignName` | **linked** `.campaign_id` `:27` | `text` |
| 4 | `Angle` | `.angleName` | **linked** `.angle_id` `:28` | `text` |
| 5 | `Product` | `.productName` | **linked** `.product_id` `:29` | `text` |
| 6 | `Updated` | `updatedLabel` | **computed** | `text` `{tone:'muted'}` |

**Registry — 5 pure / 1 bespoke.** `{ name: badgeName }`. The model for campaigns-offers' `Product`:
the FK name is joined server-side and the cell is plain text.
`.creative_design_note` `:30`, `.copywriting_id` `:31`, `.creative_design_2_id` `:32` stored, not displayed.

### competitive-research — `/app/competitive-research` — `tableKey: competitive_research`

**Headers config-driven, cells not.** `COMPETITIVE_RESEARCH_COLUMNS` (`fields.ts:94-100`) is
`readonly {key, label}[]` — **the only hand-built table whose list carries keys** — mapped at
`competitive-research-workspace.tsx:170-174`, `colSpan` reads `.length` (`:180`). Its doc comment at
`fields.ts:88` claims *"The workspace maps this list; it does not hardcode it."* **The cells at
`:234-261` are five positional `<TableCell>`s with no reference to the keys**, so reordering the list
reorders the headers and silently mismatches the data.
`pgTable competitive_research`: `schema/competitive-research.ts:12-33`.

| # | Header (`label`) | `key` | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- | --- |
| 1 | `Name` | `name` | `.name` + propagation | `.name` `:20` | **badge** |
| 2 | `Type` | `type` | `entry.type` | `.type` `:21` | **vocab** `researchType` |
| 3 | `Website` | `website` | `websiteHost` | **computed** host over `.website` `:22` | `text` |
| 4 | `Instagram` | `instagram` | `entry.instagram` | `.instagram` `:23` | `text` |
| 5 | `Updated` | `updated` | `updatedLabel` | **computed** | `text` `{tone:'muted'}` |

**Registry — 3 pure / 2 bespoke.** The nearest thing in the repo to a finished migration: the list
already carries keys in the resolver's shape. Keying the cells is the one remaining step.
`.facebook_page` `:24`, `.meta_ads_library` `:25`, `.analysis` `:26` stored, not displayed.

### creative-design — `/app/creative-design` — `tableKey: creative_briefs`

**Headers config-driven, labels only.** `BRIEF_COLUMNS` (`fields.ts:94-101`) is an `as const` tuple
of six **bare strings** — no keys — mapped at `briefs-workspace.tsx:437-441`; cells `:461-494`
positional. `pgTable creative_briefs`: `schema/briefs.ts:75-131` — **57 columns, six displayed. The
widest stored/shown gap in the repo.**

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `item.name` | `.name` `:89` — **generated** `{FUNNEL}{FORMAT}{NUMBER}-BATCH-CONCEPT-VERSION` (CLAUDE.md §6) | `text` `{mono:true, slot:'brief-row-name'}` |
| 2 | `Concept` | `item.conceptName` | **linked, nullable by design** — `.concept_id` `:83`; a null renders a `STANDALONE_CONCEPT_SLUG` chip (`:470`), which is CLAUDE.md non-negotiable 5 | `text` `{fallbackChip:{tone:'mute', label:STANDALONE_CONCEPT_SLUG}}` |
| 3 | `Type` | `item.typeLabel` | `.type` `:93` | `text` |
| 4 | `Priority` | `item.priority.{tone,label,sla}` | `.priority` `:96` | **code** — chip **plus** an SLA string beside it (`:479-486`): two rendered values from one object |
| 5 | `Assignee` | `item.assignee` | `.assignee` `:97` (**free text, not an FK**) | `text` |
| 6 | `Internal Status` | `item.status.{tone,label}` | `.internal_status` `:121` | `chip` — pre-resolved |

**Registry — 5 pure / 1 bespoke.** `{ priority: code('priorityWithSla') }`. The resolver's
"add a column" path here has **51 candidates** and no existing per-brand record of which a brand
wants, which is why this is Tier 3 despite the small registry.

### creative-dimensions — `/app/creative-dimensions` — `tableKey: creative_dimensions`

Four `<TableHead>` literals, `creative-dimensions-workspace.tsx:156-159`; cells `:219-236`.
**HARDCODED on both axes.** `pgTable creative_dimensions`: `schema/creative-dimensions.ts:13-31`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `.name` + propagation | `.name` `:21` | **badge** |
| 2 | `Dimensions` | `.dimensions` | `.dimensions` `:22` | `text` `{mono:true}` |
| 3 | `Link Description` | `.linkDescription` | `.link_description` `:23` | `text` |
| 4 | `Updated` | `updatedLabel` | **computed** | `text` `{tone:'muted'}` |

**Registry — 3 pure / 1 bespoke.** `{ name: badgeName }`. `.creative_design_id` `:24` stored, not displayed.

### meta-copywriting — `/app/meta-copywriting` — `tableKey: copywriting`

**Headers config-driven, labels only.** `COPY_COLUMNS` (`fields.ts:44-51`) is an `as const` tuple of
six bare strings, mapped at `copywriting-workspace.tsx:276-280`; cells `:301-353` positional.
`pgTable copywriting`: `schema/copy.ts:57-79`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Copy title / Headline` | `item.title` **and** `item.headline` | **generated** `copyTitle(copyNumber)` over `.copy_number` `:68`, **plus** `.headline` `:70` | **code** — two stored values stacked in one cell (`:301-314`). `fields.ts:39-42`: splitting them would be the fifth column PRD §5.11 rules out |
| 2 | `Linked Creative` | `item.creativeName`, `item.creativeHref` | **linked** `.creative_brief_id` `:65` | **code** — `Link` pill with a constructed href and `stopPropagation` (`:321-330`) |
| 3 | `Concept` | `item.conceptName` | **linked** `.concept_id` `:66` | `text` `{mono:true, pill:true}` |
| 4 | `Funnel` | `copyFunnelLabel(item.funnel)` | `.funnel` `:73` | **vocab** `copyFunnel` |
| 5 | `Status` | `item.statusTone` / `item.statusLabel` | `.status` `:79` | `chip` — pre-resolved |
| 6 | `Updated` | `item.updatedLabel` | **computed** | `text` `{tone:'muted'}` |

**Registry — 3 pure / 3 bespoke.** The densest registry per column in the app, and column 1 has no
1:1 column mapping **by ticket decision** — the resolver cannot be allowed to split it.
**Stale prose:** `fields.ts:37` says "The list's four columns"; the tuple holds six and six render.

### notifications — `/app/notifications` — **no `tableKey`**

**The most config-driven table in the app, on both axes.** `NOTIFICATION_COLUMNS` (`fields.ts:27-31`)
is `['Trigger', 'Recipient', ...NOTIFICATION_CHANNELS.map(channelLabel)]`. Headers map it
(`notification-row.tsx:148-152`), `colSpan` reads `.length` (`:159`), **and the cells iterate the
same `NOTIFICATION_CHANNELS`** (`:112-122`). Adding a channel adds a header and a cell together.
`NOTIFICATION_CHANNELS = ['slack', 'email'] as const`
(`packages/domain/src/notifications/channels.ts:17`), so **4 columns today**.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Trigger` | `item.label` | **domain vocabulary**, not a stored column | `text` |
| 2 | `Recipient` | `item.recipient` | **computed** from the brand's team assignment (CLAUDE.md non-negotiable 7) | `text` `{mutedWhen:'unrouted'}` |
| 3 | `channelLabel('slack')` | `channelValue(item, 'slack')` | per-channel flag | **code** — interactive `<Switch>` |
| 4 | `channelLabel('email')` | `channelValue(item, 'email')` | per-channel flag | **code** — interactive `<Switch>` |

**Registry — 2 pure / 2 bespoke.** This is a settings matrix of interactive controls, not a record
list. It is simultaneously the closest thing in the repo to the target shape and the **worst** fit
for a record-column resolver. **Recommend excluding.**

### propagation — `/app/propagation` — **three tables, no `tableKey` for any**

**(a) Promotion requests.** `PROMOTION_COLUMNS` (`fields.ts:44-52`) — `as const` tuple of seven bare
strings, mapped at `promotion-row.tsx:303-307`; `colSpan` reads `.length` (`:314`); cells `:203-266`
positional.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Brand` | `item.brand.{text,muted}` | `promotion_requests` → `brands.name` | `chip` `{true:'warn', false:'mute'}` — the tone flips to `warn` on a soft-deleted brand (`:211`) |
| 2 | `Table` | `item.tableName` | `.table_name` | `text` `{mono:true}` |
| 3 | `Field` | `item.fieldName` | `.field_name` | `text` `{mono:true}` |
| 4 | `Requested by` | `item.requestedBy` | **linked** → `users` | `text` |
| 5 | `Requested at` | `item.requestedAt` / `…Title` | **computed** over `created_at` | `text` `{tone:'muted'}` |
| 6 | `Change` | `<DiffPreview item>` | **computed diff** of old vs new | **code** `DiffPreview` |
| 7 | `Decision` | `item.statusTone/statusLabel`, `item.pending` | status + decision metadata | **code** — chip plus either approve/reject controls with a note `<Input>`, or the decided-by / review-note stack (`:239-266`) |

**Registry — 5 pure / 2 bespoke.**

**(b) Custom field schemas.** Four `<TableHead>` literals + one conditional,
`custom-fields-section.tsx:263-267`. Reads `custom_field_schemas`
(`schema/custom-field-schemas.ts:16-36`): `Table` ← `TABLE_OPTIONS.find(…)` over `.table_name`,
`Key` ← `.field_key`, `Label` ← `.field_label`, `Type` ← `FIELD_TYPE_OPTIONS.find(…)` over
`.field_type`, plus a demo-gated action column.
**Registry — 2 pure / 2 bespoke** (`Table` and `Type` are option-list lookups).

**(c) Child brands.** Two `<TableHead>` literals, `propagation-controls.tsx:74-75`.
`Child Brand` ← `brands.name`; `Status` ← `brands.status` in `font-mono`.
**Registry — 2 pure / 0 bespoke. EMPTY.**

> **Sequence this route last.** It is the admin surface for `custom_field_schemas` and will be the
> admin surface for `column_definitions` — it would be *administering* the resolver while being
> *driven* by it.

### team — `/app/team` — **no `tableKey`**

**Headers config-driven, labels only.** `TEAM_COLUMNS = ['Name', 'Role', 'Brands', 'Last active'] as const`
(`fields.ts:30`), mapped at `team-table.tsx:30-34`; `colSpan` reads `.length` (`:40`); cells `:52-92`
positional. No row click by design (`:8`).

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Name` | `item.fullName`, `item.email`, `item.external` | `users.full_name` `:18` + `.email` `:17` | **code** — two lines, plus a `CLIENT_ACCESS_NOTE` warn line when `external` (`:59-63`), which is PRD §10 |
| 2 | `Role` | `item.roles` | **linked** `brand_assignments` roles | `chipList` over a pre-resolved `{tone,label}[]`, in `data-slot="role-chip"` wrappers |
| 3 | `Brands` | `item.brands.{text,muted}` | **linked** `brand_assignments` → `brands.name`; an admin with no rows reads `ALL_BRANDS_LABEL` (`fields.ts:40`) | `text` `{mutedWhen:'brands.muted'}` |
| 4 | `Last active` | `item.lastActive` / `…Title` | **computed** over `users.last_active_at` `:20` | `text` `{mutedWhen:'neverActive'}` |

**Registry — 3 pure / 1 bespoke.** Not per-brand content, so the resolver has nothing to say about it.

### ugc (Partnerships tab) — `/app/ugc` — `tableKey: creators` **(collides with the Creators grid)**

**Headers config-driven, labels only.** `PARTNERSHIP_COLUMNS` (`ugc/fields.ts:329-336`) — `as const`
tuple of six bare strings, mapped at `partnership-table.tsx:47-51`; cells `:65-91` positional. Same
route as the Creators grid, different tab (`ugc-workspace.tsx:651-657`).

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Creator` | `row.name` | `creators.name` `:93` | `text` `{weight:'medium'}` |
| 2 | `Instagram Username` | `row.instagramUsername` | `.instagram_username` `:124` | `text` `{mono:true}` |
| 3 | `Activity` | `row.activityTone` / `row.activityLabel` | `.partnership_activity` `:126` | `chip` — pre-resolved |
| 4 | `Activated` | `row.activatedLabel` | **computed** over `.partnership_activated_at` `:129` | `text` `{mono:true}` |
| 5 | `Period` | `row.periodLabel` | **computed** over `.partnership_period_days` `:130` | `text` |
| 6 | `Countdown` | `row.countdownLabel`, `row.countdownTone` | **formula** — activation + period + extension, from `partnershipExpiry` in `@tas/domain/creators` | **code** — tone-mapped class, **and the row itself** carries `expiryRowClassName` / `expiryRowStyle` / `data-expiry-state` (`:60-63`) |

**Registry — 5 pure / 1 bespoke.** Two hard constraints:

1. **The `tableKey` collision.** `resolveColumns(db, brandId, 'creators')` returns one ordered list;
   this route renders two different tables over `creators`. Needs a view discriminator in
   `column_definitions` or a separate `tableKey`.
2. **No price column, on purpose.** `partnership_price_per_30_days` is internal data; the comment at
   `partnership-table.tsx:30-32` records the omission so nobody "fixes" it. A per-brand resolver that
   can add a column to this table must not be able to add that one.

### creator-ranking — `/app/creator-ranking` — **no `tableKey`**

Raw `<table>`. Eight `<th>` literals, `creator-leaderboard.tsx:43-50`; cells `:70-79`. **HARDCODED.**
`pgTable creator_rankings`: `schema/creator-rankings.ts:7-25`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Rank` | `MEDAL[ranking.rank] ?? '#n'` | `.rank` `:23` | **vocab** `medal` — a glyph for the top ranks, else `#n` (`:71`) |
| 2 | `Creator` | `ranking.creatorName` | `.creator_name` `:17` (**denormalised**; `.creator_id` `:14` is the FK) | `text` `{weight:'semibold'}` |
| 3 | `Ads` | `ranking.totalAds` | `.total_ads` `:18` | `monoNumber` |
| 4 | `Spend` | `spendLabel` | **computed** over `.total_spend` numeric `:19` | `metric` |
| 5 | `Conv.` | `ranking.totalConversions` | `.total_conversions` `:20` | `monoNumber` |
| 6 | `Avg ROAS` | `roasLabel` | **computed** over `.avg_roas` numeric `:21` | `metric` |
| 7 | `Avg CPA` | `cpaLabel` | **computed** over `.avg_cpa` numeric `:22` | `metric` |
| 8 | `Period` | `ranking.periodLabel` | `.period_label` `:24` | `text` `{tone:'muted'}` |

**Registry — 7 pure / 1 bespoke.** `{ rank: vocab('medal') }`.

### onboarding-forms — `/app/onboarding-forms` — **no `tableKey`**

Raw `<table>`. Five `<th>` literals, `onboarding-forms-table.tsx:41-45`; cells `:51-66`.
**HARDCODED.** `pgTable onboarding_forms`: `schema/onboarding-forms.ts:9-21`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Title` | `form.title`, `form.description` | `.title` `:16` + `.description` `:17` | **code** — two lines |
| 2 | `Status` | `form.status` | `.status` `:18` | **code** — **hand-rolled pill** from a local `STATUS_TONE` class map (`:11-15`), **not `StatusChip`**. **Breaks UI governance rule 3.** |
| 3 | `Fields` | `fieldCount` | **computed** — parsed from `.fields_json` `:19` | `monoNumber` |
| 4 | `Submissions` | `form.submissionsCount` | `.submissions_count` `:20` | `monoNumber` |
| 5 | `Share Token` | `form.shareToken` | `.share_token` `:21` | `text` `{mono:true}` |

**Registry — 3 pure / 2 bespoke.** Fix the pill before migrating, or the registry bakes a governance
violation into the config layer.

### performance — `/app/performance` — **no `tableKey`**

Raw `<table>`. Nine `<th>` literals, `performance-tracker.tsx:105-113`; cells from `:144`.
**HARDCODED.** `pgTable ad_metrics`: `schema/ad-metrics.ts:8-28`. Every cell is a server-formatted
label in a span.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Ad` | `metric.adName` | `.ad_name` `:18` | `text` `{mono:true, truncate:true}` |
| 2 | `Spend` | `spendLabel` | **computed** over `.spend` numeric `:19` | `metric` |
| 3 | `Impr.` | `impressionsLabel` | **computed** over `.impressions` `:20` | `metric` |
| 4 | `Clicks` | `clicksLabel` | **computed** over `.clicks` `:21` | `metric` |
| 5 | `Conv.` | `conversionsLabel` | **computed** over `.conversions` `:22` | `metric` |
| 6 | `CTR` | `ctrLabel` | **computed** over `.ctr` numeric `:23` | `metric` |
| 7 | `CPC` | `cpcLabel` | **computed** over `.cpc` numeric `:24` | `metric` |
| 8 | `CPA` | `cpaLabel` | **computed** over `.cpa` numeric `:25` | `metric` |
| 9 | `ROAS` | `roasLabel` | **computed** over `.roas` numeric `:26` | `metric` `{weight:'semibold'}` |

**Registry — 9 pure / 0 bespoke. EMPTY.** The cleanest registry in the app, behind a raw `<table>`.
`.meta_ad_id` `:17` and `.date_range` `:27` stored, not displayed.

### upload-links — `/app/upload-links` — **no `tableKey`**

Raw `<table>`. Six `<th>` literals, `upload-links-table.tsx:39-44`; cells `:50-68`. **HARDCODED.**
`pgTable upload_links`: `schema/upload-links.ts:6-22`.

| # | Header | Reads | Origin | Renderer |
| --- | --- | --- | --- | --- |
| 1 | `Label` | `link.label` | `.label` `:14` | **code** — `Link` to `uploadLinkPath(link.id)`; a **constructed** href, which `url` cannot express |
| 2 | `Recipient` | `link.recipientName` | `.recipient_name` `:15` | `text` |
| 3 | `Usage` | `usageLabel` | **computed** over `.uploads_used` `:20` and `.max_uploads` `:17` | `text` |
| 4 | `Expires` | `expiresLabel` | **computed** over `.expires_at` `:18` | `text` `{tone:'muted'}` |
| 5 | `Status` | `link.isActive` | `.is_active` `:19` | **code** — **hand-rolled pill** (`:59-66`), **not `StatusChip`**. **Breaks UI governance rule 3.** |
| 6 | `Token` | `link.token` | `.token` `:13` | `text` `{mono:true}` |

**Registry — 4 pure / 2 bespoke.** Column 1 is the repo's only truly **constructed** href and the one
case the task's phrase "a link that needs an href builder" describes literally. Note the raw `'—'`
literal at `:58`, bypassing even this module's own sentinel.

### Not counted: `creative-design/[briefId]` brief scripts — 3 columns

`brief-detail.tsx:820-859`, `<Table data-slot="brief-scripts-table">`. Three `<TableHead>` literals
at `:823-825`: `Script` (truncated text), `Kind` (`script.kind`), `Status`. A record table the
earlier audit omitted. On a detail route, so it is outside the 267 — but it is a real hardcoded
column definition and would drift the same way.

---

## Migration cost

The drivers, in order of weight. Note that **column count is nearly irrelevant** and the ordering
runs against intuition: concepts, the 21-column table, is the single cheapest; creative-sheet, at 7,
is hard.

1. **Does `resolveColumns` have a `tableKey` for the table at all?** Ten tables (59 columns) do not.
   No amount of renderer work helps them.
2. **Cell/header coupling.** Every table in groups B and C renders **positional** cells with no
   column key. Reordering such a table's headers reorders the headers **only** — the data stays put.
   Keying the cells is a prerequisite, not a refinement; without it a per-brand reorder is a silent
   data-corruption bug rather than a layout change. **17 of 32 tables are in this state.**
3. **Does the page import `grid-cells`?** Nine of fifteen grid pages do not, and each has rolled its
   own dash, metric and chip helpers. Adopting the library is a prerequisite step the earlier audit
   did not price.
4. **Bespoke renderer count** — how many entries the page's registry must hold.
5. **Virtual columns.** Seven displayed columns have no Postgres column at all: creative-reporting
   `Difference CPA`, email-campaigns `Design due` / `Copywriting due`, email-flows `Design due` /
   `Copywriting due`, sm-campaign-feed `Reminder`, creative-sheet `Name`. `column_definitions.column_key`
   is `text` with no constraint, so it *can* hold a formula name — but nothing records that it is one.
6. **Non-negotiable exposure.** `column_definitions` has `isHidden` and no client/internal axis.
   ugc's four money columns (22-24, 30) and the deliberately-absent partnership price are bounded
   today only by the fact that no resolver drives them. Policy work, not plumbing.

### Tier 1 — land the resolver here (has a `tableKey`, imports `grid-cells`, `view=`-controlled)

| Rank | Page | Cols | Pure / Bespoke | Registry | Why |
| --- | --- | --- | --- | --- | --- |
| 1 | **personas** `/app/personas` | 7 | 6 / 1 | 1 entry | Already spreads `PERSONA_FIELDS`; `PERSONA_FIELD_GROUPS` is the payload shape already; `PERSONA_HIDDEN_FIELDS` is a hand-written visibility list whose own comment now names `column_definitions` as its replacement. Zero composites. **This is column inheritance done by hand for one brand.** |
| 2 | **concepts** `/app/concepts` | 21 | **21 / 0** | **empty** | Every renderer is a primitive over a server-resolved value. Widest grid, zero registry. Also lets the migration delete the dead `CONCEPT_COLUMNS`. |
| 3 | **angles** `/app/angles` | 17 | 15 / 2 | 2 vocabularies | No composites at all; four of its six chips carry a constant tone. |
| 4 | **products** `/app/products` | 10 | 9 / 1 | `badgeName` | Five `count` columns whose only datum is an English noun. |
| 5 | **ugc (Creators)** `/app/ugc` | 33 | 26 / 7 | 1 code + 5 vocabs | Counter-intuitive: the widest table has one true one-off (the avatar). Blocked on the `creators` `tableKey` collision with Partnerships and on the money-visibility bound. |
| 6 | **themes** `/app/themes` | 10 | 7 / 3 | 1 code + 2 vocabs | Cheap per renderer, but **it is a global table with no `tableKey`** — needs its own inheritance rule first. Sequence the decision before the code. |

### Tier 2 — has a `tableKey`, needs `grid-cells` adopted and/or cells keyed

| Rank | Page | Cols | Pure / Bespoke | Blocker |
| --- | --- | --- | --- | --- |
| 7 | **creative-reporting** | 12 | 11 / 1 | needs the `metric` primitive; `Difference CPA` is virtual |
| 8 | **youtube-copywriting** | 10 | 8 / 2 | no `grid-cells`; header/cell mismatch on `Copy #` |
| 9 | **copy-types** | 5 | 2 / 3 | no `grid-cells`; `badgeName` + one shared vocabulary |
| 10 | **creative-modules** | 5 | 2 / 3 | identical in shape to copy-types |
| 11 | **collections** | 6 | 5 / 1 | positional cells to key; four FK names already joined server-side |
| 12 | **creative-dimensions** | 4 | 3 / 1 | positional cells to key |
| 13 | **competitive-research** | 5 | 3 / 2 | **nearest to done** — the list already carries keys; make the cells read them |
| 14 | **ai-characters** | 4 | 3 / 1 | no column array at all; nine hidden columns give the resolver real work |
| 15 | **campaigns-offers** | 11 | 10 / 1 | eleven literal heads and eleven positional cells; join `productName` server-side |
| 16 | **email-flows** | 9 | 6 / 3 | no `grid-cells`; two virtual formula dates |
| 17 | **sm-campaign-feed** | 7 | 4 / 3 | no `grid-cells`; `Reminder` is virtual |
| 18 | **email-campaigns** | 12 | 8 / 4 | no `grid-cells`; two virtual dates whose provenance lives only in a `cellTitle` literal |
| 19 | **client-assets** | 5 | 2 / 3 | fold keydown + `slot` into `LinkCell` first, then it is 3 / 2 |

### Tier 3 — hard, or wrong abstraction

| Rank | Page | Cols | Pure / Bespoke | Why |
| --- | --- | --- | --- | --- |
| 20 | **creative-design** | 6 | 5 / 1 | Six displayed over **57 stored**. The "add a column" path has 51 candidates and no per-brand record of which a brand wants. `Priority` is a chip + SLA composite. |
| 21 | **creative-sheet** | 7 | 3 / 4 | `QA` is **one header over three stored booleans**; `Name` is a formula with **no `name` column on the table**. The array is also `export`ed and mounted by a design-system story, so the story is a second consumer to keep green. |
| 22 | **meta-copywriting** | 6 | 3 / 3 | Column 1 stacks a generated title and a stored headline in one cell, deliberately, citing PRD §5.11 — no 1:1 mapping and the ticket forbids splitting it. Plus a stale "four columns" comment. |
| 23 | **performance** | 9 | **9 / 0** | Zero bespoke renderers, but a **raw `<table>` with no `tableKey`**. Bring it onto `AirtableGrid` and give `ad_metrics` a key and it becomes Tier 1 outright. |
| 24 | **creator-ranking** | 8 | 7 / 1 | raw `<table>`, no `tableKey` |
| 25 | **team** | 4 | 3 / 1 | no `tableKey`; not per-brand content |
| 26 | **upload-links** | 6 | 4 / 2 | raw `<table>`, no `tableKey`, **and** a hand-rolled pill. Fix the pill first. |
| 27 | **onboarding-forms** | 5 | 3 / 2 | same pill problem, plus a two-line composite title |
| 28 | **propagation** (3 tables) | 13 | 9 / 4 | No `tableKey` for any of the three, and the route would be *administering* the resolver while being *driven* by it. **Sequence last.** |
| 29 | **notifications** | 4 | 2 / 2 | Already the most config-driven table, but a settings matrix of interactive `<Switch>`es. **Recommend excluding.** |
| — | ad-spy, assets, queue/client, queue/internal, concepts (Board) | — | — | Card and kanban surfaces with no column definitions. Out of scope until the resolver has a card-field concept. Kanban columns are **statuses**, which is a different feature. |

### The cost in one paragraph

> The resolver exists and nothing reads it. A label, an order and a visibility flag are already data
> in `column_definitions`; `ResolvedColumn` carries them plus `fieldType`. **204 of the 267 displayed
> columns (76%) reduce to `{renderer, path, params}` with no code at all**, and `fieldType` can pick
> the renderer for most of them. Of the 63 that need a registry entry, **11 are the same composite**
> (a frozen name beside `<PropagationBadge>` — add one `badgeName` renderer and the surface becomes
> 215 / 52, or 81% data), **34 are vocabulary chips** needing **27** named references rather than 34
> functions, and only **18 are true one-offs**. So the registry is about **46 entries and 5 new
> primitives**, not 267. The real work is three things the renderer count hides: (a) **ten tables,
> 59 columns, have no `tableKey`** in `PROPAGATION_TABLES`, and `themes` cannot have one because it
> is global by constraint; (b) **17 of 32 tables render positional cells with no key**, which must be
> keyed before any reorder is safe; (c) **nine of fifteen grid pages have not adopted
> `grid-cells.tsx`** and each carries its own dash, metric and chip helpers — 25 declarations of the
> same em-dash. Land it on personas and concepts, where the registry is one entry and zero.

---

## Duplicated labels

Every duplicate is a place where a relabel lands in one surface and not the other — and the owner's
goal is one label, in data, read by everything.

### The headline number

Across `/app/app`, `/app/client` and `/app/(dev)/design-system`, the 267 + 28 + 11 displayed columns
are written with **185 distinct header strings**, and **46 of those strings are written in more than
one file**:

| Written in | Header string |
| --- | --- |
| **23 files** | `Name` |
| **17 files** | `Status` |
| **17 files** | `Updated` |
| 7 | `Type` |
| 5 | `Description`, `Product` |
| 4 | `Angles`, `Assignee`, `Winning` |
| 3 | `Angle`, `Category`, `Funnel`, `Internal Status`, `Persona`, `Platform`, `Used` |
| 2 | `Active`, `Ad Inspo`, `Ads End`, `Ads Launch`, `Batch`, `CPA`, `Collection link`, `Concept`, `Conv.`, `Copywriting due`, `Creative`, `Creator`, `Creators`, `Design due`, `Formats to create`, `Gender`, `Holiday`, `Instagram Username`, `Label`, `Landing page URL`, `Notes`, `Official Date`, `Pain Points`, `Period`, `Product name`, `ROAS`, `Spend`, `Table`, `Theme`, `USP` |

`'Name'`, in all 23 places:

```
app/ai-characters/ai-characters-workspace.tsx:160   app/personas/personas-workspace.tsx:104
app/angles/angles-workspace.tsx:137                 app/team/fields.ts:30
app/campaigns-offers/campaigns-workspace.tsx:220    app/themes/themes-workspace.tsx:122
app/collections/collections-workspace.tsx:201       app/ugc/ugc-workspace.tsx:115
app/competitive-research/fields.ts:95               client/[brandSlug]/angles/page.tsx:38
app/concepts/concepts-workspace.tsx:123             client/[brandSlug]/briefs/page.tsx:38
app/copy-types/copy-types-workspace.tsx:73          client/[brandSlug]/calendar/page.tsx:37
app/creative-design/fields.ts:95                    client/[brandSlug]/concepts/page.tsx:38
app/creative-dimensions/creative-dimensions-workspace.tsx:156  client/[brandSlug]/themes/page.tsx:38
app/creative-sheet/creative-sheet-workspace.tsx:121 client/[brandSlug]/ugc/page.tsx:38
app/email-campaigns/email-campaigns-workspace.tsx:107  (dev)/design-system/airtable-grid.stories.tsx:61
                                                       (dev)/design-system/page.tsx:671
```

### A — exact duplicate: grid/table header vs the same module's panel field label (53)

Re-derived programmatically, not transcribed. Each row is one string written twice in one module.

| # | Module | Label | Header | Panel field label |
| --- | --- | --- | --- | --- |
| 1 | ai-characters | `Basic Info` | `ai-characters-workspace.tsx:162` | `fields.ts:102` |
| 2 | ai-characters | `Status` | `ai-characters-workspace.tsx:161` | `fields.ts:80` |
| 3 | angles | `Brief URL` | `angles-workspace.tsx:250` | `fields.ts:406` |
| 4 | angles | `Client Notes` | `angles-workspace.tsx:265` | `fields.ts:366` |
| 5 | angles | `Description` | `angles-workspace.tsx:232` | `fields.ts:389` |
| 6 | angles | `Exact Script URL` | `angles-workspace.tsx:255` | `fields.ts:409` |
| 7 | angles | `Internal Notes` | `angles-workspace.tsx:260` | `fields.ts:361` |
| 8 | angles | `Pain Points` | `angles-workspace.tsx:238` | `fields.ts:396` |
| 9 | angles | `Potential` | `angles-workspace.tsx:184` | `fields.ts:350` |
| 10 | angles | `USP` | `angles-workspace.tsx:241` | `fields.ts:400` |
| 11 | campaigns-offers | `Code` | `campaigns-workspace.tsx:223` | `fields.ts:37` |
| 12 | campaigns-offers | `Holiday` | `campaigns-workspace.tsx:221` | `fields.ts:30` |
| 13 | campaigns-offers | `Launched` | `campaigns-workspace.tsx:228` | `fields.ts:79` |
| 14 | campaigns-offers | `Official Date` | `campaigns-workspace.tsx:224` | `fields.ts:45` |
| 15 | campaigns-offers | `Product` | `campaigns-workspace.tsx:229` | `fields.ts:110` |
| 16 | client-assets | `Description` | `client-assets-workspace.tsx:99` | `fields.ts:40` |
| 17 | client-assets | `Location` | `client-assets-workspace.tsx:111` | `fields.ts:47` |
| 18 | collections | `Campaign` | `collections-workspace.tsx:203` | `fields.ts:69` |
| 19 | collections | `URL` | `collections-workspace.tsx:202` | `fields.ts:63` |
| 20 | copy-types | `Description` | `copy-types-workspace.tsx:89` | `fields.ts:42` |
| 21 | copy-types | `Name` | `copy-types-workspace.tsx:73` | `fields.ts:35` |
| 22 | creative-dimensions | `Dimensions` | `creative-dimensions-workspace.tsx:157` | `fields.ts:32` |
| 23 | creative-dimensions | `Link Description` | `creative-dimensions-workspace.tsx:158` | `fields.ts:38` |
| 24 | creative-dimensions | `Name` | `creative-dimensions-workspace.tsx:156` | `fields.ts:26` |
| 25 | creative-reporting | `CPA` | `creative-reporting-workspace.tsx:131` | `fields.ts:128` |
| 26 | creative-reporting | `Creative` | `creative-reporting-workspace.tsx:99` | `fields.ts:63` |
| 27 | creative-reporting | `Name + Angle + Offer` | `creative-reporting-workspace.tsx:83` | `fields.ts:58` |
| 28 | creative-reporting | `ROAS` | `creative-reporting-workspace.tsx:158` | `fields.ts:146` |
| 29 | creative-reporting | `Results` | `creative-reporting-workspace.tsx:124` | `fields.ts:115` |
| 30 | creative-reporting | `Target CPA` | `creative-reporting-workspace.tsx:138` | `fields.ts:137` |
| 31 | creative-reporting | `Target ROAS` | `creative-reporting-workspace.tsx:165` | `fields.ts:155` |
| 32 | creative-sheet | `Used` | `creative-sheet-workspace.tsx:159` | `fields.ts:144` |
| 33 | email-campaigns | `Assignee` | `email-campaigns-workspace.tsx:161` | `fields.ts:83` |
| 34 | email-campaigns | `Campaigns & Offers` | `email-campaigns-workspace.tsx:179` | `fields.ts:147` |
| 35 | email-campaigns | `Channel` | `email-campaigns-workspace.tsx:135` | `fields.ts:75` |
| 36 | email-campaigns | `Name` | `email-campaigns-workspace.tsx:107` | `fields.ts:61` |
| 37 | email-campaigns | `Status` | `email-campaigns-workspace.tsx:123` | `fields.ts:73` |
| 38 | email-campaigns | `Type` | `email-campaigns-workspace.tsx:129` | `fields.ts:74` |
| 39 | email-flows | `Assignee` | `email-flows-workspace.tsx:210` | `fields.ts:79` |
| 40 | email-flows | `Status` | `email-flows-workspace.tsx:157` | `fields.ts:78` |
| 41 | email-flows | `Type` | `email-flows-workspace.tsx:168` | `fields.ts:77` |
| 42 | personas | `Name` | `personas-workspace.tsx:104` | `fields.ts:59` |
| 43 | personas | `Problem-Solution Awareness Level` | `personas-workspace.tsx:121` | `fields.ts:64` |
| 44 | sm-campaign-feed | `Notes` | `sm-campaign-feed-workspace.tsx:145` | `fields.ts:48` |
| 45 | sm-campaign-feed | `Platform` | `sm-campaign-feed-workspace.tsx:98` | `fields.ts:43` |
| 46 | sm-campaign-feed | `Status` | `sm-campaign-feed-workspace.tsx:123` | `fields.ts:45` |
| 47 | youtube-copywriting | `CTA` | `youtube-copywriting-workspace.tsx:125` | `fields.ts:297` |
| 48 | youtube-copywriting | `Descriptions` | `youtube-copywriting-workspace.tsx:111` | `fields.ts:289` |
| 49 | youtube-copywriting | `Funnel` | `youtube-copywriting-workspace.tsx:131` | `fields.ts:304` |
| 50 | youtube-copywriting | `Headline` | `youtube-copywriting-workspace.tsx:104` | `fields.ts:286` |
| 51 | youtube-copywriting | `Status` | `youtube-copywriting-workspace.tsx:119` | `fields.ts:309` |
| 52 | youtube-copywriting | `Used` | `youtube-copywriting-workspace.tsx:137` | `fields.ts:310` |
| 53 | youtube-copywriting | `Winning` | `youtube-copywriting-workspace.tsx:143` | `fields.ts:311` |

**Personas is the exception that proves the rule.** Columns 2-5 spread `PERSONA_FIELDS`, so the grid
header and the panel label are the same string from the same place — the comment at
`personas-workspace.tsx:110-111` says exactly that. Columns 1 and 6 do not spread, which is the only
reason `Name` and `Problem-Solution Awareness Level` are on this list at all.

> The earlier audit's class A said 56. Two of its rows (`Instagram Username` ugc, `Table`
> propagation) are header-vs-**header** across two tables on one route, not header-vs-panel-label, and
> its count was one above its own list. **53 + 2 = 55.**

### B — exact duplicate across the internal and client surfaces (19)

| Label | Internal | Client |
| --- | --- | --- |
| `Name` | `app/angles/angles-workspace.tsx:137` | `client/[brandSlug]/angles/page.tsx:38` |
| `Description` | `app/angles/angles-workspace.tsx:232` | `client/[brandSlug]/angles/page.tsx:39` |
| `Winning` | `app/angles/angles-workspace.tsx:201` | `client/[brandSlug]/angles/page.tsx:42` |
| `Name` | `app/creative-design/fields.ts:95` | `client/[brandSlug]/briefs/page.tsx:38` |
| `Type` | `app/creative-design/fields.ts:97` | `client/[brandSlug]/briefs/page.tsx:39` |
| `Name` | `app/campaigns-offers/campaigns-workspace.tsx:220` | `client/[brandSlug]/calendar/page.tsx:37` |
| `Holiday` | `app/campaigns-offers/campaigns-workspace.tsx:221` | `client/[brandSlug]/calendar/page.tsx:38` |
| `Official Date` | `app/campaigns-offers/campaigns-workspace.tsx:224` | `client/[brandSlug]/calendar/page.tsx:39` |
| `Ads Launch` | `app/campaigns-offers/campaigns-workspace.tsx:225` | `client/[brandSlug]/calendar/page.tsx:40` |
| `Ads End` | `app/campaigns-offers/campaigns-workspace.tsx:226` | `client/[brandSlug]/calendar/page.tsx:41` |
| `Name` | `app/concepts/concepts-workspace.tsx:123` | `client/[brandSlug]/concepts/page.tsx:38` |
| `Batch` | `app/concepts/concepts-workspace.tsx:135` | `client/[brandSlug]/concepts/page.tsx:39` |
| `Angle` | `app/concepts/concepts-workspace.tsx:146` | `client/[brandSlug]/concepts/page.tsx:40` |
| `Theme` | `app/concepts/concepts-workspace.tsx:164` | `client/[brandSlug]/concepts/page.tsx:41` |
| `Name` | `app/themes/themes-workspace.tsx:122` | `client/[brandSlug]/themes/page.tsx:38` |
| `Category` | `app/themes/themes-workspace.tsx:134` | `client/[brandSlug]/themes/page.tsx:39` |
| `Active` | `app/themes/themes-workspace.tsx:204` | `client/[brandSlug]/themes/page.tsx:40` |
| `Name` | `app/ugc/ugc-workspace.tsx:115` | `client/[brandSlug]/ugc/page.tsx:38` |
| `Gender` | `app/ugc/ugc-workspace.tsx:168` | `client/[brandSlug]/ugc/page.tsx:39` |

> **The earlier audit found 12 of these and missed 7**: it did not look at
> `client/[brandSlug]/briefs/page.tsx` (2) or `client/[brandSlug]/calendar/page.tsx` (5).

Plus four cross-surface **near**-duplicates it also missed — the same field, drifted:

| Field | Internal | Client |
| --- | --- | --- |
| `angle_personas` link | `Persona` (`angles-workspace.tsx:145`) | **`Personas`** (`client/.../angles/page.tsx:40`) |
| `angle_products` link | `Product` (`angles-workspace.tsx:160`) | **`Products`** (`client/.../angles/page.tsx:41`) |
| `creators.age_bracket` | `Age Bracket` (`ugc-workspace.tsx:174`) | **`Age`** (`client/.../ugc/page.tsx:40`) |
| the client track | `Client Status` (`ugc-workspace.tsx:152`, a computed template string) | **`Status`** (`client/.../ugc/page.tsx:42`) |

**These are the worst class, and for a reason that matters more than the count.** All six client
pages are hardcoded `<TableHead>` literals. Meanwhile `clientVisibleFields`
(`packages/db/src/client-queries.ts:470-497`) **already returns the per-brand `fieldName`, `label`
and `clientEditable`, ordered by `interfaceFields.position`, filtered to `visible = true`** — exactly
the resolver contract, for the client surface, shipped since migration 0012. Its only callers are
`packages/db/src/client-queries.test.ts` and the barrel export at `packages/db/src/index.ts:214`.

> **The one query in the repo that returns per-brand column labels is dead code, and the pages that
> should use it write their headers by hand.** Collapsing the client surface onto it is the single
> cheapest proof that label-as-data works, and it needs no new table at all.

### C — near-duplicate, already drifted: same field, different capitalisation (15 + 1)

The strongest argument for collapsing labels into one source: these have **already** fallen out of
sync, silently. Re-derived programmatically; identical to the earlier audit's list, which was right.

| Field | Grid header | Panel label |
| --- | --- | --- |
| `client_asset_folders.name` | `Folder name` (`client-assets-workspace.tsx:83`) | `Folder Name` (`client-assets/fields.ts:33`) |
| `creative_modules.module_name` | `Module name` (`creative-modules-workspace.tsx:83`) | `Module Name` (`creative-modules/fields.ts:31`) |
| `creative_modules.foreplay_link` | `Foreplay link` (`creative-modules-workspace.tsx:99`) | `Foreplay Link` (`creative-modules/fields.ts:37`) |
| `creative_reporting.ad_link` | `Ad link` (`creative-reporting-workspace.tsx:172`) | `Ad Link` (`creative-reporting/fields.ts:85`) |
| `creative_reporting.ctr` | `CTR (%)` (`creative-reporting-workspace.tsx:110`) | `CTR` (`creative-reporting/fields.ts:97`) |
| `creative_reporting.thumb_stop_rate` | `Thumb-stop rate` (`creative-reporting-workspace.tsx:117`) | `Thumb-Stop Rate` (`creative-reporting/fields.ts:106`) |
| `email_campaigns.send_date` | `Send date` (`email-campaigns-workspace.tsx:141`) | `Send Date` (`email-campaigns/fields.ts:78`) |
| `email_campaigns.copy_link` | `Copy link` (`email-campaigns-workspace.tsx:173`) | `Copy Link` (`email-campaigns/fields.ts:98`) |
| `email_flows.flow_name` | `Flow name` (`email-flows-workspace.tsx:141`) | `Flow Name` (`email-flows/fields.ts:65`) |
| `email_flows.expected_setup_date` | `Expected setup date` (`email-flows-workspace.tsx:179`) | `Expected Setup Date` (`email-flows/fields.ts:87`) |
| `email_flows.klaviyo_link` | `Klaviyo link` (`email-flows-workspace.tsx:216`) | `Klaviyo Link` (`email-flows/fields.ts:106`) |
| `products.name` | `Product name` (`products-workspace.tsx:131`) | `Product Name` (`products/fields.ts:53`) |
| `products.link` | `Landing page URL` (`products-workspace.tsx:147`) | `Landing Page URL` (`products/fields.ts:59`) |
| `products.collection_link` | `Collection link` (`products-workspace.tsx:154`) | `Collection Link` (`products/fields.ts:65`) |
| `youtube_copy.meta_rating` | `Meta rating` (`youtube-copywriting-workspace.tsx:149`) | `Meta Rating` (`youtube-copywriting/fields.ts:314`) |

Plus one drift that is not a case difference: `angles.name` is `Name` in the grid
(`angles-workspace.tsx:137`) and **`Angle Name`** in the panel (`angles/fields.ts:382`).

### D — a column list that duplicates nothing because nothing renders it

`CONCEPT_COLUMNS` (`concepts/fields.ts:264-272`) — seven strings, consumed only by
`concepts/fields.test.ts:182` and named in a comment at `concepts-workspace.tsx:116`. The page
renders `CONCEPT_GRID_COLUMNS`'s 21 columns. **The most dangerous entry in this section:** a reader
looking for "the concepts columns" finds a list that is wrong, and a test that keeps it green.

### E — third and fourth copies inside the design-system (11 strings, 2 files)

| File | Headers written | Duplicates |
| --- | --- | --- |
| `design-system/page.tsx:470-472` | `Creative`, `Brand status`, `Internal status` | `Creative` exact (creative-reporting:99); **`Internal status` is case-drifted** from `Internal Status` (concepts:170, creative-sheet:141, `creative-design/fields.ts:100`) |
| `design-system/page.tsx:630-633` | `Product name`, `Landing page URL`, `Collection link`, `Linked concepts` | first three exact (products:131, :147, :154); **`Linked concepts` is case-drifted** from ugc's `Linked Concepts` (:218) |
| `design-system/page.tsx:671-674` | `Name`, `Persona`, `Product`, `Formats` | first three exact (angles:137, :145, :160); **`Formats` is a truncation** of `Formats to create` (:208) |
| `design-system/airtable-grid.stories.tsx:61, :69, :91` | `Name`, `Status`, `Updated` | the three most-repeated strings in the repo, written a 23rd / 17th / 17th time |

> The earlier audit found 2 of these. There are **11 header strings across two design-system files**,
> three of which have already drifted in case or truncation from the route they illustrate.
> **Two stories do it right** and are the pattern a resolver makes mandatory:
> `creative-sheet.stories.tsx:116` imports the route's own `CREATIVE_SHEET_COLUMNS`, and
> `notifications.stories.tsx` mounts the route's own `NotificationTable`, whose comment at `:54`
> states the intent: *"so no §12 string is written in this file."*

### F — the sentinel, not a label: 25 declarations of the same em-dash

Not a header string, but the same class of drift risk and the resolver collapses it the same way:

```
21x  export const EM_DASH = '—'    ai-characters:116  angles:42  campaigns-offers:119
                                   client-assets:55  collections:106  competitive-research:103
                                   concepts:70  copy-types:50  creative-design:69
                                   creative-dimensions:51  creative-modules:44
                                   creative-reporting:171  creative-sheet:35  email-campaigns:278
                                   email-flows:261  interface-config:24  meta-copywriting:54
                                   personas:119  products:72  queue/internal:26
                                   sm-campaign-feed:56  youtube-copywriting:45
 1x  export const EMPTY_FIELD = '—'          themes/fields.ts:245
 1x  export const GRID_EMPTY = '—'           components/views/grid-cells.tsx:15
 1x  export const UNSET_LABEL = '—'          packages/domain/src/creators/vocabulary.ts:80
 1x  export const EM_DASH = UNSET_LABEL      ugc/fields.ts:80
```

Plus raw `'—'` literals that bypass even their own module's constant:
`upload-links-table.tsx:58`, `ad-spy/page.tsx:13`, `creator-ranking/page.tsx:16-17`,
`performance/page.tsx:23-26`.

### What is *not* duplicated: the CSV templates

The task asks about grid-vs-CSV-export label drift. **There is none, and the reason is worth
recording.** Only two CSV column lists exist in the repo —
`PRODUCT_CSV_COLUMNS = ['name', 'link', 'collection_link']` (`packages/db/src/demo-data.ts:192`) and
`EMAIL_FLOW_CSV_COLUMNS` (`apps/web/src/app/app/email-flows/fields.ts:145-157`, eleven entries) —
and **both carry snake_case database column names, not display headers**, deliberately:
*"snake_case as a spreadsheet exported from Airtable carries them"* (`email-flows/fields.ts:141`).
So a relabel cannot drift into a CSV template.

> Separately, and outside my remit: CLAUDE.md non-negotiable 9 requires a CSV template **per table**
> in V1. Two tables of 21 have one.

### Totals

| Class | Count | vs. earlier audit |
| --- | --- | --- |
| Distinct header strings across all three surfaces | **185** | not reported |
| Header strings written in more than one **file** | **46** | not reported |
| A — exact, grid vs same-module panel label | **53** | said 56; its list had 55, two of them header-vs-header |
| B — exact, internal vs client surface | **19** | said 12; missed `client/briefs` (2) and `client/calendar` (5) |
| B′ — near-duplicate across surfaces | **4** | not reported |
| C — near-duplicate, already drifted | **15** (+1 non-case) | **15 — confirmed exactly, anchors identical** |
| D — list that renders nowhere | **1** (`CONCEPT_COLUMNS`, 7 strings) | 1 — confirmed |
| E — design-system copies | **11 strings in 2 files**, 3 already drifted | said 2 |
| F — em-dash sentinel declarations | **25** | not reported |

---

## What I could not establish

Stated plainly, because inferring any of it would make this document misleading.

1. **Whether `column_definitions` holds any rows.** There is no `psql` on this machine and I did not
   run a database query. The table and its migration exist in source
   (`packages/db/drizzle/0045_column-inheritance.sql`, journal `idx: 45`); whether `0045` has been
   **applied to production**, and whether any base has been seeded, I do not know. A page wired to
   `resolveColumns` against an unseeded base renders zero columns, so this gates every migration
   below. Sibling A/B hold this half.
2. **Whether any header string matches the Airtable field name** in the `Creative Hub Template` base
   or in Gratsi's. This is a source-code audit; I did not call the Airtable API. The one place the
   repo asserts such a match is `personas-workspace.tsx:95-100` and `personas/fields.ts:50-53`, citing
   `docs/decisions/gratsi-display-spec-2026-10-02.md`. **I report that the files say so, not that it
   is true.**
3. **How `themes` should inherit.** The table is global by check constraint
   (`schema/themes.ts:33`) and absent from `PROPAGATION_TABLES`, so `resolveColumns` has no key for
   it and there is no per-brand row to detach. I state the problem; I do not have the answer, and
   nothing in the shipped resolver or its 294-line test file addresses it.
4. **How the `creators` `tableKey` collision should be resolved.** Two tables on one route render one
   `tableKey`. The resolver returns one ordered list. I did not find a discriminator in
   `column_definitions`, `resolveColumns` or the tests, and I did not invent one.
5. **Whether `custom_field_schemas` and `column_definitions` should coexist.**
   `schema/custom-field-schemas.ts:16-36` stores `brandId`, `tableName`, `fieldKey`, `fieldType`,
   `fieldLabel`, `sortOrder` — nearly the same payload. `column_definitions`'s own comment
   (`schema/column-definitions.ts:21-23`) notes that it chose `integer` for `displayOrder` *because*
   `custom_field_schemas.sort_order` is text and therefore orders `'10'` before `'2'`. So the new
   table knows about the old one, but nothing in source says whether the old one is to be migrated,
   kept beside it, or dropped. Not my call to make.
6. **The pure-data / bespoke split is my judgement, not a property in the source.** `GridColumn` has
   no `kind` field. I stated my rule and my adjudications above, listed the four tables where I
   differ from the earlier audit and why, and quantified the gap at 8 columns of 267. The `file:line`
   anchors are exact; the bucket assignments are arguable and should be re-checked per page at
   migration time.
7. **I did not verify that the 267 columns all render at runtime.** I read source. A column hidden by
   a user view (`user_table_views`, `packages/db/src/schema/user-table-views.ts:15`), by the grid's
   own `localStorage` Fields menu (`airtable-grid.tsx:135-143`), or by a demo flag may not be on
   screen for a given viewer. The count is of definitions, not of pixels.
8. **I counted one column per header.** Where one cell renders more than one stored field —
   creative-sheet `QA` (3 booleans), meta-copywriting `Copy title / Headline` (2 values), ugc `Name`
   (2 properties) — I counted **one**, because one header renders. A field-level count would be
   higher and I did not compute it.
