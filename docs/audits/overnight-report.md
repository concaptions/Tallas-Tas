# Column inheritance — Wave 2 report (2026-10-03)

What shipped, what is in production, and what is deliberately not done. Every number below was read
off a command, not estimated.

## What this wave was for

Airtable-style base inheritance. One parent base ("Creative Hub Template",
`b993e8c3-71d5-4bb2-a4be-e20984974b9a`, `is_template = true`) defines each table's columns; the four
client bases read them back. An admin may DETACH a column on a brand to relabel, hide or reorder it;
a detached column stops following the parent; reattaching drops the local row and snaps back. Only
an agency admin changes structure.

## In production

Applied in this order deliberately — schema before the deploy that reads it, which is the ordering
PARITY-29 learned the hard way.

| Step | Result |
| --- | --- |
| Migrations `0044_personas-passion`, `0045_column-inheritance` | Applied. Dry run showed exactly those two; both `passion` statements skipped by their `information_schema` guards, as expected, because the column already existed as drift. `column_definitions` created with `display_order` as **integer**, its unique `(brand_id, table_key, column_key)` index and its `brands` FK. Journal 44 → 46 rows. |
| `seed-columns --apply` | 325 column definitions: 155 on the template, 170 on Gratsi. |
| `import-passion --apply` | 23 of 28 Gratsi personas; the other 5 carry no Airtable value. All 23 were empty beforehand. |
| Junction counts after every write | Unchanged: `angle_personas` 78, `angle_products` 57, `concept_angles` 115, `concept_collections` 207, `concept_themes` 4, `creator_concepts` 87. |

Verified against production, not against PGlite, with `check-columns` — which calls the resolver the
app calls:

- **Gratsi `personas`** resolves to exactly its seven labels, in order, from its own rows:
  Name · Description [Age Status Salary] · Personality · Drivers for this persona · Passion ·
  Problem-Solution Awareness Level · Angles.
- **Niagara Sleep Solutions, Mattress Central, Funky Painting and test** each resolve to the
  template's fifteen, under the template's labels, with `inherited_from` naming the template brand.
- **Concepts platform columns** (`name`, `internal_status`, `client_status`) are owned by the
  template and inherited by every brand, Gratsi included.

## Commits on `main`

| Commit | What |
| --- | --- |
| `a7f5ca6` WAVE2-QA | The five cross-branch assertions the all-tables seed invalidated. Three branches were green alone and red together. |
| `0b2b6bd` WAVE2-PROD | Guarded 0044, plus `seed-columns`, `check-columns` and `import-passion` — each with a dry run as its default. |
| `e19875a` TEMPLATE-SWITCHER | The parent base is selectable, by an agency admin and nobody else. |
| `9e6a74c` VIEWS-RECONCILE | A view saved before the resolver no longer hides every column. |
| `26f042c` PLATFORM-COLUMNS | `source: 'platform'`, so migrating a page cannot drop the approval tracks or the generated names. |
| `5890a32` E2E-ESCAPE | The four reload-then-Escape panels close reliably, by pressing after hydration. |

## Four things that were nearly wrong, and what they cost

**Demo mode is Niagara, not Gratsi.** Two specs asserted Gratsi's labels on the Personas page. Once
the page became resolver-driven that was no longer a property of the page but of the brand in view,
and demo mode's brand is `DEMO_BRAND_ID` = `…111` = Niagara, which owns no rows and inherits the
template's labels. The specs now assert the inherited labels and map each Gratsi field to the name
its viewing brand uses, so every field is still proven present; Gratsi's own seven are asserted
against PGlite in `packages/db/src/column-seed.test.ts`, which is the gate for the display spec.

**`passion` was production drift.** It existed on the live table with no migration behind it, so the
bare `ADD COLUMN` in 0044 would have raised 42701 and leaned on the runner's error tolerance. It now
checks `information_schema` first, like 0045.

**A single-table import would have deleted links.** `importAirtableExport`'s second pass clears each
junction for the records it imports and re-links from the export, so a slice missing a link target
deletes links — that is how `concept_angles` went 115 → 4 on 2026-10-01. The `Passion` backfill is
therefore not a run of the importer: it matches on `legacy_airtable_id`, writes one column and
touches no junction.

**Migrating Concepts would have dropped both approval tracks.** `COLUMN_SEED` was read off the two
Airtable bases, so every row in it was an Airtable field — and a resolver-driven page renders only
what the resolver returns. Concepts was seeded with eleven Airtable columns and no `name`, no
`internal_status` and no `client_status`, while the table carries all three. `source: 'platform'`
closes that hole before the migration happens.

## Gates

Repo root, on `5890a32`:

- `pnpm typecheck` — 6/6 packages.
- `pnpm lint` — zero warnings.
- `pnpm test` — 192 files, 2692 tests, all passing.
- `pnpm exec playwright test` — **218 passed, 0 failed, 3 skipped**. The three are the live-mode
  specs, which report themselves skipped without the Clerk credentials this machine does not have
  (D-008), not failures hidden behind a skip.

## Not done, and why

- **The remaining pages are not resolver-driven.** Personas is. Products, Angles, Concepts, Themes,
  UGC and the rest still build their columns in their own `fields.ts`. `source: 'platform'` and
  `reconcileViewFields` exist so each page can migrate without dropping a platform column or
  breaking a saved view, but the migrations themselves are a page at a time and are not in this wave.
- **The three live-mode E2E specs are unverified**, and stay in "Pending human verification" in
  `docs/runbook.md`: they need Clerk credentials, which this machine has none of.
- **Nothing was merged through a pull request.** The instruction for this run was to push to `main`
  directly.
