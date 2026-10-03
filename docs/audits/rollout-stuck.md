# Column rollout — stuck items

What the rollout could not finish, and exactly what each one is waiting on. Written 2026-10-03.
Nothing here is blocked on effort; each is blocked on a decision or on another item in this list.

## Stuck on a decision

### 1. Themes — outside the resolver
**State** decided and documented, not implemented.
**Waiting on** the four rulings in `docs/decisions/themes-stays-outside-the-resolver-2026-10-03.md`.
**Why it cannot be guessed** `themes` has no legal `table_key` (it is deliberately absent from
`PROPAGATION_TABLES` because the library is global), two tests assert that absence, `used_by` is a
cross-brand count that no `column_key` shape admits, and there is a second deliberately-narrow Themes
table in the CLIENT interface — so a shared, admin-editable column set is a route for an internal
column to reach a client, against non-negotiable 10.

### 2. The virtual-column ruling — blocks five pages
**Pages** `creative-reporting`, `email-campaigns`, `email-flows`, `sm-campaign-feed`,
`creative-sheet`.
**The seven columns** Difference CPA · Design due ×2 · Copywriting due ×2 · Reminder · Creative Sheet
Name.
**State** all seven are already computed on read in `packages/db/src/formulas/`, which is correct and
must stay. None has a Postgres column.
**Waiting on** whether `column_key` gains a CLASS for computed columns, or whether these columns stay
outside the resolver with the reason recorded. `column_key` currently admits only a real column of
the table or a table carrying a foreign key back to it, enforced against `information_schema`.
**Why it cannot be guessed** `creative_sheet_items.name` is the sharp case: a platform row for it
fails the gate on the `unknown` branch, because `name` is neither a column of that table nor a table.
`concepts.name` only worked because `concepts` really has a `name` column. There is no transferable
precedent.

### 3. The composite QA cell — blocks `creative-sheet`
**State** one page header ("QA") draws THREE stored booleans (`qa_video_editor`, `qa_designer`,
`qa_strategist`), and the seed holds them as three rows. The resolver returns three columns where the
page draws one cell.
**Waiting on** either the registry collapsing three keys into one cell — which breaks the
one-key-one-column assumption the admin UI is built on and shows to admins — or the page gaining
three tick columns.

## Stuck on other work, not on a decision

### 4. The Gratsi-only parent-row gap, larger form — blocks six pages
**Pages** `youtube-copywriting`, `email-campaigns`, `email-flows`, `sm-campaign-feed`, `copy-types`,
`creative-reporting`.
**State** each has ZERO parent rows, because the parent template base has only 15 tables and none of
these six is among them. An inheriting brand resolves nothing, so a resolver-driven page would render
an empty grid for every brand except Gratsi.
**What it needs** the same pattern this rollout used three times, at larger scale: platform rows on
the parent for the whole column set, since the platform owns every column of a table the parent base
does not have. Mechanical, but it is roughly 60 rows and each needs its label and order decided from
the Gratsi base's field order.
**Not a decision** — only work. It should be one commit per table, as the five named tables were.

### 5. Three Products columns configured and not drawn
**State** `collections`, `campaigns_offers` and `copywriting` are parent reverse links, correctly
seeded, with no renderer; they come back in `missing` and the page states them.
**What it needs** three more whole-table reads on a page that already makes six, or a decision to
hide them on the template. Listed as question 4 in the report.

### 6. `production_status` on Concepts, `profile_pic_url` / `deadline` / `for_partnership_ads` on UGC
**State** configured on the template, no renderer, reported in each page's notice.
**What it needs** nothing urgent: `profile_pic_url` renders inside the frozen name cell rather than
as a column, and the other three have never been drawn. Each is a one-line registry entry if the
owner wants the column.

## Not stuck, for the record

The four migrated tables carry no open items. The propagation spec's `?status=` test fails only
under parallel load and passes on its own, twice verified; it is a cold-route timeout on a page this
rollout did not touch.
