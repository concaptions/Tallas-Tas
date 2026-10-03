# Column-system rollout — report, 2026-10-03

Five named tables, the shared groundwork, and production. Every number below was read off a command.

## Per table

| Table | State | Commit | Columns after (inheriting / Gratsi) |
| --- | --- | --- | --- |
| Products | **DONE** | `600a230` | 12 / 9 |
| Angles | **DONE** | `8f7f0b2` | 16 / 11 |
| Concepts | **DONE** | `5eb9582` | 22 / 20 |
| Themes | **STUCK — by decision** | `14af7f3` (doc) | n/a, deliberately outside the resolver |
| UGC Management (`creators`) | **DONE** | `12e086f` | 36 / 34 |
| — shared groundwork | DONE | `be3713b` | one loader, one notices component |
| — seed reconciliation | DONE | `38983fe` | found by applying to production |

Each of the four migrated pages passes the grep proof: no `GridColumn<` array and **zero** `header:`
strings left in its workspace. Labels, order and visibility are data; the registries say only how a
cell is drawn.

## The one bug that was in every table

`COLUMN_SEED` was read off the two Airtable bases, so it only ever described Airtable FIELDS. Three
of the four tables had columns the page draws for **every** brand seeded as Gratsi-only `custom`
rows — so switching a page to the resolver would have silently deleted them on Niagara, Mattress
Central, Funky Painting and demo mode, while Gratsi kept them:

| Table | Columns that would have vanished |
| --- | --- |
| Products | 8 of 10 — only `name` and `link` were seeded at all |
| Angles | 9 — Status (migration 0039), Potential, Winning, Formats, Ad Inspo, Brief, Exact Script, Internal Notes, Client Notes |
| Concepts | 8 — Theme, Description, Pain Points, USP, Product, Persona, Client Comments, Collection |
| UGC | 5 — Creator Cost, Paid by TAS, Payment Date, Creator Info Request, Slack Notified |

All thirty are `source: 'platform'` rows on the parent now, because the parent BASE defines a field
for none of them. Gratsi keeps its own wording through `relabel-platform`, a child kind added because
`childRows` was writing `source: 'parent'` for every relabel — which would have transferred
ownership of a platform column just by renaming it, the same hole `sourceForWrite` closes on the
admin's write path.

## Production

- **No migration was needed.** `migrate-prod --dry-run` reports `pending migrations: none`. There is
  no 0046: every column key the rollout uses already existed, verified against `information_schema`
  by five independent read-only passes before anything was written.
- **`seed-columns --apply`**: 354 definitions — 187 on the template, 167 on Gratsi.
- **Seven rows retired**, named in full before they were removed: the Angles rows that became
  inherited. They were only found because applying to production exposed that the seed was
  upsert-only, so a row dropped from the seed lived on and kept winning. `retireUnseededRows` now
  soft-deletes rows **the seed itself wrote** (`created_by = actorId`), scoped to the tables a group
  lists — so an admin's own relabel in Column Admin survives a re-seed, and `themes` is untouched.
- **Verified per table through the real resolver against production**, not PGlite: products 12/9,
  angles 16/11, concepts 22/20, creators 36/34 — every count matching its test. Gratsi's Angles set
  reads `Brief` and `Exact Script` from its own rows and the other nine from the template.

## Gates

typecheck 6/6 · lint zero warnings · vitest 192 files / **2701** tests · full Playwright **217
passed / 3 skipped**, the one failure being the tracked propagation cold-route flake, which passes
on its own (verified twice). The 3 skips are the live-mode specs, which need Clerk credentials this
machine does not have.

## Not done: the remaining nine pages

| Page | Table | Cols | Seeded P/G | Effort |
| --- | --- | --- | --- | --- |
| `creative-modules` | `creative_modules` | 5 | 2/2 | small |
| `client-assets` | `client_asset_folders` | 5 | 3/0 | small |
| `copy-types` | `copy_types` | 5 | 0/2 | medium |
| `sm-campaign-feed` | `sm_campaign_feed_tasks` | 7 | 0/5 | small code, one ruling |
| `youtube-copywriting` | `youtube_copy` | 10 | 0/17 | medium |
| `creative-reporting` | `creative_reporting` | 12 | 0/11 | medium |
| `email-flows` | `email_flows` | 9 | 0/11 | medium |
| `email-campaigns` | `email_campaigns` | 12 | 0/15 | medium |
| `creative-sheet` | `creative_sheet_items` | 7 | 3/10 | large |

