# What a `column_key` may name, for a LINK column — 2026-10-03

Established while migrating the Products page to `resolveColumns`. Every claim here was read off the
live Airtable Meta API, production Postgres, or the test that already enforces the rule. Nothing is
inferred from a document alone.

## The rule that already exists

`packages/db/src/column-seed.test.ts` ("keys every column to a real Postgres column or a junction OF
ITS OWN TABLE") enforces, against `information_schema`, that every seeded `column_key` is either:

1. a real column of that table, or
2. a table that carries a **foreign key back to that table**.

Rule 2 is wider than "a junction table", and that matters: it already admits the reverse side of a
one-to-many. `collections.product_id` references `products`, so `collections` is a legal
`column_key` on `products` by the rule as written and as tested — no extension, no new vocabulary.
The test's own comment explains why the FK check is there rather than a bare name check: `assets` is
a real table, so `['assets', …]` on `creative_briefs` would otherwise pass when the correct key is
`asset_id`.

Two keys are exempt and documented in the test: `concepts.angle_products` and
`concepts.angle_personas`, because Gratsi stores `Product` and `Personas` on Concepts where the
parent holds them on Angles, and the engine resolves them through the inferred concept×angle chain.

## Applied to `products`

Every table in production carrying a foreign key to `products`, and therefore every legal link key
for that table:

`angle_products` · `campaigns_offers` · `collections` · `copywriting` · `creative_briefs` ·
`creator_products` · `email_campaign_products` · `personas` · `youtube_copy_products`

The parent base's `(Internal) Product` (`tblfvfJMYNBz2OYYw`, 8 fields, read live) pairs with them:

| Airtable order | Parent field | type | `column_key` |
| --- | --- | --- | --- |
| 1 | `Product Name / Landing Page Name` | multilineText | `name` (stored) |
| 2 | `Link` | url | `link` (stored) |
| 3 | `(Internal) Collections` | multipleRecordLinks | `collections` |
| 4 | `Campaigns & Offers` | multipleRecordLinks | `campaigns_offers` |
| 5 | `Angles` | multipleRecordLinks | `angle_products` |
| 6 | `(Internal) Creative Design` | multipleRecordLinks | `creative_briefs` |
| 7 | `Meta Copywriting` | multipleRecordLinks | `copywriting` |
| 8 | `UGC Management` | multipleRecordLinks | `creator_products` |

The Gratsi base's copy of the same table id has 11 fields and renames nothing. Its `Angles`,
`(Internal) Creative Design` and `UGC Management` share the parent's names, so Gratsi INHERITS those
three rather than carrying rows of its own. The three parent fields Gratsi does not have —
`(Internal) Collections`, `Campaigns & Offers`, `Meta Copywriting` — are Gratsi HIDDEN rows
(`docs/audits/overnight-gratsi-columns.md` §10).

## Three findings that are NOT settled by the rule

**1. `collection_link` has no Airtable field in either base.** Verified live: the field
`Collection Link` does not exist on `tblfvfJMYNBz2OYYw` in the parent OR in Gratsi, although
`packages/db/src/airtable-import.ts:837` reads `f['Collection Link']` for it. Production has 2 of 9
live products with the column set, so it holds real data and the Products page renders it as
"Collection link". A column with data, displayed, and with no Airtable source is what `source:
'platform'` is for — the same shape as `concepts.internal_status`. Treated as a platform row.
The importer line is a separate defect and is filed as its own task; this decision does not depend
on how that is resolved, because the column and its data exist either way.

**2. `email_campaign_products` and `youtube_copy_products` are app relations with no Airtable field
on this table.** Neither base's `(Internal) Product` has an Email Campaigns link; Gratsi has two
`Email Campaigns Management copy` fields, but both are `singleLineText`, not links. Gratsi alone has
a `Youtube Copywriting` link, which the parent lacks. Both junctions exist in Postgres and both are
legal keys. The Products page shows both as counts today, so they are kept: `email_campaign_products`
as a platform row (no Airtable field in either base) and `youtube_copy_products` as a Gratsi
child-added row (a Gratsi field with no parent counterpart). Dropping either would lose a column the
page shows today, which is forbidden.

**3. `concepts` is NOT a legal key on `products`, and the page shows a concept count.** `concepts`
has no `product_id` — verified against `information_schema` — so it carries no foreign key back to
`products` and would fail the seed's gate. The count is two hops
(`products → angle_products → angles → concepts`), computed on read in
`packages/db/src/products.ts:89` as `linked.counts`. It is therefore DERIVED, and by the standing
rule a derived value is never stored and gets no data row. But it is also displayed, and "drop
nothing" applies. **This one is left for the product owner** rather than decided here: the choices
are to keep it as an always-on derived column outside the resolver, to give derived display columns
a reserved key shape the gate admits explicitly, or to move the count to the panel only. Until it is
answered the column stays rendered, outside the resolved set, and is listed in the rollout report.
