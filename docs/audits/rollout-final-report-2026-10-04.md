# Column rollout — final report, 2026-10-04

Virtual columns, the six zero-parent tables, nine pages migrated, and production. Every number was
read off a command.

## The virtual-column design, in one paragraph

A `column_definitions` row may now name a column that is **computed rather than stored**, through one
new nullable column: `formula`. NULL means `column_key` names a stored Postgres column or a junction;
a non-null value names an export of `packages/db/src/formulas/` and means the column is virtual —
worked out on every read, written by nothing. One column rather than a boolean beside a name, because
a boolean would permit "virtual, with nothing to compute it"; and orthogonal to `source`, because
`source` says who owns a column while `formula` says whether there is anything to store (all six
virtual columns in production are also `platform`). The name is validated against `VIRTUAL_FORMULAS`
rather than being free text, so a typo is caught by the seed's gate instead of discovered when a page
renders nothing, and the formula signatures are deliberately NOT unified — each takes what its field
actually depends on, because flattening them behind one row-shaped interface is how a pure function
stops being testable. "Never stored" is structural, not remembered: `storedColumns(resolved)` is the
only writable subset and the one place that rule lives, and `formulaForWrite` keeps a child's relabel
from turning a computed column into a stored one, the same hole `sourceForWrite` closes for `source`.
The gate gives a virtual row two rules in place of the key rule — it must name an exported formula,
and its key must NOT be a real column of the table, since a virtual column shadowing a stored one
would give one datum two readings. Detach, reattach and hide are untouched.

## Per table

| Table | State | Commit | Columns (inheriting / Gratsi) | Virtual |
| --- | --- | --- | --- | --- |
| Products | done (earlier wave) | `600a230` | 12 / 9 | — |
| Angles | done (earlier wave) | `8f7f0b2` | 16 / 11 | — |
| Concepts | done (earlier wave) | `5eb9582` | 22 / 20 | — |
| UGC Management | done (earlier wave) | `12e086f` | 36 / 34 | — |
| Personas | done (earlier wave) | — | 15 / 7 | — |
| Copy Types | **done** | `1bcfc08` | 4 / 4 | — |
| SM Campaign Feed | **done** | `8609a02` | 6 / 6 | `reminder_trigger` |
| Email Flows | **done** | `0ab72c3` | 13 / 13 | both due dates |
| Creative Reporting | **done** | `054b241` | 13 / 13 | `difference_cpa` |
| Email Campaigns | **done** | `42f818a` | 17 / 17 | both due dates |
| YouTube Copywriting | **done** | `2aaf3a3` | 16 / 16 | — |
| Creative Modules | **done** | `db4502e` | 4 / 4 | — |
| Client Assets | **done** | `676949c` | 4 / 4 | — |
| Creative Sheet | **STUCK** | `c37d47e` (doc) | — | its name would be |
| Themes | **held global** | earlier `14af7f3` | — | — |

Supporting commits: `46549dd` virtual columns · `4ddc752` the six all-platform seeds · `77b9eb2` the
admin empty-state spec · `1ba2697` the reconciler scope fix and `verify-rollout`.

Every migrated page passes the grep proof: no `GridColumn<…>[] = [` array and zero `header:` strings.
A sweep of `apps/web/src/app/app/**` finds exactly two files still building one — `creative-sheet`
and `themes`, both documented exclusions.

## The six tables the parent base does not have

`copy_types`, `creative_reporting`, `email_campaigns`, `email_flows`, `sm_campaign_feed_tasks` and
`youtube_copy` had ZERO parent rows, because the parent template base carries 15 tables and none of
these six is among them. A resolver-driven page would have rendered an empty grid for every brand
except Gratsi, with the parent fallback empty too. They are seeded as 69 all-platform parent rows
through a new `platformRows` helper, with labels and order taken from the Gratsi base's own field
names and positions — for a table the parent base does not have, that is the only evidence of either
that exists.

**Gratsi shrank from 44 rows on those tables to 5.** Its rows were duplicates of the labels the
platform set now carries; they were the only reason the seed knew these columns existed. What is left
is where Gratsi genuinely differs: two link labels on `copy_types`, two on `youtube_copy`
(`Descriptions (90 caractères max)`, `USED`), and its status banner, which has no column at all.

