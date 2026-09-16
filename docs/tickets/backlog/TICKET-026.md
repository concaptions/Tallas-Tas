# TICKET-026 · `brand_field_overrides`, `interface_pages`, `interface_fields` and `fieldVisibility`

- Owner: schema
- Size: M
- Depends on: TICKET-021
- PRD: §10 (client interface: which pages and which fields appear, configurable per brand; a PARENT
  interface and CHILD interfaces; default concept-card fields), §5 (per-brand tables seeded from the
  parent), §14.1
- Design: §2 (I2 for the first production templated tables), §3.2 (`templatedColumns`), §3.9 (the three
  tables, registry entries, natural keys), §4.6 steps 4 and 6 (`fieldVisibility`, `fieldKeyTargets`),
  §7 (interface configuration as a template), §8 (T17 `interface_pages` clause, T22 production
  registry, T23 `field_name` target, T27 `fieldVisibility` clause)

## Why

Structural changes are migrations that apply to every brand; per-brand visibility is data
(`brand_field_overrides`, CLAUDE.md architecture principle 4). The interface configuration of PRD §10
is the same mechanism: the template brand's rows are the parent interface, each child's copies the
child interface. These are the first registered tables, so they also prove the registry end to end.

## Acceptance criteria

1. Tables exactly as design §3.9 under `packages/db/src/schema/`: `brand-field-overrides.ts`,
   `interface-pages.ts` (with `pgEnum('interface_page_key', ['concepts', 'creatives', 'copywriting',
   'ugc', 'partnership'])`), `interface-fields.ts` (`page_id` NOT NULL FK to `interface_pages.id`). Each
   uses `templatedColumns` and `...templatedConstraints(name, t)` plus its partial unique index on
   alive rows: `brand_field_overrides_uq (brand_id, table_name, field_name)`, `interface_pages_uq
   (brand_id, page_key)`, `interface_fields_uq (brand_id, page_id, field_name)`. One migration.
2. Registry specs, one file each under `packages/db/src/template/specs/`, with exactly the design's
   lists: `brandFieldOverridesSpec` (propagated `tableName, fieldName, hidden, readOnly, label,
   position`; natural key `tableName, fieldName`), `interfacePagesSpec` (propagated `pageKey, enabled,
   position, label`; natural key `pageKey`), `interfaceFieldsSpec` (propagated `pageId, fieldName,
   visible, clientEditable, position`; link `pageId → interface_pages`, non-nullable; natural key
   `pageId, fieldName`); `localFields []` on all three; `labelField` `fieldName`, `pageKey`,
   `fieldName`. `templateRegistry` in `registry.ts` becomes
   `createTemplateRegistry([brandFieldOverridesSpec, interfacePagesSpec, interfaceFieldsSpec])`.
3. `packages/db/src/template/field-visibility.ts`: `fieldVisibility(scoped, tableName)` takes a
   `withBrand(...)` scope and returns `{ hidden: string[]; readOnly: string[]; labels: Record<string,
   string>; positions: Record<string, number> }` from that brand's alive `brand_field_overrides` rows
   for `table_name`; `stripHidden(keys, visibility)` (pure) returns `keys − hidden`. Forms and CSV
   templates (Phase 5) call these; TICKET-025 calls `fieldVisibility` for patch rejection.
4. The `fieldKeyTargets` literal gains `{ table: 'brand_field_overrides', column: 'field_name',
   kind: 'scalar' }`.
5. `packages/db/src/seed.ts` (`db:seed`) inserts into the template brand the five `interface_pages`
   (`concepts` … `partnership`, positions 0–4, `enabled true`) and, for `concepts`, the PRD §10 default
   card fields `batch, category, name, conceptStyle, angleId, themeId, productId, description,
   painPoints, usp, personaId, hookExamples` (`visible true`, `clientEditable false`) plus
   `approvalStatus` and `clientComments` (`clientEditable true`), `template_row_id NULL`,
   `overridden_fields '[]'`. The child brand's copies are seeded by TICKET-027a.
6. Tests on PGlite through `testDb()`:
   - `registry-production.test.ts` (T22 production clause): `templateRegistry` constructs, `specs`
     order is overrides → pages → fields, `registryCompleteness(db, templateRegistry)` passes on the
     migrated schema.
   - `interface-tables.test.ts` (I2, §3.9): two alive `interface_pages` rows with one `(brand_id,
     page_key)` are rejected; a soft-deleted row plus an alive one with the same key are accepted; the
     same two cases for `interface_fields (brand_id, page_id, field_name)` and `brand_field_overrides
     (brand_id, table_name, field_name)`; `interface_fields.page_id` must reference an existing page;
     the full unique index `(brand_id, template_row_id)` rejects a second copy of one parent even when
     the first is soft-deleted.
   - `tenancy-interface.test.ts` (T17 clause): `withBrand(A).select(interfacePages)` never returns B's
     or T's rows.
   - `rename-field-key-overrides.test.ts` (T23 extension): `renameFieldKey(..., 'interface_pages',
     'label', 'title')` rewrites `brand_field_overrides.field_name` only for rows with `table_name =
     'interface_pages'`.
   - `field-visibility.test.ts` (T27 clause): B hides `interface_pages.label` → `fieldVisibility
     (withBrand(B), 'interface_pages').hidden` is `['label']` and `withBrand(A)` sees `[]`; a
     soft-deleted override row is ignored; `readOnly`, `labels` and `positions` are returned;
     `stripHidden` removes exactly the hidden keys.
7. `packages/db/src/index.ts` exports the tables, specs, `templateRegistry`, `fieldVisibility` and
   `stripHidden`. `pnpm typecheck && pnpm lint && pnpm test` exit 0.

## Gated criteria (D-008)

none

## Files touched

`packages/db/src/schema/brand-field-overrides.ts`, `packages/db/src/schema/interface-pages.ts`,
`packages/db/src/schema/interface-fields.ts`, `packages/db/src/schema/index.ts`,
`packages/db/src/template/specs/*.ts`, `packages/db/src/template/registry.ts` (the production array
only), `packages/db/src/template/field-visibility.ts`, `packages/db/src/template/field-key-targets.ts`
(one entry), `packages/db/src/seed.ts`, `packages/db/drizzle/*`, `packages/db/src/index.ts`, the
`*.test.ts` files next to the code.

## Notes

- No new dependency. `fieldVisibility` is brand-scoped through `withBrand`; no other query is added.
- Client users never write these tables; the route guard is TICKET-008 and the Phase 4 screens.
- `brand_field_overrides` is workspace-only; client field visibility is `interface_fields` (design §11
  rejected the single-table variant).
- Estimated size ≈170 LOC excluding tests.