Recommended order is that order: the two with parent rows first, then the shape-identical pair, then
the formula pages, with `creative-sheet` last because it is the only genuinely hard one.

**Pages deliberately NOT in scope**, each checked and dismissed with a reason: `team`,
`notifications`, `propagation`, `creator-ranking`, `performance`, `upload-links`,
`onboarding-forms` (raw tables or settings matrices, no `tableKey`), `assets`, `ad-spy` (card grids),
the `queue` boards and the Concepts Kanban (lane-driven, not column-driven), `interface-config`,
`onboard`, `briefs`, `campaigns`, `copywriting` (redirects), `column-admin` (already the resolver's
consumer), and the UGC Partnerships grid (a second table on a migrated page).

## Two rulings block most of the nine

**1. The virtual-column ruling.** Seven displayed columns across five of the nine have **no Postgres
column at all** — `creative_reporting` Difference CPA, `email_campaigns` and `email_flows` Design due
and Copywriting due, `sm_campaign_feed_tasks` Reminder, `creative_sheet_items` Name. All seven are
already computed on read in the right place (`packages/db/src/formulas/`), which is correct and must
stay. But `column_key` admits only a real column or a table with a foreign key back, so none of them
can be configured, and a resolver-driven page would drop all seven. The choice is a new CLASS of key
for computed columns, or those columns staying outside the resolver with the reason recorded.

**2. The Gratsi-only parent-row gap, in its larger form.** Six of the nine tables have **zero**
parent rows — `youtube_copy`, `email_campaigns`, `email_flows`, `sm_campaign_feed_tasks`,
`copy_types`, `creative_reporting` — because the parent template base has only 15 tables and none of
these six is among them. This is not the same as the Angles case: there the parent had the table and
not the columns. Here the parent base has no such table, so **the platform owns the whole column
set**, and the fix is the same pattern at larger scale — platform rows on the parent for every
column. Until then those six pages would resolve nothing and render an empty grid for every brand
except Gratsi.

## Questions for Talal

1. **Is "platform" the right name for a column the parent base does not define?** Thirty columns are
   now `source: 'platform'` on that basis, including some Gratsi's base DOES define. The alternative
   reading is that `platform` means "no Airtable field anywhere" and these should be `parent` rows
   the template merely lacks a field for. It changes the admin's marker and nothing else today, but
   it is the vocabulary the next nine tables inherit.
2. **The Concepts count on the Products grid.** It is two hops away
   (`products → angle_products → angles → concepts`), reaches 8 of 9 live products, and has no legal
   `column_key` — nothing links concepts to products directly. It is kept, named in the gate's
   documented exemption list beside the two existing inferred chains. Keep it, move it to the panel,
   or give computed columns a key shape of their own?
3. **Column ORDER changed on two grids.** Angles' nine platform columns used to carry Gratsi's field
   positions (Status was second); they now sort after the template's Airtable fields. UGC's three
   status tracks moved from positions 2-4 to the template's 12-14. Both are configuration now and any
   brand can reorder them in Column Admin — but the default changed, so it is worth a look.
4. **Three Products columns are configured and not drawn**: `collections`, `campaigns_offers` and
   `copywriting`, the parent base's reverse links. Drawing them means three more whole-table reads on
   a page that already makes six. They are stated in the page's notice. Draw them, or hide them on
   the template?
5. **Themes** — the four rulings in
   `docs/decisions/themes-stays-outside-the-resolver-2026-10-03.md`, of which the one that matters is
   whether the client-facing Themes table follows. It is deliberately narrow because clients see zero
   internal data, and a shared admin-editable column set reaching it is a route for an internal
   column to appear in front of a client.
6. **The importer reads an Airtable field neither base defines** — `f['Collection Link']` at
   `airtable-import.ts:837`, so `products.collection_link` can never be written by an import although
   production has data in it. Filed as its own task; it is a defect, not a rollout decision.
