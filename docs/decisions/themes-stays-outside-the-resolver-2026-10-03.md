# Themes stays outside the column resolver — 2026-10-03

Decided during the column-system rollout, when Themes came up in its turn. The instruction was to
"handle as global, no parent set", and this is what that works out to, with the evidence.

## The finding

**Themes has no legal `table_key`.** `column_definitions.table_key` is documented as "The content
table, as `PROPAGATION_TABLES` keys it" (`packages/db/src/schema/column-definitions.ts:32`), and
`themes` is deliberately absent from that registry (`packages/db/src/propagation.ts:204-227` lists
exactly 21 keys) because the themes library is GLOBAL across all brands — CLAUDE.md non-negotiable
3. The seed file already says so in its own voice and declines to act:

> `themes` … has no legal `table_key` — the audit classifies its six fields and declines to assign
> one. Seeding it needs that owner decision first. — `packages/db/src/column-seed.ts:261-265`

`resolveColumns(db, brandId, tableKey)` is keyed on a brand. A global table has no brand to resolve
against, so "resolver-driven" is not a thing Themes can straightforwardly be.

## Why it is not forced

Making Themes resolver-driven today would mean all of the following, and each is a change to
something that currently holds:

1. **Two tests assert the opposite.** `packages/db/src/column-seed.test.ts` asserts the seeded
   table-key set EQUALS `Object.keys(PROPAGATION_TABLES)`, and separately that `themes` is not in it.
   Both would have to be rewritten to admit a key the schema's own documentation excludes.
2. **One of its columns no gate admits.** `used_by` — the count that shows a global library is
   actually being shared — is neither a column of `themes` nor a table with a foreign key back to it,
   so the `information_schema` gate rejects it outright. Admitting it needs a new CLASS of
   `column_key` (computed: no column, no junction), not another documented exemption.
3. **Column Admin cannot offer it.** `columnAdminTables()` returns the propagation registry's keys,
   with the comment "Themes is absent on purpose" (`apps/web/src/app/app/column-admin/source.ts:69-71`).
   A table configurable in the database but absent from the only UI that configures it is worse than
   one that is honestly not configurable.
4. **The page resolves no brand, on purpose.** `loadThemes` takes no brand and its own comment
   forbids adding one (`apps/web/src/lib/themes-source.ts:19-25`). Reading a column config would
   need a second loader that resolves a brand for the configuration while the DATA stays global —
   two different scopes on one page.
5. **It risks the client boundary.** There is a second, deliberately narrow Themes table in the
   client interface (`/client/[brandSlug]/themes`: Name, Category, Active) that exists because
   clients see zero internal data — non-negotiable 10. A shared, admin-editable column set reaching
   that table is a way for an internal column to appear in front of a client. That is a bigger risk
   than the benefit of relabelling theme cards.

## The decision

Themes keeps its hand-built card layout and is **deliberately outside the resolver**. Its fields stay
in `apps/web/src/app/app/themes/fields.ts`. This costs the one thing: Themes is the single content
surface whose column labels and order an admin cannot change. Everything else about it — the global
library, the archive/restore toggle, the client-facing subset — keeps working as specified.

## What would change the decision

A ruling on all four of these, which are the product owner's and not inferable from the code:

1. **Which inheritance rule does a global table get?** All rows on the template brand with every
   brand inheriting verbatim is the cheapest and needs no resolver change. The alternative is an
   explicit global owner for brand-agnostic tables, which is the principled answer and the largest
   change.
2. **May a child brand relabel or hide a Themes column?** Under template-inheritance it technically
   could, which means Gratsi could read "Vibe" where Niagara reads "Category" on a library that is
   deliberately shared.
3. **Is `used_by` worth a new class of `column_key`?** It is the only column that shows the library
   is shared, and it has no Postgres column and no junction behind it.
4. **Does the client-facing Themes table follow?** If it does, the internal/client column boundary
   needs to be expressed in `column_definitions` itself rather than by that table being hand-written
   and narrow.