## Production

| Step | Result |
| --- | --- |
| `migrate-prod --dry-run` | one pending migration, `0046_virtual-columns`, one guarded statement |
| `migrate-prod --apply` | applied. `column_definitions.formula` is `text`, nullable. Journal 46 → 47 |
| `seed-columns --apply` | 369 definitions — 259 template, 110 Gratsi — with **59 rows retired**, each named before removal |
| `verify-rollout` | all 13 tables match their PGlite gates exactly; 6 virtual columns carry their formulas; none is in the writable set |
| Junctions | all six unchanged against the 2026-10-01 baseline (78 · 57 · 115 · 207 · 4 · 87) |

`column_definitions` now holds 369 live rows, 66 soft-deleted, 6 virtual.

**Seven of the migrated tables hold no data in production yet** — `copy_types`,
`creative_reporting`, `email_campaigns`, `email_flows`, `sm_campaign_feed_tasks`, `youtube_copy`,
`creative_modules`, `client_asset_folders` are all at 0 live rows. Their column configuration is
correct and verified; the grids will be empty until those tables are imported. Worth knowing before
anyone opens one and reads the empty state as a bug.

## The bug a dry run caught, which is the one worth reading

Reconciliation was scoped to the table keys the CURRENT GROUP lists. That held while a group merely
dropped a row, and broke the moment a group stopped listing a table at all: emptying Gratsi's
`email_campaigns` rows meant the group no longer named that table, so the reconciler skipped it and
**42 old `custom` rows survived in production**. A child row always wins, so Gratsi would have
resolved stored columns where the parent now has virtual ones — four pages pointed at columns that do
not exist, with nothing failing loudly. The scope is now the union across all groups, which is the
honest precondition ("the seed has an opinion about this table"); `themes` is in no group, so it is
still untouched, and `created_by = actorId` still means an admin's own row is never retired.

Found before anything was written, because the seed's dry run is its default and it names every
retirement rather than counting them.

## Gates

typecheck 6/6 · lint zero warnings · vitest 193 files / **2719** tests · full Playwright **218
passed, 0 failed, 3 skipped** (the live-mode specs, which report themselves skipped without Clerk
credentials this machine does not have).

## Questions for Talal

1. **Creative Sheet's two name formulas disagree**, and that is a defect, not a preference:
   `creativeSheetName` returns `"October-"` for an empty brief name while `creativeSheetItemName` —
   which is what the page actually renders — returns `"October"`. Airtable's `&` concatenates an
   empty value as an empty string, so the first is faithful and the second is tidier, and choosing
   changes what the page displays. Filed as its own task. Until it is settled the page's name cannot
   become a virtual column, because a virtual column names exactly one formula.
2. **The composite QA cell** on Creative Sheet: one header over three stored booleans, three rows in
   the seed. Collapse three keys into one cell (which breaks the one-key-one-column assumption Column
   Admin shows an admin) or grow three tick columns?
3. **Is Creative Sheet worth configuring at all?** The parent base calls it `DONT USE Creative Sheet`
   and only 5 of its 17 fields carry anything.
4. **Column order changed on several grids**, and it is configuration now so any brand can change it
   back. Notably: SM Campaign Feed's `Reminder Trigger` sorts last, Email Campaigns' due dates sit
   beside the send date, and Creative Reporting's `Creative` moves to second. Each follows the Gratsi
   base's own field order, which is the only order a table the parent base lacks can have.
5. **Labels are now the bases' own field names**, which reads differently in places: `Flow name` →
   `Flow Name`, `Due date` → `Due Date`, `Creators` → `Creator`, `Linked designs` →
   `(Internal) Creative Design`. Relabelling any of them is a data edit in Column Admin, not a
   deployment — but the defaults are the bases', not the app's previous wording.
6. **Twenty-odd columns are configured and not drawn**, reported in each page's notice rather than
   hidden: `production_status` on Concepts, three on UGC, three on Products, five on Email Flows,
   six on Email Campaigns. Each is one registry line if the column is wanted, or a hidden row on the
   template if not.
7. **The importer still reads an Airtable field neither base defines** — `f['Collection Link']` — so
   `products.collection_link` can never be written by an import although production holds data in it.
   Filed as its own task from the previous wave.
